// HU-03 · Medios de pago y configuración de Stripe
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getPaymentProvider, isPaymentMethod, PAYMENT_METHODS } from '@/lib/payments'
import { getStripeClient, StripeConfigError } from '@/lib/stripe'

// Claves ficticias armadas en tiempo de ejecución para no guardar nada con forma de secreto en el repositorio
const fakeKey = (prefix: string) => prefix + 'x'.repeat(26)

const originalEnv = { ...process.env }
afterEach(() => { process.env = { ...originalEnv } })

describe('Pagos: medios de pago y proveedor', () => {
  it('reconoce solo los medios de pago soportados', () => {
    assert.equal(isPaymentMethod('card'), true)
    assert.equal(isPaymentMethod('balance'), true)
    assert.equal(isPaymentMethod('efectivo'), false)
    assert.equal(Object.keys(PAYMENT_METHODS).length, 3)
  })

  it('usa Stripe por defecto y la pasarela simulada solo si se configura', () => {
    delete process.env.PAYMENT_PROVIDER
    assert.equal(getPaymentProvider(), 'stripe')
    process.env.PAYMENT_PROVIDER = 'simulated'
    assert.equal(getPaymentProvider(), 'simulated')
  })

  it('exige una clave secreta de pruebas completa', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_'
    assert.throws(() => getStripeClient(), StripeConfigError)
  })

  it('nunca acepta una clave de producción (sk_live_)', () => {
    process.env.STRIPE_SECRET_KEY = fakeKey('sk_live_')
    assert.throws(() => getStripeClient(), /clave de pruebas/)
  })

  it('crea el cliente de Stripe con una clave de pruebas válida', () => {
    process.env.STRIPE_SECRET_KEY = fakeKey('sk_test_')
    assert.ok(getStripeClient())
  })
})
