-- El folio de ticket se generaba con `SELECT count(*) FROM sales` + 1, que no
-- es atómico: bajo pedidos concurrentes, dos transacciones pueden leer el
-- mismo conteo y calcular el mismo folio, chocando contra la unicidad de
-- ticket_number (el service reintentaba hasta 3 veces, pero con suficiente
-- concurrencia se agotan los reintentos y el pedido falla de verdad —
-- expuesto por una prueba de concurrencia tras quitar el paso de inventario,
-- que antes "de casualidad" serializaba lo suficiente las transacciones para
-- ocultar la condición de carrera). Una secuencia de Postgres es la forma
-- correcta: nextval() es atómico y seguro bajo alta concurrencia por diseño.
CREATE SEQUENCE "sale_ticket_number_seq";

-- Arranca la secuencia justo después del folio más alto ya usado, para no
-- chocar con ventas existentes en una base ya poblada (o en 1000 si está vacía,
-- igual que el esquema anterior: el primer folio sigue siendo #1001).
DO $$
DECLARE
  max_number integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace("ticket_number", '\D', '', 'g'), '')::integer), 1000)
    INTO max_number
  FROM "sales";
  PERFORM setval('sale_ticket_number_seq', max_number + 1, false);
END $$;
