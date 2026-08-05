// Kit du nouvel arrivant : tout ce qu'un graphiste doit avoir sur son poste,
// installé depuis GraphiDesk au lieu d'être copié à la main depuis un dossier
// réseau où personne ne sait plus quelle copie fait foi.
import { HardDriveDownload } from "lucide-react";
import { AtelierRessourcesCard } from "@/components/fabrik/AtelierRessourcesCard";
import { MajKitBanner } from "@/components/fabrik/MajKitBanner";
import { IndesignPluginCard } from "@/measure/components/IndesignPluginCard";

export default function Ressources() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-slate-100">
          <HardDriveDownload className="h-6 w-6 text-blue-500" />
          Kit du graphiste
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nuanciers, gabarits, scripts et arborescence de dossier — installés au bon endroit sur
          ce poste, en un clic.
        </p>
      </div>

      <MajKitBanner />

      <AtelierRessourcesCard />

      {/* Le plugin InDesign suit son propre canal (il voyage avec la version de
          GraphiDesk), mais sa place est ici : c'est la même étape d'équipement. */}
      <div className="max-w-md">
        <IndesignPluginCard />
      </div>
    </div>
  );
}
