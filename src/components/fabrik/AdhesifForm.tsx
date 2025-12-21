import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, AlertCircle, X } from "lucide-react";

interface AdhesifFormProps {
  onGenerate: () => void;
  isProcessing: boolean;
}

export function AdhesifForm({ onGenerate, isProcessing }: AdhesifFormProps) {
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
        onClick={onGenerate}
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
          </div>
        </div>
      </Card>
    </div>
  );
}
