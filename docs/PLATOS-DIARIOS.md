# Disponibilidad diaria de platos

En el tablero, registra los platos disponibles de **1 kilo** y **1/2 kilo** antes
de crear el primer pedido del día. Son cantidades de platos completos, no kilos
de materia prima. Pueden empezar en cero. La captura es una sola por sucursal y
fecha, compartida entre sus cajas; cerrar o abrir caja no reinicia el conteo.

Todos los sabores de una presentación usan el mismo grupo. Vender un kilo no
consume dos medios kilos: los dos grupos se controlan de forma independiente.
En Catálogo → Editar producto → Presentación para conteo de platos puedes asignar
1 kilo, 1/2 kilo o indicar que ese producto no usa estos platos. Los extras no
consumen disponibilidad. La migración clasifica las presentaciones existentes
de kilo y medio kilo; revisa cualquier producto personalizado.

## Pedidos y conteos

- Crear pedido reserva sus platos de forma atómica, antes de imprimir la comanda.
- Cobrar cambia reservados a vendidos, sin consumir por segunda vez.
- Cancelar un pedido pendiente libera su reserva. Si ya se preparó y no se puede
  reutilizar, registra inmediatamente un ajuste negativo por merma.
- Reembolsar dinero no repone platos automáticamente.
- Los pedidos de la cola sin conexión no están confirmados ni reservados hasta
  que el servidor local los acepta; si ya no alcanza, quedan con error para revisión.
- Los pedidos existentes antes de esta migración conservan su funcionamiento y
  no se descuentan retroactivamente. Al activar esta función a mitad de jornada,
  registra únicamente lo que queda disponible para nuevos pedidos, descontando
  los platos de pedidos que ya estaban comprometidos.

El servidor valida cantidades enteras y disponibilidad, incluso ante peticiones
simultáneas, líneas repetidas, cambios del catálogo y reintentos de creación.
Los contadores y la reserva forman parte de la misma transacción que el pedido.

## Producción adicional y merma

Administradores y gerentes con `catalog.write` pueden pulsar **Ajustar platos**.
Captura cantidades positivas para agregar producción y negativas para quitar
disponibilidad, junto con el motivo. Un ajuste nunca puede retirar platos ya
reservados o vendidos. Los ajustes se registran con usuario, motivo y valores
anteriores/nuevos en la auditoría. Los reintentos de la misma solicitud de ajuste
de esta terminal no suman dos veces.

## Fecha y despliegue

La jornada cambia a medianoche según `POS_TIME_ZONE` de la API, por defecto
`America/Mazatlan`. Configura la zona IANA de cada sucursal antes de operar
(por ejemplo, `America/Chihuahua` si corresponde). Al cambiar de fecha se requiere
una nueva captura; los pedidos del día anterior conservan su reserva en su jornada.
Las cantidades y reservas se guardan en PostgreSQL y sobreviven reinicios.

Aplica `prisma migrate deploy` y genera el cliente de Prisma antes de iniciar
la API actualizada. No se cargan cantidades de producción en el seed real.
Este control de disponibilidad opera en la sucursal local; no se sincroniza
todavía al panel central. El inventario general de insumos sigue separado.
