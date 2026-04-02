import { create } from 'zustand';

interface UIState {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOnline: true,
  setOnline: (online) => set({ isOnline: online }),
}));
