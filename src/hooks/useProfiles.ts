import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

export const profileKeys = {
  all: ["profiles"] as const,
  lists: () => [...profileKeys.all, "list"] as const,
  actives: () => [...profileKeys.lists(), "active"] as const,
  graphistes: () => [...profileKeys.lists(), "graphistes"] as const,
  detail: (id: string) => [...profileKeys.all, "detail", id] as const,
};

// Hook pour récupérer tous les profils actifs
export function useProfiles() {
  return useQuery({
    queryKey: profileKeys.actives(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data as Profile[];
    },
  });
}

// Hook pour récupérer uniquement les graphistes
export function useGraphistes() {
  return useQuery({
    queryKey: profileKeys.graphistes(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data as Profile[];
    },
  });
}

// Hook pour récupérer un profil par ID
export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!id,
  });
}
