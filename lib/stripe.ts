import Stripe from 'stripe'

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey?.startsWith('sk_test_')) {
    throw new Error('STRIPE_SECRET_KEY must contain a Stripe test-mode secret key.')
  }

  return new Stripe(secretKey)
}
