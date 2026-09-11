-- El negocio solo opera dos canales reales: mostrador (gente que pasa a
-- recoger) y delivery (todo lo que llega por WhatsApp o llamada). Postgres no
-- permite quitar valores de un enum con ALTER TYPE, así que se crea el nuevo
-- tipo, se migran los datos existentes con una regla explícita, y se
-- reemplaza la columna y el tipo viejos.
--
-- Regla de migración de pedidos históricos: "digital_counter" (mostrador
-- digital) -> counter; cualquier otro valor (own_app, phone, whatsapp,
-- other -- todos llegaban por teléfono/WhatsApp para entrega) -> delivery.

CREATE TYPE "SaleChannel_new" AS ENUM ('counter', 'delivery');

ALTER TABLE "sales" ADD COLUMN "channel_new" "SaleChannel_new";

UPDATE "sales" SET "channel_new" = CASE
  WHEN "channel" = 'digital_counter' THEN 'counter'::"SaleChannel_new"
  ELSE 'delivery'::"SaleChannel_new"
END;

ALTER TABLE "sales" ALTER COLUMN "channel_new" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "channel_new" SET DEFAULT 'counter';

ALTER TABLE "sales" DROP COLUMN "channel";
ALTER TABLE "sales" RENAME COLUMN "channel_new" TO "channel";

DROP TYPE "SaleChannel";
ALTER TYPE "SaleChannel_new" RENAME TO "SaleChannel";
