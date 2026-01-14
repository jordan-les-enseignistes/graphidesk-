import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  // État local pour forcer le re-render immédiat
  const [localIsDark, setLocalIsDark] = useState(true);

  // Synchroniser avec le DOM au montage
  useEffect(() => {
    setMounted(true);
    // Lire l'état réel du DOM
    const isDarkFromDOM = document.documentElement.classList.contains("dark");
    setLocalIsDark(isDarkFromDOM);
  }, []);

  // Synchroniser quand le thème du store change
  useEffect(() => {
    if (mounted) {
      setLocalIsDark(theme === "dark");
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    const newTheme = localIsDark ? "light" : "dark";

    // Mettre à jour l'état local immédiatement pour l'UI
    setLocalIsDark(newTheme === "dark");

    // Forcer l'application immédiate de la classe sur le DOM
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Mettre à jour le store (qui persiste dans localStorage)
    setTheme(newTheme);
  };

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center w-14 h-7 rounded-full transition-colors duration-300 p-0.5",
        localIsDark ? "bg-slate-600" : "bg-green-500"
      )}
      title={localIsDark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {/* Indicateur mobile (cercle blanc) */}
      <span
        className={cn(
          "flex items-center justify-center w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300",
          localIsDark ? "translate-x-7" : "translate-x-0"
        )}
      >
        {localIsDark ? (
          <Moon className="h-3.5 w-3.5 text-slate-600" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-green-500" />
        )}
      </span>
    </button>
  );
}
