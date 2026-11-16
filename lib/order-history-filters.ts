// HU-11 — Filtros del historial de pedidos del estudiante por fecha y estado.
import { bogotaDayBounds, isDateString } from '@/lib/business-date'

export const HISTORY_STATUSES = ['delivered', 'cancelled'] as const
export type HistoryStatus = typeof HISTORY_STATUSES[number]
export type HistoryStatusFilter = 'all' | HistoryStatus

export const HISTORY_STATUS_OPTIONS: { value: HistoryStatusFilter; label: string }[] = [
  { value: 'all',       label: 'Todos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
]

/** Máximo de pedidos que devuelve una consulta del historial. */
export const HISTORY_LIMIT = 100

export type HistoryFilters = {
  status: HistoryStatusFilter
  from: string | null // AAAA-MM-DD, día de Bogotá (incluido)
  to: string | null   // AAAA-MM-DD, día de Bogotá (incluido)
}

export const EMPTY_HISTORY_FILTERS: HistoryFilters = { status: 'all', from: null, to: null }

export type ParsedHistoryFilters = { ok: true; filters: HistoryFilters } | { ok: false; error: string }

type ParamSource = { get(name: string): string | null }

/** Lee y valida los filtros enviados como parámetros de la URL (?status=&from=&to=). */
export function parseHistoryFilters(params: ParamSource): ParsedHistoryFilters {
  const rawStatus = params.get('status')?.trim() || 'all'
  if (rawStatus !== 'all' && !(HISTORY_STATUSES as readonly string[]).includes(rawStatus)) {
    return { ok: false, error: 'El estado del filtro no es válido.' }
  }

  const from = params.get('from')?.trim() || null
  const to = params.get('to')?.trim() || null
  if (from !== null && !isDateString(from)) return { ok: false, error: 'La fecha "desde" no es válida.' }
  if (to !== null && !isDateString(to)) return { ok: false, error: 'La fecha "hasta" no es válida.' }
  // Las fechas AAAA-MM-DD se comparan bien como texto.
  if (from !== null && to !== null && from > to) {
    return { ok: false, error: 'La fecha "desde" no puede ser posterior a la fecha "hasta".' }
  }

  return { ok: true, filters: { status: rawStatus as HistoryStatusFilter, from, to } }
}

/** Convierte los filtros en parámetros de URL; omite los que están vacíos. */
export function historyFiltersToQuery(filters: HistoryFilters) {
  const params = new URLSearchParams()
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  return params.toString()
}

export function hasActiveHistoryFilters(filters: HistoryFilters) {
  return filters.status !== 'all' || filters.from !== null || filters.to !== null
}

/**
 * Condición de Prisma para el historial de un estudiante: solo sus pedidos finalizados,
 * con el estado elegido y creados entre el inicio de "desde" y el final de "hasta" (hora de Bogotá).
 */
export function buildHistoryWhere(userId: number, filters: HistoryFilters) {
  const createdAt: { gte?: Date; lt?: Date } = {}
  if (filters.from) createdAt.gte = bogotaDayBounds(filters.from).start
  if (filters.to) createdAt.lt = bogotaDayBounds(filters.to).end

  return {
    userId,
    status: filters.status === 'all' ? { in: [...HISTORY_STATUSES] } : filters.status,
    ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
  }
}
