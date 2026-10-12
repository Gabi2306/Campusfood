'use client'

// Pasarela de pagos SIMULADA de Café Campus (HU-03). No procesa dinero real.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Check, ChevronRight, Clock3, CreditCard, Lock, RefreshCw, Smartphone, Wallet, X } from 'lucide-react'
import { Brand, money } from '@/components/shared'

type Payment = {
  id: string
  reference: string
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'processing'
  total: number
  paymentMethod: 'card' | 'wallet' | 'balance'
  paymentMethodLabel: string
  expiresAt: string
  orderId: number | null
  payer: { name?: string; email?: string }
  balance: number
  items: { name: string; quantity: number; unitPrice: number }[]
}

const onlyDigits = (value: string) => value.replace(/\D/g, '')

function luhnValid(number: string) {
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i])
    if (double) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

function expiryValid(value: string) {
  const match = /^(\d{2})\/(\d{2})$/.exec(value)
  if (!match) return false
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12) return false
  const now = new Date()
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)
}

const METHOD_ICON = {
  card: <CreditCard size={20} />,
  wallet: <Smartphone size={20} />,
  balance: <Wallet size={20} />,
}

export default function PaymentGatewayPage() {
  const { id } = useParams<{ id: string }>()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [approved, setApproved] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Tarjeta
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  // Billetera
  const [walletPhone, setWalletPhone] = useState('')
  const [walletPin, setWalletPin] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/${id}`, { cache: 'no-store' })
      if (response.status === 401) { window.location.assign('/'); return }
      const result = await response.json() as Payment & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se encontró el pago.')
      setPayment(result)
      if (result.status === 'paid') setApproved(true)
    } catch (loadFailure) {
      setLoadError(loadFailure instanceof Error ? loadFailure.message : 'No se encontró el pago.')
    }
  }, [id])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const secondsLeft = payment ? Math.max(0, Math.floor((new Date(payment.expiresAt).getTime() - now) / 1000)) : 0
  const expired = payment?.status === 'expired' || (payment?.status === 'pending' && secondsLeft === 0)

  const formValid = useMemo(() => {
    if (!payment) return false
    if (payment.paymentMethod === 'card') {
      const digits = onlyDigits(cardNumber)
      return digits.length === 16 && luhnValid(digits) && cardName.trim().length >= 3 && expiryValid(expiry) && /^\d{3,4}$/.test(cvc)
    }
    if (payment.paymentMethod === 'wallet') return /^3\d{9}$/.test(onlyDigits(walletPhone)) && /^\d{4}$/.test(walletPin)
    return payment.balance >= payment.total
  }, [payment, cardNumber, cardName, expiry, cvc, walletPhone, walletPin])

  const goHome = (query: string) => window.location.assign(`/?${query}`)

  const confirm = async () => {
    if (!payment || !formValid || processing) return
    setProcessing(true)
    setError('')
    // Pequeña espera para simular la respuesta del banco
    await new Promise((resolve) => window.setTimeout(resolve, 1400))
    try {
      const response = await fetch(`/api/payments/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', cardLast4: onlyDigits(cardNumber).slice(-4) || undefined }),
      })
      const result = await response.json() as { status?: string; error?: string; reference?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo completar el pago.')
      setApproved(true)
      window.setTimeout(() => goHome(`payment=success&session_id=${encodeURIComponent(payment.reference)}`), 1600)
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'No se pudo completar el pago.')
      setProcessing(false)
    }
  }

  const cancel = async () => {
    setProcessing(true)
    await fetch(`/api/payments/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    }).catch(() => undefined)
    goHome('payment=cancelled')
  }

  if (loadError) {
    return (
      <div className="gateway-shell">
        <div className="gateway-card gateway-center">
          <span className="gateway-status-icon gateway-status-error"><AlertCircle size={26} /></span>
          <h1>No encontramos este pago</h1>
          <p>{loadError}</p>
          <button className="primary-button block-button" onClick={() => goHome('')}>Volver a Café Campus</button>
        </div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="gateway-shell">
        <div className="gateway-card gateway-center"><RefreshCw className="spin" size={22} /><p>Cargando pago…</p></div>
      </div>
    )
  }

  if (approved) {
    return (
      <div className="gateway-shell">
        <div className="gateway-card gateway-center">
          <span className="gateway-status-icon"><Check size={28} /></span>
          <h1>Pago aprobado</h1>
          <p>{money(payment.total)} · {payment.paymentMethodLabel}</p>
          <small className="gateway-ref">Referencia {payment.reference}</small>
          <p className="gateway-muted">Te llevamos de vuelta a tu pedido…</p>
        </div>
      </div>
    )
  }

  if (expired || payment.status !== 'pending') {
    return (
      <div className="gateway-shell">
        <div className="gateway-card gateway-center">
          <span className="gateway-status-icon gateway-status-error"><Clock3 size={26} /></span>
          <h1>{expired ? 'El tiempo para pagar terminó' : 'Este pago ya no está disponible'}</h1>
          <p>Tu carrito sigue guardado. Vuelve e inténtalo de nuevo.</p>
          <button className="primary-button block-button" onClick={() => goHome('payment=cancelled')}>Volver al carrito</button>
        </div>
      </div>
    )
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="gateway-shell">
      <header className="gateway-header">
        <Brand />
        <span className="gateway-secure"><Lock size={13} /> Pago seguro</span>
      </header>

      <main className="gateway-main">
        <section className="gateway-card gateway-summary">
          <p className="eyebrow">TOTAL A PAGAR</p>
          <strong className="gateway-amount">{money(payment.total)}</strong>
          <ul className="gateway-items">
            {payment.items.map((item) => (
              <li key={item.name}><span>{item.quantity}× {item.name}</span><span>{money(item.quantity * item.unitPrice)}</span></li>
            ))}
          </ul>
          <div className="gateway-timer"><Clock3 size={13} /> Tienes {minutes}:{seconds} para completar el pago</div>
        </section>

        <section className="gateway-card">
          <div className="gateway-method">
            <span className="method-icon">{METHOD_ICON[payment.paymentMethod]}</span>
            <div><strong>{payment.paymentMethodLabel}</strong><small>{payment.payer.email}</small></div>
          </div>

          {payment.paymentMethod === 'card' && (
            <div className="gateway-form">
              <label>
                Número de tarjeta
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(event) => setCardNumber(onlyDigits(event.target.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '))}
                />
              </label>
              <label>
                Nombre en la tarjeta
                <input autoComplete="off" placeholder="Como aparece en la tarjeta" value={cardName} onChange={(event) => setCardName(event.target.value.toUpperCase())} />
              </label>
              <div className="gateway-row">
                <label>
                  Vence
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="MM/AA"
                    value={expiry}
                    onChange={(event) => {
                      const digits = onlyDigits(event.target.value).slice(0, 4)
                      setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits)
                    }}
                  />
                </label>
                <label>
                  CVC
                  <input inputMode="numeric" autoComplete="off" placeholder="123" value={cvc} onChange={(event) => setCvc(onlyDigits(event.target.value).slice(0, 4))} />
                </label>
              </div>
              <p className="gateway-hint">
                Pasarela de demostración, sin cobros reales. Usa <b>4242 4242 4242 4242</b> para aprobar o <b>4000 0000 0000 0002</b> para simular un rechazo.
              </p>
            </div>
          )}

          {payment.paymentMethod === 'wallet' && (
            <div className="gateway-form">
              <label>
                Celular asociado a la billetera
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="300 123 4567"
                  value={walletPhone}
                  onChange={(event) => setWalletPhone(onlyDigits(event.target.value).slice(0, 10))}
                />
              </label>
              <label>
                Clave de la billetera (4 dígitos)
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="••••"
                  value={walletPin}
                  onChange={(event) => setWalletPin(onlyDigits(event.target.value).slice(0, 4))}
                />
              </label>
              <p className="gateway-hint">Pasarela de demostración, sin cobros reales. Cualquier celular que empiece por 3 y cualquier clave de 4 dígitos funcionan.</p>
            </div>
          )}

          {payment.paymentMethod === 'balance' && (
            <dl className="gateway-balance">
              <div><dt>Saldo actual</dt><dd>{money(payment.balance)}</dd></div>
              <div><dt>Este pedido</dt><dd>− {money(payment.total)}</dd></div>
              <div className="gateway-balance-total"><dt>Saldo después</dt><dd>{money(payment.balance - payment.total)}</dd></div>
            </dl>
          )}

          {error && <p className="form-error gateway-error" role="alert">{error}</p>}

          <button className="primary-button gateway-pay" disabled={!formValid || processing} onClick={() => { void confirm() }}>
            {processing ? <><RefreshCw size={16} className="spin" /> Procesando pago…</> : <>Pagar {money(payment.total)} <ChevronRight size={17} /></>}
          </button>
          <button className="gateway-cancel" disabled={processing} onClick={() => { void cancel() }}>
            <X size={15} /> Cancelar y volver
          </button>
        </section>
      </main>
    </div>
  )
}
