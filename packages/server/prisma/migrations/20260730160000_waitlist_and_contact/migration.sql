-- Leads from the marketing site + Kontakt form.
CREATE TABLE "waitlist_signups" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "language" TEXT NOT NULL DEFAULT 'de',
    "source" TEXT NOT NULL DEFAULT 'website',
    "routeHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "waitlist_signups_email_key" ON "waitlist_signups"("email");
CREATE INDEX "waitlist_signups_createdAt_idx" ON "waitlist_signups"("createdAt");

CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "topic" TEXT,
    "message" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");
