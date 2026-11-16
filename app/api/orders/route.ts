import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isStaff } from '@/lib/roles'
import { reconcileStripeCheckout } from '@/lib/stripe-orders'
import { buildHistoryWhere, HISTORY_LIMIT, parseHistoryFilters } from '@/lib/order-history-filters'

// GET /api/orders — pedidos del usuario actual (o todos si es personal: admin / cocina)
// GET /api/orders?history=1&status=&from=&to= — historial filtrado del estudiante (HU-11)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const isAdmin = isStaff(session.user.role)

  if (!isAdmin && req.nextUrl.searchParams.has('history')) {
    const parsed = parseHistoryFilters(req.nextUrl.searchParams)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const history = await prisma.order.findMany({
      where: buildHistoryWhere(Number(session.user.id), parsed.filters),
      include: {
        items: { include: { menuItem: true } },
        user:  { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    })
    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } })
  }
  let reconciliationFailures = 0
  if (isAdmin) {
    const reconciliationStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const pendingAttempts = await prisma.paymentAttempt.findMany({
      where: {
        status: 'pending',
        stripeSessionId: { not: null },
        createdAt: { gte: reconciliationStart },
      },
      select: { stripeSessionId: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    await Promise.all(pendingAttempts.map(async ({ stripeSessionId }) => {
      if (!stripeSessionId) return
      try {
        await reconcileStripeCheckout(stripeSessionId)
      } catch (error) {
        reconciliationFailures += 1
        console.error(`Unable to reconcile pending checkout ${stripeSessionId} for admin order list:`, error)
      }
    }))
  }

  const orders = await prisma.order.findMany({
    where: isAdmin ? {} : { userId: Number(session.user.id) },
    include: {
      items: { include: { menuItem: true } },
      user:  { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    ...(!isAdmin ? { take: 50 } : {}),
  })

  return NextResponse.json(orders, {
    headers: {
      'Cache-Control': 'no-store',
      ...(reconciliationFailures > 0
        ? { 'X-Order-Reconciliation-Failures': String(reconciliationFailures) }
        : {}),
    },
  })
}
