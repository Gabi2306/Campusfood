import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, password } = body as { name: string; email: string; password: string }

  // Validaciones básicas
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Todos los campos son obligatorios.' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()

  if (!cleanEmail.endsWith('@campusucc.ecu.co')) {
    return NextResponse.json(
      { error: 'Solo se permiten correos institucionales (@campusucc.ecu.co).' },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres.' },
      { status: 400 }
    )
  }

  try {
    // Verificar que el correo no esté registrado ya
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } })
    if (existing) {
      return NextResponse.json(
        { error: 'Este correo ya está registrado.' },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name:     name.trim(),
        email:    cleanEmail,
        password: hashed,
        role:     'student',
        balance:  48500,
      },
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/auth/register:', error)
    // Devolver mensaje mínimo y detalles para desarrollo
    return NextResponse.json(
      { error: 'Error interno del servidor al crear el usuario.', details: error?.message ?? String(error) },
      { status: 500 }
    )
  }
}
