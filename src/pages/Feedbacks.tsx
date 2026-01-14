import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MessageSquarePlus,
  Bug,
  Sparkles,
  Lightbulb,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Trash2,
  MessageSquare,
  Filter,
  X,
} from "lucide-react";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import {
  useFeedbacks,
  useCreateFeedback,
  useUpdateFeedbackStatut,
  useDeleteFeedback,
  FEEDBACK_TYPES,
  FEEDBACK_PRIORITES,
  FEEDBACK_STATUTS,
} from "@/hooks/useFeedbacks";
import type {
  FeedbackWithAuthor,
  FeedbackType,
  FeedbackPriorite,
  FeedbackStatut,
} from "@/types/database";
import { toast } from "sonner";
import { getFirstName } from "@/lib/utils";

// Icônes par type
const TYPE_ICONS: Record<FeedbackType, React.ElementType> = {
  bug: Bug,
  amelioration: Sparkles,
  nouvelle_fonctionnalite: Lightbulb,
};

// Icônes par statut
const STATUT_ICONS: Record<FeedbackStatut, React.ElementType> = {
  en_attente: Clock,
  accepte: CheckCircle2,
  refuse: XCircle,
  en_cours: Loader2,
  termine: CheckCircle2,
};

// Modal de création de feedback
function CreateFeedbackModal({
  onClose,
  onCreate,
  isLoading,
}: {
  onClose: () => void;
  onCreate: (data: {
    titre: string;
    description: string;
    type: FeedbackType;
    priorite: FeedbackPriorite;
  }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    type: "amelioration" as FeedbackType,
    priorite: "normale" as FeedbackPriorite,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titre.trim() || !formData.description.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              Nouveau feedback
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Type de feedback
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FEEDBACK_TYPES.map((type) => {
                const Icon = TYPE_ICONS[type.value];
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, type: type.value })
                    }
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                      formData.type === type.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 text-gray-700 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Titre
            </label>
            <input
              type="text"
              value={formData.titre}
              onChange={(e) =>
                setFormData({ ...formData, titre: e.target.value })
              }
              placeholder="Résumé court du feedback..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Décrivez en détail votre demande ou le bug rencontré..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
            />
          </div>

          {/* Priorité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Priorité
            </label>
            <div className="flex gap-2">
              {FEEDBACK_PRIORITES.map((priorite) => (
                <button
                  key={priorite.value}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, priorite: priorite.value })
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    formData.priorite === priorite.value
                      ? priorite.color + " ring-2 ring-offset-1 ring-gray-400 dark:ring-slate-500"
                      : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {priorite.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Envoyer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de détail/admin d'un feedback
function FeedbackDetailModal({
  feedback,
  onClose,
  isAdmin,
  onUpdateStatut,
  onDelete,
  isUpdating,
}: {
  feedback: FeedbackWithAuthor;
  onClose: () => void;
  isAdmin: boolean;
  onUpdateStatut: (statut: FeedbackStatut, comment?: string) => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  const [adminComment, setAdminComment] = useState(
    feedback.admin_comment || ""
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const TypeIcon = TYPE_ICONS[feedback.type];
  const typeInfo = FEEDBACK_TYPES.find((t) => t.value === feedback.type);
  const prioriteInfo = FEEDBACK_PRIORITES.find(
    (p) => p.value === feedback.priorite
  );
  const statutInfo = FEEDBACK_STATUTS.find((s) => s.value === feedback.statut);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${typeInfo?.color}`}>
                <TypeIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {feedback.titre}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${typeInfo?.color}`}>
                    {typeInfo?.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${prioriteInfo?.color}`}>
                    {prioriteInfo?.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${statutInfo?.color}`}>
                    {statutInfo?.label}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Auteur et date */}
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
            <span>
              Par{" "}
              <span className="font-medium text-gray-700 dark:text-slate-300">
                {getFirstName(feedback.author?.full_name) || "Inconnu"}
              </span>
            </span>
            <span>•</span>
            <span>
              {format(new Date(feedback.created_at), "d MMMM yyyy 'à' HH:mm", {
                locale: fr,
              })}
            </span>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Description
            </h3>
            <p className="text-gray-600 dark:text-slate-300 whitespace-pre-wrap bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
              {feedback.description}
            </p>
          </div>

          {/* Commentaire admin existant */}
          {feedback.admin_comment && !isAdmin && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Réponse de l'équipe
              </h3>
              <p className="text-gray-600 dark:text-slate-300 whitespace-pre-wrap bg-blue-50 dark:bg-blue-500/30 rounded-lg p-4 border border-blue-100 dark:border-blue-500/50">
                {feedback.admin_comment}
              </p>
            </div>
          )}

          {/* Section Admin */}
          {isAdmin && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-6 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-slate-100">Actions admin</h3>

              {/* Commentaire admin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Commentaire / Réponse
                </label>
                <textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Ajouter un commentaire pour l'utilisateur..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Boutons de statut */}
              <div className="flex flex-wrap gap-2">
                {feedback.statut !== "accepte" && (
                  <button
                    onClick={() => onUpdateStatut("accepte", adminComment)}
                    disabled={isUpdating}
                    className="px-3 py-2 bg-green-100 dark:bg-green-500/30 text-green-800 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-500/40 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Accepter
                  </button>
                )}
                {feedback.statut !== "refuse" && (
                  <button
                    onClick={() => onUpdateStatut("refuse", adminComment)}
                    disabled={isUpdating}
                    className="px-3 py-2 bg-red-100 dark:bg-red-500/30 text-red-800 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/40 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Refuser
                  </button>
                )}
                {feedback.statut !== "en_cours" && (
                  <button
                    onClick={() => onUpdateStatut("en_cours", adminComment)}
                    disabled={isUpdating}
                    className="px-3 py-2 bg-blue-100 dark:bg-blue-500/30 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/40 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <Loader2 className="w-4 h-4" />
                    En cours
                  </button>
                )}
                {feedback.statut !== "termine" && (
                  <button
                    onClick={() => onUpdateStatut("termine", adminComment)}
                    disabled={isUpdating}
                    className="px-3 py-2 bg-emerald-100 dark:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/40 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Terminé
                  </button>
                )}
              </div>

              {/* Supprimer */}
              <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer ce feedback
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-slate-400">Confirmer ?</span>
                    <button
                      onClick={onDelete}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Oui, supprimer
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 rounded text-sm hover:bg-gray-300 dark:hover:bg-slate-500"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// Carte de feedback
function FeedbackCard({
  feedback,
  onClick,
}: {
  feedback: FeedbackWithAuthor;
  onClick: () => void;
}) {
  const TypeIcon = TYPE_ICONS[feedback.type];
  const StatutIcon = STATUT_ICONS[feedback.statut];
  const typeInfo = FEEDBACK_TYPES.find((t) => t.value === feedback.type);
  const prioriteInfo = FEEDBACK_PRIORITES.find(
    (p) => p.value === feedback.priorite
  );
  const statutInfo = FEEDBACK_STATUTS.find((s) => s.value === feedback.statut);

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* Icône type */}
        <div className={`p-2 rounded-lg ${typeInfo?.color} flex-shrink-0`}>
          <TypeIcon className="w-5 h-5" />
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900 dark:text-slate-100 truncate">
              {feedback.titre}
            </h3>
            <div className={`px-2 py-0.5 rounded text-xs flex-shrink-0 flex items-center gap-1 ${statutInfo?.color}`}>
              <StatutIcon className="w-3 h-3" />
              {statutInfo?.label}
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
            {feedback.description}
          </p>

          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 dark:text-slate-500">
            <span className={`px-2 py-0.5 rounded ${prioriteInfo?.color}`}>
              {prioriteInfo?.label}
            </span>
            <span>•</span>
            <span>{getFirstName(feedback.author?.full_name) || "Anonyme"}</span>
            <span>•</span>
            <span>
              {format(new Date(feedback.created_at), "d MMM yyyy", {
                locale: fr,
              })}
            </span>
            {feedback.admin_comment && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-blue-500">
                  <MessageSquare className="w-3 h-3" />
                  Répondu
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Feedbacks() {
  const { isAdmin } = useEffectiveRole();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] =
    useState<FeedbackWithAuthor | null>(null);
  const [statutFilter, setStatutFilter] = useState<FeedbackStatut | "all">(
    "all"
  );
  const [showTermines, setShowTermines] = useState(false);
  const [showRefuses, setShowRefuses] = useState(false);

  const { data: feedbacks, isLoading } = useFeedbacks(statutFilter);
  const createFeedback = useCreateFeedback();
  const updateStatut = useUpdateFeedbackStatut();
  const deleteFeedback = useDeleteFeedback();

  const handleCreate = (data: {
    titre: string;
    description: string;
    type: FeedbackType;
    priorite: FeedbackPriorite;
  }) => {
    createFeedback.mutate(data, {
      onSuccess: () => setShowCreateModal(false),
    });
  };

  const handleUpdateStatut = (statut: FeedbackStatut, comment?: string) => {
    if (!selectedFeedback) return;
    updateStatut.mutate(
      { id: selectedFeedback.id, statut, admin_comment: comment },
      {
        onSuccess: () => setSelectedFeedback(null),
      }
    );
  };

  const handleDelete = () => {
    if (!selectedFeedback) return;
    deleteFeedback.mutate(selectedFeedback.id, {
      onSuccess: () => setSelectedFeedback(null),
    });
  };

  // Stats
  const stats = {
    total: feedbacks?.length || 0,
    en_attente: feedbacks?.filter((f) => f.statut === "en_attente").length || 0,
    en_cours: feedbacks?.filter((f) => f.statut === "en_cours").length || 0,
    termine: feedbacks?.filter((f) => f.statut === "termine").length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <MessageSquarePlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Feedbacks</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Suggestions, bugs et demandes d'amélioration
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <MessageSquarePlus className="w-5 h-5" />
              Nouveau feedback
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-4">
            <p className="text-sm text-yellow-600">En attente</p>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.en_attente}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-4">
            <p className="text-sm text-blue-600">En cours</p>
            <p className="text-2xl font-bold text-blue-600">{stats.en_cours}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-4">
            <p className="text-sm text-emerald-600">Terminés</p>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.termine}
            </p>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            <span className="text-sm text-gray-600 dark:text-slate-400">Filtrer par statut :</span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatutFilter("all")}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  statutFilter === "all"
                    ? "bg-gray-800 dark:bg-slate-600 text-white"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                }`}
              >
                Tous
              </button>
              {FEEDBACK_STATUTS.map((statut) => (
                <button
                  key={statut.value}
                  onClick={() => setStatutFilter(statut.value)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    statutFilter === statut.value
                      ? statut.color + " ring-2 ring-offset-1 ring-gray-300 dark:ring-slate-500"
                      : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {statut.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Liste des feedbacks */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : feedbacks && feedbacks.length > 0 ? (
          <>
            {/* Feedbacks non terminés et non refusés */}
            {(() => {
              const feedbacksActifs = feedbacks.filter((f) => f.statut !== "termine" && f.statut !== "refuse");
              const feedbacksTermines = feedbacks.filter((f) => f.statut === "termine");
              const feedbacksRefuses = feedbacks.filter((f) => f.statut === "refuse");

              return (
                <>
                  {feedbacksActifs.length > 0 ? (
                    <div className="space-y-3">
                      {feedbacksActifs.map((feedback) => (
                        <FeedbackCard
                          key={feedback.id}
                          feedback={feedback}
                          onClick={() => setSelectedFeedback(feedback)}
                        />
                      ))}
                    </div>
                  ) : statutFilter !== "termine" && (
                    <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 mb-6">
                      <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">Tous les feedbacks actifs ont été traités !</p>
                    </div>
                  )}

                  {/* Section feedbacks terminés - dépliable */}
                  {feedbacksTermines.length > 0 && statutFilter === "all" && (
                    <div className="mt-6">
                      <button
                        onClick={() => setShowTermines(!showTermines)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-500/30 border border-emerald-200 dark:border-emerald-500/50 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="font-medium text-emerald-800 dark:text-emerald-300">
                            Feedbacks terminés ({feedbacksTermines.length})
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-emerald-600 transition-transform ${
                            showTermines ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {showTermines && (
                        <div className="mt-3 space-y-3">
                          {feedbacksTermines.map((feedback) => (
                            <FeedbackCard
                              key={feedback.id}
                              feedback={feedback}
                              onClick={() => setSelectedFeedback(feedback)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Si filtre "termine" actif, afficher directement les terminés */}
                  {statutFilter === "termine" && feedbacksTermines.length > 0 && (
                    <div className="space-y-3">
                      {feedbacksTermines.map((feedback) => (
                        <FeedbackCard
                          key={feedback.id}
                          feedback={feedback}
                          onClick={() => setSelectedFeedback(feedback)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Section feedbacks refusés - dépliable */}
                  {feedbacksRefuses.length > 0 && statutFilter === "all" && (
                    <div className="mt-6">
                      <button
                        onClick={() => setShowRefuses(!showRefuses)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-500/30 border border-red-200 dark:border-red-500/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          <span className="font-medium text-red-800 dark:text-red-300">
                            Feedbacks refusés ({feedbacksRefuses.length})
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-red-600 transition-transform ${
                            showRefuses ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {showRefuses && (
                        <div className="mt-3 space-y-3">
                          {feedbacksRefuses.map((feedback) => (
                            <FeedbackCard
                              key={feedback.id}
                              feedback={feedback}
                              onClick={() => setSelectedFeedback(feedback)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Si filtre "refuse" actif, afficher directement les refusés */}
                  {statutFilter === "refuse" && feedbacksRefuses.length > 0 && (
                    <div className="space-y-3">
                      {feedbacksRefuses.map((feedback) => (
                        <FeedbackCard
                          key={feedback.id}
                          feedback={feedback}
                          onClick={() => setSelectedFeedback(feedback)}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
            <MessageSquarePlus className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-slate-400">Aucun feedback pour le moment</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Créer le premier feedback
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateFeedbackModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          isLoading={createFeedback.isPending}
        />
      )}

      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          isAdmin={isAdmin}
          onUpdateStatut={handleUpdateStatut}
          onDelete={handleDelete}
          isUpdating={updateStatut.isPending}
        />
      )}
    </div>
  );
}
