import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAllDossiersPaginated } from "@/hooks/useDossiers";
import { useRealtime } from "@/hooks/useRealtime";
import { useProfiles } from "@/hooks/useProfiles";
import { useStatuts } from "@/hooks/useStatuts";
import { DossiersTable } from "@/components/dossiers/DossiersTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";
import {
  Folders,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const PAGE_SIZE = 100;

export default function TousLesDossiers() {
  // Activer le temps réel
  useRealtime();

  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(0);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [graphisteFilter, setGraphisteFilter] = useState<string>("");

  const { data: profiles } = useProfiles();
  const { data: statuts } = useStatuts();

  // Graphistes actifs uniquement
  const activeGraphistes = useMemo(() => {
    return profiles?.filter((p) => p.is_active) ?? [];
  }, [profiles]);

  // Construire les filtres
  const filters = useMemo(() => ({
    search: searchQuery || undefined,
    statut: statutFilter || undefined,
    graphiste_id: graphisteFilter || undefined,
  }), [searchQuery, statutFilter, graphisteFilter]);

  const { data: dossiersData, isLoading } = useAllDossiersPaginated(
    currentPage,
    PAGE_SIZE,
    filters
  );

  // Quand on change les filtres, revenir à la page 0
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, statutFilter, graphisteFilter]);

  // Debounce de la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync URL avec recherche depuis la recherche globale
  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch && urlSearch !== searchInput) {
      setSearchInput(urlSearch);
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  const dossiers = dossiersData?.data ?? [];
  const totalDossiers = dossiersData?.total ?? 0;
  const totalPages = dossiersData?.totalPages ?? 0;

  // Calcul des numéros de page à afficher
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(0, currentPage - 2);
      let end = Math.min(totalPages - 1, currentPage + 2);

      if (currentPage < 2) {
        end = maxVisiblePages - 1;
      } else if (currentPage > totalPages - 3) {
        start = totalPages - maxVisiblePages;
      }

      for (let i = start; i <= end; i++) pages.push(i);
    }

    return pages;
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatutFilter("");
    setGraphisteFilter("");
    setSearchParams({});
  };

  const hasFilters = searchQuery || statutFilter || graphisteFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
            <Folders className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Tous les Dossiers</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {totalDossiers.toLocaleString()} dossier(s) actif(s)
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <Input
            placeholder="Rechercher un dossier..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setSearchParams({});
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtre par statut */}
        <div className="relative min-w-[180px]">
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="w-full h-10 appearance-none rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Tous les statuts</option>
            {statuts?.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-slate-400 pointer-events-none" />
        </div>

        {/* Filtre par graphiste */}
        <div className="relative min-w-[180px]">
          <select
            value={graphisteFilter}
            onChange={(e) => setGraphisteFilter(e.target.value)}
            className="w-full h-10 appearance-none rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Tous les graphistes</option>
            {activeGraphistes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.full_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-slate-400 pointer-events-none" />
        </div>

        {/* Bouton effacer filtres */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Effacer les filtres
          </Button>
        )}
      </div>

      {/* Table */}
      <DossiersTable
        dossiers={dossiers}
        isLoading={isLoading}
        showGraphiste={true}
        hideFilters={true}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Page {currentPage + 1} sur {totalPages}
            {hasFilters && ` (${totalDossiers} résultat${totalDossiers > 1 ? "s" : ""})`}
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {getPageNumbers().map((pageNum) => (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum + 1}
              </Button>
            ))}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage === totalPages - 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Résumé si pas de pagination */}
      {totalPages <= 1 && dossiers.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-slate-400">
          {dossiers.length} dossier(s) affiché(s)
        </div>
      )}
    </div>
  );
}
