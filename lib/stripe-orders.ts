import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'

type StoredOrderItem = { menuItemId: number; quantity: number; unitPrice: number }

export async function recordPaidOrder(checkout: Stripe.Checkout.Session) {
  if (checkout.livemode) throw new Error('Live Stripe payments are not accepted by this test-only integration.')
  if (checkout.payment_status !== 'paid' || checkout.currency !== 'cop' || !checkout.amount_total) return
  const attemptId = checkout.metadata?.paymentAttemptId
  if (!attemptId) throw new Error('Stripe Checkout session is missing its payment attempt reference.')

  await prisma.$transaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findUnique({ where: { id: attemptId } })
    if (!attempt || attempt.stripeSessionId !== checkout.id) {
      throw new Error('Stripe Checkout session does not match a payment attempt.')
    }
    if (checkout.metadata?.userId !== String(attempt.userId) || checkout.client_reference_id !== attempt.id) {
      throw new Error('Stripe Checkout session user reference does not match the payment attempt.')
    }
    if (attempt.status === 'paid') return
    if (attempt.status !== 'pending' || attempt.total * 100 !== checkout.amount_total) {
      throw new Error('Stripe payment does not match the pending checkout.')
    }

    const orderItems = JSON.parse(attempt.itemsJson) as StoredOrderItem[]
    const order = await tx.order.create({
      data: {
        userId: attempt.userId,
        total: attempt.total,
        pickupAt: attempt.pickupAt,
        stripeSessionId: checkout.id,
        status: 'pending',
        items: {
          create: orderItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    })
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: 'paid', orderId: order.id },
    })
  })
}

export async function reconcileStripeCheckout(sessionId: string) {
  const checkout = await getStripeClient().checkout.sessions.retrieve(sessionId)
  await recordPaidOrder(checkout)
}
