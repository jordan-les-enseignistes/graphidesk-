import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Fonction pour appliquer le thème au DOM
function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "system") {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", systemDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "graphidesk-theme",
      onRehydrateStorage: () => (state) => {
        // Appliquer le thème au chargement
        if (state) {
          // Si l'ancien thème était "system", le convertir en "dark"
          const effectiveTheme = state.theme === "system" ? "dark" : state.theme;
          applyTheme(effectiveTheme);
          if (state.theme === "system") {
            state.theme = "dark";
          }
        }
      },
    }
  )
);

// Écouter les changements de préférence système
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") {
      document.documentElement.classList.toggle("dark", e.matches);
    }
  });
}
