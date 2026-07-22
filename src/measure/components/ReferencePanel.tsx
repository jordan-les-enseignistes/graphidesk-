import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crosshair, RotateCcw, CheckCircle2, DoorOpen, Satellite } from "lucide-react";
import { SatelliteMeasureDialog } from "./SatelliteMeasureDialog";
import { useMeasureDoc, useMeasureUi, useMeasureImage } from "../state/store";
import { computeHomography } from "../engine/homography";
import { mmPerPixelAt, orderQuadInImage } from "../engine/zones";
import { estimateAspectRatio } from "../engine/aspectRatio";
import { REFERENCE_OBJECTS } from "../engine/referenceObjects";
import type { Pt, Reference } from "../state/types";

export function ReferencePanel() {
  const tool = useMeasureUi((s) => s.tool);
  const setTool = useMeasureUi((s) => s.setTool);
  const draftRefPts = useMeasureDoc((s) => s.draftRefPts);
  const planes = useMeasureDoc((s) => s.planes);
  const activePlaneId = useMeasureDoc((s) => s.activePlaneId);
  const setCalibration = useMeasureDoc((s) => s.setCalibration);
  const resetCalibration = useMeasureDoc((s) => s.resetCalibration);
  const removeLastRefPoint = useMeasureDoc((s) => s.removeLastRefPoint);

  const [widthStr, setWidthStr] = useState("");
  const [heightStr, setHeightStr] = useState("");
  const [satelliteOpen, setSatelliteOpen] = useState(false);

  const plane = planes.find((p) => p.id === activePlaneId);
  const calibrated = !!plane?.H && !!plane.reference;

  const applyPreset = (w: number, h: number) => {
    setWidthStr(String(w));
    setHeightStr(String(h));
  };

  const handleValidate = () => {
    if (draftRefPts.length !== 4) {
      toast.error("Place d'abord les 4 points de la référence sur la photo");
      return;
    }
    // ordre de clic libre : réordonné HG→HD→BD→BG (sinon plan en miroir !)
    const imgPts = orderQuadInImage(draftRefPts as [Pt, Pt, Pt, Pt]);

    let widthMm = parseFloat(widthStr);
    let heightMm = parseFloat(heightStr);
    const haveW = widthStr.trim() !== "" && widthMm > 0;
    const haveH = heightStr.trim() !== "" && heightMm > 0;

    if (!haveW && !haveH) {
      toast.error("Saisis au moins une dimension réelle en mm");
      return;
    }

    // Une seule dimension connue : déduction de l'autre par analyse de la
    // perspective du quadrilatère (méthode Zhang — approximatif, ±2-5%)
    if (!haveW || !haveH) {
      const img = useMeasureImage.getState().image;
      if (!img) {
        toast.error("Image non disponible");
        return;
      }
      const ratio = estimateAspectRatio(imgPts, img.width, img.height);
      if (!ratio) {
        toast.error(
          "Impossible de déduire la dimension manquante (perspective trop ambiguë) — renseigne les deux dimensions"
        );
        return;
      }
      if (haveW) {
        heightMm = Math.round(widthMm / ratio);
        setHeightStr(String(heightMm));
        toast.info(`Hauteur déduite de la perspective : ≈ ${heightMm} mm (à vérifier)`, {
          duration: 6000,
        });
      } else {
        widthMm = Math.round(heightMm * ratio);
        setWidthStr(String(widthMm));
        toast.info(`Largeur déduite de la perspective : ≈ ${widthMm} mm (à vérifier)`, {
          duration: 6000,
        });
      }
    }
    try {
      const h = computeHomography(imgPts, [
        { x: 0, y: 0 },
        { x: widthMm, y: 0 },
        { x: widthMm, y: heightMm },
        { x: 0, y: heightMm },
      ]);
      const reference: Reference = { imgPts, widthMm, heightMm };
      setCalibration(reference, h);
      setTool("zone");
      toast.success("Calibration validée — tu peux maintenant mesurer des zones");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Calibration impossible");
    }
  };

  // Échelle indicative au centre de la référence
  let scaleInfo: string | null = null;
  if (calibrated && plane?.reference && plane.H) {
    const pts = plane.reference.imgPts;
    const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
    const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
    scaleInfo = `≈ ${mmPerPixelAt(plane.H, cx, cy).toFixed(2)} mm/px au centre de la référence`;
  }

  return (
    <Card className="p-4 space-y-3">
      <h4 className="font-medium flex items-center gap-2 dark:text-slate-200">
        <Crosshair className="h-4 w-4 text-blue-500" />
        Référence (échelle)
      </h4>

      {calibrated && plane?.reference ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Calibré : {plane.reference.widthMm} × {plane.reference.heightMm} mm
          </div>
          {scaleInfo && (
            <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">{scaleInfo}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => {
              resetCalibration();
              setTool("reference");
              toast.info("Calibration effacée (les zones de ce plan aussi)");
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Recommencer la calibration
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Place <strong>4 points</strong> sur un rectangle réel du plan (ordre : haut-gauche →
            haut-droit → bas-droit → bas-gauche), puis saisis ses dimensions réelles.
          </p>
          <p className="text-[11px] text-blue-600 dark:text-blue-400">
            💡 Une seule dimension connue ? Laisse l'autre vide : elle sera déduite de la
            perspective (approximatif ±2-5%).
          </p>

          <div className="flex items-center justify-between">
            <Button
              variant={tool === "reference" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool(tool === "reference" ? "none" : "reference")}
              className="gap-1.5"
            >
              <Crosshair className="h-4 w-4" />
              {tool === "reference" ? "Placement actif..." : "Placer les points"}
            </Button>
            <span className="text-sm font-mono text-gray-500 dark:text-slate-400">
              {draftRefPts.length}/4
            </span>
          </div>

          {draftRefPts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={removeLastRefPoint} className="w-full">
              Retirer le dernier point
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ref-w" className="text-xs">
                Largeur réelle (mm)
              </Label>
              <Input
                id="ref-w"
                type="number"
                min="1"
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
                placeholder="900"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ref-h" className="text-xs">
                Hauteur réelle (mm)
              </Label>
              <Input
                id="ref-h"
                type="number"
                min="1"
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value)}
                placeholder="2150"
              />
            </div>
          </div>

          {/* Mesure satellite : largeur de façade depuis les orthophotos IGN */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSatelliteOpen(true)}
            className="w-full gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            title="Mesurer la largeur de la façade sur la vue aérienne IGN (gratuit)"
          >
            <Satellite className="h-4 w-4" />
            Mesure satellite (aucune cote connue)
          </Button>
          {/* Préréglages d'objets standard */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500 dark:text-slate-400">
              Objets standard (dimensions typiques — provisoire !)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {REFERENCE_OBJECTS.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => applyPreset(obj.widthMm, obj.heightMm)}
                  title={obj.note ?? `${obj.widthMm} × ${obj.heightMm} mm`}
                  className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center gap-1"
                >
                  {obj.id.startsWith("porte") && <DoorOpen className="h-3 w-3" />}
                  {obj.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleValidate}
            disabled={draftRefPts.length !== 4}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Valider la calibration
          </Button>

          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            ⚠️ Une calibration ne vaut que pour SON plan : les vitrines du RDC et un étage en
            retrait sont deux plans différents.
          </p>
        </div>
      )}

      {/* Monté hors du bloc conditionnel : un changement d'état de calibration
          (ex : undo) ne doit jamais démonter le dialogue en pleine mesure */}
      <SatelliteMeasureDialog
        open={satelliteOpen}
        onOpenChange={setSatelliteOpen}
        onUseMeasure={(mm) => {
          setWidthStr(String(mm));
          setHeightStr("");
          toast.info(
            "Place les 4 points sur la façade ENTIÈRE (le rectangle mesuré au satellite) — la hauteur sera déduite de la perspective",
            { duration: 8000 }
          );
        }}
      />
    </Card>
  );
}
