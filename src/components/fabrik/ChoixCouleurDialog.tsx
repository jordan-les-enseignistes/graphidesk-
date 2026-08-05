import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pipette, X } from "lucide-react";

/* ---------- conversions ---------- */

export interface Cmjn {
  c: number;
  m: number;
  j: number;
  n: number;
}

function borne(v: number, max = 255): number {
  return Math.max(0, Math.min(max, v));
}

export function hexVersRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbVersHex(r: number, v: number, b: number): string {
  const h = (x: number) => borne(Math.round(x)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(v)}${h(b)}`;
}

/** TSV : teinte 0-360, saturation et valeur 0-1 */
function rgbVersTsv(r: number, v: number, b: number): [number, number, number] {
  const R = r / 255, V = v / 255, B = b / 255;
  const max = Math.max(R, V, B), min = Math.min(R, V, B);
  const d = max - min;
  let t = 0;
  if (d !== 0) {
    if (max === R) t = ((V - B) / d) % 6;
    else if (max === V) t = (B - R) / d + 2;
    else t = (R - V) / d + 4;
    t *= 60;
    if (t < 0) t += 360;
  }
  return [t, max === 0 ? 0 : d / max, max];
}

function tsvVersRgb(t: number, s: number, val: number): [number, number, number] {
  const c = val * s;
  const x = c * (1 - Math.abs(((t / 60) % 2) - 1));
  const m = val - c;
  let r = 0, v = 0, b = 0;
  if (t < 60) { r = c; v = x; }
  else if (t < 120) { r = x; v = c; }
  else if (t < 180) { v = c; b = x; }
  else if (t < 240) { v = x; b = c; }
  else if (t < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [(r + m) * 255, (v + m) * 255, (b + m) * 255];
}

/** CMJN ↔ RVB : conversion naïve, comme partout dans GraphiDesk. L'écran ne
 *  reproduit pas l'encre — c'est un aperçu, la valeur CMJN reste la référence. */
export function rgbVersCmjn(r: number, v: number, b: number): Cmjn {
  const R = r / 255, V = v / 255, B = b / 255;
  const n = 1 - Math.max(R, V, B);
  if (n >= 1) return { c: 0, m: 0, j: 0, n: 100 };
  const d = 1 - n;
  return {
    c: Math.round(((1 - R - n) / d) * 100),
    m: Math.round(((1 - V - n) / d) * 100),
    j: Math.round(((1 - B - n) / d) * 100),
    n: Math.round(n * 100),
  };
}

export function cmjnVersRgb(cm: Cmjn): [number, number, number] {
  const f = (x: number) => Math.min(100, Math.max(0, x)) / 100;
  const k = f(cm.n);
  return [
    255 * (1 - f(cm.c)) * (1 - k),
    255 * (1 - f(cm.m)) * (1 - k),
    255 * (1 - f(cm.j)) * (1 - k),
  ];
}

/* ---------- sélecteur ---------- */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** couleur de départ */
  valeur: string;
  /** appelé en direct pendant le choix (aperçu immédiat sur la 3D) */
  onApercu: (hex: string) => void;
  /** appelé à la validation */
  onValider: (hex: string) => void;
  titre?: string;
}

export function ChoixCouleurDialog({
  open,
  onOpenChange,
  valeur,
  onApercu,
  onValider,
  titre = "Choisir une couleur",
}: Props) {
  const [tsv, setTsv] = useState<[number, number, number]>([0, 0, 1]);
  const [hexSaisi, setHexSaisi] = useState(valeur);
  const departRef = useRef(valeur);
  const carreRef = useRef<HTMLDivElement>(null);
  const bandeRef = useRef<HTMLDivElement>(null);

  // à l'ouverture : on part de la couleur courante et on la mémorise pour
  // pouvoir la restaurer si l'utilisateur annule
  useEffect(() => {
    if (!open) return;
    departRef.current = valeur;
    const [r, v, b] = hexVersRgb(valeur);
    setTsv(rgbVersTsv(r, v, b));
    setHexSaisi(valeur);
  }, [open, valeur]);

  const [t, s, val] = tsv;
  const [r, v, b] = tsvVersRgb(t, s, val);
  const hex = rgbVersHex(r, v, b);
  const cmjn = rgbVersCmjn(r, v, b);

  const majDepuisTsv = (next: [number, number, number]) => {
    setTsv(next);
    const [nr, nv, nb] = tsvVersRgb(next[0], next[1], next[2]);
    const h = rgbVersHex(nr, nv, nb);
    setHexSaisi(h);
    onApercu(h);
  };

  const majDepuisRgb = (nr: number, nv: number, nb: number) => {
    const next = rgbVersTsv(borne(nr), borne(nv), borne(nb));
    setTsv(next);
    const h = rgbVersHex(borne(nr), borne(nv), borne(nb));
    setHexSaisi(h);
    onApercu(h);
  };

  /** suivi du pointeur : on capture pour que le glissé continue même en
   *  sortant du carré, sinon le choix « décroche » au moindre débordement */
  const suivre = (
    e: React.PointerEvent<HTMLDivElement>,
    zone: "carre" | "bande"
  ) => {
    const el = zone === "carre" ? carreRef.current : bandeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (zone === "carre") {
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      majDepuisTsv([t, x, 1 - y]);
    } else {
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      majDepuisTsv([y * 360, s, val]);
    }
  };

  const champ = (
    label: string,
    valeurChamp: number,
    max: number,
    onSet: (n: number) => void
  ) => (
    <label className="flex items-center gap-1">
      <span className="w-4 text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={Math.round(valeurChamp)}
        onChange={(e) => onSet(parseFloat(e.target.value) || 0)}
        className="h-7 w-full min-w-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 text-xs text-center dark:text-slate-200"
      />
    </label>
  );

  const teinteVive = rgbVersHex(...tsvVersRgb(t, 1, 1));

  const annuler = () => {
    onApercu(departRef.current);
    onOpenChange(false);
  };

  // Échap annule et rétablit la couleur de départ
  useEffect(() => {
    if (!open) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") annuler();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // ⚠ Panneau FLOTTANT, sans voile sombre : le but est de voir l'enseigne
  // changer de couleur en direct pendant qu'on choisit. Une fenêtre modale
  // classique masquerait justement ce qu'on cherche à regarder. La 3D reste
  // manipulable — on peut la faire tourner sans fermer le sélecteur.
  return (
    <div className="fixed right-4 top-24 z-50 w-[340px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold dark:text-slate-100">
          <Pipette className="h-4 w-4 text-violet-500" />
          {titre}
        </h3>
        <button
          type="button"
          onClick={annuler}
          className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          title="Fermer sans changer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

        <div className="flex gap-3">
          {/* carré saturation × luminosité */}
          <div
            ref={carreRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              suivre(e, "carre");
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) suivre(e, "carre");
            }}
            className="relative flex-1 h-52 rounded cursor-crosshair touch-none"
            style={{
              backgroundColor: teinteVive,
              backgroundImage:
                "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))",
            }}
          >
            <div
              className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${s * 100}%`, top: `${(1 - val) * 100}%` }}
            />
          </div>

          {/* bande des teintes */}
          <div
            ref={bandeRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              suivre(e, "bande");
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) suivre(e, "bande");
            }}
            className="relative w-5 h-52 rounded cursor-pointer touch-none"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
          >
            <div
              className="absolute left-1/2 h-2.5 w-7 -translate-x-1/2 -translate-y-1/2 rounded border-2 border-white shadow"
              style={{ top: `${(t / 360) * 100}%`, backgroundColor: teinteVive }}
            />
          </div>

          {/* aperçu avant / après */}
          <div className="w-12 shrink-0">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Avant</div>
            <div
              className="h-10 rounded-t border border-slate-300 dark:border-slate-600"
              style={{ backgroundColor: departRef.current }}
            />
            <div
              className="h-10 rounded-b border border-t-0 border-slate-300 dark:border-slate-600"
              style={{ backgroundColor: hex }}
            />
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Après</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {champ("C", cmjn.c, 100, (n) =>
              majDepuisRgb(...cmjnVersRgb({ ...cmjn, c: n })))}
            {champ("M", cmjn.m, 100, (n) =>
              majDepuisRgb(...cmjnVersRgb({ ...cmjn, m: n })))}
            {champ("J", cmjn.j, 100, (n) =>
              majDepuisRgb(...cmjnVersRgb({ ...cmjn, j: n })))}
            {champ("N", cmjn.n, 100, (n) =>
              majDepuisRgb(...cmjnVersRgb({ ...cmjn, n: n })))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {champ("R", r, 255, (n) => majDepuisRgb(n, v, b))}
            {champ("V", v, 255, (n) => majDepuisRgb(r, n, b))}
            {champ("B", b, 255, (n) => majDepuisRgb(r, v, n))}
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">#</span>
              <input
                type="text"
                value={hexSaisi.replace("#", "")}
                onChange={(e) => {
                  const t2 = e.target.value;
                  setHexSaisi(t2);
                  if (/^#?[0-9a-f]{6}$/i.test(t2)) {
                    const [nr, nv, nb] = hexVersRgb(t2);
                    majDepuisRgb(nr, nv, nb);
                  }
                }}
                className="h-7 w-full min-w-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 text-xs text-center font-mono dark:text-slate-200"
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            L'écran ne reproduit pas l'encre : c'est un aperçu, la valeur CMJN
            reste la référence pour l'atelier.
          </p>
        </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={annuler}>
          Annuler
        </Button>
        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-700"
          onClick={() => {
            onValider(hex);
            onOpenChange(false);
          }}
        >
          Valider
        </Button>
      </div>
    </div>
  );
}
