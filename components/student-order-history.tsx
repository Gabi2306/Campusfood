'use client'

// HU-11 — Historial de pedidos del estudiante con filtros por fecha (desde / hasta) y estado (entregado / cancelado).
import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Clock3, Filter, RefreshCw, ShoppingBag, X } from 'lucide-react'
import { formatDateTime, formatPickupAt, money, STATUS_CLASS, STATUS_LABEL, type OrderRecord } from '@/components/shared'
import {
  EMPTY_HISTORY_FILTERS,
  HISTORY_LIMIT,
  HISTORY_STATUS_OPTIONS,
  hasActiveHistoryFilters,
  historyFiltersToQuery,
  type HistoryFilters,
  type HistoryStatusFilter,
} from '@/lib/order-history-filters'
import { getBogotaDateString } from '@/lib/business-date'

function OrderCard({ order }: { order: OrderRecord }) {
  return (
    <article className="student-order-card">
      <div className="student-order-heading">
        <div>
          <strong>Pedido #{order.id}</strong>
          <span>{formatDateTime(order.createdAt)}</span>
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
    </article>
  )
}

export default function StudentOrderHistory() {
  const [orders, setOrders]   = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS)
  const today = getBogotaDateString(new Date())
  const rangeError = filters.from && filters.to && filters.from > filters.to
    ? 'La fecha "desde" no puede ser posterior a la fecha "hasta".'
    : ''

  const load = useCallback(async (current: HistoryFilters) => {
    setLoading(true)
    setError('')
    try {
      const query = historyFiltersToQuery(current)
      const res = await fetch(`/api/orders?history=1${query ? `&${query}` : ''}`, { cache: 'no-store' })
      const data = await res.json() as OrderRecord[] | { error?: string }
      if (!res.ok || !Array.isArray(data)) {
        throw new Error(!Array.isArray(data) && data.error ? data.error : 'No se pudo cargar el historial.')
      }
      setOrders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Cada cambio de filtro vuelve a consultar el servidor (si el rango de fechas es válido).
  useEffect(() => {
    if (rangeError) return
    void load(filters)
  }, [filters, rangeError, load])

  const setStatus = (status: HistoryStatusFilter) => setFilters((prev) => ({ ...prev, status }))
  const setFrom = (value: string) => setFilters((prev) => ({ ...prev, from: value || null }))
  const setTo = (value: string) => setFilters((prev) => ({ ...prev, to: value || null }))
  const filtersActive = hasActiveHistoryFilters(filters)

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">PEDIDOS ANTERIORES</p>
          <h1>Historial de pedidos</h1>
          <p>Consulta los pedidos entregados o cancelados.</p>
        </div>
        <button
          className="outline-button"
          onClick={() => { void load(filters) }}
          disabled={loading || Boolean(rangeError)}
          aria-label="Actualizar historial"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> <span className="hide-xs">Actualizar</span>
        </button>
      </div>

      <form className="history-filters" role="search" aria-label="Filtrar historial" onSubmit={(e) => e.preventDefault()}>
        <div className="history-filter-title"><Filter size={14} /> Filtrar</div>
        <div className="history-status-chips" role="group" aria-label="Estado del pedido">
          {HISTORY_STATUS_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`history-chip ${filters.status === option.value ? 'history-chip-on' : ''}`}
              aria-pressed={filters.status === option.value}
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="history-dates">
          <label>
            <span>Desde</span>
            <input type="date" value={filters.from ?? ''} max={filters.to ?? today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={filters.to ?? ''} min={filters.from ?? undefined} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
          {filtersActive && (
            <button type="button" className="text-button history-clear" onClick={() => setFilters(EMPTY_HISTORY_FILTERS)}>
              <X size={13} /> Limpiar filtros
            </button>
          )}
        </div>
      </form>

      {rangeError && <p className="orders-error" role="alert">{rangeError}</p>}
      {error && !rangeError && (
        <p className="orders-error" role="alert">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {loading && orders.length === 0 ? (
        <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando historial...</span></div>
      ) : orders.length === 0 ? (
        <div className="student-history-empty">
          <div className="empty-icon"><ShoppingBag size={27} /></div>
          <p>{filtersActive ? 'Ningún pedido coincide con los filtros' : 'Aún no tienes pedidos en tu historial'}</p>
          <span>{filtersActive ? 'Prueba con otras fechas u otro estado.' : 'Aquí aparecerán los pedidos entregados y cancelados.'}</span>
        </div>
      ) : (
        <>
          <p className="history-count" role="status">
            {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
            {filtersActive ? ' con los filtros aplicados' : ' en tu historial'}
            {orders.length >= HISTORY_LIMIT ? ` (se muestran los ${HISTORY_LIMIT} más recientes)` : ''}
          </p>
          <div className="student-orders-list">
            {orders.map((order) => <OrderCard key={order.id} order={order} />)}
          </div>
        </>
      )}
    </>
  )
}
