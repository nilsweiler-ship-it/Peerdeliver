-- Re-add Stripe columns for the real-payment mode (alongside the simulated TWINT fields).
ALTER TABLE "users"
  ADD COLUMN "stripeAccountId" TEXT,
  ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "delivery_requests"
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "stripeTransferId" TEXT;
