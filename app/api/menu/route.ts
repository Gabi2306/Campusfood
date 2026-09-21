import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/menu — devuelve todos los items (público)
export async function GET() {
  const items = await prisma.menuItem.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json(items)
}

// POST /api/menu — crea un nuevo item (solo admin)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { name, category, price, iconKey, available } = body

  if (!name || !category || !price) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const item = await prisma.menuItem.create({
    data: {
      name,
      category,
      price: Number(price),
      iconKey: iconKey ?? 'sandwich',
      available: available ?? true,
    },
  })

  return NextResponse.json(item, { status: 201 })
}
