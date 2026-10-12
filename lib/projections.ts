// HU-06 — Proyecciones diarias por tipo de menú para el personal de cocina.
//
// Método (explicable y sin dependencias externas):
//  1. Base histórica: promedio ponderado de las unidades pedidas el mismo día
//     de la semana en las últimas 8 semanas (las semanas recientes pesan más).
//     Si hay menos de 3 muestras se usa el promedio de los últimos 28 días.
//  2. Tendencia: relación entre los últimos 7 días y los 21 anteriores,
//     acotada entre 0,8 y 1,2.
//  3. Pedidos confirmados: unidades ya pagadas para el día (incluye anticipados).
//     La proyección nunca queda por debajo de lo confirmado.
//  4. Margen de seguridad: media desviación estándar (máx. 20 %), que se
//     elimina si el desperdicio reciente del producto supera el 15 %.
import { prisma } from '@/lib/prisma'
import {
  addDays, bogotaDayBounds, diffInDays, getBogotaDateString, WEEKDAY_LABELS, weekdayOf,
} from '@/lib/business-date'
import { syncDemandHistory } from '@/lib/demand-history'

const SAME_WEEKDAY_WEEKS = 8
const FALLBACK_DAYS = 28
const WASTE_THRESHOLD = 0.15

export type Confidence = 'alta' | 'media' | 'baja'

export type ItemProjection = {
  menuItemId: number
  name: string
  category: string
  iconKey: string
  confirmed: number
  advance: number
  baseline: number
  trend: number
  expected: number
  recommended: number
  low: number
  high: number
  samples: number
  basis: 'mismo día de la semana' | 'últimos 28 días' | 'sin histórico'
  confidence: Confidence
  wasteRate: number | null
}

export type CategoryProjection = {
  category: string
  confirmed: number
  advance: number
  expected: number
  recommended: number
  wasteRate: number | null
  confidence: Confidence
  items: ItemProjection[]
}

function weightedStats(values: number[], decay: number) {
  if (!values.length) return { mean: 0, std: 0 }
  let weightSum = 0
  let sum = 0
  values.forEach((value, index) => {
    const weight = decay ** index
    weightSum += weight
    sum += value * weight
  })
  const mean = sum / weightSum
  let variance = 0
  values.forEach((value, index) => {
    variance += decay ** index * (value - mean) ** 2
  })
  return { mean, std: Math.sqrt(variance / weightSum) }
}

const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

function confidenceFor(samples: number, mean: number, std: number): Confidence {
  const cv = mean > 0 ? std / mean : 1
  if (samples >= 6 && cv <= 0.35) return 'alta'
  if (samples >= 3) return 'media'
  return 'baja'
}

const CONFIDENCE_RANK: Record<Confidence, number> = { baja: 0, media: 1, alta: 2 }

export async function getDailyProjection(targetDate?: string) {
  const today = getBogotaDateString(new Date())
  const date = targetDate ?? today
  const weekday = weekdayOf(date)

  // Mantiene el histórico al día antes de proyectar (HU-09 → HU-06).
  await syncDemandHistory({ days: SAME_WEEKDAY_WEEKS * 7 + 7 })

  const historyFrom = addDays(date, -SAME_WEEKDAY_WEEKS * 7)
  // Solo días cerrados: el día en curso está incompleto y sesgaría el promedio.
  const historyTo = addDays(date <= today ? date : today, -1)
  const { start, end } = bogotaDayBounds(date)

  const [menuItems, history, orders] = await Promise.all([
    prisma.menuItem.findMany({ where: { available: true }, orderBy: [{ category: 'asc' }, { id: 'asc' }] }),
    prisma.demandHistory.findMany({
      where: { date: { gte: historyFrom, lte: historyTo } },
      orderBy: { date: 'desc' },
    }),
    prisma.order.findMany({
      where: {
        status: { not: 'cancelled' },
        OR: [
          { pickupAt: { gte: start, lt: end } },
          { pickupAt: null, createdAt: { gte: start, lt: end } },
        ],
      },
      select: { pickupAt: true, items: { select: { menuItemId: true, quantity: true } } },
    }),
  ])

  const confirmedByItem = new Map<number, { confirmed: number; advance: number }>()
  for (const order of orders) {
    for (const item of order.items) {
      const current = confirmedByItem.get(item.menuItemId) ?? { confirmed: 0, advance: 0 }
      current.confirmed += item.quantity
      if (order.pickupAt) current.advance += item.quantity
      confirmedByItem.set(item.menuItemId, current)
    }
  }

  const wasteFrom = addDays(date, -14)
  const items: ItemProjection[] = menuItems.map((menuItem) => {
    const rows = history.filter((row) => row.menuItemId === menuItem.id)
    const sameWeekday = rows.filter((row) => row.weekday === weekday)

    let basis: ItemProjection['basis'] = 'mismo día de la semana'
    let samples = sameWeekday.map((row) => row.quantityOrdered)
    let stats = weightedStats(samples, 0.85)
    if (samples.length < 3) {
      const recent = rows.filter((row) => diffInDays(row.date, date) <= FALLBACK_DAYS)
      samples = recent.map((row) => row.quantityOrdered)
      stats = weightedStats(samples, 0.95)
      basis = samples.length ? 'últimos 28 días' : 'sin histórico'
    }

    const last7 = rows.filter((row) => diffInDays(row.date, date) <= 7).map((row) => row.quantityOrdered)
    const prior21 = rows.filter((row) => {
      const age = diffInDays(row.date, date)
      return age > 7 && age <= 28
    }).map((row) => row.quantityOrdered)
    const priorAvg = average(prior21)
    const trend = last7.length >= 3 && prior21.length >= 3 && priorAvg > 0
      ? Math.min(1.2, Math.max(0.8, average(last7) / priorAvg))
      : 1

    const produced = rows.filter((row) => row.date >= wasteFrom && row.quantityProduced != null)
    const producedSum = produced.reduce((sum, row) => sum + (row.quantityProduced ?? 0), 0)
    const wastedSum = produced.reduce((sum, row) => sum + (row.quantityWasted ?? 0), 0)
    const wasteRate = producedSum > 0 ? wastedSum / producedSum : null

    const { confirmed = 0, advance = 0 } = confirmedByItem.get(menuItem.id) ?? {}
    const trended = stats.mean * trend
    const expected = Math.max(confirmed, Math.round(trended))
    const buffer = wasteRate != null && wasteRate > WASTE_THRESHOLD
      ? 0
      : Math.min(Math.ceil(stats.std * 0.5), Math.ceil(expected * 0.2))

    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      iconKey: menuItem.iconKey,
      confirmed,
      advance,
      baseline: Math.round(stats.mean * 10) / 10,
      trend: Math.round(trend * 100) / 100,
      expected,
      recommended: Math.max(confirmed, expected + buffer),
      low: Math.max(confirmed, Math.round(trended - stats.std)),
      high: Math.max(confirmed, Math.round(trended + stats.std)),
      samples: samples.length,
      basis,
      confidence: confidenceFor(samples.length, stats.mean, stats.std),
      wasteRate: wasteRate == null ? null : Math.round(wasteRate * 1000) / 1000,
    }
  })

  const categoryMap = new Map<string, CategoryProjection>()
  for (const item of items) {
    const category = categoryMap.get(item.category) ?? {
      category: item.category, confirmed: 0, advance: 0, expected: 0, recommended: 0,
      wasteRate: null, confidence: 'alta' as Confidence, items: [],
    }
    category.confirmed += item.confirmed
    category.advance += item.advance
    category.expected += item.expected
    category.recommended += item.recommended
    if (CONFIDENCE_RANK[item.confidence] < CONFIDENCE_RANK[category.confidence]) category.confidence = item.confidence
    category.items.push(item)
    categoryMap.set(item.category, category)
  }
  for (const category of categoryMap.values()) {
    const ids = new Set(category.items.map((item) => item.menuItemId))
    const rows = history.filter((row) => ids.has(row.menuItemId) && row.date >= wasteFrom && row.quantityProduced != null)
    const producedSum = rows.reduce((sum, row) => sum + (row.quantityProduced ?? 0), 0)
    const wastedSum = rows.reduce((sum, row) => sum + (row.quantityWasted ?? 0), 0)
    category.wasteRate = producedSum > 0 ? Math.round((wastedSum / producedSum) * 1000) / 1000 : null
    category.items.sort((a, b) => b.recommended - a.recommended)
  }

  const categories = [...categoryMap.values()].sort((a, b) => b.recommended - a.recommended)
  const historyDays = new Set(history.map((row) => row.date)).size

  return {
    date,
    isToday: date === today,
    weekday,
    weekdayLabel: WEEKDAY_LABELS[weekday],
    generatedAt: new Date().toISOString(),
    historyDays,
    totals: {
      confirmed: categories.reduce((sum, c) => sum + c.confirmed, 0),
      advance: categories.reduce((sum, c) => sum + c.advance, 0),
      expected: categories.reduce((sum, c) => sum + c.expected, 0),
      recommended: categories.reduce((sum, c) => sum + c.recommended, 0),
    },
    categories,
  }
}

export type DailyProjection = Awaited<ReturnType<typeof getDailyProjection>>
