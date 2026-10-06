import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { reconcileStripeCheckout } from '@/lib/stripe-orders'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Sesión de pago inválida.' }, { status: 400 })
  }

  let attempt = await prisma.paymentAttempt.findFirst({
    where: { stripeSessionId: sessionId, userId: Number(session.user.id) },
    select: { status: true, orderId: true },
  })
  if (!attempt) return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 })

  if (attempt.status === 'pending') {
    try {
      await reconcileStripeCheckout(sessionId)
      attempt = await prisma.paymentAttempt.findFirst({
        where: { stripeSessionId: sessionId, userId: Number(session.user.id) },
        select: { status: true, orderId: true },
      })
      if (!attempt) return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 })
    } catch (error) {
      console.error(`Unable to reconcile Stripe checkout session ${sessionId}:`, error)
      return NextResponse.json({ error: 'No se pudo verificar el pago con Stripe.' }, { status: 502 })
    }
  }

  return NextResponse.json(
    { status: attempt.status, orderId: attempt.orderId },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
