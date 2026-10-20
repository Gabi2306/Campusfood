import Stripe from 'stripe'

export class StripeConfigError extends Error {}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey || secretKey === 'sk_test_' || secretKey.length < 20) {
    throw new StripeConfigError('Falta la clave de Stripe: copia tu clave secreta de pruebas (sk_test_...) en STRIPE_SECRET_KEY del archivo .env y reinicia la app.')
  }
  if (!secretKey.startsWith('sk_test_')) {
    throw new StripeConfigError('STRIPE_SECRET_KEY debe ser una clave de pruebas (sk_test_...). Nunca uses una clave sk_live_.')
  }

  return new Stripe(secretKey)
}
