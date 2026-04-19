import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@peerdeliver/shared';

interface LocationUpdate {
  deliveryRequestId: string;
  lat: number;
  lng: number;
}

export function setupTrackingHandlers(io: Server, socket: Socket) {
  socket.on(SOCKET_EVENTS.TRACKING_START, (deliveryRequestId: string) => {
    socket.join(`tracking:${deliveryRequestId}`);
    console.log(`[Tracking] ${socket.data.user.userId.slice(0, 8)} joined tracking:${deliveryRequestId.slice(0, 8)}`);
  });

  socket.on(SOCKET_EVENTS.TRACKING_STOP, (deliveryRequestId: string) => {
    socket.leave(`tracking:${deliveryRequestId}`);
  });

  socket.on(SOCKET_EVENTS.TRACKING_LOCATION_UPDATE, (data: LocationUpdate) => {
    console.log(`[Tracking] Location from ${socket.data.user.userId.slice(0, 8)}: ${data.lat.toFixed(4)},${data.lng.toFixed(4)} for ${data.deliveryRequestId.slice(0, 8)}`);
    // Broadcast location to all watchers of this delivery
    io.to(`tracking:${data.deliveryRequestId}`).emit(SOCKET_EVENTS.TRACKING_LOCATION_NEW, {
      userId: socket.data.user.userId,
      lat: data.lat,
      lng: data.lng,
      timestamp: new Date().toISOString(),
    });
  });
}
