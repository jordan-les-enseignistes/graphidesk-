import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Rocket, Settings2 } from "lucide-react";
import { CaissonPreview, CaissonMultiPreview } from "./CaissonPreview";
import type { PartData, PartType, LightingType, CaissonMultiParams } from "./types";
import { DEFAULT_DEPTH_LUMINEUX, DEFAULT_DEPTH_NON_LUMINEUX, PLAQUE_MAX_WIDTH, PLAQUE_MAX_HEIGHT } from "./types";

interface CaissonMultiFormProps {
  onGenerate: (params: CaissonMultiParams) => void;
  isProcessing: boolean;
}

const PART_LABELS: Record<PartType, { label: string; icon: string; color: string }> = {
  left: { label: "Partie gauche", icon: "📐", color: "bg-blue-100 border-blue-300" },
  center: { label: "Partie centrale", icon: "📦", color: "bg-green-100 border-green-300" },
  right: { label: "Partie droite", icon: "📏", color: "bg-pink-100 border-pink-300" },
};

function createDefaultPart(type: PartType, profondeur: number): PartData {
  return {
    type,
    largeur: 0,
    hauteur: 0,
    profondeur,
    isMultiThickness: false,
    drillingHoles: true,
  };
}

export function CaissonMultiForm({ onGenerate, isProcessing }: CaissonMultiFormProps) {
  const [lightingType, setLightingType] = useState<LightingType>("lumineux");
  const defaultDepth = lightingType === "lumineux" ? DEFAULT_DEPTH_LUMINEUX : DEFAULT_DEPTH_NON_LUMINEUX;

  const [parts, setParts] = useState<PartData[]>([
    createDefaultPart("left", defaultDepth),
    createDefaultPart("right", defaultDepth),
  ]);

  const [globalDrillingHoles, setGlobalDrillingHoles] = useState(true);

  // Mettre à jour les profondeurs quand le type d'éclairage change
  useEffect(() => {
    const newDepth = lightingType === "lumineux" ? DEFAULT_DEPTH_LUMINEUX : DEFAULT_DEPTH_NON_LUMINEUX;
    const oldDepth = lightingType === "lumineux" ? DEFAULT_DEPTH_NON_LUMINEUX : DEFAULT_DEPTH_LUMINEUX;
    setParts((prev) =>
      prev.map((part) => {
        // Si la profondeur est 0, la valeur par défaut, ou l'ancienne valeur par défaut, on met à jour
        const shouldUpdate = part.profondeur === 0 || part.profondeur === oldDepth || part.profondeur === newDepth;
        return {
          ...part,
          profondeur: shouldUpdate ? newDepth : part.profondeur,
          // Mettre à jour aussi les thickness si multi-épaisseurs
          thickness: part.isMultiThickness && part.thickness ? {
            ...part.thickness,
            haut: part.thickness.haut === oldDepth ? newDepth : part.thickness.haut,
            bas: part.thickness.bas === oldDepth ? newDepth : part.thickness.bas,
            gauche: part.thickness.gauche === oldDepth ? newDepth : part.thickness.gauche,
            droite: part.thickness.droite === oldDepth ? newDepth : part.thickness.droite,
          } : part.thickness,
        };
      })
    );
  }, [lightingType]);

  // Vérifier si toutes les hauteurs sont identiques
  const allHeights = parts.map(p => p.hauteur).filter(h => h > 0);
  const hasHeightMismatch = allHeights.length > 1 && !allHeights.every(h => h === allHeights[0]);

  const addCenterPart = () => {
    const insertIndex = parts.findIndex((p) => p.type === "right");
    const newParts = [...parts];
    newParts.splice(insertIndex, 0, createDefaultPart("center", defaultDepth));
    setParts(newParts);
  };

  const removePart = (index: number) => {
    const part = parts[index];
    // Ne pas supprimer les parties gauche et droite
    if (part.type === "left" || part.type === "right") return;
    setParts(parts.filter((_, i) => i !== index));
  };

  const updatePart = (index: number, updates: Partial<PartData>) => {
    setParts((prev) =>
      prev.map((part, i) => (i === index ? { ...part, ...updates } : part))
    );
  };

  const toggleMultiThickness = (index: number) => {
    const part = parts[index];
    if (!part.isMultiThickness) {
      const depth = part.profondeur || defaultDepth;
      updatePart(index, {
        isMultiThickness: true,
        thickness: {
          haut: depth,
          bas: depth,
          gauche: part.type === "left" ? depth : 0,
          droite: part.type === "right" ? depth : 0,
          isMulti: true,
        },
      });
    } else {
      const newDepth = part.thickness?.haut || defaultDepth;
      updatePart(index, {
        isMultiThickness: false,
        profondeur: newDepth,
        thickness: undefined,
      });
    }
  };

  // Validation
  const isValid = parts.every(
    (part) =>
      part.largeur > 0 &&
      part.hauteur > 0 &&
      (part.isMultiThickness
        ? (part.thickness?.haut || 0) > 0 || (part.thickness?.bas || 0) > 0
        : part.profondeur > 0)
  );

  const handleGenerate = () => {
    if (!isValid) return;

    const partsWithDrilling = parts.map((part) => ({
      ...part,
      drillingHoles: globalDrillingHoles && part.drillingHoles,
    }));

    onGenerate({
      parts: partsWithDrilling,
      drillingHoles: globalDrillingHoles,
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
                <div className="text-xs text-slate-500 dark:text-slate-400">Profondeur {DEFAULT_DEPTH_LUMINEUX}mm</div>
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
                <div className="text-xs text-slate-500 dark:text-slate-400">Profondeur {DEFAULT_DEPTH_NON_LUMINEUX}mm</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Bouton ajouter partie centrale */}
      <Button
        type="button"
        variant="outline"
        onClick={addCenterPart}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une partie centrale
      </Button>

      {/* Parties */}
      <div className="space-y-4">
        {parts.map((part, index) => {
          const partInfo = PART_LABELS[part.type];
          const canRemove = part.type === "center";

          // Calcul des dimensions finales pour cette partie
          let eH = part.profondeur;
          let eB = part.profondeur;
          let eG = part.type === "left" ? part.profondeur : 0;
          let eD = part.type === "right" ? part.profondeur : 0;

          if (part.isMultiThickness && part.thickness) {
            eH = part.thickness.haut || 0;
            eB = part.thickness.bas || 0;
            eG = part.thickness.gauche || 0;
            eD = part.thickness.droite || 0;
          }

          const largeurFinale = part.largeur + eG + eD;
          const hauteurFinale = part.hauteur + eH + eB;
          const depasseFormat = largeurFinale > PLAQUE_MAX_WIDTH && hauteurFinale > PLAQUE_MAX_HEIGHT;

          return (
            <Card key={index} className={`p-4 border-2 ${partInfo.color}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium flex items-center gap-2">
                  <span>{partInfo.icon}</span>
                  {partInfo.label}
                </h4>
                {canRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePart(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Largeur (mm)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="ex: 1000"
                    value={part.largeur || ""}
                    onChange={(e) => updatePart(index, { largeur: parseFloat(e.target.value) || 0 })}
                    className={part.largeur > 0 ? "border-green-500" : ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Hauteur (mm)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="ex: 500"
                    value={part.hauteur || ""}
                    onChange={(e) => updatePart(index, { hauteur: parseFloat(e.target.value) || 0 })}
                    className={part.hauteur > 0 ? "border-green-500" : ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Épaisseur (mm)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="ex: 70"
                    value={part.profondeur || ""}
                    onChange={(e) => updatePart(index, { profondeur: parseFloat(e.target.value) || 0 })}
                    disabled={part.isMultiThickness}
                    className={part.profondeur > 0 && !part.isMultiThickness ? "border-green-500" : ""}
                  />
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`multi-${index}`}
                    checked={part.isMultiThickness}
                    onChange={() => toggleMultiThickness(index)}
                  />
                  <label htmlFor={`multi-${index}`} className="text-sm cursor-pointer flex items-center gap-1 dark:text-slate-300">
                    <Settings2 className="h-3 w-3 dark:text-slate-400" />
                    Multi-épaisseurs
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`drilling-${index}`}
                    checked={part.drillingHoles}
                    onChange={(e) => updatePart(index, { drillingHoles: e.target.checked })}
                  />
                  <label htmlFor={`drilling-${index}`} className="text-sm cursor-pointer dark:text-slate-300">
                    🔩 Perçage
                  </label>
                </div>
              </div>

              {/* Multi-épaisseurs détail */}
              {part.isMultiThickness && (
                <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-white/50 dark:bg-slate-700/50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-400">⬆️ Haut</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={part.thickness?.haut || ""}
                      onChange={(e) =>
                        updatePart(index, {
                          thickness: { ...part.thickness!, haut: parseFloat(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs dark:text-slate-400">⬇️ Bas</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={part.thickness?.bas || ""}
                      onChange={(e) =>
                        updatePart(index, {
                          thickness: { ...part.thickness!, bas: parseFloat(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  {part.type === "left" && (
                    <div className="space-y-1">
                      <Label className="text-xs dark:text-slate-400">⬅️ Gauche</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={part.thickness?.gauche || ""}
                        onChange={(e) =>
                          updatePart(index, {
                            thickness: { ...part.thickness!, gauche: parseFloat(e.target.value) || 0 },
                          })
                        }
                      />
                    </div>
                  )}
                  {part.type === "right" && (
                    <div className="space-y-1">
                      <Label className="text-xs dark:text-slate-400">➡️ Droite</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={part.thickness?.droite || ""}
                        onChange={(e) =>
                          updatePart(index, {
                            thickness: { ...part.thickness!, droite: parseFloat(e.target.value) || 0 },
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Format fini */}
              {part.largeur > 0 && part.hauteur > 0 && (
                <div className={`text-sm p-2 rounded ${depasseFormat ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : "bg-slate-100 dark:bg-slate-700 dark:text-slate-200"}`}>
                  Format fini : <strong>{largeurFinale} × {hauteurFinale} mm</strong>
                  {depasseFormat && " ⚠️ Dépasse la plaque max"}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Perçage global */}
      <Card className="p-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="globalDrilling"
            checked={globalDrillingHoles}
            onChange={(e) => setGlobalDrillingHoles(e.target.checked)}
          />
          <label htmlFor="globalDrilling" className="text-sm cursor-pointer flex items-center gap-2 dark:text-slate-300">
            <span>🔩</span> Activer les trous de perçage Ø3mm sur toutes les parties
          </label>
        </div>
      </Card>

      {/* Résumé dimensions totales */}
      {(() => {
        // Calculer les dimensions totales du caisson assemblé
        let totalLargeurFinie = 0;
        let maxHauteurFinie = 0;
        let allPartsValid = true;

        parts.forEach((part) => {
          if (part.largeur <= 0 || part.hauteur <= 0) {
            allPartsValid = false;
            return;
          }

          let eH = part.profondeur;
          let eB = part.profondeur;
          let eG = part.type === "left" ? part.profondeur : 0;
          let eD = part.type === "right" ? part.profondeur : 0;

          if (part.isMultiThickness && part.thickness) {
            eH = part.thickness.haut || 0;
            eB = part.thickness.bas || 0;
            eG = part.thickness.gauche || 0;
            eD = part.thickness.droite || 0;
          }

          const largeurFinale = part.largeur + eG + eD;
          const hauteurFinale = part.hauteur + eH + eB;

          totalLargeurFinie += largeurFinale;
          if (hauteurFinale > maxHauteurFinie) {
            maxHauteurFinie = hauteurFinale;
          }
        });

        // Calculer la largeur face visible (sans épaisseurs latérales)
        let totalLargeurVisible = 0;
        parts.forEach((part) => {
          if (part.largeur > 0) {
            totalLargeurVisible += part.largeur;
          }
        });

        // Calculer la hauteur face visible (sans épaisseurs haut/bas)
        const hauteurVisible = parts.find(p => p.hauteur > 0)?.hauteur || 0;

        if (!allPartsValid) return null;

        return (
          <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-700">
            <h4 className="font-medium mb-2 flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <span>📐</span> Dimensions totales du caisson assemblé
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600 dark:text-slate-400">Face visible :</span>
                <div className="font-bold text-lg text-purple-700 dark:text-purple-300">
                  {totalLargeurVisible} × {hauteurVisible} mm
                </div>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-400">Format fini (avec épaisseurs) :</span>
                <div className="font-bold text-lg text-pink-700 dark:text-pink-300">
                  {totalLargeurFinie} × {maxHauteurFinie} mm
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Aperçu global */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2 dark:text-slate-200">
          <span>👁️</span> Prévisualisation
        </h4>
        <CaissonMultiPreview parts={parts} drillingHoles={globalDrillingHoles} heightWarning={hasHeightMismatch} />
      </div>

      {/* Bouton générer */}
      <Button
        onClick={handleGenerate}
        disabled={!isValid || isProcessing}
        className="w-full py-6 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
            Génération en cours...
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-5 w-5" />
            Générer le caisson multi-parties ({parts.length} fichiers)
          </>
        )}
      </Button>
    </div>
  );
}
