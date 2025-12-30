import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, AlertCircle, FolderOpen, FileText, Hash } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { LettresBoitiersParams } from "./types";

interface LettresBoitiersFormProps {
  onGenerate: (params: LettresBoitiersParams) => void;
  isProcessing: boolean;
}

export function LettresBoitiersForm({ onGenerate, isProcessing }: LettresBoitiersFormProps) {
  const [destinationPath, setDestinationPath] = useState("");
  const [dossierName, setDossierName] = useState("");
  const [batNumber, setBatNumber] = useState("");

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Sélectionner le dossier de destination",
      });
      if (selected && typeof selected === "string") {
        setDestinationPath(selected);
      }
    } catch (error) {
      console.error("Erreur sélection dossier:", error);
    }
  };

  const handleGenerate = () => {
    if (!destinationPath || !dossierName || !batNumber) {
      return;
    }
    onGenerate({
      destinationPath,
      dossierName,
      batNumber,
    });
  };

  const isFormValid = destinationPath && dossierName && batNumber;

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
            <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-medium flex-shrink-0">
              1
            </div>
            <p><strong>Adobe Illustrator</strong> doit être ouvert avec votre fichier PDF de lettres</p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-medium flex-shrink-0">
              2
            </div>
            <p>Le fichier doit contenir les <strong>tracés vectoriels fermés</strong> des lettres (contours uniquement)</p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-medium flex-shrink-0">
              3
            </div>
            <p>Assurez-vous que le document est <strong>bien visible</strong> (pas en arrière-plan)</p>
          </div>
        </div>
      </Card>

      {/* Formulaire */}
      <Card className="p-4 space-y-4">
        <h4 className="font-medium">Paramètres de génération</h4>

        {/* Dossier de destination */}
        <div className="space-y-2">
          <Label htmlFor="destination" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-slate-500" />
            Dossier de destination
          </Label>
          <div className="flex gap-2">
            <Input
              id="destination"
              value={destinationPath}
              onChange={(e) => setDestinationPath(e.target.value)}
              placeholder="Sélectionnez un dossier..."
              className="flex-1"
              readOnly
            />
            <Button type="button" variant="outline" onClick={handleSelectFolder}>
              Parcourir
            </Button>
          </div>
        </div>

        {/* Nom du dossier */}
        <div className="space-y-2">
          <Label htmlFor="dossierName" className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            Nom du dossier
          </Label>
          <Input
            id="dossierName"
            value={dossierName}
            onChange={(e) => setDossierName(e.target.value)}
            placeholder="Ex: GUY_HOQUET_RENNES"
          />
          <p className="text-xs text-slate-500">
            Sera utilisé dans le nom des fichiers générés
          </p>
        </div>

        {/* Numéro de BAT */}
        <div className="space-y-2">
          <Label htmlFor="batNumber" className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-slate-500" />
            Numéro de BAT
          </Label>
          <Input
            id="batNumber"
            value={batNumber}
            onChange={(e) => setBatNumber(e.target.value)}
            placeholder="Ex: 1, 2, 3..."
            className="w-32"
          />
        </div>
      </Card>

      {/* Aperçu des noms de fichiers */}
      {isFormValid && (
        <Card className="p-4 bg-slate-50">
          <h4 className="font-medium mb-3">Aperçu des fichiers qui seront générés</h4>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">📄</span>
              <span className="text-slate-700">
                LETTRES_BOITIERS_TRANCHES_{dossierName}_N{batNumber}.pdf
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">📄</span>
              <span className="text-slate-700">
                LETTRES_BOITIERS_SEMELLES_-1.5mm_{dossierName}_N{batNumber}.pdf
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">📄</span>
              <span className="text-slate-700">
                LETTRES_BOITIERS_PLEXI_+3.2-0.8mm_{dossierName}_N{batNumber}.pdf
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Bouton générer */}
      <Button
        onClick={handleGenerate}
        disabled={isProcessing || !isFormValid}
        className="w-full py-6 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
            Génération en cours...
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-5 w-5" />
            Générer les 3 fichiers
          </>
        )}
      </Button>

      {/* Ce que fait l'automatisation */}
      <Card className="p-4 bg-slate-50">
        <h4 className="font-medium mb-4">Ce que fait l'automatisation</h4>
        <div className="space-y-4">
          {/* Fichier Tranches */}
          <div>
            <h5 className="font-medium text-sm text-slate-700 mb-2">📦 Fichier TRANCHES</h5>
            <div className="pl-4 space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Copie du fichier source (tracés uniquement)</span>
              </div>
            </div>
          </div>

          {/* Fichier Semelles */}
          <div>
            <h5 className="font-medium text-sm text-slate-700 mb-2">🔩 Fichier SEMELLES (-1.5mm)</h5>
            <div className="pl-4 space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Ajout des aérations (groupes de 5 ronds) dans le tiers supérieur</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Ajout des évacuations (trous 4mm) en bas des lettres</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>2 aérations si lettre &gt; 100mm, sinon 1 aération</span>
              </div>
            </div>
          </div>

          {/* Fichier Plexi */}
          <div>
            <h5 className="font-medium text-sm text-slate-700 mb-2">✨ Fichier PLEXI (+3.2-0.8mm)</h5>
            <div className="pl-4 space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Copie du fichier source (tracés uniquement)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions manuelles */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <h5 className="font-medium mb-3 text-amber-700">⚠️ Vérifications recommandées</h5>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-amber-500">•</span>
              <span>Contrôler le positionnement des aérations (ajuster si nécessaire)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-500">•</span>
              <span>Vérifier que les évacuations sont bien en bas des lettres</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
