import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type {
  Feedback,
  FeedbackInsert,
  FeedbackUpdate,
  FeedbackWithAuthor,
  FeedbackStatut,
} from "@/types/database";
import { toast } from "sonner";

// Clés de requête
export const feedbackKeys = {
  all: ["feedbacks"] as const,
  list: () => [...feedbackKeys.all, "list"] as const,
  byStatut: (statut: FeedbackStatut | "all") =>
    [...feedbackKeys.list(), statut] as const,
  detail: (id: string) => [...feedbackKeys.all, "detail", id] as const,
  pendingCount: () => [...feedbackKeys.all, "pendingCount"] as const,
};

// Ordre de priorité des statuts (plus bas = affiché en bas)
const STATUT_ORDER: Record<FeedbackStatut, number> = {
  en_attente: 0,
  accepte: 1,
  en_cours: 2,
  termine: 10,
  refuse: 11,
};

// Hook pour récupérer tous les feedbacks
export function useFeedbacks(statutFilter?: FeedbackStatut | "all") {
  return useQuery({
    queryKey: feedbackKeys.byStatut(statutFilter || "all"),
    queryFn: async () => {
      let query = supabase
        .from("feedbacks")
        .select(
          `
          *,
          author:profiles!feedbacks_created_by_fkey(id, full_name, initials)
        `
        )
        .order("created_at", { ascending: false });

      if (statutFilter && statutFilter !== "all") {
        query = query.eq("statut", statutFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Trier : terminés et refusés en bas, puis par date
      const sortedData = (data as FeedbackWithAuthor[]).sort((a, b) => {
        const orderA = STATUT_ORDER[a.statut];
        const orderB = STATUT_ORDER[b.statut];
        if (orderA !== orderB) return orderA - orderB;
        // Si même catégorie de statut, trier par date décroissante
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return sortedData;
    },
  });
}

// Hook pour compter les feedbacks en attente (pour le badge admin)
export function useFeedbacksPendingCount() {
  return useQuery({
    queryKey: feedbackKeys.pendingCount(),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("feedbacks")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");

      if (error) throw error;
      return count || 0;
    },
  });
}

// Hook pour récupérer un feedback par ID
export function useFeedback(id: string) {
  return useQuery({
    queryKey: feedbackKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedbacks")
        .select(
          `
          *,
          author:profiles!feedbacks_created_by_fkey(id, full_name, initials)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as FeedbackWithAuthor;
    },
    enabled: !!id,
  });
}

// Hook pour créer un feedback
export function useCreateFeedback() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (
      data: Omit<FeedbackInsert, "created_by">
    ): Promise<Feedback> => {
      const { data: result, error } = await supabase
        .from("feedbacks")
        .insert({
          ...data,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success("Feedback envoyé avec succès");
    },
    onError: (error) => {
      console.error("Erreur création feedback:", error);
      toast.error("Erreur lors de l'envoi du feedback");
    },
  });
}

// Hook pour mettre à jour un feedback (admin)
export function useUpdateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: FeedbackUpdate;
    }): Promise<Feedback> => {
      // Si on passe en "termine", ajouter la date de résolution
      const updateData: FeedbackUpdate = { ...data };
      if (data.statut === "termine" && !data.resolved_at) {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data: result, error } = await supabase
        .from("feedbacks")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success("Feedback mis à jour");
    },
    onError: (error) => {
      console.error("Erreur mise à jour feedback:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

// Hook pour changer le statut d'un feedback (admin)
export function useUpdateFeedbackStatut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      statut,
      admin_comment,
    }: {
      id: string;
      statut: FeedbackStatut;
      admin_comment?: string;
    }): Promise<Feedback> => {
      const updateData: FeedbackUpdate = { statut };

      if (admin_comment !== undefined) {
        updateData.admin_comment = admin_comment;
      }

      if (statut === "termine") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data: result, error } = await supabase
        .from("feedbacks")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
      const messages: Record<FeedbackStatut, string> = {
        en_attente: "Feedback remis en attente",
        accepte: "Feedback accepté",
        refuse: "Feedback refusé",
        en_cours: "Feedback en cours de traitement",
        termine: "Feedback marqué comme terminé",
      };
      toast.success(messages[variables.statut]);
    },
    onError: (error) => {
      console.error("Erreur changement statut:", error);
      toast.error("Erreur lors du changement de statut");
    },
  });
}

// Hook pour supprimer un feedback (admin)
export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("feedbacks").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success("Feedback supprimé");
    },
    onError: (error) => {
      console.error("Erreur suppression feedback:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Constantes pour les types et statuts
export const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug", color: "bg-red-100 text-red-800", icon: "Bug" },
  {
    value: "amelioration",
    label: "Amélioration",
    color: "bg-blue-100 text-blue-800",
    icon: "Sparkles",
  },
  {
    value: "nouvelle_fonctionnalite",
    label: "Nouvelle fonctionnalité",
    color: "bg-purple-100 text-purple-800",
    icon: "Lightbulb",
  },
] as const;

export const FEEDBACK_PRIORITES = [
  { value: "basse", label: "Basse", color: "bg-gray-100 text-gray-800" },
  { value: "normale", label: "Normale", color: "bg-blue-100 text-blue-800" },
  { value: "haute", label: "Haute", color: "bg-orange-100 text-orange-800" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-800" },
] as const;

export const FEEDBACK_STATUTS = [
  {
    value: "en_attente",
    label: "En attente",
    color: "bg-yellow-100 text-yellow-800",
  },
  { value: "accepte", label: "Accepté", color: "bg-green-100 text-green-800" },
  { value: "refuse", label: "Refusé", color: "bg-red-100 text-red-800" },
  { value: "en_cours", label: "En cours", color: "bg-blue-100 text-blue-800" },
  {
    value: "termine",
    label: "Terminé",
    color: "bg-emerald-100 text-emerald-800",
  },
] as const;
