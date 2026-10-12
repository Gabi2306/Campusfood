import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { addDays, getBogotaDateString, isDateString } from '@/lib/business-date'
import { recordProduction, type ProductionEntry } from '@/lib/demand-history'
import { isStaff } from '@/lib/roles'

const isCount = (value: unknown) => value === null || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10_000)

// POST /api/history/production — cocina registra unidades producidas y sobrantes del día.
// Body: { date: 'YYYY-MM-DD', entries: [{ menuItemId, produced, wasted }] }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { date?: unknown; entries?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  const today = getBogotaDateString(new Date())
  const date = body.date ?? today
  // Se permite corregir hasta 7 días atrás; nunca días futuros.
  if (!isDateString(date) || date > today || date < addDays(today, -7)) {
    return NextResponse.json({ error: 'Solo puedes registrar producción de hoy o de los últimos 7 días.' }, { status: 400 })
  }

  const entries = body.entries
  if (
    !Array.isArray(entries) || entries.length === 0 || entries.length > 100 ||
    entries.some((entry) =>
      !entry || !Number.isSafeInteger(entry.menuItemId) || entry.menuItemId <= 0 ||
      !isCount(entry.produced ?? null) || !isCount(entry.wasted ?? null) ||
      (entry.wasted != null && entry.produced != null && entry.wasted > entry.produced)
    )
  ) {
    return NextResponse.json({ error: 'Revisa las cantidades: deben ser enteros y el sobrante no puede superar lo producido.' }, { status: 400 })
  }

  const saved = await recordProduction(date, (entries as ProductionEntry[]).map((entry) => ({
    menuItemId: entry.menuItemId,
    produced: entry.produced ?? null,
    wasted: entry.wasted ?? null,
  })))
  return NextResponse.json({ saved })
}
