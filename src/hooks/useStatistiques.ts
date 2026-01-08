import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ============================================
// Hooks pour les statistiques agrégées
// Utilisent des fonctions RPC qui bypass le RLS
// et retournent des compteurs (pas de limite de 1000)
// ============================================

// Types pour les données agrégées
interface StatsGlobal {
  total_en_cours: number;
  total_archives: number;
}

interface StatsParStatut {
  statut: string;
  count: number;
}

interface StatsParGraphiste {
  graphiste_id: string;
  total_actifs: number;
  total_archives: number;
}

interface StatsGraphisteParStatut {
  graphiste_id: string;
  statut: string;
  count: number;
}

interface StatsArchivesParAnnee {
  annee: number;
  count: number;
}

interface StatsArchivesParGraphiste {
  graphiste_id: string;
  count: number;
}

// Hook pour récupérer les stats globales
export function useStatsGlobal() {
  return useQuery({
    queryKey: ["stats", "global"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stats_global");
      if (error) throw error;
      return (data as StatsGlobal[])[0];
    },
    staleTime: 30 * 1000,
  });
}

// Hook pour récupérer les stats par statut
export function useStatsParStatut() {
  return useQuery({
    queryKey: ["stats", "par_statut"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stats_par_statut");
      if (error) throw error;
      return data as StatsParStatut[];
    },
    staleTime: 30 * 1000,
  });
}

// Hook pour récupérer les stats par graphiste
export function useStatsParGraphiste() {
  return useQuery({
    queryKey: ["stats", "par_graphiste"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stats_par_graphiste");
      if (error) throw error;
      return data as StatsParGraphiste[];
    },
    staleTime: 30 * 1000,
  });
}

// Hook pour récupérer le détail par graphiste et par statut
export function useStatsGraphisteParStatut() {
  return useQuery({
    queryKey: ["stats", "graphiste_par_statut"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stats_graphiste_par_statut");
      if (error) throw error;
      return data as StatsGraphisteParStatut[];
    },
    staleTime: 30 * 1000,
  });
}

// Hook pour récupérer les archives par année
export function useStatsArchivesParAnnee() {
  return useQuery({
    queryKey: ["stats", "archives_par_annee"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stats_archives_par_annee");
      if (error) throw error;
      return data as StatsArchivesParAnnee[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook pour récupérer les archives par graphiste (avec filtre année optionnel)
export function useStatsArchivesParGraphiste(annee?: number) {
  return useQuery({
    queryKey: ["stats", "archives_par_graphiste", annee],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stats_archives_par_graphiste", {
        p_annee: annee ?? null,
      });
      if (error) throw error;
      return data as StatsArchivesParGraphiste[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
