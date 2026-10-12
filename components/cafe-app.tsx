'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { getBogotaDateString, isValidPickupTime } from '@/lib/pickup-time'
import {
  BarChart3, BellRing, Check, ChefHat, ChevronRight, Clock3, Coffee, CreditCard, Database, Ellipsis, FileText,
  History, House, LayoutDashboard, LogOut, Menu, Pencil, Plus, Search,
  ShoppingBag, Smartphone, Target, Trash2, TrendingUp, Users, Wallet,
  RefreshCw, AlertCircle,
} from 'lucide-react'
import {
  Brand, Sheet, STATUS_CLASS, STATUS_LABEL, formatDateTime, formatPickupAt, iconNode, money,
  type MenuItem, type OrderRecord,
} from '@/components/shared'
import { NotificationBell, NotificationSettings } from '@/components/notifications'
import ProjectionsPanel from '@/components/projections-panel'
import HistoryPanel from '@/components/history-panel'

// ── Tipos ────────────────────────────────────────────────────────
type OrderItem = { name: string; quantity: number }

type RecentOrder = {
  id: number; userName: string; total: number
  status: string; createdAt: string; pickupAt: string | null; items: OrderItem[]
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

const CANCELLATION_CUTOFF_MS = 30 * 60 * 1000

function canStudentCancelScheduledOrder(order: Pick<OrderRecord, 'status' | 'pickupAt'>) {
  return Boolean(
    order.pickupAt &&
    !['delivered', 'cancelled'].includes(order.status) &&
    new Date(order.pickupAt).getTime() - Date.now() >= CANCELLATION_CUTOFF_MS
  )
}

function AccountSheet({
  open, onClose, userName, email, roleLabel, onLogout, showNotifications,
}: {
  open: boolean; onClose: () => void; userName: string; email: string; roleLabel: string
  onLogout: () => void; showNotifications: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow="MI CUENTA" title={userName} className="account-sheet">
      <p className="sheet-subtitle">{email} · {roleLabel}</p>
      {showNotifications && <NotificationSettings />}
      <button className="logout-button" onClick={onLogout}><LogOut size={16} /> Cerrar sesión</button>
    </Sheet>
  )
}

// ══════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ══════════════════════════════════════════════════════════════════
type StudentSection = 'menu' | 'orders' | 'history'

function StudentView({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  const [studentSection, setStudentSection] = useState<StudentSection>('menu')
  const [items, setItems]     = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [myOrders, setMyOrders] = useState<OrderRecord[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null)
  const [cart, setCart]       = useState<Record<number, number>>({})
  const [category, setCategory] = useState('Todos')
  const [search, setSearch]   = useState('')
  const [showAccount, setShowAccount] = useState(false)
  const [isCheckout, setIsCheckout] = useState(false)
  const [isAdvanceOrder, setIsAdvanceOrder] = useState(false)
  const [pickupTime, setPickupTime] = useState('')
  const [checkoutNow, setCheckoutNow] = useState(() => new Date())
  const [isStartingPayment, setIsStartingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | 'balance'>('card')
  const [balance, setBalance] = useState<number | null>(null)
  const cartStorageKey = `campusfood:cart:${email ?? ''}`
  const pendingPaymentStorageKey = `campusfood:pending-payment:${email ?? ''}`

  const goTo = useCallback((section: StudentSection) => {
    setStudentSection(section)
    setIsCheckout(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Abrir "Mis pedidos" desde una notificación push (?section=orders o mensaje del service worker)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('section') === 'orders') {
      setStudentSection('orders')
      url.searchParams.delete('section')
      window.history.replaceState({}, '', url)
    }
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'open-orders') goTo('orders')
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [goTo])

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

  const fetchBalance = useCallback(() => {
    fetch('/api/profile', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((profile: { balance?: number } | null) => { if (profile?.balance != null) setBalance(profile.balance) })
      .catch(() => undefined)
  }, [])
  useEffect(() => { fetchBalance() }, [fetchBalance, studentSection, isCheckout])

  // El menú se refresca cada 30 s para reflejar cambios de cocina (stock, agotados, nuevos platos).
  useEffect(() => {
    const loadMenu = () => fetch('/api/menu', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
    void loadMenu()
    const interval = window.setInterval(() => { void loadMenu() }, 30_000)
    return () => window.clearInterval(interval)
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
            setPaymentNotice(`Pago confirmado. Tu pedido #${result.orderId} ya fue registrado. Te avisaremos cuando esté listo.`)
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
          if (result.status === 'expired' || result.status === 'failed' || result.status === 'cancelled') {
            setPaymentNotice(result.status === 'cancelled'
              ? 'Cancelaste el pago. Tu carrito sigue disponible.'
              : 'El pago no se completó. Puedes volver a intentarlo desde el carrito.')
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
          setPaymentNotice('Estamos confirmando el pago. Esta página se actualizará en unos segundos.')
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

  // Se consultan los pedidos siempre (cada 5 s en las pestañas de pedidos, cada 30 s
  // en el menú) para mostrar el contador de pedidos activos en la barra inferior.
  useEffect(() => {
    void fetchMyOrders()
    const interval = window.setInterval(() => { void fetchMyOrders() }, studentSection === 'menu' ? 30_000 : 5_000)
    return () => window.clearInterval(interval)
  }, [studentSection, fetchMyOrders])

  const categories = ['Todos', 'Almuerzos', 'Bebidas', 'Snacks']
  const normalizedSearch = search.trim().toLocaleLowerCase('es')
  const filtered   = items.filter((item) =>
    (category === 'Todos' || item.category === category) &&
    item.available &&
    (!normalizedSearch || item.name.toLocaleLowerCase('es').includes(normalizedSearch))
  )
  const count      = Object.values(cart).reduce((a, b) => a + b, 0)
  const total      = items.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0)
  const pickupTimeSlots = getPickupTimeSlots(checkoutNow)
  const pickupDate = getBogotaDateString(checkoutNow)
  const selectedPickupTime = pickupTime && isValidPickupTime(pickupDate, Number(pickupTime), checkoutNow) ? pickupTime : ''
  const pickupTimeExpired = isAdvanceOrder && pickupTime !== '' && selectedPickupTime === ''
  const initials   = userName.substring(0, 2).toUpperCase()
  const firstName  = userName.split(' ')[0]
  const activeCount = myOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length
  const readyCount = myOrders.filter((order) => order.status === 'ready').length

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
          paymentMethod,
        }),
      })
      const responseBody = await response.text()
      let data: { url?: string; sessionId?: string; error?: string }
      try {
        data = JSON.parse(responseBody) as { url?: string; sessionId?: string; error?: string }
      } catch {
        throw new Error(`No se pudo iniciar el pago (HTTP ${response.status}). Inténtalo de nuevo.`)
      }
      if (!response.ok || !data.url || !data.sessionId) throw new Error(data.error ?? 'No se pudo iniciar el pago. Inténtalo de nuevo.')
      window.localStorage.setItem(pendingPaymentStorageKey, data.sessionId)
      window.location.assign(data.url)
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'No se pudo iniciar el pago. Inténtalo de nuevo.')
      setIsStartingPayment(false)
    }
  }

  const atStockLimit = (item: MenuItem) => item.stock !== null && (cart[item.id] ?? 0) >= item.stock

  const quantityControl = (item: MenuItem) => (
    <div className="quantity">
      <button aria-label={`Quitar una unidad de ${item.name}`} onClick={() => updateCartQuantity(item.id, cart[item.id] - 1)}>−</button>
      <b>{cart[item.id]}</b>
      <button
        aria-label={`Agregar una unidad de ${item.name}`}
        disabled={atStockLimit(item)}
        onClick={() => updateCartQuantity(item.id, cart[item.id] + 1)}
      >+</button>
    </div>
  )

  const showCartBar = studentSection === 'menu' && !isCheckout && count > 0

  return (
    <div className={`student-shell ${showCartBar ? 'has-cart-bar' : ''}`}>
      <header className="topbar">
        <Brand />
        <nav className="topbar-nav">
          <button className={studentSection === 'menu' && !isCheckout ? 'nav-active' : ''} onClick={() => goTo('menu')}>Menú de hoy</button>
          <button className={studentSection === 'orders' ? 'nav-active' : ''} onClick={() => goTo('orders')}>
            Mis pedidos {activeCount > 0 && <span className="nav-count">{activeCount}</span>}
          </button>
          <button className={studentSection === 'history' ? 'nav-active' : ''} onClick={() => goTo('history')}>Historial</button>
        </nav>
        <div className="top-actions">
          <NotificationBell onOpenOrders={() => goTo('orders')} />
          <button className="profile-chip" onClick={() => setShowAccount(true)} aria-label="Mi cuenta">
            <span>{initials}</span><span className="profile-name">{firstName}</span><ChevronRight size={15} className="profile-chevron" />
          </button>
        </div>
      </header>

      <AccountSheet
        open={showAccount}
        onClose={() => setShowAccount(false)}
        userName={userName}
        email={email}
        roleLabel="Estudiante"
        onLogout={onLogout}
        showNotifications
      />

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
                            {quantityControl(item)}
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

                  <section className="checkout-card payment-methods">
                    <div className="checkout-card-heading">
                      <div><h2>Medio de pago</h2><p>Elige cómo quieres pagar</p></div>
                      <CreditCard size={20} />
                    </div>
                    <div className="method-list" role="radiogroup" aria-label="Medio de pago">
                      {([
                        { id: 'card', label: 'Tarjeta', detail: 'Débito o crédito', icon: <CreditCard size={19} /> },
                        { id: 'wallet', label: 'Billetera digital', detail: 'Paga desde tu celular', icon: <Smartphone size={19} /> },
                        {
                          id: 'balance', label: 'Saldo institucional',
                          detail: balance == null ? 'Consultando saldo…' : balance >= total ? `Disponible: ${money(balance)}` : `Saldo insuficiente (${money(balance)})`,
                          icon: <Wallet size={19} />,
                        },
                      ] as const).map((method) => {
                        const disabled = method.id === 'balance' && (balance == null || balance < total)
                        const selected = paymentMethod === method.id
                        return (
                          <button
                            key={method.id}
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled}
                            className={`method-option ${selected ? 'method-selected' : ''}`}
                            onClick={() => { setPaymentMethod(method.id); setPaymentError('') }}
                          >
                            <span className="method-icon">{method.icon}</span>
                            <span className="method-copy"><strong>{method.label}</strong><small>{method.detail}</small></span>
                            <span className="method-radio">{selected && <Check size={13} />}</span>
                          </button>
                        )
                      })}
                    </div>
                    {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
                    <button
                      className="primary-button pay-button"
                      disabled={isStartingPayment || (isAdvanceOrder && !selectedPickupTime) || (paymentMethod === 'balance' && (balance ?? 0) < total)}
                      onClick={startPayment}
                    >
                      {isStartingPayment ? 'Preparando pago...' : `Pagar ${money(total)}`}
                    </button>
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
                <div><span>Saldo disponible</span><strong>{balance == null ? '—' : money(balance)}</strong></div>
                <button aria-label="Ver saldo"><ChevronRight size={17} /></button>
              </div>
            </section>

            {readyCount > 0 && (
              <button className="ready-banner" onClick={() => goTo('orders')}>
                <span className="ready-banner-icon"><BellRing size={18} /></span>
                <span>
                  <strong>{readyCount === 1 ? 'Tu pedido está listo' : `${readyCount} pedidos listos`}</strong>
                  <small>Recógelo en el mostrador</small>
                </span>
                <ChevronRight size={17} />
              </button>
            )}

            <div className="student-grid">
              <section className="menu-section">
                <div className="section-heading">
                  <div><h2>El menú de hoy</h2><p>Preparado fresco para ti</p></div>
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      aria-label="Buscar en el menú"
                      placeholder="Buscar"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </div>
                <div className="category-tabs">
                  {categories.map((name) => (
                    <button key={name} className={category === name ? 'tab-active' : ''} onClick={() => setCategory(name)}>{name}</button>
                  ))}
                </div>

                {loading ? (
                  <div className="loading-state"><RefreshCw size={20} className="spin" /><span>Cargando menú...</span></div>
                ) : filtered.length === 0 ? (
                  <p className="empty-chart">No encontramos productos{normalizedSearch ? ` para “${search.trim()}”` : ' en esta categoría'}.</p>
                ) : (
                  <div className="menu-grid">
                    {filtered.map((item) => (
                      <article className={`menu-card ${item.stock === 0 ? 'menu-card-soldout' : ''}`} key={item.id}>
                        <div className="food-art">
                          {iconNode(item.iconKey)}
                          {item.stock !== 0 && <span className="available-dot" />}
                        </div>
                        <div className="food-copy">
                          <span className="food-category">
                            {item.category}
                            {item.stock !== null && item.stock > 0 && item.stock <= 10 && (
                              <span className="stock-hint">Quedan {item.stock}</span>
                            )}
                          </span>
                          <h3>{item.name}</h3>
                          <div className="food-bottom">
                            <strong>{money(item.price)}</strong>
                            {item.stock === 0
                              ? <span className="soldout-pill">Agotado</span>
                              : cart[item.id]
                                ? quantityControl(item)
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
                              {quantityControl(item)}
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
              <button className="outline-button" onClick={() => { void fetchMyOrders() }} disabled={ordersLoading} aria-label="Actualizar pedidos">
                <RefreshCw size={14} className={ordersLoading ? 'spin' : ''} /> <span className="hide-xs">Actualizar</span>
              </button>
            </div>
            {studentSection === 'orders' && (
              <button className="notify-callout" onClick={() => setShowAccount(true)}>
                <BellRing size={17} />
                <span>Te avisamos por notificación o SMS cuando tu pedido esté listo. <b>Configurar avisos</b></span>
              </button>
            )}
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
                        <article className={`student-order-card ${order.status === 'ready' ? 'student-order-ready' : ''}`} key={order.id}>
                          <div className="student-order-heading">
                            <div>
                              <strong>Pedido #{order.id}</strong>
                              <span>{formatDateTime(order.createdAt)}</span>
                            </div>
                            <span className={`order-status-pill ${STATUS_CLASS[order.status] ?? 'status-prep'}`}>
                              {STATUS_LABEL[order.status] ?? order.status}
                            </span>
                          </div>
                          {order.status === 'ready' && (
                            <p className="ready-note"><BellRing size={14} /> ¡Listo! Recógelo en el mostrador.</p>
                          )}
                          {studentSection === 'orders' && order.status !== 'ready' && (
                            <ol className="order-steps" aria-label="Progreso del pedido">
                              {['pending', 'preparing', 'ready'].map((step, index) => {
                                const current = ['pending', 'preparing', 'ready'].indexOf(order.status)
                                return <li key={step} className={index <= current ? 'step-done' : ''}>{STATUS_LABEL[step]}</li>
                              })}
                            </ol>
                          )}
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

      {showCartBar && (
        <button className="cart-bar" onClick={() => { setIsCheckout(true); window.scrollTo({ top: 0 }) }}>
          <span className="cart-bar-count">{count}</span>
          <span className="cart-bar-copy">
            <strong>Ver mi pedido</strong>
            <small>{count} {count === 1 ? 'producto' : 'productos'}</small>
          </span>
          <strong className="cart-bar-total">{money(total)}</strong>
          <ChevronRight size={18} />
        </button>
      )}

      <nav className="tabbar" aria-label="Navegación principal">
        <button className={studentSection === 'menu' && !isCheckout ? 'tab-on' : ''} onClick={() => goTo('menu')}>
          <Coffee size={21} /><span>Menú</span>
        </button>
        <button className={studentSection === 'orders' ? 'tab-on' : ''} onClick={() => goTo('orders')}>
          <span className="tab-icon">
            <ShoppingBag size={21} />
            {activeCount > 0 && <span className={`tab-badge ${readyCount ? 'tab-badge-ready' : ''}`}>{activeCount}</span>}
          </span>
          <span>Mis pedidos</span>
        </button>
        <button className={studentSection === 'history' ? 'tab-on' : ''} onClick={() => goTo('history')}>
          <History size={21} /><span>Historial</span>
        </button>
      </nav>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// STAFF VIEW (administración y cocina)
// ══════════════════════════════════════════════════════════════════
type StaffSection = 'dashboard' | 'pedidos' | 'proyecciones' | 'menu' | 'historial' | 'historico' | 'reportes'
type StaffRole = 'admin' | 'kitchen'

const STAFF_NAV: { id: StaffSection; label: string; short: string; icon: React.ReactNode; roles: StaffRole[] }[] = [
  { id: 'dashboard',    label: 'Dashboard',           short: 'Inicio',     icon: <LayoutDashboard size={18} />, roles: ['admin'] },
  { id: 'proyecciones', label: 'Proyecciones',        short: 'Producción', icon: <Target size={18} />,          roles: ['kitchen'] },
  { id: 'pedidos',      label: 'Pedidos activos',     short: 'Pedidos',    icon: <ShoppingBag size={18} />,     roles: ['admin', 'kitchen'] },
  { id: 'proyecciones', label: 'Proyecciones',        short: 'Proyección', icon: <Target size={18} />,          roles: ['admin'] },
  { id: 'menu',         label: 'Menú y stock',        short: 'Menú',       icon: <Menu size={18} />,            roles: ['admin', 'kitchen'] },
  { id: 'historial',    label: 'Historial',           short: 'Historial',  icon: <FileText size={18} />,        roles: ['admin'] },
  { id: 'historico',    label: 'Histórico de datos',  short: 'Histórico',  icon: <Database size={18} />,        roles: ['admin', 'kitchen'] },
  { id: 'reportes',     label: 'Reportes',            short: 'Reportes',   icon: <BarChart3 size={18} />,       roles: ['admin'] },
]

const SECTION_TITLE: Record<StaffSection, string> = {
  dashboard: '',
  pedidos: 'Pedidos activos',
  proyecciones: 'Proyección de cocina',
  menu: 'Menú del día y stock',
  historial: 'Historial de pedidos',
  historico: 'Histórico de demanda',
  reportes: 'Reportes de operación',
}

function StaffView({ role, userName, email, onLogout }: { role: StaffRole; userName: string; email: string; onLogout: () => void }) {
  const isAdmin = role === 'admin'
  const navItems = STAFF_NAV.filter((item) => item.roles.includes(role))
  const [selected, setSelected] = useState<StaffSection>(isAdmin ? 'dashboard' : 'proyecciones')
  const [showAccount, setShowAccount] = useState(false)
  const [showMore, setShowMore] = useState(false)

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
  const [orderNotice, setOrderNotice] = useState('')

  // ── Modales ───────────────────────────────────────────────────
  const [editing, setEditing]     = useState<MenuItem | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const emptyItem = { name: '', category: 'Almuerzos', price: 4000, iconKey: 'sandwich', stock: null as number | null }
  const [newItem, setNewItem]     = useState(emptyItem)
  const [saving, setSaving]       = useState(false)
  const [menuError, setMenuError] = useState('')
  const [menuNotice, setMenuNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [stockSaving, setStockSaving] = useState<number | null>(null)

  const initials  = userName.substring(0, 2).toUpperCase()
  const firstName = userName.split(' ')[0]

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return
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
  }, [isAdmin])

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
        setOrdersError(`No se pudieron verificar ${failedReconciliations} pagos pendientes. Revisa los logs del servidor.`)
      }
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'No se pudieron cargar los pedidos.')
    } finally {
      setOrdersLoading(false)
    }
  }, [])

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

  const go = (section: StaffSection) => {
    setSelected(section)
    setShowMore(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveItem = async () => {
    setSaving(true)
    setFormError('')
    try {
      const response = editing
        ? await fetch(`/api/menu/${editing.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            name: editing.name, category: editing.category, price: editing.price,
            iconKey: editing.iconKey, available: editing.available, stock: editing.stock,
          }),
        })
        : await fetch('/api/menu', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(newItem),
        })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar el producto.')
      setMenuNotice(editing ? `${editing.name} actualizado.` : `${newItem.name} agregado al menú.`)
      setEditing(null); setShowAdd(false)
      setNewItem(emptyItem)
      fetchMenu()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (item: MenuItem) => {
    if (!window.confirm(`¿Eliminar "${item.name}" del menú?`)) return
    setMenuError('')
    setMenuNotice('')
    const response = await fetch(`/api/menu/${item.id}`, { method: 'DELETE' })
    const result = await response.json().catch(() => ({})) as { error?: string; message?: string }
    if (!response.ok) setMenuError(result.error ?? 'No se pudo eliminar el producto.')
    else setMenuNotice(result.message ?? `${item.name} eliminado del menú.`)
    fetchMenu()
  }

  // Cambios rápidos desde la lista: stock (+/−), agotar, reponer, disponibilidad.
  const patchItem = async (item: MenuItem, data: Partial<Pick<MenuItem, 'stock' | 'available'>>) => {
    setStockSaving(item.id)
    setMenuError('')
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...data } : entry))
    try {
      const response = await fetch(`/api/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo actualizar el producto.')
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'No se pudo actualizar el producto.')
      fetchMenu()
    } finally {
      setStockSaving(null)
    }
  }

  const openAdd = () => { setFormError(''); setShowAdd(true) }
  const openEdit = (item: MenuItem) => { setFormError(''); setEditing({ ...item }) }

  const updateOrderStatus = async (orderId: number, status: string) => {
    setUpdatingOrderId(orderId)
    setOrdersError('')
    setOrderNotice('')
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo actualizar el pedido.')
      if (status === 'ready') setOrderNotice(`Pedido #${orderId} listo. Se notificó al estudiante.`)
      await Promise.all([fetchOrders(), fetchStats()])
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'No se pudo actualizar el pedido.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const demandMax = useMemo(() => {
    if (!stats?.demand?.length) return 1
    return Math.max(...stats.demand.map((d) => d.qty), 1)
  }, [stats])

  const barColors = ['terracotta', 'sage', 'gold', 'blue', 'sage', 'terracotta']
  const activeOrders = orders.filter((order) => ['pending', 'preparing', 'ready'].includes(order.status))
  const historicalOrders = orders.filter((order) => ['delivered', 'cancelled'].includes(order.status))

  // Barra inferior móvil: hasta 4 accesos directos + "Más"
  const primaryNav = navItems.length > 5 ? navItems.slice(0, 4) : navItems
  const moreNav = navItems.length > 5 ? navItems.slice(4) : []
  const roleLabel = isAdmin ? 'Administrador' : 'Cocina'

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand />
        <div className="admin-profile">
          <span className="profile-avatar">{initials}</span>
          <div><strong>{userName}</strong><span>{roleLabel}</span></div>
        </div>
        <nav className="side-nav">
          <span className="side-label">{isAdmin ? 'GESTIÓN' : 'COCINA'}</span>
          {navItems.map((item) => (
            <button key={`${item.id}-${item.label}`} className={selected === item.id ? 'side-active' : ''} onClick={() => go(item.id)}>
              {item.icon} {item.label}
              {item.id === 'pedidos' && activeOrders.length > 0 && <span className="side-count">{activeOrders.length}</span>}
            </button>
          ))}
          <span className="side-label">CUENTA</span>
          <button onClick={onLogout} className="danger-link"><LogOut size={18} /> Cerrar sesión</button>
        </nav>
      </aside>

      <header className="staff-topbar">
        <Brand />
        <button className="profile-chip" onClick={() => setShowAccount(true)} aria-label="Mi cuenta">
          <span>{initials}</span>
        </button>
      </header>

      <AccountSheet
        open={showAccount}
        onClose={() => setShowAccount(false)}
        userName={userName}
        email={email}
        roleLabel={roleLabel}
        onLogout={onLogout}
        showNotifications={false}
      />

      <main className="admin-main">
        <header className="admin-top">
          <div>
            <p className="eyebrow">{isAdmin ? 'PANEL DE CONTROL' : 'COCINA'}</p>
            <h1>{selected === 'dashboard' ? `Buenos días, ${firstName}` : SECTION_TITLE[selected]}</h1>
          </div>
          <div className="live-pill">
            <span />
            {statsLoading || ordersLoading ? 'Actualizando...' : 'En vivo'}
            <button aria-label="Refrescar" onClick={() => { void fetchStats(); void fetchOrders() }} title="Refrescar datos">
              <RefreshCw size={16} className={statsLoading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* ── DASHBOARD ── */}
        {selected === 'dashboard' && isAdmin && (
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
                  <strong className="metric-money">{statsLoading ? '—' : money(stats?.revenueToday ?? 0)}</strong>
                  <small className="neutral">{stats?.availableItems ?? '—'} items disponibles</small>
                </div>
              </div>
            </section>

            <button className="projection-shortcut" onClick={() => go('proyecciones')}>
              <span className="metric-icon terracotta-bg"><ChefHat size={18} /></span>
              <span>
                <strong>Proyección de producción de hoy</strong>
                <small>Cuánto preparar por tipo de menú según histórico y pedidos anticipados</small>
              </span>
              <ChevronRight size={18} />
            </button>

            <section className="dashboard-grid">
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
                <button className="full-outline" onClick={() => go('pedidos')}>
                  Ver todos los pedidos <ChevronRight size={15} />
                </button>
              </div>
            </section>
          </>
        )}

        {/* ── PROYECCIONES (HU-06) ── */}
        {selected === 'proyecciones' && <ProjectionsPanel />}

        {/* ── HISTÓRICO DE DATOS (HU-09) ── */}
        {selected === 'historico' && <HistoryPanel canRebuild={isAdmin} />}

        {/* ── MENÚ ── */}
        {selected === 'menu' && (
          <section className="panel menu-admin-panel">
            <div className="panel-heading">
              <div><h2>Menú del día</h2><p>Platos, precios y unidades disponibles hoy. Los estudiantes lo ven al instante.</p></div>
              <button className="primary-button small" onClick={openAdd}>
                <Plus size={16} /> <span className="hide-xs">Agregar producto</span><span className="show-xs">Agregar</span>
              </button>
            </div>
            {menuError && <p className="orders-error" role="alert">{menuError}</p>}
            {menuNotice && <p className="payment-notice" role="status">{menuNotice}</p>}
            {menuLoading && items.length === 0
              ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando menú...</span></div>
              : items.length === 0
                ? <p className="empty-chart">Aún no hay productos. Agrega el almuerzo del día.</p>
                : (
                <div className="admin-menu-list">
                  {items.map((item) => {
                    const soldOut = item.stock === 0
                    const status = !item.available ? 'Oculto' : soldOut ? 'Agotado' : item.stock === null ? 'Sin límite' : `${item.stock} ${item.stock === 1 ? 'disponible' : 'disponibles'}`
                    return (
                      <div className={`admin-menu-row ${!item.available ? 'menu-row-hidden' : ''}`} key={item.id}>
                        <div className="admin-menu-main">
                          <span className="admin-food-emoji">{iconNode(item.iconKey)}</span>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.category} · {money(item.price)}</span>
                            <span className={`availability ${!item.available || soldOut ? 'availability-off' : ''}`}>
                              <i />{status}
                            </span>
                          </div>
                          <button onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}>
                            <Pencil size={17} />
                          </button>
                          <button onClick={() => { void removeItem(item) }} aria-label={`Eliminar ${item.name}`}>
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="stock-controls">
                          {item.stock === null ? (
                            <button className="outline-button" onClick={() => { void patchItem(item, { stock: 20 }) }}>
                              Controlar stock
                            </button>
                          ) : (
                            <div className="quantity stock-stepper" aria-label={`Stock de ${item.name}`}>
                              <button aria-label="Restar una unidad" disabled={item.stock <= 0 || stockSaving === item.id}
                                onClick={() => { void patchItem(item, { stock: Math.max(0, (item.stock ?? 0) - 1) }) }}>−</button>
                              <b>{item.stock}</b>
                              <button aria-label="Sumar una unidad" disabled={stockSaving === item.id}
                                onClick={() => { void patchItem(item, { stock: (item.stock ?? 0) + 1 }) }}>+</button>
                            </div>
                          )}
                          {item.stock !== null && item.stock > 0 && (
                            <button className="outline-button" onClick={() => { void patchItem(item, { stock: 0 }) }}>Agotar</button>
                          )}
                          {item.stock !== null && (
                            <button className="outline-button" onClick={() => { void patchItem(item, { stock: null }) }}>Sin límite</button>
                          )}
                          <button className="outline-button" onClick={() => { void patchItem(item, { available: !item.available }) }}>
                            {item.available ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
          </section>
        )}

        {/* ── PEDIDOS ── */}
        {selected === 'pedidos' && (
          <section className="panel orders-panel">
            <div className="panel-heading">
              <div><h2>Pedidos por gestionar</h2><p>{activeOrders.length} activos · al marcar “listo” se avisa al estudiante</p></div>
              <button className="outline-button" onClick={() => { void fetchOrders() }} disabled={ordersLoading} aria-label="Actualizar pedidos">
                <RefreshCw size={14} className={ordersLoading ? 'spin' : ''} /> <span className="hide-xs">Actualizar</span>
              </button>
            </div>
            {ordersError && <p className="orders-error" role="alert">{ordersError}</p>}
            {orderNotice && <p className="payment-notice" role="status"><BellRing size={13} /> {orderNotice}</p>}
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
                        <span className="row-total">{money(order.total)}</span>
                        <span className={`order-status-pill ${STATUS_CLASS[order.status] ?? 'status-prep'}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                        <span className="row-actions">
                          {order.status === 'pending' && (
                            <button className="order-action-button" disabled={updatingOrderId === order.id} onClick={() => { void updateOrderStatus(order.id, 'preparing') }}>
                              {updatingOrderId === order.id ? 'Guardando...' : 'Iniciar preparación'}
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button className="order-action-button" disabled={updatingOrderId === order.id} onClick={() => { void updateOrderStatus(order.id, 'ready') }}>
                              {updatingOrderId === order.id ? 'Guardando...' : 'Marcar listo y avisar'}
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button className="order-action-button" disabled={updatingOrderId === order.id} onClick={() => { void updateOrderStatus(order.id, 'delivered') }}>
                              {updatingOrderId === order.id ? 'Guardando...' : 'Marcar entregado'}
                            </button>
                          )}
                          {isAdmin && ['pending', 'preparing', 'ready'].includes(order.status) && (
                            <button
                              className="order-action-button order-cancel-button"
                              disabled={updatingOrderId === order.id}
                              title="El administrador puede cancelar este pedido en cualquier momento."
                              onClick={() => { void updateOrderStatus(order.id, 'cancelled') }}
                            >
                              {updatingOrderId === order.id ? 'Guardando...' : 'Cancelar pedido'}
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
          </section>
        )}

        {selected === 'historial' && isAdmin && (
          <section className="panel orders-panel">
            <div className="panel-heading">
              <div>
                <h2>Historial de pedidos</h2>
                <p>{historicalOrders.length} pedidos entregados o cancelados</p>
              </div>
              <button className="outline-button" onClick={() => { void fetchOrders() }} disabled={ordersLoading} aria-label="Actualizar historial">
                <RefreshCw size={14} className={ordersLoading ? 'spin' : ''} /> <span className="hide-xs">Actualizar</span>
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
                        <span className="row-total">{money(order.total)}</span>
                        <span className={`order-status-pill ${STATUS_CLASS[order.status] ?? 'status-prep'}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                        <span className="row-date">{formatDateTime(order.createdAt, 'short')}</span>
                      </div>
                    ))}
                  </div>
                )}
          </section>
        )}

        {/* ── REPORTES ── */}
        {selected === 'reportes' && isAdmin && (
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
                <strong className="metric-money">{money(stats?.revenueToday ?? 0)}</strong>
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

        {/* ── Hoja agregar / editar ── */}
        <Sheet
          open={Boolean(showAdd || editing)}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          eyebrow={editing ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}
          title={editing ? 'Actualizar menú' : 'Agregar al menú'}
          className="form-sheet"
        >
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
              inputMode="numeric"
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
            >
              <option value="salad">🥗 Bowl / Ensalada</option>
              <option value="sandwich">🥪 Sándwich / Wrap</option>
              <option value="coffee">☕ Café</option>
              <option value="cookie">🍪 Snack / Galleta</option>
              <option value="cupsoda">🥤 Bebida fría</option>
            </select>
          </label>

          <label>
            Unidades disponibles hoy
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Vacío = sin límite"
              value={(editing ? editing.stock : newItem.stock) ?? ''}
              onChange={(e) => {
                const stock = e.target.value === '' ? null : Math.max(0, Math.trunc(Number(e.target.value)))
                if (editing) setEditing({ ...editing, stock })
                else setNewItem({ ...newItem, stock })
              }}
            />
            <small className="field-hint">Se descuenta solo con cada pedido pagado y vuelve si el pedido se cancela.</small>
          </label>

          {formError && <p className="form-error" role="alert">{formError}</p>}

          {editing && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editing.available}
                onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
              />
              Disponible en el menú
            </label>
          )}

          <div className="modal-actions">
            <button className="outline-button" onClick={() => { setShowAdd(false); setEditing(null) }}>
              Cancelar
            </button>
            <button className="primary-button" onClick={saveItem} disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar al menú'}
            </button>
          </div>
        </Sheet>
      </main>

      {/* ── Barra inferior móvil ── */}
      <nav className="tabbar" aria-label="Navegación del panel">
        {primaryNav.map((item) => (
          <button key={`${item.id}-${item.short}`} className={selected === item.id ? 'tab-on' : ''} onClick={() => go(item.id)}>
            <span className="tab-icon">
              {item.id === 'dashboard' ? <House size={21} /> : item.icon}
              {item.id === 'pedidos' && activeOrders.length > 0 && <span className="tab-badge">{activeOrders.length}</span>}
            </span>
            <span>{item.short}</span>
          </button>
        ))}
        {moreNav.length > 0 && (
          <button className={moreNav.some((item) => item.id === selected) ? 'tab-on' : ''} onClick={() => setShowMore(true)}>
            <Ellipsis size={21} /><span>Más</span>
          </button>
        )}
      </nav>

      <Sheet open={showMore} onClose={() => setShowMore(false)} eyebrow="PANEL" title="Más opciones" className="more-sheet">
        <div className="more-list">
          {moreNav.map((item) => (
            <button key={`${item.id}-more`} className={selected === item.id ? 'side-active' : ''} onClick={() => go(item.id)}>
              {item.icon} {item.label} <ChevronRight size={16} />
            </button>
          ))}
          <button className="danger-link" onClick={onLogout}><LogOut size={18} /> Cerrar sesión</button>
        </div>
      </Sheet>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════
export default function CafeApp({
  role, userName, email, onLogout,
}: {
  role: 'admin' | 'kitchen' | 'student'; userName: string; email: string; onLogout: () => void
}) {
  return role === 'admin' || role === 'kitchen'
    ? <StaffView role={role} userName={userName} email={email} onLogout={onLogout} />
    : <StudentView userName={userName} email={email} onLogout={onLogout} />
}
