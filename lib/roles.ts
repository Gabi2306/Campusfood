export type Role = 'admin' | 'kitchen' | 'student'

/** Personal de la cafetería: administración y cocina. */
export function isStaff(role: string | undefined | null): role is 'admin' | 'kitchen' {
  return role === 'admin' || role === 'kitchen'
}
