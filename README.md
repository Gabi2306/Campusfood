# Campusfood

Proyecto: sistema de pedidos para una cafetería universitaria usando Next.js, NextAuth y Prisma (SQLite para desarrollo).

## Descripción

Campusfood es una aplicación educativa que permite a estudiantes y administradores gestionar menús y realizar pedidos. Incluye autenticación por credenciales (correo institucional) y un esquema de datos manejado con Prisma.

## Requisitos

- Node.js 18 o 20 (LTS)
- `npm` (incluido) o `pnpm`
- Git (opcional)

## Variables de entorno

Crear un archivo `.env` en la raíz con las siguientes variables (no lo subas al repositorio):

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="<secreto-de-32-bytes-en-hex>"
NEXTAUTH_URL="http://localhost:3000"
```

- `DATABASE_URL`: URL de la base de datos (aquí usamos SQLite en desarrollo).
- `NEXTAUTH_SECRET`: secreto para firmar tokens de Auth.js / NextAuth; generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `NEXTAUTH_URL`: URL base de la app en desarrollo.

Nota: un ejemplo sin valores puede añadirse como `.env.example` y commitearse.

## Instalación (local)

Desde la raíz del proyecto:

```bash
npm install
# crear .env (manual o copiando .env.example)
npm run db:generate    # prisma generate
npm run db:migrate     # ejecutar migraciones y crear dev.db
npm run db:seed        # cargar datos de ejemplo
npm run db:studio      # (opcional) abrir Prisma Studio
npm run dev            # iniciar servidor en http://localhost:3000
```

## Scripts útiles

- `npm run dev` — Ejecuta Next.js en modo desarrollo.
- `npm run build` — Construye la app para producción.
- `npm run start` — Inicia la versión construida.
- `npm run db:generate` — `prisma generate`.
- `npm run db:migrate` — `prisma migrate dev`.
- `npm run db:seed` — Ejecuta `prisma/seed.ts`.
- `npm run db:studio` — Abre Prisma Studio.

## Cómo funciona la autenticación

- Autenticación con `next-auth` (Auth.js) y proveedor de `Credentials`.
- Solo se permiten correos terminados en `@campusucc.ecu.co`.
- `NEXTAUTH_SECRET` debe estar definido para evitar el error "MissingSecret".

## Errores comunes y solución rápida

- Error: `[auth][error] MissingSecret: Please define a 'secret'` → Asegúrate de tener `NEXTAUTH_SECRET` en `.env` y reinicia el servidor.
- Error: problemas con migraciones → elimina `dev.db` (solo en desarrollo), vuelve a correr `npm run db:migrate`.

## Seguridad y Git

- No comitees `.env`; `.gitignore` incluye `.env` y `dev.db`.
- Si subiste `.env` por accidente:

```bash
git rm --cached .env
git commit -m "Remove .env"
git push
```

Luego rota el secreto (`NEXTAUTH_SECRET`) y actualiza las variables en tu servicio de despliegue.

## Despliegue

En plataformas como Vercel o Netlify, configura las Environment Variables en el panel de tu proyecto:

- `DATABASE_URL` (usa un proveedor de Postgres en producción en lugar de SQLite)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Recomendación: usar una base de datos real (Postgres) en producción y actualizar `prisma/schema.prisma` si cambia el proveedor.

## Estructura del proyecto (resumen)

- `app/` — páginas y rutas de la App Router.
- `app/api/` — endpoints API (incluye `auth` y `menu`).
- `components/` — componentes React reutilizables.
- `lib/prisma.ts` — cliente Prisma compartido.
- `prisma/` — esquema y seed.
- `README.md` — este archivo.

## Contribuir

1. Haz fork y crea una rama nueva (`feature/tu-cambio`).
2. Asegúrate de que las variables de entorno necesarias estén definidas en tu entorno local.
3. Ejecuta los scripts de migración/seed si tocas el esquema.
4. Crea un PR describiendo los cambios.

## Contacto

Si encuentras un bug o tienes preguntas, abre un issue en el repositorio con pasos para reproducir.

---

Archivo `.env.example` sugerido (commiteable):

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
```
