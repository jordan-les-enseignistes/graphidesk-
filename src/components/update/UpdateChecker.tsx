import { useState, useEffect } from "react";
import { useTauriUpdater } from "@/hooks/useTauriUpdater";
import { UpdateModal } from "./UpdateModal";
import { useAppUpdate } from "@/hooks/useAppUpdate";

const DISMISS_KEY = "graphidesk_update_dismissed";

export function UpdateChecker() {
  // Hook Tauri pour les mises à jour natives (téléchargement auto depuis GitHub)
  const tauriUpdater = useTauriUpdater();

  // Hook Supabase pour la config admin (fallback pour URL manuelle)
  const { data: supabaseConfig } = useAppUpdate();

  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Priorité à Tauri (GitHub), fallback Supabase
  const hasUpdate = tauriUpdater.available || supabaseConfig?.hasUpdate;
  const latestVersion = tauriUpdater.version || supabaseConfig?.latestVersion;
  const changelog = tauriUpdater.body || supabaseConfig?.changelog;
  const isMandatory = supabaseConfig?.isMandatory || false;
  const useTauriUpdate = tauriUpdater.available;

  useEffect(() => {
    if (tauriUpdater.checking || dismissed) return;
    if (!hasUpdate || !latestVersion) return;

    // Vérifier si l'utilisateur a déjà ignoré cette version
    const dismissedVersion = localStorage.getItem(DISMISS_KEY);
    if (dismissedVersion === latestVersion && !isMandatory) {
      return;
    }

    setShowModal(true);
  }, [hasUpdate, latestVersion, isMandatory, tauriUpdater.checking, dismissed]);

  const handleClose = () => {
    if (!latestVersion) return;

    if (!isMandatory) {
      localStorage.setItem(DISMISS_KEY, latestVersion);
      setDismissed(true);
    }
    setShowModal(false);
  };

  const handleDownload = () => {
    setShowModal(false);
  };

  if (!showModal || !latestVersion) {
    return null;
  }

  return (
    <UpdateModal
      updateInfo={{
        hasUpdate: true,
        currentVersion: tauriUpdater.currentVersion,
        latestVersion,
        downloadUrl: supabaseConfig?.downloadUrl || null,
        changelog: changelog || null,
        isMandatory,
      }}
      onClose={handleClose}
      onDownload={handleDownload}
      useTauriUpdate={useTauriUpdate}
      tauriUpdater={{
        downloading: tauriUpdater.downloading,
        progress: tauriUpdater.progress,
        error: tauriUpdater.error,
        downloadAndInstall: tauriUpdater.downloadAndInstall,
      }}
    />
  );
}
