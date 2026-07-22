import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Circle, Factory, FilePlus2 } from "lucide-react";

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

/** Création directe du fichier bâche : dimensions réelles + réglages œillets */
export interface BacheCreationParams extends OeilletsParams {
  largeurMm: number;
  hauteurMm: number;
  /** génère les cotes fléchées (calque COTES — exclu du fichier de FAB) */
  avecCotes: boolean;
}

interface Props {
  onCreation: (params: BacheCreationParams) => void;
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
export function OeilletsBacheForm({ onCreation, onMaquette, onFab, isProcessing }: Props) {
  const [largeurMm, setLargeurMm] = useState(0);
  const [hauteurMm, setHauteurMm] = useState(0);
  const [avecCotes, setAvecCotes] = useState(true);
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
          Crée le fichier directement depuis les dimensions, ou pose les œillets sur une
          maquette 1:10 déjà ouverte dans Illustrator.
        </p>
      </div>

      {/* Création directe : dimensions réelles → fichier prêt à l'emploi */}
      <div className="rounded-lg border border-cyan-300 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-900/10 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="ba-largeur" className="text-xs">Largeur réelle (mm)</Label>
            <Input
              id="ba-largeur" type="number" min="100" step="10" className="h-9 w-36"
              placeholder="ex: 3000"
              value={largeurMm || ""}
              onChange={(e) => setLargeurMm(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="ba-hauteur" className="text-xs">Hauteur réelle (mm)</Label>
            <Input
              id="ba-hauteur" type="number" min="100" step="10" className="h-9 w-36"
              placeholder="ex: 1500"
              value={hauteurMm || ""}
              onChange={(e) => setHauteurMm(parseFloat(e.target.value) || 0)}
            />
          </div>
          <button
            type="button"
            onClick={() => setAvecCotes(!avecCotes)}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-md border text-xs font-medium transition-colors ${
              avecCotes
                ? "bg-teal-600 border-teal-600 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
            title="Cotes fléchées (valeurs réelles) sur un calque COTES — automatiquement exclu du fichier de FAB"
          >
            {avecCotes && <Check className="h-3.5 w-3.5" />}
            Avec dimensions
          </button>
          <Button
            disabled={isProcessing || largeurMm <= 0 || hauteurMm <= 0}
            onClick={() => onCreation({ ...params(), largeurMm, hauteurMm, avecCotes })}
            className="gap-2 bg-cyan-600 hover:bg-cyan-700 h-9"
          >
            <FilePlus2 className="h-4 w-4" />
            Créer le fichier bâche (1:10)
          </Button>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Crée un document en <strong>mm</strong> avec deux calques : <strong>OEILLETS</strong>{" "}
          (dessus, déjà posés) et <strong>VISUEL</strong> (dessous, avec le rectangle de la bâche)
          — dépose ta créa dans VISUEL puis passe directement à l'étape 2.
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
          <strong>2. FAB</strong> : crée un <strong>nouveau document à l'échelle 1:1</strong>, plan de
          travail aux dimensions exactes de la bâche <strong>quelle que soit sa taille</strong> — la
          maquette d'origine n'est jamais modifiée. Chaque œillet devient un marqueur Ø{diamFabMm} mm
          : blanc sur fond sombre / noir sur fond clair (détection auto), croix de centrage + liseré
          opposé.
        </p>
      </div>

      <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
        <p className="font-semibold">⚙️ Mise en place UNIQUE par poste (bâches de plus de 5,7 m)</p>
        <p>
          Illustrator a besoin d'un gabarit « grand canevas » que son API ne sait pas créer seule.
          Une fois pour toutes :
        </p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>
            Illustrator → <strong>Fichier → Nouveau</strong> : unités <strong>mm</strong>, largeur{" "}
            <strong>7000</strong>, hauteur <strong>7000</strong> → Créer (le grand canevas s'active
            tout seul)
          </li>
          <li>
            Sans rien dessiner : <strong>Enregistrer sous</strong> →{" "}
            <code>Documents\GraphiDesk\templates\grand_canevas.ai</code>
          </li>
          <li>Fermer. C'est tout — le bouton FAB l'utilisera automatiquement (via une copie : le gabarit reste vide).</li>
        </ol>
        <p>Sans ce gabarit, le bouton FAB te réaffichera ces instructions au moment voulu.</p>
      </div>
    </Card>
  );
}
