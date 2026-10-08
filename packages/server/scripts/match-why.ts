/**
 * Why did this delivery and that route not match?
 *
 *   npm run match:why                 # every pending delivery × every active route
 *   npm run match:why <deliveryId>    # one delivery, explained
 *
 * Matching is the product. When a sender publishes a parcel and a driver
 * publishes the same corridor and they do not find each other, there are six
 * independent reasons it can happen and the app shows none of them — it shows
 * an empty list, which looks identical to "nobody is driving that way".
 *
 * This prints the actual numbers the two SQL queries use, so the answer is a
 * fact rather than a theory:
 *
 *   · getNearbyDeliveries (driver's "Verfügbare Lieferungen") filters on
 *     status, distance from the SEARCH centre, the driver's vehicle size, and
 *     the driver's max load.
 *   · searchRoutes (sender's "fahrende Personen suchen") filters only on
 *     isActive and the two endpoint distances.
 *
 * Read-only.
 */
import 'dotenv/config';
import { prisma } from '../src/config';
import { PACKAGE_SIZES } from '@peerdeliver/shared';

const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

/** The hardcoded centre AvailableDeliveriesScreen searches from. */
const SEARCH = { lat: 47.3769, lng: 8.5417, radius: 100, label: 'Zürich (hardcoded in the app)' };

const SIZE_ORDER = ['S', 'M', 'L', 'XL'] as const;
type Size = (typeof SIZE_ORDER)[number];
const sizesUpTo = (v: Size) => SIZE_ORDER.slice(0, SIZE_ORDER.indexOf(v) + 1);

interface Row {
  id: string;
  label: string;
  status: string;
  size: Size;
  weight: number | null;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fromSearchKm: number;
}

interface RouteRow {
  id: string;
  driver: string;
  driverId: string;
  isActive: boolean;
  /** Declared on the ROUTE. Nothing filters on it today. */
  availableSize: Size | null;
  /** Declared on the USER. This is what getNearbyDeliveries actually filters on. */
  vehicleSize: Size | null;
  maxLoadKg: number | null;
  departureTime: Date | null;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat));
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function main() {
  const wanted = process.argv[2];

  const deliveries = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT dr.id,
            COALESCE(NULLIF(dr."packageDescription", ''), '(no description)') AS label,
            dr.status::text AS status,
            dr."packageSize"::text AS size,
            dr."packageWeight" AS weight,
            ST_Y(dr."pickupPoint") AS "pickupLat", ST_X(dr."pickupPoint") AS "pickupLng",
            ST_Y(dr."deliveryPoint") AS "dropLat", ST_X(dr."deliveryPoint") AS "dropLng",
            ST_Distance(dr."pickupPoint"::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000 AS "fromSearchKm"
       FROM delivery_requests dr
      WHERE ($3::text IS NULL OR dr.id = $3)
      ORDER BY dr."createdAt" DESC
      LIMIT 12`,
    SEARCH.lat,
    SEARCH.lng,
    wanted ?? null,
  );

  const routes = await prisma.$queryRawUnsafe<RouteRow[]>(
    `SELECT dr.id, (u."firstName" || ' ' || u."lastName") AS driver, u.id AS "driverId",
            dr."isActive", dr."availableSize"::text AS "availableSize",
            u."vehicleSize"::text AS "vehicleSize", u."maxLoadKg",
            dr."departureTime",
            ST_Y(dr."originPoint") AS "originLat", ST_X(dr."originPoint") AS "originLng",
            ST_Y(dr."destinationPoint") AS "destLat", ST_X(dr."destinationPoint") AS "destLng"
       FROM driver_routes dr JOIN users u ON u.id = dr."driverId"
      ORDER BY dr."createdAt" DESC LIMIT 12`,
  );

  console.log(bold('\nWhy things match, or do not'));
  console.log(dim('─'.repeat(78)));

  console.log(bold('\nRoutes') + dim(`  ${routes.length} most recent`));
  if (!routes.length) console.log(r('  None. A sender searching for drivers will always find nothing.'));
  for (const rt of routes) {
    console.log(
      `\n  ${rt.isActive ? g('active  ') : r('INACTIVE')} ${bold(rt.driver)} ${dim(rt.id.slice(0, 8))}`,
    );
    console.log(
      dim(
        `    ${rt.originLat.toFixed(4)},${rt.originLng.toFixed(4)} → ${rt.destLat.toFixed(4)},${rt.destLng.toFixed(4)}` +
          `  ·  vehicle ${rt.vehicleSize ?? 'unset'}  ·  max load ${rt.maxLoadKg ?? 'unset'} kg` +
          `  ·  departs ${rt.departureTime ? rt.departureTime.toISOString().slice(0, 16) : '—'}`,
      ),
    );
    if (!rt.isActive) {
      console.log(r('    searchRoutes filters on isActive — this route is invisible to every sender.'));
    }
  }

  console.log(bold('\nDeliveries') + dim(`  ${deliveries.length} most recent`));
  for (const d of deliveries) {
    console.log(`\n  ${bold(d.label.slice(0, 36))} ${dim(d.id)}`);
    console.log(
      dim(
        `    status ${d.status}  ·  size ${d.size}  ·  weight ${d.weight ?? 'unset'} kg` +
          `  ·  ${d.fromSearchKm.toFixed(1)} km from ${SEARCH.label}`,
      ),
    );

    // Would it appear in a driver's "Verfügbare Lieferungen"?
    const reasons: string[] = [];
    if (d.status !== 'pending') reasons.push(`status is "${d.status}", the query only shows "pending"`);
    if (d.fromSearchKm > SEARCH.radius)
      reasons.push(`${d.fromSearchKm.toFixed(0)} km from the search centre, radius is ${SEARCH.radius} km`);
    console.log(
      reasons.length
        ? `    ${r('✗')} hidden from the driver list: ${reasons.join('; ')}`
        : `    ${g('✓')} visible in the driver list, subject to each driver's vehicle`,
    );

    // And per route — the capacity filters that hide it from one driver and
    // not another, which is the part no screen explains.
    for (const rt of routes) {
      const allowed = rt.vehicleSize ? sizesUpTo(rt.vehicleSize) : SIZE_ORDER;
      const sizeOk = allowed.includes(d.size);
      const weightOk = rt.maxLoadKg == null || d.weight == null || d.weight <= rt.maxLoadKg;
      const oKm = km(rt.originLat, rt.originLng, d.pickupLat, d.pickupLng);
      const dKm = km(rt.destLat, rt.destLng, d.dropLat, d.dropLng);
      const near = oKm <= 30 && dKm <= 30;

      const faults: string[] = [];
      if (!rt.isActive) faults.push('route inactive');
      if (!sizeOk) faults.push(`size ${d.size} > driver's profile vehicle ${rt.vehicleSize}`);
      if (!weightOk) faults.push(`${d.weight} kg > max load ${rt.maxLoadKg} kg`);
      if (!near) faults.push(`endpoints ${oKm.toFixed(0)} km / ${dKm.toFixed(0)} km away (30 km each)`);

      console.log(
        faults.length
          ? dim(`      ${y('–')} ${rt.driver}: `) + y(faults.join(', '))
          : dim(`      ${g('✓')} ${rt.driver}: matches`),
      );
    }
  }

  console.log(dim('\n' + '─'.repeat(78)));
  console.log(
    dim(
      '  The driver list searches from a FIXED point, not the driver\'s own route.\n' +
        '  A driver outside that radius sees an empty list and no explanation.\n',
    ),
  );
}

main()
  .catch((e) => {
    console.error(r(`\n  ${e.message}\n`));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
