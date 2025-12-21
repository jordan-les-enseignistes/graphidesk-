import { useState, useEffect, useCallback } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface TauriUpdateState {
  available: boolean;
  checking: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  version: string | null;
  currentVersion: string;
  body: string | null;
}

export function useTauriUpdater() {
  const [state, setState] = useState<TauriUpdateState>({
    available: false,
    checking: false,
    downloading: false,
    progress: 0,
    error: null,
    version: null,
    currentVersion: "1.0.4",
    body: null,
  });

  const [update, setUpdate] = useState<Update | null>(null);

  // Vérifier les mises à jour
  const checkForUpdate = useCallback(async () => {
    setState((s) => ({ ...s, checking: true, error: null }));

    try {
      const updateResult = await check();

      if (updateResult) {
        setUpdate(updateResult);
        setState((s) => ({
          ...s,
          available: true,
          version: updateResult.version,
          body: updateResult.body || null,
          checking: false,
        }));
      } else {
        setState((s) => ({
          ...s,
          available: false,
          checking: false,
        }));
      }
    } catch (error) {
      setState((s) => ({
        ...s,
        checking: false,
        error: error instanceof Error ? error.message : "Erreur de vérification",
      }));
    }
  }, []);

  // Télécharger et installer la mise à jour
  const downloadAndInstall = useCallback(async () => {
    if (!update) return;

    setState((s) => ({ ...s, downloading: true, progress: 0, error: null }));

    try {
      // Télécharger avec progression
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          const total = event.data.contentLength || 0;
          setState((s) => ({ ...s, progress: 0 }));
        } else if (event.event === "Progress") {
          const downloaded = event.data.chunkLength;
          setState((s) => ({
            ...s,
            progress: Math.min(s.progress + downloaded, 100),
          }));
        } else if (event.event === "Finished") {
          setState((s) => ({ ...s, progress: 100 }));
        }
      });

      // Relancer l'application
      await relaunch();
    } catch (error) {
      setState((s) => ({
        ...s,
        downloading: false,
        error: error instanceof Error ? error.message : "Erreur de téléchargement",
      }));
    }
  }, [update]);

  // Vérifier au montage
  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    downloadAndInstall,
  };
}
