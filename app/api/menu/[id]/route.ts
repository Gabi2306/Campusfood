import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { parseMenuInput } from '@/lib/menu-input'
import { isStaff } from '@/lib/roles'

async function getItemId(params: Promise<{ id: string }>) {
  const id = Number((await params).id)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

// PATCH /api/menu/:id — actualiza un item: nombre, precio, disponibilidad o stock (admin o cocina)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const id = await getItemId(params)
  if (!id) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  const parsed = parseMenuInput(body, { partial: true })
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const result = await prisma.menuItem.updateMany({ where: { id }, data: parsed.data })
  if (result.count === 0) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })

  return NextResponse.json(await prisma.menuItem.findUnique({ where: { id } }))
}

// DELETE /api/menu/:id — elimina un item (admin o cocina).
// Si ya tiene pedidos, no se borra (se perdería el historial): se retira del menú.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const id = await getItemId(params)
  if (!id) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })

  const item = await prisma.menuItem.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } })
  if (!item) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })

  if (item._count.orderItems > 0) {
    await prisma.menuItem.update({ where: { id }, data: { available: false } })
    return NextResponse.json({
      ok: true,
      archived: true,
      message: `${item.name} tiene pedidos registrados, así que se retiró del menú en lugar de borrarse.`,
    })
  }

  await prisma.menuItem.delete({ where: { id } })
  return NextResponse.json({ ok: true, archived: false })
}
