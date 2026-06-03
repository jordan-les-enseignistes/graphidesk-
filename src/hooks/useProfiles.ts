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

// Hook pour récupérer uniquement les graphistes (= profils dont le rôle a is_graphiste = true)
//
// On utilise un INNER JOIN sur la table roles pour ne récupérer que les profils
// dont le rôle associé est un rôle de graphiste. Pour la rétro-compat avec les profils
// qui n'auraient pas encore de role_id (ne devrait pas arriver après la migration 027,
// mais on garde un fallback), on inclut aussi ceux dont role = 'graphiste' (champ legacy).
export function useGraphistes() {
  return useQuery({
    queryKey: profileKeys.graphistes(),
    queryFn: async () => {
      // 1) Profils avec role_id pointant vers un rôle is_graphiste = true
      const { data: withRole, error: errorWithRole } = await supabase
        .from("profiles")
        .select("*, role_data:roles!profiles_role_id_fkey!inner(is_graphiste)")
        .eq("is_active", true)
        .eq("role_data.is_graphiste", true)
        .order("full_name");

      if (errorWithRole) throw errorWithRole;

      // 2) Fallback : profils legacy sans role_id mais avec role='graphiste'
      const { data: legacy, error: errorLegacy } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .is("role_id", null)
        .eq("role", "graphiste")
        .order("full_name");

      if (errorLegacy) throw errorLegacy;

      // Fusionner sans doublon
      const allIds = new Set<string>();
      const result: Profile[] = [];
      for (const p of withRole ?? []) {
        if (!allIds.has(p.id)) {
          allIds.add(p.id);
          // Retirer la propriété role_data ajoutée par le JOIN pour garder un Profile pur
          const { role_data: _ignored, ...rest } = p as Profile & { role_data?: unknown };
          result.push(rest as Profile);
        }
      }
      for (const p of legacy ?? []) {
        if (!allIds.has(p.id)) {
          allIds.add(p.id);
          result.push(p as Profile);
        }
      }
      // Tri final par nom complet
      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
      return result;
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
