import { prisma } from '../config';
import { generateCode } from '../utils';
import type { CreateDeliveryInput } from '@peerdeliver/shared';

export async function createDelivery(senderId: string, input: CreateDeliveryInput) {
  const pickupCode = generateCode();
  const deliveryCode = generateCode();

  const result: any[] = await prisma.$queryRaw`
    INSERT INTO delivery_requests (
      id, "senderId", "pickupLabel", "pickupPoint", "deliveryLabel", "deliveryPoint",
      "packageSize", "packageWeight", "packageDescription", "declaredValue",
      "budgetCHF", "deliveryWindowStart", "deliveryWindowEnd",
      status, "pickupCode", "deliveryCode", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, ${senderId}, ${input.pickupAddress.label},
      ST_SetSRID(ST_MakePoint(${input.pickupAddress.point.lng}, ${input.pickupAddress.point.lat}), 4326),
      ${input.deliveryAddress.label},
      ST_SetSRID(ST_MakePoint(${input.deliveryAddress.point.lng}, ${input.deliveryAddress.point.lat}), 4326),
      ${input.packageSize}::"PackageSize", ${input.packageWeight ?? null}, ${input.packageDescription ?? null},
      ${input.declaredValue ?? null}, ${input.budgetCHF},
      ${new Date(input.deliveryWindowStart)}, ${new Date(input.deliveryWindowEnd)},
      'pending'::"DeliveryStatus", ${pickupCode}, ${deliveryCode},
      NOW(), NOW()
    )
    RETURNING id, "senderId", "pickupLabel", "deliveryLabel",
      "packageSize", "packageWeight", "packageDescription", "declaredValue",
      "budgetCHF", "deliveryWindowStart", "deliveryWindowEnd",
      status, "pickupCode", "deliveryCode", "createdAt", "updatedAt"
  `;
  return result[0];
}

export async function getDeliveriesBySender(senderId: string) {
  return prisma.deliveryRequest.findMany({
    where: { senderId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDeliveriesByDriver(driverId: string) {
  return prisma.deliveryRequest.findMany({
    where: { driverId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDeliveryById(id: string) {
  return prisma.deliveryRequest.findUnique({ where: { id } });
}

export async function updateDeliveryStatus(id: string, status: string, cancelledBy?: string, cancelReason?: string) {
  return prisma.deliveryRequest.update({
    where: { id },
    data: { status: status as any, cancelledBy, cancelReason },
  });
}

export async function getNearbyDeliveries(lat: number, lng: number, radiusKm: number = 50) {
  const deliveries = await prisma.$queryRaw`
    SELECT dr.*,
      ST_Distance(
        dr."pickupPoint"::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) / 1000 AS "distanceKm",
      json_build_object(
        'id', u.id, 'firstName', u."firstName", 'lastName', u."lastName", 'avatarUrl', u."avatarUrl"
      ) AS sender
    FROM delivery_requests dr
    JOIN users u ON u.id = dr."senderId"
    WHERE dr.status = 'pending'
      AND ST_DWithin(
        dr."pickupPoint"::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusKm * 1000}
      )
    ORDER BY "distanceKm" ASC
    LIMIT 50
  `;
  return deliveries;
}

export async function assignDelivery(deliveryId: string, driverId: string) {
  return prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: {
      driverId,
      status: 'matched' as any,
    },
  });
}
