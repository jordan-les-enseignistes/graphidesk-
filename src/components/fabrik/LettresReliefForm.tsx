import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CircleDot, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { LettresReliefParams } from "./types";

interface LettresReliefFormProps {
  onGenerate: (params: LettresReliefParams) => void;
  isProcessing: boolean;
}

export function LettresReliefForm({ onGenerate, isProcessing }: LettresReliefFormProps) {
  const [offsetMm, setOffsetMm] = useState("6");
  const [diamMm, setDiamMm] = useState("9");
  const [coverageMm, setCoverageMm] = useState("150");
  const [clearanceMm, setClearanceMm] = useState("2");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const buildParams = (mode: "placer" | "finaliser"): LettresReliefParams => ({
    mode,
    offsetMm: parseFloat(offsetMm) || 6,
    diamMm: parseFloat(diamMm) || 9,
    coverageMm: parseFloat(coverageMm) || 150,
    clearanceMm: parseFloat(clearanceMm) || 2,
  });

  return (
    <div className="space-y-6">
      {/* Prérequis */}
      <Card className="p-4">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Prérequis avant de lancer
        </h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3 text-sm">
            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300 font-medium flex-shrink-0">
              1
            </div>
            <p>
              <strong>Adobe Illustrator</strong> ouvert avec votre fichier{" "}
              <strong>à l'échelle 1:1</strong>
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300 font-medium flex-shrink-0">
              2
            </div>
            <p>
              Le fichier contient uniquement le <strong>tracé de découpe vectorisé</strong>{" "}
              (contour noir des lettres) — le script gère tout le reste
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300 font-medium flex-shrink-0">
              3
            </div>
            <p>
              Les textes doivent déjà être <strong>vectorisés</strong>
            </p>
          </div>
        </div>
      </Card>

      {/* Paramètres */}
      <Card className="p-4">
        <h4 className="font-medium mb-4 dark:text-slate-200">Paramètres</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lr-offset">Décalage contour intérieur (mm)</Label>
            <Input
              id="lr-offset"
              type="number"
              min="1"
              step="0.5"
              value={offsetMm}
              onChange={(e) => setOffsetMm(e.target.value)}
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Tracé vert — 6mm par défaut, trait aligné côté intérieur (la distance bord →
              trait est exacte)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lr-diam">Diamètre entretoise (mm)</Label>
            <Input
              id="lr-diam"
              type="number"
              min="4"
              step="0.5"
              value={diamMm}
              onChange={(e) => setDiamMm(e.target.value)}
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">9mm = minimum standard</p>
          </div>
        </div>

        {/* Paramètres avancés */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 mt-4 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Paramètres avancés
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t dark:border-slate-700">
            <div className="space-y-2">
              <Label htmlFor="lr-coverage">Rayon de couverture (mm)</Label>
              <Input
                id="lr-coverage"
                type="number"
                min="50"
                step="10"
                value={coverageMm}
                onChange={(e) => setCoverageMm(e.target.value)}
              />
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Aucun point de lettre à plus de cette distance d'une entretoise. Plus petit = plus
                d'entretoises.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lr-clearance">Distance min au bord rose (mm)</Label>
              <Input
                id="lr-clearance"
                type="number"
                min="0"
                step="0.5"
                value={clearanceMm}
                onChange={(e) => setClearanceMm(e.target.value)}
              />
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Garde entre le bord de l'entretoise et le tracé de découpe. Si trop près, le cercle
                glisse automatiquement vers l'intérieur.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Boutons : Placer puis Finaliser */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={() => onGenerate(buildParams("placer"))}
          disabled={isProcessing}
          className="py-6 text-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
        >
          {isProcessing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
          ) : (
            <CircleDot className="mr-2 h-5 w-5" />
          )}
          1. Placer les entretoises
        </Button>
        <Button
          onClick={() => onGenerate(buildParams("finaliser"))}
          disabled={isProcessing}
          className="py-6 text-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
        >
          {isProcessing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
          ) : (
            <CheckCircle2 className="mr-2 h-5 w-5" />
          )}
          2. Finaliser
        </Button>
      </div>

      {/* Workflow */}
      <Card className="p-4 bg-slate-50 dark:bg-slate-800/60">
        <h4 className="font-medium mb-4 dark:text-slate-200">Comment ça marche</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-orange-500 font-bold">1.</span>
            <span>
              <strong>Placer</strong> : génère le tracé rose (découpe) + vert (offset intérieur), puis
              place automatiquement les entretoises sur un calque <code>ENTRETOISES_PREVIEW</code>.
              Les cercles <span className="text-orange-500 font-medium">orange</span> sont centrés
              sur le tracé vert (encoche demi-cercle), les{" "}
              <span className="text-cyan-500 font-medium">cyan</span> sont glissés vers l'intérieur
              (pas la place).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">2.</span>
            <span>
              <strong>Ajuster à l'œil</strong> dans Illustrator : déplacer, ajouter ou supprimer des
              cercles sur le calque preview.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-500 font-bold">3.</span>
            <span>
              <strong>Finaliser</strong> : re-vérifie que tout rentre dans les lettres, pathfinde les
              encoches dans le tracé vert et met le fichier au propre (calques + couleurs).
            </span>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-sm text-gray-500 dark:text-slate-400">
          💡 Le nombre d'entretoises s'adapte automatiquement à la taille réelle des lettres (règle
          de couverture physique du PVC 19mm) — aucun réglage à faire par dossier.
        </div>
      </Card>
    </div>
  );
}
