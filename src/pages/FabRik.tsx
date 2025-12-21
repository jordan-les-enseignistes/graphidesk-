import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings, Box, Layers, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

import { CaissonSimpleForm } from "@/components/fabrik/CaissonSimpleForm";
import { CaissonMultiForm } from "@/components/fabrik/CaissonMultiForm";
import { CaissonDoubleForm } from "@/components/fabrik/CaissonDoubleForm";
import { AdhesifForm } from "@/components/fabrik/AdhesifForm";
import { IllustratorSettings } from "@/components/fabrik/IllustratorSettings";

import type {
  FabType,
  CaissonType,
  CaissonSimpleParams,
  CaissonMultiParams,
  CaissonDoubleParams,
} from "@/components/fabrik/types";
import { DEFAULT_ILLUSTRATOR_PATH } from "@/components/fabrik/types";

// Clé localStorage pour le chemin Illustrator
const ILLUSTRATOR_PATH_KEY = "fabrik_illustrator_path";

export default function FabRik() {
  const [fabType, setFabType] = useState<FabType>("");
  const [caissonType, setCaissonType] = useState<CaissonType>("simple");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings Illustrator
  const [illustratorPath, setIllustratorPath] = useState(DEFAULT_ILLUSTRATOR_PATH);
  const [isIllustratorValid, setIsIllustratorValid] = useState<boolean | null>(null);

  // Charger le chemin Illustrator depuis localStorage
  useEffect(() => {
    const savedPath = localStorage.getItem(ILLUSTRATOR_PATH_KEY);
    if (savedPath) {
      setIllustratorPath(savedPath);
    }
  }, []);

  // Sauvegarder le chemin quand il change
  useEffect(() => {
    localStorage.setItem(ILLUSTRATOR_PATH_KEY, illustratorPath);
  }, [illustratorPath]);

  // Vérifier si Illustrator existe
  const checkIllustrator = async () => {
    try {
      const exists = await invoke<boolean>("check_illustrator_exists", { path: illustratorPath });
      setIsIllustratorValid(exists);
      if (exists) {
        toast.success("Illustrator trouvé !");
      } else {
        toast.error("Illustrator non trouvé à cet emplacement");
      }
    } catch (error) {
      setIsIllustratorValid(false);
      toast.error("Erreur lors de la vérification");
    }
  };

  // Exécuter un script Illustrator
  const runScript = async (scriptName: string, params: object) => {
    setIsProcessing(true);

    try {
      await invoke<string>("run_illustrator_script", {
        illustratorPath,
        scriptName,
        params: JSON.stringify(params),
      });

      toast.success("Script exécuté avec succès !");
    } catch (error) {
      const errorMsg = String(error);
      toast.error(`Erreur : ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handlers pour chaque type
  const handleAdhesifGenerate = () => {
    runScript("full_automation.jsx", {});
  };

  const handleCaissonSimpleGenerate = (params: CaissonSimpleParams) => {
    runScript("caisson_generation.jsx", params);
  };

  const handleCaissonMultiGenerate = (params: CaissonMultiParams) => {
    runScript("caisson_multi_generation.jsx", params);
  };

  const handleCaissonDoubleGenerate = (params: CaissonDoubleParams) => {
    runScript("caisson_double_generation.jsx", params);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            FabRik
          </h1>
          <p className="text-slate-600 mt-1">
            Génération automatique de fichiers de fabrication
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowSettings(!showSettings)}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Configuration
          {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Settings */}
      {showSettings && (
        <IllustratorSettings
          path={illustratorPath}
          onPathChange={setIllustratorPath}
          onValidate={checkIllustrator}
          isValid={isIllustratorValid}
        />
      )}

      {/* Sélection du type de fab */}
      <Card className="p-4">
        <h3 className="font-medium mb-4">Type de fichier à générer</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFabType("adhesif")}
            className={`p-6 rounded-xl border-2 transition-all text-left ${
              fabType === "adhesif"
                ? "border-cyan-500 bg-cyan-50 shadow-lg"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">🎨</div>
              <div>
                <div className="font-semibold text-lg">Adhésif</div>
                <div className="text-sm text-slate-500">
                  Automatisation pour découpe vinyle
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setFabType("caisson")}
            className={`p-6 rounded-xl border-2 transition-all text-left ${
              fabType === "caisson"
                ? "border-indigo-500 bg-indigo-50 shadow-lg"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">📦</div>
              <div>
                <div className="font-semibold text-lg">Caisson</div>
                <div className="text-sm text-slate-500">
                  Génération de caissons aluminium
                </div>
              </div>
            </div>
          </button>
        </div>
      </Card>

      {/* Contenu selon le type */}
      {fabType === "adhesif" && (
        <AdhesifForm onGenerate={handleAdhesifGenerate} isProcessing={isProcessing} />
      )}

      {fabType === "caisson" && (
        <div className="space-y-6">
          {/* Sélection type de caisson */}
          <Card className="p-4">
            <h3 className="font-medium mb-4">Type de caisson</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setCaissonType("simple")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  caissonType === "simple"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Box className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="font-medium text-sm">Simple</div>
                <div className="text-xs text-slate-500">Caisson rectangulaire</div>
              </button>
              <button
                type="button"
                onClick={() => setCaissonType("multi")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  caissonType === "multi"
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Layers className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="font-medium text-sm">Multi-parties</div>
                <div className="text-xs text-slate-500">2 à 5 parties</div>
              </button>
              <button
                type="button"
                onClick={() => setCaissonType("double")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  caissonType === "double"
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <RotateCcw className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                <div className="font-medium text-sm">Double face</div>
                <div className="text-xs text-slate-500">Enseigne drapeau</div>
              </button>
            </div>
          </Card>

          {/* Formulaire selon le type de caisson */}
          {caissonType === "simple" && (
            <CaissonSimpleForm
              onGenerate={handleCaissonSimpleGenerate}
              isProcessing={isProcessing}
            />
          )}
          {caissonType === "multi" && (
            <CaissonMultiForm
              onGenerate={handleCaissonMultiGenerate}
              isProcessing={isProcessing}
            />
          )}
          {caissonType === "double" && (
            <CaissonDoubleForm
              onGenerate={handleCaissonDoubleGenerate}
              isProcessing={isProcessing}
            />
          )}
        </div>
      )}

      {/* Placeholder si rien sélectionné */}
      {fabType === "" && (
        <Card className="p-12 text-center border-2 border-dashed">
          <div className="text-6xl mb-4">🛠️</div>
          <h3 className="text-xl font-medium text-slate-700 mb-2">
            Sélectionnez un type de fabrication
          </h3>
          <p className="text-slate-500">
            Choisissez "Adhésif" pour l'automatisation vinyle ou "Caisson" pour générer des caissons aluminium.
          </p>
        </Card>
      )}
    </div>
  );
}
