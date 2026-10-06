import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { reconcileStripeCheckout } from '@/lib/stripe-orders'

// GET /api/orders — pedidos del usuario actual (o todos si es admin)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const isAdmin = session.user.role === 'admin'
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
