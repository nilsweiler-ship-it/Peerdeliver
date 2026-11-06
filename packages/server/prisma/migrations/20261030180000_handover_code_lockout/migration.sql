-- Count wrong handover codes per delivery, and lock code entry after repeats.
--
-- A handover code is six digits: a million possibilities and, until now,
-- unlimited tries. A driver holding a parcel could keep guessing the delivery
-- code, limited only by the global per-IP rate limit, which is a few hours of
-- work across a handful of IPs. Purely additive; existing rows start at zero.

ALTER TABLE "delivery_requests" ADD COLUMN "codeFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "delivery_requests" ADD COLUMN "codeLockedUntil" TIMESTAMP(3);
