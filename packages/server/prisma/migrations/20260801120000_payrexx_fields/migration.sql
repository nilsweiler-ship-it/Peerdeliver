-- Real TWINT payments via Payrexx.
ALTER TABLE "delivery_requests" ADD COLUMN "payrexxGatewayId" TEXT;
ALTER TABLE "delivery_requests" ADD COLUMN "payrexxTransactionId" TEXT;
