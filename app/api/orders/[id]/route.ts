import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['pending', 'preparing', 'ready', 'delivered', 'cancelled']

// PATCH /api/orders/:id — actualiza el estado de un pedido
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { status } = await req.json()

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  // Solo admin puede cambiar a estados distintos de "cancelled"
  // Un estudiante solo puede cancelar su propio pedido
  const order = await prisma.order.findUnique({ where: { id: Number(id) } })
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const isAdmin   = session.user.role === 'admin'
  const isOwner   = order.userId === Number(session.user.id)

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!isAdmin && status !== 'cancelled') {
    return NextResponse.json({ error: 'Solo puedes cancelar tu pedido' }, { status: 403 })
  }

  const updated = await prisma.order.update({
    where: { id: Number(id) },
    data:  { status },
    include: { items: { include: { menuItem: true } } },
  })

  return NextResponse.json(updated)
}
