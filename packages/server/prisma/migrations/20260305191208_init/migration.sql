-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('sender', 'driver', 'admin');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'matched', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "PackageSize" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "RouteType" AS ENUM ('one_time', 'recurring');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'unverified',
    "averageRating" DOUBLE PRECISION,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "co2Saved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_requests" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "driverId" TEXT,
    "pickupLabel" TEXT NOT NULL,
    "pickupPoint" geometry(Point, 4326) NOT NULL,
    "deliveryLabel" TEXT NOT NULL,
    "deliveryPoint" geometry(Point, 4326) NOT NULL,
    "packageSize" "PackageSize" NOT NULL,
    "packageWeight" DOUBLE PRECISION,
    "packageDescription" TEXT,
    "declaredValue" DOUBLE PRECISION,
    "budgetCHF" DOUBLE PRECISION NOT NULL,
    "platformFeeCHF" DOUBLE PRECISION,
    "deliveryWindowStart" TIMESTAMP(3) NOT NULL,
    "deliveryWindowEnd" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "pickupCode" TEXT,
    "deliveryCode" TEXT,
    "co2SavedKg" DOUBLE PRECISION,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_routes" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "originAddress" TEXT NOT NULL,
    "originPoint" geometry(Point, 4326) NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "destinationPoint" geometry(Point, 4326) NOT NULL,
    "routeType" "RouteType" NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "recurringDays" TEXT[],
    "availableSize" "PackageSize" NOT NULL,
    "maxDetourMinutes" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "delivery_requests_senderId_idx" ON "delivery_requests"("senderId");

-- CreateIndex
CREATE INDEX "delivery_requests_driverId_idx" ON "delivery_requests"("driverId");

-- CreateIndex
CREATE INDEX "delivery_requests_status_idx" ON "delivery_requests"("status");

-- CreateIndex
CREATE INDEX "driver_routes_driverId_idx" ON "driver_routes"("driverId");

-- CreateIndex
CREATE INDEX "driver_routes_isActive_idx" ON "driver_routes"("isActive");

-- CreateIndex
CREATE INDEX "messages_deliveryRequestId_idx" ON "messages"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "ratings_toUserId_idx" ON "ratings"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_deliveryRequestId_fromUserId_key" ON "ratings"("deliveryRequestId", "fromUserId");

-- AddForeignKey
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_routes" ADD CONSTRAINT "driver_routes_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
