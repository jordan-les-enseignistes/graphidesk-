import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Puzzle, CheckCircle2, ArrowUpCircle, Download, RefreshCw } from "lucide-react";

interface PluginStatus {
  embedded_version: string;
  installed_versions: string[];
  indesign_running: boolean;
  upia_available: boolean;
}

/**
 * Encart d'installation / mise à jour du plugin InDesign "Cotes BAT".
 * Le .ccx voyage dans les ressources de GraphiDesk : le plugin compatible
 * avec le format de fiche VT courant est toujours celui livré ici.
 */
export function IndesignPluginCard() {
  const [status, setStatus] = useState<PluginStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await invoke<PluginStatus>("get_indesign_plugin_status"));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!status) return null;

  const installed = status.installed_versions;
  const upToDate = installed.includes(status.embedded_version) && installed.length === 1;
  const needsInstall = installed.length === 0;

  const handleInstall = async () => {
    setBusy(true);
    try {
      const v = await invoke<string>("install_indesign_plugin");
      toast.success(
        `Plugin Cotes BAT v${v} installé — lance InDesign, le panneau est dans Modules externes`,
        { duration: 8000 }
      );
      await refresh();
    } catch (err) {
      toast.error(String(err), { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-2.5">
      <h4 className="font-medium flex items-center gap-2 dark:text-slate-200">
        <Puzzle className="h-4 w-4 text-fuchsia-500" />
        Plugin InDesign — Cotes BAT
      </h4>

      {upToDate ? (
        <p className="text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          v{status.embedded_version} installée — à jour
        </p>
      ) : needsInstall ? (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Non installé. Nécessaire pour importer les fiches VT dans le gabarit InDesign.
        </p>
      ) : (
        <p className="text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <ArrowUpCircle className="h-3.5 w-3.5 shrink-0" />
          v{installed.join(" + v")} installée — mise à jour v{status.embedded_version} disponible
        </p>
      )}

      {!status.upia_available && (
        <p className="text-xs text-red-500">
          Installateur Adobe introuvable — Creative Cloud doit être installé sur ce poste.
        </p>
      )}

      {!upToDate && (
        <Button
          size="sm"
          disabled={busy || !status.upia_available}
          onClick={handleInstall}
          className="w-full gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
        >
          {busy ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {needsInstall
            ? `Installer le plugin (v${status.embedded_version})`
            : `Mettre à jour vers v${status.embedded_version}`}
        </Button>
      )}

      {!upToDate && status.indesign_running && (
        <p className="text-[11px] text-amber-500">
          ⚠ InDesign est ouvert — ferme-le avant d'installer.
        </p>
      )}
    </Card>
  );
}
