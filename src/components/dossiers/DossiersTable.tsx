import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InlineEdit } from "@/components/shared/InlineEdit";
import { BatCell } from "./BatCell";
import { RelanceCell } from "./RelanceCell";
import { DossierForm } from "./DossierForm";
import { TransferModal } from "./TransferModal";
import { BulkTransferModal } from "./BulkTransferModal";
import { useAuthStore } from "@/stores/authStore";
import { useHydratedUserPreferences } from "@/stores/userPreferencesStore";
import { useArchiveDossier, useBulkArchive, useBulkUpdateStatus, useUpdateDossier, useDeleteDossier } from "@/hooks/useDossiers";
import { formatDate, formatDateTime, cn, getFirstName } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";
import { useStatuts } from "@/hooks/useStatuts";
import type { DossierWithGraphiste } from "@/types";
import {
  Plus,
  Search,
  Edit,
  Archive,
  Send,
  MoreHorizontal,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Filter,
  X,
  Check,
  Trash2,
  ArrowUpDown,
  Clock,
  CalendarDays,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

interface DossiersTableProps {
  dossiers: DossierWithGraphiste[];
  isLoading: boolean;
  showGraphiste?: boolean;
  hideFilters?: boolean;
  allowDateSortToggle?: boolean; // Permet de switcher entre tri par date ancienne/récente
  allowColumnResize?: boolean; // Permet le redimensionnement des colonnes (Mes Dossiers uniquement)
}

type SortField = "nom" | "date_creation" | "bat_count" | "statut";
type SortDirection = "asc" | "desc";

// Map des classes Tailwind bg-*-50 vers des couleurs RGB
// Light mode : couleurs pastel claires (-200 level)
// Dark mode : couleurs sombres avec opacité réduite
const tailwindBgToRgbLight: Record<string, string> = {
  "bg-red-50": "254, 202, 202",      // red-200
  "bg-orange-50": "254, 215, 170",   // orange-200
  "bg-yellow-50": "254, 240, 138",   // yellow-200
  "bg-green-50": "167, 243, 208",    // green-200
  "bg-blue-50": "191, 219, 254",     // blue-200
  "bg-purple-50": "221, 214, 254",   // purple-200
  "bg-pink-50": "251, 207, 232",     // pink-200
  "bg-gray-50": "229, 231, 235",     // gray-200
  "bg-indigo-50": "199, 210, 254",   // indigo-200
  "bg-cyan-50": "165, 243, 252",     // cyan-200
};

// Dark mode : couleurs plus saturées et sombres
const tailwindBgToRgbDark: Record<string, string> = {
  "bg-red-50": "127, 29, 29",        // red-900
  "bg-orange-50": "124, 45, 18",     // orange-900
  "bg-yellow-50": "113, 63, 18",     // yellow-900
  "bg-green-50": "20, 83, 45",       // green-900
  "bg-blue-50": "30, 58, 138",       // blue-900
  "bg-purple-50": "76, 29, 149",     // purple-900
  "bg-pink-50": "131, 24, 67",       // pink-900
  "bg-gray-50": "55, 65, 81",        // gray-700
  "bg-indigo-50": "49, 46, 129",     // indigo-900
  "bg-cyan-50": "22, 78, 99",        // cyan-900
};

export function DossiersTable({
  dossiers,
  isLoading,
  showGraphiste = false,
  hideFilters = false,
  allowDateSortToggle = false,
  allowColumnResize = false,
}: DossiersTableProps) {
  useAuthStore((state) => state.profile);
  const { highlightIntensity } = useHydratedUserPreferences();

  // Récupérer les statuts dynamiques
  const { data: statuts } = useStatuts();

  // Créer les maps dynamiques pour priorités et couleurs de fond
  const statutPriority: Record<string, number> = {};
  const statutRowBg: Record<string, string> = {};
  statuts?.forEach((s, index) => {
    statutPriority[s.value] = s.priority ?? index;
    statutRowBg[s.value] = s.row_bg || "";
  });

  // États
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date_creation");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);
  // Mode de tri par date : "oldest" = plus anciens d'abord, "newest" = plus récents d'abord (basé sur dernier_bat)
  // Persisté dans localStorage
  const [dateSortMode, setDateSortMode] = useState<"oldest" | "newest">(() => {
    const saved = localStorage.getItem("dossiers-date-sort-mode");
    return (saved === "newest" || saved === "oldest") ? saved : "oldest";
  });

  // Largeurs des colonnes (persistées dans localStorage)
  const defaultColumnWidths = {
    checkbox: 48,
    dossier: 200,
    graphiste: 130,
    date: 130,
    bat: 100,
    relance: 80,
    statut: 110,
    commentaires: 300,
    actions: 80,
  };

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("dossiers-column-widths");
    if (saved) {
      try {
        return { ...defaultColumnWidths, ...JSON.parse(saved) };
      } catch {
        return defaultColumnWidths;
      }
    }
    return defaultColumnWidths;
  });

  // Ref pour le redimensionnement
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  // Sauvegarder le mode de tri quand il change
  useEffect(() => {
    localStorage.setItem("dossiers-date-sort-mode", dateSortMode);
  }, [dateSortMode]);

  // Sauvegarder les largeurs de colonnes quand elles changent
  useEffect(() => {
    localStorage.setItem("dossiers-column-widths", JSON.stringify(columnWidths));
  }, [columnWidths]);

  // Gestionnaires pour le redimensionnement des colonnes
  const handleMouseDown = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingColumn.current = columnKey;
    startX.current = e.clientX;
    startWidth.current = columnWidths[columnKey] || 100;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff); // Minimum 50px
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth,
    }));
  };

  const handleMouseUp = () => {
    resizingColumn.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDossier, setEditingDossier] = useState<DossierWithGraphiste | null>(null);
  const [transferDossier, setTransferDossier] = useState<DossierWithGraphiste | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<DossierWithGraphiste | null>(null);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkTransferModal, setBulkTransferModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DossierWithGraphiste | null>(null);

  // Mutations
  const archiveDossier = useArchiveDossier();
  const bulkArchive = useBulkArchive();
  const bulkUpdateStatus = useBulkUpdateStatus();
  const updateDossier = useUpdateDossier();
  const deleteDossier = useDeleteDossier();

  // Filtrage
  const filteredDossiers = dossiers.filter((d) => {
    const matchSearch = d.nom.toLowerCase().includes(search.toLowerCase());
    const matchStatut = !statutFilter || d.statut === statutFilter;
    return matchSearch && matchStatut;
  });

  // Tri - par défaut par priorité de statut puis par date
  const sortedDossiers = [...filteredDossiers].sort((a, b) => {
    // Si tri par défaut (date_creation desc), on trie par priorité de statut d'abord
    if (sortField === "date_creation" && sortDirection === "desc") {
      // Priorité du statut (Urgent en premier, Stand-by en dernier)
      const priorityA = statutPriority[a.statut] ?? 99;
      const priorityB = statutPriority[b.statut] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // À priorité égale, trier par date de BAT (ou date de création si pas de BAT)
      // dateSortMode: "oldest" = plus anciens d'abord, "newest" = plus récents d'abord
      const dateA = a.dernier_bat ? new Date(a.dernier_bat).getTime() : new Date(a.date_creation).getTime();
      const dateB = b.dernier_bat ? new Date(b.dernier_bat).getTime() : new Date(b.date_creation).getTime();

      if (dateSortMode === "oldest") {
        return dateA - dateB; // Plus anciens d'abord
      } else {
        return dateB - dateA; // Plus récents d'abord
      }
    }

    // Sinon, tri manuel par l'utilisateur
    let comparison = 0;

    switch (sortField) {
      case "nom":
        comparison = a.nom.localeCompare(b.nom);
        break;
      case "date_creation":
        comparison = new Date(a.date_creation).getTime() - new Date(b.date_creation).getTime();
        break;
      case "bat_count":
        comparison = (a.bat_count || 0) - (b.bat_count || 0);
        break;
      case "statut":
        // Tri par priorité plutôt qu'alphabétique
        const prioA = statutPriority[a.statut] ?? 99;
        const prioB = statutPriority[b.statut] ?? 99;
        comparison = prioA - prioB;
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedDossiers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedDossiers.map((d) => d.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkArchive = async () => {
    await bulkArchive.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkArchiveConfirm(false);
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus) return;
    await bulkUpdateStatus.mutateAsync({
      ids: Array.from(selectedIds),
      statut: bulkStatus,
    });
    setSelectedIds(new Set());
    setBulkStatusModal(false);
    setBulkStatus("");
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };


  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {!hideFilters && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <Input
                  placeholder="Rechercher un dossier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 pl-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filtres
              </Button>
            </>
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 border-l dark:border-slate-600 pl-2">
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {selectedIds.size} sélectionné(s)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkStatusModal(true)}
              >
                Changer statut
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkTransferModal(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Transférer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkArchiveConfirm(true)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archiver
              </Button>
            </div>
          )}
        </div>

        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau dossier
        </Button>
      </div>

      {/* Filtres par statut - boutons */}
      {!hideFilters && showFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatutFilter("")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                !statutFilter
                  ? "bg-gray-800 text-white border-gray-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
              )}
            >
              Tous
            </button>
            {statuts?.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatutFilter(statutFilter === s.value ? "" : s.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                  statutFilter === s.value
                    ? s.color
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Bouton pour switcher le mode de tri par date */}
          {allowDateSortToggle && (
            <Tooltip content={dateSortMode === "oldest" ? "Tri : Plus anciens d'abord (par date de BAT)" : "Tri : Plus récents d'abord (par date de BAT)"}>
              <button
                onClick={() => setDateSortMode(dateSortMode === "oldest" ? "newest" : "oldest")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                  "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
                )}
              >
                {dateSortMode === "oldest" ? (
                  <>
                    <Clock className="h-4 w-4" />
                    <span className="hidden sm:inline">Anciens d'abord</span>
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-4 w-4" />
                    <span className="hidden sm:inline">Récents d'abord</span>
                  </>
                )}
                <ArrowUpDown className="h-3 w-3 text-gray-400 dark:text-slate-500" />
              </button>
            </Tooltip>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
        <Table style={allowColumnResize ? { tableLayout: "fixed", width: "max-content", minWidth: "100%" } : undefined}>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-slate-700/50">
              {/* Checkbox */}
              <TableHead style={allowColumnResize ? { width: columnWidths.checkbox } : undefined} className="w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size === sortedDossiers.length && sortedDossiers.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                />
              </TableHead>

              {/* Dossier */}
              <TableHead
                style={allowColumnResize ? { width: columnWidths.dossier } : undefined}
                className={cn("select-none relative", allowColumnResize ? "group" : "", !allowColumnResize && "w-48")}
              >
                <div
                  className="flex items-center gap-1 pr-2 cursor-pointer"
                  onClick={() => handleSort("nom")}
                >
                  Dossier
                  <SortIcon field="nom" />
                </div>
                {allowColumnResize && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-slate-500 transition-colors z-10"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown("dossier", e); }}
                  />
                )}
              </TableHead>

              {/* Graphiste (optionnel) */}
              {showGraphiste && (
                <TableHead
                  style={allowColumnResize ? { width: columnWidths.graphiste } : undefined}
                  className={cn("relative", allowColumnResize ? "group" : "w-32")}
                >
                  Graphiste
                  {allowColumnResize && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-slate-500 transition-colors z-10"
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown("graphiste", e); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </TableHead>
              )}

              {/* Créé le */}
              <TableHead
                style={allowColumnResize ? { width: columnWidths.date } : undefined}
                className={cn("select-none relative", allowColumnResize ? "group" : "w-28")}
              >
                <div
                  className="flex items-center gap-1 pr-2 cursor-pointer"
                  onClick={() => handleSort("date_creation")}
                >
                  Créé le
                  <SortIcon field="date_creation" />
                </div>
                {allowColumnResize && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-slate-500 transition-colors z-10"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown("date", e); }}
                  />
                )}
              </TableHead>

              {/* BAT */}
              <TableHead
                style={allowColumnResize ? { width: columnWidths.bat } : undefined}
                className={cn("select-none relative", allowColumnResize ? "group" : "w-28")}
              >
                <div
                  className="flex items-center gap-1 pr-2 cursor-pointer"
                  onClick={() => handleSort("bat_count")}
                >
                  BAT
                  <SortIcon field="bat_count" />
                </div>
                {allowColumnResize && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-slate-500 transition-colors z-10"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown("bat", e); }}
                  />
                )}
              </TableHead>

              {/* Relance */}
              <TableHead
                style={allowColumnResize ? { width: columnWidths.relance } : undefined}
                className={cn("relative", allowColumnResize ? "group" : "w-20")}
              >
                <span>Relance</span>
                {allowColumnResize && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-slate-500 transition-colors z-10"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown("relance", e); }}
                  />
                )}
              </TableHead>

              {/* Statut */}
              <TableHead
                style={allowColumnResize ? { width: columnWidths.statut } : undefined}
                className={cn("select-none relative", allowColumnResize ? "group" : "w-28")}
              >
                <div
                  className="flex items-center gap-1 pr-2 cursor-pointer"
                  onClick={() => handleSort("statut")}
                >
                  Statut
                  <SortIcon field="statut" />
                </div>
                {allowColumnResize && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-slate-500 transition-colors z-10"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown("statut", e); }}
                  />
                )}
              </TableHead>

              {/* Commentaires */}
              <TableHead
                style={allowColumnResize ? { width: columnWidths.commentaires } : undefined}
                className={cn("relative", allowColumnResize ? "group" : "min-w-[250px]")}
              >
                <span>Commentaires</span>
                {allowColumnResize && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-slate-500 transition-colors z-10"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown("commentaires", e); }}
                  />
                )}
              </TableHead>

              {/* Actions */}
              <TableHead style={allowColumnResize ? { width: columnWidths.actions } : undefined} className={!allowColumnResize ? "w-16" : ""}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={showGraphiste ? 9 : 8} className="h-32 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span className="ml-2 text-gray-500 dark:text-slate-400">Chargement...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedDossiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showGraphiste ? 9 : 8} className="h-32 text-center text-gray-500 dark:text-slate-400">
                  {search || statutFilter
                    ? "Aucun dossier ne correspond aux filtres"
                    : "Aucun dossier en cours"}
                </TableCell>
              </TableRow>
            ) : (
              sortedDossiers.map((dossier) => {
                // Couleur de fond basée sur le statut avec intensité personnalisable
                const rowBgClass = statutRowBg[dossier.statut] || "";
                // Détecter le mode sombre
                const isDarkMode = document.documentElement.classList.contains("dark");
                const rgbMap = isDarkMode ? tailwindBgToRgbDark : tailwindBgToRgbLight;
                const rgbValue = rgbMap[rowBgClass];
                // Calculer l'opacité basée sur l'intensité (0-100 -> 0-1)
                // En dark mode, on utilise une opacité plus élevée pour que la couleur soit visible
                const bgOpacity = isDarkMode ? (highlightIntensity / 100) * 0.5 : highlightIntensity / 100;
                // Style inline avec RGBA pour contrôler l'opacité dynamiquement
                const rowStyle = rgbValue && bgOpacity > 0
                  ? { backgroundColor: `rgba(${rgbValue}, ${bgOpacity})` }
                  : undefined;

                return (
                  <TableRow
                    key={dossier.id}
                    style={rowStyle}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(dossier.id)}
                        onChange={() => handleSelect(dossier.id)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-slate-600"
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px]">
                      <InlineEdit
                        value={dossier.nom}
                        onSave={(value) => updateDossier.mutate({ id: dossier.id, data: { nom: value } })}
                        className="line-clamp-2 break-words"
                      />
                    </TableCell>
                    {showGraphiste && (
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            getBadgeClassName(dossier.graphiste?.badge_color)
                          )}>
                            {dossier.graphiste?.initials}
                          </span>
                          {getFirstName(dossier.graphiste?.full_name)}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-gray-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(dossier.date_creation)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <BatCell
                        dossierId={dossier.id}
                        batCount={dossier.bat_count || 0}
                        dernierBat={dossier.dernier_bat}
                        dossierNom={dossier.nom}
                        currentStatut={dossier.statut}
                        currentCommentaires={dossier.commentaires}
                      />
                    </TableCell>
                    <TableCell>
                      <RelanceCell
                        dossierId={dossier.id}
                        dossierNom={dossier.nom}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">
                            <StatusBadge statut={dossier.statut} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="bottom" sideOffset={4} collisionPadding={16} className="w-40">
                          {statuts?.map((s) => (
                            <DropdownMenuItem
                              key={s.value}
                              onClick={() => {
                                if (s.value !== dossier.statut) {
                                  updateDossier.mutate({
                                    id: dossier.id,
                                    data: { statut: s.value },
                                  });
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2",
                                s.value === dossier.statut && "bg-gray-100 dark:bg-slate-700 font-medium"
                              )}
                            >
                              <span className={cn("h-2 w-2 rounded-full", s.color.split(" ")[0])} />
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="align-top">
                      <InlineEdit
                        value={dossier.commentaires || ""}
                        onSave={(value) => updateDossier.mutate({
                          id: dossier.id,
                          data: {
                            commentaires: value || null,
                            has_commentaires: !!value && value.trim() !== ""
                          }
                        })}
                        type="textarea"
                        className="text-sm text-gray-600 dark:text-slate-300 block w-full"
                        placeholder="Ajouter un commentaire"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Tooltip content="Archiver">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                            onClick={() => setArchiveConfirm(dossier)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingDossier(dossier)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTransferDossier(dossier)}>
                              <Send className="mr-2 h-4 w-4" />
                              Transférer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setArchiveConfirm(dossier)}
                              className="text-orange-600"
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archiver
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(dossier)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Résumé */}
      <div className="text-sm text-gray-500 dark:text-slate-400">
        {sortedDossiers.length} dossier(s)
        {(search || statutFilter) && ` (filtré sur ${dossiers.length})`}
      </div>

      {/* Modals */}
      <DossierForm
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        mode="create"
      />

      <DossierForm
        open={!!editingDossier}
        onOpenChange={(open) => !open && setEditingDossier(null)}
        dossier={editingDossier}
        mode="edit"
      />

      <TransferModal
        open={!!transferDossier}
        onOpenChange={(open) => !open && setTransferDossier(null)}
        dossier={transferDossier}
      />

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(open) => !open && setArchiveConfirm(null)}
        title="Archiver le dossier"
        description={`Êtes-vous sûr de vouloir archiver "${archiveConfirm?.nom}" ? Le dossier sera déplacé dans les archives.`}
        confirmText="Archiver"
        variant="warning"
        icon="archive"
        onConfirm={async () => {
          if (archiveConfirm) {
            await archiveDossier.mutateAsync(archiveConfirm.id);
            setArchiveConfirm(null);
          }
        }}
        loading={archiveDossier.isPending}
      />

      <ConfirmDialog
        open={bulkArchiveConfirm}
        onOpenChange={setBulkArchiveConfirm}
        title="Archiver les dossiers"
        description={`Êtes-vous sûr de vouloir archiver ${selectedIds.size} dossier(s) ?`}
        confirmText="Archiver"
        variant="warning"
        icon="archive"
        onConfirm={handleBulkArchive}
        loading={bulkArchive.isPending}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Supprimer le dossier"
        description={`Êtes-vous sûr de vouloir supprimer définitivement "${deleteConfirm?.nom}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
        onConfirm={async () => {
          if (deleteConfirm) {
            await deleteDossier.mutateAsync(deleteConfirm.id);
            setDeleteConfirm(null);
          }
        }}
        loading={deleteDossier.isPending}
      />

      {/* Modal changement statut en masse */}
      {bulkStatusModal && (
        <Dialog open={bulkStatusModal} onOpenChange={setBulkStatusModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Changer le statut</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4 text-sm text-gray-500 dark:text-slate-400">
                Modifier le statut de {selectedIds.size} dossier(s)
              </p>
              <Select
                options={statuts?.map((s) => ({ value: s.value, label: s.label })) || []}
                placeholder="Sélectionner un statut"
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkStatusModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleBulkStatus}
                disabled={!bulkStatus || bulkUpdateStatus.isPending}
              >
                {bulkUpdateStatus.isPending ? "Mise à jour..." : "Appliquer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal transfert en masse */}
      <BulkTransferModal
        open={bulkTransferModal}
        onOpenChange={setBulkTransferModal}
        selectedIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
