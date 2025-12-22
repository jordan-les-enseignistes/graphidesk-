import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";

interface UserPreferencesState {
  // Intensité du surlignage des lignes (0 à 100)
  // 0 = pas de couleur, 100 = couleur pleine
  highlightIntensity: number;
  setHighlightIntensity: (intensity: number) => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      highlightIntensity: 50, // 50% par défaut
      setHighlightIntensity: (intensity) => set({ highlightIntensity: intensity }),
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "graphidesk-user-preferences",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Hook pour attendre l'hydratation du store
export const useHydratedUserPreferences = () => {
  const store = useUserPreferencesStore();
  const [isHydrated, setIsHydrated] = useState(store._hasHydrated);

  useEffect(() => {
    const unsubscribe = useUserPreferencesStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    // Vérifier si déjà hydraté
    if (useUserPreferencesStore.getState()._hasHydrated) {
      setIsHydrated(true);
    }

    return unsubscribe;
  }, []);

  return { ...store, isHydrated };
};
