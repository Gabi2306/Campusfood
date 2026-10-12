import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'

// GET /api/profile — datos de contacto para notificaciones.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: { name: true, email: true, phone: true, smsOptIn: true, balance: true },
  })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  return NextResponse.json(user, { headers: { 'Cache-Control': 'no-store' } })
}

// PATCH /api/profile — { phone?: string | null, smsOptIn?: boolean }
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { phone?: unknown; smsOptIn?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  const data: { phone?: string | null; smsOptIn?: boolean } = {}
  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === '') {
      data.phone = null
      data.smsOptIn = false
    } else {
      const phone = normalizePhone(body.phone)
      if (!phone) {
        return NextResponse.json({ error: 'Escribe un celular válido, por ejemplo 300 123 4567.' }, { status: 400 })
      }
      data.phone = phone
    }
  }
  if (body.smsOptIn !== undefined) {
    if (typeof body.smsOptIn !== 'boolean') return NextResponse.json({ error: 'Valor inválido para SMS.' }, { status: 400 })
    if (data.smsOptIn === undefined) data.smsOptIn = body.smsOptIn
  }

  const userId = Number(session.user.id)
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
  const finalPhone = data.phone !== undefined ? data.phone : current?.phone
  if (data.smsOptIn && !finalPhone) {
    return NextResponse.json({ error: 'Registra un celular para recibir SMS.' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { name: true, email: true, phone: true, smsOptIn: true },
  })
  return NextResponse.json(user)
}
