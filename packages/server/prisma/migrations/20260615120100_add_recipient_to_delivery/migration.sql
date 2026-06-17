-- AlterTable
ALTER TABLE "delivery_requests" ADD COLUMN "recipientId" TEXT,
ADD COLUMN "recipientEmail" TEXT;

-- CreateIndex
CREATE INDEX "delivery_requests_recipientId_idx" ON "delivery_requests"("recipientId");

-- AddForeignKey
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
