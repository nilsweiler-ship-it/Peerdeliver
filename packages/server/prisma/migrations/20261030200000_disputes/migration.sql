-- Disputes: a place for a delivery that went wrong after pickup.
--
-- Until now there was none. Once the pickup code was used the only states
-- left were "delivered" and an unrestricted cancel that refunded the sender
-- in full — so a parcel that never arrived, or arrived broken, either sat in
-- 'in_transit' forever with the sender's money held, or was "cancelled" with
-- the driver's pay clawed back. 'disputed' holds the money and puts a person
-- (support) in charge of the outcome.

ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'disputed';

ALTER TABLE "delivery_requests" ADD COLUMN "disputeOpenedAt" TIMESTAMP(3);
ALTER TABLE "delivery_requests" ADD COLUMN "disputeOpenedById" TEXT;
ALTER TABLE "delivery_requests" ADD COLUMN "disputeReason" TEXT;
ALTER TABLE "delivery_requests" ADD COLUMN "disputeResolvedAt" TIMESTAMP(3);
ALTER TABLE "delivery_requests" ADD COLUMN "disputeResolution" TEXT;
