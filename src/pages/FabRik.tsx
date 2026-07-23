import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Settings,
  Box,
  Layers,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  IconAdhesif,
  IconCaisson,
  IconLettresBoitiers,
  IconLettresRelief,
  IconBache,
  IconNeonFlex,
} from "@/components/fabrik/FabIcons";
import { NeonFlexForm, type NeonFlexParams } from "@/components/fabrik/NeonFlexForm";

import { CaissonSimpleForm } from "@/components/fabrik/CaissonSimpleForm";
import { CaissonMultiForm } from "@/components/fabrik/CaissonMultiForm";
import { CaissonDoubleForm } from "@/components/fabrik/CaissonDoubleForm";
import { AdhesifForm, type AdhesifParams } from "@/components/fabrik/AdhesifForm";
import { LettresBoitiersForm } from "@/components/fabrik/LettresBoitiersForm";
import { LettresReliefForm } from "@/components/fabrik/LettresReliefForm";
import {
  OeilletsBacheForm,
  type OeilletsParams,
  type BacheCreationParams,
} from "@/components/fabrik/OeilletsBacheForm";
import { IllustratorSettings } from "@/components/fabrik/IllustratorSettings";

import type {
  FabType,
  CaissonType,
  CaissonSimpleParams,
  CaissonMultiParams,
  CaissonDoubleParams,
  LettresBoitiersParams,
  LettresReliefParams,
} from "@/components/fabrik/types";
import { DEFAULT_ILLUSTRATOR_PATH } from "@/components/fabrik/types";

// Clé localStorage pour le chemin Illustrator
const ILLUSTRATOR_PATH_KEY = "fabrik_illustrator_path";

// Catalogue des outils FabRik, groupé par catégorie métier.
// Ajouter un outil = une entrée ici (l'UI suit toute seule).
interface FabTool {
  id: FabType;
  icon: (props: { className?: string }) => React.ReactElement;
  color: string;
  label: string;
  desc: string;
  activeCls: string;
}
const FAB_CATEGORIES: Array<{ nom: string; tools: FabTool[] }> = [
  {
    nom: "Adhésif",
    tools: [
      {
        id: "adhesif",
        icon: IconAdhesif,
        color: "text-cyan-500",
        label: "Adhésif",
        desc: "Découpe vinyle",
        activeCls: "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30",
      },
    ],
  },
  {
    nom: "Enseignes",
    tools: [
      {
        id: "caisson",
        icon: IconCaisson,
        color: "text-indigo-500",
        label: "Caisson",
        desc: "Caissons aluminium",
        activeCls: "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30",
      },
      {
        id: "lettres-boitiers",
        icon: IconLettresBoitiers,
        color: "text-emerald-500",
        label: "Lettres Boîtiers",
        desc: "Tranches, semelles, plexi",
        activeCls: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30",
      },
      {
        id: "lettres-relief",
        icon: IconLettresRelief,
        color: "text-orange-500",
        label: "Lettres Relief",
        desc: "PVC rétroéclairé sur entretoises",
        activeCls: "border-orange-500 bg-orange-50 dark:bg-orange-900/30",
      },
      {
        id: "neon",
        icon: IconNeonFlex,
        color: "text-pink-500",
        label: "Néon Flex",
        desc: "Texte → maquette néon",
        activeCls: "border-pink-500 bg-pink-50 dark:bg-pink-900/30",
      },
    ],
  },
  {
    nom: "Autres",
    tools: [
      {
        id: "bache",
        icon: IconBache,
        color: "text-teal-500",
        label: "Bâche & œillets",
        desc: "Maquette 1:10 + FAB",
        activeCls: "border-teal-500 bg-teal-50 dark:bg-teal-900/30",
      },
    ],
  },
];

// état replié du panneau d'outils, mémorisé par poste
const FAB_NAV_COLLAPSED_KEY = "fabrik_nav_collapsed";

export default function FabRik() {
  const [fabType, setFabType] = useState<FabType>("");
  const [caissonType, setCaissonType] = useState<CaissonType>("simple");
  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem(FAB_NAV_COLLAPSED_KEY) === "1"
  );
  const toggleNav = () => {
    setNavCollapsed((c) => {
      localStorage.setItem(FAB_NAV_COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  };
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
      // le script Illustrator retourne son compte-rendu (via le pont CEP)
      const retour = await invoke<string>("run_illustrator_script", {
        illustratorPath,
        scriptName,
        params: JSON.stringify(params),
      });

      toast.success(retour?.trim() || "Script exécuté avec succès !", { duration: 6000 });
    } catch (error) {
      const errorMsg = String(error);
      toast.error(errorMsg, { duration: 8000 });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handlers pour chaque type
  const handleAdhesifGenerate = (params: AdhesifParams) => {
    runScript("full_automation.jsx", params);
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

  const handleLettresBoitiersGenerate = (params: LettresBoitiersParams) => {
    runScript("lettres_boitiers.jsx", params);
  };

  const handleLettresReliefGenerate = (params: LettresReliefParams) => {
    runScript("entretoises_automation.jsx", params);
  };

  const handleBacheCreation = (params: BacheCreationParams) => {
    runScript("bache_creation.jsx", params);
  };

  const handleOeilletsMaquette = (params: OeilletsParams) => {
    runScript("oeillets_maquette.jsx", params);
  };

  const handleOeilletsFab = (params: OeilletsParams) => {
    runScript("oeillets_fab.jsx", params);
  };

  const handleNeonGenerate = (params: NeonFlexParams) => {
    // contour = texte/logo vectorisé ; simple = la sélection EST le tracé
    // (lignes à la plume ou police monoligne) — le script gère les deux
    runScript("neon_flex.jsx", params);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            FabRik
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
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

      {/* Navigation latérale (outils par catégorie) + formulaire à droite :
          plus aucun empilement vertical de sélecteurs */}
      <div className="flex gap-4 items-start">
        {/* Colonne outils (repliable en rail d'icônes) */}
        <Card
          className={`${navCollapsed ? "w-14" : "w-52"} shrink-0 p-2 space-y-2.5 sticky top-4 transition-all`}
        >
          <button
            type="button"
            onClick={toggleNav}
            title={navCollapsed ? "Déplier le panneau" : "Replier le panneau"}
            className={`w-full flex items-center ${navCollapsed ? "justify-center" : "justify-end"} text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 py-0.5`}
          >
            {navCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
          {FAB_CATEGORIES.map((cat) => (
            <div key={cat.nom}>
              {navCollapsed ? (
                <div className="mx-1.5 mb-1 border-t border-slate-200 dark:border-slate-700" />
              ) : (
                <p className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  {cat.nom}
                </p>
              )}
              <div className="space-y-0.5">
                {cat.tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setFabType(tool.id)}
                      title={`${tool.label} — ${tool.desc}`}
                      className={`w-full rounded-md border transition-all flex items-center ${
                        navCollapsed ? "justify-center px-0 py-2" : "gap-2 px-2 py-1.5 text-left"
                      } text-sm ${
                        fabType === tool.id
                          ? `${tool.activeCls} font-medium`
                          : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <Icon className={`${navCollapsed ? "h-6 w-6" : "h-5 w-5"} shrink-0 ${tool.color}`} />
                      {!navCollapsed && (
                        <span className="truncate dark:text-slate-200">{tool.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        {/* Contenu de l'outil sélectionné */}
        <div className="flex-1 min-w-0 space-y-4">
          {fabType === "adhesif" && (
            <AdhesifForm onGenerate={handleAdhesifGenerate} isProcessing={isProcessing} />
          )}

          {fabType === "bache" && (
            <OeilletsBacheForm
              onCreation={handleBacheCreation}
              onMaquette={handleOeilletsMaquette}
              onFab={handleOeilletsFab}
              isProcessing={isProcessing}
            />
          )}

          {fabType === "caisson" && (
            <div className="space-y-4">
              {/* Type de caisson : segments compacts sur une ligne */}
              <Card className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium dark:text-slate-200 mr-1">
                    Type de caisson :
                  </span>
                  <button
                    type="button"
                    onClick={() => setCaissonType("simple")}
                    className={`px-3 py-1.5 rounded-md border text-sm flex items-center gap-1.5 transition-all ${
                      caissonType === "simple"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 font-medium"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <Box className="h-4 w-4 text-blue-600" />
                    <span className="dark:text-slate-200">Simple</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaissonType("multi")}
                    className={`px-3 py-1.5 rounded-md border text-sm flex items-center gap-1.5 transition-all ${
                      caissonType === "multi"
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 font-medium"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <Layers className="h-4 w-4 text-purple-600" />
                    <span className="dark:text-slate-200">Multi-parties</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaissonType("double")}
                    className={`px-3 py-1.5 rounded-md border text-sm flex items-center gap-1.5 transition-all ${
                      caissonType === "double"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 font-medium"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                    <span className="dark:text-slate-200">Double face (drapeau)</span>
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

          {fabType === "lettres-boitiers" && (
            <LettresBoitiersForm
              onGenerate={handleLettresBoitiersGenerate}
              isProcessing={isProcessing}
            />
          )}

          {fabType === "lettres-relief" && (
            <LettresReliefForm
              onGenerate={handleLettresReliefGenerate}
              isProcessing={isProcessing}
            />
          )}

          {fabType === "neon" && (
            <NeonFlexForm onGenerate={handleNeonGenerate} isProcessing={isProcessing} />
          )}

          {fabType === "" && (
            <Card className="p-12 text-center border-2 border-dashed">
              <div className="text-5xl mb-3">🛠️</div>
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
                Choisis un outil dans la colonne de gauche
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Le formulaire de l'outil s'affichera ici, sans scroll inutile.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
