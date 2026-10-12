'use client'

import { useEffect } from 'react'
import { Coffee, CupSoda, Cookie, Salad, Sandwich, X } from 'lucide-react'

// ── Tipos compartidos ────────────────────────────────────────────
export type MenuItem = {
  id: number; name: string; category: string; price: number
  iconKey: string; available: boolean
  stock: number | null // unidades disponibles hoy; null = sin límite
}

export type OrderRecord = {
  id: number
  total: number
  status: string
  createdAt: string
  pickupAt: string | null
  readyAt?: string | null
  user: { name: string; email: string }
  items: { quantity: number; menuItem: { name: string } }[]
}

// ── Formato ──────────────────────────────────────────────────────
export const money = (v: number) => `$${v.toLocaleString('es-CO')}`

export const formatPickupAt = (value: string) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(value))

export const formatDateTime = (value: string, style: 'short' | 'medium' = 'medium') => new Intl.DateTimeFormat('es-CO', {
  dateStyle: style, timeStyle: 'short', timeZone: 'America/Bogota',
}).format(new Date(value))

export const formatShortDate = (date: string) => new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00Z`))

export const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${(value * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`

export function timeAgo(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'hace un momento'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return formatDateTime(value, 'short')
}

// ── Iconos del menú ──────────────────────────────────────────────
const ICON_COLORS: Record<string, string> = {
  salad: '#8ca18d', sandwich: '#e2b85b', coffee: '#c86f55', cookie: '#8ca18d', cupsoda: '#8da6b0',
}

export function FoodIcon({ iconKey, size = 36 }: { iconKey: string; size?: number }) {
  const props = { size, strokeWidth: 1.5, color: ICON_COLORS[iconKey] ?? ICON_COLORS.sandwich }
  switch (iconKey) {
    case 'salad': return <Salad {...props} />
    case 'coffee': return <Coffee {...props} />
    case 'cookie': return <Cookie {...props} />
    case 'cupsoda': return <CupSoda {...props} />
    default: return <Sandwich {...props} />
  }
}

export const iconNode = (key: string) => <FoodIcon iconKey={key} />

// ── Estados de pedido ────────────────────────────────────────────
export const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  preparing: 'Preparando',
  ready:     'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
export const STATUS_CLASS: Record<string, string> = {
  pending:   'status-prep',
  preparing: 'status-prep',
  ready:     'status-ready',
  delivered: 'status-ready',
  cancelled: 'status-cancelled',
}

export const CATEGORY_COLOR: Record<string, string> = {
  Almuerzos: 'terracotta', Bebidas: 'sage', Snacks: 'gold',
}

// ── Marca ────────────────────────────────────────────────────────
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Coffee size={19} /></span>
      <span>Café <b>Campus</b></span>
    </div>
  )
}

// ── Hoja inferior (móvil) / modal (escritorio) ───────────────────
export function Sheet({
  open, onClose, title, eyebrow, children, className = '',
}: {
  open: boolean; onClose: () => void; title?: string; eyebrow?: string
  children: React.ReactNode; className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="sheet-handle" aria-hidden />
        <button className="sheet-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
