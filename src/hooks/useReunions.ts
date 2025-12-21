import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type {
  ReunionSujet,
  ReunionSujetInsert,
  ReunionSujetUpdate,
  ReunionSujetWithAuthor,
} from "@/types/database";
import { toast } from "sonner";

// Clés de requête
export const reunionKeys = {
  all: ["reunions"] as const,
  sujets: () => [...reunionKeys.all, "sujets"] as const,
  sujetsActifs: () => [...reunionKeys.sujets(), "actifs"] as const,
  sujetsArchives: () => [...reunionKeys.sujets(), "archives"] as const,
  settings: () => [...reunionKeys.all, "settings"] as const,
};

// Hook pour récupérer les sujets actifs (non traités)
export function useSujetsActifs() {
  return useQuery({
    queryKey: reunionKeys.sujetsActifs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reunions_sujets")
        .select(
          `
          *,
          author:profiles!reunions_sujets_created_by_fkey(id, full_name, initials)
        `
        )
        .eq("is_traite", false)
        .order("priorite", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ReunionSujetWithAuthor[];
    },
  });
}

// Hook pour récupérer les sujets archivés (traités)
export function useSujetsArchives() {
  return useQuery({
    queryKey: reunionKeys.sujetsArchives(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reunions_sujets")
        .select(
          `
          *,
          author:profiles!reunions_sujets_created_by_fkey(id, full_name, initials)
        `
        )
        .eq("is_traite", true)
        .order("date_traite", { ascending: false });

      if (error) throw error;
      return data as ReunionSujetWithAuthor[];
    },
  });
}

// Hook pour récupérer les paramètres de réunion
export function useReunionSettings() {
  return useQuery({
    queryKey: reunionKeys.settings(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["reunion_jour", "reunion_heure", "reunion_message"]);

      if (error) throw error;

      const settings: { jour: string; heure: string; message: string } = {
        jour: "mardi",
        heure: "10:30",
        message: "La réunion hebdomadaire commence maintenant !",
      };

      data?.forEach((item) => {
        if (item.key === "reunion_jour") {
          settings.jour = item.value as string;
        } else if (item.key === "reunion_heure") {
          settings.heure = item.value as string;
        } else if (item.key === "reunion_message") {
          settings.message = item.value as string;
        }
      });

      return settings;
    },
  });
}

// Hook pour créer un sujet
export function useCreateSujet() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (
      data: Omit<ReunionSujetInsert, "created_by">
    ): Promise<ReunionSujet> => {
      const { data: result, error } = await supabase
        .from("reunions_sujets")
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
      queryClient.invalidateQueries({ queryKey: reunionKeys.sujets() });
      toast.success("Sujet ajouté avec succès");
    },
    onError: (error) => {
      console.error("Erreur création sujet:", error);
      toast.error("Erreur lors de l'ajout du sujet");
    },
  });
}

// Hook pour mettre à jour un sujet
export function useUpdateSujet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ReunionSujetUpdate;
    }): Promise<ReunionSujet> => {
      const { data: result, error } = await supabase
        .from("reunions_sujets")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reunionKeys.sujets() });
      toast.success("Sujet mis à jour");
    },
    onError: (error) => {
      console.error("Erreur mise à jour sujet:", error);
      toast.error("Erreur lors de la mise à jour du sujet");
    },
  });
}

// Hook pour marquer un sujet comme traité
export function useMarkSujetTraite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<ReunionSujet> => {
      const { data: result, error } = await supabase
        .from("reunions_sujets")
        .update({
          is_traite: true,
          date_traite: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reunionKeys.sujets() });
      toast.success("Sujet marqué comme traité");
    },
    onError: (error) => {
      console.error("Erreur marquage sujet:", error);
      toast.error("Erreur lors du marquage du sujet");
    },
  });
}

// Hook pour restaurer un sujet archivé
export function useRestoreSujet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<ReunionSujet> => {
      const { data: result, error } = await supabase
        .from("reunions_sujets")
        .update({
          is_traite: false,
          date_traite: null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reunionKeys.sujets() });
      toast.success("Sujet restauré");
    },
    onError: (error) => {
      console.error("Erreur restauration sujet:", error);
      toast.error("Erreur lors de la restauration du sujet");
    },
  });
}

// Hook pour supprimer un sujet (admin uniquement)
export function useDeleteSujet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("reunions_sujets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reunionKeys.sujets() });
      toast.success("Sujet supprimé");
    },
    onError: (error) => {
      console.error("Erreur suppression sujet:", error);
      toast.error("Erreur lors de la suppression du sujet");
    },
  });
}

// Hook pour mettre à jour les paramètres de réunion (admin)
export function useUpdateReunionSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jour,
      heure,
      message,
    }: {
      jour: string;
      heure: string;
      message: string;
    }): Promise<void> => {
      // Mettre à jour le jour
      const { error: error1 } = await supabase
        .from("app_settings")
        .update({ value: jour })
        .eq("key", "reunion_jour");

      if (error1) throw error1;

      // Mettre à jour l'heure
      const { error: error2 } = await supabase
        .from("app_settings")
        .update({ value: heure })
        .eq("key", "reunion_heure");

      if (error2) throw error2;

      // Mettre à jour ou insérer le message
      const { data: existingMessage } = await supabase
        .from("app_settings")
        .select("key")
        .eq("key", "reunion_message")
        .single();

      if (existingMessage) {
        const { error: error3 } = await supabase
          .from("app_settings")
          .update({ value: message })
          .eq("key", "reunion_message");
        if (error3) throw error3;
      } else {
        const { error: error3 } = await supabase
          .from("app_settings")
          .insert({ key: "reunion_message", value: message });
        if (error3) throw error3;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reunionKeys.settings() });
      toast.success("Paramètres de réunion mis à jour");
    },
    onError: (error) => {
      console.error("Erreur mise à jour paramètres:", error);
      toast.error("Erreur lors de la mise à jour des paramètres");
    },
  });
}
