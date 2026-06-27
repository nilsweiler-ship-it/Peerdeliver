-- Verification & trust signals on users.
ALTER TABLE "users"
  ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "idVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "plateVerified" BOOLEAN NOT NULL DEFAULT false;
