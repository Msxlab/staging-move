import { create } from "zustand";

interface AppState {
  isOnboarded: boolean;
  refreshTrigger: number;
  setOnboarded: (value: boolean) => void;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnboarded: false,
  refreshTrigger: 0,
  setOnboarded: (isOnboarded) => set({ isOnboarded }),
  triggerRefresh: () => set((s) => ({ refreshTrigger: s.refreshTrigger + 1 })),
}));
