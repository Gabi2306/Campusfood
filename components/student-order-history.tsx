'use client'

// RF-12 — Historial de pedidos del estudiante.
import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Clock3, RefreshCw, ShoppingBag } from 'lucide-react'
import { formatDateTime, formatPickupAt, money, STATUS_CLASS, STATUS_LABEL, type OrderRecord } from '@/components/shared'

const STATUS_ICONS: Record<string, string> = {
  pending:   '🕐',
  preparing: '👨‍🍳',
  ready:     '✅',
  delivered: '🎉',
  cancelled: '❌',
}

function OrderCard({ order }: { order: OrderRecord }) {
  const statusClass = STATUS_CLASS[order.status] ?? 'status-prep'
  const statusLabel = STATUS_LABEL[order.status] ?? order.status

  return (
    <article className="student-order-card">
      <div className="student-order-header">
        <div className="student-order-meta">
          <span className="student-order-id">Pedido #{order.id}</span>
          <span className="student-order-date">
            <Clock3 size={11} /> {formatDateTime(order.createdAt, 'short')}
          </span>
        </div>
        <span className={`${statusClass} student-order-status`}>
          {STATUS_ICONS[order.status]} {statusLabel}
        </span>
      </div>

      <div className="student-order-items">
        {order.items.map((item, i) => (
          <div className="student-order-item-row" key={i}>
            <span>{item.quantity}×</span>
            <span>{item.menuItem.name}</span>
          </div>
        ))}
      </div>

      <div className="student-order-footer">
        {order.pickupAt && (
          <span className="student-order-pickup">
            🕐 Recogida a las {formatPickupAt(order.pickupAt)}
          </span>
        )}
        <strong className="student-order-total">{money(order.total)}</strong>
      </div>
    </article>
  )
}

export default function StudentOrderHistory() {
  const [orders, setOrders]   = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' })
      const data = await res.json() as OrderRecord[] | { error?: string }
      if (!res.ok || !Array.isArray(data)) throw new Error(!Array.isArray(data) ? data.error : undefined)
      // Solo muestra pedidos finalizados (entregados o cancelados) en el historial
      setOrders(data.filter((o) => ['delivered', 'cancelled'].includes(o.status)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="loading-state">
        <RefreshCw size={18} className="spin" />
        <span>Cargando historial...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-error">
        <AlertCircle size={15} /> {error}{' '}
        <button onClick={() => { void load() }}>Reintentar</button>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="student-history-empty">
        <div className="empty-icon"><ShoppingBag size={27} /></div>
        <p>Aún no tienes pedidos en tu historial</p>
        <span>Aquí aparecerán los pedidos entregados y cancelados.</span>
      </div>
    )
  }

  return (
    <section className="student-history-view">
      <div className="student-history-header">
        <div>
          <h2>Mis pedidos anteriores</h2>
          <p className="subtext">{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} en tu historial</p>
        </div>
        <button className="outline-button" onClick={() => { void load() }} aria-label="Refrescar">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
      <div className="student-history-list">
        {orders.map((order) => <OrderCard key={order.id} order={order} />)}
      </div>
    </section>
  )
}
