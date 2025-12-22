import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog: string | null;
  isMandatory: boolean;
}

// Cache de la version pour éviter les appels multiples
let cachedVersion: string | null = null;

// Hook pour utiliser la version dans les composants React
export function useAppVersion(): string {
  const [version, setVersion] = useState<string>(cachedVersion || "...");

  useEffect(() => {
    if (cachedVersion) {
      setVersion(cachedVersion);
      return;
    }

    getVersion()
      .then((v) => {
        cachedVersion = v;
        setVersion(v);
      })
      .catch(() => setVersion("dev"));
  }, []);

  return version;
}

// Fonction synchrone qui retourne le cache ou un fallback
export function getCurrentVersion(): string {
  return cachedVersion || "...";
}

// Fonction async pour récupérer la version (initialise le cache)
export async function fetchAppVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  try {
    cachedVersion = await getVersion();
    return cachedVersion;
  } catch {
    return "dev";
  }
}
