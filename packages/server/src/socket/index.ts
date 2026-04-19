import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { env } from '../config';
import type { AuthPayload } from '../middleware/auth';
import { setupChatHandlers } from './chatHandler';
import { setupTrackingHandlers } from './trackingHandler';

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  ioInstance = io;

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    const { userId } = socket.data.user;
    console.log(`[Socket] User connected: ${userId}`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    setupChatHandlers(io, socket);
    setupTrackingHandlers(io, socket);

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      console.log(`[Socket] User disconnected: ${userId}`);
    });
  });

  return io;
}
