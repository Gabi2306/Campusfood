'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { getBogotaDateString, isValidPickupTime } from '@/lib/pickup-time'
import {
  BarChart3, Bell, ChevronRight, Clock3, Coffee, CreditCard, FileText,
  LayoutDashboard, LogOut, Menu, Pencil, Plus, Search,
  Settings2, ShoppingBag, Trash2, TrendingUp, Users, X,
  Salad, Sandwich, Cookie, CupSoda, RefreshCw, AlertCircle,
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────
type MenuItem = {
  id: number; name: string; category: string; price: number
  iconKey: string; available: boolean
}

type OrderItem = { name: string; quantity: number }

type RecentOrder = {
  id: number; userName: string; total: number
  status: string; createdAt: string; pickupAt: string | null; items: OrderItem[]
}

type OrderRecord = {
  id: number
  total: number
  status: string
  createdAt: string
  pickupAt: string | null
  user: { name: string; email: string }
  items: { quantity: number; menuItem: { name: string } }[]
}

type DemandItem  = { name: string; qty: number }

type Stats = {
  totalOrders: number
  uniqueStudents: number
  revenueToday: number
  ordersGrowth: string | null
  demand: DemandItem[]
  recentOrders: RecentOrder[]
  totalUsers: number
  totalMenuItems: number
  availableItems: number
}

// ── Helpers ──────────────────────────────────────────────────────
const money = (v: number) => `$${v.toLocaleString('es-CO')}`

const formatPickupAt = (value: string) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(value))

const getPickupTimeSlots = (now: Date) => {
  const today = getBogotaDateString(now)
  return Array.from({ length: 21 }, (_, index) => 8 * 60 + index * 30)
    .filter((minutes) => isValidPickupTime(today, minutes, now))
}

const formatPickupTime = (minutes: number) => {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const hour12 = hour % 12 || 12
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a. m.' : 'p. m.'}`
}

const ICON_MAP: Record<string, React.ReactNode> = {
  salad:    <Salad    size={36} strokeWidth={1.5} color="#8ca18d" />,
  sandwich: <Sandwich size={36} strokeWidth={1.5} color="#e2b85b" />,
  coffee:   <Coffee   size={36} strokeWidth={1.5} color="#c86f55" />,
  cookie:   <Cookie   size={36} strokeWidth={1.5} color="#8ca18d" />,
  cupsoda:  <CupSoda  size={36} strokeWidth={1.5} color="#8da6b0" />,
}
const iconNode = (key: string) => ICON_MAP[key] ?? ICON_MAP['sandwich']

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  preparing: 'Preparando',
  ready:     'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
const STATUS_CLASS: Record<string, string> = {
  pending:   'status-prep',
  preparing: 'status-prep',
  ready:     'status-ready',
  delivered: 'status-ready',
  cancelled: 'status-cancelled',
}

const CANCELLATION_CUTOFF_MS = 30 * 60 * 1000

function canStudentCancelScheduledOrder(order: Pick<OrderRecord, 'status' | 'pickupAt'>) {
  return Boolean(
    order.pickupAt &&
    !['delivered', 'cancelled'].includes(order.status) &&
    new Date(order.pickupAt).getTime() - Date.now() >= CANCELLATION_CUTOFF_MS
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Coffee size={19} /></span>
      <span>Café <b>Campus</b></span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ══════════════════════════════════════════════════════════════════
function StudentView({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  const [studentSection, setStudentSection] = useState<'menu' | 'orders' | 'history'>('menu')
  const [items, setItems]     = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [myOrders, setMyOrders] = useState<OrderRecord[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null)
  const [cart, setCart]       = useState<Record<number, number>>({})
  const [category, setCategory] = useState('Todos')
  const [showAccount, setShowAccount] = useState(false)
  const [isCheckout, setIsCheckout] = useState(false)
  const [isAdvanceOrder, setIsAdvanceOrder] = useState(false)
  const [pickupTime, setPickupTime] = useState('')
  const [checkoutNow, setCheckoutNow] = useState(() => new Date())
  const [isStartingPayment, setIsStartingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')
  const cartStorageKey = `campusfood:cart:${email ?? ''}`
  const pendingPaymentStorageKey = `campusfood:pending-payment:${email ?? ''}`

  useEffect(() => {
    try {
      const savedCart = window.localStorage.getItem(cartStorageKey)
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as Record<string, number>
        const restoredCart = Object.fromEntries(
          Object.entries(parsed).filter(([id, quantity]) =>
            /^\d+$/.test(id) && Number(id) > 0 && Number.isSafeInteger(quantity) && quantity > 0
          ).map(([id, quantity]) => [Number(id), quantity])
        )
        setCart(restoredCart)
      }
    } catch (error) {
      console.error('Unable to restore the saved cart:', error)
      setPaymentNotice('No se pudo restaurar el carrito guardado en este navegador.')
    }
  }, [cartStorageKey])

  useEffect(() => {
    fetch('/api/menu')
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isCheckout) return

    const refreshTime = () => setCheckoutNow(new Date())
    refreshTime()
    const interval = window.setInterval(refreshTime, 1_000)
    return () => window.clearInterval(interval)
  }, [isCheckout])

  useEffect(() => {
    const url = new URL(window.location.href)
    const paymentResult = url.searchParams.get('payment')

    if (paymentResult === 'cancelled') {
      setPaymentNotice('El pago fue cancelado. Tu carrito sigue disponible para que lo intentes de nuevo.')
      try {
        window.localStorage.removeItem(pendingPaymentStorageKey)
      } catch (error) {
        console.error('Unable to clear the cancelled payment session:', error)
      }
      url.searchParams.delete('payment')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url)
      return
    }

    let sessionId = paymentResult === 'success' ? url.searchParams.get('session_id') : null
    if (!sessionId) {
      try {
        sessionId = window.localStorage.getItem(pendingPaymentStorageKey)
      } catch (error) {
        console.error('Unable to restore the pending payment session:', error)
      }
    }
    if (!sessionId) return

    let cancelled = false
    setPaymentNotice(
      paymentResult === 'success'
        ? 'Pago recibido. Estamos confirmando tu pedido...'
        : 'Estamos verificando el pedido asociado a tu pago...'
    )
    const verifyPayment = async () => {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
        try {
          const response = await fetch(`/api/checkout/status?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
          if (!response.ok) throw new Error('No se pudo consultar el estado del pago.')
          const result = await response.json() as { status: string; orderId: number | null }
          if (result.status === 'paid') {
            setPaymentNotice(`Pago confirmado. Tu pedido #${result.orderId} ya fue registrado.`)
            setStudentSection('orders')
            setCart({})
            try {
              window.localStorage.removeItem(cartStorageKey)
              window.localStorage.removeItem(pendingPaymentStorageKey)
            } catch (error) {
              console.error('Unable to clear saved checkout data after payment:', error)
            }
            setIsAdvanceOrder(false)
            setPickupTime('')
            url.searchParams.delete('payment')
            url.searchParams.delete('session_id')
            window.history.replaceState({}, '', url)
            return
          }
          if (result.status === 'expired' || result.status === 'failed') {
            setPaymentNotice('El pago no se completó. Puedes volver a intentarlo desde el carrito.')
            try {
              window.localStorage.removeItem(pendingPaymentStorageKey)
            } catch (error) {
              console.error('Unable to clear the failed payment session:', error)
            }
            url.searchParams.delete('payment')
            url.searchParams.delete('session_id')
            window.history.replaceState({}, '', url)
            return
          }
        } catch {
          setPaymentNotice('Estamos confirmando el pago. Esta página se actualizará cuando Stripe confirme el resultado.')
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_000))
      }
    }
    void verifyPayment()

    return () => { cancelled = true }
  }, [cartStorageKey, pendingPaymentStorageKey])

  const fetchMyOrders = useCallback(async () => {
    setOrdersLoading(true)
    setOrdersError('')
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' })
      const result = await response.json() as OrderRecord[] | { error?: string }
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(!Array.isArray(result) ? result.error : undefined)
      }
      setMyOrders(result)
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'No se pudieron cargar tus pedidos.')
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  const cancelMyOrder = async (orderId: number) => {
    setCancellingOrderId(orderId)
    setOrdersError('')
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo cancelar el pedido.')
      setPaymentNotice(`El pedido #${orderId} fue cancelado.`)
      await fetchMyOrders()
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'No se pudo cancelar el pedido.')
    } finally {
      setCancellingOrderId(null)
    }
  }

  useEffect(() => {
    if (studentSection === 'menu') return
    void fetchMyOrders()
    const interval = window.setInterval(() => { void fetchMyOrders() }, 5_000)
    return () => window.clearInterval(interval)
  }, [studentSection, fetchMyOrders])

  const categories = ['Todos', 'Almuerzos', 'Bebidas', 'Snacks']
  const filtered   = items.filter((item) => (category === 'Todos' || item.category === category) && item.available)
  const count      = Object.values(cart).reduce((a, b) => a + b, 0)
  const total      = items.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0)
  const pickupTimeSlots = getPickupTimeSlots(checkoutNow)
  const pickupDate = getBogotaDateString(checkoutNow)
  const selectedPickupTime = pickupTime && isValidPickupTime(pickupDate, Number(pickupTime), checkoutNow) ? pickupTime : ''
  const pickupTimeExpired = isAdvanceOrder && pickupTime !== '' && selectedPickupTime === ''
  const initials   = userName.substring(0, 2).toUpperCase()
  const firstName  = userName.split(' ')[0]

  const updateCartQuantity = (itemId: number, quantity: number) => {
    setCart((current) => {
      const updatedCart = { ...current }
      if (quantity <= 0) delete updatedCart[itemId]
      else updatedCart[itemId] = quantity
      return updatedCart
    })
  }

  const startPayment = async () => {
    if (isStartingPayment || count === 0) return
    if (isAdvanceOrder && !selectedPickupTime) {
      setPaymentError('Selecciona una hora de recogida válida para hoy.')
      return
    }

    setIsStartingPayment(true)
    setPaymentError('')
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart))
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId: Number(menuItemId), quantity })),
          isAdvanceOrder,
          pickupDate: isAdvanceOrder ? pickupDate : null,
          pickupTime: isAdvanceOrder ? Number(selectedPickupTime) : null,
        }),
      })
      const responseBody = await response.text()
      let data: { url?: string; sessionId?: string; error?: string }
      try {
        data = JSON.parse(responseBody) as { url?: string; sessionId?: string; error?: string }
      } catch {
        throw new Error(`El servidor no devolvió una respuesta válida al iniciar el pago (HTTP ${response.status}). Revisa la terminal donde está ejecutándose Campusfood.`)
      }
      if (!response.ok || !data.url || !data.sessionId) throw new Error(data.error ?? 'No se pudo iniciar el pago. Inténtalo de nuevo.')
      window.localStorage.setItem(pendingPaymentStorageKey, data.sessionId)
      window.location.assign(data.url)
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'No se pudo iniciar el pago. Inténtalo de nuevo.')
      setIsStartingPayment(false)
    }
  }

  return (
    <div className="student-shell">
      <header className="topbar">
        <Brand />
        <nav>
          <button className={studentSection === 'menu' ? 'nav-active' : ''} onClick={() => setStudentSection('menu')}>Menú de hoy</button>
          <button className={studentSection === 'orders' ? 'nav-active' : ''} onClick={() => setStudentSection('orders')}>Mis pedidos</button>
          <button className={studentSection === 'history' ? 'nav-active' : ''} onClick={() => setStudentSection('history')}>Historial</button>
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notificaciones"><Bell size={19} /></button>
          <button className="profile-chip" onClick={() => setShowAccount(!showAccount)}>
            <span>{initials}</span><span className="profile-name">{firstName}</span><ChevronRight size={15} />
          </button>
          {showAccount && (
            <div className="account-popover">
              <strong>{userName}</strong><span>{email}</span>
              <button className="danger-link" onClick={onLogout}><LogOut size={14} /> Cerrar sesión</button>
            </div>
          )}
        </div>
      </header>

      <main className="student-main">
        {paymentNotice && <p className="payment-notice" role="status">{paymentNotice}</p>}
        {isCheckout ? (
          <section className="checkout-view">
            <button className="checkout-back" onClick={() => setIsCheckout(false)}>
              <ChevronRight className="checkout-back-icon" size={17} /> Volver al menú
            </button>
            <div className="checkout-title">
              <p className="eyebrow">PAGO</p>
              <h1>Revisa tu compra</h1>
              <p className="subtext">Revisa los productos, tus datos y el total antes de continuar al pago.</p>
            </div>

            {count === 0 ? (
              <div className="checkout-empty">
                <div className="empty-icon"><ShoppingBag size={27} /></div>
                <h2>Tu carrito está vacío</h2>
                <p>Agrega productos al pedido para revisar el pago.</p>
                <button className="primary-button" onClick={() => setIsCheckout(false)}>Volver al menú</button>
              </div>
            ) : (
              <div className="checkout-grid">
                <div className="checkout-details">
                  <section className="checkout-card">
                    <div className="checkout-card-heading">
                      <div><h2>Productos</h2><p>{count} {count === 1 ? 'producto' : 'productos'} en tu pedido</p></div>
                      <ShoppingBag size={20} />
                    </div>
                    <div className="checkout-items">
                      {items.filter((item) => cart[item.id]).map((item) => (
                        <article className="checkout-item" key={item.id}>
                          <div className="checkout-item-art">{iconNode(item.iconKey)}</div>
                          <div className="checkout-item-info">
                            <span className="food-category">{item.category}</span>
                            <h3>{item.name}</h3>
                            <span>{money(item.price)} por unidad</span>
                          </div>
                          <div className="checkout-item-actions">
                            <div className="quantity">
                              <button aria-label={`Quitar una unidad de ${item.name}`} onClick={() => updateCartQuantity(item.id, cart[item.id] - 1)}>−</button>
                              <b>{cart[item.id]}</b>
                              <button aria-label={`Agregar una unidad de ${item.name}`} onClick={() => updateCartQuantity(item.id, cart[item.id] + 1)}>+</button>
                            </div>
                            <strong>{money(item.price * cart[item.id])}</strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="checkout-card">
                    <div className="checkout-card-heading">
                      <div><h2>Datos del comprador</h2><p>Información de tu cuenta</p></div>
                      <Users size={20} />
                    </div>
                    <dl className="checkout-contact">
                      <div><dt>Nombre</dt><dd>{userName}</dd></div>
                      <div><dt>Correo</dt><dd>{email}</dd></div>
                    </dl>
                  </section>

                  <section className="checkout-card advance-order-card">
                    <div className="checkout-card-heading">
                      <div><h2>Tipo de pedido</h2><p>Elige si necesitas programar la recogida</p></div>
                      <Clock3 size={20} />
                    </div>
                    <label className="advance-order-toggle">
                      <input
                        type="checkbox"
                        checked={isAdvanceOrder}
                        onChange={(event) => {
                          setIsAdvanceOrder(event.target.checked)
                          setPickupTime('')
                        }}
                      />
                      <span>
                        <strong>¿Es un pedido anticipado?</strong>
                        <small>Programa la recogida para hoy.</small>
                      </span>
                    </label>
                    {isAdvanceOrder && (
                      <div className="pickup-time-field">
                        <label htmlFor="pickup-time">
                          Hora de recogida
                          <span className="pickup-date">
                            Hoy, {new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long' }).format(checkoutNow)}
                          </span>
                        </label>
                        {pickupTimeSlots.length > 0 ? (
                          <select
                            id="pickup-time"
                            required
                            value={selectedPickupTime}
                            onChange={(event) => {
                              const now = new Date()
                              const selectedMinutes = Number(event.target.value)
                              setCheckoutNow(now)
                              setPickupTime(isValidPickupTime(getBogotaDateString(now), selectedMinutes, now) ? event.target.value : '')
                            }}
                          >
                            <option value="" disabled>Selecciona una hora</option>
                            {pickupTimeSlots.map((minutes) => (
                              <option key={minutes} value={minutes}>{formatPickupTime(minutes)}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="pickup-unavailable">Ya no hay horarios disponibles para hoy. La recogida anticipada es de 8:00 a. m. a 6:00 p. m.</p>
                        )}
                        {pickupTimeExpired && (
                          <p className="pickup-unavailable" role="alert">
                            Esa hora ya no cumple el mínimo de 30 minutos. Selecciona una hora posterior.
                          </p>
                        )}
                        <p className="pickup-time-help">
                          Disponible hoy entre 8:00 a. m. y 6:00 p. m. La recogida debe solicitarse con al menos 30 minutos de anticipación.
                        </p>
                      </div>
                    )}
                  </section>
                </div>

                <aside className="checkout-sidebar">
                  <section className="checkout-card checkout-summary">
                    <div className="checkout-card-heading">
                      <div><h2>Resumen de pago</h2><p>Revisa el valor total</p></div>
                    </div>
                    <div className="checkout-summary-line"><span>Productos ({count})</span><strong>{money(total)}</strong></div>
                    <div className="checkout-total"><span>Total a pagar</span><strong>{money(total)}</strong></div>
                  </section>

                  <section className="payment-placeholder">
                    <span className="payment-placeholder-icon"><CreditCard size={21} /></span>
                    <p className="eyebrow">STRIPE CHECKOUT</p>
                    <h2>Pago seguro en modo de pruebas</h2>
                    <p>Continuarás a Stripe para completar el pago. El pedido se registrará cuando Stripe confirme el pago.</p>
                    {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
                    <button
                      className="primary-button"
                      disabled={isStartingPayment || (isAdvanceOrder && !selectedPickupTime)}
                      onClick={startPayment}
                      aria-describedby="payment-unavailable"
                    >
                      {isStartingPayment ? 'Conectando con Stripe...' : 'Pagar con Stripe'}
                    </button>
                    <span id="payment-unavailable" className="payment-unavailable">Solo se aceptan pagos de prueba.</span>
                  </section>
                </aside>
              </div>
            )}
          </section>
        ) : studentSection === 'menu' ? (
          <>
        <section className="welcome-row">
          <div>
            <p className="eyebrow">BIENVENIDO A TU CAFETERÍA</p>
            <h1>Hola, {firstName} <span>●</span></h1>
            <p className="subtext">Pide antes de llegar. Tu almuerzo te estará esperando.</p>
          </div>
          <div className="balance-card">
            <div className="balance-icon">$</div>
            <div><span>Saldo disponible</span><strong>$48.500</strong></div>
            <button aria-label="Ver saldo"><ChevronRight size={17} /></button>
          </div>
        </section>

        <div className="student-grid">
          <section className="menu-section">
            <div className="section-heading">
              <div><h2>El menú de hoy</h2><p>Preparado fresco para ti</p></div>
              <div className="search-box"><Search size={17} /><input aria-label="Buscar en el menú" placeholder="Buscar" /></div>
            </div>
            <div className="category-tabs">
              {categories.map((name) => (
                <button key={name} className={category === name ? 'tab-active' : ''} onClick={() => setCategory(name)}>{name}</button>
              ))}
            </div>

            {loading ? (
              <div className="loading-state"><RefreshCw size={20} className="spin" /><span>Cargando menú...</span></div>
            ) : (
              <div className="menu-grid">
                {filtered.map((item) => (
                  <article className="menu-card" key={item.id}>
                    <div className="food-art">
                      {iconNode(item.iconKey)}
                      <span className="available-dot" />
                    </div>
                    <div className="food-copy">
                      <span className="food-category">{item.category}</span>
                      <h3>{item.name}</h3>
                      <div className="food-bottom">
                        <strong>{money(item.price)}</strong>
                        {cart[item.id]
                          ? (
                            <div className="quantity">
                              <button aria-label={`Quitar una unidad de ${item.name}`} onClick={() => updateCartQuantity(item.id, cart[item.id] - 1)}>−</button>
                              <b>{cart[item.id]}</b>
                              <button aria-label={`Agregar una unidad de ${item.name}`} onClick={() => updateCartQuantity(item.id, cart[item.id] + 1)}>+</button>
                            </div>
                          )
                          : (
                            <button className="add-button" onClick={() => updateCartQuantity(item.id, 1)}>
                              <Plus size={16} /> Agregar
                            </button>
                          )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="order-card">
            <div className="order-heading">
              <div>
                <h2>Tu pedido</h2>
                <p>{count ? `${count} ${count === 1 ? 'producto' : 'productos'}` : 'Aún no has agregado nada'}</p>
              </div>
              <ShoppingBag size={21} />
            </div>
            {count === 0
              ? (
                <div className="empty-order">
                  <div className="empty-icon"><ShoppingBag size={27} /></div>
                  <p>Tu pedido aparecerá aquí</p>
                  <span>Explora el menú y agrega tus favoritos.</span>
                </div>
              )
              : (
                <>
                  <div className="order-lines">
                    {items.filter((item) => cart[item.id]).map((item) => (
                      <div className="order-line" key={item.id}>
                        <div className="order-line-info">
                          <span>{item.name}</span>
                          <div className="quantity">
                            <button aria-label={`Quitar una unidad de ${item.name}`} onClick={() => updateCartQuantity(item.id, cart[item.id] - 1)}>−</button>
                            <b>{cart[item.id]}</b>
                            <button aria-label={`Agregar una unidad de ${item.name}`} onClick={() => updateCartQuantity(item.id, cart[item.id] + 1)}>+</button>
                          </div>
                        </div>
                        <strong>{money(item.price * cart[item.id])}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="total-line"><span>Total</span><strong>{money(total)}</strong></div>
                  <button className="primary-button" onClick={() => setIsCheckout(true)}>Continuar al pago <ChevronRight size={17} /></button>
                  <p className="order-note"><Clock3 size={14} /> Revisa y ajusta tu pedido antes de continuar.</p>
                </>
              )}
          </aside>
        </div>
          </>
        ) : (
          <section className="student-orders-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{studentSection === 'orders' ? 'SEGUIMIENTO' : 'PEDIDOS ANTERIORES'}</p>
                      <h1>{studentSection === 'orders' ? 'Mis pedidos' : 'Historial de pedidos'}</h1>
                      <p>{studentSection === 'orders' ? 'El estado se actualiza automáticamente.' : 'Consulta los pedidos entregados o cancelados.'}</p>
                    </div>
                    <button className="outline-button" onClick={() => { void fetchMyOrders() }} disabled={ordersLoading}>
                      <RefreshCw size={14} className={ordersLoading ? 'spin' : ''} /> Actualizar
                    </button>
                  </div>
                  {ordersError && <p className="orders-error" role="alert">{ordersError}</p>}
                  {ordersLoading && myOrders.length === 0 ? (
                    <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando pedidos...</span></div>
                  ) : (
                    (() => {
                      const visibleOrders = myOrders.filter((order) =>
                        studentSection === 'orders'
                          ? !['delivered', 'cancelled'].includes(order.status)
                          : ['delivered', 'cancelled'].includes(order.status)
                      )
                      return visibleOrders.length === 0
                        ? <p className="empty-chart">{studentSection === 'orders' ? 'No tienes pedidos en preparación.' : 'Aún no tienes pedidos anteriores.'}</p>
                        : (
                          <div className="student-orders-list">
                            {visibleOrders.map((order) => (
                              <article className="student-order-card" key={order.id}>
                                <div className="student-order-heading">
                                  <div>
                                    <strong>Pedido #{order.id}</strong>
                                    <span>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(order.createdAt))}</span>
                                  </div>
                                  <span className={`order-status-pill ${STATUS_CLASS[order.status] ?? 'status-prep'}`}>
                                    {STATUS_LABEL[order.status] ?? order.status}
                                  </span>
                                </div>
                                <p>{order.items.map((item) => `${item.quantity}× ${item.menuItem.name}`).join(', ')}</p>
                                <div className="student-order-footer">
                                  <strong>{money(order.total)}</strong>
                                  {order.pickupAt && <span><Clock3 size={13} /> Recogida {formatPickupAt(order.pickupAt)}</span>}
                                </div>
                                {canStudentCancelScheduledOrder(order) && (
                                  <button
                                    className="order-action-button order-cancel-button"
                                    disabled={cancellingOrderId === order.id}
                                    onClick={() => { void cancelMyOrder(order.id) }}
                                  >
                                    {cancellingOrderId === order.id ? 'Cancelando...' : 'Cancelar pedido'}
                                  </button>
                                )}
                              </article>
                            ))}
                          </div>
                        )
                    })()
                  )}
          </section>
        )}
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ADMIN VIEW
// ══════════════════════════════════════════════════════════════════
function AdminView({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  const [selected, setSelected] = useState<'dashboard' | 'menu' | 'pedidos' | 'historial' | 'reportes'>('dashboard')

  // ── Menú ──────────────────────────────────────────────────────
  const [items, setItems]         = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(false)

  // ── Stats ─────────────────────────────────────────────────────
  const [stats, setStats]         = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError]     = useState(false)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)

  // ── Modales ───────────────────────────────────────────────────
  const [editing, setEditing]     = useState<MenuItem | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [newItem, setNewItem]     = useState({ name: '', category: 'Almuerzos', price: 4000, iconKey: 'sandwich' })
  const [saving, setSaving]       = useState(false)

  const initials  = userName.substring(0, 2).toUpperCase()
  const firstName = userName.split(' ')[0]

  // ── Fetch stats ───────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true); setStatsError(false)
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error()
      setStats(await res.json())
    } catch {
      setStatsError(true)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    setOrdersError('')
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' })
      const result = await response.json() as OrderRecord[] | { error?: string }
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(!Array.isArray(result) ? result.error : undefined)
      }
      setOrders(result)
      const failedReconciliations = Number(response.headers.get('X-Order-Reconciliation-Failures') ?? 0)
      if (failedReconciliations > 0) {
        setOrdersError(`No se pudieron verificar ${failedReconciliations} pagos pendientes con Stripe. Revisa la configuración y los logs del servidor.`)
      }
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'No se pudieron cargar los pedidos.')
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  // ── Fetch menú ────────────────────────────────────────────────
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true)
    try {
      const res = await fetch('/api/menu')
      setItems(await res.json())
    } finally {
      setMenuLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats(); fetchOrders() }, [fetchStats, fetchOrders])
  useEffect(() => {
    if (selected !== 'dashboard' && selected !== 'pedidos' && selected !== 'historial') return
    const interval = window.setInterval(() => { void fetchOrders() }, 5_000)
    return () => window.clearInterval(interval)
  }, [selected, fetchOrders])
  useEffect(() => {
    if (selected === 'menu') fetchMenu()
  }, [selected, fetchMenu])

  // ── Guardar item (nuevo o edición) ────────────────────────────
  const saveItem = async () => {
    setSaving(true)
    if (editing) {
      await fetch(`/api/menu/${editing.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editing),
      })
    } else {
      await fetch('/api/menu', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newItem),
      })
    }
    setSaving(false)
    setEditing(null); setShowAdd(false)
    setNewItem({ name: '', category: 'Almuerzos', price: 4000, iconKey: 'sandwich' })
    fetchMenu()
  }

  // ── Eliminar item ─────────────────────────────────────────────
  const removeItem = async (id: number) => {
    await fetch(`/api/menu/${id}`, { method: 'DELETE' })
    fetchMenu()
  }

  // ── Cambiar estado de pedido ──────────────────────────────────
  const updateOrderStatus = async (orderId: number, status: string) => {
    setUpdatingOrderId(orderId)
    setOrdersError('')
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo actualizar el pedido.')
      await Promise.all([fetchOrders(), fetchStats()])
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'No se pudo actualizar el pedido.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // ── Barra máxima para el gráfico ──────────────────────────────
  const demandMax = useMemo(() => {
    if (!stats?.demand?.length) return 1
    return Math.max(...stats.demand.map((d) => d.qty), 1)
  }, [stats])

  const barColors = ['terracotta', 'sage', 'gold', 'blue', 'sage', 'terracotta']
  const activeOrders = orders.filter((order) => ['pending', 'preparing', 'ready'].includes(order.status))
  const historicalOrders = orders.filter((order) => ['delivered', 'cancelled'].includes(order.status))

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand />
        <div className="admin-profile">
          <span className="profile-avatar">{initials}</span>
          <div><strong>{userName}</strong><span>Administrador</span></div>
        </div>
        <nav className="side-nav">
          <span className="side-label">GESTIÓN</span>
          <button className={selected === 'dashboard' ? 'side-active' : ''} onClick={() => setSelected('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={selected === 'menu' ? 'side-active' : ''} onClick={() => setSelected('menu')}>
            <Menu size={18} /> Menú
          </button>
          <button className={selected === 'pedidos' ? 'side-active' : ''} onClick={() => setSelected('pedidos')}>
            <ShoppingBag size={18} /> Pedidos activos
          </button>
          <button className={selected === 'historial' ? 'side-active' : ''} onClick={() => setSelected('historial')}>
            <FileText size={18} /> Historial
          </button>
          <button className={selected === 'reportes' ? 'side-active' : ''} onClick={() => setSelected('reportes')}>
            <BarChart3 size={18} /> Reportes
          </button>
          <span className="side-label">CUENTA</span>
          <button><Settings2 size={18} /> Configuración</button>
          <button onClick={onLogout} className="danger-link"><LogOut size={18} /> Cerrar sesión</button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <div>
            <p className="eyebrow">PANEL DE CONTROL</p>
            <h1>
              {selected === 'menu'     && 'Gestionar menú'}
              {selected === 'pedidos'  && 'Pedidos activos'}
              {selected === 'historial' && 'Historial de pedidos'}
              {selected === 'reportes' && 'Reportes de operación'}
              {selected === 'dashboard' && `Buenos días, ${firstName}`}
            </h1>
          </div>
          <div className="live-pill">
            <span />
            {statsLoading ? 'Actualizando...' : 'En vivo'}
            <button aria-label="Refrescar" onClick={fetchStats} title="Refrescar datos">
              <RefreshCw size={16} className={statsLoading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* ── DASHBOARD ── */}
        {selected === 'dashboard' && (
          <>
            {statsError && (
              <div className="admin-error">
                <AlertCircle size={15} /> Error cargando datos.{' '}
                <button onClick={fetchStats}>Reintentar</button>
              </div>
            )}

            <section className="metric-grid">
              <div className="metric-card">
                <span className="metric-icon terracotta-bg"><ShoppingBag size={18} /></span>
                <div>
                  <p>Pedidos de hoy</p>
                  <strong>{statsLoading ? '—' : (stats?.totalOrders ?? 0)}</strong>
                  {stats?.ordersGrowth != null
                    ? <small className="positive"><TrendingUp size={13} /> +{stats.ordersGrowth}% vs. ayer</small>
                    : <small className="neutral">Sin datos de ayer</small>
                  }
                </div>
              </div>
              <div className="metric-card">
                <span className="metric-icon sage-bg"><Users size={18} /></span>
                <div>
                  <p>Estudiantes hoy</p>
                  <strong>{statsLoading ? '—' : (stats?.uniqueStudents ?? 0)}</strong>
                  <small className="neutral">De {stats?.totalUsers ?? '—'} registrados</small>
                </div>
              </div>
              <div className="metric-card">
                <span className="metric-icon gold-bg"><BarChart3 size={18} /></span>
                <div>
                  <p>Ingresos de hoy</p>
                  <strong style={{ fontSize: 18 }}>{statsLoading ? '—' : money(stats?.revenueToday ?? 0)}</strong>
                  <small className="neutral">{stats?.availableItems ?? '—'} items disponibles</small>
                </div>
              </div>
            </section>

            <section className="dashboard-grid">
              {/* Gráfico de demanda */}
              <div className="panel demand-panel">
                <div className="panel-heading">
                  <div><h2>Demanda acumulada</h2><p>Items más pedidos · Histórico</p></div>
                </div>
                {statsLoading
                  ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando...</span></div>
                  : stats?.demand?.length
                    ? (
                      <>
                        <div className="bars">
                          {stats.demand.map((item, i) => (
                            <div className="bar-row" key={item.name}>
                              <span>{item.name}</span>
                              <div className="bar-track">
                                <div className={`bar-fill ${barColors[i % barColors.length]}`}
                                  style={{ width: `${(item.qty / demandMax) * 100}%` }} />
                              </div>
                              <strong>{item.qty}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="chart-footer">
                          <span><i className="legend-dot terracotta" /> Unidades pedidas</span>
                          <span>Total: {stats.demand.reduce((s, d) => s + d.qty, 0)} uds.</span>
                        </div>
                      </>
                    )
                    : <p className="empty-chart">Aún no hay pedidos registrados.</p>
                }
              </div>

              {/* Pedidos recientes */}
              <div className="panel wait-panel">
                <div className="panel-heading">
                  <div><h2>Pedidos por preparar</h2><p>{activeOrders.length} pedidos activos · actualización automática</p></div>
                  <FileText size={19} className="muted-icon" />
                </div>
                {ordersError && <p className="orders-error" role="alert">{ordersError}</p>}
                {ordersLoading && activeOrders.length === 0
                  ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando...</span></div>
                  : activeOrders.length
                    ? (
                      <div className="recent-orders-list">
                        {activeOrders.slice(0, 5).map((order) => (
                          <div className="recent-order-row" key={order.id}>
                            <div className="recent-order-info">
                              <strong>{order.user.name} · Pedido #{order.id}</strong>
                              <span>{order.items.map((item) => `${item.quantity}× ${item.menuItem.name}`).join(', ')}</span>
                              {order.pickupAt && <small className="order-pickup-time"><Clock3 size={12} /> Recogida {formatPickupAt(order.pickupAt)}</small>}
                            </div>
                            <div className="recent-order-right">
                              <span className={STATUS_CLASS[order.status] ?? 'status-prep'}>
                                {STATUS_LABEL[order.status] ?? order.status}
                              </span>
                              <strong>{money(order.total)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                    : <p className="empty-chart">No hay pedidos activos por preparar.</p>
                }
                <button className="full-outline" onClick={() => setSelected('pedidos')}>
                  Ver todos los pedidos <ChevronRight size={15} />
                </button>
              </div>
            </section>
          </>
        )}

        {/* ── MENÚ ── */}
        {selected === 'menu' && (
          <section className="panel menu-admin-panel">
            <div className="panel-heading">
              <div><h2>Implementos del menú</h2><p>Administra lo que tus estudiantes pueden pedir hoy</p></div>
              <button className="primary-button small" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Agregar implemento
              </button>
            </div>
            {menuLoading
              ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando menú...</span></div>
              : (
                <div className="admin-menu-list">
                  {items.map((item) => (
                    <div className="admin-menu-row" key={item.id}>
                      <span className="admin-food-emoji">{iconNode(item.iconKey)}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.category} · {money(item.price)}</span>
                      </div>
                      <span className="availability">
                        <i style={{ background: item.available ? '#82a485' : '#c86f55' }} />
                        {item.available ? 'Disponible' : 'No disponible'}
                      </span>
                      <button onClick={() => setEditing({ ...item })} aria-label={`Editar ${item.name}`}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => removeItem(item.id)} aria-label={`Eliminar ${item.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </section>
        )}

        {/* ── PEDIDOS ── */}
        {selected === 'pedidos' && (
          <section className="panel orders-panel">
            <div className="panel-heading">
              <div><h2>Pedidos por gestionar</h2><p>{orders.length} pedidos · se actualizan automáticamente</p></div>
              <button className="outline-button" onClick={() => { void fetchOrders() }} disabled={ordersLoading}>
                <RefreshCw size={14} className={ordersLoading ? 'spin' : ''} /> Actualizar
              </button>
            </div>
            {ordersError && <p className="orders-error" role="alert">{ordersError}</p>}
            {ordersLoading && activeOrders.length === 0
              ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando pedidos...</span></div>
              : !activeOrders.length
                ? <p className="empty-chart">No hay pedidos pendientes de preparación.</p>
                : (
                  <div className="order-table">
                    <div className="table-head admin-order-table-head">
                      <span>ESTUDIANTE</span>
                      <span>ITEMS</span>
                      <span>TOTAL</span>
                      <span>ESTADO</span>
                      <span>ACCIÓN</span>
                    </div>
                    {activeOrders.map((order) => (
                      <div className="table-row admin-order-row" key={order.id}>
                        <span>
                          <strong>{order.user.name}</strong>
                          <small>Pedido #{order.id}</small>
                        </span>
                        <span>
                          {order.items.map((item) => `${item.quantity}× ${item.menuItem.name}`).join(', ')}
                          {order.pickupAt && <small className="order-pickup-time"><Clock3 size={12} /> Recogida {formatPickupAt(order.pickupAt)}</small>}
                        </span>
                        <span>{money(order.total)}</span>
                        <span className={`order-status-pill ${STATUS_CLASS[order.status] ?? 'status-prep'}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                        <span>
                          {order.status === 'pending' && (
                            <button className="order-action-button" disabled={updatingOrderId === order.id} onClick={() => { void updateOrderStatus(order.id, 'preparing') }}>
                              {updatingOrderId === order.id ? 'Guardando...' : 'Iniciar preparación'}
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button className="order-action-button" disabled={updatingOrderId === order.id} onClick={() => { void updateOrderStatus(order.id, 'ready') }}>
                              {updatingOrderId === order.id ? 'Guardando...' : 'Marcar listo'}
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button className="order-action-button" disabled={updatingOrderId === order.id} onClick={() => { void updateOrderStatus(order.id, 'delivered') }}>
                              {updatingOrderId === order.id ? 'Guardando...' : 'Marcar entregado'}
                            </button>
                          )}
                          {['pending', 'preparing', 'ready'].includes(order.status) && (
                            <button
                              className="order-action-button order-cancel-button"
                              disabled={updatingOrderId === order.id}
                              title="El administrador puede cancelar este pedido en cualquier momento."
                              onClick={() => { void updateOrderStatus(order.id, 'cancelled') }}
                            >
                              {updatingOrderId === order.id ? 'Guardando...' : 'Cancelar pedido'}
                            </button>
                          )}
                          {!['pending', 'preparing', 'ready'].includes(order.status) && <small>Sin acciones</small>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
          </section>
        )}

        {selected === 'historial' && (
          <section className="panel orders-panel">
            <div className="panel-heading">
              <div>
                <h2>Historial de pedidos</h2>
                <p>{historicalOrders.length} pedidos entregados o cancelados</p>
              </div>
              <button className="outline-button" onClick={() => { void fetchOrders() }} disabled={ordersLoading}>
                <RefreshCw size={14} className={ordersLoading ? 'spin' : ''} /> Actualizar
              </button>
            </div>
            {ordersError && <p className="orders-error" role="alert">{ordersError}</p>}
            {ordersLoading && orders.length === 0
              ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando historial...</span></div>
              : historicalOrders.length === 0
                ? <p className="empty-chart">Aún no hay pedidos entregados o cancelados.</p>
                : (
                  <div className="order-table">
                    <div className="table-head admin-history-table-head">
                      <span>ESTUDIANTE</span>
                      <span>PEDIDO</span>
                      <span>TOTAL</span>
                      <span>ESTADO</span>
                      <span>FECHA</span>
                    </div>
                    {historicalOrders.map((order) => (
                      <div className="table-row admin-history-row" key={order.id}>
                        <span><strong>{order.user.name}</strong></span>
                        <span>
                          <strong>#{order.id}</strong>
                          <small>{order.items.map((item) => `${item.quantity}× ${item.menuItem.name}`).join(', ')}</small>
                        </span>
                        <span>{money(order.total)}</span>
                        <span className={`order-status-pill ${STATUS_CLASS[order.status] ?? 'status-prep'}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                        <span>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(order.createdAt))}</span>
                      </div>
                    ))}
                  </div>
                )}
          </section>
        )}

        {/* ── REPORTES ── */}
        {selected === 'reportes' && (
          <section className="panel report-panel">
            <div className="panel-heading">
              <div><h2>Reporte de operación</h2><p>Resumen general de actividad</p></div>
              <button className="outline-button"><FileText size={15} /> Exportar</button>
            </div>
            <div className="report-stat-row">
              <div>
                <span>Pedidos hoy</span>
                <strong>{stats?.totalOrders ?? '—'}</strong>
              </div>
              <div>
                <span>Ingresos hoy</span>
                <strong style={{ fontSize: 18 }}>{money(stats?.revenueToday ?? 0)}</strong>
              </div>
              <div>
                <span>Estudiantes registrados</span>
                <strong>{stats?.totalUsers ?? '—'}</strong>
              </div>
              <div>
                <span>Items en menú</span>
                <strong>{stats?.totalMenuItems ?? '—'} <small>({stats?.availableItems ?? '—'} activos)</small></strong>
              </div>
            </div>
            <div className="panel-heading" style={{ marginTop: 24 }}>
              <div><h2>Demanda histórica</h2><p>Por item</p></div>
            </div>
            {stats?.demand?.length
              ? (
                <div className="bars" style={{ marginTop: 20 }}>
                  {stats.demand.map((item, i) => (
                    <div className="bar-row" key={item.name}>
                      <span>{item.name}</span>
                      <div className="bar-track">
                        <div className={`bar-fill ${barColors[i % barColors.length]}`}
                          style={{ width: `${(item.qty / demandMax) * 100}%` }} />
                      </div>
                      <strong>{item.qty}</strong>
                    </div>
                  ))}
                </div>
              )
              : <p className="empty-chart">Aún no hay pedidos registrados.</p>
            }
          </section>
        )}

        {/* ── MODAL agregar / editar ── */}
        {(showAdd || editing) && (
          <div className="modal-backdrop">
            <div className="modal">
              <button className="modal-close" onClick={() => { setShowAdd(false); setEditing(null) }}>
                <X size={18} />
              </button>
              <p className="eyebrow">{editing ? 'EDITAR IMPLEMENTO' : 'NUEVO IMPLEMENTO'}</p>
              <h2>{editing ? 'Actualizar menú' : 'Agregar al menú'}</h2>

              <label>
                Nombre
                <input
                  value={editing ? editing.name : newItem.name}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, name: e.target.value })
                    : setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Ej. Sándwich de pollo"
                />
              </label>

              <label>
                Categoría
                <select
                  value={editing ? editing.category : newItem.category}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, category: e.target.value })
                    : setNewItem({ ...newItem, category: e.target.value })}
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13 }}
                >
                  <option>Almuerzos</option>
                  <option>Bebidas</option>
                  <option>Snacks</option>
                </select>
              </label>

              <label>
                Precio
                <input
                  type="number"
                  value={editing ? editing.price : newItem.price}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, price: Number(e.target.value) })
                    : setNewItem({ ...newItem, price: Number(e.target.value) })}
                />
              </label>

              <label>
                Ícono
                <select
                  value={editing ? editing.iconKey : newItem.iconKey}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, iconKey: e.target.value })
                    : setNewItem({ ...newItem, iconKey: e.target.value })}
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13 }}
                >
                  <option value="salad">🥗 Bowl / Ensalada</option>
                  <option value="sandwich">🥪 Sándwich / Wrap</option>
                  <option value="coffee">☕ Café</option>
                  <option value="cookie">🍪 Snack / Galleta</option>
                  <option value="cupsoda">🥤 Bebida fría</option>
                </select>
              </label>

              {editing && (
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10, display: 'flex' }}>
                  <input
                    type="checkbox"
                    checked={editing.available}
                    onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  Disponible en el menú
                </label>
              )}

              <div className="modal-actions">
                <button className="outline-button" onClick={() => { setShowAdd(false); setEditing(null) }}>
                  Cancelar
                </button>
                <button className="primary-button" onClick={saveItem} disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar implemento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════
export default function CafeApp({
  role, userName, email, onLogout,
}: {
  role: 'admin' | 'student'; userName: string; email: string; onLogout: () => void
}) {
  return role === 'admin'
    ? <AdminView userName={userName} email={email} onLogout={onLogout} />
    : <StudentView userName={userName} email={email} onLogout={onLogout} />
}
