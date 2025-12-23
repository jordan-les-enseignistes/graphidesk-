import { useMyDossiers } from "@/hooks/useDossiers";
import { useRealtime } from "@/hooks/useRealtime";
import { DossiersTable } from "@/components/dossiers/DossiersTable";
import { FolderOpen } from "lucide-react";

export default function MesDossiers() {
  // Activer le temps réel
  useRealtime();

  const { data: dossiers, isLoading } = useMyDossiers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
          <FolderOpen className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes Dossiers</h1>
          <p className="text-sm text-gray-500">
            Gérez vos dossiers en cours
          </p>
        </div>
      </div>

      {/* Table */}
      <DossiersTable
        dossiers={dossiers ?? []}
        isLoading={isLoading}
        showGraphiste={false}
        allowDateSortToggle={true}
      />
    </div>
  );
}
