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

Levanta backend y frontend en terminales separadas:

```bash
npm run dev --workspace=@aguachiles/api
npm run dev --workspace=@aguachiles/web
```

La app queda en `http://localhost:5173`. Usuario semilla: `admin@aguachiles.local` /
`ChangeMe123!` (cámbialo antes de producción).

## Scripts de raíz

- `npm run lint` — ESLint sobre todo el monorepo.
- `npm run typecheck` — chequeo de tipos por workspace.
- `npm run build` — build de producción por workspace.
- `npm run test` — pruebas por workspace.

## Estado actual (Fase 0)

Esqueleto técnico: monorepo, tooling, esquema de base de datos completo (`apps/api/prisma/schema.prisma`),
autenticación (login + JWT) de punta a punta, y la pantalla principal (tablero de pedidos) con su
diseño visual definitivo pero sin datos reales todavía. La funcionalidad de negocio (crear/avanzar
pedidos, catálogo, caja, impresión) se construye en la Fase 1 — ver sección 3 de `PLAN_POS.md`.

La carpeta `referencia/` contiene el mockup de diseño original del negocio; es material de
referencia visual, no código de producción.
