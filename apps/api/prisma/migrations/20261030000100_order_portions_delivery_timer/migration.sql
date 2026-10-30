ALTER TABLE "sale_items" ADD COLUMN "notes" TEXT;
ALTER TABLE "sales" ADD COLUMN "delivery_due_at" TIMESTAMP(3);
-- Los pedidos ya en ruta reciben 25 minutos desde la actualización.
UPDATE "sales" SET "delivery_due_at" = CURRENT_TIMESTAMP + INTERVAL '25 minutes'
WHERE "channel" = 'delivery' AND "fulfillment_status" = 'in_delivery' AND "status" <> 'cancelled';
CREATE INDEX "sales_delivery_due_at_idx" ON "sales" ("delivery_due_at")
WHERE "channel" = 'delivery' AND "fulfillment_status" = 'in_delivery';
