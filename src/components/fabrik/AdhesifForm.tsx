import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, AlertCircle, Check, X } from "lucide-react";

export interface AdhesifParams {
  /** true = le fichier est déjà à l'échelle 1:1, pas de mise à l'échelle x10 */
  dejaEchelle: boolean;
  /** true = pose en intérieur (vitrophanie) : calque WHITE fusionné,
   *  blanc repère + surimpression du fond, tout au-dessus */
  poseInterieur: boolean;
}

interface AdhesifFormProps {
  onGenerate: (params: AdhesifParams) => void;
  isProcessing: boolean;
}

export function AdhesifForm({ onGenerate, isProcessing }: AdhesifFormProps) {
  const [dejaEchelle, setDejaEchelle] = useState(false);
  const [poseInterieur, setPoseInterieur] = useState(false);

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
            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium flex-shrink-0">
              1
            </div>
            <p><strong>Adobe Illustrator</strong> doit être ouvert avec votre fichier de design</p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium flex-shrink-0">
              2
            </div>
            <p>Le fichier doit contenir votre <strong>design vectoriel</strong> (logos, textes, formes)</p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium flex-shrink-0">
              3
            </div>
            <p>Assurez-vous que le document est <strong>bien visible</strong> (pas en arrière-plan)</p>
          </div>
        </div>
      </Card>

      {/* Bouton générer */}
      <Button
        onClick={() => onGenerate({ dejaEchelle, poseInterieur })}
        disabled={isProcessing}
        className="w-full py-6 text-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
            Automatisation en cours...
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-5 w-5" />
            Lancer l'automatisation adhésif
          </>
        )}
      </Button>

      {/* Options */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Options :</span>
        <button
          type="button"
          onClick={() => setDejaEchelle(!dejaEchelle)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
            dejaEchelle
              ? "bg-teal-600 border-teal-600 text-white"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
          title="Coché : le fichier est déjà à l'échelle 1:1, le script ne fait pas la mise à l'échelle x10"
        >
          {dejaEchelle && <Check className="h-3.5 w-3.5" />}
          Mon fichier est déjà à l'échelle 1:1
        </button>
        <button
          type="button"
          onClick={() => setPoseInterieur(!poseInterieur)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
            poseInterieur
              ? "bg-teal-600 border-teal-600 text-white"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
          title="Vitrophanie : ajoute un calque WHITE tout au-dessus (Artwork fusionné, blanc repère, Surimp. fond cochée) — la vraie nuance White reste à appliquer à la main"
        >
          {poseInterieur && <Check className="h-3.5 w-3.5" />}
          Adhésif pose en intérieur (vitrophanie — blanc de soutien)
        </button>
      </div>

      {/* Ce que fait l'automatisation */}
      <Card className="p-4 bg-slate-50">
        <h4 className="font-medium mb-4">Ce que fait l'automatisation</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Vectorisation des textes</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Vectorisation des contours</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Organisation des calques (Artwork, CutContour, FondPerdu)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Création du contour de découpe</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Application du décalage 5mm pour fonds perdus</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Fusion des tracés (Pathfinder Union)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Ajustement automatique du plan de travail</span>
          </div>
        </div>

        {/* Actions manuelles requises */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <h5 className="font-medium mb-3 text-amber-700">Actions manuelles requises</h5>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Couleur CutContour</strong> : Appliquer manuellement la nuance "CutContour" du nuancier "Colorado"
              </span>
            </div>
            <div className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Vérifier les fonds perdus</strong> : En cas de croisements de couleurs, retoucher manuellement le calque FondPerdu
              </span>
            </div>
            <div className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Vérifier la laize</strong> : Contrôler que les dimensions correspondent à la laize de votre adhésif
              </span>
            </div>
            {poseInterieur && (
              <div className="flex items-start gap-2">
                <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Nuance White</strong> : Appliquer manuellement la vraie nuance "White" sur
                  le calque WHITE (la surimpression du fond est déjà cochée)
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
