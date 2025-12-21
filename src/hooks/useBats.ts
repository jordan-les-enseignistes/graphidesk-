import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import type { DossierBat } from "@/types";

// Clés de requête
export const batKeys = {
  all: ["bats"] as const,
  byDossier: (dossierId: string) => [...batKeys.all, "dossier", dossierId] as const,
};

// Hook pour récupérer les BATs d'un dossier
export function useDossierBats(dossierId: string) {
  return useQuery({
    queryKey: batKeys.byDossier(dossierId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_bats")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("date_envoi", { ascending: false });

      if (error) throw error;
      return data as DossierBat[];
    },
    enabled: !!dossierId,
  });
}

// Hook pour ajouter un BAT
export function useAddBat() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async ({ dossierId, dateEnvoi }: { dossierId: string; dateEnvoi?: string }) => {
      const { data, error } = await supabase
        .from("dossier_bats")
        .insert({
          dossier_id: dossierId,
          date_envoi: dateEnvoi || new Date().toISOString(),
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalider les queries liées
      queryClient.invalidateQueries({ queryKey: batKeys.byDossier(variables.dossierId) });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("BAT ajouté");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout du BAT");
    },
  });
}

// Hook pour supprimer un BAT (admin uniquement)
export function useDeleteBat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batId, dossierId }: { batId: string; dossierId: string }) => {
      const { error } = await supabase
        .from("dossier_bats")
        .delete()
        .eq("id", batId);

      if (error) throw error;
      return dossierId;
    },
    onSuccess: (dossierId) => {
      queryClient.invalidateQueries({ queryKey: batKeys.byDossier(dossierId) });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("BAT supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression du BAT");
    },
  });
}
