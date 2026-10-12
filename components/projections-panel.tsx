'use client'

// HU-06 — Proyecciones diarias por tipo de menú para el personal de cocina.
import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, CalendarDays, ChefHat, ClipboardList, Info, Leaf, RefreshCw, Target,
} from 'lucide-react'
import { CATEGORY_COLOR, FoodIcon, percent } from '@/components/shared'

type Confidence = 'alta' | 'media' | 'baja'
type ItemProjection = {
  menuItemId: number; name: string; category: string; iconKey: string
  confirmed: number; advance: number; baseline: number; trend: number
  expected: number; recommended: number; low: number; high: number
  samples: number; basis: string; confidence: Confidence; wasteRate: number | null
}
type CategoryProjection = {
  category: string; confirmed: number; advance: number; expected: number; recommended: number
  wasteRate: number | null; confidence: Confidence; items: ItemProjection[]
}
type Projection = {
  date: string; isToday: boolean; weekdayLabel: string; generatedAt: string; historyDays: number
  totals: { confirmed: number; advance: number; expected: number; recommended: number }
  categories: CategoryProjection[]
}

type ProductionDraft = Record<number, { produced: string; wasted: string }>

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  alta: 'status-ready', media: 'status-prep', baja: 'status-cancelled',
}

export default function ProjectionsPanel() {
  const [day, setDay] = useState<'today' | 'tomorrow'>('today')
  const [projection, setProjection] = useState<Projection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<ProductionDraft>({})
  const [savingProduction, setSavingProduction] = useState(false)
  const [productionMessage, setProductionMessage] = useState('')
  const [productionError, setProductionError] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
      const date = day === 'today'
        ? today
        : new Date(new Date(`${today}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
      const response = await fetch(`/api/projections?date=${date}`, { cache: 'no-store' })
      const result = await response.json() as Projection & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo cargar la proyección.')
      setProjection(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la proyección.')
    } finally {
      setLoading(false)
    }
  }, [day])

  useEffect(() => {
    void load()
    // Los pedidos anticipados llegan durante la mañana: la proyección se refresca sola.
    const interval = window.setInterval(() => { void load(true) }, 60_000)
    return () => window.clearInterval(interval)
  }, [load])

  const saveProduction = async () => {
    if (!projection) return
    const entries = Object.entries(draft)
      .filter(([, value]) => value.produced !== '' || value.wasted !== '')
      .map(([menuItemId, value]) => ({
        menuItemId: Number(menuItemId),
        produced: value.produced === '' ? null : Number(value.produced),
        wasted: value.wasted === '' ? null : Number(value.wasted),
      }))
    if (!entries.length) {
      setProductionError('Escribe al menos una cantidad producida o sobrante.')
      return
    }
    setSavingProduction(true)
    setProductionError('')
    setProductionMessage('')
    try {
      const response = await fetch('/api/history/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: projection.date, entries }),
      })
      const result = await response.json() as { saved?: number; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar la producción.')
      setProductionMessage(`Producción registrada para ${result.saved} productos. Se usará para ajustar las próximas proyecciones.`)
      setDraft({})
    } catch (saveError) {
      setProductionError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la producción.')
    } finally {
      setSavingProduction(false)
    }
  }

  const updateDraft = (id: number, field: 'produced' | 'wasted', value: string) => {
    if (value !== '' && !/^\d{1,4}$/.test(value)) return
    setDraft((current) => ({ ...current, [id]: { ...(current[id] ?? { produced: '', wasted: '' }), [field]: value } }))
  }

  const allItems = projection?.categories.flatMap((category) => category.items) ?? []
  const updatedAt = projection
    ? new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' }).format(new Date(projection.generatedAt))
    : null

  return (
    <section className="projection-view">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Proyección de producción</h2>
            <p>
              {projection
                ? `${projection.isToday ? 'Hoy' : 'Mañana'}, ${projection.weekdayLabel} · actualizado ${updatedAt}`
                : 'Basada en el histórico y en los pedidos anticipados'}
            </p>
          </div>
          <button className="icon-button refresh-button" aria-label="Actualizar proyección" onClick={() => { void load() }} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'spin' : ''} />
          </button>
        </div>

        <div className="segmented" role="tablist" aria-label="Día a proyectar">
          <button role="tab" aria-selected={day === 'today'} className={day === 'today' ? 'segmented-active' : ''} onClick={() => setDay('today')}>Hoy</button>
          <button role="tab" aria-selected={day === 'tomorrow'} className={day === 'tomorrow' ? 'segmented-active' : ''} onClick={() => setDay('tomorrow')}>Mañana</button>
        </div>

        {error && <div className="admin-error"><AlertCircle size={15} /> {error}</div>}

        {projection && (
          <div className="projection-kpis">
            <div className="kpi kpi-accent">
              <span><Target size={15} /> Producir</span>
              <strong>{projection.totals.recommended}</strong>
              <small>unidades sugeridas</small>
            </div>
            <div className="kpi">
              <span><ClipboardList size={15} /> Confirmados</span>
              <strong>{projection.totals.confirmed}</strong>
              <small>{projection.totals.advance} anticipados</small>
            </div>
            <div className="kpi">
              <span><ChefHat size={15} /> Esperados</span>
              <strong>{projection.totals.expected}</strong>
              <small>sin margen</small>
            </div>
            <div className="kpi">
              <span><CalendarDays size={15} /> Histórico</span>
              <strong>{projection.historyDays}</strong>
              <small>días analizados</small>
            </div>
          </div>
        )}

        <details className="method-note">
          <summary><Info size={14} /> ¿Cómo se calcula?</summary>
          <p>
            Promedio ponderado de lo pedido el mismo día de la semana en las últimas 8 semanas (las más
            recientes pesan más), ajustado por la tendencia de los últimos 7 días. Nunca queda por debajo de
            los pedidos ya pagados. Se suma un margen de seguridad pequeño, que se elimina si el producto
            tuvo más de 15 % de sobrante en las últimas dos semanas.
          </p>
        </details>
      </div>

      {loading && !projection && (
        <div className="panel"><div className="loading-state"><RefreshCw size={18} className="spin" /><span>Calculando proyección...</span></div></div>
      )}

      {projection && projection.categories.length === 0 && (
        <div className="panel"><p className="empty-chart">No hay productos disponibles en el menú para proyectar.</p></div>
      )}

      <div className="projection-grid">
        {projection?.categories.map((category) => {
          const progress = category.recommended ? Math.min(100, (category.confirmed / category.recommended) * 100) : 0
          return (
            <article className="panel projection-card" key={category.category}>
              <div className="projection-card-head">
                <div>
                  <span className={`legend-dot ${CATEGORY_COLOR[category.category] ?? 'blue'}`} />
                  <h3>{category.category}</h3>
                </div>
                <span className={`order-status-pill ${CONFIDENCE_CLASS[category.confidence]}`}>Confianza {category.confidence}</span>
              </div>

              <div className="projection-figure">
                <strong>{category.recommended}</strong>
                <span>unidades a preparar</span>
              </div>

              <div className="progress-track" aria-label={`${category.confirmed} de ${category.recommended} ya confirmadas`}>
                <div className={`progress-fill ${CATEGORY_COLOR[category.category] ?? 'blue'}`} style={{ width: `${progress}%` }} />
              </div>
              <div className="projection-meta">
                <span><b>{category.confirmed}</b> confirmadas</span>
                <span><Leaf size={12} /> Sobrante 14 d: <b>{percent(category.wasteRate)}</b></span>
              </div>

              <ul className="projection-items">
                {category.items.map((item) => (
                  <li key={item.menuItemId}>
                    <span className="projection-item-icon"><FoodIcon iconKey={item.iconKey} size={20} /></span>
                    <div className="projection-item-copy">
                      <strong>{item.name}</strong>
                      <small>
                        {item.confirmed} conf. · rango {item.low}–{item.high} · {item.basis}
                        {item.trend !== 1 && ` · tendencia ${item.trend > 1 ? '+' : ''}${Math.round((item.trend - 1) * 100)} %`}
                      </small>
                    </div>
                    <b className="projection-item-total">{item.recommended}</b>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      {projection?.isToday && allItems.length > 0 && (
        <div className="panel production-log">
          <div className="panel-heading">
            <div>
              <h2>Registrar producción del día</h2>
              <p>Al cierre, anota lo preparado y lo que sobró. Así mejora la proyección y medimos el desperdicio.</p>
            </div>
          </div>
          <div className="production-rows">
            <div className="production-head" aria-hidden>
              <span>Producto</span><span>Producido</span><span>Sobrante</span>
            </div>
            {allItems.map((item) => (
              <div className="production-row" key={item.menuItemId}>
                <span className="production-name">{item.name}</span>
                <label>
                  <span>Producido</span>
                  <input
                    inputMode="numeric"
                    placeholder={String(item.recommended)}
                    value={draft[item.menuItemId]?.produced ?? ''}
                    onChange={(event) => updateDraft(item.menuItemId, 'produced', event.target.value)}
                    aria-label={`Unidades producidas de ${item.name}`}
                  />
                </label>
                <label>
                  <span>Sobrante</span>
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    value={draft[item.menuItemId]?.wasted ?? ''}
                    onChange={(event) => updateDraft(item.menuItemId, 'wasted', event.target.value)}
                    aria-label={`Unidades sobrantes de ${item.name}`}
                  />
                </label>
              </div>
            ))}
          </div>
          {productionError && <p className="orders-error" role="alert">{productionError}</p>}
          {productionMessage && <p className="payment-notice">{productionMessage}</p>}
          <button className="primary-button block-button" onClick={() => { void saveProduction() }} disabled={savingProduction}>
            {savingProduction ? 'Guardando...' : 'Guardar producción'}
          </button>
        </div>
      )}
    </section>
  )
}
