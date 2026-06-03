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
// Logique :
// 1. Tous les profils dont le rôle a is_graphiste = true (via JOIN sur roles)
// 2. Tous les profils legacy sans role_id mais avec role = 'graphiste'
// 3. ★ HARDCODE : tous les admins (role = 'admin') sont TOUJOURS considérés comme
//    graphistes, peu importe le flag is_graphiste de leur rôle. L'admin doit pouvoir
//    apparaître dans les listes/stats de graphistes par défaut.
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

      // 3) ★ HARDCODE : tous les admins, toujours, peu importe is_graphiste
      const { data: admins, error: errorAdmins } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .eq("role", "admin")
        .order("full_name");

      if (errorAdmins) throw errorAdmins;

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
      for (const p of admins ?? []) {
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
