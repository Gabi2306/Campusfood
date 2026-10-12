import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/notifications — últimas notificaciones del usuario y conteo de no leídas.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const userId = Number(session.user.id)

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  return NextResponse.json({ notifications, unread }, { headers: { 'Cache-Control': 'no-store' } })
}

// PATCH /api/notifications — marca como leídas. Body: { ids: number[] } o { all: true }
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const userId = Number(session.user.id)

  let body: { ids?: unknown; all?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isSafeInteger(id)) as number[] : []
  if (body.all !== true && ids.length === 0) {
    return NextResponse.json({ error: 'Indica qué notificaciones marcar como leídas.' }, { status: 400 })
  }

  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(body.all === true ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  })
  return NextResponse.json({ updated: result.count })
}
