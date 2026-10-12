// Validación de los datos de un producto del menú (crear / editar).
export const MENU_CATEGORIES = ['Almuerzos', 'Bebidas', 'Snacks']
export const MENU_ICONS = ['salad', 'sandwich', 'coffee', 'cookie', 'cupsoda']

export type MenuInput = {
  name?: string; category?: string; price?: number; iconKey?: string
  available?: boolean; stock?: number | null
}

export function parseMenuInput(body: Record<string, unknown>, { partial }: { partial: boolean }):
  { data: MenuInput; error?: undefined } | { data?: undefined; error: string } {
  const data: MenuInput = {}

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) {
      return { error: 'Escribe un nombre de máximo 80 caracteres.' }
    }
    data.name = body.name.trim()
  }
  if (body.category !== undefined || !partial) {
    if (typeof body.category !== 'string' || !MENU_CATEGORIES.includes(body.category)) {
      return { error: 'Elige una categoría válida.' }
    }
    data.category = body.category
  }
  if (body.price !== undefined || !partial) {
    const price = Number(body.price)
    if (!Number.isInteger(price) || price < 100 || price > 1_000_000) {
      return { error: 'El precio debe ser un valor entero entre $100 y $1.000.000.' }
    }
    data.price = price
  }
  if (body.iconKey !== undefined) {
    if (typeof body.iconKey !== 'string' || !MENU_ICONS.includes(body.iconKey)) return { error: 'Ícono inválido.' }
    data.iconKey = body.iconKey
  }
  if (body.available !== undefined) {
    if (typeof body.available !== 'boolean') return { error: 'Disponibilidad inválida.' }
    data.available = body.available
  }
  if (body.stock !== undefined) {
    if (body.stock === null || body.stock === '') {
      data.stock = null
    } else {
      const stock = Number(body.stock)
      if (!Number.isInteger(stock) || stock < 0 || stock > 10_000) {
        return { error: 'El stock debe ser un número entero entre 0 y 10.000, o vacío para no limitarlo.' }
      }
      data.stock = stock
    }
  }
  return { data }
}
