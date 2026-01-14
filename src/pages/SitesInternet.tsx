import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import type { SiteInternet, SiteInternetInsert, SiteInternetUpdate } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-shell";
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// Fonction pour normaliser le texte (enlever les accents)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Hook pour récupérer les sites
function useSitesInternet() {
  return useQuery({
    queryKey: ["sites-internet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites_internet")
        .select("*")
        .order("categorie", { ascending: true, nullsFirst: false })
        .order("ordre", { ascending: true })
        .order("nom", { ascending: true });

      if (error) throw error;
      return data as SiteInternet[];
    },
  });
}

// Hook pour créer un site
function useCreateSite() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (site: Omit<SiteInternetInsert, "created_by">) => {
      const { data, error } = await supabase
        .from("sites_internet")
        .insert({ ...site, created_by: profile?.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites-internet"] });
      toast.success("Site ajouté");
    },
    onError: (error) => {
      console.error("Erreur création site:", error);
      toast.error("Erreur lors de l'ajout du site");
    },
  });
}

// Hook pour modifier un site
function useUpdateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: SiteInternetUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("sites_internet")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites-internet"] });
      toast.success("Site modifié");
    },
    onError: (error) => {
      console.error("Erreur modification site:", error);
      toast.error("Erreur lors de la modification");
    },
  });
}

// Hook pour supprimer un site
function useDeleteSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites_internet").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites-internet"] });
      toast.success("Site supprimé");
    },
    onError: (error) => {
      console.error("Erreur suppression site:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Composant Modal pour ajouter/éditer
function SiteModal({
  site,
  onClose,
  onSave,
  isLoading,
  existingCategories,
}: {
  site?: SiteInternet;
  onClose: () => void;
  onSave: (data: SiteInternetInsert | (SiteInternetUpdate & { id: string })) => void;
  isLoading: boolean;
  existingCategories: string[];
}) {
  const [formData, setFormData] = useState({
    nom: site?.nom || "",
    url: site?.url || "",
    identifiant: site?.identifiant || "",
    mot_de_passe: site?.mot_de_passe || "",
    notes: site?.notes || "",
    categorie: site?.categorie || "",
  });
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    // Si on ajoute une nouvelle catégorie
    const finalCategorie = showNewCategory ? newCategory.trim() : formData.categorie;
    const dataToSave = { ...formData, categorie: finalCategorie || null };

    if (site?.id) {
      onSave({ id: site.id, ...dataToSave });
    } else {
      onSave(dataToSave);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold dark:text-slate-100">
            {site ? "Modifier le site" : "Ajouter un site"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Nom du site *
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600"
              placeholder="Ex: Supabase Dashboard"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600"
              placeholder="https://example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Identifiant
              </label>
              <input
                type="text"
                value={formData.identifiant}
                onChange={(e) => setFormData({ ...formData, identifiant: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600"
                placeholder="user@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Mot de passe
              </label>
              <input
                type="text"
                value={formData.mot_de_passe}
                onChange={(e) => setFormData({ ...formData, mot_de_passe: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Catégorie
            </label>
            {!showNewCategory ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600 appearance-none"
                  >
                    <option value="">Sans catégorie</option>
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors whitespace-nowrap"
                >
                  + Nouvelle
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nom de la nouvelle catégorie"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategory("");
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600 resize-none"
              placeholder="Informations complémentaires..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Enregistrement..." : site ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Composant carte site (compact et dépliable)
function SiteCard({
  site,
  onEdit,
  onDelete,
  isAdmin,
}: {
  site: SiteInternet;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = async (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const openUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (site.url) {
      try {
        await open(site.url);
      } catch (err) {
        console.error("Erreur ouverture URL:", err);
        toast.error("Impossible d'ouvrir le lien");
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const hasDetails = site.identifiant || site.mot_de_passe || site.notes;

  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm transition-all cursor-pointer",
        expanded ? "shadow-md" : "hover:shadow-md"
      )}
    >
      {/* Header compact - toujours visible */}
      <div
        className="flex items-center gap-3 p-3"
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Chevron si dépliable */}
        {hasDetails ? (
          <ChevronRight
            className={cn(
              "h-4 w-4 text-gray-400 dark:text-slate-500 transition-transform flex-shrink-0",
              expanded && "rotate-90"
            )}
          />
        ) : (
          <div className="w-4" />
        )}

        {/* Nom du site */}
        <h3 className="font-medium text-gray-900 dark:text-slate-100 truncate flex-1">{site.nom}</h3>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {site.url && (
            <button
              onClick={openUrl}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              title="Ouvrir le site"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contenu déplié */}
      {expanded && hasDetails && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t dark:border-slate-700 mx-3 mt-0 pt-3">
          {/* URL */}
          {site.url && (
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{site.url}</p>
          )}

          {/* Identifiants */}
          {(site.identifiant || site.mot_de_passe) && (
            <div className="space-y-2">
              {site.identifiant && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-500 dark:text-slate-400">Identifiant:</span>
                  <div className="flex items-center gap-1">
                    <code className="text-sm bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-2 py-0.5 rounded truncate max-w-[200px]">
                      {site.identifiant}
                    </code>
                    <button
                      onClick={(e) => copyToClipboard(site.identifiant!, "Identifiant", e)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                      title="Copier"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {site.mot_de_passe && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-500 dark:text-slate-400">Mot de passe:</span>
                  <div className="flex items-center gap-1">
                    <code className="text-sm bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-2 py-0.5 rounded font-mono">
                      {showPassword ? site.mot_de_passe : "••••••••"}
                    </code>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPassword(!showPassword);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                      title={showPassword ? "Masquer" : "Afficher"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => copyToClipboard(site.mot_de_passe!, "Mot de passe", e)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                      title="Copier"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {site.notes && (
            <p className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
              {site.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SitesInternet() {
  const { isAdmin } = useEffectiveRole();

  const { data: sites, isLoading } = useSitesInternet();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const deleteSite = useDeleteSite();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteInternet | undefined>();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Extraire les catégories uniques (hors null)
  const existingCategories = sites
    ? [...new Set(sites.map((s) => s.categorie).filter((c): c is string => !!c))].sort()
    : [];

  // Grouper par catégorie
  const groupedSites = sites?.reduce(
    (acc, site) => {
      const cat = site.categorie || "Sans catégorie";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(site);
      return acc;
    },
    {} as Record<string, SiteInternet[]>
  );

  // Filtrer par recherche et catégorie
  const filteredGroups = groupedSites
    ? Object.entries(groupedSites).reduce(
        (acc, [cat, catSites]) => {
          // Filtrer par catégorie sélectionnée
          if (categoryFilter && cat !== categoryFilter) {
            return acc;
          }

          // Filtrer par recherche texte (insensible aux accents)
          const searchNormalized = normalizeText(search);
          const filtered = catSites.filter(
            (s) =>
              normalizeText(s.nom).includes(searchNormalized) ||
              (s.url && normalizeText(s.url).includes(searchNormalized)) ||
              (s.notes && normalizeText(s.notes).includes(searchNormalized))
          );
          if (filtered.length > 0) {
            acc[cat] = filtered;
          }
          return acc;
        },
        {} as Record<string, SiteInternet[]>
      )
    : {};

  const handleSave = (data: SiteInternetInsert | (SiteInternetUpdate & { id: string })) => {
    if ("id" in data && data.id) {
      updateSite.mutate(data as SiteInternetUpdate & { id: string }, {
        onSuccess: () => {
          setModalOpen(false);
          setEditingSite(undefined);
        },
      });
    } else {
      createSite.mutate(data as SiteInternetInsert, {
        onSuccess: () => {
          setModalOpen(false);
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteSite.mutate(id, {
      onSuccess: () => setDeleteConfirm(null),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Sites Internet</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Accès rapide aux sites et identifiants
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingSite(undefined);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter un site
        </button>
      </div>

      {/* Recherche et filtre */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un site..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600"
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

        {/* Filtre par catégorie */}
        {existingCategories.length > 0 && (
          <div className="relative min-w-[180px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={cn(
                "w-full pl-10 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-800 dark:focus:border-blue-600 appearance-none bg-white dark:bg-slate-700 dark:text-slate-100",
                categoryFilter ? "border-blue-500 text-blue-700 dark:text-blue-400" : "border-gray-300 dark:border-slate-600"
              )}
            >
              <option value="">Toutes les catégories</option>
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="Sans catégorie">Sans catégorie</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>
        )}

        {/* Bouton reset filtres */}
        {(search || categoryFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
            }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste des sites par catégorie */}
      {Object.keys(filteredGroups).length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700">
          <Globe className="h-12 w-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
          <p className="text-gray-500 dark:text-slate-400">
            {search || categoryFilter ? "Aucun site trouvé" : "Aucun site enregistré"}
          </p>
          {!search && !categoryFilter && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Ajouter le premier site
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(filteredGroups)
            .sort(([a], [b]) => {
              if (a === "Sans catégorie") return 1;
              if (b === "Sans catégorie") return -1;
              return a.localeCompare(b);
            })
            .map(([category, categorySites]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {category}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
                  {categorySites.map((site) => (
                    <SiteCard
                      key={site.id}
                      site={site}
                      isAdmin={isAdmin}
                      onEdit={() => {
                        setEditingSite(site);
                        setModalOpen(true);
                      }}
                      onDelete={() => setDeleteConfirm(site.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal ajout/édition */}
      {modalOpen && (
        <SiteModal
          site={editingSite}
          onClose={() => {
            setModalOpen(false);
            setEditingSite(undefined);
          }}
          onSave={handleSave}
          isLoading={createSite.isPending || updateSite.isPending}
          existingCategories={existingCategories}
        />
      )}

      {/* Modal confirmation suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
              Supprimer ce site ?
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteSite.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteSite.isPending ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
