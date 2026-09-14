-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cash_tendered_amount" DECIMAL(12,2),
ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "customer_phone" TEXT,
ADD COLUMN     "delivery_address" TEXT,
ADD COLUMN     "delivery_fee_amount" DECIMAL(12,2),
ADD COLUMN     "delivery_references" TEXT,
ADD COLUMN     "notes" TEXT;
