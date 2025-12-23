import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_CONFIG } from "@/lib/constants";
import { getFirstName } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useProfiles } from "@/hooks/useProfiles";
import {
  useStatuts,
  useCreateStatut,
  useUpdateStatut,
  useDeleteStatut,
  useReorderStatuts,
  AVAILABLE_COLORS,
  AVAILABLE_ICONS,
  type Statut,
  type StatutInsert,
} from "@/hooks/useStatuts";
import { useAppVersion } from "@/hooks/useAppUpdate";
import type { Profile } from "@/types";
import {
  Settings,
  Database,
  RefreshCw,
  Info,
  Trash2,
  AlertTriangle,
  Archive,
  Loader2,
  Users,
  Building,
  Briefcase,
  User,
  Plus,
  Pencil,
  X,
  Check,
  Circle,
  Clock as ClockIcon,
  Pause,
  PauseCircle,
  AlertCircle,
  Building as BuildingIcon,
  CheckCircle,
  XCircle,
  Timer,
  Hourglass,
  Flag,
  Star,
  Zap,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  Save,
  Palette,
  Sun,
} from "lucide-react";

interface DeleteTarget {
  type: "all" | "archives" | "graphiste" | "franchises" | "projets" | "anciens";
  graphisteId?: string;
  graphisteName?: string;
  count: number;
  label: string;
}

// Mapping des noms d'icônes vers les composants
const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  Circle,
  Clock: ClockIcon,
  Pause,
  PauseCircle,
  AlertCircle,
  AlertTriangle,
  Building: BuildingIcon,
  CheckCircle,
  XCircle,
  Timer,
  Hourglass,
  Flag,
  Star,
  Zap,
};

// État pour le formulaire de statut
interface StatutFormData {
  value: string;
  label: string;
  colorIndex: number;
  iconName: string;
}

export default function Parametres() {
  const { isAdmin } = useEffectiveRole();
  const queryClient = useQueryClient();
  const { data: profiles } = useProfiles();
  const { highlightIntensity, setHighlightIntensity } = useUserPreferencesStore();
  const appVersion = useAppVersion();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);

  // États pour la gestion des statuts
  const { data: statuts, isLoading: isLoadingStatuts } = useStatuts();
  const createStatut = useCreateStatut();
  const updateStatut = useUpdateStatut();
  const deleteStatut = useDeleteStatut();
  const reorderStatuts = useReorderStatuts();

  const [showStatutForm, setShowStatutForm] = useState(false);
  const [editingStatut, setEditingStatut] = useState<Statut | null>(null);
  const [statutForm, setStatutForm] = useState<StatutFormData>({
    value: "",
    label: "",
    colorIndex: 0,
    iconName: "Circle",
  });
  const [showDeleteStatutModal, setShowDeleteStatutModal] = useState(false);
  const [statutToDelete, setStatutToDelete] = useState<Statut | null>(null);
  const [replacementStatutId, setReplacementStatutId] = useState<string>("");

  // Fonction pour ouvrir GitHub releases
  const handleOpenGitHubReleases = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open("https://github.com/jordan-les-enseignistes/graphidesk-/releases");
    } catch (error) {
      console.error("Erreur ouverture GitHub:", error);
    }
  };

  // Compter les dossiers par catégorie
  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ["dossiers-counts-detailed"],
    queryFn: async () => {
      const [
        { count: totalCount },
        { count: archivesCount },
        { count: franchisesCount },
        { count: projetsCount },
        { count: anciensCount },
      ] = await Promise.all([
        supabase.from("dossiers").select("*", { count: "exact", head: true }),
        supabase.from("dossiers").select("*", { count: "exact", head: true }).eq("is_archived", true),
        supabase.from("franchises").select("*", { count: "exact", head: true }),
        supabase.from("projets_internes").select("*", { count: "exact", head: true }),
        supabase.from("dossiers").select("*", { count: "exact", head: true }).is("graphiste_id", null),
      ]);
      return {
        total: totalCount || 0,
        archives: archivesCount || 0,
        actifs: (totalCount || 0) - (archivesCount || 0),
        franchises: franchisesCount || 0,
        projets: projetsCount || 0,
        anciens: anciensCount || 0,
      };
    },
  });

  // Compter les dossiers par graphiste - utiliser une RPC ou compter directement
  const { data: countsByGraphiste, refetch: refetchCountsByGraphiste } = useQuery({
    queryKey: ["dossiers-counts-by-graphiste"],
    queryFn: async () => {
      // Récupérer les profils actifs d'abord
      const { data: activeProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_active", true);

      if (!activeProfiles) return {};

      // Compter les dossiers pour chaque graphiste
      const counts: Record<string, number> = {};

      await Promise.all(
        activeProfiles.map(async (p) => {
          const { count } = await supabase
            .from("dossiers")
            .select("*", { count: "exact", head: true })
            .eq("graphiste_id", p.id);
          counts[p.id] = count || 0;
        })
      );

      return counts;
    },
  });

  const handleDeleteRequest = (target: DeleteTarget) => {
    setDeleteTarget(target);
    setShowConfirm(true);
    setDeleteResult(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteResult(null);

    try {
      let deletedCount = 0;

      switch (deleteTarget.type) {
        case "all": {
          const { error, count } = await supabase
            .from("dossiers")
            .delete()
            .gte("created_at", "1900-01-01");
          if (error) throw error;
          deletedCount = count || 0;
          break;
        }
        case "archives": {
          const { error, count } = await supabase
            .from("dossiers")
            .delete()
            .eq("is_archived", true);
          if (error) throw error;
          deletedCount = count || 0;
          break;
        }
        case "graphiste": {
          if (!deleteTarget.graphisteId) throw new Error("ID graphiste manquant");
          const { error, count } = await supabase
            .from("dossiers")
            .delete()
            .eq("graphiste_id", deleteTarget.graphisteId);
          if (error) throw error;
          deletedCount = count || 0;
          break;
        }
        case "anciens": {
          const { error, count } = await supabase
            .from("dossiers")
            .delete()
            .is("graphiste_id", null);
          if (error) throw error;
          deletedCount = count || 0;
          break;
        }
        case "franchises": {
          // Supprimer les assignments d'abord, puis les franchises
          await supabase.from("franchise_assignments").delete().gte("created_at", "1900-01-01");
          const { error, count } = await supabase
            .from("franchises")
            .delete()
            .gte("created_at", "1900-01-01");
          if (error) throw error;
          deletedCount = count || 0;
          break;
        }
        case "projets": {
          const { error, count } = await supabase
            .from("projets_internes")
            .delete()
            .gte("created_at", "1900-01-01");
          if (error) throw error;
          deletedCount = count || 0;
          break;
        }
      }

      setDeleteResult(`${deletedCount} élément(s) supprimé(s) avec succès`);

      // Rafraîchir les données
      await Promise.all([refetchCounts(), refetchCountsByGraphiste()]);
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["archives"] });
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      queryClient.invalidateQueries({ queryKey: ["projets-internes"] });
    } catch (error) {
      console.error("Erreur suppression:", error);
      setDeleteResult(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
      setDeleteTarget(null);
    }
  };

  // Fonctions pour la gestion des statuts
  const resetStatutForm = () => {
    setStatutForm({ value: "", label: "", colorIndex: 0, iconName: "Circle" });
    setEditingStatut(null);
    setShowStatutForm(false);
  };

  const handleEditStatut = (statut: Statut) => {
    const colorIndex = AVAILABLE_COLORS.findIndex((c) => c.color === statut.color);
    setStatutForm({
      value: statut.value,
      label: statut.label,
      colorIndex: colorIndex >= 0 ? colorIndex : 0,
      iconName: statut.icon || "Circle",
    });
    setEditingStatut(statut);
    setShowStatutForm(true);
  };

  const handleSaveStatut = async () => {
    const selectedColor = AVAILABLE_COLORS[statutForm.colorIndex];
    const data: StatutInsert = {
      value: statutForm.value,
      label: statutForm.label,
      color: selectedColor.color,
      row_bg: selectedColor.rowBg,
      bar_color: selectedColor.barColor,
      icon: statutForm.iconName,
      priority: editingStatut?.priority ?? (statuts?.length ?? 0),
    };

    if (editingStatut) {
      await updateStatut.mutateAsync({
        id: editingStatut.id,
        data,
        oldValue: editingStatut.value !== statutForm.value ? editingStatut.value : undefined,
      });
    } else {
      await createStatut.mutateAsync(data);
    }
    resetStatutForm();
  };

  const handleDeleteStatutRequest = (statut: Statut) => {
    setStatutToDelete(statut);
    // Pré-sélectionner le premier statut différent
    const otherStatuts = statuts?.filter((s) => s.id !== statut.id);
    if (otherStatuts && otherStatuts.length > 0) {
      setReplacementStatutId(otherStatuts[0].id);
    }
    setShowDeleteStatutModal(true);
  };

  const handleConfirmDeleteStatut = async () => {
    if (!statutToDelete || !replacementStatutId) return;
    const replacement = statuts?.find((s) => s.id === replacementStatutId);
    if (!replacement) return;

    await deleteStatut.mutateAsync({
      id: statutToDelete.id,
      valueToDelete: statutToDelete.value,
      replacementValue: replacement.value,
    });

    setShowDeleteStatutModal(false);
    setStatutToDelete(null);
    setReplacementStatutId("");
  };

  // Fonctions pour déplacer les statuts haut/bas
  const handleMoveStatut = async (statutId: string, direction: "up" | "down") => {
    if (!statuts) return;

    const currentIndex = statuts.findIndex((s) => s.id === statutId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= statuts.length) return;

    // Créer une nouvelle liste réordonnée
    const reorderedStatuts = [...statuts];
    const [movedItem] = reorderedStatuts.splice(currentIndex, 1);
    reorderedStatuts.splice(newIndex, 0, movedItem);

    // Mettre à jour les priorités
    const updates = reorderedStatuts.map((statut, index) => ({
      id: statut.id,
      priority: index,
    }));

    await reorderStatuts.mutateAsync(updates);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
          <Settings className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500">
            Configuration et informations système
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informations système */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Informations système
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-500">Application</span>
              <span className="font-medium">{APP_CONFIG.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-500">Version</span>
              <Badge variant="secondary">v{appVersion}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-500">Société</span>
              <span className="font-medium">{APP_CONFIG.company}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500">Base de données</span>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Connectée</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statuts disponibles */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Statuts disponibles
            </CardTitle>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  resetStatutForm();
                  setShowStatutForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingStatuts ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !statuts?.length ? (
              <p className="text-sm text-gray-500">Aucun statut configuré</p>
            ) : (
              <div className="space-y-2">
                {statuts.map((statut, index) => {
                  const IconComponent = ICON_COMPONENTS[statut.icon] || Circle;
                  const isFirst = index === 0;
                  const isLast = index === statuts.length - 1;
                  return (
                    <div
                      key={statut.id}
                      className="flex items-center justify-between rounded-lg border p-2 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => handleMoveStatut(statut.id, "up")}
                              disabled={isFirst || reorderStatuts.isPending}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => handleMoveStatut(statut.id, "down")}
                              disabled={isLast || reorderStatuts.isPending}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <Badge className={statut.color}>
                          <IconComponent className="h-3 w-3 mr-1" />
                          {statut.label}
                        </Badge>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStatut(statut)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteStatutRequest(statut)}
                            disabled={statuts.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Configuration des mises à jour */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Mises à jour
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-gray-500">Version installée</span>
            <Badge variant="secondary" className="font-mono">
              v{appVersion}
            </Badge>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium">
                  Mises à jour automatiques
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  L'application vérifie automatiquement les nouvelles versions au démarrage.
                  Une notification apparaîtra si une mise à jour est disponible.
                </p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleOpenGitHubReleases}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Voir les releases sur GitHub
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Pour publier une nouvelle version, créez un tag git (ex: v1.0.2)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zone dangereuse - Admin seulement - EN BAS - Déroulable */}
      {isAdmin && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setDangerZoneOpen(!dangerZoneOpen)}
          >
            <CardTitle className="flex items-center justify-between text-red-700">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Zone dangereuse - Nettoyage base de données
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${dangerZoneOpen ? "rotate-180" : ""}`}
              />
            </CardTitle>
          </CardHeader>
          {dangerZoneOpen && (
          <CardContent className="space-y-6">
            <p className="text-sm text-red-600">
              Ces actions sont irréversibles. Utilisez-les pour nettoyer la base avant un réimport.
            </p>

            {/* Message de résultat */}
            {deleteResult && (
              <div className={`p-3 rounded-lg text-sm ${
                deleteResult.startsWith("Erreur")
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}>
                {deleteResult}
              </div>
            )}

            {/* Section Dossiers globaux */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Dossiers
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-100 justify-start"
                  onClick={() => handleDeleteRequest({
                    type: "all",
                    count: counts?.total || 0,
                    label: "TOUS les dossiers"
                  })}
                  disabled={isDeleting || (counts?.total || 0) === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Tous ({counts?.total || 0})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-300 text-orange-700 hover:bg-orange-100 justify-start"
                  onClick={() => handleDeleteRequest({
                    type: "archives",
                    count: counts?.archives || 0,
                    label: "les archives"
                  })}
                  disabled={isDeleting || (counts?.archives || 0) === 0}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archives ({counts?.archives || 0})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-700 hover:bg-purple-100 justify-start"
                  onClick={() => handleDeleteRequest({
                    type: "anciens",
                    count: counts?.anciens || 0,
                    label: "les dossiers sans graphiste (anciens)"
                  })}
                  disabled={isDeleting || (counts?.anciens || 0) === 0}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Anciens ({counts?.anciens || 0})
                </Button>
              </div>
            </div>

            {/* Section Par graphiste */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <User className="h-4 w-4" />
                Par graphiste
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {profiles?.filter(p => p.is_active).map((p) => {
                  const count = countsByGraphiste?.[p.id] || 0;
                  return (
                    <Button
                      key={p.id}
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-700 hover:bg-blue-100 justify-start"
                      onClick={() => handleDeleteRequest({
                        type: "graphiste",
                        graphisteId: p.id,
                        graphisteName: p.full_name,
                        count,
                        label: `les dossiers de ${p.full_name}`
                      })}
                      disabled={isDeleting || count === 0}
                    >
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center mr-2">
                        {p.initials}
                      </span>
                      {p.full_name.split(" ")[0]} ({count})
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Section Autres données */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Autres données
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-700 hover:bg-green-100 justify-start"
                  onClick={() => handleDeleteRequest({
                    type: "franchises",
                    count: counts?.franchises || 0,
                    label: "les franchises"
                  })}
                  disabled={isDeleting || (counts?.franchises || 0) === 0}
                >
                  <Building className="h-4 w-4 mr-2" />
                  Franchises ({counts?.franchises || 0})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-cyan-300 text-cyan-700 hover:bg-cyan-100 justify-start"
                  onClick={() => handleDeleteRequest({
                    type: "projets",
                    count: counts?.projets || 0,
                    label: "les projets internes"
                  })}
                  disabled={isDeleting || (counts?.projets || 0) === 0}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Projets ({counts?.projets || 0})
                </Button>
              </div>
            </div>
          </CardContent>
          )}
        </Card>
      )}

      {/* Modal de confirmation */}
      {showConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirmer la suppression
                </h3>
                <p className="text-sm text-gray-500">
                  Cette action est irréversible
                </p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Vous êtes sur le point de supprimer <strong>{deleteTarget.label}</strong>.
              <br />
              <span className="text-red-600 font-medium">{deleteTarget.count} élément(s) seront supprimés.</span>
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirm(false);
                  setDeleteTarget(null);
                }}
                disabled={isDeleting}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de création/édition de statut */}
      {showStatutForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingStatut ? "Modifier le statut" : "Nouveau statut"}
              </h3>
              <Button variant="ghost" size="sm" onClick={resetStatutForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Valeur (identifiant) */}
              <div className="space-y-2">
                <Label htmlFor="statut-value">Identifiant (valeur technique)</Label>
                <Input
                  id="statut-value"
                  value={statutForm.value}
                  onChange={(e) =>
                    setStatutForm((f) => ({ ...f, value: e.target.value }))
                  }
                  placeholder="ex: en_cours"
                />
                {editingStatut && editingStatut.value !== statutForm.value && (
                  <p className="text-xs text-orange-600">
                    ⚠️ Modifier l'identifiant mettra à jour tous les dossiers existants
                  </p>
                )}
              </div>

              {/* Label */}
              <div className="space-y-2">
                <Label htmlFor="statut-label">Label affiché</Label>
                <Input
                  id="statut-label"
                  value={statutForm.label}
                  onChange={(e) =>
                    setStatutForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="ex: En cours"
                />
              </div>

              {/* Couleur */}
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="grid grid-cols-5 gap-2">
                  {AVAILABLE_COLORS.map((color, index) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() =>
                        setStatutForm((f) => ({ ...f, colorIndex: index }))
                      }
                      className={`p-2 rounded-lg border-2 transition-all ${
                        statutForm.colorIndex === index
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-transparent hover:border-gray-300"
                      }`}
                    >
                      <Badge className={color.color}>{color.name}</Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Icône */}
              <div className="space-y-2">
                <Label>Icône</Label>
                <div className="grid grid-cols-7 gap-2">
                  {AVAILABLE_ICONS.map((iconName) => {
                    const IconComp = ICON_COMPONENTS[iconName] || Circle;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() =>
                          setStatutForm((f) => ({ ...f, iconName }))
                        }
                        className={`p-2 rounded-lg border-2 flex items-center justify-center transition-all ${
                          statutForm.iconName === iconName
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        title={iconName}
                      >
                        <IconComp className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prévisualisation */}
              <div className="space-y-2">
                <Label>Prévisualisation</Label>
                <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-center">
                  <Badge className={AVAILABLE_COLORS[statutForm.colorIndex]?.color}>
                    {(() => {
                      const PreviewIcon = ICON_COMPONENTS[statutForm.iconName] || Circle;
                      return <PreviewIcon className="h-3 w-3 mr-1" />;
                    })()}
                    {statutForm.label || "Aperçu"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <Button variant="outline" onClick={resetStatutForm}>
                Annuler
              </Button>
              <Button
                onClick={handleSaveStatut}
                disabled={
                  !statutForm.value.trim() ||
                  !statutForm.label.trim() ||
                  createStatut.isPending ||
                  updateStatut.isPending
                }
              >
                {(createStatut.isPending || updateStatut.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {editingStatut ? "Enregistrer" : "Créer"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de suppression de statut */}
      {showDeleteStatutModal && statutToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Supprimer le statut
                </h3>
                <p className="text-sm text-gray-500">
                  Choisissez un statut de remplacement
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Vous allez supprimer le statut{" "}
                <Badge className={statutToDelete.color}>{statutToDelete.label}</Badge>.
                <br />
                Tous les dossiers avec ce statut seront mis à jour.
              </p>

              <Label htmlFor="replacement-statut">Remplacer par :</Label>
              <select
                id="replacement-statut"
                className="mt-2 w-full rounded-lg border border-gray-300 p-2"
                value={replacementStatutId}
                onChange={(e) => setReplacementStatutId(e.target.value)}
              >
                {statuts
                  ?.filter((s) => s.id !== statutToDelete.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteStatutModal(false);
                  setStatutToDelete(null);
                  setReplacementStatutId("");
                }}
                disabled={deleteStatut.isPending}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteStatut}
                disabled={deleteStatut.isPending || !replacementStatutId}
              >
                {deleteStatut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer et remplacer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
