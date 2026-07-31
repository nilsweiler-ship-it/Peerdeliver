import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { prisma, env } from '../config';

interface LocationUpdate {
  deliveryRequestId: string;
  lat: number;
  lng: number;
}

interface LastLocation {
  userId: string;
  lat: number;
  lng: number;
  timestamp: string;
  simulated?: boolean;
}

// Last-known location per delivery (real or simulated), replayed to joiners.
const lastLocations = new Map<string, LastLocation>();
// Deliveries currently receiving REAL driver GPS — these suppress the simulation.
const realActive = new Set<string>();
// Active watchers + simulation timers/progress per delivery.
const watchers = new Map<string, number>();
const simTimers = new Map<string, ReturnType<typeof setInterval>>();
const simProgress = new Map<string, number>();

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Only the three people involved in a delivery may see where the driver is.
 *
 * Without this check any authenticated account could emit `tracking:start` with
 * a delivery id and receive that driver's live GPS — a stranger following a
 * named person around Switzerland in real time. Under the Swiss DSG and the
 * GDPR that is sensitive personal data, so membership is verified server-side
 * on every join rather than trusted from the client.
 *
 * Results are cached briefly: participants don't change during a delivery, and
 * this sits on a hot path (every join, every reconnect).
 */
const memberCache = new Map<string, { members: Set<string>; expires: number }>();
const MEMBER_TTL_MS = 60_000;

async function deliveryMembers(deliveryId: string): Promise<Set<string>> {
  const hit = memberCache.get(deliveryId);
  if (hit && hit.expires > Date.now()) return hit.members;

  const row = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { senderId: true, driverId: true, recipientId: true },
  });

  const members = new Set<string>();
  if (row) {
    members.add(row.senderId);
    if (row.driverId) members.add(row.driverId);
    if (row.recipientId) members.add(row.recipientId);
  }
  memberCache.set(deliveryId, { members, expires: Date.now() + MEMBER_TTL_MS });
  return members;
}

async function isParticipant(deliveryId: string, userId: string): Promise<boolean> {
  // A driver accepting a delivery changes the member set; drop the stale entry
  // so a freshly assigned driver isn't refused for up to a minute.
  const members = await deliveryMembers(deliveryId);
  if (members.has(userId)) return true;
  memberCache.delete(deliveryId);
  return (await deliveryMembers(deliveryId)).has(userId);
}

/**
 * Development-only movement simulation.
 *
 * When a delivery is in transit but no real GPS is arriving, this animates a
 * position gliding from pickup → delivery so the map isn't empty during local
 * testing on a single device. A real `TRACKING_LOCATION_UPDATE` takes over
 * immediately and stops it.
 *
 * DISABLED IN PRODUCTION, deliberately. Showing a sender a smoothly moving dot
 * that is not their driver is a lie the UI cannot distinguish from the truth —
 * they would make real decisions ("he's five minutes away, I'll head down") on
 * invented data. An empty map with an honest "no live position" state is worse
 * demo material and a far better product. Set TRACKING_SIMULATION=true to force
 * it on in a staging environment.
 */
const SIMULATION_ENABLED =
  env.NODE_ENV !== 'production' || process.env.TRACKING_SIMULATION === 'true';

async function ensureSimulation(io: Server, deliveryId: string) {
  if (!SIMULATION_ENABLED) return;
  if (simTimers.has(deliveryId) || realActive.has(deliveryId)) return;

  const rows = await prisma.$queryRawUnsafe<{ p: string; d: string; status: string }[]>(
    `SELECT ST_AsGeoJSON(dr."pickupPoint") AS p, ST_AsGeoJSON(dr."deliveryPoint") AS d, dr.status
       FROM delivery_requests dr WHERE dr.id = $1`,
    deliveryId,
  );
  const row = rows[0];
  if (!row || row.status !== 'in_transit') return;

  const a = JSON.parse(row.p).coordinates; // [lng, lat]
  const b = JSON.parse(row.d).coordinates;

  const emit = (t: number) => {
    const payload: LastLocation = {
      userId: 'sim',
      lat: lerp(a[1], b[1], t),
      lng: lerp(a[0], b[0], t),
      timestamp: new Date().toISOString(),
      simulated: true,
    };
    lastLocations.set(deliveryId, payload);
    io.to(`tracking:${deliveryId}`).emit(SOCKET_EVENTS.TRACKING_LOCATION_NEW, payload);
  };

  // Start partway along the route and emit immediately so there's no "loading".
  let t = simProgress.get(deliveryId) ?? 0.15;
  emit(t);

  const timer = setInterval(() => {
    if (realActive.has(deliveryId) || (watchers.get(deliveryId) ?? 0) <= 0) {
      clearInterval(timer);
      simTimers.delete(deliveryId);
      return;
    }
    t = Math.min(1, t + 0.03);
    simProgress.set(deliveryId, t);
    emit(t);
    if (t >= 1) {
      clearInterval(timer);
      simTimers.delete(deliveryId);
    }
  }, 4000);
  simTimers.set(deliveryId, timer);
}

function stopSimulation(deliveryId: string) {
  const timer = simTimers.get(deliveryId);
  if (timer) {
    clearInterval(timer);
    simTimers.delete(deliveryId);
  }
}

export function setupTrackingHandlers(io: Server, socket: Socket) {
  const joined = new Set<string>();

  socket.on(SOCKET_EVENTS.TRACKING_START, (deliveryRequestId: string) => {
    void (async () => {
      const userId = socket.data.user.userId;
      if (typeof deliveryRequestId !== 'string' || !deliveryRequestId) return;

      if (!(await isParticipant(deliveryRequestId, userId))) {
        console.warn(
          `[Tracking] DENIED ${userId.slice(0, 8)} → ${deliveryRequestId.slice(0, 8)} (not a participant)`,
        );
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorised to track this delivery' });
        return;
      }

      socket.join(`tracking:${deliveryRequestId}`);
      joined.add(deliveryRequestId);
      watchers.set(deliveryRequestId, (watchers.get(deliveryRequestId) ?? 0) + 1);
      console.log(`[Tracking] ${userId.slice(0, 8)} joined tracking:${deliveryRequestId.slice(0, 8)}`);

      // Replay the last-known position immediately, then keep it live.
      const last = lastLocations.get(deliveryRequestId);
      if (last) socket.emit(SOCKET_EVENTS.TRACKING_LOCATION_NEW, last);
      void ensureSimulation(io, deliveryRequestId);
    })();
  });

  const leave = (deliveryRequestId: string) => {
    if (!joined.has(deliveryRequestId)) return;
    joined.delete(deliveryRequestId);
    socket.leave(`tracking:${deliveryRequestId}`);
    const n = Math.max(0, (watchers.get(deliveryRequestId) ?? 1) - 1);
    watchers.set(deliveryRequestId, n);
    if (n === 0) {
      stopSimulation(deliveryRequestId);
      // Nobody is watching: drop the per-delivery state. These maps are keyed by
      // delivery id and were never cleaned up, so a long-running process grew
      // them forever. Simulated positions are worthless to keep; a real last
      // position is re-sent by the driver within one interval of someone
      // re-joining.
      watchers.delete(deliveryRequestId);
      simProgress.delete(deliveryRequestId);
      const last = lastLocations.get(deliveryRequestId);
      if (last?.simulated) lastLocations.delete(deliveryRequestId);
      memberCache.delete(deliveryRequestId);
    }
  };

  socket.on(SOCKET_EVENTS.TRACKING_STOP, leave);
  socket.on('disconnect', () => {
    joined.forEach((id) => leave(id));
  });

  socket.on(SOCKET_EVENTS.TRACKING_LOCATION_UPDATE, (data: LocationUpdate) => {
    void (async () => {
      const userId = socket.data.user.userId;
      if (!data || typeof data.deliveryRequestId !== 'string') return;
      if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return;
      if (Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180) return;

      // Only the assigned driver may report a position. Otherwise anyone could
      // push a fake location for someone else's delivery.
      const row = await prisma.deliveryRequest.findUnique({
        where: { id: data.deliveryRequestId },
        select: { driverId: true },
      });
      if (!row || row.driverId !== userId) {
        console.warn(
          `[Tracking] DENIED location from ${userId.slice(0, 8)} for ${data.deliveryRequestId.slice(0, 8)} (not the driver)`,
        );
        return;
      }

      // Real GPS wins: mark active and stop any simulation.
      realActive.add(data.deliveryRequestId);
      stopSimulation(data.deliveryRequestId);
      const payload: LastLocation = {
        userId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      };
      lastLocations.set(data.deliveryRequestId, payload);
      io.to(`tracking:${data.deliveryRequestId}`).emit(SOCKET_EVENTS.TRACKING_LOCATION_NEW, payload);
    })();
  });
}
