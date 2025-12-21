import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Sparkles, X, RefreshCw } from "lucide-react";
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
  tauriUpdater: TauriUpdaterProps;
}

export function UpdateModal({
  updateInfo,
  onClose,
  onDownload,
  tauriUpdater,
}: UpdateModalProps) {
  const handleTauriUpdate = async () => {
    try {
      await tauriUpdater.downloadAndInstall();
      onDownload();
    } catch {
      // L'erreur est gérée dans le hook
    }
  };

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
            {!updateInfo.isMandatory && !tauriUpdater.downloading && (
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

          {/* Changelog */}
          {updateInfo.changelog && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-slate-700">Nouveautés :</h3>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 max-h-40 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans">{updateInfo.changelog}</pre>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {tauriUpdater.downloading && (
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
          {tauriUpdater.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <p className="text-red-800">{tauriUpdater.error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!updateInfo.isMandatory && !tauriUpdater.downloading && (
              <Button variant="outline" onClick={onClose} className="flex-1">
                Plus tard
              </Button>
            )}

            <Button
              onClick={handleTauriUpdate}
              disabled={tauriUpdater.downloading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {tauriUpdater.downloading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Installation...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger la mise à jour
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
