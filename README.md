# Campusfood

Proyecto: sistema de pedidos para una cafetería universitaria usando Next.js, NextAuth y Prisma (SQLite para desarrollo).

## Descripción

Campusfood es una aplicación educativa que permite a estudiantes y administradores gestionar menús y realizar pedidos. Incluye autenticación por credenciales (correo institucional) y un esquema de datos manejado con Prisma.

## Flujo de pagos

Desde el carrito, el estudiante puede revisar productos, cantidades y total, y pagar mediante Stripe Checkout en modo de pruebas. Los pedidos se guardan únicamente al recibir y verificar el webhook de pago completado. La recogida anticipada es opcional; si se selecciona, la hora debe ser hoy, entre las 8:00 a. m. y las 6:00 p. m., y al menos 30 minutos después de la hora actual de Bogotá.

## Sprint: HU-04, HU-06 y HU-09

### HU-09 · Histórico de datos para la proyección
- Tabla `DemandHistory`: una fila por día (hora de Bogotá) y producto, con unidades pedidas, anticipadas, canceladas, producidas y sobrantes.
- Se consolida sola a partir de los pedidos (`lib/demand-history.ts`): hoy y ayer se recalculan siempre; los días cerrados, una vez.
- `GET /api/history?from&to&category` (admin y cocina) · `&format=csv` para exportar · `POST /api/history` recalcula todo (admin).
- `POST /api/history/production`: cocina registra lo producido y lo sobrante del día (sirve para medir el desperdicio).
- El seed carga 8 semanas de datos de demostración (`source = "seed"`); los pedidos reales los reemplazan día por día.

### HU-06 · Proyecciones diarias para cocina
- `GET /api/projections?date=` (hoy o mañana), en `lib/projections.ts`.
- Por producto y por tipo de menú: promedio ponderado del mismo día de la semana (8 semanas) × tendencia de los últimos 7 días, nunca por debajo de los pedidos ya pagados, más un margen pequeño que se quita si el sobrante reciente supera el 15 %.
- Nuevo rol **cocina** (`cocina@campusucc.ecu.co` / `cocina123`): ve Producción, Pedidos e Histórico. Puede avanzar estados, pero solo el admin cancela.

### HU-04 · Aviso push / SMS cuando el pedido está listo
- Al marcar un pedido como **listo** se avisa al estudiante por tres canales: en la app (campana + aviso emergente), push (Web Push con VAPID, `public/sw.js`) y SMS (Twilio) si registró su celular.
- El estudiante lo configura en **Mi cuenta** (toca su avatar). El celular también se puede dar al registrarse.
- En iPhone, el push solo funciona si la app está agregada a la pantalla de inicio (iOS 16.4+). La app incluye manifest e íconos para instalarla.

### Despliegue (Vercel + Neon)
- En local la app usa SQLite (`dev.db`). En la nube usa PostgreSQL (Neon): `npm run vercel-build` genera `prisma/postgres/schema.prisma`, crea las tablas con `prisma db push`, carga los usuarios de prueba y compila.
- Variables de entorno en Vercel: `DATABASE_URL` y `DATABASE_URL_UNPOOLED` (las crea la integración de Neon), `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `STRIPE_SECRET_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y `SMS_PROVIDER=console`.
- Con https la app se puede instalar en el celular (Agregar a pantalla de inicio) y recibe notificaciones push.

### Pagos (Stripe)
- En el checkout el estudiante elige **Tarjeta** o **Saldo institucional** y pulsa **Pagar**.
- **Tarjeta:** se paga en Stripe Checkout (modo de pruebas). Al volver, la app confirma el pago con la API de Stripe y registra el pedido; el webhook es opcional en local.
- **Saldo institucional:** se descuenta dentro de la app sin pasar por Stripe, y se reembolsa si el pedido se cancela.
- Configuración: copia tu clave secreta de pruebas desde Stripe Dashboard → Developers → API keys a `STRIPE_SECRET_KEY` (empieza por `sk_test_`). Tarjeta de prueba: `4242 4242 4242 4242`, fecha futura y cualquier CVC.
- Sin cuenta de Stripe: pon `PAYMENT_PROVIDER="simulated"` para usar la pasarela de demostración propia (`/pago/[id]`).

### Menú del día y stock (cocina y admin)
- Sección **Menú** para cocina y administración: agregar, editar, ocultar o eliminar platos y fijar las unidades disponibles hoy (`stock`; vacío = sin límite).
- Botones rápidos en cada producto: +/− unidades, Agotar, Sin límite, Ocultar/Mostrar.
- El stock se descuenta al confirmarse el pago y se devuelve si el pedido se cancela. El pago se bloquea si se pide más de lo disponible.
- Los estudiantes ven "Quedan N" (con 10 o menos) y "Agotado". El menú se refresca cada 30 s.
- Un producto que ya tiene pedidos no se borra (se perdería el historial): se oculta del menú.

### Interfaz mobile first
- Barra de navegación inferior, carrito flotante, hojas inferiores para cuenta y formularios, tablas que se vuelven tarjetas, campos de 16 px (evita el zoom de iOS) y soporte de notch (`safe-area`).
- Desde 1024 px se conserva el diseño de escritorio (barra superior para estudiantes, menú lateral para el personal).

### Pasos después de actualizar
```bash
npm install
npm run db:migrate     # aplica 20261007000000_projections_history_notifications
npm run db:seed        # crea el usuario de cocina y el histórico de demostración
npm run push:keys      # copia las claves a VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en .env
```

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
