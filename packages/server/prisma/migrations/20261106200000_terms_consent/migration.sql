-- Proof of consent to the terms and privacy policy.
--
-- Sign-up showed a checkbox (pre-ticked until 30 Oct) but nothing about it
-- reached the server, so there was no record of who accepted what, or when.
-- Existing accounts stay NULL: they never gave a recorded consent and should
-- be asked again before the public launch.

ALTER TABLE "users" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "termsVersion" TEXT;
