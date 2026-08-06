import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Box,
  Sun,
  Sparkles,
  Lightbulb,
  Moon,
  CircleDot,
  Minus,
  Rows3,
  Square,
  Wand2,
  FileDown,
  Scissors,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  Plus,
  FileUp,
  ImageIcon,
  Flag,
} from "lucide-react";
import {
  Relief3dScene,
  RELIEF3D_DEFAUTS,
  estAjourage,
  VUES,
  MOTIFS_MUR,
  MODES_DRAPEAU,
  type ModeDrapeau,
  type VueNom,
  type Fixation,
  type Eclairage,
  type LisseFichier,
  type Relief3dInput,
  type Relief3dOptions,
} from "@/lib/relief3d";
import { DEFAULT_ILLUSTRATOR_PATH } from "./types";
import { importerFichier } from "@/lib/importVectoriel";
import { ChoixCouleurDialog } from "./ChoixCouleurDialog";

const ILLUSTRATOR_PATH_KEY = "fabrik_illustrator_path";

/**
 * L'enseigne DRAPEAU (caisson double face) n'est pas finalisée : le moteur
 * existe et fonctionne, mais le rendu n'est pas validé. Tant que ce drapeau
 * vaut `false`, le module ne propose que les lettres relief.
 *
 * ⚠ Rien n'a été retiré : `drapeau3d.ts`, la section « Caisson » et toute la
 * mécanique restent en place. Repasser à `true` rétablit le choix.
 */
const DRAPEAU_PRET = false;

interface MetaExport {
  wMm?: number;
  hMm?: number;
  origX?: number;
  origY?: number;
  sf?: number;
  entretoises?: { xMm: number; yMm: number; dMm: number }[];
  erreur?: string;
}

/** Ramène la fenêtre GraphiDesk devant : après un script, c'est Illustrator
 *  qui a la main et le résultat resterait caché derrière. */
async function revenirSurGraphiDesk(): Promise<void> {
  try {
    await invoke("focus_main_window");
  } catch {
    // sans importance : au pire l'utilisateur bascule lui-même
  }
}

/** base64 (canal de retour Illustrator) → texte UTF-8 */
function b64Texte(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

const FIXATION_CHOIX: { v: Fixation; label: string; icone: React.ElementType }[] = [
  { v: "aplat", label: "À plat", icone: Square },
  { v: "entretoises", label: "Entretoises", icone: CircleDot },
  { v: "tiges", label: "Tiges", icone: Minus },
  { v: "lisses", label: "Lisses", icone: Rows3 },
];

const ECLAIRAGE_CHOIX: { v: Eclairage; label: string; icone: React.ElementType }[] = [
  { v: "aucun", label: "Éteint", icone: Moon },
  { v: "face", label: "Façade", icone: Sun },
  { v: "retro", label: "Rétro", icone: Sparkles },
  { v: "rampe", label: "Rampe", icone: Minus },
  { v: "spot", label: "Spots", icone: Lightbulb },
  { v: "ajourageRelief", label: "Ajour. relief", icone: Scissors },
  { v: "ajourageAPlat", label: "Ajour. à plat", icone: Square },
];

const TEINTES_HALO: [string, string][] = [
  ["#ffffff", "Blanc"],
  ["#ffe9b0", "Blanc chaud"],
  ["#ffd21f", "Jaune"],
  ["#ff4d4d", "Rouge"],
  ["#4dff88", "Vert"],
  ["#4db8ff", "Bleu"],
  ["#ff7ad9", "Rose"],
  ["#b98cff", "Violet"],
];

/** peintures courantes du matériel (profilés, spots) */
const CORPS: [string, string][] = [
  ["#2f3338", "Anthracite"],
  ["#111111", "Noir"],
  ["#c9ccd1", "Alu"],
  ["#ffffff", "Blanc"],
  ["#8a6b3d", "Bronze"],
];

/** lisses : métal brut par défaut, peinture possible */
const METAL: [string, string][] = [
  ["#9aa0a6", "Métal brut"],
  ["#ffffff", "Blanc"],
  ["#9a9a9a", "Gris"],
  ["#5a5a5a", "Anthracite"],
  ["#242424", "Noir"],
];

const NEUTRES: [string, string][] = [
  ["#ffffff", "Blanc"],
  ["#d8d8d8", "Gris clair"],
  ["#9a9a9a", "Gris"],
  ["#5a5a5a", "Anthracite"],
  ["#242424", "Noir"],
];

/* ---------- petits composants d'interface ---------- */

function Section({
  titre,
  children,
  action,
}: {
  titre: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {titre}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Sélecteur segmenté à icônes — remplace les listes déroulantes natives */
function Segments<T extends string>({
  valeur,
  choix,
  onChange,
  colonnes,
}: {
  valeur: T;
  choix: { v: T; label: string; icone: React.ElementType }[];
  onChange: (v: T) => void;
  /** Au-delà de 5 choix, une seule rangée devient illisible : on répartit. */
  colonnes?: number;
}) {
  return (
    <div
      className="grid gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1"
      style={{
        gridTemplateColumns: `repeat(${colonnes ?? choix.length}, minmax(0, 1fr))`,
      }}
    >
      {choix.map((c) => {
        const Icone = c.icone;
        const actif = c.v === valeur;
        return (
          <button
            key={c.v}
            type="button"
            onClick={() => onChange(c.v)}
            className={`flex flex-col items-center gap-1 rounded-md py-2 text-[10px] font-medium transition-colors ${
              actif
                ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Icone className="h-4 w-4" />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function Curseur({
  label,
  valeur,
  min,
  max,
  pas = 1,
  suffixe = "",
  onChange,
}: {
  label: string;
  valeur: number;
  min: number;
  max: number;
  pas?: number;
  suffixe?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-xs font-medium tabular-nums text-slate-900 dark:text-slate-100">
          {Math.round(valeur * 10) / 10}
          {suffixe}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-violet-600"
      />
    </div>
  );
}

/** Nuancier : pastilles rapides + « + » qui ouvre le sélecteur complet */
function Pastilles({
  valeur,
  choix,
  onChange,
  titre,
}: {
  valeur: string;
  choix: [string, string][];
  onChange: (v: string) => void;
  titre?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const perso = !choix.some(([hex]) => hex.toLowerCase() === valeur.toLowerCase());

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 py-0.5">
        {choix.map(([hex, nom]) => (
          <button
            key={hex}
            type="button"
            title={nom}
            onClick={() => onChange(hex)}
            className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
              valeur.toLowerCase() === hex.toLowerCase()
                ? "border-violet-500 ring-2 ring-violet-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-900"
                : "border-slate-300 dark:border-slate-600"
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
        <button
          type="button"
          title="Autre couleur — roue chromatique, CMJN, RVB"
          onClick={() => setOuvert(true)}
          className={`h-7 w-7 rounded-full border border-dashed flex items-center justify-center transition-colors ${
            perso
              ? "border-violet-500 ring-2 ring-violet-400"
              : "border-slate-400 dark:border-slate-500 text-slate-500 hover:border-violet-500 hover:text-violet-500"
          }`}
          style={perso ? { backgroundColor: valeur } : undefined}
        >
          {!perso && <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
      <ChoixCouleurDialog
        open={ouvert}
        onOpenChange={setOuvert}
        valeur={valeur}
        titre={titre}
        onApercu={onChange}
        onValider={onChange}
      />
    </div>
  );
}

/* ---------- studio ---------- */

export function Relief3dStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Relief3dScene | null>(null);
  const [input, setInput] = useState<Relief3dInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [opts, setOpts] = useState<Relief3dOptions>(RELIEF3D_DEFAUTS);
  // le 1:10 est l'usage courant de l'atelier : c'est lui la valeur par défaut
  const [echelle10, setEchelle10] = useState(true);
  const [vue, setVue] = useState<VueNom>("troisQuartsGauche");
  const [nbFix, setNbFix] = useState(0);
  const [nonTenus, setNonTenus] = useState(0);
  const [duFichier, setDuFichier] = useState(false);
  const [plusDeReglages, setPlusDeReglages] = useState(false);
  /** repère du fichier (origine des lettres) — sert au relevé des lisses */
  const [repere, setRepere] = useState<{ origX: number; origY: number; sf: number } | null>(null);
  /** échelle du plan de travail créé dans Illustrator à l'export */
  const [exportAu10e, setExportAu10e] = useState(true);
  /** garde-fou : la sélection Illustrator doit être faite AVANT le relevé */
  const [confirmLisses, setConfirmLisses] = useState(false);
  /** même garde-fou pour la récupération de l'enseigne elle-même */
  const [confirmSelection, setConfirmSelection] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  /** d'où vient l'enseigne : relire la sélection n'a de sens que pour
   *  Illustrator — un fichier glissé n'a rien à re-lire */
  const [source, setSource] = useState<"illustrator" | "fichier" | null>(null);

  const majDiagnostic = (scene: Relief3dScene) => {
    setNbFix(
      opts.fixation === "lisses" ? scene.lissesRendues : scene.entretoisesRendues
    );
    setNonTenus(scene.elementsNonTenus);
  };

  // ---- récupération de la sélection Illustrator ----
  const recuperer = useCallback(async () => {
    setBusy(true);
    try {
      toast.info("Récupération de ta sélection Illustrator…");
      const illustratorPath =
        localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
      await invoke<string>("run_illustrator_script", {
        illustratorPath,
        scriptName: "relief3d_export_selection.jsx",
        params: JSON.stringify({}),
      });

      let metaB64: string | null = null;
      for (let i = 0; i < 40 && !metaB64; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          metaB64 = await invoke<string>("read_temp_binary", {
            fileName: "graphidesk_3d/meta.json",
          });
        } catch {
          metaB64 = null;
        }
      }
      if (!metaB64) throw new Error("Illustrator n'a rien exporté (sélection vide ?)");
      const meta = JSON.parse(b64Texte(metaB64)) as MetaExport;
      if (meta.erreur) throw new Error(meta.erreur);

      const svgB64 = await invoke<string>("read_temp_binary", {
        fileName: "graphidesk_3d/lettres.svg",
      });
      const k = echelle10 ? 10 : 1;
      const ents = (meta.entretoises ?? []).map((e) => ({
        xMm: e.xMm * k,
        yMm: e.yMm * k,
        dMm: e.dMm * k,
      }));
      setDuFichier(ents.length > 0);
      setSource("illustrator");
      setRepere({
        origX: meta.origX ?? 0,
        origY: meta.origY ?? 0,
        sf: meta.sf ?? 1,
      });
      setInput({
        svg: b64Texte(svgB64),
        wMm: (meta.wMm ?? 1000) * k,
        hMm: (meta.hMm ?? 300) * k,
        entretoises: ents,
      });
      await revenirSurGraphiDesk();
      toast.success("Enseigne récupérée — couleurs reprises de ton fichier");
    } catch (err) {
      toast.error(`Récupération impossible : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [echelle10]);

  // ---- import d'un fichier (sans Illustrator) ----
  const chargerFichier = useCallback(async (fichier: File) => {
    setBusy(true);
    try {
      const { svg, wMm, hMm, nom } = await importerFichier(fichier);
      const k = echelle10 ? 10 : 1;
      setDuFichier(false);
      setRepere(null);
      setSource("fichier");
      setInput({ svg, wMm: wMm * k, hMm: hMm * k, entretoises: [] });
      toast.success(
        `« ${nom} » chargé — ${Math.round(wMm * k)} × ${Math.round(hMm * k)} mm`
      );
    } catch (err) {
      toast.error(`Import impossible : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [echelle10]);

  // ---- relevé de la zone à ajourer d'un drapeau ----
  const recupererZone = useCallback(async () => {
    if (!repere) {
      toast.error("Récupère d'abord ton panneau");
      return;
    }
    setBusy(true);
    try {
      const illustratorPath =
        localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
      await invoke<string>("run_illustrator_script", {
        illustratorPath,
        scriptName: "relief3d_export_selection.jsx",
        params: JSON.stringify({ suffixe: "_zone" }),
      });
      let metaB64: string | null = null;
      for (let i = 0; i < 40 && !metaB64; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          metaB64 = await invoke<string>("read_temp_binary", {
            fileName: "graphidesk_3d/meta_zone.json",
          });
        } catch {
          metaB64 = null;
        }
      }
      if (!metaB64) throw new Error("Illustrator n'a rien exporté (sélection vide ?)");
      const meta = JSON.parse(b64Texte(metaB64)) as MetaExport;
      if (meta.erreur) throw new Error(meta.erreur);
      const svgB64 = await invoke<string>("read_temp_binary", {
        fileName: "graphidesk_3d/lettres_zone.svg",
      });
      const k = echelle10 ? 10 : 1;
      const PT_MM = 25.4 / 72;
      const sf = meta.sf ?? 1;
      // décalage de la zone par rapport au coin haut-gauche du panneau
      const dx = ((meta.origX ?? 0) - repere.origX) * sf * PT_MM * k;
      const dy = (repere.origY - (meta.origY ?? 0)) * sf * PT_MM * k;
      setInput((p) =>
        p
          ? {
              ...p,
              zoneLumineuse: {
                svg: b64Texte(svgB64),
                decalageXMm: dx,
                decalageYMm: dy,
                largeurMm: (meta.wMm ?? 100) * k,
              },
            }
          : p
      );
      await revenirSurGraphiDesk();
      toast.success("Zone lumineuse relevée");
    } catch (err) {
      toast.error(`Relevé impossible : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [repere, echelle10]);

  // ---- relevé des lisses dessinées par le graphiste ----
  const recupererLisses = useCallback(async () => {
    setBusy(true);
    try {
      toast.info("Sélectionne tes lisses dans Illustrator…");
      const illustratorPath =
        localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
      await invoke<string>("run_illustrator_script", {
        illustratorPath,
        scriptName: "relief3d_export_lisses.jsx",
        params: JSON.stringify(repere ?? {}),
      });
      let b64: string | null = null;
      for (let i = 0; i < 40 && !b64; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          b64 = await invoke<string>("read_temp_binary", {
            fileName: "graphidesk_3d/lisses.json",
          });
        } catch {
          b64 = null;
        }
      }
      if (!b64) throw new Error("Illustrator n'a rien renvoyé");
      const data = JSON.parse(b64Texte(b64)) as {
        lisses?: LisseFichier[];
        erreur?: string;
      };
      if (data.erreur) throw new Error(data.erreur);
      const k = echelle10 ? 10 : 1;
      const lisses = (data.lisses ?? []).map((l) => ({
        xMm: l.xMm * k,
        yMm: l.yMm * k,
        longueurMm: l.longueurMm * k,
        epaisseurMm: l.epaisseurMm * k,
        angleDeg: l.angleDeg,
      }));
      setInput((prec) => (prec ? { ...prec, lisses } : prec));
      await revenirSurGraphiDesk();
      toast.success(`${lisses.length} lisse(s) reprises de ta maquette`);
    } catch (err) {
      toast.error(`Relevé impossible : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [repere, echelle10]);

  // ---- (re)construction de la scène ----
  useEffect(() => {
    if (!input || !canvasRef.current) return;
    sceneRef.current?.dispose();
    try {
      const scene = new Relief3dScene(canvasRef.current, input, opts);
      sceneRef.current = scene;
      scene.vue(vue);
      majDiagnostic(scene);
    } catch (err) {
      toast.error(`Simulation impossible : ${String(err)}`);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setOptions(opts);
    majDiagnostic(scene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  useEffect(() => {
    sceneRef.current?.vue(vue);
  }, [vue]);

  useEffect(() => {
    const onResize = () => sceneRef.current?.resize();
    window.addEventListener("resize", onResize);
    const t = setTimeout(onResize, 60);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [input]);

  // ---- envoi du rendu sur un plan de travail Illustrator ----
  const envoyerVersIllustrator = async (sansFond: boolean) => {
    const scene = sceneRef.current;
    if (!scene || !input) return;
    setEnvoi(true);
    try {
      const dataUrl = scene.exportPng(sansFond);
      const base64 = dataUrl.split(",")[1];
      const pngPath = await invoke<string>("save_temp_binary", {
        fileName: `graphidesk_3d/rendu${sansFond ? "_detoure" : ""}.png`,
        contentBase64: base64,
      });
      const illustratorPath =
        localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
      await invoke<string>("run_illustrator_script", {
        illustratorPath,
        scriptName: "relief3d_place_rendu.jsx",
        params: JSON.stringify({
          pngPath,
          largeurMm: Math.round(input.wMm / (exportAu10e ? 10 : 1)),
          nom:
            (sansFond ? "Simulation 3D (détourée)" : "Simulation 3D") +
            (exportAu10e ? " 1:10" : ""),
        }),
      });
      // ici on NE ramène PAS GraphiDesk : le graphiste veut voir son plan
      // de travail dans Illustrator juste après l'envoi
      toast.success(
        `Rendu posé sur un nouveau plan de travail dans Illustrator (${
          exportAu10e ? "échelle 1:10" : "échelle 1:1"
        })`
      );
    } catch (err) {
      toast.error(`Envoi vers Illustrator impossible : ${String(err)}`);
    } finally {
      setEnvoi(false);
    }
  };

  /** Enregistrement du PNG : l'utilisateur choisit l'endroit et le nom. */
  const telechargerPng = async (sansFond: boolean) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const defaut = sansFond ? "enseigne_3d_detouree.png" : "simulation_3d.png";
    try {
      const chemin = await save({
        defaultPath: defaut,
        filters: [{ name: "Image PNG", extensions: ["png"] }],
      });
      if (!chemin) return; // enregistrement annulé
      const base64 = scene.exportPng(sansFond).split(",")[1];
      await invoke<string>("save_binary_to", { path: chemin, contentBase64: base64 });
      const nom = chemin.split(/[\\/]/).pop();
      toast.success(`Image enregistrée : ${nom}`, { duration: 6000 });
    } catch (err) {
      toast.error(`Enregistrement impossible : ${String(err)}`);
    }
  };

  const maj = (p: Partial<Relief3dOptions>) => setOpts((o) => ({ ...o, ...p }));

  /** Repart d'une page vierge : réglages d'usine et plus aucune enseigne.
   *  On ne relit RIEN — l'utilisateur choisit ensuite sa source. */
  const reinitialiser = useCallback(() => {
    setOpts(RELIEF3D_DEFAUTS);
    setVue("troisQuartsGauche");
    // on repart sur les valeurs d'usage : 1:10 à l'import comme à l'export
    setExportAu10e(true);
    setEchelle10(true);
    setInput(null);
    setRepere(null);
    setSource(null);
    setDuFichier(false);
    setNonTenus(0);
    setNbFix(0);
    toast.info("Tout est remis à zéro — glisse un fichier ou récupère ta sélection");
  }, []);

  /* ---------- rendu ---------- */

  return (
    <>
    <ConfirmDialog
      open={confirmLisses}
      onOpenChange={setConfirmLisses}
      title="Tes lisses sont-elles sélectionnées ?"
      description="Le relevé lit la sélection ACTIVE dans Illustrator. Bascule sur Illustrator, sélectionne tes barres, puis reviens confirmer. Si ce n'est pas encore fait, réponds Non : rien ne sera lu."
      confirmText="Oui, c'est sélectionné"
      cancelText="Non, pas encore"
      onConfirm={() => {
        // le dialogue ne se referme pas tout seul
        setConfirmLisses(false);
        recupererLisses();
      }}
    />
    <ConfirmDialog
      open={confirmSelection}
      onOpenChange={setConfirmSelection}
      title="Ta sélection est-elle faite ?"
      description="GraphiDesk lit la sélection ACTIVE dans Illustrator. Sélectionne ton enseigne — pour un drapeau, le panneau, son visuel et rien d'autre — puis reviens confirmer."
      confirmText="Oui, c'est sélectionné"
      cancelText="Non, pas encore"
      onConfirm={() => {
        setConfirmSelection(false);
        recuperer();
      }}
    />
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] h-full min-h-0">
      {/* Vue 3D */}
      <div
        className={`relative rounded-xl overflow-hidden border bg-slate-900 min-h-0 ${
          survol
            ? "border-violet-500 ring-2 ring-violet-400"
            : "border-slate-200 dark:border-slate-700"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          const f = e.dataTransfer.files[0];
          if (f) chargerFichier(f);
        }}
      >
        <input
          ref={fichierRef}
          type="file"
          accept=".svg,.pdf,.ai"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) chargerFichier(f);
            e.target.value = "";
          }}
        />
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* écran d'accueil — fond OPAQUE : il ne doit jamais laisser
            transparaître le rendu précédent après une remise à zéro */}
        {!input && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
              <Box className="h-7 w-7 text-violet-300" />
            </div>
            <div>
              <p className="text-slate-100 font-medium">Ton enseigne en 3D</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">
                Sélectionne les lettres dans Illustrator, puis récupère-les ici.
                Rien n'est enregistré et ton fichier n'est pas modifié.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Button
                onClick={() => setConfirmSelection(true)}
                disabled={busy}
                className="bg-violet-600 hover:bg-violet-700 gap-2"
              >
                {busy ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Récupérer ma sélection
              </Button>
              <span className="text-xs text-slate-500">ou</span>
              <Button
                onClick={() => fichierRef.current?.click()}
                disabled={busy}
                variant="outline"
                className="gap-2"
              >
                <FileUp className="h-4 w-4" />
                Ouvrir un fichier
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Glisse ici un .svg, .pdf ou .ai — pas besoin d'Illustrator
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={echelle10}
                onChange={(e) => setEchelle10(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-violet-600"
              />
              Mon fichier est dessiné au 1:10
            </label>
          </div>
        )}

        {input && (
          <>
            {/* vues, en surimpression sur la scène */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 rounded-full bg-black/45 backdrop-blur px-1.5 py-1">
              {VUES.map((v) => (
                <button
                  key={v.valeur}
                  type="button"
                  onClick={() => setVue(v.valeur)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    vue === v.valeur
                      ? "bg-white text-slate-900"
                      : "text-slate-200 hover:bg-white/15"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="absolute left-3 bottom-3 rounded-lg bg-black/50 backdrop-blur px-2.5 py-1.5 text-[11px] text-slate-200">
              <span className="font-medium">
                {Math.round(input.wMm)} × {Math.round(input.hMm)} mm
              </span>
              {opts.fixation !== "aplat" && (
                <span className="text-slate-400">
                  {" · "}
                  {nbFix} {opts.fixation === "lisses" ? "lisse(s)" : "point(s)"}
                  {duFichier && opts.fixation === "entretoises" ? " du fichier" : ""}
                </span>
              )}
              <span className="text-slate-500"> · glisser pour tourner</span>
            </div>
          </>
        )}
      </div>

      {/* Panneau de réglages */}
      {/* px-1 : sans cette réserve, l'anneau de sélection des pastilles est
          rogné par le bord de la colonne défilante */}
      <div className="flex flex-col gap-4 min-h-0 overflow-y-auto px-1">
        {input && (
          <Section titre="Enseigne">
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Largeur réelle
                </span>
                <span className="text-[11px] text-slate-400">
                  hauteur {Math.round(input.hMm)} mm
                </span>
              </div>
              {/* un PDF ou un SVG ne porte pas toujours l'échelle : il faut
                  pouvoir la rectifier, surtout pour un commercial */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={50}
                  step={10}
                  value={Math.round(input.wMm)}
                  onChange={(e) => {
                    const w = parseFloat(e.target.value);
                    if (!isFinite(w) || w <= 0) return;
                    setInput((p) => (p ? { ...p, hMm: (p.hMm * w) / p.wMm, wMm: w } : p));
                  }}
                  className="h-8"
                />
                <span className="text-xs text-slate-500 shrink-0">mm</span>
              </div>
            </div>
          </Section>
        )}

        {/* ⚠ L'enseigne DRAPEAU n'est pas finalisée : son moteur est en place
            (drapeau3d.ts, tout le bloc « Caisson » ci-dessous) mais il reste
            des défauts de rendu. On ne PROPOSE donc pas le choix tant que ce
            n'est pas au point — repasser DRAPEAU_PRET à true le rétablit,
            aucun code n'a été retiré. */}
        {DRAPEAU_PRET && (
          <Section titre="Type d'enseigne">
            <Segments
              valeur={opts.typeEnseigne}
              choix={[
                { v: "lettres" as const, label: "Lettres relief", icone: Box },
                { v: "drapeau" as const, label: "Drapeau", icone: Flag },
              ]}
              onChange={(v) => maj({ typeEnseigne: v })}
            />
          </Section>
        )}

        {opts.typeEnseigne === "drapeau" && (
          <Section titre="Caisson">
            <select
              value={opts.modeDrapeau}
              onChange={(e) => {
                const m = e.target.value as ModeDrapeau;
                const lum = MODES_DRAPEAU.find((x) => x.valeur === m)?.lumineux;
                // standards atelier : 40 mm en non lumineux, 70 en lumineux ;
                // 0,6 de puissance est le dosage jugé bon à l'usage
                maj({
                  modeDrapeau: m,
                  epaisseurCaissonMm: lum ? 70 : 40,
                  ...(lum ? { haloIntensite: 0.6 } : {}),
                });
              }}
              className="w-full h-8 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-sm dark:text-slate-200"
            >
              {MODES_DRAPEAU.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.label}
                </option>
              ))}
            </select>

            {(opts.modeDrapeau === "ajourageRelief" ||
              opts.modeDrapeau === "ajourageAPlat") && (
              <>
                <Button
                  onClick={recupererZone}
                  disabled={busy || !input || source !== "illustrator"}
                  size="sm"
                  className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Récupérer la zone lumineuse
                </Button>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Sélectionne dans Illustrator la forme à ajourer.
                  {input?.zoneLumineuse ? " Zone relevée." : ""}
                </p>
              </>
            )}
            {opts.modeDrapeau === "ajourageRelief" && (
              <Curseur
                label="Saillie de la zone"
                valeur={opts.saillieAjourageMm}
                min={2}
                max={60}
                suffixe=" mm"
                onChange={(n) => maj({ saillieAjourageMm: n })}
              />
            )}
            {MODES_DRAPEAU.find((m) => m.valeur === opts.modeDrapeau)?.lumineux && (
              <Curseur
                label="Puissance de l'éclairage"
                valeur={opts.haloIntensite}
                min={0.2}
                max={2}
                pas={0.1}
                onChange={(n) => maj({ haloIntensite: n })}
              />
            )}
            <Curseur
              label="Épaisseur du caisson"
              valeur={opts.epaisseurCaissonMm}
              min={20}
              max={150}
              pas={5}
              suffixe=" mm"
              onChange={(n) => maj({ epaisseurCaissonMm: n })}
            />
            <Curseur
              label="Écart au mur"
              valeur={opts.ecartMurMm}
              min={0}
              max={400}
              pas={10}
              suffixe=" mm"
              onChange={(n) => maj({ ecartMurMm: n })}
            />
            <Segments
              valeur={opts.potence}
              choix={[
                { v: "deuxTubes" as const, label: "Deux tubes", icone: Rows3 },
                { v: "monopotence" as const, label: "Monopotence", icone: Minus },
              ]}
              onChange={(v) => maj({ potence: v })}
            />
            <Curseur
              label="Section des tubes"
              valeur={opts.sectionTubeMm}
              min={15}
              max={80}
              pas={5}
              suffixe=" mm"
              onChange={(n) => maj({ sectionTubeMm: n })}
            />
            <div className="space-y-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Chant du caisson
              </span>
              <Pastilles
                valeur={opts.couleurChant}
                choix={CORPS}
                titre="Chant du caisson"
                onChange={(v) => maj({ couleurChant: v })}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">Potence</span>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={opts.potenceCommeCaisson}
                  onChange={(e) => maj({ potenceCommeCaisson: e.target.checked })}
                  className="h-3.5 w-3.5 rounded accent-violet-600"
                />
                Même RAL que le caisson
              </label>
              {!opts.potenceCommeCaisson && (
                <Pastilles
                  valeur={opts.couleurPotence}
                  choix={METAL}
                  titre="Peinture de la potence"
                  onChange={(v) => maj({ couleurPotence: v })}
                />
              )}
            </div>
            {MODES_DRAPEAU.find((m) => m.valeur === opts.modeDrapeau)?.lumineux && (
              <div className="space-y-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Couleur de diffusion
                </span>
                <Pastilles
                  valeur={opts.couleurDiffusion}
                  choix={TEINTES_HALO}
                  titre="Lumière du caisson"
                  onChange={(v) => maj({ couleurDiffusion: v })}
                />
              </div>
            )}
          </Section>
        )}

        {opts.typeEnseigne === "lettres" && (
        <Section titre="Fixation">
          <Segments
            valeur={opts.fixation}
            choix={FIXATION_CHOIX}
            onChange={(v) =>
              maj({ fixation: v, deportMm: v === "lisses" ? opts.sectionLisseMm : opts.deportMm })
            }
          />
          {opts.fixation !== "aplat" && (
            <Curseur
              label="Déport du mur"
              valeur={opts.deportMm}
              min={5}
              max={200}
              pas={5}
              suffixe=" mm"
              onChange={(n) => maj({ deportMm: n })}
            />
          )}
          {opts.fixation === "tiges" && (
            <Curseur
              label="Diamètre des tiges"
              valeur={opts.tigeDiamMm}
              min={3}
              max={12}
              pas={0.5}
              suffixe=" mm"
              onChange={(n) => maj({ tigeDiamMm: n })}
            />
          )}
          {opts.fixation === "lisses" && (
            <div className="space-y-2">
              {/* deux choix structurants : ils pilotent tout le reste */}
              <Segments
                valeur={opts.lissesAuto ? "auto" : "fichier"}
                choix={[
                  { v: "auto", label: "Calculées", icone: Wand2 },
                  { v: "fichier", label: "Les miennes", icone: FileDown },
                ]}
                onChange={(v) => maj({ lissesAuto: v === "auto" })}
              />
              <Segments
                valeur={opts.entretoisesSurLisses ? "avec" : "sans"}
                choix={[
                  { v: "sans", label: "Lettres collées", icone: Square },
                  { v: "avec", label: "Sur entretoises", icone: CircleDot },
                ]}
                onChange={(v) => {
                  const avec = v === "avec";
                  maj({
                    entretoisesSurLisses: avec,
                    // avec entretoises il faut de la place devant la lisse ;
                    // sans, les lettres doivent se recoller dessus
                    deportMm: avec
                      ? Math.max(opts.deportMm, opts.sectionLisseMm + 30)
                      : opts.sectionLisseMm,
                  });
                }}
              />
              {opts.entretoisesSurLisses && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Les entretoises se placent aux croisements lisse × lettre,
                  jamais dans le vide.
                </p>
              )}
              {opts.lissesAuto ? (
                <>
                  <Curseur
                    label="Lisses par mot"
                    valeur={opts.nbLisses}
                    min={1}
                    max={4}
                    onChange={(n) => maj({ nbLisses: n })}
                  />
                  <Curseur
                    label="Retrait haut / bas"
                    valeur={opts.retraitLissePct}
                    min={0}
                    max={45}
                    suffixe=" %"
                    onChange={(n) => maj({ retraitLissePct: n })}
                  />
                  {nonTenus > 0 && (
                    <p className="rounded-md bg-amber-50 dark:bg-amber-900/25 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                      {nonTenus} élément(s) ne touchent aucune lisse — passe sur
                      « Les miennes » et reprends celles de ta maquette.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setConfirmLisses(true)}
                    disabled={busy || !input}
                    size="sm"
                    className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                    Récupérer mes lisses (sélection)
                  </Button>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Sélectionne tes barres dans Illustrator — position,
                    longueur et inclinaison sont reprises telles quelles.
                    {input?.lisses?.length
                      ? ` ${input.lisses.length} reprise(s).`
                      : ""}
                  </p>
                </>
              )}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Peinture des lisses
                </span>
                <Pastilles
                  valeur={opts.couleurLisse}
                  choix={METAL}
                  onChange={(v) => maj({ couleurLisse: v })}
                />
              </div>
            </div>
          )}
        </Section>
        )}

        {/* l'éclairage des lettres ne s'applique pas à un caisson drapeau :
            c'est son intérieur qui s'allume, pas une source extérieure */}
        {opts.typeEnseigne === "lettres" && (
        <Section titre="Éclairage">
          <Segments
            valeur={opts.eclairage}
            choix={ECLAIRAGE_CHOIX}
            colonnes={4}
            onChange={(v) => maj({ eclairage: v })}
          />
          {opts.eclairage !== "aucun" && (
            <Curseur
              label="Intensité"
              valeur={opts.haloIntensite}
              min={0.2}
              max={2}
              pas={0.1}
              onChange={(n) => maj({ haloIntensite: n })}
            />
          )}
          {estAjourage(opts.eclairage) && (
            <>
              <Button
                onClick={recupererZone}
                disabled={busy || !input || source !== "illustrator"}
                size="sm"
                className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Récupérer la zone lumineuse
              </Button>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Sélectionne dans Illustrator la partie ajourée — sur l'exemple du
                « 10ème AVENUE », le texte, le filet et les étoiles, pas le fond du
                caisson.
                {input?.zoneLumineuse ? " Zone relevée." : ""}
              </p>
              {/* ⚠ Les leds sont blanches, mais l'adhésif est devant : la zone
                  s'allume aux couleurs du fichier, dégradé compris. Il n'y a donc
                  PAS de couleur de leds à choisir ici. */}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                La zone s'allume aux couleurs de ton fichier, dégradé compris —
                c'est l'adhésif qui teinte la lumière des leds blanches.
              </p>
            </>
          )}
          {opts.eclairage === "ajourageRelief" && (
            <Curseur
              label="Saillie de la zone"
              valeur={opts.saillieAjourageMm}
              min={5}
              max={80}
              pas={5}
              onChange={(n) => maj({ saillieAjourageMm: n })}
            />
          )}
          {opts.eclairage === "retro" && (
            <div className="space-y-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Couleur des leds (source arrière)
              </span>
              <Pastilles
                valeur={opts.couleurHalo}
                choix={TEINTES_HALO}
                onChange={(v) => maj({ couleurHalo: v })}
              />
            </div>
          )}
          {opts.eclairage === "rampe" && (
            <>
              <Curseur
                label="Longueur de la rampe"
                valeur={opts.rampeLongueurPct}
                min={30}
                max={130}
                pas={5}
                suffixe=" %"
                onChange={(n) => maj({ rampeLongueurPct: n })}
              />
              <div className="space-y-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Peinture de la rampe
                </span>
                <Pastilles
                  valeur={opts.couleurRampe}
                  choix={CORPS}
                  onChange={(v) => maj({ couleurRampe: v })}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Couleur de sa lumière
                </span>
                <Pastilles
                  valeur={opts.couleurLumiereRampe}
                  choix={TEINTES_HALO}
                  onChange={(v) => maj({ couleurLumiereRampe: v })}
                />
              </div>
            </>
          )}
          {opts.eclairage === "spot" && (
            <>
              <Curseur
                label="Nombre de spots"
                valeur={opts.nbSpots}
                min={1}
                max={8}
                onChange={(n) => maj({ nbSpots: n })}
              />
              <div className="space-y-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Peinture des spots
                </span>
                <Pastilles
                  valeur={opts.couleurSpots}
                  choix={CORPS}
                  onChange={(v) => maj({ couleurSpots: v })}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Couleur de leur lumière
                </span>
                <Pastilles
                  valeur={opts.couleurLumiereSpots}
                  choix={TEINTES_HALO}
                  onChange={(v) => maj({ couleurLumiereSpots: v })}
                />
              </div>
            </>
          )}
        </Section>
        )}

        <Section titre="Matières">
          {opts.typeEnseigne === "lettres" && (
          <div className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Tranche des lettres
            </span>
            <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={opts.trancheCommeFace}
                onChange={(e) => maj({ trancheCommeFace: e.target.checked })}
                className="h-3.5 w-3.5 rounded accent-violet-600"
              />
              Couleur de la face (chaque lettre garde la sienne)
            </label>
            {!opts.trancheCommeFace && (
              <Pastilles
                valeur={opts.couleurTranche}
                choix={NEUTRES}
                titre="Tranche des lettres"
                onChange={(v) => maj({ couleurTranche: v })}
              />
            )}
          </div>
          )}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-300">Mur</span>
            <div className="grid grid-cols-3 gap-1">
              {MOTIFS_MUR.map((m) => (
                <button
                  key={m.valeur}
                  type="button"
                  onClick={() =>
                    // le motif propose sa teinte d'usage ; la palette
                    // en dessous reste libre de la reprendre
                    maj({ motifMur: m.valeur, couleurMur: m.couleur })
                  }
                  className={`rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                    opts.motifMur === m.valeur
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Pastilles
              valeur={opts.couleurMur}
              choix={NEUTRES}
              titre="Couleur du mur"
              onChange={(v) => maj({ couleurMur: v })}
            />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            La face des lettres reprend les couleurs de ton fichier Illustrator.
          </p>
        </Section>

        {/* réglages secondaires, repliés par défaut */}
        <button
          type="button"
          onClick={() => setPlusDeReglages((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${plusDeReglages ? "" : "-rotate-90"}`}
          />
          Réglages avancés
        </button>
        {plusDeReglages && (
          <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <Curseur
              label="Épaisseur des lettres"
              valeur={opts.epaisseurMm}
              min={3}
              max={80}
              suffixe=" mm"
              onChange={(n) => maj({ epaisseurMm: n })}
            />
            <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={opts.couleursDuFichier}
                onChange={(e) => maj({ couleursDuFichier: e.target.checked })}
                className="h-3.5 w-3.5 rounded accent-violet-600"
              />
              Utiliser les couleurs du fichier
            </label>
            <div className="space-y-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Dos des lettres
              </span>
              <Pastilles
                valeur={opts.couleurArriere}
                choix={NEUTRES}
                onChange={(v) => maj({ couleurArriere: v })}
              />
            </div>
          </div>
        )}

        {/* actions */}
        <div className="mt-auto space-y-2 pt-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
            {[
              [false, "Échelle 1:1"],
              [true, "Échelle 1:10"],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setExportAu10e(v as boolean)}
                className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                  exportAu10e === v
                    ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
          {/* Illustrator limite son espace de travail à 227 pouces : au-delà,
              le rendu ne peut pas se poser à côté de la maquette */}
          {input && !exportAu10e && input.wMm > 2500 && (
            <p className="rounded-md bg-amber-50 dark:bg-amber-900/25 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              Enseigne de {(input.wMm / 1000).toFixed(1)} m : à l'échelle 1:1 elle
              ne tiendra pas à côté de ta maquette et partira dans un nouveau
              document. Choisis 1:10 pour l'avoir à côté.
            </p>
          )}
          <Button
            onClick={() => envoyerVersIllustrator(false)}
            disabled={!input || envoi}
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
          >
            {envoi ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Envoyer le BAT dans Illustrator
          </Button>
          <Button
            onClick={() => envoyerVersIllustrator(true)}
            disabled={!input || envoi}
            variant="outline"
            className="w-full gap-2"
            title="Enseigne détourée sur fond transparent — pour la poser sur une photo de devanture"
          >
            <Scissors className="h-4 w-4" />
            Envoyer détourée (devanture)
          </Button>

          {/* téléchargement direct : pour qui n'a pas Illustrator */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Télécharger le PNG
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => telechargerPng(false)}
                disabled={!input}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Avec le fond
              </Button>
              <Button
                onClick={() => telechargerPng(true)}
                disabled={!input}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Scissors className="h-3.5 w-3.5" />
                Détouré
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setConfirmSelection(true)}
              disabled={busy || source !== "illustrator"}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-slate-500 dark:text-slate-400"
              title={
                source === "illustrator"
                  ? "Relit la sélection dans Illustrator en conservant tes réglages"
                  : "Disponible seulement pour une sélection Illustrator — un fichier importé se reglisse"
              }
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </Button>
            <Button
              onClick={reinitialiser}
              disabled={busy}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-slate-500 dark:text-slate-400"
              title="Repart de zéro : réglages par défaut et nouvelle lecture du fichier"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tout remettre à zéro
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}