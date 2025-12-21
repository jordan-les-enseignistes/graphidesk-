import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Type pour un statut
export interface Statut {
  id: string;
  value: string;
  label: string;
  color: string;
  row_bg: string;
  bar_color: string;
  icon: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export type StatutInsert = Omit<Statut, "id" | "created_at" | "updated_at">;
export type StatutUpdate = Partial<StatutInsert>;

// Clés de requête
export const statutsKeys = {
  all: ["statuts"] as const,
  list: () => [...statutsKeys.all, "list"] as const,
};

// Hook pour récupérer tous les statuts
export function useStatuts() {
  return useQuery({
    queryKey: statutsKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("statuts")
        .select("*")
        .order("priority", { ascending: true });

      if (error) throw error;
      return data as Statut[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - les statuts changent rarement
  });
}

// Hook pour créer un statut
export function useCreateStatut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: StatutInsert) => {
      const { data: result, error } = await supabase
        .from("statuts")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as Statut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statutsKeys.all });
      toast.success("Statut créé avec succès");
    },
    onError: (error) => {
      console.error("Erreur création statut:", error);
      toast.error("Erreur lors de la création du statut");
    },
  });
}

// Hook pour mettre à jour un statut
export function useUpdateStatut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
      oldValue,
    }: {
      id: string;
      data: StatutUpdate;
      oldValue?: string;
    }) => {
      // Si on renomme le statut (value change), mettre à jour les dossiers d'abord
      if (data.value && oldValue && data.value !== oldValue) {
        const { data: count, error: rpcError } = await supabase.rpc(
          "rename_statut_in_dossiers",
          { old_value: oldValue, new_value: data.value }
        );

        if (rpcError) throw rpcError;
      }

      // Mettre à jour le statut
      const { data: result, error } = await supabase
        .from("statuts")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as Statut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statutsKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("Statut mis à jour");
    },
    onError: (error) => {
      console.error("Erreur mise à jour statut:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

// Hook pour supprimer un statut (avec remplacement)
export function useDeleteStatut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      valueToDelete,
      replacementValue,
    }: {
      id: string;
      valueToDelete: string;
      replacementValue: string;
    }) => {
      // D'abord remplacer tous les dossiers avec ce statut
      const { data: count, error: rpcError } = await supabase.rpc(
        "replace_statut_in_dossiers",
        { old_value: valueToDelete, replacement_value: replacementValue }
      );

      if (rpcError) throw rpcError;

      // Ensuite supprimer le statut
      const { error } = await supabase.from("statuts").delete().eq("id", id);

      if (error) throw error;
      return { deletedCount: 1, replacedCount: count };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: statutsKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success(
        `Statut supprimé. ${data.replacedCount} dossier(s) mis à jour.`
      );
    },
    onError: (error) => {
      console.error("Erreur suppression statut:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Hook pour réordonner les statuts
export function useReorderStatuts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (statuts: { id: string; priority: number }[]) => {
      // Mettre à jour les priorités en batch
      const updates = statuts.map(({ id, priority }) =>
        supabase
          .from("statuts")
          .update({ priority, updated_at: new Date().toISOString() })
          .eq("id", id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statutsKeys.all });
      toast.success("Ordre des statuts mis à jour");
    },
    onError: (error) => {
      console.error("Erreur réordonnancement:", error);
      toast.error("Erreur lors du réordonnancement");
    },
  });
}

// Couleurs disponibles pour les statuts
export const AVAILABLE_COLORS = [
  { name: "Rouge", color: "bg-red-100 text-red-800 border-red-200", rowBg: "bg-red-50", barColor: "bg-red-500" },
  { name: "Orange", color: "bg-orange-100 text-orange-800 border-orange-200", rowBg: "bg-orange-50", barColor: "bg-orange-500" },
  { name: "Jaune", color: "bg-yellow-100 text-yellow-800 border-yellow-200", rowBg: "bg-yellow-50", barColor: "bg-yellow-500" },
  { name: "Vert", color: "bg-green-100 text-green-800 border-green-200", rowBg: "bg-green-50", barColor: "bg-green-500" },
  { name: "Bleu", color: "bg-blue-100 text-blue-800 border-blue-200", rowBg: "bg-blue-50", barColor: "bg-blue-500" },
  { name: "Indigo", color: "bg-indigo-100 text-indigo-800 border-indigo-200", rowBg: "bg-indigo-50", barColor: "bg-indigo-500" },
  { name: "Violet", color: "bg-purple-100 text-purple-800 border-purple-200", rowBg: "bg-purple-50", barColor: "bg-purple-500" },
  { name: "Rose", color: "bg-pink-100 text-pink-800 border-pink-200", rowBg: "bg-pink-50", barColor: "bg-pink-500" },
  { name: "Cyan", color: "bg-cyan-100 text-cyan-800 border-cyan-200", rowBg: "bg-cyan-50", barColor: "bg-cyan-500" },
  { name: "Gris", color: "bg-gray-100 text-gray-800 border-gray-200", rowBg: "", barColor: "bg-gray-400" },
] as const;

// Icônes disponibles
export const AVAILABLE_ICONS = [
  "Circle",
  "Clock",
  "Pause",
  "PauseCircle",
  "AlertCircle",
  "AlertTriangle",
  "Building",
  "CheckCircle",
  "XCircle",
  "Timer",
  "Hourglass",
  "Flag",
  "Star",
  "Zap",
] as const;
