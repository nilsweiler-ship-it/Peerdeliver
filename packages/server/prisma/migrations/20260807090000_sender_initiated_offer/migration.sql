-- Sender-initiated matching.
--
-- Until now a match could only start with the driver: they claimed a delivery
-- ("requested") and the sender confirmed. A sender who found a suitable
-- published route had no way to act on it. This adds the mirror state.
--
-- `offered` is a new status rather than a reuse of `requested` because the two
-- differ in who is waiting: with `requested` the sender must decide, with
-- `offered` the driver must. Both sides render a different screen, and
-- collapsing them would make an open item unattributable.

-- Postgres allows ALTER TYPE ... ADD VALUE inside a transaction from 12
-- onwards; the new label simply cannot be referenced until this commits. This
-- migration only declares it, so that restriction does not apply here.
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'offered';

-- Which route was targeted. Deliberately not a foreign key: a driver deleting
-- a route must not be blocked by an open offer, nor should the delete cascade
-- into somebody else's delivery.
ALTER TABLE "delivery_requests" ADD COLUMN IF NOT EXISTS "offeredRouteId" TEXT;
