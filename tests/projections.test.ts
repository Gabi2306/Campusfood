// HU-06 · Cálculos estadísticos de la proyección de demanda
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { confidenceFor, weightedStats } from '@/lib/projections'

describe('Proyección de demanda: promedio ponderado y confianza', () => {
  it('sin datos devuelve media y desviación en cero', () => {
    assert.deepEqual(weightedStats([], 0.85), { mean: 0, std: 0 })
  })

  it('con valores iguales la desviación es cero', () => {
    const { mean, std } = weightedStats([10, 10, 10, 10], 0.85)
    assert.equal(mean, 10)
    assert.equal(std, 0)
  })

  it('las semanas más recientes pesan más en el promedio', () => {
    // El primer valor es el más reciente: el promedio queda más cerca de 20 que de 10
    const { mean } = weightedStats([20, 10], 0.5)
    assert.ok(Math.abs(mean - 16.67) < 0.01, `media obtenida: ${mean}`)
  })

  it('confianza alta con 6+ muestras y baja variación', () => {
    assert.equal(confidenceFor(8, 20, 3), 'alta')
  })

  it('confianza media con 3 a 5 muestras o variación alta', () => {
    assert.equal(confidenceFor(4, 20, 3), 'media')
    assert.equal(confidenceFor(8, 20, 15), 'media')
  })

  it('confianza baja con menos de 3 muestras', () => {
    assert.equal(confidenceFor(2, 20, 1), 'baja')
  })
})
