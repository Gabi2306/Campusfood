import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPushPublicKey, getSmsMode } from '@/lib/notifications'

// GET — configuración pública de notificaciones (clave VAPID y si hay SMS).
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const subscriptions = await prisma.pushSubscription.count({ where: { userId: Number(session.user.id) } })
  return NextResponse.json({
    publicKey: getPushPublicKey(),
    smsAvailable: getSmsMode() !== null,
    subscriptions,
  })
}

type SubscriptionBody = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

// POST — registra (o reasigna) la suscripción push de este dispositivo.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: SubscriptionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  const { endpoint, keys } = body
  if (
    typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000 ||
    typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string' ||
    keys.p256dh.length > 200 || keys.auth.length > 100
  ) {
    return NextResponse.json({ error: 'Suscripción push inválida.' }, { status: 400 })
  }

  const userId = Number(session.user.id)
  const userAgent = req.headers.get('user-agent')?.slice(0, 250) ?? null
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE — elimina la suscripción de este dispositivo.
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  let endpoint: unknown
  try {
    ({ endpoint } = await req.json())
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }
  if (typeof endpoint !== 'string') return NextResponse.json({ error: 'Falta el endpoint.' }, { status: 400 })
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: Number(session.user.id) } })
  return NextResponse.json({ ok: true })
}
