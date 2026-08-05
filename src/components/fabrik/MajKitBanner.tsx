// Bandeau de mise à jour du Kit. Reprend la DA des encarts du logiciel :
// carte arrondie, filet de couleur à gauche, icône dans une pastille teintée,
// même palette sky que la pastille de la barre latérale — pour qu'on relie
// immédiatement les deux.
import { ArrowUpCircle } from "lucide-react";
import { useMajKit } from "@/hooks/useMajKit";

export function MajKitBanner() {
  const { nombre, noms } = useMajKit();
  if (!nombre) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-sky-200 dark:border-sky-900/60 border-l-4 border-l-sky-500 bg-sky-50 dark:bg-sky-950/40 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15">
        <ArrowUpCircle className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
          {nombre === 1
            ? "Une ressource a été mise à jour"
            : `${nombre} ressources ont été mises à jour`}
        </p>
        <p className="text-xs text-sky-800/80 dark:text-sky-300/80 mt-0.5">
          {noms.join(" · ")} — la version de ton poste n'est plus la bonne. Clique sur
          «&nbsp;Mettre à jour&nbsp;» pour récupérer la dernière.
        </p>
      </div>
    </div>
  );
}
