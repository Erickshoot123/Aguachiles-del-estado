# Aguachiles del Estado — Sistema POS

Monorepo del sistema de punto de venta. La arquitectura completa, el modelo de datos y el
roadmap por fases están documentados en [PLAN_POS.md](./PLAN_POS.md) — léelo antes de agregar
funcionalidad nueva.

## Estructura

```
apps/
  web/           React + Vite (frontend)
  api/           Fastify + Prisma (backend)
  print-agent/   Servicio local de impresión térmica (por terminal)
packages/
  shared/        Tipos y esquemas Zod compartidos entre apps
  config/        tsconfig base compartido
```

## Requisitos

- Node.js 22+
- PostgreSQL 16 (local o en contenedor) para `apps/api`

## Puesta en marcha

```bash
npm install
```

Copia los archivos de entorno de ejemplo y ajusta los valores:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/print-agent/.env.example apps/print-agent/.env
```

Con PostgreSQL corriendo y `DATABASE_URL` apuntando a él, crea la primera migración y siembra
los datos base (roles, usuario admin, métodos de pago):

```bash
npm run prisma:migrate --workspace=@aguachiles/api -- --name init
npm run prisma:seed --workspace=@aguachiles/api
```

Levanta backend, frontend y print-agent en terminales separadas:

```bash
npm run dev --workspace=@aguachiles/api
npm run dev --workspace=@aguachiles/web
npm run dev --workspace=@aguachiles/print-agent
```

La app queda en `http://localhost:5173`. Usuario semilla: `admin@aguachiles.local` /
`ChangeMe123!` (cámbialo antes de producción).

Sin impresora térmica conectada, el print-agent escribe cada ticket como buffer ESC/POS
crudo en `apps/print-agent/print-output/` (configurable en `PRINTERS`, un JSON con una o más
impresoras); para una impresora de red real, cambia su `interface` a `tcp://<ip>:9100`. El
formato del ticket (58mm/80mm) y la impresora se eligen por terminal desde el modal de ticket
en el frontend y se recuerdan en `localStorage`.

Cada terminal elige, también desde el modal de ticket, **cómo** imprime — pensado para
terminales (tablets) que no pueden correr el Print Agent local:

- **Agente local** (comportamiento anterior): el navegador llama directo al Print Agent de
  esta misma máquina (`VITE_PRINT_AGENT_URL`).
- **Impresora de red**: el navegador no puede abrir un socket TCP crudo, así que es el
  backend (`apps/api`) quien envía el ticket ESC/POS por TCP al puerto (9100 por defecto) de
  la IP configurada.
- **Impresora de otra terminal**: el backend reenvía el ticket al Print Agent de otra
  terminal en la red local (mismo payload que el modo local). Para que esto funcione, el
  Print Agent de esa otra terminal debe escuchar en su IP de red, no solo en `127.0.0.1`
  (variable `HOST` en su `.env` — por defecto sigue siendo `127.0.0.1`, así que hay que
  activarlo explícitamente y solo en una red local de confianza).

Los tres modos renderizan el ticket con el mismo código (`packages/shared/src/printing`), así
que el resultado impreso es idéntico sin importar el camino. Si la impresora no responde, el
modal de ticket muestra el error devuelto y permite reintentar sin bloquear el cobro (el
cobro ya ocurrió antes de abrir el modal de impresión).

## Scripts de raíz

- `npm run lint` — ESLint sobre todo el monorepo.
- `npm run typecheck` — chequeo de tipos por workspace.
- `npm run build` — build de producción por workspace.
- `npm run test` — pruebas por workspace.

## Pruebas (`apps/api`)

Las pruebas de integración/API/concurrencia corren contra una base de datos Postgres real
dedicada (no mocks de infraestructura), separada de la de desarrollo. Con el contenedor de
Postgres ya corriendo, créala una sola vez y aplícale las migraciones:

```bash
docker exec -it aguachiles-postgres psql -U postgres -c "CREATE DATABASE aguachiles_pos_test;"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aguachiles_pos_test" npx --workspace=@aguachiles/api prisma migrate deploy
```

(ajusta usuario/contraseña/puerto según tu `apps/api/.env`). Luego, desde la raíz:

```bash
npm run test --workspace=@aguachiles/api
```

Esto corre suites unitarias, de integración (vía `app.inject()` de Fastify contra la DB de
prueba real), de contrato de API, de constraints de base de datos, y de concurrencia
(condiciones de carrera explícitas: sobreventa de stock y doble apertura de la misma caja).
Las pruebas truncan y re-siembran la DB de prueba entre archivos, así que nunca tocan
`aguachiles_pos` (la de desarrollo).

Pendiente (fuera del alcance actual): cobertura exhaustiva endpoint-por-endpoint de módulos
secundarios (proveedores, compras, analítica).

## Pruebas E2E (`apps/e2e`)

Cubre el flujo completo de cajero descrito en la sección 7 del plan: login → abrir caja → vender
con pago dividido (efectivo + tarjeta) → imprimir ticket (contra el Print Agent real, en modo
archivo — no se mockea nada) → cerrar caja. Usa Playwright contra el stack real: API, frontend y
Print Agent levantados como procesos de verdad, no mocks de red.

Crea una base de datos dedicada (separada de `aguachiles_pos_test`, que usan las pruebas de
`apps/api`) y aplícale migraciones + el seed real del proyecto:

```bash
docker exec -it aguachiles-postgres psql -U postgres -c "CREATE DATABASE aguachiles_pos_e2e;"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aguachiles_pos_e2e" npx --workspace=@aguachiles/api prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aguachiles_pos_e2e" npx tsx apps/api/prisma/seed.ts
```

Instala el navegador de Playwright una sola vez (`npx playwright install chromium` dentro de
`apps/e2e`), y luego, desde la raíz:

```bash
npm run test:e2e
```

Playwright levanta por sí solo la API (puerto 3100), el Print Agent (4100) y el frontend (5273) —
puertos distintos a los de desarrollo normal para poder correr en paralelo sin chocar — apuntando
a `aguachiles_pos_e2e`, corre la prueba, y los apaga al terminar. La prueba es segura de repetir
sin resetear la base entre corridas (cada pedido usa un folio nuevo; la sesión de caja siempre
queda cerrada al final), pero si se interrumpe a la mitad puede dejar una sesión de caja abierta —
en ese caso, recrea la base de datos (`DROP DATABASE` + los tres comandos de arriba) antes de
volver a correrla.

## Respaldo y restauración de la base de datos

El servidor local no tiene redundancia: si el contenedor de Postgres pierde su volumen, todo el
historial de ventas y caja se pierde. `apps/api/scripts/backup-db.ts` hace un `pg_dump` (formato
`custom`, comprimido) del contenedor de Postgres a un archivo local, y borra los respaldos más
viejos que el periodo de retención.

```bash
npm run backup:db --workspace=@aguachiles/api
```

Variables de entorno opcionales (con sus valores por defecto):

- `BACKUP_CONTAINER=aguachiles-postgres` — nombre del contenedor de Postgres.
- `BACKUP_DIR=./backups` — carpeta donde se guardan los `.dump` (relativa a `apps/api`). En
  producción, apunta esto a una unidad externa o carpeta sincronizada a la nube — un respaldo que
  vive en el mismo disco que la base de datos no protege contra una falla de disco.
- `BACKUP_RETENTION_DAYS=30` — respaldos más viejos que esto se eliminan automáticamente.

**Restaurar** un respaldo (reemplaza todos los datos actuales de la base indicada en
`DATABASE_URL` — úsalo con cuidado):

```bash
npm run restore:db --workspace=@aguachiles/api -- ./backups/aguachiles_pos_2026-01-15T03-00-00-000Z.dump
```

**Programar el respaldo diario** en el servidor de la tienda:

- Windows (Task Scheduler), ejecutando una vez al día:
  ```powershell
  schtasks /create /tn "Aguachiles POS - Backup DB" /sc daily /st 03:00 ^
    /tr "cmd /c cd /d C:\ruta\al\proyecto && npm run backup:db --workspace=@aguachiles/api"
  ```
- Linux/macOS (cron), agregar con `crontab -e`:
  ```
  0 3 * * * cd /ruta/al/proyecto && npm run backup:db --workspace=@aguachiles/api >> /var/log/aguachiles-backup.log 2>&1
  ```

El script termina con código de salida distinto de cero si el respaldo falla (contenedor caído,
`pg_dump` con error), para que el programador de tareas pueda reportarlo como fallido.

## Monitoreo

No hay un APM externo previsto para una sola sucursal (ver sección 8 del plan); el mecanismo de
monitoreo es una revisión periódica simple. `apps/api/scripts/check-health.ts` llama al endpoint
`/health` del backend y, si no responde o responde con error, lo registra en un archivo de log y
termina con código de salida distinto de cero (no escribe nada si todo está bien).

```bash
npm run check:health --workspace=@aguachiles/api
```

Variables de entorno opcionales: `HEALTH_CHECK_URL` (default `http://127.0.0.1:3000/health`),
`HEALTH_CHECK_LOG_FILE` (default `./logs/health-check.log`, relativo a `apps/api`),
`HEALTH_CHECK_TIMEOUT_MS` (default `5000`).

Prográmalo cada pocos minutos junto al respaldo diario:

- Windows (Task Scheduler):
  ```powershell
  schtasks /create /tn "Aguachiles POS - Health Check" /sc minute /mo 5 ^
    /tr "cmd /c cd /d C:\ruta\al\proyecto && npm run check:health --workspace=@aguachiles/api"
  ```
- Linux/macOS (cron):
  ```
  */5 * * * * cd /ruta/al/proyecto && npm run check:health --workspace=@aguachiles/api
  ```

Esto no envía notificaciones (SMS/email) por sí solo — eso requeriría configurar un canal externo
propio del negocio (proveedor de correo, webhook, etc.), fuera del alcance de un MVP de una sola
sucursal. Revisa `apps/api/logs/health-check.log` periódicamente, o conecta la tarea programada a
tu propio sistema de alertas si lo tienes.

## Estado actual (Fases 0–3 completas)

Las cuatro fases de [PLAN_POS.md](./PLAN_POS.md) están implementadas de punta a punta:

- **Fase 0** — monorepo, tooling, esquema de base de datos, auth (JWT + refresh token con
  rotación — la sesión sobrevive a recargar la página, no solo el access token en memoria).
- **Fase 1 (MVP)** — tablero de pedidos (crear/avanzar/cancelar), caja (abrir/cerrar con cálculo
  de diferencia), cobro en efectivo, tickets con impresión ESC/POS real vía el print-agent
  (reimpresión incluida), CRUD de catálogo (productos/categorías) desde la UI.
- **Fase 2** — pagos múltiples y divididos, ingresos/retiros de caja, devoluciones/reembolsos
  con reversión de inventario y caja, múltiples cajas concurrentes, proveedores y compras,
  reportes de ventas/corte de caja.
- **Fase 3** — permisos granulares por rol, auditoría avanzada visible en UI, multi-formato de
  ticket (58/80mm) y multi-impresora por terminal, cola de reintento ante caída del servidor
  local, dashboard analítico (márgenes, top productos, tendencia), esquema preparado para
  multi-sucursal.

Encima de eso, ya cerradas: suite de pruebas (unitarias, integración/API contra Postgres real,
constraints de DB, concurrencia — ver [Pruebas](#pruebas-appsapi) — y E2E con Playwright — ver
[Pruebas E2E](#pruebas-e2e-appse2e)), rate-limiting en login, ajuste manual de inventario,
reseteo de contraseña por un admin con pantalla de gestión de usuarios, y respaldo/restauración
y monitoreo de base de datos (ver las secciones correspondientes más abajo).

Pendiente y explícitamente fuera de alcance por ahora: cobertura de pruebas de los módulos
secundarios (proveedores, compras, analítica, recibos, métodos de pago) — hoy solo se ejercitan
indirectamente como dependencias de las pruebas de pedidos/caja/reembolsos.

La carpeta `referencia/` contiene el mockup de diseño original del negocio; es material de
referencia visual, no código de producción.
