import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Usuarios ──────────────────────────────────────────────────
  const hashedAdmin = await bcrypt.hash('admin123', 10)
  const hashedStudent = await bcrypt.hash('student123', 10)
  const hashedKitchen = await bcrypt.hash('cocina123', 10)

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

  await prisma.user.upsert({
    where: { email: 'cocina@campusucc.ecu.co' },
    update: {},
    create: {
      email: 'cocina@campusucc.ecu.co',
      password: hashedKitchen,
      name: 'Cocina Campus',
      role: 'kitchen',
      balance: 0,
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

  // ── Histórico de demanda de demostración (HU-09) ─────────────
  // Ocho semanas de datos sintéticos, marcados con source = "seed", para que
  // el módulo de proyecciones (HU-06) tenga con qué trabajar desde el inicio.
  // No sobrescribe días que ya existan. Desactívalo con SEED_HISTORY=false.
  if (process.env.SEED_HISTORY !== 'false') {
    const seededRows = await seedDemandHistory()
    console.log(`   Histórico de demostración: ${seededRows} filas`)
  }

  console.log('✅ Seed completado.')
  console.log('   admin@campusucc.ecu.co  /  admin123')
  console.log('   estudiante@campusucc.ecu.co  /  student123')
  console.log('   cocina@campusucc.ecu.co  /  cocina123')
}

const DAY_MS = 24 * 60 * 60 * 1000
const bogotaToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

// Generador pseudoaleatorio determinista: el seed produce siempre los mismos datos.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function seedDemandHistory() {
  const random = mulberry32(2026)
  const items = await prisma.menuItem.findMany()
  const baseDemand: Record<string, number> = {
    'Bowl energético': 22, 'Wrap mediterráneo': 17, 'Café latte': 31, 'Galleta de avena': 14,
  }
  // domingo … sábado (domingo cerrado)
  const weekdayFactor = [0, 1.0, 1.08, 1.12, 1.0, 0.82, 0.35]
  const [year, month, day] = bogotaToday().split('-').map(Number)
  const todayUtc = Date.UTC(year, month - 1, day)
  let rows = 0

  for (let offset = 56; offset >= 1; offset -= 1) {
    const date = new Date(todayUtc - offset * DAY_MS)
    const weekday = date.getUTCDay()
    if (weekdayFactor[weekday] === 0) continue
    const dateString = date.toISOString().slice(0, 10)
    const growth = 1 + (56 - offset) * 0.003

    for (const item of items) {
      const base = baseDemand[item.name] ?? 10
      const noise = 0.8 + random() * 0.4
      const ordered = Math.max(0, Math.round(base * weekdayFactor[weekday] * growth * noise))
      const advance = Math.round(ordered * (0.25 + random() * 0.2))
      const cancelled = random() < 0.25 ? 1 : 0
      const surplus = Math.round(random() * Math.max(2, ordered * 0.18))
      const ordersCount = Math.max(ordered ? 1 : 0, Math.round(ordered * 0.8))

      await prisma.demandHistory.upsert({
        where: { date_menuItemId: { date: dateString, menuItemId: item.id } },
        update: {},
        create: {
          date: dateString,
          weekday,
          menuItemId: item.id,
          itemName: item.name,
          category: item.category,
          ordersCount,
          quantityOrdered: ordered,
          quantityAdvance: advance,
          quantityCancelled: cancelled,
          quantityProduced: ordered + surplus,
          quantityWasted: surplus,
          source: 'seed',
        },
      })
      rows += 1
    }
  }
  return rows
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
