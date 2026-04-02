import { prisma } from '../config';
import type { CreateRouteInput } from '@peerdeliver/shared';

export async function createRoute(driverId: string, input: CreateRouteInput) {
  // TODO: Use $queryRaw with ST_MakePoint for PostGIS geometry
  const route = await prisma.$queryRaw`
    INSERT INTO driver_routes (
      id, "driverId", "originAddress", "originPoint",
      "destinationAddress", "destinationPoint",
      "routeType", "departureTime", "recurringDays",
      "availableSize", "maxDetourMinutes", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${driverId}, ${input.originAddress},
      ST_SetSRID(ST_MakePoint(${input.originPoint.lng}, ${input.originPoint.lat}), 4326),
      ${input.destinationAddress},
      ST_SetSRID(ST_MakePoint(${input.destinationPoint.lng}, ${input.destinationPoint.lat}), 4326),
      ${input.routeType}::"RouteType", ${input.departureTime}::timestamp,
      ${input.recurringDays ?? []}::text[],
      ${input.availableSize}::"PackageSize", ${input.maxDetourMinutes ?? 15},
      true, NOW(), NOW()
    )
    RETURNING *
  `;
  return route;
}

export async function getRoutesByDriver(driverId: string) {
  return prisma.driverRoute.findMany({
    where: { driverId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRouteById(id: string) {
  return prisma.driverRoute.findUnique({ where: { id } });
}

export async function toggleRouteActive(id: string, isActive: boolean) {
  return prisma.driverRoute.update({
    where: { id },
    data: { isActive },
  });
}

export async function deleteRoute(id: string) {
  return prisma.driverRoute.delete({ where: { id } });
}

export async function searchRoutes(fromLat: number, fromLng: number, toLat: number, toLng: number, radiusKm: number = 30) {
  const routes = await prisma.$queryRaw`
    SELECT dr.*,
      ST_Distance(
        dr."originPoint"::geography,
        ST_SetSRID(ST_MakePoint(${fromLng}, ${fromLat}), 4326)::geography
      ) / 1000 AS "originDistanceKm",
      ST_Distance(
        dr."destinationPoint"::geography,
        ST_SetSRID(ST_MakePoint(${toLng}, ${toLat}), 4326)::geography
      ) / 1000 AS "destinationDistanceKm",
      json_build_object(
        'id', u.id, 'firstName', u."firstName", 'lastName', u."lastName", 'avatarUrl', u."avatarUrl"
      ) AS driver
    FROM driver_routes dr
    JOIN users u ON u.id = dr."driverId"
    WHERE dr."isActive" = true
      AND ST_DWithin(
        dr."originPoint"::geography,
        ST_SetSRID(ST_MakePoint(${fromLng}, ${fromLat}), 4326)::geography,
        ${radiusKm * 1000}
      )
      AND ST_DWithin(
        dr."destinationPoint"::geography,
        ST_SetSRID(ST_MakePoint(${toLng}, ${toLat}), 4326)::geography,
        ${radiusKm * 1000}
      )
    ORDER BY "originDistanceKm" + "destinationDistanceKm" ASC
    LIMIT 50
  `;
  return routes;
}
