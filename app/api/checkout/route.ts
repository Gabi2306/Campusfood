import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createPickupDateTime, isValidPickupTime } from '@/lib/pickup-time'
import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'

type CheckoutItemInput = { menuItemId: number; quantity: number }
type CheckoutBody = {
  items?: CheckoutItemInput[]
  isAdvanceOrder?: boolean
  pickupDate?: string | null
  pickupTime?: number | null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Inicia sesión para pagar.' }, { status: 401 })

  let body: CheckoutBody
  try {
    body = await req.json() as CheckoutBody
  } catch {
    return NextResponse.json({ error: 'La solicitud de pago no es válida.' }, { status: 400 })
  }

  const items = body.items
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 50 ||
    items.some((item) =>
      !item ||
      !Number.isSafeInteger(item.menuItemId) ||
      item.menuItemId <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 50
    ) ||
    new Set(items.map((item) => item.menuItemId)).size !== items.length
  ) {
    return NextResponse.json({ error: 'El carrito contiene productos o cantidades inválidas.' }, { status: 400 })
  }

  if (typeof body.isAdvanceOrder !== 'boolean') {
    return NextResponse.json({ error: 'Indica si el pedido es anticipado.' }, { status: 400 })
  }

  let pickupAt: Date | null = null
  if (body.isAdvanceOrder) {
    if (
      typeof body.pickupDate !== 'string' ||
      typeof body.pickupTime !== 'number' ||
      !isValidPickupTime(body.pickupDate, body.pickupTime, new Date())
    ) {
      return NextResponse.json({ error: 'La hora de recogida debe ser hoy, estar dentro del horario laboral y ser al menos 30 minutos después de ahora.' }, { status: 400 })
    }
    pickupAt = createPickupDateTime(body.pickupDate, body.pickupTime)
  } else if (body.pickupDate != null || body.pickupTime != null) {
    return NextResponse.json({ error: 'No se puede enviar una hora de recogida si el pedido no es anticipado.' }, { status: 400 })
  }

  const userId = Number(session.user.id)
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'La sesión de usuario no es válida.' }, { status: 401 })
  }

  let stripe: ReturnType<typeof getStripeClient>
  try {
    stripe = getStripeClient()
  } catch (error) {
    console.error('Stripe test configuration error:', error)
    return NextResponse.json({ error: 'Stripe no está configurado con una clave de pruebas.' }, { status: 503 })
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((item) => item.menuItemId) }, available: true },
  })
  if (menuItems.length !== items.length) {
    return NextResponse.json({ error: 'Uno o más productos ya no están disponibles.' }, { status: 400 })
  }

  const orderItems = items.map((item) => {
    const menuItem = menuItems.find(({ id }) => id === item.menuItemId)!
    return { menuItemId: item.menuItemId, quantity: item.quantity, unitPrice: menuItem.price }
  })
  const total = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  if (!Number.isSafeInteger(total) || total <= 0) {
    return NextResponse.json({ error: 'El total del pedido no es válido.' }, { status: 400 })
  }

  const attempt = await prisma.paymentAttempt.create({
    data: {
      userId,
      itemsJson: JSON.stringify(orderItems),
      total,
      pickupAt,
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl) {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'failed' } })
    return NextResponse.json({ error: 'Falta configurar NEXTAUTH_URL para iniciar el pago.' }, { status: 503 })
  }

  try {
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        locale: 'es-419',
        customer_email: session.user.email ?? undefined,
        client_reference_id: attempt.id,
        metadata: { paymentAttemptId: attempt.id, userId: String(userId) },
        line_items: orderItems.map((item) => {
          const menuItem = menuItems.find(({ id }) => id === item.menuItemId)!
          return {
            quantity: item.quantity,
            price_data: {
              currency: 'cop',
                unit_amount: item.unitPrice * 100,
              product_data: { name: menuItem.name },
            },
          }
        }),
        success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
      },
      { idempotencyKey: attempt.id }
    )

    if (!checkout.url) throw new Error('Stripe did not return a Checkout URL.')
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { stripeSessionId: checkout.id, status: 'pending' },
    })

    return NextResponse.json({ url: checkout.url, sessionId: checkout.id })
  } catch (error) {
    console.error('Unable to create Stripe Checkout session:', error)
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'failed' } })
    return NextResponse.json({ error: 'No se pudo iniciar el pago con Stripe. Inténtalo de nuevo.' }, { status: 502 })
  }
}
