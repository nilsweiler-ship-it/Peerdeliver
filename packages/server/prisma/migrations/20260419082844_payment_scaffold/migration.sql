-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'authorised', 'captured', 'refunded', 'voided', 'failed');

-- AlterTable
ALTER TABLE "delivery_requests" ADD COLUMN     "driverPayoutCHF" DOUBLE PRECISION,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedCHF" DOUBLE PRECISION,
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "stripeTransferId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
