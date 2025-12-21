import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Rocket, Settings2 } from "lucide-react";
import { CaissonPreview } from "./CaissonPreview";
import type { CaissonSimpleParams, LightingType, Thickness } from "./types";
import { DEFAULT_DEPTH_LUMINEUX, DEFAULT_DEPTH_NON_LUMINEUX, PLAQUE_MAX_WIDTH, PLAQUE_MAX_HEIGHT } from "./types";

interface CaissonSimpleFormProps {
  onGenerate: (params: CaissonSimpleParams) => void;
  isProcessing: boolean;
}

export function CaissonSimpleForm({ onGenerate, isProcessing }: CaissonSimpleFormProps) {
  const [largeur, setLargeur] = useState<number>(0);
  const [hauteur, setHauteur] = useState<number>(0);
  const [profondeur, setProfondeur] = useState<number>(DEFAULT_DEPTH_LUMINEUX);
  const [lightingType, setLightingType] = useState<LightingType>("lumineux");
  const [isMultiThickness, setIsMultiThickness] = useState(false);
  const [thickness, setThickness] = useState<Thickness>({
    haut: DEFAULT_DEPTH_LUMINEUX,
    bas: DEFAULT_DEPTH_LUMINEUX,
    gauche: DEFAULT_DEPTH_LUMINEUX,
    droite: DEFAULT_DEPTH_LUMINEUX,
    isMulti: false,
  });
  const [drillingHoles, setDrillingHoles] = useState(true);
  const [showDrillingDetails, setShowDrillingDetails] = useState(false);

  // Calcul des dimensions finales
  const epaisseurHaut = isMultiThickness ? thickness.haut : profondeur;
  const epaisseurBas = isMultiThickness ? thickness.bas : profondeur;
  const epaisseurGauche = isMultiThickness ? thickness.gauche : profondeur;
  const epaisseurDroite = isMultiThickness ? thickness.droite : profondeur;

  const largeurFinale = largeur + epaisseurGauche + epaisseurDroite;
  const hauteurFinale = hauteur + epaisseurHaut + epaisseurBas;

  // Vérification du format
  const depasseFormat =
    largeurFinale > PLAQUE_MAX_WIDTH && hauteurFinale > PLAQUE_MAX_HEIGHT;

  // Validation
  const isValid =
    largeur > 0 &&
    hauteur > 0 &&
    (isMultiThickness
      ? (thickness.haut > 0 || thickness.bas > 0 || thickness.gauche > 0 || thickness.droite > 0)
      : profondeur > 0);

  useEffect(() => {
    const newDepth = lightingType === "lumineux" ? DEFAULT_DEPTH_LUMINEUX : DEFAULT_DEPTH_NON_LUMINEUX;
    setProfondeur(newDepth);
    setThickness({
      haut: newDepth,
      bas: newDepth,
      gauche: newDepth,
      droite: newDepth,
      isMulti: false,
    });
  }, [lightingType]);

  const handleMultiThicknessToggle = (checked: boolean) => {
    setIsMultiThickness(checked);
    if (checked) {
      setThickness({
        haut: profondeur,
        bas: profondeur,
        gauche: profondeur,
        droite: profondeur,
        isMulti: true,
      });
    }
  };

  const handleGenerate = () => {
    if (!isValid) return;

    const params: CaissonSimpleParams = {
      largeur,
      hauteur,
      profondeur,
      drillingHoles,
    };

    if (isMultiThickness) {
      params.thickness = { ...thickness, isMulti: true };
    }

    onGenerate(params);
  };

  return (
    <div className="space-y-6">
      {/* Type d'éclairage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Type d'éclairage</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLightingType("lumineux")}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              lightingType === "lumineux"
                ? "border-orange-500 bg-orange-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <div>
                <div className="font-medium text-sm">Lumineux</div>
                <div className="text-xs text-slate-500">Profondeur {DEFAULT_DEPTH_LUMINEUX}mm</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setLightingType("non-lumineux")}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              lightingType === "non-lumineux"
                ? "border-slate-600 bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🔳</span>
              <div>
                <div className="font-medium text-sm">Non lumineux</div>
                <div className="text-xs text-slate-500">Profondeur {DEFAULT_DEPTH_NON_LUMINEUX}mm</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Dimensions */}
      <Card className="p-4 space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <span>📐</span> Dimensions de la face visible
        </h4>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="largeur" className="text-xs text-slate-600">
              Largeur (mm)
            </Label>
            <Input
              id="largeur"
              type="number"
              min="0"
              step="1"
              placeholder="ex: 1500"
              value={largeur || ""}
              onChange={(e) => setLargeur(parseFloat(e.target.value) || 0)}
              className={largeur > 0 ? "border-green-500" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hauteur" className="text-xs text-slate-600">
              Hauteur (mm)
            </Label>
            <Input
              id="hauteur"
              type="number"
              min="0"
              step="1"
              placeholder="ex: 500"
              value={hauteur || ""}
              onChange={(e) => setHauteur(parseFloat(e.target.value) || 0)}
              className={hauteur > 0 ? "border-green-500" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profondeur" className="text-xs text-slate-600">
              Profondeur (mm)
            </Label>
            <Input
              id="profondeur"
              type="number"
              min="0"
              step="1"
              placeholder="ex: 70"
              value={profondeur || ""}
              onChange={(e) => setProfondeur(parseFloat(e.target.value) || 0)}
              disabled={isMultiThickness}
              className={profondeur > 0 && !isMultiThickness ? "border-green-500" : ""}
            />
          </div>
        </div>

        {/* Multi-épaisseurs */}
        <div className="pt-2 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="multiThickness"
              checked={isMultiThickness}
              onChange={(e) => handleMultiThicknessToggle(e.target.checked)}
            />
            <label htmlFor="multiThickness" className="text-sm cursor-pointer flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-500" />
              Rabats multi-épaisseurs
            </label>
          </div>

          {isMultiThickness && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 flex items-center gap-1">
                  <span>⬆️</span> Haut (mm)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={thickness.haut || ""}
                  onChange={(e) => setThickness({ ...thickness, haut: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 flex items-center gap-1">
                  <span>⬇️</span> Bas (mm)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={thickness.bas || ""}
                  onChange={(e) => setThickness({ ...thickness, bas: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 flex items-center gap-1">
                  <span>⬅️</span> Gauche (mm)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={thickness.gauche || ""}
                  onChange={(e) => setThickness({ ...thickness, gauche: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 flex items-center gap-1">
                  <span>➡️</span> Droite (mm)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={thickness.droite || ""}
                  onChange={(e) => setThickness({ ...thickness, droite: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Trous de perçage */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="drillingHoles"
              checked={drillingHoles}
              onChange={(e) => setDrillingHoles(e.target.checked)}
            />
            <label htmlFor="drillingHoles" className="text-sm cursor-pointer flex items-center gap-2">
              <span>🔩</span> Trous de perçage Ø3mm
            </label>
          </div>
          <button
            type="button"
            onClick={() => setShowDrillingDetails(!showDrillingDetails)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {showDrillingDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Détails
          </button>
        </div>

        {showDrillingDetails && (
          <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 space-y-1">
            <p>• Distance des angles de découpe : <strong>50mm</strong></p>
            <p>• Distance du bord extérieur : <strong>25mm</strong></p>
            <p>• Espacement max entre trous : <strong>750mm</strong></p>
            <p>• Calque dédié : <strong>"Perçage"</strong> (vert)</p>
          </div>
        )}
      </Card>

      {/* Aperçu calcul */}
      {largeur > 0 && hauteur > 0 && (
        <Card className="p-4 bg-slate-50">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <span>📋</span> Aperçu du calcul
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Face visible :</span>
              <span className="ml-2 font-medium">{largeur} × {hauteur} mm</span>
            </div>
            <div>
              <span className="text-slate-600">Format fini :</span>
              <span className={`ml-2 font-medium ${depasseFormat ? "text-red-600" : "text-green-600"}`}>
                {largeurFinale} × {hauteurFinale} mm
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Prévisualisation SVG */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <span>👁️</span> Prévisualisation
        </h4>
        <CaissonPreview
          largeur={largeur}
          hauteur={hauteur}
          profondeur={profondeur}
          thickness={isMultiThickness ? { ...thickness, isMulti: true } : undefined}
          drillingHoles={drillingHoles}
        />
      </div>

      {/* Bouton générer */}
      <Button
        onClick={handleGenerate}
        disabled={!isValid || isProcessing}
        className="w-full py-6 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
            Génération en cours...
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-5 w-5" />
            Générer le caisson simple
          </>
        )}
      </Button>
    </div>
  );
}
