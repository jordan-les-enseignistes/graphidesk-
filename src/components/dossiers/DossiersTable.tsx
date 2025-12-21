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
import { DossierForm } from "./DossierForm";
import { TransferModal } from "./TransferModal";
import { useAuthStore } from "@/stores/authStore";
import { useArchiveDossier, useBulkArchive, useBulkUpdateStatus, useUpdateDossier } from "@/hooks/useDossiers";
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
}

type SortField = "nom" | "date_creation" | "bat_count" | "statut";
type SortDirection = "asc" | "desc";

export function DossiersTable({
  dossiers,
  isLoading,
  showGraphiste = false,
  hideFilters = false,
}: DossiersTableProps) {
  useAuthStore((state) => state.profile);

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

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDossier, setEditingDossier] = useState<DossierWithGraphiste | null>(null);
  const [transferDossier, setTransferDossier] = useState<DossierWithGraphiste | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<DossierWithGraphiste | null>(null);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");

  // Mutations
  const archiveDossier = useArchiveDossier();
  const bulkArchive = useBulkArchive();
  const bulkUpdateStatus = useBulkUpdateStatus();
  const updateDossier = useUpdateDossier();

  // Filtrage
  const filteredDossiers = dossiers.filter((d) => {
    const matchSearch = d.nom.toLowerCase().includes(search.toLowerCase());
    const matchStatut = !statutFilter || d.statut === statutFilter;
    return matchSearch && matchStatut;
  });

  // Tri - par défaut par priorité de statut puis par date de création
  const sortedDossiers = [...filteredDossiers].sort((a, b) => {
    // Si tri par défaut (date_creation desc), on trie par priorité de statut d'abord
    if (sortField === "date_creation" && sortDirection === "desc") {
      // Priorité du statut (Urgent en premier, Stand-by en dernier)
      const priorityA = statutPriority[a.statut] ?? 99;
      const priorityB = statutPriority[b.statut] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // À priorité égale, trier par date de création (plus anciens d'abord)
      return new Date(a.date_creation).getTime() - new Date(b.date_creation).getTime();
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
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Rechercher un dossier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 pl-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            <div className="flex items-center gap-2 border-l pl-2">
              <span className="text-sm text-gray-500">
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatutFilter("")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
              !statutFilter
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
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
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size === sortedDossiers.length && sortedDossiers.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none min-w-[200px]"
                onClick={() => handleSort("nom")}
              >
                <div className="flex items-center gap-1">
                  Dossier
                  <SortIcon field="nom" />
                </div>
              </TableHead>
              {showGraphiste && <TableHead className="w-32">Graphiste</TableHead>}
              <TableHead
                className="cursor-pointer select-none w-28"
                onClick={() => handleSort("date_creation")}
              >
                <div className="flex items-center gap-1">
                  Créé le
                  <SortIcon field="date_creation" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-32"
                onClick={() => handleSort("bat_count")}
              >
                <div className="flex items-center gap-1">
                  BAT
                  <SortIcon field="bat_count" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-28"
                onClick={() => handleSort("statut")}
              >
                <div className="flex items-center gap-1">
                  Statut
                  <SortIcon field="statut" />
                </div>
              </TableHead>
              <TableHead className="min-w-[300px]">Commentaires</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={showGraphiste ? 8 : 7} className="h-32 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span className="ml-2 text-gray-500">Chargement...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedDossiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showGraphiste ? 8 : 7} className="h-32 text-center text-gray-500">
                  {search || statutFilter
                    ? "Aucun dossier ne correspond aux filtres"
                    : "Aucun dossier en cours"}
                </TableCell>
              </TableRow>
            ) : (
              sortedDossiers.map((dossier) => {
                // Couleur de fond basée sur le statut
                const rowBgColor = statutRowBg[dossier.statut] || "";

                return (
                  <TableRow
                    key={dossier.id}
                    className={rowBgColor}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(dossier.id)}
                        onChange={() => handleSelect(dossier.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <InlineEdit
                        value={dossier.nom}
                        onSave={(value) => updateDossier.mutate({ id: dossier.id, data: { nom: value } })}
                        className="whitespace-nowrap"
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
                    <TableCell className="text-gray-500 whitespace-nowrap">
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">
                            <StatusBadge statut={dossier.statut} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
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
                                s.value === dossier.statut && "bg-gray-100 font-medium"
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
                        className="text-sm text-gray-600 block w-full"
                        placeholder="Ajouter un commentaire"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Tooltip content="Archiver">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-500 hover:text-orange-700 hover:bg-orange-50"
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
      <div className="text-sm text-gray-500">
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

      {/* Modal changement statut en masse */}
      {bulkStatusModal && (
        <Dialog open={bulkStatusModal} onOpenChange={setBulkStatusModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Changer le statut</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4 text-sm text-gray-500">
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
    </div>
  );
}
