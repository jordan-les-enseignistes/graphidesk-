import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Circle, Factory } from "lucide-react";

export interface OeilletsParams {
  /** échelle de la maquette (10 = 1:10) */
  echelle: number;
  /** distance centre œillet → bords (mm réels) */
  margeMm: number;
  /** entraxe nominal entre œillets (mm réels) */
  pasMm: number;
  /** entraxe maxi toléré (permet d'économiser un œillet) */
  pasMaxMm: number;
  /** diamètre œillet sur la maquette (mm réels) */
  diamMaquetteMm: number;
  /** diamètre du marqueur sur le fichier de FAB (mm réels) */
  diamFabMm: number;
}

interface Props {
  onMaquette: (params: OeilletsParams) => void;
  onFab: (params: OeilletsParams) => void;
  isProcessing: boolean;
}

/**
 * Outil bâche & œillets :
 *   1. MAQUETTE — pose les œillets (Ø25 réel) sur le fichier 1:10 ouvert,
 *      aux 4 coins (25/25 des bords) + équidistants, entraxe ≤ pas maxi.
 *   2. FAB — passe le fichier ouvert à l'échelle 1:1 et remplace chaque
 *      œillet (depuis son centre) par un marqueur Ø5 contrasté avec croix.
 */
export function OeilletsBacheForm({ onMaquette, onFab, isProcessing }: Props) {
  const [margeMm, setMargeMm] = useState(25);
  const [pasMm, setPasMm] = useState(500);
  const [pasMaxMm, setPasMaxMm] = useState(520);
  const [diamMaquetteMm, setDiamMaquetteMm] = useState(25);
  const [diamFabMm, setDiamFabMm] = useState(5);

  const params = (): OeilletsParams => ({
    echelle: 10,
    margeMm,
    pasMm,
    pasMaxMm,
    diamMaquetteMm,
    diamFabMm,
  });

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-lg dark:text-slate-200">Bâche & œillets</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Dans Illustrator, <strong>sélectionne le rectangle de ta bâche</strong> (maquette à 1:10)
          puis clique — sans sélection, le plan de travail actif fait foi.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <Label htmlFor="oe-marge" className="text-xs">Marge bords (mm)</Label>
          <Input
            id="oe-marge" type="number" min="5" className="h-9"
            value={margeMm}
            onChange={(e) => setMargeMm(parseFloat(e.target.value) || 25)}
          />
        </div>
        <div>
          <Label htmlFor="oe-pas" className="text-xs">Entraxe nominal (mm)</Label>
          <Input
            id="oe-pas" type="number" min="100" className="h-9"
            value={pasMm}
            onChange={(e) => setPasMm(parseFloat(e.target.value) || 500)}
          />
        </div>
        <div>
          <Label htmlFor="oe-pasmax" className="text-xs">Entraxe maxi (mm)</Label>
          <Input
            id="oe-pasmax" type="number" min="100" className="h-9"
            value={pasMaxMm}
            onChange={(e) => setPasMaxMm(parseFloat(e.target.value) || 520)}
          />
        </div>
        <div>
          <Label htmlFor="oe-diam" className="text-xs">Ø œillet maquette (mm)</Label>
          <Input
            id="oe-diam" type="number" min="5" className="h-9"
            value={diamMaquetteMm}
            onChange={(e) => setDiamMaquetteMm(parseFloat(e.target.value) || 25)}
          />
        </div>
        <div>
          <Label htmlFor="oe-diamfab" className="text-xs">Ø marqueur FAB (mm)</Label>
          <Input
            id="oe-diamfab" type="number" min="2" className="h-9"
            value={diamFabMm}
            onChange={(e) => setDiamFabMm(parseFloat(e.target.value) || 5)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          disabled={isProcessing}
          onClick={() => onMaquette(params())}
          className="gap-2 bg-cyan-600 hover:bg-cyan-700 h-11"
        >
          <Circle className="h-4 w-4" />
          1. Poser les œillets (maquette 1:10)
        </Button>
        <Button
          disabled={isProcessing}
          onClick={() => onFab(params())}
          className="gap-2 bg-slate-700 hover:bg-slate-800 h-11"
        >
          <Factory className="h-4 w-4" />
          2. Préparer le fichier de FAB (1:1)
        </Button>
      </div>

      <div className="rounded bg-slate-50 dark:bg-slate-800/60 p-3 text-[11px] text-gray-500 dark:text-slate-400 space-y-1">
        <p>
          <strong>1. Maquette</strong> : œillets aux 4 coins ({margeMm}/{margeMm} mm des bords) puis
          équidistants, entraxe ≤ {pasMaxMm} mm — posés sur un calque « OEILLETS ».
        </p>
        <p>
          <strong>2. FAB</strong> : sur le fichier maquette ouvert (avec ses œillets) — passage à
          l'échelle 1:1, plan de travail adapté, chaque œillet remplacé depuis son centre par un
          marqueur Ø{diamFabMm} mm : blanc sur fond sombre / noir sur fond clair (détection
          automatique), croix de centrage + liseré en couleur opposée.
        </p>
      </div>
    </Card>
  );
}
