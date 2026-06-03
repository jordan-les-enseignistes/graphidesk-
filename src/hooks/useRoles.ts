import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import type { Role, RolePermission, RoleInsert, RoleUpdate } from "@/types";

export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
  detail: (id: string) => [...roleKeys.all, "detail", id] as const,
  permissions: () => [...roleKeys.all, "permissions"] as const,
  permissionsByRole: (roleId: string) => [...roleKeys.permissions(), roleId] as const,
  currentUserPermissions: () => [...roleKeys.all, "current-user-permissions"] as const,
};

// =========================================================
// Lecture : tous les rôles
// =========================================================
export function useRoles() {
  return useQuery({
    queryKey: roleKeys.lists(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("label");

      if (error) throw error;
      return data as Role[];
    },
  });
}

// =========================================================
// Lecture : permissions d'un rôle donné
// =========================================================
export function useRolePermissions(roleId: string | null | undefined) {
  return useQuery({
    queryKey: roleId ? roleKeys.permissionsByRole(roleId) : roleKeys.permissions(),
    queryFn: async () => {
      if (!roleId) return [];
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("role_id", roleId);

      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!roleId,
  });
}

// =========================================================
// Lecture : permissions de l'utilisateur courant (avec son rôle)
// =========================================================
// Retourne la liste des permission_key de l'utilisateur connecté.
// Si pas de role_id (anciens comptes), fallback : si role='admin', toutes les perms; sinon vide.
export function useCurrentUserPermissions() {
  const profile = useAuthStore((state) => state.profile);

  return useQuery({
    queryKey: roleKeys.currentUserPermissions(),
    queryFn: async () => {
      if (!profile) return new Set<string>();

      // Fallback rétrocompatible : si pas de role_id, l'admin garde toutes ses perms via le code
      // (useHasPermission gère ça séparément)
      if (!profile.role_id) {
        return new Set<string>();
      }

      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", profile.role_id);

      if (error) {
        console.error("Erreur chargement permissions utilisateur:", error);
        return new Set<string>();
      }

      return new Set(data.map((row) => row.permission_key));
    },
    enabled: !!profile,
    staleTime: 60_000, // 1 min — les perms changent rarement, on peut cacher
  });
}

// =========================================================
// Création d'un rôle
// =========================================================
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: RoleInsert) => {
      const { data, error } = await supabase
        .from("roles")
        .insert(role)
        .select()
        .single();

      if (error) throw error;
      return data as Role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      toast.success("Rôle créé");
    },
    onError: (error: Error) => {
      toast.error(`Erreur création rôle : ${error.message}`);
    },
  });
}

// =========================================================
// Mise à jour d'un rôle
// =========================================================
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: RoleUpdate }) => {
      const { data, error } = await supabase
        .from("roles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Rôle mis à jour");
    },
    onError: (error: Error) => {
      toast.error(`Erreur mise à jour rôle : ${error.message}`);
    },
  });
}

// =========================================================
// Suppression d'un rôle (impossible pour les rôles système)
// =========================================================
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Rôle supprimé");
    },
    onError: (error: Error) => {
      toast.error(`Erreur suppression rôle : ${error.message}`);
    },
  });
}

// =========================================================
// Toggle d'une permission sur un rôle
// =========================================================
export function useTogglePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      permissionKey,
      enabled,
    }: {
      roleId: string;
      permissionKey: string;
      enabled: boolean;
    }) => {
      if (enabled) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role_id: roleId, permission_key: permissionKey });

        // Ignorer les violations de unique constraint (perm déjà présente = OK)
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_key", permissionKey);

        if (error) throw error;
      }

      return { roleId, permissionKey, enabled };
    },
    onSuccess: ({ roleId }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.permissionsByRole(roleId) });
      queryClient.invalidateQueries({ queryKey: roleKeys.currentUserPermissions() });
    },
    onError: (error: Error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });
}
