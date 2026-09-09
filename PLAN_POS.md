# Plan Técnico — Sistema POS (Point of Sale)

> Documento de arquitectura y guía de implementación. **No contiene código.** Su objetivo es que cualquier desarrollador pueda implementar el sistema sin tener que rediseñar la arquitectura.

## 0. Estado del proyecto al momento del análisis

El directorio del proyecto (`Aguachiles del estado`) está **completamente vacío**: no existe repositorio git, código, `package.json` ni archivos de configuración. No hay nada que reutilizar; todo el stack se define desde cero en este documento.

Decisiones de alcance ya acordadas con el negocio:

- **Modelo de despliegue:** Web app + servidor local, con un *print agent* local por terminal para impresión térmica (no SaaS 100% en la nube, no app de escritorio nativa).
- **Alcance inicial:** Una sola sucursal, con posibilidad de varias cajas/terminales dentro de la misma ubicación física. El diseño deja la puerta abierta a multi-sucursal en el futuro, pero no lo implementa en el MVP.

### 0.1 Actualización — modelo de negocio real (delivery/cocina, no mostrador)

Tras iniciar la implementación de la Fase 0, el negocio proporcionó una referencia visual (`referencia/POS Aguachiles.dc.html`) que aclara el flujo real de operación: **Aguachiles del Estado opera como cocina enfocada en delivery/pickup**, no como mostrador de autoservicio con carrito de compra. Esto ajusta (sin invalidar) la arquitectura de las secciones siguientes:

- La pantalla principal de la aplicación (tras el login) **no es un carrito de venta**, sino un **tablero de pedidos estilo Kanban** con tres columnas de estado de cocina: **En preparación → En espera de recolección → En delivery**, con arrastrar-y-soltar para avanzar de estado y un botón "Nuevo pedido" para captura manual (mostrador digital).
- Cada pedido tiene un **canal de origen**: `App propia`, `Teléfono`, `WhatsApp`, `Mostrador digital` (y debe quedar abierto a agregar más canales — ej. plataformas de delivery de terceros — sin cambiar el modelo). Esto se modela como un campo `channel` en `sales` (sección 2.2).
- El **estado de cocina/despacho** (`fulfillment_status`: recibido → en preparación → en espera de recolección → en delivery → entregado/cancelado) es **independiente** del estado de pago/venta (`status`: completed/cancelled/refunded) — un pedido puede estar "en preparación" y ya "pagado en línea", o "entregado" y aún pendiente de cobro contra entrega.
- El módulo de **caja (sección 4)** se mantiene sin cambios: la referencia confirma que sigue existiendo un turno de caja abierto ("Caja abierta · Turno noche") independiente del tablero de pedidos — cada pedido, sin importar su canal, puede generar movimientos de caja al momento de su cobro.
- Catálogo (`products`/`categories`), inventario y reportes se mantienen conceptualmente igual — el mockup los llama "Menú y productos", "Inventario" y "Reportes" en la navegación lateral, confirmando que son los mismos módulos ya diseñados.
- **Identidad visual** a reutilizar como base de diseño del frontend (sección 1.2): tipografía `Archivo` (texto) + `IBM Plex Mono` (cifras/folios), fondo `#F6F3EF`, acento naranja `#E0651B`, texto principal `#1A1614`, bordes `#E7E1D9`.

El detalle de este ajuste está desarrollado en las secciones 1.2, 2.2 (tabla `sales`) y 3 (Fase 1).

---

## 1. Arquitectura del sistema

### 1.1 Arquitectura general

Arquitectura **cliente-servidor en red local (LAN)**, de 3 capas, con un componente adicional de impresión distribuido:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Servidor local (PC/mini-PC en la tienda)     │
│  ┌───────────────┐        ┌───────────────┐                     │
│  │   Backend API │◄──────►│   PostgreSQL  │                     │
│  │  (Node/Fastify)│       │               │                     │
│  └───────┬───────┘        └───────────────┘                     │
└──────────┼────────────────────────────────────────────────────┬─┘
           │ HTTP/REST (LAN)                                     │
   ┌───────┴────────┐                                   ┌────────┴───────┐
   │  Terminal 1     │                                  │  Terminal N     │
   │  Navegador (SPA)│                                  │  Navegador (SPA)│
   │  + Print Agent  │──USB/Red──► Impresora térmica     │  + Print Agent  │──USB/Red──► Impresora térmica
   └────────────────┘                                   └────────────────┘
```

- El **backend** y **PostgreSQL** corren en una sola máquina de la tienda (servidor local), que puede ser una de las cajas o un mini-PC dedicado.
- Cada **terminal** (caja) es un navegador que consume la API vía HTTP/REST sobre la red local — no requiere instalación, facilita actualizaciones (se actualiza solo el servidor).
- Cada terminal corre un **Print Agent** local (proceso ligero en `localhost`) porque la impresora térmica está conectada físicamente a esa terminal, no al servidor. El frontend nunca imprime directo desde el navegador (limitación de acceso a hardware); le pide al Print Agent local que imprima.
- Justificación: evita la complejidad y el costo de una app de escritorio nativa por terminal, mantiene actualización centralizada, y resuelve el único punto débil de una "pure web app" (impresión térmica y caja de dinero) con un agente local minimalista y reemplazable.

### 1.2 Frontend

- **React 18 + TypeScript** (SPA) servido por Vite.
- **TailwindCSS + shadcn/ui** para UI consistente y rápida de construir (pantalla de venta, catálogo, cortes de caja).
- **TanStack Query** para estado de servidor (cache, invalidación, reintentos) — nunca `fetch` directo disperso en componentes.
- **Zustand** para estado local efímero de UI (carrito en curso, sesión de caja activa en cliente).
- **React Hook Form + Zod** para formularios (apertura de caja, alta de producto, cliente, etc.), reutilizando los mismos esquemas Zod que el backend vía el paquete compartido `packages/shared`.
- Diseñado **offline-tolerant a nivel de LAN**: si el servidor local está caído, la app no vende (no hay "modo offline" de escritura en el MVP); se documenta como riesgo conocido y se revisita en Fase 3.

**Pantalla principal — tablero de pedidos:** la ruta raíz tras el login es un tablero Kanban ("Pedidos") con tres columnas (En preparación / En espera de recolección / En delivery), arrastrar-y-soltar para avanzar de estado, tarjeta de pedido con canal/tiempo transcurrido/total, modal de detalle y modal de ticket. Se construye como su propio feature (`features/orders`) con un `AppShell` compartido (sidebar de navegación: Pedidos, Menú y productos, Inventario, Caja y cierre, Reportes). El resto de pantallas (catálogo, inventario, caja, reportes) son rutas hijas del mismo `AppShell`.

**Identidad visual** (tomada de la referencia de diseño del negocio, aplicada como tema de Tailwind): tipografía `Archivo` (UI general) + `IBM Plex Mono` (cifras, folios, horas); paleta `--bg: #F6F3EF`, `--surface: #FFFFFF`, `--accent: #E0651B` / hover `#C4530F`, `--text: #1A1614`, `--text-muted: #7D7368`, `--border: #E7E1D9`. Se define una sola vez como tokens de Tailwind (`tailwind.config.js`) para que todas las pantallas futuras la hereden.

### 1.3 Backend

- **Node.js + TypeScript**, framework **Fastify** (validación de esquema integrada, bajo overhead, tipado fuerte con plugins TS).
- **Zod** para validar *todo* input de API (body, params, query) antes de tocar lógica de negocio.
- **Prisma ORM** sobre PostgreSQL — migraciones versionadas, tipado generado, buen soporte de transacciones.
- Autenticación **JWT** (access token corto + refresh token), autorización por **rol + permisos**.
- Organización en capas (ver 1.5).

### 1.4 Base de datos

- **PostgreSQL** (motor único, sin variantes SQLite en producción) por:
  - Transacciones ACID reales, necesarias para venta + inventario + caja como una sola operación atómica.
  - Tipo `numeric`/`decimal` nativo para dinero (nunca `float`).
  - Buen soporte de concurrencia (varias cajas vendiendo a la vez, control de bloqueos en inventario).
  - Camino claro de crecimiento a multi-sucursal (réplicas, particionado) sin cambiar de motor.

### 1.5 Stack tecnológico — resumen y justificación

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | React + TS + Vite | Ecosistema maduro, tipado estricto, HMR rápido para iterar en UI de venta |
| Estilos/UI | Tailwind + shadcn/ui | Velocidad de construcción, consistencia visual, accesible por defecto |
| Estado servidor | TanStack Query | Cache/invalidación declarativa, evita lógica de fetching duplicada |
| Estado local | Zustand | Minimalista, sin boilerplate, ideal para carrito/sesión de caja en memoria |
| Validación | Zod (compartido front/back) | Un solo esquema de verdad, elimina duplicación de reglas de validación |
| Backend | Node.js + Fastify + TS | Rendimiento, validación de esquema nativa, mismo lenguaje que el frontend (menor fricción de equipo) |
| ORM | Prisma | Migraciones versionadas, tipado generado, transacciones explícitas |
| DB | PostgreSQL | Integridad transaccional, tipos monetarios correctos, concurrencia |
| Print Agent | Node.js/TS + librería ESC/POS (`node-thermal-printer` o equivalente) | Acceso nativo a impresoras térmicas por terminal sin depender del navegador |
| Auth | JWT + bcrypt/argon2 | Estándar, sin estado en servidor más allá del token, fácil de rotar |

### 1.6 Estructura de carpetas propuesta (monorepo)

```
/ (raíz del repo)
├── apps/
│   ├── web/                  # Frontend React (SPA)
│   │   └── src/
│   │       ├── features/     # un subdirectorio por dominio: sales, inventory, cash, products...
│   │       │   └── sales/
│   │       │       ├── components/
│   │       │       ├── hooks/
│   │       │       ├── api.ts        # llamadas HTTP tipadas (usa TanStack Query)
│   │       │       └── types.ts
│   │       ├── components/ui/        # componentes shadcn/ui compartidos
│   │       ├── routes/
│   │       └── lib/
│   ├── api/                  # Backend Fastify
│   │   └── src/
│   │       ├── modules/              # un subdirectorio por dominio (mismo naming que web/features)
│   │       │   └── sales/
│   │       │       ├── sales.routes.ts        # presentación (Fastify routes)
│   │       │       ├── sales.schemas.ts       # Zod schemas de request/response
│   │       │       ├── sales.service.ts       # lógica de negocio (funciones puras donde aplique)
│   │       │       ├── sales.repository.ts    # acceso a datos (Prisma)
│   │       │       └── sales.errors.ts        # errores de dominio tipados
│   │       ├── plugins/              # auth, error-handler, cors, logger (infraestructura Fastify)
│   │       ├── prisma/
│   │       │   ├── schema.prisma
│   │       │   └── migrations/
│   │       └── config/                # carga y validación (Zod) de variables de entorno
│   └── print-agent/          # Servicio local por terminal
│       └── src/
│           ├── server.ts             # servidor HTTP local (localhost only)
│           ├── printers/             # adaptadores por marca/protocolo ESC/POS
│           └── queue.ts              # cola de reintentos de impresión
├── packages/
│   ├── shared/                # tipos + Zod schemas compartidos entre web/api/print-agent
│   └── config/                # eslint, tsconfig, prettier compartidos
├── .github/workflows/         # CI
└── PLAN_POS.md
```

Esta estructura respeta el límite de 250 líneas/archivo y 40 líneas/función de forma natural: cada archivo tiene una sola responsabilidad (rutas, esquema, servicio, repositorio, error), así que crecer implica *dividir por caso de uso dentro del módulo*, no engordar un archivo.

### 1.7 Comunicación entre frontend, backend y base de datos

- Frontend ↔ Backend: **REST sobre HTTP** (JSON), cada endpoint valida entrada y salida con **Zod** (esquemas compartidos desde `packages/shared`).
- Backend ↔ Base de datos: exclusivamente a través de **repositorios Prisma** (nunca SQL disperso en services/routes).
- Terminal ↔ Print Agent: HTTP local (`http://127.0.0.1:<puerto>/print`), solo accesible desde `localhost`, payload = ticket estructurado (JSON), nunca HTML crudo.
- (Opcional, Fase 3) **WebSocket** para eventos en tiempo real entre terminales del mismo servidor local (ej. alerta de stock bajo, bloqueo de caja en uso) — no es requisito de MVP.

### 1.8 Autenticación y autorización

- Login con email/usuario + contraseña (hash con `argon2` o `bcrypt`, nunca texto plano ni reversible).
- **JWT access token** de vida corta (ej. 15 min) + **refresh token** de vida larga almacenado de forma segura (httpOnly cookie o almacenamiento seguro local).
- **RBAC**: tabla `roles` con permisos granulares (`role_permissions`), roles base sugeridos: `admin`, `gerente`, `cajero`. Cada endpoint declara los permisos requeridos; un middleware Fastify los valida antes de llegar al handler.
- La UI oculta/deshabilita acciones según permisos del usuario autenticado, pero **la autorización real siempre se revalida en el backend** (nunca confiar solo en ocultar UI).

### 1.9 Manejo de errores y validación

- Validación de entrada: **Zod en el borde de cada endpoint** (body/query/params) — si falla, error 400 tipado, nunca se ejecuta lógica de negocio con datos no validados.
- Errores de dominio tipados y explícitos: `ValidationError`, `NotFoundError`, `ConflictError` (ej. stock insuficiente, caja ya cerrada), `UnauthorizedError`, `ForbiddenError` — cada uno mapea a un código HTTP fijo mediante un *error handler* central de Fastify.
- **Ningún `try/catch` silencia errores**: si se captura una excepción, se relanza como error de dominio tipado o se re-lanza tal cual; nunca un `catch` vacío o que solo hace `console.log`.
- Logging estructurado (ej. `pino`, ya integrado con Fastify) con nivel de severidad y `requestId` para trazabilidad.

---

## 2. Modelo de base de datos

### 2.1 Resumen de entidades y relaciones

```
categories 1───N products 1───1 inventory
                  │                 │
                  │                 └──N inventory_movements N───1 users
                  │                                          N───1 suppliers (nullable)
                  N
sale_items N───1 sales N───1 customers (nullable)
                  │  N───1 users (cajero)
                  │  N───1 cash_register_sessions N───1 cash_registers
                  │                               N───1 users (quien abrió/cerró)
                  N
sale_payments N───1 payment_methods

sales 1───1 receipts

refunds N───1 sales           refund_items N───1 refunds, N───1 sale_items

cash_movements N───1 cash_register_sessions
               N───1 payment_methods (nullable, solo si aplica)

users N───1 roles     roles N───N permissions (vía role_permissions)

audit_logs N───1 users (nullable, para acciones de sistema)
```

### 2.2 Definición de tablas

> Tipos en notación genérica SQL/Prisma. Todo monto usa `decimal(12,2)`. Todas las tablas incluyen `id` (UUID, PK), `created_at`, `updated_at` salvo que se indique lo contrario.

**`categories`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text, not null | único por `parent_id` |
| parent_id | uuid, FK → categories.id, nullable | permite subcategorías |
| is_active | boolean, default true | soft-delete lógico |

**`products`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| sku | text, unique, not null | |
| barcode | text, unique, nullable | |
| name | text, not null | |
| description | text, nullable | |
| category_id | uuid, FK → categories.id, not null | `ON DELETE RESTRICT` |
| price | decimal(12,2), not null, check >= 0 | precio de venta |
| cost | decimal(12,2), not null, check >= 0 | costo, para reportes de margen |
| tax_rate | decimal(5,2), not null, default 0 | % de impuesto |
| unit | text, not null | ej. `pieza`, `kg` |
| is_active | boolean, default true | soft-delete; nunca se borra físicamente si tiene ventas asociadas |

**`inventory`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid, FK → products.id, unique, not null | 1:1 en MVP de una sucursal |
| quantity | decimal(12,3), not null, default 0 | permite fracciones (kg) |
| min_stock | decimal(12,3), default 0 | umbral de alerta |

**`inventory_movements`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid, FK → products.id, not null | `ON DELETE RESTRICT` |
| type | enum(`sale`,`purchase`,`adjustment_in`,`adjustment_out`,`return`) | |
| quantity | decimal(12,3), not null, check <> 0 | |
| previous_stock | decimal(12,3), not null | snapshot antes del movimiento |
| new_stock | decimal(12,3), not null | snapshot después — debe cuadrar con `previous_stock ± quantity` (validado en service, no en DB) |
| reference_type | enum(`sale`,`purchase_order`,`manual`), nullable | referencia polimórfica |
| reference_id | uuid, nullable | id de la venta/compra que originó el movimiento |
| supplier_id | uuid, FK → suppliers.id, nullable | solo si `type = purchase` |
| user_id | uuid, FK → users.id, not null | quién generó el movimiento |
| reason | text, nullable | obligatorio en ajustes manuales (validado en service) |

**`customers`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text, not null | |
| phone | text, nullable | |
| email | text, nullable, unique | |
| tax_id | text, nullable | RFC/factura |
| address | text, nullable | |
| is_active | boolean, default true | |

**`roles`** (`id`, `name` único), **`permissions`** (`id`, `code` único, `description`), **`role_permissions`** (`role_id`, `permission_id`, PK compuesta).

**`users`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text, not null | |
| email | text, unique, not null | |
| password_hash | text, not null | nunca exponer en ninguna respuesta de API |
| role_id | uuid, FK → roles.id, not null | `ON DELETE RESTRICT` |
| is_active | boolean, default true | desactivar en vez de borrar (historial de auditoría) |

**`cash_registers`** (`id`, `name`, `location`, `is_active`) — representa una caja física/terminal.

**`cash_register_sessions`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| cash_register_id | uuid, FK → cash_registers.id, not null | |
| opened_by_user_id | uuid, FK → users.id, not null | |
| closed_by_user_id | uuid, FK → users.id, nullable | |
| opening_amount | decimal(12,2), not null | fondo inicial/caja chica |
| expected_closing_amount | decimal(12,2), nullable | calculado al cierre (fondo + ventas efectivo + ingresos − retiros) |
| actual_closing_amount | decimal(12,2), nullable | efectivo contado físicamente |
| difference | decimal(12,2), nullable | `actual - expected`, puede ser negativo |
| status | enum(`open`,`closed`), not null, default `open` | solo una sesión `open` por `cash_register_id` a la vez (constraint parcial única) |
| opened_at | timestamptz, not null | |
| closed_at | timestamptz, nullable | |

**`payment_methods`** (`id`, `name`, `type` enum(`cash`,`card`,`transfer`,`other`), `is_active`).

**`cash_movements`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| session_id | uuid, FK → cash_register_sessions.id, not null | `ON DELETE RESTRICT` |
| type | enum(`sale_income`,`withdrawal`,`deposit`,`expense`) | |
| payment_method_id | uuid, FK → payment_methods.id, nullable | nulo en ajustes que no son de un método específico |
| amount | decimal(12,2), not null, check > 0 | signo lo da `type`, no el valor |
| description | text, nullable | obligatorio en `withdrawal`/`deposit`/`expense` (validado en service) |
| user_id | uuid, FK → users.id, not null | |

**`sales`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| ticket_number | text, unique, not null | folio secuencial legible (ej. `A-000123`) |
| customer_id | uuid, FK → customers.id, nullable | venta a público general si es nulo |
| user_id | uuid, FK → users.id, not null | cajero |
| cash_register_session_id | uuid, FK → cash_register_sessions.id, nullable | `ON DELETE RESTRICT`; nulo mientras el pedido no se ha cobrado (puede crearse en estado `received` antes del cobro) |
| status | enum(`completed`,`cancelled`,`refunded`,`partially_refunded`) | estado de **pago/venta** |
| channel | enum(`own_app`,`phone`,`whatsapp`,`digital_counter`,`other`) | canal de origen del pedido |
| fulfillment_status | enum(`received`,`in_prep`,`waiting_pickup`,`in_delivery`,`delivered`,`cancelled`) | estado de **cocina/despacho**, independiente de `status`; impulsa el tablero Kanban de "Pedidos" |
| subtotal | decimal(12,2), not null | |
| tax_total | decimal(12,2), not null | |
| discount_total | decimal(12,2), not null, default 0 | |
| total | decimal(12,2), not null | `subtotal + tax_total - discount_total`, validado en service |

**`sale_items`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| sale_id | uuid, FK → sales.id, not null | `ON DELETE RESTRICT` |
| product_id | uuid, FK → products.id, not null | `ON DELETE RESTRICT` — nunca se borra un producto vendido |
| quantity | decimal(12,3), not null, check > 0 | |
| unit_price | decimal(12,2), not null | snapshot del precio al momento de la venta (no depende del precio actual del producto) |
| discount | decimal(12,2), not null, default 0 | |
| tax_amount | decimal(12,2), not null | |
| subtotal | decimal(12,2), not null | |

**`sale_payments`** (soporta pagos divididos)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| sale_id | uuid, FK → sales.id, not null | |
| payment_method_id | uuid, FK → payment_methods.id, not null | |
| amount | decimal(12,2), not null, check > 0 | suma de todos los `amount` de una venta debe igualar `sales.total` (validado en service, no en constraint DB) |
| reference | text, nullable | folio de autorización de tarjeta, referencia de transferencia |

**`receipts`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| sale_id | uuid, FK → sales.id, unique, not null | 1:1 con la venta |
| format | enum(`thermal_58`,`thermal_80`,`pdf`) | |
| content_snapshot | jsonb, not null | copia estructurada del ticket para permitir reimpresión exacta aunque cambien datos del producto después |
| printed_at | timestamptz, nullable | primera impresión |
| reprint_count | integer, not null, default 0 | |

**`refunds`** (`id`, `sale_id` FK, `user_id` FK, `reason` text, `total_refunded` decimal, `status` enum(`pending`,`completed`), `created_at`).
**`refund_items`** (`id`, `refund_id` FK, `sale_item_id` FK, `quantity` decimal check > 0, `amount` decimal).

**`suppliers`** (`id`, `name`, `contact_name`, `phone`, `email`, `tax_id`, `is_active`).

**`audit_logs`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid, FK → users.id, nullable | nulo para acciones automatizadas del sistema |
| action | text, not null | ej. `cash_session.close`, `product.price_change`, `refund.create` |
| entity | text, not null | nombre de tabla/entidad afectada |
| entity_id | uuid, not null | |
| old_value | jsonb, nullable | |
| new_value | jsonb, nullable | |
| ip_address | text, nullable | |
| created_at | timestamptz, not null | |

### 2.3 Consideraciones de integridad de datos

- **Atomicidad de venta**: crear `sales` + `sale_items` + `inventory_movements` (uno por línea) + `sale_payments` + `cash_movements` (tipo `sale_income`) dentro de **una sola transacción de base de datos**. Si algo falla, se revierte todo.
- **Ciclo de vida de un pedido** (`sales.fulfillment_status`): un pedido puede crearse en `received` (recién entra por su `channel`, aún sin cobrar → `cash_register_session_id` nulo); al cobrarse se le asocia una sesión de caja y se generan `sale_payments`/`cash_movements`; el avance `in_prep → waiting_pickup → in_delivery → delivered` es independiente del cobro y lo gestiona el tablero Kanban. `fulfillment_status = cancelled` no revierte inventario si aún no se había descontado.
- **Dinero siempre en `decimal`**, nunca `float`/`double`, para evitar errores de redondeo en ventas y cortes de caja.
- **Snapshot de precio** en `sale_items.unit_price`: los reportes históricos no deben cambiar si el precio del producto se actualiza después.
- **Soft-delete** (`is_active`) en `products`, `customers`, `users`, `suppliers`: nunca se borran físicamente si tienen historial asociado; se desactivan.
- **Claves foráneas con `ON DELETE RESTRICT`** en todo lo referenciado por ventas/movimientos (no se puede borrar un producto, usuario o caja con historial).
- **Unicidad**: `products.sku`, `products.barcode` (si no nulo), `sales.ticket_number`, `users.email`.
- **Concurrencia**: al descontar inventario y al registrar movimientos de caja, usar transacción con nivel de aislamiento `SERIALIZABLE` (o `SELECT ... FOR UPDATE` sobre la fila de `inventory`) para evitar condiciones de carrera entre dos cajeros vendiendo el mismo producto al límite de stock.
- **Una sola sesión de caja abierta por `cash_register_id`**: constraint único parcial (`WHERE status = 'open'`) para impedir doble apertura.
- Todas las tablas de catálogo/operación llevan `created_at`/`updated_at` para trazabilidad básica, complementadas por `audit_logs` para las operaciones sensibles.

---

## 3. Módulos y desarrollo por fases

### Fase 0 — Preparación y arquitectura

- **Objetivos:** dejar listo el esqueleto técnico para que las fases siguientes sean solo construir features, no infraestructura.
- **Funcionalidades:** ninguna funcional de negocio.
- **Componentes:** monorepo (`apps/web`, `apps/api`, `apps/print-agent`, `packages/shared`, `packages/config`); configuración de linting/TS estricto/Prettier; esquema Prisma inicial con todas las tablas de la sección 2; pipeline CI (lint + typecheck + test) en cada PR; entorno de desarrollo local documentado (`.env.example`).
- **Dependencias:** ninguna.
- **Orden:** monorepo → tooling → esquema DB + primera migración → CI → esqueleto Fastify con auth base → esqueleto React con routing base.
- **Criterio de done:** `npm run build`/`lint`/`typecheck`/`test` pasan en CI sobre un proyecto vacío pero estructurado; login de un usuario semilla funciona end-to-end (frontend → backend → DB).

### Fase 1 — MVP

- **Objetivos:** el negocio puede operar su día a día real: recibir pedidos por canal, darles seguimiento en cocina hasta la entrega, y controlar caja.
- **Funcionalidades:** catálogo (productos/menú + categorías, alta/edición/baja lógica), **tablero de pedidos Kanban** (crear pedido manual "Mostrador digital", asignar canal, avanzar `fulfillment_status` recibido→en preparación→en espera→en delivery→entregado, modal de detalle, cancelar pedido), una caja registradora, apertura/cierre simple de caja (sin ingresos/retiros intermedios todavía), cobro de un pedido con un solo método de pago (efectivo), impresión de ticket básico (formato único, reutilizable como ticket de cocina y de cobro), clientes básicos (alta rápida, pedido a público general), usuarios y roles (admin/cajero).
- **Componentes:** módulos `products`, `categories`, `inventory` (descuento simple), `sales` (incluye `channel`/`fulfillment_status` y el tablero Kanban), `cash` (apertura/cierre), `receipts`, `print-agent` (impresión básica ESC/POS), `auth`/`users`.
- **Dependencias:** Fase 0 completa.
- **Orden recomendado:** auth/usuarios → catálogo (productos/categorías) → inventario base → apertura de caja → tablero de pedidos (crear pedido, avanzar estados de cocina) → cobro del pedido (efectivo, descuento de stock, ticket) → impresión.
- **Criterio de done:** un usuario puede loguearse, abrir caja, crear/recibir un pedido con su canal, avanzarlo por las columnas del tablero hasta "entregado", cobrarlo en efectivo con su ticket impreso, y cerrar caja viendo efectivo esperado vs contado. Todo queda persistido y es auditable en `inventory_movements`/`cash_movements`.

### Fase 2 — Funcionalidades adicionales

- **Objetivos:** cubrir operación real de un negocio con variedad de pagos y control financiero más fino.
- **Funcionalidades:** métodos de pago múltiples (tarjeta, transferencia) y **pagos divididos**; ingresos/retiros de caja durante el turno; devoluciones/reembolsos completos (`refunds`/`refund_items`) con reversión de inventario y caja; múltiples cajas/terminales simultáneas en la misma sucursal; proveedores y entradas de inventario por compra; reportes básicos (ventas por día/cajero/producto, corte de caja detallado); reimpresión de tickets.
- **Componentes:** extiende `sales`/`cash`/`inventory`; nuevos módulos `payments`, `refunds`, `suppliers`, `reports`.
- **Dependencias:** Fase 1 completa y estable.
- **Orden recomendado:** pagos múltiples/divididos → ingresos-retiros de caja → devoluciones → proveedores/compras → reportes → multi-caja concurrente (pruebas de concurrencia, ver sección 7).
- **Criterio de done:** una venta puede pagarse con 2+ métodos, una devolución revierte correctamente stock y caja, dos cajas operan a la vez sin condiciones de carrera en inventario, y existe un reporte de cierre de caja con desglose por método de pago.

### Fase 3 — Versión avanzada / final

- **Objetivos:** robustecer, preparar crecimiento (multi-sucursal) y cerrar brechas operativas.
- **Funcionalidades:** permisos granulares por rol (más allá de admin/cajero: gerente, solo-lectura, etc.); auditoría avanzada visible en UI (historial de cambios de precio, aperturas/cierres, reembolsos); resiliencia ante caída del servidor local (cola local en el navegador para reintentar venta cuando vuelva la conexión — alcance limitado, documentado como mejora, no bloqueante); soporte multi-formato de ticket (58mm/80mm) y multi-impresora por terminal; preparación de esquema para multi-sucursal (campo `location_id` transversal, aún sin UI de consolidación); dashboard analítico (márgenes, productos más vendidos, tendencias).
- **Componentes:** todos los módulos existentes reciben refinamiento; nuevo módulo `analytics`.
- **Dependencias:** Fase 2 completa y en producción con datos reales por al menos un ciclo de negocio (recomendado: 1 mes) para validar reportes.
- **Orden recomendado:** permisos granulares → auditoría en UI → multi-formato de ticket → resiliencia de red → analítica → esquema multi-sucursal.
- **Criterio de done:** el sistema sostiene operación diaria sin intervención manual en base de datos, con visibilidad completa de auditoría para el dueño del negocio y capacidad demostrada de escalar a una segunda sucursal sin reescritura de esquema.

---

## 4. Caja chica y operaciones de caja

- **Apertura de caja:** el cajero (o gerente) registra `opening_amount` (fondo inicial/caja chica) y crea una `cash_register_sessions` con `status = open`. No se puede vender sin una sesión abierta para esa `cash_register_id`.
- **Fondo inicial/caja chica:** es el `opening_amount`; se documenta como responsabilidad del gerente definir el monto estándar por turno (regla de negocio, no técnica).
- **Ingresos** (`cash_movements.type = deposit`): dinero agregado a la caja fuera de una venta (ej. cambio adicional). Requiere descripción obligatoria.
- **Retiros** (`type = withdrawal`): dinero sacado de la caja (ej. pago a proveedor en efectivo, depósito a banco a media jornada). Requiere descripción obligatoria y, según rol, puede requerir autorización de gerente (regla configurable vía permisos).
- **Ventas en efectivo:** cada venta pagada (total o parcialmente) en efectivo genera automáticamente un `cash_movements` tipo `sale_income` ligado a `sale_payments`, dentro de la misma transacción que la venta.
- **Otros métodos de pago:** también generan `cash_movements` (para trazabilidad completa del turno) pero **no cuentan como efectivo físico** al calcular `expected_closing_amount`; se reportan por separado en el corte.
- **Corte de caja (parcial, sin cerrar turno):** operación de solo lectura/reporte que calcula el efectivo esperado a un punto en el tiempo (`opening_amount + Σ sale_income efectivo + Σ deposit − Σ withdrawal`) sin cambiar el `status` de la sesión. Útil para verificaciones intermedias.
- **Cierre de caja:** el cajero cuenta el efectivo físico y lo captura como `actual_closing_amount`; el sistema calcula `expected_closing_amount` con la misma fórmula del corte y guarda `difference = actual - expected`. La sesión pasa a `status = closed`, `closed_at` y `closed_by_user_id` se registran.
- **Diferencias entre efectivo esperado y real:** se guardan siempre (positivas o negativas), nunca se "ajustan" silenciosamente; una diferencia significativa dispara un registro en `audit_logs` para revisión gerencial (umbral configurable).
- **Historial y auditoría:** toda sesión de caja queda consultable con su detalle completo de `cash_movements` y las ventas asociadas; aperturas, cierres y retiros/ingresos relevantes se registran también en `audit_logs` con el usuario responsable.

---

## 5. Tickets e impresión

- **Generación de tickets:** el backend construye un **documento de ticket estructurado** (JSON: encabezado del negocio, folio, fecha, líneas de venta, totales, forma de pago, pie) al completar una venta, y lo persiste en `receipts.content_snapshot`. La UI **no** genera el ticket como HTML acoplado a la pantalla de venta — el mismo modelo de datos sirve para imprimir térmico o exportar PDF.
- **Impresión térmica:** el frontend envía el `content_snapshot` al **Print Agent local** (`http://127.0.0.1:<puerto>/print`), que lo traduce a comandos ESC/POS y lo envía a la impresora conectada a esa terminal (USB o red local). La lógica de impresión vive exclusivamente en `apps/print-agent`, nunca en el navegador.
- **Diferentes tamaños/formatos:** `receipts.format` soporta `thermal_58`, `thermal_80` y `pdf` (para email/reimpresión en oficina); el Print Agent tiene un adaptador de formato por ancho de papel.
- **Reimpresión:** se reimprime siempre desde `content_snapshot` (nunca recalculando la venta), garantizando que el ticket reimpreso sea idéntico al original; cada reimpresión incrementa `reprint_count` y queda marcada como copia (ej. leyenda "REIMPRESIÓN") para evitar confusión contable.
- **Impresora predeterminada:** configuración **por terminal** (guardada en `localStorage` del navegador o en config del Print Agent), no global — cada caja puede tener una impresora distinta.
- **Manejo de errores de impresión:** el Print Agent mantiene una **cola de reintento local** (in-memory + persistencia a disco simple) si la impresora no responde (offline, sin papel); la UI muestra el error y permite reintentar manualmente o continuar la venta sin bloquear el cobro (la venta ya quedó registrada en el backend independientemente de si el ticket se imprimió).
- **Compatibilidad con impresoras comunes de POS:** diseño basado en el estándar **ESC/POS** (compatible con Epson TM-T20/T88, Star, y la mayoría de impresoras térmicas genéricas de 58/80mm); el Print Agent aísla el protocolo detrás de un adaptador, de forma que soportar una marca nueva es agregar un adaptador, no tocar el resto del sistema.

---

## 6. Pagos

- **Separación de capas:** el módulo `payments` (backend) contiene toda la lógica de negocio de cobro (validar montos, registrar `sale_payments`, disparar `cash_movements`); la UI solo captura la intención del usuario (qué métodos y montos) y llama a la API — **no** hay cálculo de totales/validación de pago en componentes de React más allá de UX inmediata (esa validación siempre se repite y es autoritativa en el backend).
- **Estrategia por método de pago:** cada `payment_method.type` (`cash`, `card`, `transfer`, `other`) se maneja a través de una interfaz común en el service (`registerPayment(saleId, method, amount, reference?)`), de forma que agregar un nuevo método (ej. pago con QR/wallet en el futuro) no cambia el flujo de venta, solo agrega un tipo más.
- **Efectivo:** requiere el módulo de caja (sección 4) — genera `cash_movements`.
- **Tarjeta / transferencia:** se registran con `reference` (folio de autorización/referencia bancaria) como campo libre; el MVP no integra una pasarela de pago/terminal punto de venta electrónico (se asume que el cobro con tarjeta ocurre en una terminal física externa y el cajero solo registra el resultado) — una integración con procesador de pagos queda fuera de alcance salvo que el negocio lo requiera explícitamente en una fase posterior.
- **Pagos divididos:** una venta puede tener **N filas en `sale_payments`** con distintos métodos; el backend valida que `Σ sale_payments.amount = sales.total` antes de marcar la venta como `completed`.
- **Reembolsos/devoluciones:** flujo propio (`refunds`/`refund_items`), no una "venta negativa": referencia la venta y las líneas originales, revierte inventario (`inventory_movements` tipo `return`) y genera el movimiento de caja/pago inverso correspondiente, todo dentro de una transacción atómica. Un reembolso queda auditado (`audit_logs`) y no se puede editar una vez `completed`, solo consultar.

---

## 7. Pruebas

- **Unitarias:** funciones puras de los `*.service.ts` (cálculo de totales de venta, cálculo de efectivo esperado en cierre de caja, cálculo de diferencia, validación de reglas de negocio) — sin tocar base de datos real, sin mocks de infraestructura innecesarios.
- **Integración:** repositorios (`*.repository.ts`) contra una base PostgreSQL real de pruebas (contenedor efímero), verificando que las queries y transacciones hacen lo esperado, incluyendo rollback ante error.
- **API:** pruebas de contrato sobre los endpoints Fastify (request → response, incluyendo casos de validación Zod fallida y errores de dominio mapeados a códigos HTTP correctos).
- **Base de datos:** pruebas de migraciones (aplican y revierten limpiamente), constraints (unicidad, `ON DELETE RESTRICT`, checks de monto/cantidad positivos).
- **E2E:** flujo completo de cajero (login → abrir caja → vender con pago dividido → imprimir ticket [Print Agent mockeado] → cerrar caja) usando un runner tipo Playwright contra el stack real levantado en CI.
- **Pruebas de caja:** apertura duplicada rechazada, corte intermedio no cambia estado, cierre calcula diferencia correctamente con combinaciones de efectivo/tarjeta/ingresos/retiros.
- **Pruebas de inventario:** descuento correcto por venta, rechazo de venta con stock insuficiente, ajuste manual registra `previous_stock`/`new_stock` correctos, devolución repone stock.
- **Pruebas de ventas:** totales con impuestos y descuentos, pagos divididos que no suman el total son rechazados, snapshot de precio no cambia si el producto se actualiza después.
- **Pruebas de concurrencia y errores:** dos ventas simultáneas del mismo producto al límite exacto de stock (solo una debe tener éxito); dos intentos de abrir sesión de caja en la misma `cash_register_id` a la vez (solo uno debe tener éxito); fallo del Print Agent no debe revertir ni bloquear una venta ya persistida.
- **Criterios de aceptación:** cobertura mínima acordada en `services`/`repositories` de módulos críticos (ventas, caja, inventario) antes de considerar una fase "terminada"; todo bug de concurrencia o de cálculo de dinero encontrado en pruebas es bloqueante para pasar de fase.

---

## 8. Despliegue

- **Entornos:**
  - *Desarrollo:* máquina del desarrollador, PostgreSQL en contenedor local, `.env.local`.
  - *Staging:* réplica del entorno de producción (misma topología servidor-local-en-LAN, pero en una máquina de pruebas) para validar antes de instalar en la tienda real.
  - *Producción:* la máquina servidor dentro de la sucursal.
- **Variables de entorno:** todas cargadas y **validadas con Zod al arrancar** el backend (falla rápido y claro si falta una variable, nunca un `undefined` silencioso en runtime); `.env.example` versionado como referencia, `.env` real nunca commiteado.
- **Migraciones de base de datos:** `Prisma Migrate`, versionadas en el repo, aplicadas de forma explícita en el despliegue (nunca `db push` en producción); cada migración revisada en PR igual que código de aplicación.
- **CI/CD:** en cada PR — lint, typecheck, tests (unitarias + integración contra Postgres efímero), build de los tres apps (`web`, `api`, `print-agent`). Al mergear a rama principal, build de artefactos listos para instalar/actualizar en el servidor de la tienda (proceso puede ser manual al inicio: copiar build + correr migración + reiniciar servicio).
- **Backups:** respaldo automático diario de PostgreSQL (`pg_dump` programado) con retención definida (ej. 30 días), almacenado fuera de la misma máquina si es posible (USB externo/nube) dado que es un servidor local de una sola sucursal.
- **Logs:** logging estructurado (`pino`) del backend con rotación de archivo local; el Print Agent también loggea sus intentos de impresión para diagnóstico.
- **Monitoreo:** endpoint de `healthcheck` en el backend (verifica conexión a DB); revisión periódica simple (script o servicio de monitoreo local) que alerte si el backend deja de responder, dado que no hay un APM externo previsto para una sola sucursal en el MVP.
- **Recuperación ante errores:** procedimiento documentado de restauración desde el último backup; el backend debe poder reiniciarse sin pérdida de datos ya committeados (las transacciones garantizan esto).
- **Estrategia de actualización:** dado que el frontend se sirve desde el mismo servidor, actualizar es: aplicar migraciones → desplegar nuevo build de `api`/`web` → reiniciar servicio backend; los navegadores de las terminales obtienen la versión nueva al recargar (no requiere tocar cada terminal). El Print Agent, al ser un proceso separado por terminal, se actualiza independientemente y con menor frecuencia.

---

## 9. Seguridad

- **Autenticación:** JWT (access + refresh), contraseñas con `argon2`/`bcrypt`, sin recuperación de contraseña por email en MVP salvo que el negocio lo requiera explícitamente (evita dependencia de un proveedor de correo desde el día uno); reseteo por un admin como alternativa simple.
- **Autorización basada en roles/permisos:** validación de permisos en **cada endpoint** (middleware), nunca solo en el frontend; principio de menor privilegio — un cajero no puede, por ejemplo, editar precios ni ver reportes financieros globales salvo que su rol lo incluya explícitamente.
- **Protección de credenciales:** `password_hash` nunca se incluye en ninguna respuesta de API (serialización explícita de los campos permitidos, no "todo el objeto de Prisma"); secretos (JWT secret, credenciales DB) solo en variables de entorno, nunca en el repo.
- **Validación de entradas:** Zod en el borde de cada endpoint (ver 1.9); rechazo explícito de campos no esperados.
- **Protección de APIs:** CORS restringido a los orígenes de la LAN de la tienda; rate-limiting básico en endpoints sensibles (login) para mitigar fuerza bruta; el Print Agent solo escucha en `127.0.0.1` (nunca expuesto a la red).
- **Auditoría de operaciones sensibles:** apertura/cierre de caja, retiros/ingresos, cambios de precio de producto, reembolsos, cambios de rol de usuario — todos generan entrada en `audit_logs` con usuario, valores antes/después y momento.
- **Buenas prácticas para datos de clientes y ventas:** captura mínima de datos personales (solo lo necesario para facturación/contacto), sin exponer `customers`/`sales` completos en logs, acceso a reportes de ventas restringido por rol.

---

## 10. Roadmap técnico (orden de implementación)

1. **Fase 0** — Monorepo, tooling (lint/TS estricto/CI), esquema Prisma completo (sección 2) + primera migración, esqueleto Fastify con auth base, esqueleto React con routing y login.
2. **Fase 1 (MVP)** — Usuarios/roles base → catálogo (categorías, productos) → inventario simple → apertura de caja → flujo de venta en efectivo (carrito, cobro, descuento de stock, generación de ticket) → impresión térmica básica vía Print Agent → cierre de caja con cálculo de diferencia.
3. **Fase 2** — Métodos de pago múltiples y pagos divididos → ingresos/retiros de caja → devoluciones/reembolsos → proveedores y entradas de inventario por compra → reportes de ventas/corte de caja → soporte de múltiples cajas concurrentes (con pruebas de concurrencia).
4. **Fase 3** — Permisos granulares → auditoría visible en UI → multi-formato/multi-impresora de ticket → resiliencia ante caída de red local → dashboard analítico → preparación de esquema para multi-sucursal.

Cada fase se considera terminada solo cuando cumple su criterio de "done" (sección 3) y pasa las pruebas correspondientes (sección 7) — no se avanza de fase con deuda técnica conocida en ventas, inventario o caja, por ser los tres módulos donde un error tiene impacto financiero directo.

---

## Anexo — Checklist de reglas de código (para quien implemente)

- Máximo 250 líneas por archivo / 40 líneas por función — dividir en submódulos cuando se exceda.
- Retorno temprano (`if (!condition) return;`) en vez de `else` anidado.
- Sin código comentado, sin imports sin usar.
- Prohibido `any` en TypeScript — interfaces/tipos estrictos siempre.
- Sin strings de UI ni URLs base hardcodeadas — usar constantes/config/variables de entorno.
- Ningún `try/catch` que silencie errores.
- Sin lógica de base de datos ni llamadas HTTP dentro de componentes UI.
- Toda entrada de API validada con Zod.
- Toda API nueva con manejo de errores tipado (sección 1.9).
- Funciones puras donde sea posible; separación clara entre presentación, lógica de negocio, acceso a datos e infraestructura (sección 1.3, estructura de carpetas en 1.6).
