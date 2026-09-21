import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  // ── Pedidos de hoy ────────────────────────────────────────────
  const todayOrders = await prisma.order.findMany({
    where: { createdAt: { gte: todayStart } },
    include: {
      items:    { include: { menuItem: true } },
      user:     { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalOrders   = todayOrders.length
  const uniqueStudents = new Set(todayOrders.map((o) => o.userId)).size
  const revenueToday  = todayOrders.reduce((sum, o) => sum + o.total, 0)

  // ── Ayer (para % de crecimiento) ─────────────────────────────
  const yesterdayCount = await prisma.order.count({
    where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
  })

  const ordersGrowth =
    yesterdayCount > 0
      ? (((totalOrders - yesterdayCount) / yesterdayCount) * 100).toFixed(1)
      : null

  // ── Demanda por item (todos los pedidos, no solo hoy) ─────────
  const allOrderItems = await prisma.orderItem.groupBy({
    by:       ['menuItemId'],
    _sum:     { quantity: true },
    orderBy:  { _sum: { quantity: 'desc' } },
    take:     6,
  })

  const menuIds = allOrderItems.map((i) => i.menuItemId)
  const menuMap = await prisma.menuItem.findMany({ where: { id: { in: menuIds } } })

  const demand = allOrderItems.map((item) => ({
    name: menuMap.find((m) => m.id === item.menuItemId)?.name ?? 'Desconocido',
    qty:  item._sum.quantity ?? 0,
  }))

  // ── Pedidos recientes (últimos 10) ────────────────────────────
  const recentOrders = todayOrders.slice(0, 10).map((o) => ({
    id:        o.id,
    userName:  o.user.name,
    total:     o.total,
    status:    o.status,
    createdAt: o.createdAt,
    items:     o.items.map((i) => ({
      name:     i.menuItem.name,
      quantity: i.quantity,
    })),
  }))

  // ── Total de usuarios registrados ─────────────────────────────
  const totalUsers = await prisma.user.count({ where: { role: 'student' } })

  // ── Items en el menú ──────────────────────────────────────────
  const totalMenuItems = await prisma.menuItem.count()
  const availableItems = await prisma.menuItem.count({ where: { available: true } })

  return NextResponse.json({
    totalOrders,
    uniqueStudents,
    revenueToday,
    ordersGrowth,
    demand,
    recentOrders,
    totalUsers,
    totalMenuItems,
    availableItems,
  })
}
