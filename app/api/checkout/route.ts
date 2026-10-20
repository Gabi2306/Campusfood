import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createPickupDateTime, isValidPickupTime } from '@/lib/pickup-time'
import { prisma } from '@/lib/prisma'
import { getStripeClient, StripeConfigError } from '@/lib/stripe'
import { getPaymentProvider, isPaymentMethod } from '@/lib/payments'

type CheckoutItemInput = { menuItemId: number; quantity: number }
type CheckoutBody = {
  items?: CheckoutItemInput[]
  isAdvanceOrder?: boolean
  pickupDate?: string | null
  pickupTime?: number | null
  paymentMethod?: string
}

// GET /api/checkout — medios de pago disponibles según el proveedor configurado
export async function GET() {
  const provider = getPaymentProvider()
  return NextResponse.json({
    provider,
    methods: provider === 'stripe' ? ['card', 'balance'] : ['card', 'wallet', 'balance'],
  })
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

  const paymentMethod = body.paymentMethod ?? 'card'
  if (!isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: 'Elige un medio de pago válido.' }, { status: 400 })
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

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((item) => item.menuItemId) }, available: true },
  })
  if (menuItems.length !== items.length) {
    return NextResponse.json({ error: 'Uno o más productos ya no están disponibles.' }, { status: 400 })
  }

  // Stock del día: no se puede pagar más de lo que cocina tiene disponible.
  for (const item of items) {
    const menuItem = menuItems.find(({ id }) => id === item.menuItemId)!
    if (menuItem.stock !== null && item.quantity > menuItem.stock) {
      return NextResponse.json({
        error: menuItem.stock === 0
          ? `${menuItem.name} está agotado por hoy.`
          : `Solo quedan ${menuItem.stock} unidades de ${menuItem.name}.`,
      }, { status: 409 })
    }
  }

  const orderItems = items.map((item) => {
    const menuItem = menuItems.find(({ id }) => id === item.menuItemId)!
    return { menuItemId: item.menuItemId, quantity: item.quantity, unitPrice: menuItem.price }
  })
  const total = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  if (!Number.isSafeInteger(total) || total <= 0) {
    return NextResponse.json({ error: 'El total del pedido no es válido.' }, { status: 400 })
  }

  if (paymentMethod === 'balance') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
    if (!user || user.balance < total) {
      return NextResponse.json({ error: 'Tu saldo institucional no alcanza para este pedido. Elige otro medio de pago.' }, { status: 409 })
    }
  }

  const provider = getPaymentProvider()
  if (provider === 'stripe' && paymentMethod === 'wallet') {
    return NextResponse.json({ error: 'Elige tarjeta o saldo institucional.' }, { status: 400 })
  }

  const attempt = await prisma.paymentAttempt.create({
    data: {
      userId,
      itemsJson: JSON.stringify(orderItems),
      total,
      pickupAt,
      paymentMethod,
    },
  })

  // ── Saldo institucional o pasarela simulada: confirmación dentro de la app ──
  if (provider === 'simulated' || paymentMethod === 'balance') {
    const reference = `sim_${attempt.id}`
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { stripeSessionId: reference, status: 'pending' },
    })
    return NextResponse.json({ url: `/pago/${attempt.id}`, sessionId: reference })
  }

  // ── Tarjeta: Stripe Checkout ────────────────────────────────────
  let stripe: ReturnType<typeof getStripeClient>
  try {
    stripe = getStripeClient()
  } catch (error) {
    console.error('Configuración de Stripe:', error instanceof Error ? error.message : error)
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'failed' } })
    return NextResponse.json({
      error: error instanceof StripeConfigError ? error.message : 'El pago con tarjeta no está disponible en este momento.',
    }, { status: 503 })
  }

  // Stripe devuelve al estudiante a la MISMA dirección desde la que abrió la app
  // (localhost, la IP de la red o el dominio publicado), para que conserve su sesión.
  const requestOrigin = req.headers.get('origin')
  const baseUrl = (requestOrigin && /^https?:\/\/[^/\s]+$/.test(requestOrigin) ? requestOrigin : null)
    || process.env.NEXTAUTH_URL
    || req.nextUrl.origin

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
    const stripeType = (error as { type?: string }).type
    return NextResponse.json({
      error: stripeType === 'StripeAuthenticationError'
        ? 'Stripe rechazó la clave STRIPE_SECRET_KEY. Revisa que sea tu clave secreta de pruebas completa (sk_test_...).'
        : 'No se pudo conectar con Stripe. Inténtalo de nuevo.',
    }, { status: 502 })
  }
}
