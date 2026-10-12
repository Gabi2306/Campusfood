// Pagos (HU-03): medios de pago y creación del pedido cuando el pago se aprueba.
//
// Proveedor configurable con PAYMENT_PROVIDER:
//  - "simulated" (por defecto): pasarela de demostración propia en /pago/[id], sin cobros reales.
//  - "stripe": Stripe Checkout en modo de pruebas (requiere STRIPE_SECRET_KEY y webhook).
import type { Prisma } from '@prisma/client'

export const PAYMENT_METHODS = {
  card: 'Tarjeta débito o crédito',
  wallet: 'Billetera digital',
  balance: 'Saldo institucional',
} as const

export type PaymentMethod = keyof typeof PAYMENT_METHODS

export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === 'string' && value in PAYMENT_METHODS

export const PAYMENT_WINDOW_MS = 15 * 60 * 1000

export function getPaymentProvider(): 'simulated' | 'stripe' {
  return process.env.PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'simulated'
}

type StoredOrderItem = { menuItemId: number; quantity: number; unitPrice: number }

/**
 * Crea el pedido a partir de un intento de pago aprobado, marca el intento como pagado
 * y descuenta el stock del día. Debe ejecutarse dentro de una transacción.
 */
export async function fulfillPaymentAttempt(
  tx: Prisma.TransactionClient,
  attempt: { id: string; userId: number; itemsJson: string; total: number; pickupAt: Date | null; paymentMethod: string | null },
  reference: string,
) {
  const orderItems = JSON.parse(attempt.itemsJson) as StoredOrderItem[]
  const order = await tx.order.create({
    data: {
      userId: attempt.userId,
      total: attempt.total,
      pickupAt: attempt.pickupAt,
      stripeSessionId: reference,
      paymentMethod: attempt.paymentMethod ?? 'card',
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

  // Descuenta el stock del día (solo productos con stock controlado), nunca por debajo de 0.
  for (const item of orderItems) {
    await tx.menuItem.updateMany({
      where: { id: item.menuItemId, stock: { not: null } },
      data: { stock: { decrement: item.quantity } },
    })
    await tx.menuItem.updateMany({
      where: { id: item.menuItemId, stock: { lt: 0 } },
      data: { stock: 0 },
    })
  }
  return order
}
