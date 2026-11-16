// Gestión del menú y stock por cocina: validación de datos
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMenuInput } from '@/lib/menu-input'

const valid = { name: 'Ajiaco', category: 'Almuerzos', price: 16000 }

describe('Menú del día: validación de productos y stock', () => {
  it('acepta un producto válido', () => {
    const result = parseMenuInput(valid, { partial: false })
    assert.deepEqual(result.data, { name: 'Ajiaco', category: 'Almuerzos', price: 16000 })
  })

  it('rechaza un precio fuera de rango', () => {
    assert.ok(parseMenuInput({ ...valid, price: 50 }, { partial: false }).error)
  })

  it('rechaza una categoría que no existe', () => {
    assert.ok(parseMenuInput({ ...valid, category: 'Postres' }, { partial: false }).error)
  })

  it('el stock vacío significa "sin límite"', () => {
    assert.equal(parseMenuInput({ stock: '' }, { partial: true }).data?.stock, null)
    assert.equal(parseMenuInput({ stock: 12 }, { partial: true }).data?.stock, 12)
  })

  it('rechaza stock negativo o con decimales', () => {
    assert.ok(parseMenuInput({ stock: -1 }, { partial: true }).error)
    assert.ok(parseMenuInput({ stock: 2.5 }, { partial: true }).error)
  })

  it('en edición parcial solo valida los campos enviados', () => {
    assert.deepEqual(parseMenuInput({ available: false }, { partial: true }).data, { available: false })
  })
})
