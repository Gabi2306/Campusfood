import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { addDays, diffInDays, getBogotaDateString, isDateString } from '@/lib/business-date'
import {
  getDemandHistory, historyToCsv, MAX_HISTORY_DAYS, syncDemandHistory,
} from '@/lib/demand-history'
import { isStaff } from '@/lib/roles'

const CATEGORIES = ['Almuerzos', 'Bebidas', 'Snacks']

// GET /api/history?from&to&category&format=csv — histórico diario de demanda (HU-09).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const today = getBogotaDateString(new Date())
  const to = params.get('to') ?? today
  const from = params.get('from') ?? addDays(to, -29)
  const category = params.get('category')

  if (!isDateString(from) || !isDateString(to) || from > to) {
    return NextResponse.json({ error: 'El rango de fechas no es válido.' }, { status: 400 })
  }
  if (diffInDays(from, to) >= MAX_HISTORY_DAYS) {
    return NextResponse.json({ error: `El rango máximo es de ${MAX_HISTORY_DAYS} días.` }, { status: 400 })
  }
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Categoría inválida.' }, { status: 400 })
  }

  // Asegura que los días recientes estén consolidados antes de responder.
  await syncDemandHistory({ days: Math.min(diffInDays(from, today) + 1, MAX_HISTORY_DAYS) })
  const history = await getDemandHistory({ from, to, category })

  if (params.get('format') === 'csv') {
    return new NextResponse(`﻿${historyToCsv(history.rows)}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="historico-demanda-${from}_${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const { rows: _rows, ...summary } = history
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/history { days } — recalcula el histórico completo desde los pedidos (solo admin).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  let days = 90
  try {
    const body = await req.json() as { days?: unknown }
    if (body.days !== undefined) days = Number(body.days)
  } catch { /* cuerpo vacío: valores por defecto */ }
  if (!Number.isInteger(days) || days < 1 || days > MAX_HISTORY_DAYS) {
    return NextResponse.json({ error: `Indica entre 1 y ${MAX_HISTORY_DAYS} días.` }, { status: 400 })
  }

  const result = await syncDemandHistory({ days, force: true })
  return NextResponse.json(result)
}
