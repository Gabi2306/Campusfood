import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/menu/:id — actualiza un item (solo admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, category, price, iconKey, available } = body

  const item = await prisma.menuItem.update({
    where: { id: Number(id) },
    data: {
      ...(name      !== undefined && { name }),
      ...(category  !== undefined && { category }),
      ...(price     !== undefined && { price: Number(price) }),
      ...(iconKey   !== undefined && { iconKey }),
      ...(available !== undefined && { available }),
    },
  })

  return NextResponse.json(item)
}

// DELETE /api/menu/:id — elimina un item (solo admin)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  await prisma.menuItem.delete({ where: { id: Number(id) } })

  return NextResponse.json({ ok: true })
}
