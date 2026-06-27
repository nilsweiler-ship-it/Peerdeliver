import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { prisma } from '../config';

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
 * When a delivery is in transit but the driver isn't broadcasting real GPS
 * (permission off, app backgrounded, single-device testing), animate a position
 * gliding from pickup → delivery so watchers always see live movement. A real
 * `TRACKING_LOCATION_UPDATE` immediately takes over and stops the simulation.
 */
async function ensureSimulation(io: Server, deliveryId: string) {
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
    socket.join(`tracking:${deliveryRequestId}`);
    joined.add(deliveryRequestId);
    watchers.set(deliveryRequestId, (watchers.get(deliveryRequestId) ?? 0) + 1);
    console.log(`[Tracking] ${socket.data.user.userId.slice(0, 8)} joined tracking:${deliveryRequestId.slice(0, 8)}`);

    // Replay the last-known position immediately, then keep it live.
    const last = lastLocations.get(deliveryRequestId);
    if (last) socket.emit(SOCKET_EVENTS.TRACKING_LOCATION_NEW, last);
    void ensureSimulation(io, deliveryRequestId);
  });

  const leave = (deliveryRequestId: string) => {
    if (!joined.has(deliveryRequestId)) return;
    joined.delete(deliveryRequestId);
    socket.leave(`tracking:${deliveryRequestId}`);
    const n = Math.max(0, (watchers.get(deliveryRequestId) ?? 1) - 1);
    watchers.set(deliveryRequestId, n);
    if (n === 0) stopSimulation(deliveryRequestId);
  };

  socket.on(SOCKET_EVENTS.TRACKING_STOP, leave);
  socket.on('disconnect', () => {
    joined.forEach((id) => leave(id));
  });

  socket.on(SOCKET_EVENTS.TRACKING_LOCATION_UPDATE, (data: LocationUpdate) => {
    console.log(`[Tracking] Location from ${socket.data.user.userId.slice(0, 8)}: ${data.lat.toFixed(4)},${data.lng.toFixed(4)} for ${data.deliveryRequestId.slice(0, 8)}`);
    // Real GPS wins: mark active and stop any simulation.
    realActive.add(data.deliveryRequestId);
    stopSimulation(data.deliveryRequestId);
    const payload: LastLocation = {
      userId: socket.data.user.userId,
      lat: data.lat,
      lng: data.lng,
      timestamp: new Date().toISOString(),
    };
    lastLocations.set(data.deliveryRequestId, payload);
    io.to(`tracking:${data.deliveryRequestId}`).emit(SOCKET_EVENTS.TRACKING_LOCATION_NEW, payload);
  });
}
