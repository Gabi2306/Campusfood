'use client'

// HU-09 — Histórico de datos que alimenta el módulo de proyección.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Database, Download, RefreshCw } from 'lucide-react'
import { CATEGORY_COLOR, formatShortDate, percent } from '@/components/shared'

type DaySummary = {
  date: string; weekday: number; total: number; advance: number; cancelled: number
  produced: number | null; wasted: number | null; byCategory: Record<string, number>
}
type ItemSummary = {
  menuItemId: number; itemName: string; category: string; days: number
  quantityOrdered: number; quantityAdvance: number; quantityCancelled: number
  produced: number; wasted: number; avgPerDay: number; wasteRate: number | null
}
type History = {
  from: string; to: string; operatingDays: number
  totals: {
    quantityOrdered: number; quantityAdvance: number; quantityCancelled: number
    produced: number; wasted: number; avgPerDay: number; wasteRate: number | null
  }
  days: DaySummary[]
  items: ItemSummary[]
}

const RANGES = [14, 30, 60, 90]
const CATEGORIES = ['Almuerzos', 'Bebidas', 'Snacks']
const WEEKDAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

const bogotaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const shiftDate = (date: string, days: number) =>
  new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)

export default function HistoryPanel({ canRebuild }: { canRebuild: boolean }) {
  const [range, setRange] = useState(30)
  const [category, setCategory] = useState('')
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const query = useMemo(() => {
    const to = bogotaToday()
    const params = new URLSearchParams({ from: shiftDate(to, -(range - 1)), to })
    if (category) params.set('category', category)
    return params.toString()
  }, [range, category])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/history?${query}`, { cache: 'no-store' })
      const result = await response.json() as History & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo cargar el histórico.')
      setHistory(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el histórico.')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { void load() }, [load])

  const rebuild = async () => {
    setRebuilding(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 }),
      })
      const result = await response.json() as { syncedDates?: string[]; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo recalcular.')
      setNotice(`Histórico recalculado a partir de los pedidos: ${result.syncedDates?.length ?? 0} días con operación.`)
      await load()
    } catch (rebuildError) {
      setError(rebuildError instanceof Error ? rebuildError.message : 'No se pudo recalcular.')
    } finally {
      setRebuilding(false)
    }
  }

  const maxDay = Math.max(1, ...(history?.days.map((day) => day.total) ?? [1]))
  const visibleCategories = category ? [category] : CATEGORIES

  return (
    <section className="history-view">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Histórico de demanda</h2>
            <p>Datos diarios por producto que alimentan la proyección de cocina.</p>
          </div>
          <span className="metric-icon sage-bg" aria-hidden><Database size={18} /></span>
        </div>

        <div className="filter-row">
          <div className="segmented" role="tablist" aria-label="Rango de días">
            {RANGES.map((days) => (
              <button
                key={days}
                role="tab"
                aria-selected={range === days}
                className={range === days ? 'segmented-active' : ''}
                onClick={() => setRange(days)}
              >{days} d</button>
            ))}
          </div>
          <select className="select-input" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Tipo de menú">
            <option value="">Todos los tipos</option>
            {CATEGORIES.map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>

        <div className="filter-actions">
          <a className="outline-button" href={`/api/history?${query}&format=csv`} download>
            <Download size={14} /> Exportar CSV
          </a>
          {canRebuild && (
            <button className="outline-button" onClick={() => { void rebuild() }} disabled={rebuilding}>
              <RefreshCw size={14} className={rebuilding ? 'spin' : ''} /> {rebuilding ? 'Recalculando...' : 'Recalcular desde pedidos'}
            </button>
          )}
        </div>

        {error && <div className="admin-error"><AlertCircle size={15} /> {error}</div>}
        {notice && <p className="payment-notice">{notice}</p>}

        {history && (
          <div className="projection-kpis">
            <div className="kpi">
              <span>Días con operación</span>
              <strong>{history.operatingDays}</strong>
              <small>de {range} días</small>
            </div>
            <div className="kpi">
              <span>Unidades pedidas</span>
              <strong>{history.totals.quantityOrdered.toLocaleString('es-CO')}</strong>
              <small>{history.totals.quantityAdvance.toLocaleString('es-CO')} anticipadas</small>
            </div>
            <div className="kpi">
              <span>Promedio diario</span>
              <strong>{history.totals.avgPerDay.toLocaleString('es-CO')}</strong>
              <small>unidades / día</small>
            </div>
            <div className="kpi">
              <span>Sobrante</span>
              <strong>{percent(history.totals.wasteRate)}</strong>
              <small>{history.totals.wasted.toLocaleString('es-CO')} de {history.totals.produced.toLocaleString('es-CO')} producidas</small>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div><h2>Unidades por día</h2><p>Por tipo de menú</p></div>
        </div>
        {loading && !history
          ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando histórico...</span></div>
          : !history?.days.length
            ? <p className="empty-chart">Aún no hay datos en este rango. El histórico se construye automáticamente con cada día de pedidos.</p>
            : (
              <>
                <div className="day-chart" role="img" aria-label={`Unidades pedidas por día entre ${history.from} y ${history.to}`}>
                  {history.days.map((day) => (
                    <div className="day-col" key={day.date} title={`${formatShortDate(day.date)}: ${day.total} uds.`}>
                      <div className="day-stack" style={{ height: `${(day.total / maxDay) * 100}%` }}>
                        {visibleCategories.map((name) => {
                          const value = day.byCategory[name] ?? 0
                          if (!value || !day.total) return null
                          return <span key={name} className={CATEGORY_COLOR[name] ?? 'blue'} style={{ flexGrow: value }} />
                        })}
                      </div>
                      <small>{WEEKDAY_SHORT[day.weekday]}</small>
                    </div>
                  ))}
                </div>
                <div className="chart-footer">
                  <span className="chart-legend">
                    {visibleCategories.map((name) => (
                      <span key={name}><i className={`legend-dot ${CATEGORY_COLOR[name]}`} />{name}</span>
                    ))}
                  </span>
                  <span>{formatShortDate(history.from)} – {formatShortDate(history.to)}</span>
                </div>
              </>
            )}
      </div>

      {history && history.items.length > 0 && (
        <div className="panel">
          <div className="panel-heading">
            <div><h2>Por producto</h2><p>Totales del periodo</p></div>
          </div>
          <div className="order-table">
            <div className="table-head history-item-head">
              <span>PRODUCTO</span><span>PEDIDAS</span><span>PROM./DÍA</span><span>ANTICIP.</span><span>CANCEL.</span><span>SOBRANTE</span>
            </div>
            {history.items.map((item) => (
              <div className="table-row history-item-row" key={item.menuItemId}>
                <span>
                  <strong>{item.itemName}</strong>
                  <small><i className={`legend-dot ${CATEGORY_COLOR[item.category] ?? 'blue'}`} />{item.category}</small>
                </span>
                <span data-label="Pedidas">{item.quantityOrdered.toLocaleString('es-CO')}</span>
                <span data-label="Prom./día">{item.avgPerDay.toLocaleString('es-CO')}</span>
                <span data-label="Anticipadas">{item.quantityAdvance.toLocaleString('es-CO')}</span>
                <span data-label="Canceladas">{item.quantityCancelled.toLocaleString('es-CO')}</span>
                <span data-label="Sobrante">{percent(item.wasteRate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
