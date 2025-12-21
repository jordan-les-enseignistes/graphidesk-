import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useUnauthorizedStore } from "@/stores/unauthorizedStore";
import { cn, getFirstName } from "@/lib/utils";
import {
  useSujetsActifs,
  useSujetsArchives,
  useReunionSettings,
  useCreateSujet,
  useUpdateSujet,
  useMarkSujetTraite,
  useRestoreSujet,
  useDeleteSujet,
  useUpdateReunionSettings,
} from "@/hooks/useReunions";
import {
  useReunionNotification,
  sendTestNotification,
} from "@/hooks/useReunionNotification";
import type {
  ReunionSujet,
  ReunionSujetWithAuthor,
  ReunionPriorite,
} from "@/types/database";
import {
  UsersRound,
  Plus,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  Archive,
  AlertTriangle,
  AlertCircle,
  Minus,
  ChevronUp,
  Settings,
  Bell,
  X,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

// Jours de la semaine pour le select
const JOURS_SEMAINE = [
  { value: "lundi", label: "Lundi" },
  { value: "mardi", label: "Mardi" },
  { value: "mercredi", label: "Mercredi" },
  { value: "jeudi", label: "Jeudi" },
  { value: "vendredi", label: "Vendredi" },
];

// Priorités avec leurs styles (thème clair)
const PRIORITES: {
  value: ReunionPriorite;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Minus;
}[] = [
  {
    value: "basse",
    label: "Basse",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
    icon: Minus,
  },
  {
    value: "normale",
    label: "Normale",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
    icon: Minus,
  },
  {
    value: "haute",
    label: "Haute",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
    icon: ChevronUp,
  },
  {
    value: "urgente",
    label: "Urgente",
    color: "text-red-600",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
    icon: AlertTriangle,
  },
];

function getPrioriteConfig(priorite: ReunionPriorite) {
  return PRIORITES.find((p) => p.value === priorite) || PRIORITES[1];
}

// Fonction pour trier par priorité (urgente > haute > normale > basse)
function getPrioriteOrder(priorite: ReunionPriorite): number {
  const order: Record<ReunionPriorite, number> = {
    urgente: 0,
    haute: 1,
    normale: 2,
    basse: 3,
  };
  return order[priorite];
}

// Modal pour ajouter/éditer un sujet
function SujetModal({
  sujet,
  onClose,
  onSave,
  isLoading,
}: {
  sujet?: ReunionSujet;
  onClose: () => void;
  onSave: (data: { titre: string; description: string; priorite: ReunionPriorite }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    titre: sujet?.titre || "",
    description: sujet?.description || "",
    priorite: (sujet?.priorite || "normale") as ReunionPriorite,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titre.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {sujet ? "Modifier le sujet" : "Nouveau sujet"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.titre}
              onChange={(e) =>
                setFormData({ ...formData, titre: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Sujet à aborder..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Détails supplémentaires..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priorité</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITES.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, priorite: p.value })
                    }
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors",
                      formData.priorite === p.value
                        ? `${p.bgColor} ${p.borderColor} ${p.color}`
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.titre.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isLoading ? "..." : sujet ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal pour les paramètres admin
function SettingsModal({
  currentSettings,
  onClose,
  onSave,
  onTestNotif,
  isLoading,
}: {
  currentSettings: { jour: string; heure: string; message: string };
  onClose: () => void;
  onSave: (data: { jour: string; heure: string; message: string }) => void;
  onTestNotif: (message: string) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    jour: currentSettings.jour,
    heure: currentSettings.heure,
    message: currentSettings.message,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            Paramètres de réunion
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jour de la réunion
            </label>
            <select
              value={formData.jour}
              onChange={(e) =>
                setFormData({ ...formData, jour: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {JOURS_SEMAINE.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heure de la réunion
            </label>
            <input
              type="time"
              value={formData.heure}
              onChange={(e) =>
                setFormData({ ...formData, heure: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message de notification
            </label>
            <textarea
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={2}
              placeholder="La réunion hebdomadaire commence maintenant !"
            />
          </div>

          <div className="pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => onTestNotif(formData.message)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors"
            >
              <Bell className="h-4 w-4" />
              Tester la notification
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isLoading ? "..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Carte d'un sujet
function SujetCard({
  sujet,
  onEdit,
  onMarkTraite,
  onRestore,
  onDelete,
  isAdmin,
  isArchive,
}: {
  sujet: ReunionSujetWithAuthor;
  onEdit: () => void;
  onMarkTraite: () => void;
  onRestore: () => void;
  onDelete: () => void;
  isAdmin: boolean;
  isArchive: boolean;
}) {
  const prioriteConfig = getPrioriteConfig(sujet.priorite);
  const PrioriteIcon = prioriteConfig.icon;

  return (
    <div
      className={cn(
        "bg-white rounded-xl p-4 border-l-4 shadow-sm transition-colors",
        isArchive ? "border-gray-300 opacity-75" : prioriteConfig.borderColor
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PrioriteIcon className={cn("h-4 w-4 flex-shrink-0", prioriteConfig.color)} />
            <h3 className="font-medium text-gray-900">{sujet.titre}</h3>
          </div>
          {sujet.description && (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
              {sujet.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <span className={cn("px-2 py-1 rounded-full font-medium", prioriteConfig.bgColor, prioriteConfig.color)}>
              {prioriteConfig.label}
            </span>
            {sujet.author && (
              <span className="text-gray-500">Par {getFirstName(sujet.author.full_name)}</span>
            )}
            <span className="text-gray-400">
              {format(new Date(sujet.created_at), "d MMM yyyy", { locale: fr })}
            </span>
            {isArchive && sujet.date_traite && (
              <span className="flex items-center gap-1 text-green-600">
                <Check className="h-3 w-3" />
                Traité le {format(new Date(sujet.date_traite), "d MMM yyyy", { locale: fr })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isArchive && (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Modifier"
              >
                <Pencil className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={onMarkTraite}
                className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                title="Marquer comme traité"
              >
                <Check className="h-4 w-4 text-green-600" />
              </button>
            </>
          )}
          {isArchive && (
            <button
              onClick={onRestore}
              className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
              title="Restaurer"
            >
              <RotateCcw className="h-4 w-4 text-blue-600" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Reunions() {
  const profile = useAuthStore((state) => state.profile);
  const { isAdmin } = useEffectiveRole();
  const showUnauthorized = useUnauthorizedStore((state) => state.show);

  // State
  const [showSujetModal, setShowSujetModal] = useState(false);
  const [editingSujet, setEditingSujet] = useState<ReunionSujet | undefined>();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Queries
  const { data: sujetsActifs, isLoading: loadingActifs } = useSujetsActifs();
  const { data: sujetsArchives, isLoading: loadingArchives } = useSujetsArchives();
  const { data: settings } = useReunionSettings();

  // Hook pour les notifications automatiques
  useReunionNotification();

  // Mutations
  const createSujet = useCreateSujet();
  const updateSujet = useUpdateSujet();
  const markTraite = useMarkSujetTraite();
  const restoreSujet = useRestoreSujet();
  const deleteSujet = useDeleteSujet();
  const updateSettings = useUpdateReunionSettings();

  // Trier les sujets par priorité
  const sortedSujetsActifs = sujetsActifs
    ? [...sujetsActifs].sort(
        (a, b) => getPrioriteOrder(a.priorite) - getPrioriteOrder(b.priorite)
      )
    : [];

  // Handlers
  const handleSaveSujet = (data: {
    titre: string;
    description: string;
    priorite: ReunionPriorite;
  }) => {
    if (editingSujet) {
      updateSujet.mutate(
        { id: editingSujet.id, data },
        {
          onSuccess: () => {
            setShowSujetModal(false);
            setEditingSujet(undefined);
          },
        }
      );
    } else {
      createSujet.mutate(data, {
        onSuccess: () => {
          setShowSujetModal(false);
        },
      });
    }
  };

  const handleEdit = (sujet: ReunionSujet) => {
    setEditingSujet(sujet);
    setShowSujetModal(true);
  };

  const handleDelete = (id: string) => {
    deleteSujet.mutate(id, {
      onSuccess: () => setDeleteConfirm(null),
    });
  };

  const handleSaveSettings = (data: { jour: string; heure: string; message: string }) => {
    updateSettings.mutate(data, {
      onSuccess: () => setShowSettingsModal(false),
    });
  };

  const handleTestNotif = async (message: string) => {
    const success = await sendTestNotification(message || "La réunion hebdomadaire commence maintenant !");
    if (success) {
      toast.success("Notification envoyée !");
    } else {
      toast.error("Impossible d'envoyer la notification");
    }
  };

  // Calcul du jour de la semaine pour l'affichage
  const jourLabel =
    JOURS_SEMAINE.find((j) => j.value === settings?.jour)?.label || "Mardi";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <UsersRound className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Réunions</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {jourLabel} à {settings?.heure || "10:30"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Paramètres</span>
            </button>
          )}
          <button
            onClick={() => {
              setEditingSujet(undefined);
              setShowSujetModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau sujet</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{sortedSujetsActifs.length}</div>
          <div className="text-sm text-gray-500">Sujets à traiter</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-red-600">
            {sortedSujetsActifs.filter((s) => s.priorite === "urgente").length}
          </div>
          <div className="text-sm text-gray-500">Urgents</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {sortedSujetsActifs.filter((s) => s.priorite === "haute").length}
          </div>
          <div className="text-sm text-gray-500">Priorité haute</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-2xl font-bold text-gray-500">
            {sujetsArchives?.length || 0}
          </div>
          <div className="text-sm text-gray-500">Archivés</div>
        </div>
      </div>

      {/* Liste des sujets actifs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          Sujets à aborder
        </h2>
        {loadingActifs ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : sortedSujetsActifs.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <UsersRound className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Aucun sujet à aborder pour le moment</p>
            <p className="text-sm text-gray-400 mt-1">
              Cliquez sur "Nouveau sujet" pour en ajouter un
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSujetsActifs.map((sujet) => (
              <SujetCard
                key={sujet.id}
                sujet={sujet}
                onEdit={() => {
                  // Un graphiste ne peut modifier que ses propres sujets
                  if (!isAdmin && sujet.created_by !== profile?.id) {
                    showUnauthorized();
                    return;
                  }
                  handleEdit(sujet);
                }}
                onMarkTraite={() => {
                  if (!isAdmin) {
                    showUnauthorized();
                    return;
                  }
                  markTraite.mutate(sujet.id);
                }}
                onRestore={() => {}}
                onDelete={() => setDeleteConfirm(sujet.id)}
                isAdmin={isAdmin}
                isArchive={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section Archives */}
      <div>
        <button
          onClick={() => setShowArchives(!showArchives)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3 hover:text-gray-700 transition-colors"
        >
          <Archive className="h-5 w-5 text-gray-500" />
          Archives ({sujetsArchives?.length || 0})
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              showArchives ? "rotate-180" : ""
            )}
          />
        </button>

        {showArchives && (
          <>
            {loadingArchives ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : !sujetsArchives || sujetsArchives.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed p-6 text-center">
                <Archive className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">Aucun sujet archivé</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sujetsArchives.map((sujet) => (
                  <SujetCard
                    key={sujet.id}
                    sujet={sujet}
                    onEdit={() => {}}
                    onMarkTraite={() => {}}
                    onRestore={() => {
                      if (!isAdmin) {
                        showUnauthorized();
                        return;
                      }
                      restoreSujet.mutate(sujet.id);
                    }}
                    onDelete={() => setDeleteConfirm(sujet.id)}
                    isAdmin={isAdmin}
                    isArchive={true}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Sujet */}
      {showSujetModal && (
        <SujetModal
          sujet={editingSujet}
          onClose={() => {
            setShowSujetModal(false);
            setEditingSujet(undefined);
          }}
          onSave={handleSaveSujet}
          isLoading={createSujet.isPending || updateSujet.isPending}
        />
      )}

      {/* Modal Settings */}
      {showSettingsModal && settings && (
        <SettingsModal
          currentSettings={settings}
          onClose={() => setShowSettingsModal(false)}
          onSave={handleSaveSettings}
          onTestNotif={handleTestNotif}
          isLoading={updateSettings.isPending}
        />
      )}

      {/* Confirmation de suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmer la suppression</h3>
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir supprimer ce sujet ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteSujet.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {deleteSujet.isPending ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
