import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { resolveDevApiUrl } from './devHost';

const storage = Platform.OS === 'web'
  ? { getItemAsync: async (key: string) => localStorage.getItem(key) }
  : require('expo-secure-store');

const SOCKET_URL = __DEV__ ? resolveDevApiUrl() : 'https://api.peerdeliver.ch';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await storage.getItemAsync('accessToken');
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
    extraHeaders: {
      'ngrok-skip-browser-warning': 'true',
    },
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
