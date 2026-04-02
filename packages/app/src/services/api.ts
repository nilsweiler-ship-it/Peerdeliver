import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const storage = Platform.OS === 'web'
  ? {
      getItemAsync: async (key: string) => localStorage.getItem(key),
      setItemAsync: async (key: string, value: string) => localStorage.setItem(key, value),
      deleteItemAsync: async (key: string) => localStorage.removeItem(key),
    }
  : require('expo-secure-store');

const DEV_API_URL =
  Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001';
const API_URL = __DEV__ ? DEV_API_URL : 'https://api.peerdeliver.ch';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Attach access token
api.interceptors.request.use(async (config) => {
  const token = await storage.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await storage.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        const tokens = data.data;

        await storage.setItemAsync('accessToken', tokens.accessToken);
        await storage.setItemAsync('refreshToken', tokens.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(originalRequest);
      } catch {
        await storage.deleteItemAsync('accessToken');
        await storage.deleteItemAsync('refreshToken');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
