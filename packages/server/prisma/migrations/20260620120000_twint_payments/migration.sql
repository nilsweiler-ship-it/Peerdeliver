-- Replace Stripe with simulated TWINT payments.

-- Drop Stripe Connect columns from users
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "stripeAccountId",
  DROP COLUMN IF EXISTS "stripePayoutsEnabled",
  DROP COLUMN IF EXISTS "stripeDetailsSubmitted";

-- Swap Stripe payment columns for TWINT on delivery_requests
ALTER TABLE "delivery_requests"
  DROP COLUMN IF EXISTS "stripePaymentIntentId",
  DROP COLUMN IF EXISTS "stripeTransferId",
  ADD COLUMN "twintRef" TEXT,
  ADD COLUMN "twintPhone" TEXT;
