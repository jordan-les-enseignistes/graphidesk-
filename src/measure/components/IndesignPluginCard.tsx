import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Puzzle,
  CheckCircle2,
  ArrowUpCircle,
  Download,
  RefreshCw,
  Eraser,
  TriangleAlert,
} from "lucide-react";

interface PluginStatus {
  id: string;
  nom: string;
  embedded_version: string;
  installed_versions: string[];
  indesign_running: boolean;
  upia_available: boolean;
}

/**
 * Encart d'installation / mise à jour des extensions InDesign de l'atelier.
 *
 * Les `.ccx` voyagent dans les ressources de GraphiDesk : l'extension
 * compatible avec la version courante est toujours celle livrée ici.
 *
 * ⚠ Pourquoi ces extensions ne sont pas dans la librairie du Kit comme les
 * nuanciers : ce ne sont pas des fichiers à déposer quelque part. Leur
 * installation passe par l'installateur d'Adobe (UPIA), qui exige InDesign
 * fermé et laisse cohabiter les anciennes versions — ménage dont GraphiDesk
 * se charge. Elles sont donc embarquées, et présentées ici avec le MÊME
 * vocabulaire que le reste du Kit (installer, mettre à jour, désinstaller).
 */
export function IndesignPluginCard() {
  const [plugins, setPlugins] = useState<PluginStatus[] | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPlugins(await invoke<PluginStatus[]>("get_indesign_plugin_status"));
    } catch {
      setPlugins(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!plugins || plugins.length === 0) return null;

  const installer = async (p: PluginStatus) => {
    setOccupe(p.id);
    try {
      const v = await invoke<string>("install_indesign_plugin", { id: p.id });
      toast.success(
        `« ${p.nom} » v${v} installée — lance InDesign, le panneau est dans Modules externes`,
        { duration: 8000 }
      );
      await refresh();
    } catch (err) {
      toast.error(String(err), { duration: 8000 });
    } finally {
      setOccupe(null);
    }
  };

  const desinstaller = async (p: PluginStatus) => {
    const ok = window.confirm(
      `Retirer « ${p.nom} » de CE POSTE ?\n\n` +
        `L'extension reste livrée avec GraphiDesk : tu pourras la réinstaller quand tu veux.`
    );
    if (!ok) return;
    setOccupe(p.id);
    try {
      const message = await invoke<string>("desinstaller_plugin_indesign", { id: p.id });
      toast.success(message, { duration: 7000 });
      await refresh();
    } catch (err) {
      toast.error(String(err), { duration: 8000 });
    } finally {
      setOccupe(null);
    }
  };

  const ligne = (p: PluginStatus) => {
    const installees = p.installed_versions;
    const aJour = installees.includes(p.embedded_version) && installees.length === 1;
    const absente = installees.length === 0;
    const busy = occupe === p.id;

    return (
      <div
        key={p.id}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-slate-200 px-3 py-2 dark:border-slate-700"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium dark:text-slate-200">{p.nom}</span>
          <span className="shrink-0 text-[11px] text-slate-400">v{p.embedded_version}</span>
          {aJour ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              à jour
            </span>
          ) : absente ? (
            <span className="shrink-0 text-xs text-slate-400">non installée</span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <ArrowUpCircle className="h-3.5 w-3.5" />
              v{installees.join(" + v")} sur ce poste
            </span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!aJour && (
            <Button
              size="sm"
              disabled={busy || !p.upia_available}
              onClick={() => installer(p)}
              className="gap-1.5 bg-fuchsia-600 text-white hover:bg-fuchsia-700"
            >
              {busy ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {absente ? "Installer" : "Mettre à jour"}
            </Button>
          )}
          {!absente && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => desinstaller(p)}
              className="gap-1.5 text-slate-500"
              title="Retirer l'extension de ce poste uniquement"
            >
              <Eraser className="h-3.5 w-3.5" />
              Désinstaller
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="space-y-2.5 p-4">
      <h4 className="flex items-center gap-2 font-medium dark:text-slate-200">
        <Puzzle className="h-4 w-4 text-fuchsia-500" />
        Extensions InDesign
      </h4>

      {/* ⚠ Avertissement en TÊTE et en grand : installer pendant qu'InDesign
          tourne laisse l'ancienne version chargée, et la mise à jour semble
          n'avoir servi à rien. C'est la première cause d'échec. */}
      <p
        className={
          "flex items-center gap-2 text-sm font-bold " +
          (plugins[0].indesign_running
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400")
        }
      >
        <TriangleAlert className="h-4 w-4 shrink-0" />
        {plugins[0].indesign_running
          ? "InDesign est OUVERT — ferme-le d'abord"
          : "InDesign doit être fermé pour installer, désinstaller ou mettre à jour"}
      </p>

      {!plugins[0].upia_available && (
        <p className="text-xs text-red-500">
          Installateur Adobe introuvable — Creative Cloud doit être installé sur ce poste.
        </p>
      )}

      {plugins.map(ligne)}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        InDesign lit ses extensions au démarrage : elles n'apparaissent qu'au
        lancement suivant.
      </p>
    </Card>
  );
}
