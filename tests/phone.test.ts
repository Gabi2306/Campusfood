// HU-04 · Celular para notificaciones SMS
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { maskPhone, normalizePhone } from '@/lib/phone'

describe('Notificaciones SMS: normalización del celular', () => {
  it('convierte un celular colombiano a formato internacional', () => {
    assert.equal(normalizePhone('300 123 4567'), '+573001234567')
    assert.equal(normalizePhone('(300) 123-4567'), '+573001234567')
    assert.equal(normalizePhone('573001234567'), '+573001234567')
  })

  it('acepta números internacionales con +', () => {
    assert.equal(normalizePhone('+14155552671'), '+14155552671')
  })

  it('rechaza números inválidos', () => {
    assert.equal(normalizePhone('12345'), null)
    assert.equal(normalizePhone(''), null)
    assert.equal(normalizePhone(3001234567), null)
  })

  it('oculta el número al mostrarlo', () => {
    assert.equal(maskPhone('+573001234567'), '+57 ••• 4567')
    assert.equal(maskPhone(null), null)
  })
})
