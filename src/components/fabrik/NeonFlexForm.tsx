import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Bookmark, Check } from "lucide-react";

export interface NeonFlexParams {
  couleur: { r: number; g: number; b: number };
  tubeMm: number;
  coeurMm: number;
  lueur: boolean;
  plaque: boolean;
  fixations: boolean;
  padPlaquePct: number;
  /** cote finale de la PLAQUE en mm réels — renseigner l'une OU l'autre */
  largeurReelleMm: number | null;
  hauteurReelleMm: number | null;
  echelle: number;
  /** "contour" = double trait suivant les lettres ; "simple" = mono-trait
   *  (la sélection EST le tracé, dessiné à la plume / police single-line) */
  trace: "contour" | "simple";
  cotes: boolean;
  /** néon deux couleurs : couleur des éléments de la 2e sélection */
  couleur2: { r: number; g: number; b: number } | null;
  /** "memoriser" : marque la sélection courante comme couleur `numero`, sans rien générer */
  etape?: "memoriser";
  numero?: 1 | 2;
}

interface Props {
  /** renvoie vrai si le script s'est exécuté */
  onGenerate: (params: NeonFlexParams) => Promise<boolean>;
  /** mémorise la sélection Illustrator comme couleur n ; renvoie le nombre
   *  d'éléments mémorisés, ou null si Illustrator n'a pas répondu */
  onMemoriser: (params: NeonFlexParams, numero: 1 | 2) => Promise<number | null>;
  isProcessing: boolean;
}

// Teintes néon classiques (couleur du "gaz" — le tube pastel et la lueur
// en sont déclinés automatiquement par le script)
const PRESETS: Array<{ nom: string; hex: string }> = [
  { nom: "Rose", hex: "#FF3EB5" },
  { nom: "Rouge", hex: "#FF3C3C" },
  { nom: "Orange", hex: "#FF8C28" },
  { nom: "Jaune", hex: "#FFC93C" },
  { nom: "Vert", hex: "#3CFF96" },
  { nom: "Bleu", hex: "#3CB4FF" },
  { nom: "Violet", hex: "#B26BFF" },
  { nom: "Blanc chaud", hex: "#FFDCA0" },
  { nom: "Blanc froid", hex: "#E6F0FF" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Pastilles de couleur néon + couleur libre */
function ChoixCouleur({ hex, onChange }: { hex: string; onChange: (hex: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map((p) => (
        <button
          key={p.hex}
          type="button"
          title={p.nom}
          onClick={() => onChange(p.hex)}
          className={`h-9 w-9 rounded-full border-2 transition-all ${
            hex === p.hex
              ? "border-slate-900 dark:border-white scale-110 shadow"
              : "border-slate-200 dark:border-slate-600 hover:scale-105"
          }`}
          style={{ backgroundColor: p.hex }}
        />
      ))}
      <label
        className="h-9 px-2 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center gap-1.5 cursor-pointer text-xs text-slate-500 dark:text-slate-400 hover:border-slate-400"
        title="Couleur personnalisée"
      >
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 rounded cursor-pointer border-0 bg-transparent p-0"
        />
        libre
      </label>
      <span className="ml-1 text-xs font-mono text-slate-500 dark:text-slate-400">
        {hex.toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Néon Flex : transforme le texte/logo sélectionné dans Illustrator en
 * maquette néon (tube pastel + cœur blanc + lueur + plaque + fixations),
 * construite SOUS l'original, selon la recette maison.
 */
export function NeonFlexForm({ onGenerate, onMemoriser, isProcessing }: Props) {
  const [hex, setHex] = useState("#FF3EB5");
  const [deuxCouleurs, setDeuxCouleurs] = useState(false);
  const [hex2, setHex2] = useState("#3CB4FF");
  // nombre d'éléments mémorisés par couleur (null = pas encore fait)
  const [memo, setMemo] = useState<{ 1: number | null; 2: number | null }>({ 1: null, 2: null });
  const deuxPretes = (memo[1] ?? 0) > 0 && (memo[2] ?? 0) > 0;
  const [tubeMm, setTubeMm] = useState(1.06);
  const [coeurMm, setCoeurMm] = useState(0.3);
  const [padPlaquePct, setPadPlaquePct] = useState(12);
  const [lueur, setLueur] = useState(true);
  const [plaque, setPlaque] = useState(true);
  const [fixations, setFixations] = useState(true);
  const [largeurStr, setLargeurStr] = useState("");
  const [hauteurStr, setHauteurStr] = useState("");
  const [trace, setTrace] = useState<"contour" | "simple">("contour");
  const [cotes, setCotes] = useState(true);

  const parametres = (): NeonFlexParams => ({
    couleur: hexToRgb(hex),
    tubeMm,
    coeurMm,
    lueur,
    plaque,
    fixations,
    padPlaquePct,
    largeurReelleMm: parseFloat(largeurStr) > 0 ? parseFloat(largeurStr) : null,
    hauteurReelleMm: parseFloat(hauteurStr) > 0 ? parseFloat(hauteurStr) : null,
    echelle: 10,
    trace,
    cotes,
    couleur2: deuxCouleurs ? hexToRgb(hex2) : null,
  });

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-lg dark:text-slate-200">Néon Flex</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Dans Illustrator, <strong>sélectionne ton texte</strong> (ou logo vectorisé), choisis la
          couleur du néon, et clique — la maquette néon se construit sous l'original.
        </p>
      </div>

      {/* Couleur(s) du néon */}
      <div className="space-y-2">
        <Label className="text-xs">{deuxCouleurs ? "Couleur 1" : "Couleur du néon"}</Label>
        <ChoixCouleur hex={hex} onChange={setHex} />
        <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
          <input
            type="checkbox"
            checked={deuxCouleurs}
            onChange={(e) => setDeuxCouleurs(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-pink-600 focus:ring-pink-500"
          />
          Néon deux couleurs
        </label>
        {deuxCouleurs && (
          <>
            <Label className="text-xs">Couleur 2</Label>
            <ChoixCouleur hex={hex2} onChange={setHex2} />
            {/* mini tuto — un vrai flux en trois temps (Jordan, 05/10/2026) :
                chaque couleur se mémorise puis se grise, et le néon se fait
                à la fin, sans rien resélectionner */}
            <div className="rounded-md border border-pink-200 bg-pink-50 p-3 text-xs text-slate-600 dark:border-pink-900/50 dark:bg-pink-950/30 dark:text-slate-300 space-y-2">
              <p className="font-medium">En trois étapes :</p>
              {([1, 2] as const).map((n) => {
                const nb = memo[n];
                const fait = nb !== null && nb > 0;
                const accessible = n === 1 || (memo[1] ?? 0) > 0;
                const teinte = n === 1 ? hex : hex2;
                return (
                  <div
                    key={n}
                    className={`flex flex-wrap items-center gap-2 ${accessible ? "" : "opacity-50"}`}
                  >
                    <span className="font-medium">{n}.</span>
                    {fait ? (
                      <>
                        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          Couleur {n} mémorisée ({nb} élément{nb > 1 ? "s" : ""})
                        </span>
                        <button
                          type="button"
                          onClick={() => setMemo((m) => ({ ...m, [n]: null }))}
                          className="underline text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          recommencer
                        </button>
                      </>
                    ) : (
                      <>
                        <span>
                          Dans Illustrator, sélectionne <strong>les éléments de la couleur {n}</strong>,
                          puis :
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isProcessing || !accessible}
                          onClick={async () => {
                            const r = await onMemoriser(parametres(), n);
                            setMemo((m) => ({ ...m, [n]: r }));
                          }}
                          className="flex gap-2 text-white"
                          style={{ backgroundColor: teinte }}
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          Mémoriser la couleur {n}
                        </Button>
                        {nb === 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            rien n'était sélectionné dans Illustrator
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              <div className={`flex items-center gap-2 ${deuxPretes ? "" : "opacity-50"}`}>
                <span className="font-medium">3.</span>
                <span>
                  Clique <strong>« 3. Faire le Néon Flex »</strong> en bas — pas besoin de
                  resélectionner.
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Tu obtiens un seul néon : une plaque, une échelle et des cotes communes, chaque
                couleur avec son tube et sa lueur.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Style de tracé */}
      <div className="space-y-1.5">
        <Label className="text-xs">Style du néon</Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTrace("contour")}
            className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
              trace === "contour"
                ? "border-pink-500 bg-pink-50 dark:bg-pink-900/30 font-medium"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            <span className="dark:text-slate-200">Contour des lettres</span>
            <span className="block text-[10px] text-slate-400">double trait — depuis un texte</span>
          </button>
          <button
            type="button"
            onClick={() => setTrace("simple")}
            className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
              trace === "simple"
                ? "border-pink-500 bg-pink-50 dark:bg-pink-900/30 font-medium"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            <span className="dark:text-slate-200">Tracé simple (mono-trait)</span>
            <span className="block text-[10px] text-slate-400">ta ligne = le néon (plume / police single-line)</span>
          </button>
        </div>
        {trace === "simple" && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Sélectionne <strong>tes tracés</strong> (lignes dessinées à la plume, ou texte en
            police monoligne vectorisé) : ils deviennent le tube néon tels quels, puis
            l'habillage complet est appliqué (tube, lueur, plaque, entretoises, cotes).
          </p>
        )}
      </div>

      {/* Dimension finale (plaque) */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Dimension finale de la plaque (mm réels) — renseigne <strong>largeur OU hauteur</strong>,
          l'autre suit proportionnellement
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number" min="50" placeholder="Largeur (ex : 1200)" className="h-9 w-40"
            value={largeurStr}
            onChange={(e) => { setLargeurStr(e.target.value); if (e.target.value) setHauteurStr(""); }}
          />
          <span className="text-xs text-slate-400">ou</span>
          <Input
            type="number" min="50" placeholder="Hauteur (ex : 400)" className="h-9 w-40"
            value={hauteurStr}
            onChange={(e) => { setHauteurStr(e.target.value); if (e.target.value) setLargeurStr(""); }}
          />
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            vide = taille du texte sélectionné
          </span>
        </div>
      </div>

      {/* Réglages */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="neon-tube" className="text-xs">Ø tube (mm maquette)</Label>
          <Input
            id="neon-tube" type="number" step="0.1" min="0.3" className="h-9"
            value={tubeMm}
            onChange={(e) => setTubeMm(parseFloat(e.target.value) || 1.06)}
          />
        </div>
        <div>
          <Label htmlFor="neon-coeur" className="text-xs">Ø cœur blanc (mm)</Label>
          <Input
            id="neon-coeur" type="number" step="0.05" min="0.05" className="h-9"
            value={coeurMm}
            onChange={(e) => setCoeurMm(parseFloat(e.target.value) || 0.3)}
          />
        </div>
        <div>
          <Label htmlFor="neon-pad" className="text-xs">Débord plaque (% hauteur)</Label>
          <Input
            id="neon-pad" type="number" step="1" min="2" className="h-9"
            value={padPlaquePct}
            onChange={(e) => setPadPlaquePct(parseFloat(e.target.value) || 12)}
          />
        </div>
      </div>

      <div className="flex items-center gap-5 flex-wrap">
        {(
          [
            ["Lueur", lueur, setLueur],
            ["Plaque plexi", plaque, setPlaque],
            ["Entretoises", fixations, setFixations],
            ["Cotes", cotes, setCotes],
          ] as Array<[string, boolean, (v: boolean) => void]>
        ).map(([label, val, set]) => (
          <label key={label} className="flex items-center gap-2 cursor-pointer text-sm dark:text-slate-200">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => set(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-pink-600 focus:ring-pink-500"
            />
            {label}
          </label>
        ))}
      </div>

      <Button
        // en deux couleurs, rien à faire tant que les deux ne sont pas mémorisées
        disabled={isProcessing || (deuxCouleurs && !deuxPretes)}
        onClick={async () => {
          // la génération consomme les mémorisations : le néon suivant repart de l'étape 1
          if ((await onGenerate(parametres())) && deuxCouleurs) setMemo({ 1: null, 2: null });
        }}
        className={`w-full gap-2 h-11 text-white ${deuxCouleurs && deuxPretes ? "ring-2 ring-offset-2 ring-pink-400 dark:ring-offset-slate-900" : ""}`}
        style={{ background: deuxCouleurs ? `linear-gradient(90deg, ${hex}, ${hex2})` : hex }}
      >
        <Zap className="h-4 w-4" />
        {deuxCouleurs ? "3. Faire le Néon Flex" : "Transformer en Néon Flex"}
      </Button>

      <p className="text-[11px] text-gray-400 dark:text-slate-500">
        Recette : tube pastel + cœur blanc + halo (5 couches) + plaque suivant les lettres (gris
        86%) + pastilles de fixation. L'original n'est jamais modifié ; le néon arrive groupé
        « NEON FLEX » juste en dessous. Ø tube 1,06 mm = 10,6 mm réels sur une maquette 1:10.
      </p>
    </Card>
  );
}
