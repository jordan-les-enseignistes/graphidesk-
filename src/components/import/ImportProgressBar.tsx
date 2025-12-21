import { useImportStore } from "@/stores/importStore";
import { X, Check, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function ImportProgressBar() {
  const { progress, dismissComplete, resetImport } = useImportStore();
  const queryClient = useQueryClient();

  // Ne rien afficher si pas d'import en cours ou terminé
  if (!progress.isRunning && !progress.isComplete && !progress.error) {
    return null;
  }

  const handleDismiss = () => {
    if (progress.isComplete) {
      // Rafraîchir les données après un import réussi
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["archives"] });
      queryClient.invalidateQueries({ queryKey: ["franchises"] });
      queryClient.invalidateQueries({ queryKey: ["projets-internes"] });
    }
    dismissComplete();
  };

  const handleCancel = () => {
    // Pour l'instant on ne peut pas vraiment annuler, juste masquer
    resetImport();
  };

  // Import en cours
  if (progress.isRunning) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#2470B8] to-[#1c5a94] text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="text-sm font-medium">{progress.fileName}</span>
            </div>
            <span className="text-sm opacity-80">
              {progress.currentSheet && `${progress.currentSheet} - `}
              {progress.currentRow.toLocaleString()} / {progress.totalRows.toLocaleString()} lignes
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-48 h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="text-sm font-bold w-12 text-right">{progress.percentage}%</span>
            </div>

            <div className="text-xs opacity-80">
              +{progress.results.dossiers.added} nouveaux
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Import terminé avec succès
  if (progress.isComplete) {
    const totalProcessed =
      progress.results.dossiers.added +
      progress.results.dossiers.updated +
      progress.results.dossiers.unchanged +
      progress.results.franchises.success +
      progress.results.projets.success;

    const hasErrors =
      progress.results.dossiers.errors > 0 ||
      progress.results.franchises.errors > 0 ||
      progress.results.projets.errors > 0;

    return (
      <div className={`fixed top-0 left-0 right-0 z-50 shadow-lg ${
        hasErrors ? "bg-orange-500" : "bg-green-500"
      } text-white`}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Import terminé !</span>
            <span className="text-sm opacity-90">
              {progress.results.dossiers.added > 0 && `+${progress.results.dossiers.added} nouveaux`}
              {progress.results.dossiers.updated > 0 && `, ${progress.results.dossiers.updated} mis à jour`}
              {progress.results.dossiers.unchanged > 0 && `, ${progress.results.dossiers.unchanged} inchangés`}
              {progress.results.franchises.success > 0 && `, ${progress.results.franchises.success} franchises`}
              {progress.results.projets.success > 0 && `, ${progress.results.projets.success} projets`}
              {hasErrors && (
                <span className="text-yellow-200 ml-2">
                  ({progress.results.dossiers.errors + progress.results.franchises.errors + progress.results.projets.errors} erreurs)
                </span>
              )}
            </span>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Erreur
  if (progress.error) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Erreur d'import</span>
            <span className="text-sm opacity-90">{progress.error}</span>
          </div>

          <button
            onClick={handleCancel}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
