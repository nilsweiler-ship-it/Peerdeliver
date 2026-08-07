import { create } from 'zustand';
import { Platform } from 'react-native';
import type { User, AuthTokens, ApiResponse } from '@peerdeliver/shared';
import { api } from '../services/api';

// expo-secure-store doesn't work on web — fall back to localStorage
const storage = Platform.OS === 'web'
  ? {
      getItemAsync: async (key: string) => localStorage.getItem(key),
      setItemAsync: async (key: string, value: string) => localStorage.setItem(key, value),
      deleteItemAsync: async (key: string) => localStorage.removeItem(key),
    }
  : require('expo-secure-store');

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, tokens: AuthTokens) => Promise<void>;
  clearAuth: () => Promise<void>;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  loadTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, tokens) => {
    await storage.setItemAsync('accessToken', tokens.accessToken);
    await storage.setItemAsync('refreshToken', tokens.refreshToken);
    set({ user, tokens, isAuthenticated: true, isLoading: false });
  },

  clearAuth: async () => {
    await storage.deleteItemAsync('accessToken');
    await storage.deleteItemAsync('refreshToken');
    set({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
  },

  setUser: (user) => set({ user }),

  /**
   * Re-read the profile from the server.
   *
   * Lifetime counters — co2Saved, totalDeliveries, averageRating — are updated
   * server-side when a delivery completes, but the cached user here was only
   * ever loaded at login or app start. The dashboard therefore kept showing the
   * figure from the last cold start: the impact number never moved after a
   * delivery, which reads as "the feature does not work" rather than "the
   * screen is stale".
   */
  refreshUser: async () => {
    try {
      const { data } = await api.get<ApiResponse<User>>('/users/profile');
      if (data.data) set({ user: data.data });
    } catch {
      // A stale profile is not worth interrupting anything for.
    }
  },

  loadTokens: async () => {
    try {
      const accessToken = await storage.getItemAsync('accessToken');
      const refreshToken = await storage.getItemAsync('refreshToken');
      if (accessToken && refreshToken) {
        set({ tokens: { accessToken, refreshToken } });
        // Fetch user profile to restore the full auth state
        const { data } = await api.get<ApiResponse<User>>('/users/profile');
        set({ user: data.data!, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      // Token is expired/invalid — clear and show login
      await storage.deleteItemAsync('accessToken');
      await storage.deleteItemAsync('refreshToken');
      set({ tokens: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
