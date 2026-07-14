import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SquareDashedMousePointer,
  Trash2,
  FileDown,
  AppWindow,
  ImageIcon,
} from "lucide-react";
import { useMeasureDoc, useMeasureUi, useMeasureImage } from "../state/store";
import { formatDims } from "../engine/zones";
import { buildPremaquetteSvg, downloadSvg } from "../engine/svgExport";
import { buildPhotomontagePsd, toBase64 } from "../engine/psdExport";
import { getOffscreenCanvas } from "../engine/offscreen";
import { DEFAULT_ILLUSTRATOR_PATH } from "@/components/fabrik/types";
import { useState } from "react";

// même clé que FabRik : le chemin Illustrator est partagé
const ILLUSTRATOR_PATH_KEY = "fabrik_illustrator_path";
// chemin Photoshop (spécifique au module Mesure)
const PHOTOSHOP_PATH_KEY = "measure_photoshop_path";
const DEFAULT_PHOTOSHOP_PATH =
  "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe";

// NOTE : la baguette magique (flood fill couleur) a été retirée de l'UI :
// le vitrage réfléchissant est fondamentalement hostile à la sélection par
// couleur (les reflets contiennent les mêmes couleurs que le décor réel).
// Les moteurs (engine/floodfill.ts, engine/minAreaRect.ts) sont conservés
// pour une éventuelle V2 type "rectangle magnétique" (accroche aux contours).

function PsdExportButton() {
  const [busy, setBusy] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const zones = useMeasureDoc((s) => s.zones);

  const toggleExcluded = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    const s = useMeasureDoc.getState();
    const plane = s.planes.find((p) => p.id === s.activePlaneId);
    const planeZones = s.zones.filter(
      (z) => z.planeId === plane?.id && !excluded.has(z.id)
    );
    if (planeZones.length === 0) {
      toast.error("Aucune zone sélectionnée pour l'export");
      return;
    }
    const photo = getOffscreenCanvas();
    if (!photo) {
      toast.error("Photo non disponible — recharge l'image");
      return;
    }

    setShowDialog(false);
    setBusy(true);
    try {
      toast.info("Génération du PSD en cours...", { duration: 3000 });
      const psdBytes = await buildPhotomontagePsd(planeZones, photo);
      const psdPath = await invoke<string>("save_temp_binary", {
        fileName: "photomontage_provisoire.psd",
        contentBase64: toBase64(psdBytes),
      });
      const photoshopPath =
        localStorage.getItem(PHOTOSHOP_PATH_KEY) ?? DEFAULT_PHOTOSHOP_PATH;
      try {
        await invoke("open_file_with", { appPath: photoshopPath, filePath: psdPath });
        toast.success("PSD photomontage ouvert dans Photoshop");
      } catch {
        toast.info(`PSD généré : ${psdPath} — ouvre-le manuellement (Photoshop non trouvé à "${photoshopPath}")`);
      }
    } catch (err) {
      toast.error(`Erreur génération PSD : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        className="w-full gap-1.5 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
        onClick={() => setShowDialog(true)}
        title="Photo + un objet dynamique par zone, pré-déformé en perspective"
      >
        {busy ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
        Générer le PSD photomontage
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <ImageIcon className="h-5 w-5 text-indigo-500" />
              Zones à inclure dans le PSD
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {zones.map((z) => (
              <label
                key={z.id}
                className="flex items-center gap-3 rounded p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <input
                  type="checkbox"
                  checked={!excluded.has(z.id)}
                  onChange={() => toggleExcluded(z.id)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm dark:text-slate-200">{z.label}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono ml-auto">
                  {formatDims(z.widthMm, z.heightMm)}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Décoche par exemple le fond de devanture si tu ne veux que les vitrines.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleExport} className="bg-indigo-600 hover:bg-indigo-700">
              Générer le PSD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ZoneList() {
  const tool = useMeasureUi((s) => s.tool);
  const setTool = useMeasureUi((s) => s.setTool);
  const zones = useMeasureDoc((s) => s.zones);
  const draftZonePts = useMeasureDoc((s) => s.draftZonePts);
  const deleteZone = useMeasureDoc((s) => s.deleteZone);
  const toggleZoneVitrage = useMeasureDoc((s) => s.toggleZoneVitrage);
  const planes = useMeasureDoc((s) => s.planes);
  const activePlaneId = useMeasureDoc((s) => s.activePlaneId);
  const calibrated = !!planes.find((p) => p.id === activePlaneId)?.H;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2 dark:text-slate-200">
          <SquareDashedMousePointer className="h-4 w-4 text-emerald-500" />
          Zones mesurées
        </h4>
        {tool === "zone" && draftZonePts.length > 0 && (
          <span className="text-sm font-mono text-amber-500">{draftZonePts.length}/4</span>
        )}
      </div>

      <Button
        variant={tool === "zone" ? "default" : "outline"}
        size="sm"
        disabled={!calibrated}
        onClick={() => setTool(tool === "zone" ? "none" : "zone")}
        className="w-full gap-1.5"
        title={calibrated ? "Cliquer 4 sommets sur la photo" : "Calibre d'abord la référence"}
      >
        <SquareDashedMousePointer className="h-4 w-4" />
        {tool === "zone" ? "Mesure active — clique 4 sommets" : "Mesurer une zone (4 points)"}
      </Button>

      {!calibrated && (
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Établis d'abord la référence pour débloquer la mesure.
        </p>
      )}

      {zones.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          onClick={async () => {
            const s = useMeasureDoc.getState();
            const plane = s.planes.find((p) => p.id === s.activePlaneId);
            if (!plane) return;
            const imageName = useMeasureImage.getState().image?.name ?? "photo";
            const svg = buildPremaquetteSvg(s.zones, plane, imageName, getOffscreenCanvas());
            if (!svg) {
              toast.error("Aucune zone à exporter sur ce plan");
              return;
            }
            const illustratorPath =
              localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
            try {
              // 1. écrire le SVG en temp
              const svgPath = await invoke<string>("save_temp_file", {
                fileName: "premaquette_provisoire_1-10.svg",
                content: svg,
              });
              // 2. l'ouvrir via script Illustrator (création des calques Artwork / Mesures)
              await invoke<string>("run_illustrator_script", {
                illustratorPath,
                scriptName: "premaquette_open.jsx",
                params: JSON.stringify({ svgPath }),
              });
              toast.success(
                "Prémaquette ouverte dans Illustrator — calques Artwork / Mesures créés"
              );
            } catch (err) {
              // fallback : téléchargement classique
              toast.error(`${String(err)} — téléchargement du fichier à la place`);
              downloadSvg(svg, "premaquette_provisoire_1-10.svg");
            }
          }}
        >
          <FileDown className="h-4 w-4" />
          Ouvrir la prémaquette dans Illustrator (1:10)
        </Button>
      )}

      {zones.length > 0 && <PsdExportButton />}

      {zones.length > 0 && (
        <div className="rounded bg-slate-50 dark:bg-slate-800/60 p-2 space-y-1 text-[11px] text-gray-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <AppWindow className="h-3 w-3 shrink-0 text-blue-500" />
            <span>
              <strong>Vitrage</strong> : la zone sera remplie avec la texture vitrine bleue +
              cadre alu à l'export (sinon bloc blanc)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trash2 className="h-3 w-3 shrink-0 text-red-400" />
            <span>
              <strong>Supprimer</strong> la zone (annulable Ctrl+Z)
            </span>
          </div>
        </div>
      )}

      {zones.length > 0 && (
        <div className="space-y-1.5">
          {zones.map((z) => (
            <div
              key={z.id}
              className="flex items-center justify-between rounded border border-slate-200 dark:border-slate-700 px-2.5 py-1.5"
            >
              <div>
                <span className="text-sm font-medium dark:text-slate-200">{z.label}</span>
                <span className="ml-2 text-sm text-gray-500 dark:text-slate-400 font-mono">
                  {formatDims(z.widthMm, z.heightMm)}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${
                    z.fill === "vitrage"
                      ? "text-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-400"
                      : "text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  }`}
                  onClick={() => toggleZoneVitrage(z.id)}
                  title={
                    z.fill === "vitrage"
                      ? "Vitrage : rempli avec la texture à l'export (cliquer pour repasser en blanc)"
                      : "Marquer comme vitrage (texture bleue à l'export)"
                  }
                >
                  <AppWindow className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                  onClick={() => deleteZone(z.id)}
                  title="Supprimer la zone"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
