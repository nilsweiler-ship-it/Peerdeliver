-- AlterEnum
ALTER TYPE "DeliveryStatus" ADD VALUE 'requested';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "carModel" TEXT,
ADD COLUMN     "licensePlate" TEXT,
ADD COLUMN     "maxLoadKg" DOUBLE PRECISION;
