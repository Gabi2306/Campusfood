import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Usuarios ──────────────────────────────────────────────────
  const hashedAdmin = await bcrypt.hash('admin123', 10)
  const hashedStudent = await bcrypt.hash('student123', 10)

  await prisma.user.upsert({
    where: { email: 'admin@campusucc.ecu.co' },
    update: {},
    create: {
      email: 'admin@campusucc.ecu.co',
      password: hashedAdmin,
      name: 'Admin Campus',
      role: 'admin',
      balance: 0,
    },
  })

  await prisma.user.upsert({
    where: { email: 'estudiante@campusucc.ecu.co' },
    update: {},
    create: {
      email: 'estudiante@campusucc.ecu.co',
      password: hashedStudent,
      name: 'Estudiante Demo',
      role: 'student',
      balance: 48500,
    },
  })

  // ── Menú ──────────────────────────────────────────────────────
  const menuItems = [
    { name: 'Bowl energético',    category: 'Almuerzos', price: 14500, iconKey: 'salad' },
    { name: 'Wrap mediterráneo',  category: 'Almuerzos', price: 12000, iconKey: 'sandwich' },
    { name: 'Café latte',         category: 'Bebidas',   price: 5500,  iconKey: 'coffee' },
    { name: 'Galleta de avena',   category: 'Snacks',    price: 3500,  iconKey: 'cookie' },
  ]

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: menuItems.indexOf(item) + 1 },
      update: {},
      create: item,
    })
  }

  console.log('✅ Seed completado.')
  console.log('   admin@campusucc.ecu.co  /  admin123')
  console.log('   estudiante@campusucc.ecu.co  /  student123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
