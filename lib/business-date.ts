import { getBogotaDateString } from '@/lib/pickup-time'

// Colombia no usa horario de verano: el desfase es fijo.
const BOGOTA_UTC_OFFSET = '-05:00'
const DAY_MS = 24 * 60 * 60 * 1000

export const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export { getBogotaDateString }

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Inicio (incluido) y fin (excluido) del día en Bogotá, como instantes UTC. */
export function bogotaDayBounds(date: string) {
  const start = new Date(`${date}T00:00:00${BOGOTA_UTC_OFFSET}`)
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS)
  return shifted.toISOString().slice(0, 10)
}

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

export function diffInDays(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / DAY_MS)
}
