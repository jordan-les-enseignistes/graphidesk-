import { create } from "zustand";
import type { Profile } from "@/types";

interface ViewAsState {
  // L'utilisateur actuellement "impersonifié" (null = vue normale admin)
  viewAsUser: Profile | null;
  // Indicateur si on est en mode "vue en tant que"
  isViewingAs: boolean;
}

interface ViewAsActions {
  setViewAsUser: (user: Profile | null) => void;
  clearViewAs: () => void;
}

export const useViewAsStore = create<ViewAsState & ViewAsActions>()((set) => ({
  viewAsUser: null,
  isViewingAs: false,

  setViewAsUser: (user) => set({
    viewAsUser: user,
    isViewingAs: user !== null,
  }),

  clearViewAs: () => set({
    viewAsUser: null,
    isViewingAs: false,
  }),
}));

// Sélecteur pour obtenir l'utilisateur effectif (viewAs ou admin)
export const selectEffectiveUser = (state: ViewAsState) => state.viewAsUser;
export const selectIsViewingAs = (state: ViewAsState) => state.isViewingAs;
