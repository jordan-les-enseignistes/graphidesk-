import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { Search } from "lucide-react";

export function GlobalSearch() {
  const navigate = useNavigate();

  // Raccourci clavier Ctrl+K
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        navigate(ROUTES.RECHERCHE);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <button
      onClick={() => navigate(ROUTES.RECHERCHE)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
    >
      <Search className="h-4 w-4 text-gray-400 dark:text-slate-400" />
      <span className="text-sm text-gray-500 dark:text-slate-300 hidden sm:inline">Recherche globale</span>
      <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border dark:border-slate-600 bg-gray-100 dark:bg-slate-600 px-1.5 font-mono text-xs text-gray-500 dark:text-slate-400">
        Ctrl K
      </kbd>
    </button>
  );
}
