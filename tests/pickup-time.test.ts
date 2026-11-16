// HU-02 · Reglas del pedido anticipado (hora de recogida)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPickupDateTime, getBogotaDateString, isValidPickupTime } from '@/lib/pickup-time'

// 7 de octubre de 2026, 9:00 a. m. en Bogotá (14:00 UTC)
const now = new Date('2026-10-07T14:00:00Z')
const today = '2026-10-07'

describe('Pedido anticipado: validación de la hora de recogida', () => {
  it('usa la fecha de Bogotá y no la del servidor', () => {
    assert.equal(getBogotaDateString(new Date('2026-10-08T03:30:00Z')), '2026-10-07')
  })

  it('acepta una franja de hoy con al menos 30 minutos de anticipación', () => {
    assert.equal(isValidPickupTime(today, 10 * 60, now), true) // 10:00 a. m.
    assert.equal(isValidPickupTime(today, 9 * 60 + 30, now), true) // 9:30 a. m. (justo 30 min)
  })

  it('rechaza horas con menos de 30 minutos de anticipación', () => {
    assert.equal(isValidPickupTime(today, 9 * 60, now), false)
  })

  it('rechaza horas fuera del horario de 8:00 a. m. a 6:00 p. m.', () => {
    assert.equal(isValidPickupTime(today, 7 * 60 + 30, now), false)
    assert.equal(isValidPickupTime(today, 18 * 60 + 30, now), false)
  })

  it('solo acepta franjas de 30 minutos', () => {
    assert.equal(isValidPickupTime(today, 10 * 60 + 15, now), false)
  })

  it('rechaza fechas distintas a hoy o con formato inválido', () => {
    assert.equal(isValidPickupTime('2026-10-08', 10 * 60, now), false)
    assert.equal(isValidPickupTime('07/10/2026', 10 * 60, now), false)
  })

  it('crea la fecha de recogida en hora de Colombia (UTC-5)', () => {
    assert.equal(createPickupDateTime(today, 12 * 60 + 30).toISOString(), '2026-10-07T17:30:00.000Z')
  })
})
