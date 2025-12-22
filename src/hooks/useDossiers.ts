import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useViewAsStore } from "@/stores/viewAsStore";
import type { Dossier, DossierWithGraphiste, DossierFilters } from "@/types";
import { toast } from "sonner";

// Clés de requête
export const dossierKeys = {
  all: ["dossiers"] as const,
  lists: () => [...dossierKeys.all, "list"] as const,
  list: (filters: DossierFilters) => [...dossierKeys.lists(), filters] as const,
  details: () => [...dossierKeys.all, "detail"] as const,
  detail: (id: string) => [...dossierKeys.details(), id] as const,
  myDossiers: (userId: string) => [...dossierKeys.all, "my", userId] as const,
  archives: () => [...dossierKeys.all, "archives"] as const,
};

// Hook pour récupérer mes dossiers (ou ceux de l'utilisateur "view as")
export function useMyDossiers(filters?: Partial<DossierFilters>) {
  const profile = useAuthStore((state) => state.profile);
  const { viewAsUser, isViewingAs } = useViewAsStore();

  // Si admin en mode "view as", utiliser l'ID de l'utilisateur simulé
  const effectiveUserId = isViewingAs && viewAsUser ? viewAsUser.id : profile?.id;

  return useQuery({
    queryKey: dossierKeys.myDossiers(effectiveUserId ?? ""),
    queryFn: async () => {
      let query = supabase
        .from("dossiers")
        .select(`
          *,
          graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
        `)
        .eq("graphiste_id", effectiveUserId!)
        .eq("is_archived", false)
        .order("date_creation", { ascending: false });

      // Appliquer les filtres
      if (filters?.search) {
        query = query.ilike("nom", `%${filters.search}%`);
      }
      if (filters?.statut) {
        query = query.eq("statut", filters.statut);
      }
      if (filters?.dateFrom) {
        query = query.gte("date_creation", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("date_creation", filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DossierWithGraphiste[];
    },
    enabled: !!effectiveUserId,
  });
}

// Hook pour récupérer tous les dossiers (admin)
export function useAllDossiers(filters?: Partial<DossierFilters>) {
  return useQuery({
    queryKey: [...dossierKeys.lists(), "all", filters],
    queryFn: async () => {
      let query = supabase
        .from("dossiers")
        .select(`
          *,
          graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
        `)
        .eq("is_archived", false)
        .order("date_creation", { ascending: false });

      // Appliquer les filtres
      if (filters?.search) {
        query = query.ilike("nom", `%${filters.search}%`);
      }
      if (filters?.statut) {
        query = query.eq("statut", filters.statut);
      }
      if (filters?.graphiste_id) {
        query = query.eq("graphiste_id", filters.graphiste_id);
      }
      if (filters?.dateFrom) {
        query = query.gte("date_creation", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("date_creation", filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DossierWithGraphiste[];
    },
  });
}

// Hook pour récupérer tous les dossiers avec pagination (100 par page)
export function useAllDossiersPaginated(
  page: number,
  pageSize: number = 100,
  filters?: { search?: string; statut?: string; graphiste_id?: string }
) {
  return useQuery({
    queryKey: [...dossierKeys.lists(), "all-paginated", page, pageSize, filters],
    queryFn: async () => {
      // D'abord compter le total
      let countQuery = supabase
        .from("dossiers")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", false);

      if (filters?.search) {
        countQuery = countQuery.ilike("nom", `%${filters.search}%`);
      }
      if (filters?.statut) {
        countQuery = countQuery.eq("statut", filters.statut);
      }
      if (filters?.graphiste_id) {
        countQuery = countQuery.eq("graphiste_id", filters.graphiste_id);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Ensuite récupérer la page demandée
      let dataQuery = supabase
        .from("dossiers")
        .select(`
          *,
          graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
        `)
        .eq("is_archived", false)
        .order("date_creation", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.search) {
        dataQuery = dataQuery.ilike("nom", `%${filters.search}%`);
      }
      if (filters?.statut) {
        dataQuery = dataQuery.eq("statut", filters.statut);
      }
      if (filters?.graphiste_id) {
        dataQuery = dataQuery.eq("graphiste_id", filters.graphiste_id);
      }

      const { data, error } = await dataQuery;
      if (error) throw error;

      return {
        data: data as DossierWithGraphiste[],
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
        currentPage: page,
      };
    },
    staleTime: 30 * 1000, // 30 secondes
    gcTime: 5 * 60 * 1000,
  });
}

// Hook pour récupérer les archives avec pagination côté serveur
// Retourne les données paginées + le total pour la navigation
export function useArchives(filters?: Partial<DossierFilters>) {
  return useQuery({
    queryKey: [...dossierKeys.archives(), filters],
    queryFn: async () => {
      // Récupérer toutes les archives (pour les stats uniquement - on pagine côté client)
      const allData: DossierWithGraphiste[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("dossiers")
          .select(`
            *,
            graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
          `)
          .eq("is_archived", true)
          .order("date_archivage", { ascending: false, nullsFirst: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        // Appliquer les filtres
        if (filters?.search) {
          query = query.ilike("nom", `%${filters.search}%`);
        }
        if (filters?.graphiste_id) {
          query = query.eq("graphiste_id", filters.graphiste_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...(data as DossierWithGraphiste[]));
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 30 * 60 * 1000,
  });
}

// Hook pour les archives avec pagination côté serveur (100 par page)
export function useArchivesPaginated(page: number, pageSize: number = 100, search?: string) {
  return useQuery({
    queryKey: [...dossierKeys.archives(), "paginated", page, pageSize, search],
    queryFn: async () => {
      // D'abord compter le total (avec ou sans filtre de recherche)
      let countQuery = supabase
        .from("dossiers")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", true);

      if (search) {
        countQuery = countQuery.ilike("nom", `%${search}%`);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Ensuite récupérer la page demandée
      let dataQuery = supabase
        .from("dossiers")
        .select(`
          *,
          graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
        `)
        .eq("is_archived", true)
        .order("date_archivage", { ascending: false, nullsFirst: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        dataQuery = dataQuery.ilike("nom", `%${search}%`);
      }

      const { data, error } = await dataQuery;
      if (error) throw error;

      return {
        data: data as DossierWithGraphiste[],
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
        currentPage: page,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
  });
}

// Hook pour récupérer un dossier par ID
export function useDossier(id: string) {
  return useQuery({
    queryKey: dossierKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select(`
          *,
          graphiste:profiles!dossiers_graphiste_id_fkey(id, full_name, initials, badge_color)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as DossierWithGraphiste;
    },
    enabled: !!id,
  });
}

// Hook pour créer un dossier
export function useCreateDossier() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (data: Partial<Dossier>) => {
      const { data: newDossier, error } = await supabase
        .from("dossiers")
        .insert({
          ...data,
          graphiste_id: data.graphiste_id || profile!.id,
          created_by: profile!.id,
          updated_by: profile!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return newDossier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success("Dossier créé avec succès");
    },
    onError: (error) => {
      console.error("Erreur création dossier:", error);
      toast.error("Erreur lors de la création du dossier");
    },
  });
}

// Hook pour mettre à jour un dossier
export function useUpdateDossier() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Dossier> }) => {
      const { data: updatedDossier, error } = await supabase
        .from("dossiers")
        .update({
          ...data,
          updated_by: profile!.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updatedDossier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success("Dossier mis à jour");
    },
    onError: (error) => {
      console.error("Erreur mise à jour dossier:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

// Hook pour archiver un dossier
export function useArchiveDossier() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          is_archived: true,
          updated_by: profile!.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success("Dossier archivé");
    },
    onError: (error) => {
      console.error("Erreur archivage:", error);
      toast.error("Erreur lors de l'archivage");
    },
  });
}

// Hook pour désarchiver un dossier
export function useUnarchiveDossier() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          is_archived: false,
          date_archivage: null,
          updated_by: profile!.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success("Dossier désarchivé");
    },
    onError: (error) => {
      console.error("Erreur désarchivage:", error);
      toast.error("Erreur lors du désarchivage");
    },
  });
}

// Hook pour supprimer un dossier (admin uniquement)
export function useDeleteDossier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dossiers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success("Dossier supprimé");
    },
    onError: (error) => {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Hook pour transférer un dossier
// Utilise une fonction RPC pour bypass les RLS et permettre aux graphistes de transférer leurs dossiers
export function useTransferDossier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dossierId,
      newGraphisteId,
      reason,
    }: {
      dossierId: string;
      newGraphisteId: string;
      reason?: string;
    }) => {
      // Utiliser la fonction RPC qui gère les droits et le logging
      const { error } = await supabase.rpc("transfer_dossier", {
        p_dossier_id: dossierId,
        p_new_graphiste_id: newGraphisteId,
        p_reason: reason || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success("Dossier transféré avec succès");
    },
    onError: (error) => {
      console.error("Erreur transfert:", error);
      toast.error("Erreur lors du transfert");
    },
  });
}

// Hook pour archiver plusieurs dossiers
export function useBulkArchive() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          is_archived: true,
          updated_by: profile!.id,
        })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success(`${ids.length} dossier(s) archivé(s)`);
    },
    onError: (error) => {
      console.error("Erreur archivage multiple:", error);
      toast.error("Erreur lors de l'archivage");
    },
  });
}

// Hook pour changer le statut de plusieurs dossiers
export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async ({ ids, statut }: { ids: string[]; statut: string }) => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          statut,
          updated_by: profile!.id,
        })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: dossierKeys.all });
      toast.success(`Statut mis à jour pour ${ids.length} dossier(s)`);
    },
    onError: (error) => {
      console.error("Erreur mise à jour statut:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}
