import { useState, useEffect } from "react";
import { useTauriUpdater } from "@/hooks/useTauriUpdater";
import { UpdateModal } from "./UpdateModal";

const DISMISS_KEY = "graphidesk_update_dismissed";

export function UpdateChecker() {
  const tauriUpdater = useTauriUpdater();
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (tauriUpdater.checking || dismissed) return;
    if (!tauriUpdater.available || !tauriUpdater.version) return;

    // Vérifier si l'utilisateur a déjà ignoré cette version
    const dismissedVersion = localStorage.getItem(DISMISS_KEY);
    if (dismissedVersion === tauriUpdater.version) {
      return;
    }

    setShowModal(true);
  }, [tauriUpdater.available, tauriUpdater.version, tauriUpdater.checking, dismissed]);

  const handleClose = () => {
    if (!tauriUpdater.version) return;
    localStorage.setItem(DISMISS_KEY, tauriUpdater.version);
    setDismissed(true);
    setShowModal(false);
  };

  const handleDownload = () => {
    setShowModal(false);
  };

  if (!showModal || !tauriUpdater.version) {
    return null;
  }

  return (
    <UpdateModal
      updateInfo={{
        hasUpdate: true,
        currentVersion: tauriUpdater.currentVersion,
        latestVersion: tauriUpdater.version,
        changelog: tauriUpdater.body || null,
        isMandatory: false,
      }}
      onClose={handleClose}
      onDownload={handleDownload}
      tauriUpdater={{
        downloading: tauriUpdater.downloading,
        progress: tauriUpdater.progress,
        error: tauriUpdater.error,
        downloadAndInstall: tauriUpdater.downloadAndInstall,
      }}
    />
  );
}
