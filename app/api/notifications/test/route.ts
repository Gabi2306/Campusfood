import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendPushToUser } from '@/lib/notifications'

// POST — envía una notificación push de prueba al usuario actual.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const result = await sendPushToUser(Number(session.user.id), {
    title: 'Notificaciones activadas',
    body: 'Te avisaremos aquí cuando tu pedido esté listo.',
    url: '/?section=orders',
    tag: 'test',
  })
  if (result.sent === 0) {
    return NextResponse.json({ error: 'No se pudo entregar la notificación de prueba a este dispositivo.' }, { status: 502 })
  }
  return NextResponse.json(result)
}
