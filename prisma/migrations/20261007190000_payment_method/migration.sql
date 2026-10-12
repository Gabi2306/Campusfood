-- Medio de pago elegido (tarjeta, billetera digital o saldo institucional)
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN "paymentMethod" TEXT;
