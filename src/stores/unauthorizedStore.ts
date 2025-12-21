import { create } from "zustand";

interface UnauthorizedState {
  isOpen: boolean;
  show: () => void;
  hide: () => void;
}

export const useUnauthorizedStore = create<UnauthorizedState>((set) => ({
  isOpen: false,
  show: () => set({ isOpen: true }),
  hide: () => set({ isOpen: false }),
}));
