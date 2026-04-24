import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileNav: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileNavOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
