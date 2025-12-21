import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ROUTES } from "@/lib/constants";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useAuthStore } from "@/stores/authStore";
import { useProfiles } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineEdit } from "@/components/shared/InlineEdit";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { FranchiseProcedure, FranchiseProcedureInsert, FranchiseProcedureUpdate, Franchise, DossierWithGraphiste } from "@/types";
import type { BadgeColorId } from "@/types/database";
import {
  Building2,
  Plus,
  Trash2,
  Search,
  X,
  UserPlus,
  ArrowRightLeft,
  Users,
  FileText,
  Pencil,
  Mail,
  Check,
  AlertCircle,
  Save,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Archive,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { getFirstName, cn, formatDate } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types d'onglet
type TabType = "attribution" | "fonctionnement";

interface FranchiseWithAssignments {
  id: string;
  nom: string;
  created_at: string;
  assignments: {
    graphiste_id: string;
    graphiste: {
      id: string;
      full_name: string;
      initials: string;
      badge_color: string | null;
    };
  }[];
}

export default function Franchises() {
  const { isAdmin } = useEffectiveRole();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  const { data: profiles } = useProfiles();

  const [activeTab, setActiveTab] = useState<TabType>("attribution");
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<FranchiseWithAssignments | null>(null);

  // Récupérer les franchises avec leurs assignations
  const { data: franchises, isLoading } = useQuery({
    queryKey: ["franchises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchises")
        .select(`
          *,
          assignments:franchise_assignments(
            graphiste_id,
            graphiste:profiles(id, full_name, initials, badge_color)
          )
        `)
        .order("nom");

      if (error) throw error;
      return data as FranchiseWithAssignments[];
    },
  });

  // Mettre à jour le nom d'une franchise (inline)
  const updateFranchiseName = useMutation({
    mutationFn: async ({ id, nom }: { id: string; nom: string }) => {
      const { error } = await supabase
        .from("franchises")
        .update({ nom })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      toast.success("Franchise mise à jour");
    },
    onError: (error: Error) => {
      if (error.message.includes("unique")) {
        toast.error("Cette franchise existe déjà");
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    },
  });

  // Ajouter un graphiste à une franchise
  const addGraphiste = useMutation({
    mutationFn: async ({ franchiseId, graphisteId }: { franchiseId: string; graphisteId: string }) => {
      const { error } = await supabase
        .from("franchise_assignments")
        .insert({ franchise_id: franchiseId, graphiste_id: graphisteId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      toast.success("Graphiste ajouté");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  // Retirer un graphiste d'une franchise
  const removeGraphiste = useMutation({
    mutationFn: async ({ franchiseId, graphisteId }: { franchiseId: string; graphisteId: string }) => {
      const { error } = await supabase
        .from("franchise_assignments")
        .delete()
        .eq("franchise_id", franchiseId)
        .eq("graphiste_id", graphisteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      toast.success("Graphiste retiré");
    },
    onError: () => {
      toast.error("Erreur lors du retrait");
    },
  });

  // Déplacer une franchise d'un graphiste à un autre (drag & drop)
  const moveFranchise = useMutation({
    mutationFn: async ({ franchiseId, fromGraphisteId, toGraphisteId }: { franchiseId: string; fromGraphisteId: string; toGraphisteId: string }) => {
      // Si on déplace vers "unassigned", on supprime juste l'assignation
      if (toGraphisteId === "unassigned") {
        if (fromGraphisteId !== "unassigned") {
          const { error } = await supabase
            .from("franchise_assignments")
            .delete()
            .eq("franchise_id", franchiseId)
            .eq("graphiste_id", fromGraphisteId);
          if (error) throw error;
        }
        return;
      }

      // Si on vient de "unassigned", on ajoute juste
      if (fromGraphisteId === "unassigned") {
        const { error } = await supabase
          .from("franchise_assignments")
          .insert({ franchise_id: franchiseId, graphiste_id: toGraphisteId });
        if (error) throw error;
        return;
      }

      // Sinon, on supprime l'ancienne et on ajoute la nouvelle
      const { error: deleteError } = await supabase
        .from("franchise_assignments")
        .delete()
        .eq("franchise_id", franchiseId)
        .eq("graphiste_id", fromGraphisteId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("franchise_assignments")
        .insert({ franchise_id: franchiseId, graphiste_id: toGraphisteId });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      toast.success("Franchise déplacée");
    },
    onError: () => {
      toast.error("Erreur lors du déplacement");
    },
  });

  // Créer une franchise
  const createFranchise = useMutation({
    mutationFn: async (nom: string) => {
      const { data, error } = await supabase
        .from("franchises")
        .insert({ nom })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      toast.success("Franchise créée");
    },
    onError: (error: Error) => {
      if (error.message.includes("unique")) {
        toast.error("Cette franchise existe déjà");
      } else {
        toast.error("Erreur lors de la création");
      }
    },
  });

  // Supprimer une franchise
  const deleteFranchise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("franchises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      toast.success("Franchise supprimée");
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  // Filtrage par recherche
  const filteredFranchises = useMemo(() => {
    if (!search) return franchises ?? [];
    return (franchises ?? []).filter((f) =>
      f.nom.toLowerCase().includes(search.toLowerCase())
    );
  }, [franchises, search]);

  // Grouper les franchises par graphiste
  const franchisesByGraphiste = useMemo(() => {
    const grouped: Record<string, { graphiste: { id: string; full_name: string; initials: string }; franchises: FranchiseWithAssignments[] }> = {};

    // Initialiser avec tous les graphistes
    profiles?.forEach((p) => {
      grouped[p.id] = {
        graphiste: { id: p.id, full_name: p.full_name, initials: p.initials },
        franchises: [],
      };
    });

    // Ajouter une catégorie "Non assigné"
    grouped["unassigned"] = {
      graphiste: { id: "unassigned", full_name: "Non assigné", initials: "?" },
      franchises: [],
    };

    // Répartir les franchises
    filteredFranchises.forEach((franchise) => {
      if (franchise.assignments.length === 0) {
        grouped["unassigned"].franchises.push(franchise);
      } else {
        // Vérifier si au moins une assignation est vers un graphiste actif
        const hasActiveGraphiste = franchise.assignments.some((a) => grouped[a.graphiste_id]);

        if (!hasActiveGraphiste) {
          // Toutes les assignations sont vers des graphistes inactifs -> mettre en "Non assigné"
          if (!grouped["unassigned"].franchises.find((f) => f.id === franchise.id)) {
            grouped["unassigned"].franchises.push(franchise);
          }
        } else {
          franchise.assignments.forEach((a) => {
            if (grouped[a.graphiste_id]) {
              // Éviter les doublons si déjà ajouté
              if (!grouped[a.graphiste_id].franchises.find((f) => f.id === franchise.id)) {
                grouped[a.graphiste_id].franchises.push(franchise);
              }
            }
          });
        }
      }
    });

    // Convertir en tableau et filtrer les colonnes vides (sauf si recherche active)
    return Object.values(grouped).filter((g) => g.franchises.length > 0 || !search);
  }, [filteredFranchises, profiles, search]);

  // Graphistes disponibles pour une franchise (pas encore assignés)
  const getAvailableGraphistes = (franchise: FranchiseWithAssignments) => {
    const assignedIds = new Set(franchise.assignments.map((a) => a.graphiste_id));
    return profiles?.filter((p) => !assignedIds.has(p.id)) ?? [];
  };

  // Ajouter nouvelle franchise
  const handleAddFranchise = () => {
    const nom = prompt("Nom de la nouvelle franchise :");
    if (nom?.trim()) {
      createFranchise.mutate(nom.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Header compact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
            <Building2 className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Franchises</h1>
            <p className="text-xs text-gray-500">
              {filteredFranchises.length} franchise(s)
            </p>
          </div>
        </div>

        {isAdmin && activeTab === "attribution" && (
          <Button size="sm" onClick={handleAddFranchise}>
            <Plus className="mr-1 h-4 w-4" />
            Nouvelle
          </Button>
        )}
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("attribution")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "attribution"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <Users className="h-4 w-4" />
          Attribution
        </button>
        <button
          onClick={() => setActiveTab("fonctionnement")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "fonctionnement"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <FileText className="h-4 w-4" />
          Fonctionnement
        </button>
      </div>

      {/* Contenu selon l'onglet */}
      {activeTab === "fonctionnement" ? (
        <FonctionnementView
          franchises={franchises ?? []}
          isLoading={isLoading}
          search={search}
          setSearch={setSearch}
        />
      ) : (
        <>
          {/* Recherche */}
          <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Rechercher une franchise..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Affichage en colonnes par graphiste */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-2 text-gray-500">Chargement...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {franchisesByGraphiste.map((group) => (
            <div
              key={group.graphiste.id}
              className="rounded-lg border border-gray-200 bg-white overflow-hidden"
            >
              {/* Entête de colonne */}
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                    group.graphiste.id === "unassigned"
                      ? "bg-gray-100 text-gray-500"
                      : getBadgeClassName(profiles?.find(p => p.id === group.graphiste.id)?.badge_color)
                  )}>
                    {group.graphiste.initials}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{getFirstName(group.graphiste.full_name)}</div>
                    <div className="text-xs text-gray-500">{group.franchises.length} franchise(s)</div>
                  </div>
                </div>
              </div>

              {/* Liste des franchises */}
              <div className="divide-y divide-gray-100 min-h-[60px]">
                {group.franchises.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center italic">
                    Aucune franchise
                  </div>
                ) : (
                  group.franchises.map((franchise) => (
                    <div
                      key={franchise.id}
                      className="px-3 py-2 hover:bg-gray-50 group/item flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        {isAdmin ? (
                          <InlineEdit
                            value={franchise.nom}
                            onSave={(nom) => updateFranchiseName.mutate({ id: franchise.id, nom })}
                            className="text-sm truncate"
                          />
                        ) : (
                          <span className="text-sm truncate block">{franchise.nom}</span>
                        )}
                        {/* Badges des autres graphistes assignés */}
                        {franchise.assignments.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {franchise.assignments
                              .filter((a) => a.graphiste_id !== group.graphiste.id)
                              .map((a) => (
                                <span
                                  key={a.graphiste_id}
                                  className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded"
                                >
                                  +{a.graphiste?.initials}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          {/* Transférer vers un autre graphiste */}
                          {group.graphiste.id !== "unassigned" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-blue-100 text-gray-500 hover:text-blue-600"
                                  title="Transférer vers..."
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[100]">
                                {profiles?.filter((p) => p.id !== group.graphiste.id).map((p) => (
                                  <DropdownMenuItem
                                    key={p.id}
                                    onClick={() => moveFranchise.mutate({
                                      franchiseId: franchise.id,
                                      fromGraphisteId: group.graphiste.id,
                                      toGraphisteId: p.id,
                                    })}
                                  >
                                    <span className={cn(
                                      "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium mr-2",
                                      getBadgeClassName(p.badge_color)
                                    )}>
                                      {p.initials}
                                    </span>
                                    {getFirstName(p.full_name)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {/* Ajouter un graphiste */}
                          {getAvailableGraphistes(franchise).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500"
                                  title="Ajouter un graphiste"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[100]">
                                {getAvailableGraphistes(franchise).map((p) => (
                                  <DropdownMenuItem
                                    key={p.id}
                                    onClick={() => addGraphiste.mutate({
                                      franchiseId: franchise.id,
                                      graphisteId: p.id,
                                    })}
                                  >
                                    <span className={cn(
                                      "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium mr-2",
                                      getBadgeClassName(p.badge_color)
                                    )}>
                                      {p.initials}
                                    </span>
                                    {getFirstName(p.full_name)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {/* Retirer de ce graphiste */}
                          {group.graphiste.id !== "unassigned" && (
                            <button
                              onClick={() => removeGraphiste.mutate({
                                franchiseId: franchise.id,
                                graphisteId: group.graphiste.id,
                              })}
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                              title="Retirer de ce graphiste"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Supprimer la franchise */}
                          <button
                            onClick={() => setDeleteConfirm(franchise)}
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                            title="Supprimer la franchise"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Supprimer la franchise"
        description={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm?.nom}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
        icon="delete"
        onConfirm={() => deleteConfirm && deleteFranchise.mutate(deleteConfirm.id)}
        loading={deleteFranchise.isPending}
      />
        </>
      )}
    </div>
  );
}

// ============================================
// VUE FONCTIONNEMENT - Procédures des franchises
// ============================================

interface FonctionnementViewProps {
  franchises: FranchiseWithAssignments[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
}

// Type pour les procédures avec le graphiste jointé
interface FranchiseProcedureWithGraphiste extends FranchiseProcedure {
  graphiste?: {
    id: string;
    full_name: string;
    initials: string;
    badge_color: string | null;
  } | null;
}

function FonctionnementView({ franchises, isLoading, search, setSearch }: FonctionnementViewProps) {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const [editingFranchiseId, setEditingFranchiseId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dossiersModalFranchise, setDossiersModalFranchise] = useState<FranchiseWithAssignments | null>(null);

  // Récupérer les procédures avec le graphiste référent
  const { data: procedures } = useQuery({
    queryKey: ["franchise_procedures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchise_procedures")
        .select(`
          *,
          graphiste:profiles!graphiste_referent(id, full_name, initials, badge_color)
        `);
      if (error) throw error;
      return data as FranchiseProcedureWithGraphiste[];
    },
  });

  // Map des procédures par franchise_id
  const proceduresByFranchise = useMemo(() => {
    const map = new Map<string, FranchiseProcedureWithGraphiste>();
    procedures?.forEach((p) => map.set(p.franchise_id, p));
    return map;
  }, [procedures]);

  // Filtrer les franchises
  const filteredFranchises = useMemo(() => {
    if (!search) return franchises;
    return franchises.filter((f) =>
      f.nom.toLowerCase().includes(search.toLowerCase())
    );
  }, [franchises, search]);

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Créer ou mettre à jour une procédure
  const upsertProcedure = useMutation({
    mutationFn: async (data: FranchiseProcedureInsert | (FranchiseProcedureUpdate & { id: string })) => {
      if ('id' in data && data.id) {
        // Update
        const { error } = await supabase
          .from("franchise_procedures")
          .update({ ...data, updated_by: profile?.id })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("franchise_procedures")
          .insert({ ...data, created_by: profile?.id } as FranchiseProcedureInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchise_procedures"] });
      toast.success("Procédure enregistrée");
      setEditingFranchiseId(null);
    },
    onError: (error) => {
      console.error("Erreur sauvegarde procédure:", error);
      toast.error("Erreur lors de l'enregistrement");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span className="ml-2 text-gray-500">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recherche */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Rechercher une franchise..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Liste des franchises */}
      <div className="space-y-2">
        {filteredFranchises.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune franchise trouvée
          </div>
        ) : (
          filteredFranchises.map((franchise) => {
            const procedure = proceduresByFranchise.get(franchise.id);
            const isExpanded = expandedIds.has(franchise.id);
            const isEditing = editingFranchiseId === franchise.id;
            const hasProcedure = !!procedure;

            return (
              <div
                key={franchise.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Header de la franchise */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => !isEditing && toggleExpand(franchise.id)}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">{franchise.nom}</span>
                    {hasProcedure ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Documenté
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Non documenté
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDossiersModalFranchise(franchise);
                          }}
                          className="p-1.5 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-700"
                          title="Voir les dossiers"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFranchiseId(franchise.id);
                            setExpandedIds((prev) => new Set(prev).add(franchise.id));
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Contenu expandé */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-4">
                    {isEditing ? (
                      <ProcedureForm
                        franchiseId={franchise.id}
                        procedure={procedure}
                        assignedGraphistes={franchise.assignments.map((a) => a.graphiste).filter(Boolean) as { id: string; full_name: string; initials: string; badge_color: BadgeColorId | null }[]}
                        onSave={(data) => upsertProcedure.mutate(data)}
                        onCancel={() => setEditingFranchiseId(null)}
                        isSaving={upsertProcedure.isPending}
                      />
                    ) : (
                      <ProcedureDisplay
                        procedure={procedure}
                        assignedGraphistes={franchise.assignments.map((a) => a.graphiste).filter(Boolean) as { id: string; full_name: string; initials: string; badge_color: BadgeColorId | null }[]}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal des dossiers liés à la franchise */}
      <FranchiseDossiersModal
        franchise={dossiersModalFranchise}
        onClose={() => setDossiersModalFranchise(null)}
      />
    </div>
  );
}

// Modal pour afficher les dossiers liés à une franchise
function FranchiseDossiersModal({
  franchise,
  onClose,
}: {
  franchise: FranchiseWithAssignments | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"actifs" | "archives">("actifs");

  // Recherche floue : on prend les premiers mots significatifs du nom de franchise
  // et on cherche les dossiers qui contiennent ces mots
  const searchTerms = useMemo(() => {
    if (!franchise) return [];
    // Retirer les articles et mots courts, prendre les mots significatifs
    const words = franchise.nom
      .split(/[\s\-_]+/)
      .filter((w) => w.length >= 3)
      .map((w) => w.toLowerCase());
    return words.slice(0, 3); // Max 3 mots
  }, [franchise?.nom]);

  // Récupérer les dossiers actifs
  const { data: dossiersActifs, isLoading: loadingActifs } = useQuery({
    queryKey: ["franchise-dossiers-actifs", franchise?.id, searchTerms],
    queryFn: async () => {
      if (!franchise || searchTerms.length === 0) return [];

      // Recherche avec ILIKE pour chaque terme
      const { data, error } = await supabase
        .from("dossiers")
        .select(`
          *,
          graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
        `)
        .eq("is_archived", false)
        .or(searchTerms.map((term) => `nom.ilike.%${term}%`).join(","))
        .order("date_creation", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as DossierWithGraphiste[];
    },
    enabled: !!franchise && searchTerms.length > 0,
  });

  // Récupérer les archives
  const { data: dossiersArchives, isLoading: loadingArchives } = useQuery({
    queryKey: ["franchise-dossiers-archives", franchise?.id, searchTerms],
    queryFn: async () => {
      if (!franchise || searchTerms.length === 0) return [];

      const { data, error } = await supabase
        .from("dossiers")
        .select(`
          *,
          graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
        `)
        .eq("is_archived", true)
        .or(searchTerms.map((term) => `nom.ilike.%${term}%`).join(","))
        .order("date_archivage", { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      return data as DossierWithGraphiste[];
    },
    enabled: !!franchise && searchTerms.length > 0,
  });

  const dossiers = activeTab === "actifs" ? dossiersActifs : dossiersArchives;
  const isLoading = activeTab === "actifs" ? loadingActifs : loadingArchives;

  return (
    <Dialog open={!!franchise} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-orange-500" />
            Dossiers - {franchise?.nom}
          </DialogTitle>
        </DialogHeader>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-gray-200 -mx-6 px-6">
          <button
            onClick={() => setActiveTab("actifs")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "actifs"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <FileText className="h-4 w-4 inline mr-1.5" />
            Actifs ({dossiersActifs?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("archives")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "archives"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Archive className="h-4 w-4 inline mr-1.5" />
            Archives ({dossiersArchives?.length ?? 0})
          </button>
        </div>

        {/* Info recherche */}
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
          Recherche basée sur : <strong>{searchTerms.join(", ")}</strong>
          <span className="ml-2 text-gray-400">(mots extraits du nom de la franchise)</span>
        </div>

        {/* Liste des dossiers */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Chargement...</span>
            </div>
          ) : !dossiers || dossiers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {activeTab === "actifs"
                ? "Aucun dossier actif trouvé pour cette franchise"
                : "Aucune archive trouvée pour cette franchise"
              }
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {dossiers.map((dossier) => (
                <div
                  key={dossier.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{dossier.nom}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                            dossier.graphiste
                              ? getBadgeClassName(dossier.graphiste.badge_color)
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {dossier.graphiste?.initials || "AG"}
                        </span>
                        {dossier.graphiste ? getFirstName(dossier.graphiste.full_name) : "Ancien"}
                      </span>
                      <span>
                        {activeTab === "actifs"
                          ? `Créé le ${formatDate(dossier.date_creation)}`
                          : `Archivé le ${formatDate(dossier.date_archivage)}`
                        }
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <StatusBadge statut={dossier.statut} />
                    {dossier.bat_count > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {dossier.bat_count} BAT
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Affichage d'une procédure en lecture seule
function ProcedureDisplay({
  procedure,
  assignedGraphistes
}: {
  procedure?: FranchiseProcedureWithGraphiste;
  assignedGraphistes: { id: string; full_name: string; initials: string; badge_color: BadgeColorId | null }[];
}) {
  if (!procedure) {
    return (
      <div className="text-center py-4 text-gray-400 italic">
        Aucune procédure documentée pour cette franchise.
        <br />
        Cliquez sur le crayon pour ajouter des informations.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Infos contacts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {procedure.commercial && (
          <div>
            <span className="text-xs font-medium text-gray-500">Commercial</span>
            <p className="text-sm">{procedure.commercial}</p>
          </div>
        )}
        {assignedGraphistes.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500">
              {assignedGraphistes.length > 1 ? "Graphistes référents" : "Graphiste référent"}
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {assignedGraphistes.map((g) => (
                <div key={g.id} className="flex items-center gap-1.5">
                  <span className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    getBadgeClassName(g.badge_color)
                  )}>
                    {g.initials}
                  </span>
                  <span className="text-sm">{getFirstName(g.full_name)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {procedure.franchiseur_contacts && (
          <div>
            <span className="text-xs font-medium text-gray-500">Contact franchiseur</span>
            <p className="text-sm whitespace-pre-line">{procedure.franchiseur_contacts}</p>
          </div>
        )}
      </div>

      {/* Options oui/non */}
      <div className="flex flex-wrap gap-3">
        <OptionBadge label="Mail au franchiseur" value={procedure.mail_franchiseur} />
        <OptionBadge label="Mail au franchisé" value={procedure.mail_franchise} />
        <OptionBadge label="BAT avant VT" value={procedure.bat_avant_vt} />
        <OptionBadge label="Signalétique provisoire" value={procedure.signaletique_provisoire} />
      </div>

      {/* Détails signalétique provisoire */}
      {procedure.signaletique_provisoire && procedure.signaletique_provisoire_details && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <span className="text-xs font-medium text-yellow-700">Signalétique provisoire à prévoir</span>
          <p className="text-sm text-yellow-800 mt-1">{procedure.signaletique_provisoire_details}</p>
        </div>
      )}

      {/* Étapes clés */}
      {procedure.etapes_cles && (
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 block mb-2">Étapes clés / Informations</span>
          <div className="text-sm whitespace-pre-line">{procedure.etapes_cles}</div>
        </div>
      )}
    </div>
  );
}

// Badge pour option oui/non
function OptionBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full flex items-center gap-1",
        value
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
      )}
    >
      {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

// Formulaire d'édition de procédure
function ProcedureForm({
  franchiseId,
  procedure,
  assignedGraphistes,
  onSave,
  onCancel,
  isSaving,
}: {
  franchiseId: string;
  procedure?: FranchiseProcedureWithGraphiste;
  assignedGraphistes: { id: string; full_name: string; initials: string; badge_color: BadgeColorId | null }[];
  onSave: (data: FranchiseProcedureInsert | (FranchiseProcedureUpdate & { id: string })) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    commercial: procedure?.commercial || "",
    franchiseur_contacts: procedure?.franchiseur_contacts || "",
    mail_franchiseur: procedure?.mail_franchiseur || false,
    mail_franchise: procedure?.mail_franchise || false,
    bat_avant_vt: procedure?.bat_avant_vt || false,
    signaletique_provisoire: procedure?.signaletique_provisoire || false,
    signaletique_provisoire_details: procedure?.signaletique_provisoire_details || "",
    etapes_cles: procedure?.etapes_cles || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (procedure) {
      onSave({
        id: procedure.id,
        ...formData,
        signaletique_provisoire_details: formData.signaletique_provisoire ? formData.signaletique_provisoire_details : null,
      });
    } else {
      onSave({
        franchise_id: franchiseId,
        ...formData,
        signaletique_provisoire_details: formData.signaletique_provisoire ? formData.signaletique_provisoire_details : null,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Contacts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Commercial</label>
          <input
            type="text"
            value={formData.commercial}
            onChange={(e) => setFormData({ ...formData, commercial: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
            placeholder="Nom du commercial"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            {assignedGraphistes.length > 1 ? "Graphistes référents" : "Graphiste référent"}
          </label>
          {assignedGraphistes.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">
              Aucun graphiste assigné
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 py-2">
              {assignedGraphistes.map((g) => (
                <div key={g.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-2 py-1">
                  <span className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                    getBadgeClassName(g.badge_color)
                  )}>
                    {g.initials}
                  </span>
                  <span className="text-xs">{getFirstName(g.full_name)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">Géré dans l'onglet Attribution</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Contact franchiseur (emails)</label>
          <textarea
            value={formData.franchiseur_contacts}
            onChange={(e) => setFormData({ ...formData, franchiseur_contacts: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none resize-none"
            rows={2}
            placeholder="email@exemple.com"
          />
        </div>
      </div>

      {/* Options toggle */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ToggleOption
          label="Mail au franchiseur"
          checked={formData.mail_franchiseur}
          onChange={(v) => setFormData({ ...formData, mail_franchiseur: v })}
        />
        <ToggleOption
          label="Mail au franchisé"
          checked={formData.mail_franchise}
          onChange={(v) => setFormData({ ...formData, mail_franchise: v })}
        />
        <ToggleOption
          label="BAT avant VT"
          checked={formData.bat_avant_vt}
          onChange={(v) => setFormData({ ...formData, bat_avant_vt: v })}
        />
        <ToggleOption
          label="Signalétique provisoire"
          checked={formData.signaletique_provisoire}
          onChange={(v) => setFormData({ ...formData, signaletique_provisoire: v })}
        />
      </div>

      {/* Détails signalétique provisoire */}
      {formData.signaletique_provisoire && (
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Que faut-il prévoir pour la signalétique provisoire ?
          </label>
          <input
            type="text"
            value={formData.signaletique_provisoire_details}
            onChange={(e) => setFormData({ ...formData, signaletique_provisoire_details: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
            placeholder="Ex: Adhésif format A0, bâche..."
          />
        </div>
      )}

      {/* Étapes clés */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">
          Étapes clés / Informations supplémentaires
        </label>
        <textarea
          value={formData.etapes_cles}
          onChange={(e) => setFormData({ ...formData, etapes_cles: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none resize-none"
          rows={6}
          placeholder="• Étape 1...&#10;• Étape 2...&#10;• Information importante..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

// Toggle option component
function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "w-10 h-6 rounded-full transition-colors relative flex-shrink-0",
          checked ? "bg-green-500" : "bg-gray-200"
        )}
      >
        <span
          className={cn(
            "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-1"
          )}
        />
      </button>
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  );
}
