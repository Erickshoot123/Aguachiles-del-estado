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
crudo en `apps/print-agent/print-output/` (configurable con `PRINTER_INTERFACE`); para una
impresora de red real, cambia esa variable a `tcp://<ip>:9100`.

## Scripts de raíz

- `npm run lint` — ESLint sobre todo el monorepo.
- `npm run typecheck` — chequeo de tipos por workspace.
- `npm run build` — build de producción por workspace.
- `npm run test` — pruebas por workspace.

## Estado actual (Fase 1 en curso)

Fase 0 completa (monorepo, tooling, esquema de base de datos, auth). De la Fase 1 ya funcionan
de punta a punta: tablero de pedidos (crear/avanzar/cancelar), caja (abrir/cerrar con cálculo de
diferencia), cobro de pedidos en efectivo, y tickets con impresión ESC/POS real vía el
print-agent (reimpresión incluida). Pendiente: CRUD de catálogo desde la UI (hoy el menú solo se
carga por seed) y sesión persistente (el JWT vive en memoria, se pierde al recargar la página).

La carpeta `referencia/` contiene el mockup de diseño original del negocio; es material de
referencia visual, no código de producción.
