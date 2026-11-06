# POS local y panel central

## Alcance de esta versión

Cada sucursal conserva su API y PostgreSQL en la red local. Una segunda instalación,
con `POS_MODE=central`, recibe proyecciones financieras y sirve el panel web del
administrador. La central no registra rutas de pedidos, cobros, inventario ni impresión.
Los administradores centrales se crean en su propia base; las contraseñas de los
cajeros y los datos de entrega de clientes no se sincronizan.

Se envían ventas (incluidas cancelaciones), pagos, devoluciones, sesiones de caja y
movimientos. El panel muestra cobros, devoluciones, neto, tickets, promedio bruto,
métodos de pago, cajas abiertas y últimos cinco cierres. El catálogo, los precios,
los usuarios de cada local y el inventario siguen administrándose en cada sucursal.
La primera versión permite consulta central solo a usuarios con rol `admin`; no
implementa todavía gerentes regionales con acceso a un subconjunto de sucursales.

## Componentes y garantías

- `sync_outbox`: triggers PostgreSQL guardan una proyección mínima de cada cambio
  dentro de la transacción original. Si la operación revierte, su evento también.
- `syncWorker.ts`: procesa lotes de hasta 100, reintenta con espera creciente hasta
  cinco minutos y mantiene una sola ejecución mediante un advisory lock de la base.
  Corre con la API, sin depender del navegador. Un fallo de internet no cancela ventas.
- `syncTransport.ts`: HTTPS fuera de loopback, timeout, sin redirecciones, validación
  del acuse completo. La cola solo marca los eventos confirmados.
- `sync_installations`: identidad, sucursal de origen, zona horaria, hash de credencial,
  última recepción y pendientes. La credencial de una instalación no sirve para otra.
- `sync_records`: proyecciones separadas de las tablas operativas. Su clave incluye
  instalación, entidad y UUID original; dos sucursales pueden tener ticket `#1`.
  Una versión antigua nunca reemplaza una nueva. Los tombstones evitan resurrecciones.
- No se usa un cursor global del tipo `sequence > último`: una transacción que
  confirme tarde sigue apareciendo como pendiente aunque tenga un número menor.
- La cola de pedidos del navegador ahora lleva `clientRequestId` desde el primer
  intento. El backend serializa la clave y devuelve el mismo pedido al reintentar;
  rechaza reutilizarla con otro contenido o usuario.

La entrega es **al menos una vez**, con aplicación idempotente. Un lote es atómico en
la central; una operación local grande puede cruzar lotes. Mientras queden pendientes,
los totales son provisionales. El indicador de última recepción no demuestra que la
tienda esté abierta, ni un valor cero demuestra que una sucursal desconectada no vendió.

## Preparar la central

1. Crear una base PostgreSQL vacía para la central, independiente de cualquier sucursal.
2. Configurar en el entorno del proceso `DATABASE_URL`, un `JWT_SECRET` nuevo de al
   menos 32 caracteres, `POS_MODE=central`, `CORS_ORIGIN` con el origen del panel y `PORT`.
3. Desde la raíz, ejecutar `npm ci`, `npm run build` y
   `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
4. Crear el administrador con una contraseña propia de al menos 12 caracteres:

```powershell
$env:POS_MODE = 'central'
$env:CENTRAL_ADMIN_PASSWORD = '<contraseña propia>'
npm run central:admin --workspace=@aguachiles/api -- administrador
Remove-Item Env:CENTRAL_ADMIN_PASSWORD
```

No ejecutar el seed de demostración en la central. `central:admin` crea únicamente
el rol, permisos y la cuenta indicada, y no reemplaza cuentas existentes.

5. Construir el frontend con `VITE_POS_MODE=central`, `VITE_API_URL` apuntando a la API
   HTTPS y `VITE_PRINT_AGENT_URL=http://127.0.0.1:4000` (el panel no usa impresión).
   Las variables Vite se fijan al compilar; reconstruir al cambiarlas.
6. Servir `apps/web/dist` con fallback de SPA a `index.html`; arrancar la API con
   `npm run start --workspace=@aguachiles/api`. Configurar HTTPS, reinicio automático,
   respaldo de PostgreSQL y supervisión del proceso en el proveedor elegido.

Los scripts leen las variables del proceso. Si se utiliza un archivo `.env`, el
servicio o shell debe cargarlo; crear el archivo por sí solo no configura el proceso.

## Vincular una sucursal

Respaldar primero la base local y programar una pausa breve para aplicar la migración.
La migración carga el historial existente a la cola mediante actualizaciones sin
cambiar importes; en bases grandes requiere tiempo y espacio de disco. Después:

1. Aplicar las mismas migraciones en la base local.
2. Obtener su UUID con `npm run sync:admin --workspace=@aguachiles/api -- locations`.
3. En la central, registrar el local con su UUID de origen y su zona IANA real:

```text
npm run sync:admin --workspace=@aguachiles/api -- register "Sucursal Centro" <locationId> America/Mazatlan
```

El comando requiere `POS_MODE=central` y devuelve un `installationId` y un token.
Guardar ese token en la configuración privada del servidor local; la central solo
almacena su hash. Para una sucursal nueva, crear una base independiente y sembrar su
catálogo; no clonar una base con ventas ni reutilizar la identidad de otra instalación.

4. En la sucursal, con `POS_MODE=local` y su propia `DATABASE_URL`:

```text
npm run sync:admin --workspace=@aguachiles/api -- bind <locationId> <installationId>
```

5. Configurar `SYNC_CENTRAL_URL=https://<api-central>`, `SYNC_TOKEN=<token>` y
   `SYNC_INTERVAL_MS=15000`. Reiniciar el proceso de API. Construir el frontend local
   con `VITE_POS_MODE=local` y su API de la red local.
6. Verificar que los pendientes bajen a cero y comparar ventas/cortes contra la central.

El enlace es estable: `bind` rechaza cambiar una instalación existente a otra sucursal.
Sin enlace explícito, los POS antiguos siguen operando si tienen exactamente una
sucursal activa. Con varias ubicaciones activas deben configurarse antes de vender.

## Operación y recuperación

- Sin internet: continúa el cobro local; los eventos permanecen en PostgreSQL.
- Si falla el servidor local o su red: el cobro completo sigue dependiendo de ese
  servidor. La cola del navegador solo protege la creación del pedido.
- Para desactivar un origen: `sync:admin -- revoke <installationId>` en la central.
- Para rotar su credencial: `sync:admin -- rotate <installationId>` y actualizar el
  token local. La rotación reactiva la instalación y no cambia su identidad.
- Para reconstruir una central vacía desde una sucursal íntegra, conservar la misma
  identidad y volver a marcar `sent_at = NULL` en su outbox, bajo un procedimiento
  supervisado. No borrar los eventos confirmados sin definir primero la retención
  y el respaldo necesarios para reconstruir el historial.
- Restaurar una **base local antigua** requiere reconciliar el historial central y
  la secuencia de la cola antes de reanudar envíos. No reiniciar ni reutilizar secuencias:
  las versiones antiguas se ignoran deliberadamente. No hay recuperación automática
  de pérdida de disco en esta versión; probar restauración y conciliación antes del
  despliegue definitivo. Sincronización no sustituye respaldos.

Los reportes centrales usan la fecha real de cada cobro/devolución en la zona horaria
de la sucursal, no la fecha de recepción en la nube. El promedio es cobro bruto/tickets;
los métodos muestran cobros brutos porque el modelo actual de devolución no asigna
el reembolso al método de pago original. Los reportes locales heredados mantienen
su criterio previo de fecha de creación; no comparar periodos sin considerar eso.

## Validación

`npm run lint`, `npm run typecheck`, `npm run build` y `npm run test`.
Las pruebas API aceptan `TEST_DATABASE_URL`; solo permiten la base llamada
`aguachiles_pos_test`. En Windows, usar `127.0.0.1` evita retrasos de resolución IPv6
de `localhost` al abrir conexiones concurrentes.

Las pruebas de sincronización ejercitan PostgreSQL y HTTP reales: caída de conexión,
reinicio del cliente, pérdida de acuse, reenvíos, versiones fuera de orden, lotes,
rollback, autenticación, aislamiento y zona horaria. Las de sucursal verifican
idempotencia, cobros concurrentes e identidad de caja.

Para el panel, crear `aguachiles_central_e2e`, aplicar migraciones, instalar Chromium
con `npx playwright install chromium`, configurar `E2E_CENTRAL_DATABASE_URL` y ejecutar
`npm run test:central --workspace=@aguachiles/e2e`. Prueba login, recepción real de
movimientos, filtro, formato de importes, ancho móvil y cierre de sesión.

## Siguientes etapas

Gestión visual de instalaciones, gerentes por sucursal, alertas externas, retención
automática y recuperación guiada de respaldos; después, catálogo central, precios
por sucursal e inventario/traspasos. La infraestructura de producción y las credenciales
de los locales reales se configuran al desplegar, no se incluyen en el repositorio.
