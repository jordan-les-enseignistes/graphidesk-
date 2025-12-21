import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

interface ProcessFavorite {
  id: string;
  user_id: string;
  process_id: string;
  created_at: string;
}

// Hook pour récupérer les favoris de l'utilisateur connecté
export function useProcessFavorites() {
  const profile = useAuthStore((state) => state.profile);

  return useQuery({
    queryKey: ["process-favorites", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("process_favorites")
        .select("*")
        .eq("user_id", profile.id);

      if (error) throw error;
      return data as ProcessFavorite[];
    },
    enabled: !!profile?.id,
  });
}

// Hook pour ajouter un favori
export function useAddProcessFavorite() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (processId: string) => {
      if (!profile?.id) throw new Error("Non authentifié");

      const { data, error } = await supabase
        .from("process_favorites")
        .insert({
          user_id: profile.id,
          process_id: processId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-favorites"] });
      toast.success("Process ajouté aux favoris");
    },
    onError: (error) => {
      console.error("Erreur ajout favori:", error);
      toast.error("Erreur lors de l'ajout aux favoris");
    },
  });
}

// Hook pour retirer un favori
export function useRemoveProcessFavorite() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (processId: string) => {
      if (!profile?.id) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("process_favorites")
        .delete()
        .eq("user_id", profile.id)
        .eq("process_id", processId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-favorites"] });
      toast.success("Process retiré des favoris");
    },
    onError: (error) => {
      console.error("Erreur retrait favori:", error);
      toast.error("Erreur lors du retrait des favoris");
    },
  });
}

// Hook pour toggle un favori (ajouter ou retirer)
export function useToggleProcessFavorite() {
  const addFavorite = useAddProcessFavorite();
  const removeFavorite = useRemoveProcessFavorite();
  const { data: favorites } = useProcessFavorites();

  const isFavorite = (processId: string) => {
    return favorites?.some((f) => f.process_id === processId) ?? false;
  };

  const toggle = (processId: string) => {
    if (isFavorite(processId)) {
      removeFavorite.mutate(processId);
    } else {
      addFavorite.mutate(processId);
    }
  };

  return {
    favorites,
    isFavorite,
    toggle,
    isLoading: addFavorite.isPending || removeFavorite.isPending,
  };
}
