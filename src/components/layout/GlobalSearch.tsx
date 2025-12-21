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
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors"
    >
      <Search className="h-4 w-4 text-gray-400" />
      <span className="text-sm text-gray-500 hidden sm:inline">Recherche globale</span>
      <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-gray-100 px-1.5 font-mono text-xs text-gray-500">
        Ctrl K
      </kbd>
    </button>
  );
}
