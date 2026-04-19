import { prisma } from '../config';
import type { CreateRouteInput } from '@peerdeliver/shared';

const ROUTE_COLS = `
  dr.id, dr."driverId",
  dr."originAddress", dr."destinationAddress",
  ST_AsGeoJSON(dr."originPoint") AS "originGeoJSON",
  ST_AsGeoJSON(dr."destinationPoint") AS "destinationGeoJSON",
  dr."routeType", dr."departureTime", dr."recurringDays",
  dr."availableSize", dr."maxDetourMinutes", dr."isActive",
  dr."createdAt", dr."updatedAt"
`;

interface RawRouteRow {
  id: string;
  driverId: string;
  originAddress: string;
  destinationAddress: string;
  originGeoJSON: string;
  destinationGeoJSON: string;
  routeType: string;
  departureTime: Date;
  recurringDays: string[];
  availableSize: string;
  maxDetourMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  originDistanceKm?: number;
  destinationDistanceKm?: number;
  driver?: unknown;
  [key: string]: unknown;
}

function transformRoute(row: RawRouteRow) {
  const originCoords = JSON.parse(row.originGeoJSON).coordinates;
  const destCoords = JSON.parse(row.destinationGeoJSON).coordinates;

  const { originGeoJSON, destinationGeoJSON, ...rest } = row;

  return {
    ...rest,
    originPoint: { lat: originCoords[1], lng: originCoords[0] },
    destinationPoint: { lat: destCoords[1], lng: destCoords[0] },
  };
}

export async function createRoute(driverId: string, input: CreateRouteInput) {
  const inserted: { id: string }[] = await prisma.$queryRaw`
    INSERT INTO driver_routes (
      id, "driverId", "originAddress", "originPoint",
      "destinationAddress", "destinationPoint",
      "routeType", "departureTime", "recurringDays",
      "availableSize", "maxDetourMinutes", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, ${driverId}, ${input.originAddress},
      ST_SetSRID(ST_MakePoint(${input.originPoint.lng}, ${input.originPoint.lat}), 4326),
      ${input.destinationAddress},
      ST_SetSRID(ST_MakePoint(${input.destinationPoint.lng}, ${input.destinationPoint.lat}), 4326),
      ${input.routeType}::"RouteType", ${new Date(input.departureTime)}::timestamp,
      ${input.recurringDays ?? []}::text[],
      ${input.availableSize}::"PackageSize", ${input.maxDetourMinutes ?? 15},
      true, NOW(), NOW()
    )
    RETURNING id
  `;

  return getRouteById(inserted[0].id);
}

export async function getRoutesByDriver(driverId: string) {
  const rows: RawRouteRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${ROUTE_COLS} FROM driver_routes dr WHERE dr."driverId" = $1 ORDER BY dr."createdAt" DESC`,
    driverId,
  );
  return rows.map(transformRoute);
}

export async function getRouteById(id: string) {
  const rows: RawRouteRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${ROUTE_COLS} FROM driver_routes dr WHERE dr.id = $1 LIMIT 1`,
    id,
  );
  return rows[0] ? transformRoute(rows[0]) : null;
}

export async function toggleRouteActive(id: string, isActive: boolean) {
  await prisma.driverRoute.update({
    where: { id },
    data: { isActive },
  });
  return getRouteById(id);
}

export async function deleteRoute(id: string) {
  return prisma.driverRoute.delete({ where: { id } });
}

export async function searchRoutes(fromLat: number, fromLng: number, toLat: number, toLng: number, radiusKm: number = 30) {
  const rows: RawRouteRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${ROUTE_COLS},
      ST_Distance(
        dr."originPoint"::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) / 1000 AS "originDistanceKm",
      ST_Distance(
        dr."destinationPoint"::geography,
        ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
      ) / 1000 AS "destinationDistanceKm",
      json_build_object(
        'id', u.id, 'firstName', u."firstName", 'lastName', u."lastName", 'avatarUrl', u."avatarUrl"
      ) AS driver
    FROM driver_routes dr
    JOIN users u ON u.id = dr."driverId"
    WHERE dr."isActive" = true
      AND ST_DWithin(
        dr."originPoint"::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $5
      )
      AND ST_DWithin(
        dr."destinationPoint"::geography,
        ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
        $5
      )
    ORDER BY "originDistanceKm" + "destinationDistanceKm" ASC
    LIMIT 50`,
    fromLat,
    fromLng,
    toLat,
    toLng,
    radiusKm * 1000,
  );
  return rows.map(transformRoute);
}
