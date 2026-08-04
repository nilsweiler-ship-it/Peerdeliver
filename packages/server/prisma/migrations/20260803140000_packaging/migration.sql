-- Packaging choice, used in the CO2 calculation.
CREATE TYPE "Packaging" AS ENUM ('none', 'reused', 'cardboard', 'other');
ALTER TABLE "delivery_requests" ADD COLUMN "packaging" "Packaging";
