// HU-11 · Filtros del historial de pedidos por fecha y estado
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHistoryWhere,
  EMPTY_HISTORY_FILTERS,
  hasActiveHistoryFilters,
  historyFiltersToQuery,
  parseHistoryFilters,
} from '@/lib/order-history-filters'

const params = (query: string) => new URLSearchParams(query)

describe('Historial: lectura y validación de los filtros', () => {
  it('sin parámetros devuelve todos los estados y sin fechas', () => {
    assert.deepEqual(parseHistoryFilters(params('')), { ok: true, filters: EMPTY_HISTORY_FILTERS })
  })

  it('acepta estado entregado o cancelado y un rango de fechas', () => {
    const result = parseHistoryFilters(params('status=cancelled&from=2026-11-01&to=2026-11-15'))
    assert.deepEqual(result, { ok: true, filters: { status: 'cancelled', from: '2026-11-01', to: '2026-11-15' } })
  })

  it('rechaza estados que no son del historial', () => {
    assert.equal(parseHistoryFilters(params('status=pending')).ok, false)
    assert.equal(parseHistoryFilters(params('status=xyz')).ok, false)
  })

  it('rechaza fechas con formato o día inválido', () => {
    assert.equal(parseHistoryFilters(params('from=15/11/2026')).ok, false)
    assert.equal(parseHistoryFilters(params('to=2026-02-30')).ok, false)
  })

  it('rechaza un rango con "desde" posterior a "hasta"', () => {
    assert.equal(parseHistoryFilters(params('from=2026-11-10&to=2026-11-01')).ok, false)
  })

  it('permite que "desde" y "hasta" sean el mismo día', () => {
    assert.equal(parseHistoryFilters(params('from=2026-11-10&to=2026-11-10')).ok, true)
  })
})

describe('Historial: consulta a la base de datos', () => {
  it('sin filtros solo trae pedidos finalizados del estudiante', () => {
    assert.deepEqual(buildHistoryWhere(7, EMPTY_HISTORY_FILTERS), {
      userId: 7,
      status: { in: ['delivered', 'cancelled'] },
    })
  })

  it('el rango de fechas usa el día completo en hora de Bogotá', () => {
    const where = buildHistoryWhere(7, { status: 'delivered', from: '2026-11-01', to: '2026-11-15' })
    assert.equal(where.status, 'delivered')
    // 1 nov 00:00 en Bogotá = 05:00 UTC; el fin es el 16 nov 00:00 de Bogotá (excluido)
    assert.equal(where.createdAt?.gte?.toISOString(), '2026-11-01T05:00:00.000Z')
    assert.equal(where.createdAt?.lt?.toISOString(), '2026-11-16T05:00:00.000Z')
  })

  it('un pedido a las 11 p. m. de Bogotá del día "hasta" queda incluido', () => {
    const where = buildHistoryWhere(7, { status: 'all', from: null, to: '2026-11-15' })
    const lateOrder = new Date('2026-11-15T23:00:00-05:00')
    assert.ok(lateOrder < (where.createdAt?.lt as Date))
  })
})

describe('Historial: parámetros de la URL', () => {
  it('omite los filtros vacíos', () => {
    assert.equal(historyFiltersToQuery(EMPTY_HISTORY_FILTERS), '')
    assert.equal(hasActiveHistoryFilters(EMPTY_HISTORY_FILTERS), false)
  })

  it('incluye solo los filtros activos', () => {
    const filters = { status: 'delivered' as const, from: '2026-11-01', to: null }
    assert.equal(historyFiltersToQuery(filters), 'status=delivered&from=2026-11-01')
    assert.equal(hasActiveHistoryFilters(filters), true)
  })
})
