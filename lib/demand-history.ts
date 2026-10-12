// HU-09 — Histórico de datos para alimentar el módulo de proyección.
//
// Consolida los pedidos en una tabla diaria (DemandHistory) con una fila por
// día y producto. Las filas guardan también lo que cocina produjo y lo que
// sobró, para medir el desperdicio y ajustar las proyecciones (HU-06).
import { prisma } from '@/lib/prisma'
import {
  addDays, bogotaDayBounds, getBogotaDateString, weekdayOf,
} from '@/lib/business-date'

export const MAX_HISTORY_DAYS = 180

type DayAggregate = {
  orderIds: Set<number>
  quantityOrdered: number
  quantityAdvance: number
  quantityCancelled: number
}

/**
 * Recalcula el histórico a partir de los pedidos.
 * - Hoy y ayer se recalculan siempre (pueden cambiar por cancelaciones o entregas).
 * - Los días cerrados solo se calculan si aún no existen, salvo con `force`.
 * Días sin ningún pedido no generan filas (cafetería cerrada o sin operación).
 */
export async function syncDemandHistory({ days = 60, force = false }: { days?: number; force?: boolean } = {}) {
  const window = Math.min(Math.max(Math.trunc(days), 1), MAX_HISTORY_DAYS)
  const today = getBogotaDateString(new Date())
  const yesterday = addDays(today, -1)
  const from = addDays(today, -(window - 1))
  const { start } = bogotaDayBounds(from)
  const { end } = bogotaDayBounds(today)

  const [orders, menuItems, existing] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        id: true, status: true, createdAt: true, pickupAt: true,
        items: { select: { menuItemId: true, quantity: true } },
      },
    }),
    prisma.menuItem.findMany({ select: { id: true, name: true, category: true, createdAt: true } }),
    prisma.demandHistory.findMany({
      where: { date: { gte: from, lte: today }, source: 'orders' },
      select: { date: true },
      distinct: ['date'],
    }),
  ])

  const existingDates = new Set(existing.map(({ date }) => date))
  const byDate = new Map<string, Map<number, DayAggregate>>()

  for (const order of orders) {
    // El día de servicio es el de recogida (si es anticipado) o el de creación.
    const date = getBogotaDateString(order.pickupAt ?? order.createdAt)
    if (date < from || date > today) continue
    const dayMap = byDate.get(date) ?? new Map<number, DayAggregate>()
    byDate.set(date, dayMap)

    for (const item of order.items) {
      const agg = dayMap.get(item.menuItemId) ?? {
        orderIds: new Set<number>(), quantityOrdered: 0, quantityAdvance: 0, quantityCancelled: 0,
      }
      if (order.status === 'cancelled') {
        agg.quantityCancelled += item.quantity
      } else {
        agg.orderIds.add(order.id)
        agg.quantityOrdered += item.quantity
        if (order.pickupAt) agg.quantityAdvance += item.quantity
      }
      dayMap.set(item.menuItemId, agg)
    }
  }

  const datesToWrite = [...byDate.keys()].filter((date) =>
    force || date >= yesterday || !existingDates.has(date)
  ).sort()

  const writes = datesToWrite.flatMap((date) => {
    const dayMap = byDate.get(date)!
    const dayEnd = bogotaDayBounds(date).end
    // Se incluyen en 0 los productos que existían ese día y no se pidieron:
    // un cero también es información para la proyección.
    const candidates = menuItems.filter((item) => item.createdAt < dayEnd || dayMap.has(item.id))

    // Si el día tenía datos de demostración/importados, los pedidos reales los
    // reemplazan por completo para no mezclar fuentes.
    const dropSynthetic = prisma.demandHistory.deleteMany({ where: { date, source: { not: 'orders' } } })

    return [dropSynthetic, ...candidates.map((item) => {
      const agg = dayMap.get(item.id)
      const data = {
        weekday: weekdayOf(date),
        itemName: item.name,
        category: item.category,
        ordersCount: agg?.orderIds.size ?? 0,
        quantityOrdered: agg?.quantityOrdered ?? 0,
        quantityAdvance: agg?.quantityAdvance ?? 0,
        quantityCancelled: agg?.quantityCancelled ?? 0,
        source: 'orders',
      }
      return prisma.demandHistory.upsert({
        where: { date_menuItemId: { date, menuItemId: item.id } },
        // Se conservan quantityProduced / quantityWasted registrados por cocina.
        update: data,
        create: { date, menuItemId: item.id, ...data },
      })
    })]
  })

  if (writes.length) await prisma.$transaction(writes)

  return { from, to: today, syncedDates: datesToWrite }
}

export type HistoryQuery = { from: string; to: string; category?: string | null }

export async function getDemandHistory({ from, to, category }: HistoryQuery) {
  const rows = await prisma.demandHistory.findMany({
    where: { date: { gte: from, lte: to }, ...(category ? { category } : {}) },
    orderBy: [{ date: 'asc' }, { category: 'asc' }, { itemName: 'asc' }],
  })

  type DaySummary = {
    date: string; weekday: number; total: number; advance: number; cancelled: number
    produced: number | null; wasted: number | null; byCategory: Record<string, number>
  }
  const days = new Map<string, DaySummary>()
  type ItemSummary = {
    menuItemId: number; itemName: string; category: string; days: number
    quantityOrdered: number; quantityAdvance: number; quantityCancelled: number
    produced: number; wasted: number; daysWithProduction: number; avgPerDay: number; wasteRate: number | null
  }
  const items = new Map<number, ItemSummary>()

  for (const row of rows) {
    const day = days.get(row.date) ?? {
      date: row.date, weekday: row.weekday, total: 0, advance: 0, cancelled: 0,
      produced: null, wasted: null, byCategory: {},
    }
    day.total += row.quantityOrdered
    day.advance += row.quantityAdvance
    day.cancelled += row.quantityCancelled
    day.byCategory[row.category] = (day.byCategory[row.category] ?? 0) + row.quantityOrdered
    if (row.quantityProduced != null) day.produced = (day.produced ?? 0) + row.quantityProduced
    if (row.quantityWasted != null) day.wasted = (day.wasted ?? 0) + row.quantityWasted
    days.set(row.date, day)

    const item = items.get(row.menuItemId) ?? {
      menuItemId: row.menuItemId, itemName: row.itemName, category: row.category, days: 0,
      quantityOrdered: 0, quantityAdvance: 0, quantityCancelled: 0,
      produced: 0, wasted: 0, daysWithProduction: 0, avgPerDay: 0, wasteRate: null,
    }
    item.itemName = row.itemName
    item.category = row.category
    item.days += 1
    item.quantityOrdered += row.quantityOrdered
    item.quantityAdvance += row.quantityAdvance
    item.quantityCancelled += row.quantityCancelled
    if (row.quantityProduced != null) {
      item.produced += row.quantityProduced
      item.wasted += row.quantityWasted ?? 0
      item.daysWithProduction += 1
    }
    items.set(row.menuItemId, item)
  }

  const itemList = [...items.values()].map((item) => ({
    ...item,
    avgPerDay: item.days ? Math.round((item.quantityOrdered / item.days) * 10) / 10 : 0,
    wasteRate: item.produced > 0 ? Math.round((item.wasted / item.produced) * 1000) / 1000 : null,
  })).sort((a, b) => b.quantityOrdered - a.quantityOrdered)

  const dayList = [...days.values()]
  const totals = dayList.reduce((acc, day) => ({
    quantityOrdered: acc.quantityOrdered + day.total,
    quantityAdvance: acc.quantityAdvance + day.advance,
    quantityCancelled: acc.quantityCancelled + day.cancelled,
    produced: acc.produced + (day.produced ?? 0),
    wasted: acc.wasted + (day.wasted ?? 0),
  }), { quantityOrdered: 0, quantityAdvance: 0, quantityCancelled: 0, produced: 0, wasted: 0 })

  return {
    from, to,
    operatingDays: dayList.length,
    totals: {
      ...totals,
      avgPerDay: dayList.length ? Math.round((totals.quantityOrdered / dayList.length) * 10) / 10 : 0,
      wasteRate: totals.produced > 0 ? Math.round((totals.wasted / totals.produced) * 1000) / 1000 : null,
    },
    days: dayList,
    items: itemList,
    rows,
  }
}

export type ProductionEntry = { menuItemId: number; produced: number | null; wasted: number | null }

/** Registra lo producido y lo sobrante de un día (personal de cocina). */
export async function recordProduction(date: string, entries: ProductionEntry[]) {
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: entries.map((entry) => entry.menuItemId) } },
    select: { id: true, name: true, category: true },
  })
  const writes = entries.flatMap((entry) => {
    const item = menuItems.find(({ id }) => id === entry.menuItemId)
    if (!item) return []
    return [prisma.demandHistory.upsert({
      where: { date_menuItemId: { date, menuItemId: item.id } },
      update: { quantityProduced: entry.produced, quantityWasted: entry.wasted },
      create: {
        date, menuItemId: item.id, weekday: weekdayOf(date), itemName: item.name, category: item.category,
        quantityProduced: entry.produced, quantityWasted: entry.wasted, source: 'orders',
      },
    })]
  })
  if (writes.length) await prisma.$transaction(writes)
  return writes.length
}

const CSV_COLUMNS = [
  'date', 'weekday', 'menuItemId', 'itemName', 'category', 'ordersCount', 'quantityOrdered',
  'quantityAdvance', 'quantityCancelled', 'quantityProduced', 'quantityWasted', 'source',
] as const

export function historyToCsv(rows: Awaited<ReturnType<typeof getDemandHistory>>['rows']) {
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [
    CSV_COLUMNS.join(','),
    ...rows.map((row) => CSV_COLUMNS.map((column) => escape(row[column])).join(',')),
  ].join('\n')
}
