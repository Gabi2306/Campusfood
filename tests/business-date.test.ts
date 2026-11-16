// HU-09 · Utilidades de fechas del histórico de demanda
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, bogotaDayBounds, diffInDays, isDateString, weekdayOf } from '@/lib/business-date'

describe('Fechas de negocio (zona America/Bogota)', () => {
  it('valida fechas reales en formato YYYY-MM-DD', () => {
    assert.equal(isDateString('2026-10-20'), true)
    assert.equal(isDateString('2026-02-30'), false)
    assert.equal(isDateString('20-10-2026'), false)
  })

  it('suma y resta días cruzando meses y años', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01')
    assert.equal(addDays('2026-01-01', -1), '2025-12-31')
  })

  it('calcula el día de la semana (0 = domingo)', () => {
    assert.equal(weekdayOf('2026-10-20'), 2) // martes
    assert.equal(weekdayOf('2026-10-18'), 0) // domingo
  })

  it('calcula la diferencia en días entre dos fechas', () => {
    assert.equal(diffInDays('2026-10-01', '2026-10-20'), 19)
  })

  it('el día de Bogotá inicia a las 05:00 UTC y dura 24 horas', () => {
    const { start, end } = bogotaDayBounds('2026-10-20')
    assert.equal(start.toISOString(), '2026-10-20T05:00:00.000Z')
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000)
  })
})
