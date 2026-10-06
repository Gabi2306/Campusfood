# Campusfood

Proyecto: sistema de pedidos para una cafetería universitaria usando Next.js, NextAuth y Prisma (SQLite para desarrollo).

## Descripción

Campusfood es una aplicación educativa que permite a estudiantes y administradores gestionar menús y realizar pedidos. Incluye autenticación por credenciales (correo institucional) y un esquema de datos manejado con Prisma.

## Flujo de pagos

Desde el carrito, el estudiante puede revisar productos, cantidades y total, y pagar mediante Stripe Checkout en modo de pruebas. Los pedidos se guardan únicamente al recibir y verificar el webhook de pago completado. La recogida anticipada es opcional; si se selecciona, la hora debe ser hoy, entre las 8:00 a. m. y las 6:00 p. m., y al menos 30 minutos después de la hora actual de Bogotá.

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
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

- `DATABASE_URL`: URL de la base de datos (aquí usamos SQLite en desarrollo).
- `NEXTAUTH_SECRET`: secreto para firmar tokens de Auth.js / NextAuth; generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `NEXTAUTH_URL`: URL base de la app en desarrollo.
- `STRIPE_SECRET_KEY`: clave secreta de prueba de Stripe (`sk_test_...`). Nunca uses ni publiques una clave `sk_live_`.
- `STRIPE_WEBHOOK_SECRET`: secreto del endpoint/listener Stripe CLI (`whsec_...`) usado para verificar webhooks.

### Probar Stripe localmente

1. Copia la clave secreta de prueba desde **Stripe Dashboard → Developers → API keys** a `STRIPE_SECRET_KEY`.
2. Aplica la migración de pagos y genera el cliente Prisma:

   ```bash
   npm run db:migrate
   npm run db:generate
   ```

3. Instala e inicia Stripe CLI, autentícala con tu cuenta y reenvía los eventos a la app:

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Copia el secreto `whsec_...` que muestra el comando a `STRIPE_WEBHOOK_SECRET` y reinicia Next.js.
4. Inicia la app con `npm run dev`, agrega productos al carrito y pulsa **Pagar con Stripe**.
5. Usa la tarjeta de prueba `4242 4242 4242 4242`, una fecha futura y cualquier CVC. No uses datos de tarjeta reales.

El endpoint verifica la firma y procesa `checkout.session.completed`, `checkout.session.expired` y los eventos de pago asíncrono. Los precios del menú están almacenados en pesos enteros y se convierten a la unidad menor de COP que requiere Stripe. Stripe debe poder entregar el webhook para que el pedido aparezca registrado; la página de retorno consulta el estado mientras llega la confirmación. Las horas de recogida se muestran también en la vista administrativa de pedidos.

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
