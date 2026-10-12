-- Stock diario por producto, gestionado por cocina (null = sin límite)
-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "stock" INTEGER;
