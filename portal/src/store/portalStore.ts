import { create } from 'zustand';
import { currentUser } from '../api/client';
import type { WPUser } from '../types';

interface PortalState {
  user: WPUser;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const usePortalStore = create<PortalState>((set) => ({
  user: currentUser,
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
