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

Pendiente (fuera del alcance actual): pruebas E2E con Playwright contra la UI real, y cobertura
exhaustiva endpoint-por-endpoint de módulos secundarios (proveedores, compras, analítica).

## Estado actual (Fase 1 en curso)

Fase 0 completa (monorepo, tooling, esquema de base de datos, auth). De la Fase 1 ya funcionan
de punta a punta: tablero de pedidos (crear/avanzar/cancelar), caja (abrir/cerrar con cálculo de
diferencia), cobro de pedidos en efectivo, tickets con impresión ESC/POS real vía el print-agent
(reimpresión incluida), CRUD de catálogo (productos/categorías) desde la UI, y sesión persistente
(refresh token con rotación — la sesión sobrevive a recargar la página, no solo el access token
en memoria).

La carpeta `referencia/` contiene el mockup de diseño original del negocio; es material de
referencia visual, no código de producción.
