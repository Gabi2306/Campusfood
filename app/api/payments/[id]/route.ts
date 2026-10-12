import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fulfillPaymentAttempt, PAYMENT_METHODS, PAYMENT_WINDOW_MS } from '@/lib/payments'

// Pasarela de pagos SIMULADA (demostración): no procesa dinero real.
// Las tarjetas que terminan en 0002 se rechazan para poder probar el caso de error.

type StoredOrderItem = { menuItemId: number; quantity: number; unitPrice: number }

async function loadAttempt(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Inicia sesión para pagar.' }, { status: 401 }) }
  const attempt = await prisma.paymentAttempt.findUnique({ where: { id } })
  if (!attempt || attempt.userId !== Number(session.user.id) || !attempt.stripeSessionId?.startsWith('sim_')) {
    return { error: NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 }) }
  }
  return { attempt }
}

// GET /api/payments/:id — resumen del pago para la pasarela
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { attempt, error } = await loadAttempt(id)
  if (error) return error

  const items = JSON.parse(attempt.itemsJson) as StoredOrderItem[]
  const [menuItems, user] = await Promise.all([
    prisma.menuItem.findMany({ where: { id: { in: items.map((item) => item.menuItemId) } }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: attempt.userId }, select: { balance: true, name: true, email: true } }),
  ])
  const expiresAt = new Date(attempt.createdAt.getTime() + PAYMENT_WINDOW_MS)
  const expired = attempt.status === 'pending' && expiresAt.getTime() < Date.now()
  if (expired) await prisma.paymentAttempt.update({ where: { id }, data: { status: 'expired' } })

  return NextResponse.json({
    id: attempt.id,
    reference: attempt.stripeSessionId,
    status: expired ? 'expired' : attempt.status,
    total: attempt.total,
    paymentMethod: attempt.paymentMethod ?? 'card',
    paymentMethodLabel: PAYMENT_METHODS[(attempt.paymentMethod ?? 'card') as keyof typeof PAYMENT_METHODS],
    pickupAt: attempt.pickupAt,
    expiresAt,
    orderId: attempt.orderId,
    payer: { name: user?.name, email: user?.email },
    balance: user?.balance ?? 0,
    items: items.map((item) => ({
      name: menuItems.find(({ id: menuId }) => menuId === item.menuItemId)?.name ?? 'Producto',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/payments/:id — { action: 'confirm' | 'cancel', cardLast4?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { attempt, error } = await loadAttempt(id)
  if (error) return error

  let body: { action?: unknown; cardLast4?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  if (attempt.status === 'paid') {
    return NextResponse.json({ status: 'paid', orderId: attempt.orderId, reference: attempt.stripeSessionId })
  }
  if (attempt.status !== 'pending') {
    return NextResponse.json({ error: 'Este pago ya no está disponible. Vuelve al carrito para intentarlo de nuevo.' }, { status: 409 })
  }
  if (attempt.createdAt.getTime() + PAYMENT_WINDOW_MS < Date.now()) {
    await prisma.paymentAttempt.update({ where: { id }, data: { status: 'expired' } })
    return NextResponse.json({ error: 'El tiempo para pagar se agotó. Vuelve al carrito para intentarlo de nuevo.' }, { status: 410 })
  }

  if (body.action === 'cancel') {
    await prisma.paymentAttempt.update({ where: { id }, data: { status: 'cancelled' } })
    return NextResponse.json({ status: 'cancelled' })
  }
  if (body.action !== 'confirm') {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  }

  // Simulación de rechazo del banco
  if (attempt.paymentMethod === 'card' && body.cardLast4 === '0002') {
    return NextResponse.json({ error: 'El banco rechazó la tarjeta. Prueba con otra tarjeta u otro medio de pago.' }, { status: 402 })
  }

  const items = JSON.parse(attempt.itemsJson) as StoredOrderItem[]
  try {
    const order = await prisma.$transaction(async (tx) => {
      // El stock pudo agotarse mientras el estudiante pagaba.
      const menuItems = await tx.menuItem.findMany({ where: { id: { in: items.map((item) => item.menuItemId) } } })
      for (const item of items) {
        const menuItem = menuItems.find(({ id: menuId }) => menuId === item.menuItemId)
        if (!menuItem || !menuItem.available) throw new PaymentError(`Un producto de tu pedido ya no está disponible.`)
        if (menuItem.stock !== null && menuItem.stock < item.quantity) {
          throw new PaymentError(menuItem.stock === 0
            ? `${menuItem.name} se agotó mientras pagabas. No se hizo ningún cobro.`
            : `Solo quedan ${menuItem.stock} unidades de ${menuItem.name}. No se hizo ningún cobro.`)
        }
      }

      if (attempt.paymentMethod === 'balance') {
        const debit = await tx.user.updateMany({
          where: { id: attempt.userId, balance: { gte: attempt.total } },
          data: { balance: { decrement: attempt.total } },
        })
        if (debit.count === 0) throw new PaymentError('Tu saldo institucional no alcanza para este pedido.')
      }

      // Evita doble pago si se confirma dos veces al mismo tiempo.
      const claim = await tx.paymentAttempt.updateMany({ where: { id, status: 'pending' }, data: { status: 'processing' } })
      if (claim.count === 0) throw new PaymentError('Este pago ya fue procesado.')

      return fulfillPaymentAttempt(tx, attempt, attempt.stripeSessionId!)
    })
    return NextResponse.json({ status: 'paid', orderId: order.id, reference: attempt.stripeSessionId })
  } catch (paymentError) {
    if (paymentError instanceof PaymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 409 })
    }
    console.error(`Error confirmando el pago simulado ${id}:`, paymentError)
    return NextResponse.json({ error: 'No se pudo completar el pago. Inténtalo de nuevo.' }, { status: 500 })
  }
}

class PaymentError extends Error {}
