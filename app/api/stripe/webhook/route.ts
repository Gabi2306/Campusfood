import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'
import { recordPaidOrder } from '@/lib/stripe-orders'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret)
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid Stripe webhook signature.' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await recordPaidOrder(event.data.object as Stripe.Checkout.Session)
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const checkout = event.data.object as Stripe.Checkout.Session
      await prisma.paymentAttempt.updateMany({
        where: { stripeSessionId: checkout.id, status: 'pending' },
        data: { status: event.type === 'checkout.session.expired' ? 'expired' : 'failed' },
      })
    }
  } catch (error) {
    console.error(`Stripe webhook processing failed for ${event.id}:`, error)
    return NextResponse.json({ error: 'Unable to process Stripe webhook.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
