import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Version actuelle de l'application (depuis package.json)
const CURRENT_VERSION = "1.0.0";

export interface AppUpdateInfo {
  id: string;
  latest_version: string;
  download_url: string | null;
  changelog: string | null;
  is_mandatory: boolean;
  published_at: string;
  created_at: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string | null;
  changelog: string | null;
  isMandatory: boolean;
}

// Comparer deux versions (ex: "1.0.0" < "1.1.0")
function compareVersions(current: string, latest: string): number {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (c < l) return -1;
    if (c > l) return 1;
  }
  return 0;
}

// Hook pour vérifier les mises à jour
export function useAppUpdate() {
  return useQuery({
    queryKey: ["app-update-check"],
    queryFn: async (): Promise<UpdateCheckResult> => {
      // Récupérer la dernière version depuis app_config (prendre la plus récente)
      const { data, error } = await supabase
        .from("app_config")
        .select("latest_version, download_url, changelog, is_mandatory, published_at")
        .order("published_at", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        // Si la table n'existe pas encore, retourner pas de mise à jour
        return {
          hasUpdate: false,
          currentVersion: CURRENT_VERSION,
          latestVersion: CURRENT_VERSION,
          downloadUrl: null,
          changelog: null,
          isMandatory: false,
        };
      }

      const config = data[0];
      const latestVersion = config?.latest_version || CURRENT_VERSION;
      const hasUpdate = compareVersions(CURRENT_VERSION, latestVersion) < 0;

      return {
        hasUpdate,
        currentVersion: CURRENT_VERSION,
        latestVersion,
        downloadUrl: config?.download_url || null,
        changelog: config?.changelog || null,
        isMandatory: config?.is_mandatory || false,
      };
    },
    staleTime: 1000 * 60 * 30, // Vérifier toutes les 30 minutes
    refetchOnWindowFocus: true,
    retry: false, // Ne pas réessayer si erreur (table peut ne pas exister)
  });
}

// Hook pour récupérer la configuration complète (pour l'admin)
export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(1);

      // Si pas de données ou erreur, retourner null
      if (error || !data || data.length === 0) {
        return null;
      }

      return data[0] as AppUpdateInfo & {
        update_server_path: string | null;
      };
    },
    retry: false,
  });
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
