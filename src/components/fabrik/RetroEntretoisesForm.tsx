// FabRik — Lettre rétroéclairée sur entretoises (process V2 « rainure LED », BÊTA).
// Réglages modifiables pour les essais avec l'atelier ; tout écart au standard est signalé.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CircleDot, RotateCcw } from "lucide-react";
import { PARAMETRES_RETRO } from "@/lib/fabrik/retro/moteur";

export interface ReglagesRetro {
  bordure: number;
  rainureMax: number;
  rainureMin: number;
  rainureCable: number;
  bordureMin: number;
  diametre: number;
  garde: number;
  couverture: number;
  profondeurMax: number;
  ecartMin: number;
  cable: number;
  bordureCable: number;
}
export interface PdpRetro {
  client: string;
  bat: string;
  miroir: boolean;
}

const CLES: Array<keyof ReglagesRetro> = ["bordure", "rainureMax", "rainureMin", "rainureCable", "bordureMin", "diametre", "garde", "couverture", "profondeurMax", "ecartMin", "cable", "bordureCable"];
const STANDARD: ReglagesRetro = Object.fromEntries(CLES.map((k) => [k, (PARAMETRES_RETRO as unknown as Record<string, number>)[k]])) as unknown as ReglagesRetro;
const MEMO = "fabrik_retro_reglages_v2";

/** écarts au standard de l'atelier (bordure 6 mm, rainure entre 6 et 10 mm) — texte vide si tout est standard */
export function horsStandard(r: ReglagesRetro): string {
  const e: string[] = [];
  if (r.bordure !== 6) e.push(`bordure ${r.bordure} mm (standard 6 mm)`);
  if (r.rainureMax < 6 || r.rainureMax > 10) e.push(`rainure max ${r.rainureMax} mm (standard entre 6 et 10 mm)`);
  if (r.rainureMin < 6 || r.rainureMin > 10) e.push(`seuil LED ${r.rainureMin} mm (standard entre 6 et 10 mm)`);
  return e.join(", ");
}

interface Props {
  onLancer: (etape: "placer" | "finaliser", reglages: ReglagesRetro, pdp: PdpRetro) => void;
  isProcessing: boolean;
}

function Champ({ id, label, aide, valeur, standard, onChange, min = 0, step = 0.5 }: {
  id: string; label: string; aide?: string; valeur: number; standard: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
  const modifie = valeur !== standard;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2">
        {label}
        {modifie && <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">(standard : {standard})</span>}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(valeur) ? valeur : ""}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={modifie ? "border-amber-400 dark:border-amber-600" : ""}
      />
      {aide && <p className="text-xs text-gray-400 dark:text-slate-500">{aide}</p>}
    </div>
  );
}

export function RetroEntretoisesForm({ onLancer, isProcessing }: Props) {
  const [r, setR] = useState<ReglagesRetro>(() => {
    try {
      const m = JSON.parse(localStorage.getItem(MEMO) || "null");
      if (m) return { ...STANDARD, ...m };
    } catch {
      // réglages illisibles : on repart du standard
    }
    return STANDARD;
  });
  const [pdp, setPdp] = useState<PdpRetro>({ client: "", bat: "", miroir: false });
  const [avance, setAvance] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(MEMO, JSON.stringify(r));
    } catch {
      // pas de mémoire : sans importance
    }
  }, [r]);

  const maj = (k: keyof ReglagesRetro) => (v: number) => setR((x) => ({ ...x, [k]: v }));
  const ecarts = horsStandard(r);
  const invalide = CLES.some((k) => !Number.isFinite(r[k]) || r[k] <= 0)
    ? "Un réglage est vide ou nul."
    : r.rainureMin > r.rainureMax
      ? "Le seuil LED ne peut pas dépasser la rainure max."
      : r.rainureCable > r.rainureMin
        ? "La rainure mini (câble) ne peut pas dépasser le seuil LED."
        : r.bordureMin > r.bordure
          ? "La bordure mini ne peut pas dépasser la bordure."
          : "";
  const modifies = CLES.some((k) => r[k] !== STANDARD[k]);
  const lancer = (etape: "placer" | "finaliser") => {
    if (invalide) return;
    if (ecarts && etape === "placer" && !window.confirm(`Réglages HORS STANDARD atelier :\n${ecarts}\n\nLancer quand même ?`)) return;
    onLancer(etape, r, pdp);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-900/15">
        <p className="text-sm text-violet-800 dark:text-violet-200">
          <strong>Bêta</strong> — nouveau process « rainure LED » (V2). Outil en test avec l'atelier : vérifie le résultat
          avant d'envoyer en FAB. L'outil « Lettres Relief » (ancien process) reste inchangé.
        </p>
        <p className="text-xs text-violet-700/80 dark:text-violet-300/80 mt-1.5">
          Un fichier = un seul process : ne jamais mélanger dans un même fichier des entretoises encastrées (ancien process) et
          des entretoises posées sur la matière (V2), elles ne seraient pas à la même hauteur.
        </p>
      </Card>

      <Card className="p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Prérequis
        </h4>
        <ul className="text-sm space-y-1.5 list-disc pl-5">
          <li><strong>Adobe Illustrator</strong> ouvert avec le fichier <strong>à l'échelle 1:1</strong>, enregistré (le PDP est enregistré à côté).</li>
          <li>
            Contour des lettres <strong>vectorisé, réuni et fermé</strong> : <strong>Pathfinder › Réunion</strong> sur les lettres avant de lancer
            (une lettre faite de plusieurs morceaux ou d'un tracé ouvert n'aura ni rainure ni entretoise).
          </li>
          <li><strong>Sélectionne le contour des lettres</strong> avant « Placer ». Sans sélection : le calque « Découpe », sinon tout le document.</li>
        </ul>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium dark:text-slate-200">Réglages</h4>
          {modifies && (
            <Button variant="outline" size="sm" onClick={() => setR(STANDARD)} className="gap-1.5 h-8">
              <RotateCcw className="h-3.5 w-3.5" />
              Revenir au standard
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Champ id="rt-bordure" label="Bordure (mm)" aide="Matière entre le bord de la lettre et la rainure" valeur={r.bordure} standard={STANDARD.bordure} onChange={maj("bordure")} />
          <Champ id="rt-rainure" label="Rainure max (mm)" aide="Largeur de la rainure LED là où il y a la place" valeur={r.rainureMax} standard={STANDARD.rainureMax} onChange={maj("rainureMax")} />
          <Champ id="rt-rainuremin" label="Seuil LED (mm)" aide="Rainure plus fine : surlignée en jaune (le ruban ne passe pas)" valeur={r.rainureMin} standard={STANDARD.rainureMin} onChange={maj("rainureMin")} />
          <Champ id="rt-rainurecable" label="Rainure mini / câble (mm)" aide="La rainure s'affine jusqu'à cette largeur avant de s'arrêter" valeur={r.rainureCable} standard={STANDARD.rainureCable} onChange={maj("rainureCable")} min={0.5} />
          <Champ id="rt-diam" label="Diamètre entretoise (mm)" valeur={r.diametre} standard={STANDARD.diametre} onChange={maj("diametre")} min={4} />
          <Champ id="rt-couv" label="Couverture (mm)" aide="Aucun point de lettre à plus de cette distance d'une entretoise. Plus petit = plus d'entretoises" valeur={r.couverture} standard={STANDARD.couverture} onChange={maj("couverture")} min={30} step={10} />
          <Champ id="rt-garde" label="Garde rainure (mm)" aide="Matière laissée entre une entretoise et la rainure" valeur={r.garde} standard={STANDARD.garde} onChange={maj("garde")} />
        </div>

        <button
          type="button"
          onClick={() => setAvance(!avance)}
          className="flex items-center gap-1 mt-4 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
        >
          {avance ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Réglages avancés
        </button>
        {avance && (
          <div className="grid grid-cols-4 gap-4 mt-3 pt-3 border-t dark:border-slate-700">
            <Champ id="rt-bordmin" label="Bordure mini (mm)" aide="Sur un trait trop fin, la rainure continue au milieu en réduisant la bordure jusqu'à cette valeur" valeur={r.bordureMin} standard={STANDARD.bordureMin} onChange={maj("bordureMin")} />
            <Champ id="rt-prof" label="Profondeur max (mm)" aide="Dans une grande surface, distance max entre l'entretoise et la rainure" valeur={r.profondeurMax} standard={STANDARD.profondeurMax} onChange={maj("profondeurMax")} />
            <Champ id="rt-ecart" label="Écart min (mm)" aide="Entre deux entretoises d'une même lettre" valeur={r.ecartMin} standard={STANDARD.ecartMin} onChange={maj("ecartMin")} step={5} />
            <Champ id="rt-cable" label="Passage de câble (mm)" aide="Raccords entre rainures quand aucune autre solution ne passe" valeur={r.cable} standard={STANDARD.cable} onChange={maj("cable")} />
            <Champ id="rt-bcable" label="Bordure câble (mm)" aide="Matière entre le passage de câble et le bord" valeur={r.bordureCable} standard={STANDARD.bordureCable} onChange={maj("bordureCable")} />
          </div>
        )}

        {ecarts && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span><strong>Hors standard atelier</strong> : {ecarts}. À valider avec l'atelier avant d'envoyer en FAB.</span>
          </div>
        )}
        {invalide && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{invalide}</p>}
      </Card>

      <Card className="p-4">
        <h4 className="font-medium mb-3 dark:text-slate-200">PDP (plan de pose papier)</h4>
        <div className="grid grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="rt-client">Client</Label>
            <Input id="rt-client" value={pdp.client} placeholder="ex. MAISON PEPPINO" onChange={(e) => setPdp({ ...pdp, client: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rt-bat">N° du BAT</Label>
            <Input id="rt-bat" value={pdp.bat} placeholder="ex. 2" onChange={(e) => setPdp({ ...pdp, bat: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
            <input type="checkbox" checked={pdp.miroir} onChange={(e) => setPdp({ ...pdp, miroir: e.target.checked })} className="h-4 w-4 accent-blue-600" />
            Fichier de FAB en miroir (vue de dos)
          </label>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
          Nom : PDP_PAPIER_{(pdp.client.trim() || "CLIENT").toUpperCase().replace(/\s+/g, "_")}_N{pdp.bat.trim() || "…"} — sans client, le nom du fichier de FAB est repris.
          Généré à « Finaliser », à partir des entretoises telles qu'elles sont dans le fichier (après tes déplacements).
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={() => lancer("placer")}
          disabled={isProcessing || !!invalide}
          className="py-6 text-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
        >
          {isProcessing ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" /> : <CircleDot className="mr-2 h-5 w-5" />}
          1. Placer
        </Button>
        <Button
          onClick={() => lancer("finaliser")}
          disabled={isProcessing || !!invalide}
          className="py-6 text-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
        >
          {isProcessing ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
          2. Finaliser + PDP
        </Button>
      </div>

      <Card className="p-4 bg-slate-50 dark:bg-slate-800/60">
        <h4 className="font-medium mb-3 dark:text-slate-200">Comment ça marche</h4>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-orange-500 font-bold">1. Placer</span> — la découpe passe en <span className="text-pink-500 font-medium">rose</span> (calque
            « Découpe »), la rainure LED en <span className="text-emerald-500 font-medium">vert</span> (calque « Rainure LED ») et les entretoises en{" "}
            <span className="text-blue-500 font-medium">bleu</span> (calque « Entretoises »), centrées dans la matière restante. <strong>Rien n'est fusionné.</strong>
          </p>
          <p>
            <span className="text-violet-500 font-bold">Rainure adaptative</span> — là où il y a la place, deux rainures de {r.rainureMax} mm le long des
            bords (à {r.bordure} mm) avec les entretoises entre les deux ; sur un trait plus étroit, une seule rainure au milieu, aussi large que la place le
            permet (au plus {r.rainureMax} mm), qui s'affine jusqu'à {r.rainureCable} mm pour le câble. Les parties plus fines que {r.rainureMin} mm sont
            surlignées en <span className="text-amber-500 font-medium">jaune</span> (calque non imprimable).
          </p>
          <p>
            <span className="text-blue-500 font-bold">Retouche</span> — dans Illustrator, déplace, ajoute (copier-coller) ou supprime des cercles bleus.
          </p>
          <p>
            <span className="text-emerald-500 font-bold">2. Finaliser</span> — relit tes entretoises ; là où une entretoise touche la rainure (lettre fine),
            la rainure s'arrête 1 mm avant. Vérifie qu'aucune entretoise n'est hors de la lettre ou ne coupe la rainure en deux, puis génère le PDP.
            Tu peux re-déplacer et re-finaliser autant de fois que tu veux.
          </p>
          <p className="text-gray-500 dark:text-slate-400">
            Fraises : d'après le guide de l'atelier, la gravure du PVC 19 se fait à la fraise de 6 ou de 10 — une rainure plus fine que 6 mm demande une
            fraise plus petite (à valider avec l'atelier). Seuls les problèmes bloquants sont cerclés en rouge (calque « A vérifier », non imprimable). Relancer « Placer » efface les retouches (Illustrator demande confirmation).
          </p>
        </div>
      </Card>
    </div>
  );
}
