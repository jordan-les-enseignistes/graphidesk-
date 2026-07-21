import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, ChevronDown, ChevronUp, Ruler } from "lucide-react";
import { CaissonDoublePreview } from "./CaissonPreview";
import type { CaissonDoubleParams, LightingType } from "./types";
import { DEFAULT_DEPTH_LUMINEUX, DEFAULT_DEPTH_NON_LUMINEUX } from "./types";

interface CaissonDoubleFormProps {
  onGenerate: (params: CaissonDoubleParams) => void;
  isProcessing: boolean;
}

export function CaissonDoubleForm({ onGenerate, isProcessing }: CaissonDoubleFormProps) {
  const [largeur, setLargeur] = useState<number>(0);
  const [hauteur, setHauteur] = useState<number>(0);
  const [lightingType, setLightingType] = useState<LightingType>("lumineux");
  const [epaisseur, setEpaisseur] = useState<number>(DEFAULT_DEPTH_LUMINEUX);
  const [drillingHoles, setDrillingHoles] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Mode entraxe potences : "auto" = aux extrémités, "custom" = personnalisé,
  // "mono" = une seule potence centrée (encoche unique)
  const [entraxeMode, setEntraxeMode] = useState<"auto" | "custom" | "mono">("auto");
  // L'utilisateur entre l'espace de fixation disponible (entraxe + 34mm)
  const [espaceFix, setEspaceFix] = useState<number>(0);

  // Mettre à jour l'épaisseur quand le type d'éclairage change
  useEffect(() => {
    const newDepth = lightingType === "lumineux" ? DEFAULT_DEPTH_LUMINEUX : DEFAULT_DEPTH_NON_LUMINEUX;
    const oldDepth = lightingType === "lumineux" ? DEFAULT_DEPTH_NON_LUMINEUX : DEFAULT_DEPTH_LUMINEUX;
    // Mettre à jour seulement si l'épaisseur est la valeur par défaut
    if (epaisseur === oldDepth || epaisseur === 0) {
      setEpaisseur(newDepth);
    }
  }, [lightingType]);

  // Calculs
  const epaisseurParFace = epaisseur / 2;
  const largeurFinale = largeur + 2 * epaisseurParFace;
  const hauteurFinale = hauteur + 2 * epaisseurParFace;

  // Calcul de l'espace de fixation max (potences aux extrémités)
  // entraxeMax = hauteur - 20 - 34, donc espaceFixMax = entraxeMax + 34 = hauteur - 20
  const espaceFixMax = hauteur > 0 ? hauteur - 20 : 0;

  // Espace de fixation minimum (encoches de 34mm minimum espacées)
  const espaceFixMin = 34 + 50; // 34mm encoche + 50mm minimum entre les deux

  // Calcul de l'entraxe à partir de l'espace de fixation (entraxe = espaceFix - 34)
  const entraxeFromEspaceFix = espaceFix > 34 ? espaceFix - 34 : 0;

  // Entraxe effectif à utiliser (null = mode auto, 0 = monopotence centrée)
  const entraxeEffectif =
    entraxeMode === "auto" ? null : entraxeMode === "mono" ? 0 : entraxeFromEspaceFix;

  // Validation
  const isValid = largeur > 0 && hauteur > 0 && epaisseur > 0 &&
    (entraxeMode !== "custom" || (espaceFix >= espaceFixMin && espaceFix <= espaceFixMax));

  const handleGenerate = () => {
    if (!isValid) return;

    onGenerate({
      largeur,
      hauteur,
      epaisseur,
      drillingHoles,
      entraxePotences: entraxeEffectif,
    });
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
                ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:border-orange-400"
                : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <div>
                <div className="font-medium text-sm dark:text-slate-200">Lumineux</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Épaisseur totale {DEFAULT_DEPTH_LUMINEUX}mm ({DEFAULT_DEPTH_LUMINEUX / 2}mm/face)</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setLightingType("non-lumineux")}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              lightingType === "non-lumineux"
                ? "border-slate-600 bg-slate-50 dark:bg-slate-700/50 dark:border-slate-400"
                : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🔳</span>
              <div>
                <div className="font-medium text-sm dark:text-slate-200">Non lumineux</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Épaisseur totale {DEFAULT_DEPTH_NON_LUMINEUX}mm ({DEFAULT_DEPTH_NON_LUMINEUX / 2}mm/face)</div>
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
            <Label htmlFor="largeur" className="text-xs text-slate-600 dark:text-slate-400">
              Largeur (mm)
            </Label>
            <Input
              id="largeur"
              type="number"
              min="0"
              step="1"
              placeholder="ex: 1000"
              value={largeur || ""}
              onChange={(e) => setLargeur(parseFloat(e.target.value) || 0)}
              className={largeur > 0 ? "border-green-500" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hauteur" className="text-xs text-slate-600 dark:text-slate-400">
              Hauteur (mm)
            </Label>
            <Input
              id="hauteur"
              type="number"
              min="0"
              step="1"
              placeholder="ex: 800"
              value={hauteur || ""}
              onChange={(e) => setHauteur(parseFloat(e.target.value) || 0)}
              className={hauteur > 0 ? "border-green-500" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="epaisseur" className="text-xs text-slate-600 dark:text-slate-400">
              Épaisseur totale (mm)
            </Label>
            <Input
              id="epaisseur"
              type="number"
              min="0"
              step="1"
              placeholder="ex: 70"
              value={epaisseur || ""}
              onChange={(e) => setEpaisseur(parseFloat(e.target.value) || 0)}
              className={epaisseur > 0 ? "border-green-500" : ""}
            />
          </div>
        </div>

        {/* Info épaisseur */}
        {epaisseur > 0 && (
          <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
            <p>
              Épaisseur par face : <strong className="dark:text-slate-200">{epaisseurParFace} mm</strong>
            </p>
            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
              L'épaisseur totale est divisée par 2 pour chaque face du caisson.
            </p>
          </div>
        )}
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
            <label htmlFor="drillingHoles" className="text-sm cursor-pointer flex items-center gap-2 dark:text-slate-300">
              <span>🔩</span> Trous de perçage Ø3mm
            </label>
          </div>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Détails
          </button>
        </div>

        {showDetails && (
          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1">
            <p>• Distance des angles de découpe : <strong>50mm</strong></p>
            <p>• Distance du bord extérieur : <strong>10mm</strong></p>
            <p>• Espacement max entre trous : <strong>750mm</strong></p>
            <p>• Trous sur les <strong>4 rabats</strong> de chaque face</p>
          </div>
        )}
      </Card>

      {/* Configuration entraxe potences */}
      <Card className="p-4 space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Ruler className="h-4 w-4 text-amber-600" />
          Position des potences
        </h4>

        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setEntraxeMode("auto")}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              entraxeMode === "auto"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400"
                : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
            }`}
          >
            <div className="font-medium text-sm dark:text-slate-200">Automatique</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Potences aux extrémités (standard)
            </div>
          </button>
          <button
            type="button"
            onClick={() => setEntraxeMode("custom")}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              entraxeMode === "custom"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400"
                : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
            }`}
          >
            <div className="font-medium text-sm dark:text-slate-200">Personnalisé</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Entraxe réduit (espace limité)
            </div>
          </button>
          <button
            type="button"
            onClick={() => setEntraxeMode("mono")}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              entraxeMode === "mono"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400"
                : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
            }`}
          >
            <div className="font-medium text-sm dark:text-slate-200">Monopotence centrée</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Une seule potence au centre
            </div>
          </button>
        </div>

        {entraxeMode === "mono" && (
          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
            <p>
              <span className="text-amber-600 dark:text-amber-400">ℹ️</span> Une encoche unique de{" "}
              <strong className="dark:text-slate-200">16 × 34 mm</strong> sera centrée verticalement
              sur le panneau pour la potence.
            </p>
          </div>
        )}

        {entraxeMode === "custom" && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="espaceFix" className="text-xs text-slate-600 dark:text-slate-400">
                Espace de fixation disponible (mm)
              </Label>
              <Input
                id="espaceFix"
                type="number"
                min={espaceFixMin}
                max={espaceFixMax || 1000}
                step="10"
                placeholder={`Ex: 650 mm (max: ${espaceFixMax} mm)`}
                value={espaceFix || ""}
                onChange={(e) => setEspaceFix(parseFloat(e.target.value) || 0)}
                className={espaceFix >= espaceFixMin && espaceFix <= espaceFixMax ? "border-green-500" : ""}
              />
            </div>

            {hauteur > 0 && (
              <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1">
                <p>
                  <span className="text-amber-600 dark:text-amber-400">ℹ️</span> Espace max possible : <strong className="dark:text-slate-200">{espaceFixMax} mm</strong> (min: {espaceFixMin} mm)
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Les potences seront centrées verticalement sur le panneau.
                </p>
                {espaceFix >= espaceFixMin && espaceFix <= espaceFixMax && (
                  <p className="text-green-600 dark:text-green-400 mt-2">
                    ✓ Entraxe entre potences : <strong>{entraxeFromEspaceFix} mm</strong>
                  </p>
                )}
                {espaceFix > espaceFixMax && (
                  <p className="text-red-500 dark:text-red-400 mt-2">
                    L'espace de fixation ne peut pas dépasser {espaceFixMax} mm pour cette hauteur
                  </p>
                )}
                {espaceFix > 0 && espaceFix < espaceFixMin && (
                  <p className="text-red-500 dark:text-red-400 mt-2">
                    L'espace de fixation minimum est de {espaceFixMin} mm
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Caractéristiques spéciales */}
      <Card className="p-4 bg-slate-50 dark:bg-slate-700/50">
        <h4 className="font-medium mb-3 flex items-center gap-2 dark:text-slate-200">
          <span>⚙️</span> Caractéristiques automatiques
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm dark:text-slate-300">
          <div className="flex items-start gap-2">
            <span className="text-green-500 dark:text-green-400">✓</span>
            <span>Encoches potences (16×34mm) pour fixation drapeau</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 dark:text-green-400">✓</span>
            <span>Faces en miroir pour assemblage parfait</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 dark:text-green-400">✓</span>
            <span>Rainures de pliage sur tous les côtés</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 dark:text-green-400">✓</span>
            <span>Espacement de 10mm entre les deux faces</span>
          </div>
        </div>
      </Card>

      {/* Aperçu calcul */}
      {largeur > 0 && hauteur > 0 && (
        <Card className="p-4 bg-slate-50 dark:bg-slate-700/50">
          <h4 className="font-medium mb-2 flex items-center gap-2 dark:text-slate-200">
            <span>📋</span> Aperçu du calcul
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600 dark:text-slate-400">Face visible :</span>
              <span className="ml-2 font-medium dark:text-slate-200">{largeur} × {hauteur} mm</span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">Format fini (×2) :</span>
              <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                {largeurFinale} × {hauteurFinale} mm
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Prévisualisation SVG */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2 dark:text-slate-200">
          <span>👁️</span> Prévisualisation
        </h4>
        <CaissonDoublePreview
          largeur={largeur}
          hauteur={hauteur}
          epaisseur={epaisseur}
          drillingHoles={drillingHoles}
          entraxePotences={entraxeEffectif}
        />
      </div>

      {/* Bouton générer */}
      <Button
        onClick={handleGenerate}
        disabled={!isValid || isProcessing}
        className="w-full py-6 text-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
            Génération en cours...
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-5 w-5" />
            Générer le caisson double face
          </>
        )}
      </Button>
    </div>
  );
}
