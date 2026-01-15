import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, AlertCircle, FolderOpen, FileText, Hash, Ruler, Palette } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { LettresBoitiersParams, TrancheFinition } from "./types";

interface LettresBoitiersFormProps {
  onGenerate: (params: LettresBoitiersParams) => void;
  isProcessing: boolean;
}

export function LettresBoitiersForm({ onGenerate, isProcessing }: LettresBoitiersFormProps) {
  const [destinationPath, setDestinationPath] = useState("");
  const [dossierName, setDossierName] = useState("");
  const [batNumber, setBatNumber] = useState("");
  // Options tranches
  const [trancheEpaisseur, setTrancheEpaisseur] = useState("");
  const [trancheRal, setTrancheRal] = useState("");
  const [trancheFinition, setTrancheFinition] = useState<TrancheFinition>("");

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
      trancheEpaisseur: trancheEpaisseur || undefined,
      trancheRal: trancheRal || undefined,
      trancheFinition: trancheFinition || undefined,
    });
  };

  // Construit le nom de fichier TRANCHES avec les options
  const buildTrancheFileName = () => {
    let name = "LETTRES_BOITIERS_TRANCHES";
    if (trancheEpaisseur) {
      name += `_${trancheEpaisseur}MM`;
    }
    if (trancheRal) {
      name += `_RAL_${trancheRal}`;
      if (trancheFinition) {
        name += `_${trancheFinition}`;
      }
    }
    name += `_${dossierName}_N${batNumber}.pdf`;
    return name;
  };

  const isFormValid = destinationPath && dossierName && batNumber;

  return (
    <div className="space-y-6">
      {/* Prérequis */}
      <Card className="p-4">
        <h4 className="font-medium mb-4 flex items-center gap-2 dark:text-slate-200">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Prérequis avant de lancer
        </h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3 text-sm dark:text-slate-300">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
              1
            </div>
            <p><strong>Adobe Illustrator</strong> doit être ouvert avec votre fichier PDF de lettres</p>
          </div>
          <div className="flex items-start gap-3 text-sm dark:text-slate-300">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
              2
            </div>
            <p>Le fichier doit contenir les <strong>tracés vectoriels fermés</strong> des lettres (contours uniquement)</p>
          </div>
          <div className="flex items-start gap-3 text-sm dark:text-slate-300">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
              3
            </div>
            <p>Assurez-vous que le document est <strong>bien visible</strong> (pas en arrière-plan)</p>
          </div>
        </div>
      </Card>

      {/* Formulaire */}
      <Card className="p-4 space-y-4">
        <h4 className="font-medium dark:text-slate-200">Paramètres de génération</h4>

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

        {/* Séparateur Options Tranches */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
          <h5 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            📦 Options spécifiques aux TRANCHES
            <span className="text-xs text-slate-400 font-normal">(optionnel)</span>
          </h5>

          <div className="grid grid-cols-3 gap-4">
            {/* Épaisseur */}
            <div className="space-y-2">
              <Label htmlFor="trancheEpaisseur" className="flex items-center gap-2 text-sm">
                <Ruler className="h-4 w-4 text-slate-500" />
                Épaisseur (mm)
              </Label>
              <Input
                id="trancheEpaisseur"
                value={trancheEpaisseur}
                onChange={(e) => setTrancheEpaisseur(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 100"
                className="w-full"
              />
            </div>

            {/* RAL */}
            <div className="space-y-2">
              <Label htmlFor="trancheRal" className="flex items-center gap-2 text-sm">
                <Palette className="h-4 w-4 text-slate-500" />
                Code RAL
              </Label>
              <Input
                id="trancheRal"
                value={trancheRal}
                onChange={(e) => setTrancheRal(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 8019"
                className="w-full"
              />
            </div>

            {/* Finition */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                Finition
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTrancheFinition(trancheFinition === "MAT" ? "" : "MAT")}
                  disabled={!trancheRal}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    trancheFinition === "MAT"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  } ${!trancheRal ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Mat
                </button>
                <button
                  type="button"
                  onClick={() => setTrancheFinition(trancheFinition === "BRILLANT" ? "" : "BRILLANT")}
                  disabled={!trancheRal}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    trancheFinition === "BRILLANT"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  } ${!trancheRal ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Brillant
                </button>
              </div>
              {!trancheRal && (
                <p className="text-xs text-slate-400">Renseigner un RAL pour activer</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Aperçu des noms de fichiers */}
      {isFormValid && (
        <Card className="p-4 bg-slate-50 dark:bg-slate-800">
          <h4 className="font-medium mb-3 dark:text-slate-200">Aperçu des fichiers qui seront générés</h4>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">📄</span>
              <span className="text-slate-700 dark:text-slate-300">
                {buildTrancheFileName()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">📄</span>
              <span className="text-slate-700 dark:text-slate-300">
                LETTRES_BOITIERS_SEMELLES_-1.5mm_{dossierName}_N{batNumber}.pdf
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">📄</span>
              <span className="text-slate-700 dark:text-slate-300">
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
      <Card className="p-4 bg-slate-50 dark:bg-slate-800">
        <h4 className="font-medium mb-4 dark:text-slate-200">Ce que fait l'automatisation</h4>
        <div className="space-y-4">
          {/* Fichier Tranches */}
          <div>
            <h5 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-2">📦 Fichier TRANCHES</h5>
            <div className="pl-4 space-y-1 text-sm dark:text-slate-400">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Copie du fichier source (tracés uniquement)</span>
              </div>
            </div>
          </div>

          {/* Fichier Semelles */}
          <div>
            <h5 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-2">🔩 Fichier SEMELLES (-1.5mm)</h5>
            <div className="pl-4 space-y-1 text-sm dark:text-slate-400">
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
            <h5 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-2">✨ Fichier PLEXI (+3.2-0.8mm)</h5>
            <div className="pl-4 space-y-1 text-sm dark:text-slate-400">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Copie du fichier source (tracés uniquement)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions manuelles */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <h5 className="font-medium mb-3 text-amber-700 dark:text-amber-500">⚠️ Vérifications recommandées</h5>
          <div className="space-y-2 text-sm dark:text-slate-400">
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
