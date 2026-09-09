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
  Check,
  RotateCcw,
} from "lucide-react";
import { useMeasureDoc, useMeasureUi } from "../state/store";
import { formatDims, zoneNom } from "../engine/zones";
import { ECHELLE_PAR_DEFAUT } from "../state/types";
import type { Zone } from "../state/types";
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

/** Affichage des cotes : "≈ arrondi 5 mm" pour une estimation photo,
 *  valeur EXACTE pour une cote réelle saisie à la main */
function afficheDims(z: Zone): string {
  return z.manuel
    ? `${Math.round(z.widthMm)} × ${Math.round(z.heightMm)} mm`
    : formatDims(z.widthMm, z.heightMm);
}

// NOTE : la baguette magique (flood fill couleur) a été retirée de l'UI :
// le vitrage réfléchissant est fondamentalement hostile à la sélection par
// couleur (les reflets contiennent les mêmes couleurs que le décor réel).
// Les moteurs (engine/floodfill.ts, engine/minAreaRect.ts) sont conservés
// pour une éventuelle V2 type "rectangle magnétique" (accroche aux contours).

function PsdExportButton() {
  const [busy, setBusy] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const allZones = useMeasureDoc((s) => s.zones);
  const planes = useMeasureDoc((s) => s.planes);
  const photos = useMeasureDoc((s) => s.photos);
  // règle multi-faces validée : UN PSD par PHOTO (toutes ses faces réunies),
  // X photos → X PSD ouverts dans Photoshop
  const photoOfZone = (z: Zone) =>
    planes.find((p) => p.id === z.planeId)?.photoId ?? null;
  const zones = photos.length > 1
    ? [...allZones].sort((a, b) => {
        const ia = photos.findIndex((p) => p.id === photoOfZone(a));
        const ib = photos.findIndex((p) => p.id === photoOfZone(b));
        return ia - ib;
      })
    : allZones;

  const toggleExcluded = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    const selection = zones.filter((z) => !excluded.has(z.id));
    if (selection.length === 0) {
      toast.error("Aucune zone sélectionnée pour l'export");
      return;
    }
    // groupement par photo : un PSD par photo ayant des zones sélectionnées
    const parPhoto: { photoId: string; nom: string; zones: Zone[] }[] = [];
    for (const photo of photos) {
      const zs = selection.filter((z) => photoOfZone(z) === photo.id);
      if (zs.length > 0) parPhoto.push({ photoId: photo.id, nom: photo.name, zones: zs });
    }
    if (parPhoto.length === 0) {
      toast.error("Aucune zone sélectionnée pour l'export");
      return;
    }

    setShowDialog(false);
    setBusy(true);
    try {
      toast.info(
        parPhoto.length > 1
          ? `Génération de ${parPhoto.length} PSD en cours...`
          : "Génération du PSD en cours...",
        { duration: 3000 }
      );
      const photoshopPath =
        localStorage.getItem(PHOTOSHOP_PATH_KEY) ?? DEFAULT_PHOTOSHOP_PATH;
      let ouverts = 0;
      const chemins: string[] = [];
      for (let i = 0; i < parPhoto.length; i++) {
        const grp = parPhoto[i];
        const canvas = getOffscreenCanvas(grp.photoId);
        if (!canvas) {
          toast.error(`Photo « ${grp.nom} » non disponible — recharge la page`);
          continue;
        }
        const psdBytes = await buildPhotomontagePsd(grp.zones, canvas);
        const suffix = parPhoto.length > 1 ? `_${i + 1}` : "";
        const psdPath = await invoke<string>("save_temp_binary", {
          fileName: `photomontage_provisoire${suffix}.psd`,
          contentBase64: toBase64(psdBytes),
        });
        chemins.push(psdPath);
        try {
          // Le PSD est écrit NATIVEMENT en CMJN (contenus des objets
          // dynamiques compris) — ouverture directe, aucun script, aucun flash.
          await invoke("open_file_with", { appPath: photoshopPath, filePath: psdPath });
          ouverts++;
        } catch {
          // ouverture échouée : le chemin est signalé plus bas
        }
      }
      if (ouverts === chemins.length && ouverts > 0) {
        toast.success(
          ouverts > 1
            ? `${ouverts} PSD photomontage ouverts dans Photoshop (un par photo, CMJN natif)`
            : "PSD photomontage ouvert dans Photoshop (CMJN natif, mockups éditables)"
        );
      } else if (chemins.length > 0) {
        toast.info(
          `PSD généré(s) : ${chemins.join(" • ")} — ouvre-les manuellement (Photoshop non trouvé à "${photoshopPath}")`
        );
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
                <span className="text-sm dark:text-slate-200">{zoneNom(z)}</span>
                {photos.length > 1 && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 truncate max-w-[110px]">
                    {photos.find((p) => p.id === photoOfZone(z))?.name}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono ml-auto">
                  {afficheDims(z)}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {photos.length > 1
              ? "Un PSD est généré par photo (toutes ses faces réunies)."
              : "Décoche par exemple le fond de devanture si tu ne veux que les vitrines."}
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
  const allZones = useMeasureDoc((s) => s.zones);
  const echelle = useMeasureDoc((s) => s.echelle ?? ECHELLE_PAR_DEFAUT);
  const setEchelle = useMeasureDoc((s) => s.setEchelle);
  const draftZonePts = useMeasureDoc((s) => s.draftZonePts);
  const deleteZone = useMeasureDoc((s) => s.deleteZone);
  const toggleZoneVitrage = useMeasureDoc((s) => s.toggleZoneVitrage);
  const setZoneDims = useMeasureDoc((s) => s.setZoneDims);
  const resetZoneDims = useMeasureDoc((s) => s.resetZoneDims);
  const planes = useMeasureDoc((s) => s.planes);
  const activePlaneId = useMeasureDoc((s) => s.activePlaneId);
  const calibrated = !!planes.find((p) => p.id === activePlaneId)?.H;
  // la liste montre les zones de la FACE active (multi-faces v1.5)
  const zones = allZones.filter((z) => z.planeId === activePlaneId);
  const zonesAutresFaces = allZones.length - zones.length;

  // édition manuelle des cotes (une zone à la fois)
  const [editId, setEditId] = useState<string | null>(null);
  const [editW, setEditW] = useState("");
  const [editH, setEditH] = useState("");
  const validerEdition = (id: string) => {
    const w = parseFloat(editW);
    const h = parseFloat(editH);
    if (w > 0 && h > 0) {
      setZoneDims(id, w, h);
      toast.success("Cote réelle enregistrée — les estimations photo sont recalées");
    }
    setEditId(null);
  };

  // renommage (nom d'affichage libre — la lettre technique ne change jamais)
  const setZoneNom = useMeasureDoc((s) => s.setZoneNom);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const validerNom = (id: string) => {
    setZoneNom(id, renameVal);
    setRenameId(null);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2 dark:text-slate-200">
          <SquareDashedMousePointer className="h-4 w-4 text-emerald-500" />
          Zones mesurées
          {zonesAutresFaces > 0 && (
            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
              (+{zonesAutresFaces} sur les autres faces)
            </span>
          )}
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
            // multi-faces v1.5 : UN SVG par face calibrée ayant des zones,
            // dans l'ordre de la liste des faces → un plan de travail chacun
            const faces: { svg: string; nom: string }[] = [];
            for (const plane of s.planes) {
              if (!plane.H) continue;
              const photoMeta = s.photos.find((p) => p.id === plane.photoId);
              const svg = buildPremaquetteSvg(
                s.zones,
                plane,
                photoMeta?.name ?? "photo",
                getOffscreenCanvas(plane.photoId),
                { echelle }
              );
              if (svg) faces.push({ svg, nom: plane.name });
            }
            if (faces.length === 0) {
              toast.error("Aucune zone à exporter");
              return;
            }
            const illustratorPath =
              localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
            try {
              // 1. écrire chaque SVG en temp
              const facesParams: { svgPath: string; nom: string }[] = [];
              for (let i = 0; i < faces.length; i++) {
                const svgPath = await invoke<string>("save_temp_file", {
                  fileName: `premaquette_face_${i + 1}.svg`,
                  content: faces[i].svg,
                });
                facesParams.push({ svgPath, nom: faces[i].nom });
              }
              // 2. ouvrir dans Illustrator — mono-face : script historique
              //    éprouvé ; multi-faces : un plan de travail nommé par face
              if (facesParams.length === 1) {
                await invoke<string>("run_illustrator_script", {
                  illustratorPath,
                  scriptName: "premaquette_open.jsx",
                  params: JSON.stringify({ svgPath: facesParams[0].svgPath }),
                });
              } else {
                await invoke<string>("run_illustrator_script", {
                  illustratorPath,
                  scriptName: "premaquette_multi_open.jsx",
                  params: JSON.stringify({ faces: facesParams }),
                });
              }
              toast.success(
                faces.length > 1
                  ? `Prémaquette ouverte dans Illustrator — ${faces.length} plans de travail (un par face)`
                  : "Prémaquette ouverte dans Illustrator — calques Artwork / Mesures créés"
              );
            } catch (err) {
              // fallback : téléchargement classique
              toast.error(`${String(err)} — téléchargement des fichiers à la place`);
              faces.forEach((f, i) =>
                downloadSvg(f.svg, `premaquette_face_${i + 1}_1-${echelle}.svg`)
              );
            }
          }}
        >
          <FileDown className="h-4 w-4" />
          Ouvrir la prémaquette dans Illustrator (1:{echelle})
        </Button>
      )}

      {zones.length > 0 && <PsdExportButton />}

      {zones.length > 0 && (
        <label className="flex cursor-pointer items-start gap-2 px-0.5 text-[11px] text-gray-500 dark:text-slate-400">
          <input
            type="checkbox"
            className="mt-0.5 h-3 w-3 shrink-0 accent-amber-500"
            checked={echelle === 100}
            onChange={(e) => setEchelle(e.target.checked ? 100 : ECHELLE_PAR_DEFAUT)}
          />
          <span>
            <strong>Échelle 1:100e</strong> pour la maquette — pour les très grands bâtiments,
            qui ne rentrent pas dans le plan de travail Illustrator au 1:10
          </span>
        </label>
      )}

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
            <Check className="h-3 w-3 shrink-0 text-emerald-500" />
            <span>
              <strong>Cote réelle</strong> : clique sur une dimension pour saisir la mesure
              connue — les estimations photo des autres zones se recalent dessus
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
              <div className="flex items-center min-w-0">
                {renameId === z.id ? (
                  <input
                    type="text"
                    value={renameVal}
                    autoFocus
                    placeholder={z.label}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={() => validerNom(z.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") validerNom(z.id);
                      if (e.key === "Escape") setRenameId(null);
                    }}
                    className="w-28 h-6 px-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRenameId(z.id);
                      setRenameVal(z.nom ?? "");
                    }}
                    className="text-sm font-medium dark:text-slate-200 rounded px-1 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-left"
                    title={`Cliquer pour renommer (lettre ${z.label.replace(/^Zone\s+/i, "")} conservée pour la VT)`}
                  >
                    {zoneNom(z)}
                    {z.nom && (
                      <span className="ml-1 text-[10px] text-gray-400 font-normal">
                        ({z.label.replace(/^Zone\s+/i, "")})
                      </span>
                    )}
                  </button>
                )}
                {editId === z.id ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-sm font-mono">
                    <input
                      type="number"
                      value={editW}
                      autoFocus
                      onChange={(e) => setEditW(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") validerEdition(z.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="w-16 h-6 px-1 text-xs font-mono rounded border border-emerald-400 bg-white dark:bg-slate-800 dark:text-slate-200"
                    />
                    ×
                    <input
                      type="number"
                      value={editH}
                      onChange={(e) => setEditH(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") validerEdition(z.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="w-16 h-6 px-1 text-xs font-mono rounded border border-emerald-400 bg-white dark:bg-slate-800 dark:text-slate-200"
                    />
                    <span className="text-xs text-gray-400">mm</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                      onClick={() => validerEdition(z.id)}
                      title="Valider (Entrée)"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(z.id);
                      setEditW(String(Math.round(z.widthMm)));
                      setEditH(String(Math.round(z.heightMm)));
                    }}
                    className={`ml-2 text-sm font-mono rounded px-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 ${
                      z.manuel
                        ? "text-emerald-700 dark:text-emerald-400 font-medium"
                        : "text-gray-500 dark:text-slate-400"
                    }`}
                    title="Cliquer pour saisir les cotes réelles (mesure connue)"
                  >
                    {afficheDims(z)}
                  </button>
                )}
                {z.manuel && editId !== z.id && (
                  <span className="ml-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[10px] px-1 py-0.5 font-medium">
                    réel
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {z.manuel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                    onClick={() => resetZoneDims(z.id)}
                    title="Revenir à l'estimation photo"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
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
