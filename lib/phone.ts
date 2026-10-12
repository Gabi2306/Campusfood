/**
 * Normaliza un número celular a formato E.164.
 * Acepta celulares colombianos sin indicativo (3001234567) o cualquier número con "+".
 * Devuelve null si el formato no es válido.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const compact = input.replace(/[\s().-]/g, '')
  if (/^3\d{9}$/.test(compact)) return `+57${compact}`
  if (/^573\d{9}$/.test(compact)) return `+${compact}`
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact
  return null
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return null
  return `${phone.slice(0, 3)} ••• ${phone.slice(-4)}`
}
