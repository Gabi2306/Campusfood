# Instalación rápida (Campusfood)

- Requisitos: Node.js 18 o 20 (LTS), `npm` o `pnpm`.

Requisitos mínimos

- Node.js 18 o 20 (LTS).
- `npm` (incluido con Node) o `pnpm` si prefieres.

Pasos desde la raíz del proyecto

1. Instalar dependencias:

```bash
npm install
```

2. Verifica que exista el archivo `.env` (ya creado) con:

```env
DATABASE_URL="file:./dev.db"
```

3. Generar el cliente de Prisma:

```bash
npm run db:generate
```

4. Ejecutar migraciones (crea la BD `dev.db`):

```bash
npm run db:migrate
```

5. Cargar datos de ejemplo (seed):

```bash
npm run db:seed
```

6. Abrir Prisma Studio (UI de la BD):

```bash
npm run db:studio
```

7. Ejecutar la app en modo desarrollo:

```bash
npm run dev

Variables de entorno importantes

- Ya añadimos un valor de desarrollo para `NEXTAUTH_SECRET` y `NEXTAUTH_URL` en el archivo `.env`.
- Si prefieres generar tu propio secreto seguro, ejecuta:

```bash
# usando Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# o usando openssl (si está instalado)
openssl rand -hex 32
```

Luego copia el valor en `.env` como `NEXTAUTH_SECRET="<tu-secreto>"` y reinicia el servidor.
```

Notas y soluciones a problemas comunes

- Si usas Windows y quieres manejar varias versiones de Node, instala `nvm-windows`.
- Si `npm run db:migrate` falla por falta de `.env`, confirma que `.env` exista en la raíz.
- Si hay errores con `next` o `react` por versiones, instala la versión de Node recomendada (18/20).

