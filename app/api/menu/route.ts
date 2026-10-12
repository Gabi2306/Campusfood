import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { parseMenuInput } from '@/lib/menu-input'
import { isStaff } from '@/lib/roles'

// GET /api/menu — devuelve todos los items (público), con su stock del día
export async function GET() {
  const items = await prisma.menuItem.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/menu — crea un nuevo item (admin o cocina)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  const parsed = parseMenuInput(body, { partial: false })
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const item = await prisma.menuItem.create({
    data: {
      name: parsed.data.name!,
      category: parsed.data.category!,
      price: parsed.data.price!,
      iconKey: parsed.data.iconKey ?? 'sandwich',
      available: parsed.data.available ?? true,
      stock: parsed.data.stock ?? null,
    },
  })

  return NextResponse.json(item, { status: 201 })
}
