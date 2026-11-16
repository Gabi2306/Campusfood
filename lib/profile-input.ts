// HU-13 — Validación del perfil editable del estudiante.

export const PROFILE_NAME_MIN = 3
export const PROFILE_NAME_MAX = 80

export type NameValidation = { ok: true; value: string } | { ok: false; error: string }

/** Limpia y valida el nombre completo: sin espacios repetidos, entre 3 y 80 caracteres y solo letras. */
export function validateProfileName(raw: unknown): NameValidation {
  if (typeof raw !== 'string') return { ok: false, error: 'Escribe tu nombre completo.' }
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value.length < PROFILE_NAME_MIN) {
    return { ok: false, error: `El nombre debe tener al menos ${PROFILE_NAME_MIN} caracteres.` }
  }
  if (value.length > PROFILE_NAME_MAX) {
    return { ok: false, error: `El nombre no puede superar ${PROFILE_NAME_MAX} caracteres.` }
  }
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(value)) {
    return { ok: false, error: 'El nombre solo puede contener letras, espacios, apóstrofos y guiones.' }
  }
  return { ok: true, value }
}
