import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['pending', 'preparing', 'ready', 'delivered', 'cancelled']
const CANCELLATION_CUTOFF_MS = 30 * 60 * 1000

// PATCH /api/orders/:id — actualiza el estado de un pedido
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const orderId = Number(id)
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  let status: unknown
  try {
    ({ status } = await req.json())
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida' }, { status: 400 })
  }

  if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  // Solo admin puede cambiar a estados distintos de "cancelled"
  // Un estudiante solo puede cancelar su propio pedido
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const isAdmin   = session.user.role === 'admin'
  const isOwner   = order.userId === Number(session.user.id)
  const isFinal = ['delivered', 'cancelled'].includes(order.status)

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (isFinal) {
    return NextResponse.json({ error: 'Este pedido ya finalizó y no admite más cambios.' }, { status: 409 })
  }

  if (!isAdmin && status !== 'cancelled') {
    return NextResponse.json({ error: 'Solo puedes cancelar tu pedido' }, { status: 403 })
  }

  if (status === 'cancelled') {
    if (!isAdmin) {
      if (!order.pickupAt) {
        return NextResponse.json({ error: 'Solo se pueden cancelar pedidos programados para una hora de entrega.' }, { status: 400 })
      }
      if (['delivered', 'cancelled'].includes(order.status)) {
        return NextResponse.json({ error: 'Este pedido ya no se puede cancelar.' }, { status: 409 })
      }
      const cutoff = new Date(Date.now() + CANCELLATION_CUTOFF_MS)
      if (order.pickupAt.getTime() < cutoff.getTime()) {
        return NextResponse.json({ error: 'El pedido solo se puede cancelar con al menos 30 minutos de anticipación.' }, { status: 400 })
      }
    }

    const cancellation = await prisma.order.updateMany({
      where: {
        id: orderId,
        ...(isAdmin
          ? { status: { not: 'cancelled' } }
          : {
              status: { in: ['pending', 'preparing', 'ready'] },
              pickupAt: { gte: new Date(Date.now() + CANCELLATION_CUTOFF_MS) },
              userId: Number(session.user.id),
            }),
      },
      data: { status: 'cancelled' },
    })
    if (cancellation.count === 0) {
      return NextResponse.json({ error: 'El pedido ya cambió o ya no se puede cancelar.' }, { status: 409 })
    }
  } else {
    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo un administrador puede cambiar el estado del pedido.' }, { status: 403 })
    }
    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    })
  }

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { menuItem: true } } },
  })
  return NextResponse.json(updated)
}
