import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useProfiles } from "@/hooks/useProfiles";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InlineEdit } from "@/components/shared/InlineEdit";
import { toast } from "sonner";
import type { ProjetInterne, Profile } from "@/types";
import {
  ClipboardList,
  Plus,
  Trash2,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFirstName, cn } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";

interface ProjetWithGraphiste extends ProjetInterne {
  graphiste: Profile | null;
}

// Statuts pour les projets internes
const PROJET_STATUTS = [
  { value: "a_faire", label: "A faire", color: "bg-blue-100 text-blue-700", dotColor: "bg-blue-500" },
  { value: "en_cours", label: "En cours", color: "bg-yellow-100 text-yellow-700", dotColor: "bg-yellow-500" },
  { value: "termine", label: "Terminé", color: "bg-green-100 text-green-700", dotColor: "bg-green-500" },
] as const;

type ProjetStatut = typeof PROJET_STATUTS[number]["value"];

export default function ProjetsInternes() {
  const { isAdmin } = useEffectiveRole();
  const queryClient = useQueryClient();

  const { data: profiles } = useProfiles();

  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<ProjetStatut | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProjet, setEditingProjet] = useState<ProjetWithGraphiste | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjetWithGraphiste | null>(null);

  // Form state
  const [commercial, setCommercial] = useState("");
  const [tache, setTache] = useState("");
  const [demande, setDemande] = useState("");
  const [graphisteId, setGraphisteId] = useState("");
  const [formStatut, setFormStatut] = useState<ProjetStatut>("a_faire");

  // Récupérer les projets
  const { data: projets, isLoading } = useQuery({
    queryKey: ["projets_internes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projets_internes")
        .select(`*, graphiste:profiles(*)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProjetWithGraphiste[];
    },
  });

  // Créer un projet
  const createProjet = useMutation({
    mutationFn: async (data: Partial<ProjetInterne>) => {
      const { data: projet, error } = await supabase
        .from("projets_internes")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return projet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projets_internes"] });
      toast.success("Projet créé");
      resetForm();
      setShowCreateModal(false);
    },
    onError: () => {
      toast.error("Erreur lors de la création");
    },
  });

  // Mettre à jour un projet
  const updateProjet = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjetInterne> }) => {
      const { error } = await supabase
        .from("projets_internes")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projets_internes"] });
      toast.success("Projet mis à jour");
      resetForm();
      setEditingProjet(null);
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  // Changer le statut rapidement
  const updateStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: ProjetStatut }) => {
      // Convertir le nouveau statut en is_termine pour la compatibilité
      const is_termine = statut === "termine";
      const { error } = await supabase
        .from("projets_internes")
        .update({ statut, is_termine })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projets_internes"] });
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour du statut");
    },
  });

  // Mettre à jour un champ inline
  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | null }) => {
      const { error } = await supabase
        .from("projets_internes")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projets_internes"] });
      toast.success("Mis à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  // Supprimer un projet
  const deleteProjet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projets_internes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projets_internes"] });
      toast.success("Projet supprimé");
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const resetForm = () => {
    setCommercial("");
    setTache("");
    setDemande("");
    setGraphisteId("");
    setFormStatut("a_faire");
  };

  const openEditModal = (projet: ProjetWithGraphiste) => {
    setCommercial(projet.commercial ?? "");
    setTache(projet.tache);
    setDemande(projet.demande ?? "");
    setGraphisteId(projet.graphiste_id ?? "");
    // Utiliser le statut ou déduire depuis is_termine
    setFormStatut(projet.statut as ProjetStatut ?? (projet.is_termine ? "termine" : "a_faire"));
    setEditingProjet(projet);
  };

  const handleSubmit = () => {
    if (!tache.trim()) {
      toast.error("La tâche est requise");
      return;
    }

    const data = {
      commercial: commercial || null,
      tache,
      demande: demande || null,
      graphiste_id: graphisteId || null,
      statut: formStatut,
      is_termine: formStatut === "termine",
    };

    if (editingProjet) {
      updateProjet.mutate({ id: editingProjet.id, data });
    } else {
      createProjet.mutate(data);
    }
  };

  const graphisteOptions = [
    { value: "", label: "Non assigné" },
    ...(profiles ?? []).map((p) => ({
      value: p.id,
      label: `${getFirstName(p.full_name)} (${p.initials})`,
    })),
  ];

  // Obtenir le statut effectif d'un projet
  const getProjetStatut = (projet: ProjetWithGraphiste): ProjetStatut => {
    if (projet.statut) return projet.statut as ProjetStatut;
    return projet.is_termine ? "termine" : "a_faire";
  };

  // Filtrage et calcul des compteurs
  const filteredProjets = useMemo(() => {
    let result = projets ?? [];

    // Filtre par recherche
    if (search) {
      result = result.filter((p) =>
        p.tache.toLowerCase().includes(search.toLowerCase()) ||
        p.commercial?.toLowerCase().includes(search.toLowerCase()) ||
        p.demande?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Filtre par statut
    if (statutFilter !== "all") {
      result = result.filter((p) => getProjetStatut(p) === statutFilter);
    }

    return result;
  }, [projets, search, statutFilter]);

  // Compteurs par statut
  const counts = useMemo(() => {
    const all = projets ?? [];
    return {
      all: all.length,
      a_faire: all.filter((p) => getProjetStatut(p) === "a_faire").length,
      en_cours: all.filter((p) => getProjetStatut(p) === "en_cours").length,
      termine: all.filter((p) => getProjetStatut(p) === "termine").length,
    };
  }, [projets]);

  // Obtenir les infos du statut
  const getStatutInfo = (statut: ProjetStatut) => {
    return PROJET_STATUTS.find((s) => s.value === statut) ?? PROJET_STATUTS[0];
  };

  return (
    <div className="space-y-4">
      {/* Header compact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100">
            <ClipboardList className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Projets Internes</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Tâches et demandes internes
            </p>
          </div>
        </div>

        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nouveau
        </Button>
      </div>

      {/* Onglets de statut */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setStatutFilter("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            statutFilter === "all"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300"
          }`}
        >
          Tous ({counts.all})
        </button>
        {PROJET_STATUTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatutFilter(s.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              statutFilter === s.value
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${s.dotColor}`} />
            {s.label} ({counts[s.value]})
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-slate-700/50">
              <TableHead className="w-28">Statut</TableHead>
              <TableHead>Commercial</TableHead>
              <TableHead>Tâche</TableHead>
              <TableHead>Demande</TableHead>
              <TableHead>Graphiste</TableHead>
              {isAdmin && <TableHead className="w-16">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span className="ml-2 text-sm text-gray-500 dark:text-slate-400">Chargement...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredProjets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center text-gray-500 dark:text-slate-400">
                  {search ? "Aucun résultat" : "Aucun projet"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProjets.map((projet) => {
                const currentStatut = getProjetStatut(projet);
                const statutInfo = getStatutInfo(currentStatut);

                return (
                  <TableRow key={projet.id} className="group">
                    <TableCell className="py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statutInfo.color}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statutInfo.dotColor}`} />
                            {statutInfo.label}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {PROJET_STATUTS.map((s) => (
                            <DropdownMenuItem
                              key={s.value}
                              onClick={() => updateStatut.mutate({ id: projet.id, statut: s.value })}
                              className={currentStatut === s.value ? "bg-gray-100 dark:bg-slate-600" : ""}
                            >
                              <span className={`h-2 w-2 rounded-full ${s.dotColor} mr-2`} />
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="py-2">
                      <InlineEdit
                        value={projet.commercial ?? ""}
                        onSave={(value) => updateField.mutate({
                          id: projet.id,
                          field: "commercial",
                          value: value || null,
                        })}
                        placeholder="Ajouter..."
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <InlineEdit
                        value={projet.tache}
                        onSave={(value) => updateField.mutate({
                          id: projet.id,
                          field: "tache",
                          value,
                        })}
                        className="font-medium"
                      />
                    </TableCell>
                    <TableCell className="py-2 max-w-xs">
                      <InlineEdit
                        value={projet.demande ?? ""}
                        onSave={(value) => updateField.mutate({
                          id: projet.id,
                          field: "demande",
                          value: value || null,
                        })}
                        type="textarea"
                        placeholder="Ajouter..."
                        className="text-sm text-gray-600 dark:text-slate-400"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-1 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 rounded px-1 py-0.5">
                            {projet.graphiste ? (
                              <>
                                <span className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                                  getBadgeClassName(projet.graphiste.badge_color)
                                )}>
                                  {projet.graphiste.initials}
                                </span>
                                <span className="whitespace-nowrap">{getFirstName(projet.graphiste.full_name)}</span>
                              </>
                            ) : (
                              <span className="text-gray-400 dark:text-slate-500 italic">Non assigné</span>
                            )}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => updateField.mutate({
                              id: projet.id,
                              field: "graphiste_id",
                              value: null,
                            })}
                          >
                            <span className="text-gray-400 dark:text-slate-500">Non assigné</span>
                          </DropdownMenuItem>
                          {profiles?.map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              onClick={() => updateField.mutate({
                                id: projet.id,
                                field: "graphiste_id",
                                value: p.id,
                              })}
                              className={projet.graphiste_id === p.id ? "bg-gray-100 dark:bg-slate-600" : ""}
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
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteConfirm(projet)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal création */}
      <Dialog
        open={showCreateModal || !!editingProjet}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setShowCreateModal(false);
            setEditingProjet(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProjet ? "Modifier le projet" : "Nouveau projet"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commercial">Commercial</Label>
                <Input
                  id="commercial"
                  placeholder="Nom du commercial"
                  value={commercial}
                  onChange={(e) => setCommercial(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="formStatut">Statut</Label>
                <Select
                  id="formStatut"
                  options={PROJET_STATUTS.map((s) => ({ value: s.value, label: s.label }))}
                  value={formStatut}
                  onChange={(e) => setFormStatut(e.target.value as ProjetStatut)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tache">
                Tâche <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tache"
                placeholder="Description de la tâche"
                value={tache}
                onChange={(e) => setTache(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="demande">Demande</Label>
              <Textarea
                id="demande"
                placeholder="Détails de la demande..."
                value={demande}
                onChange={(e) => setDemande(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="graphiste">Graphiste assigné</Label>
              <Select
                id="graphiste"
                options={graphisteOptions}
                value={graphisteId}
                onChange={(e) => setGraphisteId(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowCreateModal(false);
                setEditingProjet(null);
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createProjet.isPending || updateProjet.isPending}
            >
              {createProjet.isPending || updateProjet.isPending
                ? "Enregistrement..."
                : editingProjet
                ? "Enregistrer"
                : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Supprimer le projet"
        description={`Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
        icon="delete"
        onConfirm={() => deleteConfirm && deleteProjet.mutate(deleteConfirm.id)}
        loading={deleteProjet.isPending}
      />
    </div>
  );
}
