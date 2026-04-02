import { create } from 'zustand';
import { Platform } from 'react-native';
import type { User, AuthTokens } from '@peerdeliver/shared';

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
  loadTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
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

  loadTokens: async () => {
    try {
      const accessToken = await storage.getItemAsync('accessToken');
      const refreshToken = await storage.getItemAsync('refreshToken');
      if (accessToken && refreshToken) {
        set({ tokens: { accessToken, refreshToken }, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
