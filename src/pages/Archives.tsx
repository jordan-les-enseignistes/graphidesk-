import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useArchivesPaginated, useUnarchiveDossier, useDeleteDossier } from "@/hooks/useDossiers";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate, formatDateTime, getFirstName, cn } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";
import type { DossierWithGraphiste } from "@/types";

interface Bat {
  id: string;
  dossier_id: string;
  date_envoi: string;
  notes: string | null;
  created_at: string;
}
import {
  Archive,
  Search,
  RotateCcw,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileCheck,
  Eye,
  Calendar,
  MessageSquare,
  User,
  Loader2,
  Trash2,
} from "lucide-react";

const PAGE_SIZE = 100;

export default function Archives() {
  const { isAdmin } = useEffectiveRole();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentPage, setCurrentPage] = useState(0);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [unarchiveConfirm, setUnarchiveConfirm] = useState<DossierWithGraphiste | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DossierWithGraphiste | null>(null);
  const [detailDossier, setDetailDossier] = useState<DossierWithGraphiste | null>(null);
  const [detailBats, setDetailBats] = useState<Bat[]>([]);
  const [loadingBats, setLoadingBats] = useState(false);

  const { data: archivesData, isLoading } = useArchivesPaginated(
    currentPage,
    PAGE_SIZE,
    searchQuery || undefined
  );
  const unarchiveDossier = useUnarchiveDossier();
  const deleteDossier = useDeleteDossier();

  // Quand on change la recherche, revenir à la page 0
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

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

  const archives = archivesData?.data ?? [];
  const totalArchives = archivesData?.total ?? 0;
  const totalPages = archivesData?.totalPages ?? 0;

  // Ouvrir le modal de détails et charger les BAT
  const handleShowDetails = async (dossier: DossierWithGraphiste) => {
    setDetailDossier(dossier);
    setLoadingBats(true);
    setDetailBats([]);

    try {
      const { data: bats } = await supabase
        .from("dossier_bats")
        .select("*")
        .eq("dossier_id", dossier.id)
        .order("date_envoi", { ascending: true });

      setDetailBats(bats ?? []);
    } catch (err) {
      console.error("Erreur chargement BAT:", err);
    } finally {
      setLoadingBats(false);
    }
  };

  const handleExportExcel = () => {
    if (!archives.length) return;

    const headers = ["Nom", "Graphiste", "Date création", "Date archivage", "BAT", "Statut final"];
    const rows = archives.map((d) => [
      d.nom,
      d.graphiste?.full_name ?? "",
      formatDate(d.date_creation),
      formatDate(d.date_archivage),
      String(d.bat_count || 0),
      d.statut,
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `archives_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <Archive className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Archives</h1>
            <p className="text-sm text-gray-500">
              {totalArchives.toLocaleString()} dossier(s) archivé(s)
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={handleExportExcel}>
          <Download className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Rechercher dans toutes les archives..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput("");
              setSearchQuery("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Dossier</TableHead>
              <TableHead>Graphiste</TableHead>
              <TableHead>Date création</TableHead>
              <TableHead>Date archivage</TableHead>
              <TableHead>BAT</TableHead>
              <TableHead>Statut final</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span className="ml-2 text-gray-500">Chargement...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : archives.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                  {searchQuery ? "Aucun résultat pour cette recherche" : "Aucune archive"}
                </TableCell>
              </TableRow>
            ) : (
              archives.map((dossier) => (
                <TableRow
                  key={dossier.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleShowDetails(dossier)}
                >
                  <TableCell className="font-medium">{dossier.nom}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        dossier.graphiste
                          ? getBadgeClassName(dossier.graphiste.badge_color)
                          : "bg-gray-100 text-gray-600"
                      )}>
                        {dossier.graphiste?.initials || "AG"}
                      </span>
                      {dossier.graphiste ? getFirstName(dossier.graphiste.full_name) : "Ancien Graphiste"}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500 whitespace-nowrap">
                    {formatDateTime(dossier.date_creation)}
                  </TableCell>
                  <TableCell className="text-gray-500 whitespace-nowrap">
                    {dossier.date_archivage ? formatDate(dossier.date_archivage) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <FileCheck className={`h-4 w-4 ${dossier.bat_count > 0 ? "text-green-600" : "text-gray-300"}`} />
                      <span className={`font-medium ${dossier.bat_count > 0 ? "text-green-700" : "text-gray-400"}`}>
                        {dossier.bat_count || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge statut={dossier.statut} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-gray-700"
                        onClick={() => handleShowDetails(dossier)}
                        title="Voir les détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700"
                            onClick={() => setUnarchiveConfirm(dossier)}
                            title="Restaurer"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteConfirm(dossier)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {currentPage + 1} sur {totalPages}
            {searchQuery && ` (${totalArchives} résultat${totalArchives > 1 ? "s" : ""})`}
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
      {totalPages <= 1 && (
        <div className="text-sm text-gray-500">
          {archives.length} dossier(s) affiché(s)
        </div>
      )}

      {/* Modal confirmation désarchivage */}
      <ConfirmDialog
        open={!!unarchiveConfirm}
        onOpenChange={(open) => !open && setUnarchiveConfirm(null)}
        title="Restaurer le dossier"
        description={`Voulez-vous restaurer "${unarchiveConfirm?.nom}" ? Le dossier sera de nouveau actif.`}
        confirmText="Restaurer"
        variant="info"
        icon="archive"
        onConfirm={async () => {
          if (unarchiveConfirm) {
            await unarchiveDossier.mutateAsync(unarchiveConfirm.id);
            setUnarchiveConfirm(null);
          }
        }}
        loading={unarchiveDossier.isPending}
      />

      {/* Modal confirmation suppression */}
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

      {/* Modal détails du dossier archivé */}
      <Dialog open={!!detailDossier} onOpenChange={(open) => !open && setDetailDossier(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-gray-500" />
              {detailDossier?.nom}
            </DialogTitle>
          </DialogHeader>

          {detailDossier && (
            <div className="space-y-6">
              {/* Informations générales */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Graphiste :</span>
                  <span className={`font-medium ${!detailDossier.graphiste ? "text-gray-500" : ""}`}>
                    {detailDossier.graphiste ? getFirstName(detailDossier.graphiste.full_name) : "Ancien Graphiste"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge statut={detailDossier.statut} />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Créé le :</span>
                  <span className="font-medium">{formatDateTime(detailDossier.date_creation)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Archivé le :</span>
                  <span className="font-medium">
                    {detailDossier.date_archivage ? formatDate(detailDossier.date_archivage) : "-"}
                  </span>
                </div>
              </div>

              {/* Commentaires */}
              {detailDossier.commentaires && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <MessageSquare className="h-4 w-4" />
                    Commentaires
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap">
                    {detailDossier.commentaires}
                  </div>
                </div>
              )}

              {/* Liste des BAT */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FileCheck className="h-4 w-4" />
                  Historique des BAT ({detailDossier.bat_count || 0})
                </div>

                {loadingBats ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : detailBats.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
                    Aucun BAT enregistré pour ce dossier
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 divide-y">
                    {detailBats.map((bat, index) => (
                      <div key={bat.id} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium">BAT {index + 1}</p>
                            <p className="text-xs text-gray-500">
                              Envoyé le {formatDate(bat.date_envoi)}
                            </p>
                          </div>
                        </div>
                        {bat.notes && (
                          <p className="text-sm text-gray-500 max-w-xs truncate" title={bat.notes}>
                            {bat.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bouton restaurer (admin uniquement) */}
              {isAdmin && (
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailDossier(null);
                      setUnarchiveConfirm(detailDossier);
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restaurer ce dossier
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
