import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Sparkles, X, ExternalLink, AlertTriangle, Copy, Check, RefreshCw } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import type { UpdateCheckResult } from "@/hooks/useAppUpdate";

interface TauriUpdaterProps {
  downloading: boolean;
  progress: number;
  error: string | null;
  downloadAndInstall: () => Promise<void>;
}

interface UpdateModalProps {
  updateInfo: UpdateCheckResult;
  onClose: () => void;
  onDownload: () => void;
  // Props optionnelles pour l'updater Tauri natif
  useTauriUpdate?: boolean;
  tauriUpdater?: TauriUpdaterProps;
}

export function UpdateModal({
  updateInfo,
  onClose,
  onDownload,
  useTauriUpdate = false,
  tauriUpdater,
}: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isHttpUrl = updateInfo.downloadUrl?.startsWith("http");

  // Téléchargement automatique via Tauri Updater (GitHub)
  const handleTauriUpdate = async () => {
    if (!tauriUpdater) return;
    try {
      await tauriUpdater.downloadAndInstall();
      // L'app sera relancée automatiquement
    } catch {
      // L'erreur est gérée dans le hook
    }
  };

  // Téléchargement manuel via URL (fallback)
  const handleManualDownload = async () => {
    if (!updateInfo.downloadUrl) return;

    setDownloading(true);
    setError(null);

    try {
      await open(updateInfo.downloadUrl);

      setTimeout(() => {
        setDownloading(false);
        onDownload();
      }, 1000);
    } catch {
      setError(
        isHttpUrl
          ? "Impossible d'ouvrir le lien. Copiez-le ci-dessous et collez-le dans votre navigateur."
          : "Impossible d'ouvrir automatiquement. Copiez le chemin ci-dessous et collez-le dans l'explorateur Windows."
      );
      setDownloading(false);
    }
  };

  const handleCopyPath = async () => {
    if (!updateInfo.downloadUrl) return;
    try {
      await navigator.clipboard.writeText(updateInfo.downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback si clipboard ne fonctionne pas
    }
  };

  // Détermine si on utilise l'updater natif ou le fallback
  const isNativeUpdate = useTauriUpdate && tauriUpdater;
  const isDownloading = isNativeUpdate ? tauriUpdater.downloading : downloading;
  const displayError = isNativeUpdate ? tauriUpdater.error : error;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Mise à jour disponible</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Version {updateInfo.latestVersion}
                </p>
              </div>
            </div>
            {!updateInfo.isMandatory && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Version info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Version actuelle :</span>
            <span className="font-mono bg-slate-100 px-2 py-1 rounded">
              {updateInfo.currentVersion}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Nouvelle version :</span>
            <span className="font-mono bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
              {updateInfo.latestVersion}
            </span>
          </div>

          {/* Mandatory warning */}
          {updateInfo.isMandatory && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Mise à jour obligatoire</p>
                <p className="text-amber-700 mt-1">
                  Cette mise à jour est requise pour continuer à utiliser l'application.
                </p>
              </div>
            </div>
          )}

          {/* Changelog */}
          {updateInfo.changelog && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-slate-700">Nouveautés :</h3>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 max-h-40 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans">{updateInfo.changelog}</pre>
              </div>
            </div>
          )}

          {/* Progress bar pour mise à jour native */}
          {isNativeUpdate && tauriUpdater.downloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Téléchargement en cours...</span>
                <span className="text-slate-500">{Math.round(tauriUpdater.progress)}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${tauriUpdater.progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                L'application redémarrera automatiquement
              </p>
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm space-y-2">
              <p className="text-red-800">{displayError}</p>
              {!isNativeUpdate && updateInfo.downloadUrl && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-2 py-1 rounded border text-xs text-slate-700 truncate">
                    {updateInfo.downloadUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPath}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!updateInfo.isMandatory && !isDownloading && (
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Plus tard
              </Button>
            )}

            {isNativeUpdate ? (
              // Bouton mise à jour automatique (Tauri)
              <Button
                onClick={handleTauriUpdate}
                disabled={isDownloading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Installation...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Installer la mise à jour
                  </>
                )}
              </Button>
            ) : updateInfo.downloadUrl ? (
              // Bouton téléchargement manuel (fallback)
              <Button
                onClick={handleManualDownload}
                disabled={downloading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Ouverture...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger la mise à jour
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
                className="flex-1"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Lien non disponible
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
