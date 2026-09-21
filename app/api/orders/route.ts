import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/orders — pedidos del usuario actual (o todos si es admin)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const where = session.user.role === 'admin' ? {} : { userId: Number(session.user.id) }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { menuItem: true } },
      user:  { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(orders)
}

// POST /api/orders — crea un pedido nuevo
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // body: { items: [{ menuItemId: number, quantity: number }] }
  const body = await req.json()
  const { items } = body as { items: { menuItemId: number; quantity: number }[] }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'El pedido no tiene items' }, { status: 400 })
  }

  // Verificar que todos los items existen y están disponibles
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, available: true },
  })

  if (menuItems.length !== items.length) {
    return NextResponse.json({ error: 'Uno o más items no están disponibles' }, { status: 400 })
  }

  // Calcular total
  const total = items.reduce((sum, item) => {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId)!
    return sum + menuItem.price * item.quantity
  }, 0)

  const order = await prisma.order.create({
    data: {
      userId: Number(session.user.id),
      total,
      status: 'pending',
      items: {
        create: items.map((item) => {
          const menuItem = menuItems.find((m) => m.id === item.menuItemId)!
          return {
            menuItemId: item.menuItemId,
            quantity:   item.quantity,
            unitPrice:  menuItem.price,
          }
        }),
      },
    },
    include: { items: { include: { menuItem: true } } },
  })

  return NextResponse.json(order, { status: 201 })
}
