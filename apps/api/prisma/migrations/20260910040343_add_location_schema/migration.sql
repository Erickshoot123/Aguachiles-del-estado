-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- Sucursal por defecto: cash_registers y sales ya tienen filas existentes,
-- así que location_id se agrega como nullable, se rellena con esta sucursal
-- y luego se vuelve NOT NULL (Fase 3: preparación de esquema para
-- multi-sucursal, sin UI de consolidación todavía).
INSERT INTO "locations" ("id", "name") VALUES ('00000000-0000-0000-0000-000000000001', 'Sucursal principal');

-- AlterTable
ALTER TABLE "cash_registers" ADD COLUMN "location_id" TEXT;
UPDATE "cash_registers" SET "location_id" = '00000000-0000-0000-0000-000000000001' WHERE "location_id" IS NULL;
ALTER TABLE "cash_registers" ALTER COLUMN "location_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "location_id" TEXT;
UPDATE "sales" SET "location_id" = '00000000-0000-0000-0000-000000000001' WHERE "location_id" IS NULL;
ALTER TABLE "sales" ALTER COLUMN "location_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
