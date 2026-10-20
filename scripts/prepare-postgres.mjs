// Genera prisma/postgres/schema.prisma a partir de prisma/schema.prisma,
// cambiando SQLite por PostgreSQL. Se usa solo al desplegar (npm run vercel-build);
// en local la app sigue usando SQLite (dev.db).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const source = readFileSync('prisma/schema.prisma', 'utf8')
const datasourcePattern = /datasource\s+db\s*\{[^}]*\}/
if (!datasourcePattern.test(source)) {
  throw new Error('No se encontró el bloque "datasource db" en prisma/schema.prisma')
}

// Neon (y la integración de Vercel) entregan una URL con pool para la app
// y otra directa (sin pool) para crear las tablas.
const directUrl = process.env.DATABASE_URL_UNPOOLED ? '\n  directUrl = env("DATABASE_URL_UNPOOLED")' : ''
const datasource = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")${directUrl}
}`

mkdirSync('prisma/postgres', { recursive: true })
writeFileSync('prisma/postgres/schema.prisma', source.replace(datasourcePattern, datasource))
console.log('Esquema PostgreSQL generado en prisma/postgres/schema.prisma')
