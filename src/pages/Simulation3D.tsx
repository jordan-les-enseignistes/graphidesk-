import { Box } from "lucide-react";
import { Relief3dStudio } from "@/components/fabrik/Relief3dStudio";

/**
 * Module autonome de simulation 3D pour les BAT.
 * Part d'une sélection Illustrator (aucun enregistrement, le fichier CMJN
 * du graphiste n'est jamais modifié) et rend l'enseigne posée : fixation,
 * éclairage et couleurs se règlent à côté de la vue.
 */
export default function Simulation3D() {
  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
          <Box className="h-5 w-5 text-violet-600 dark:text-violet-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Simulation 3D
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Rendu de l'enseigne posée pour le BAT — lettres relief, fixation et
            éclairage, depuis ta sélection Illustrator
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Relief3dStudio />
      </div>
    </div>
  );
}
