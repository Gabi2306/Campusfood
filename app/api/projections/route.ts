import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { addDays, getBogotaDateString, isDateString } from '@/lib/business-date'
import { getDailyProjection } from '@/lib/projections'
import { isStaff } from '@/lib/roles'

// GET /api/projections?date=YYYY-MM-DD — proyección diaria por tipo de menú (HU-06).
// Disponible para hoy y mañana. Solo personal (admin / cocina).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const today = getBogotaDateString(new Date())
  const date = req.nextUrl.searchParams.get('date') ?? today
  if (!isDateString(date) || (date !== today && date !== addDays(today, 1))) {
    return NextResponse.json({ error: 'Solo se puede proyectar el día de hoy o el de mañana.' }, { status: 400 })
  }

  try {
    const projection = await getDailyProjection(date)
    return NextResponse.json(projection, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error generando la proyección diaria:', error)
    return NextResponse.json({ error: 'No se pudo generar la proyección.' }, { status: 500 })
  }
}
