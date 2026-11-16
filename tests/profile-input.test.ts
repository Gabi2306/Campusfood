// HU-13 · Validación del nombre en el perfil editable
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateProfileName } from '@/lib/profile-input'

describe('Perfil editable: nombre completo', () => {
  it('acepta nombres con tildes, ñ y espacios', () => {
    assert.deepEqual(validateProfileName('María José Peñaloza'), { ok: true, value: 'María José Peñaloza' })
  })

  it('quita espacios al inicio, al final y repetidos', () => {
    assert.deepEqual(validateProfileName('  Ana   Gómez  '), { ok: true, value: 'Ana Gómez' })
  })

  it('rechaza nombres vacíos o muy cortos', () => {
    assert.equal(validateProfileName('').ok, false)
    assert.equal(validateProfileName('   ').ok, false)
    assert.equal(validateProfileName('Al').ok, false)
  })

  it('rechaza nombres de más de 80 caracteres', () => {
    assert.equal(validateProfileName('a'.repeat(81)).ok, false)
  })

  it('rechaza números, símbolos y valores que no son texto', () => {
    assert.equal(validateProfileName('Ana123').ok, false)
    assert.equal(validateProfileName('<script>').ok, false)
    assert.equal(validateProfileName(42).ok, false)
    assert.equal(validateProfileName(null).ok, false)
  })
})
