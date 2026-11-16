# Notas de versión

## v2.0 — Sprint de extensión (momento 3)

### Nuevo
- **HU-11 · Filtros del historial de pedidos.** El estudiante filtra su historial por estado (todos, entregados, cancelados) y por rango de fechas (desde / hasta, en hora de Bogotá). Nuevo parámetro `history=1&status=&from=&to=` en `GET /api/orders`, con validación y respuesta `400` ante filtros inválidos.
- **HU-12 · Integración y despliegue continuos.** Pipeline de GitHub Actions (`.github/workflows/ci.yml`) que ejecuta pruebas, verificación de tipos, migraciones y build en cada push o pull request a `main`. El build de Vercel ejecuta las pruebas antes de desplegar y se detiene si alguna falla.
- **HU-13 · Perfil editable.** El estudiante cambia su nombre completo desde *Mi cuenta*; el cambio se refleja de inmediato en la app.

### Corregido
- HU-13: el nombre editado no se guardaba (la API ignoraba el campo `name`). Ahora se valida y se guarda.
- HU-13: el nombre del encabezado no cambiaba hasta cerrar sesión. La sesión se refresca al guardar.
- HU-13: refrescar la sesión desmontaba la app (se cerraba la hoja y se perdía el carrito). La pantalla de carga solo aparece en la carga inicial.
- HU-13: el celular y el SMS estaban duplicados en dos formularios que no se sincronizaban. Ahora solo se editan en *Avisos de pedido listo* (HU-04).
- HU-11: el componente del historial no estaba conectado a la app.

### Pruebas
- Se incorporan al repositorio las 6 suites de la v1.0 (33 pruebas) como pruebas de regresión.
- Nuevas suites: `order-history-filters.test.ts` (HU-11, 11 pruebas) y `profile-input.test.ts` (HU-13, 5 pruebas).
- Total: 8 suites, 49 pruebas aprobadas (`npm test`).

### Sin cambios
Todas las funciones de la v1.0 se conservan: inicio de sesión, menú, pedido anticipado, pago con Stripe y saldo, cancelación, notificaciones, proyecciones, histórico de demanda, dashboard y reportes.

## v1.0 — Cierre del momento 2

Primera versión completa: 10 historias de usuario (HU-01 a HU-10, 61 puntos) en 6 sprints, desplegada en https://campusfood-plum.vercel.app.
