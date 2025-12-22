import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserPreferencesState {
  // Intensité du surlignage des lignes (0 à 100)
  // 0 = pas de couleur, 100 = couleur pleine
  highlightIntensity: number;
  setHighlightIntensity: (intensity: number) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      highlightIntensity: 50, // 50% par défaut
      setHighlightIntensity: (intensity) => set({ highlightIntensity: intensity }),
    }),
    {
      name: "graphidesk-user-preferences",
    }
  )
);
