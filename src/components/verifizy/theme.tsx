/**
 * VérifIzy — identité propre (validée par Jordan le 20/10/2026) : « un logiciel
 * dans le logiciel », aux couleurs Les Enseignistes (bleu #186FB7, losange),
 * thème sombre par défaut, clair au choix (mémorisé par poste).
 *
 * Les couleurs passent par des variables CSS posées sur la racine du module :
 * les composants écrivent `bg-[var(--vz-surface)]`, le thème change d'un coup.
 */
import { useEffect, useState } from "react";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";

export type NomTheme = "sombre" | "clair";

const THEMES: Record<NomTheme, Record<string, string>> = {
  sombre: {
    "--vz-bg": "#0A1424", "--vz-surface": "#111E33", "--vz-surface2": "#18294A", "--vz-border": "#233657",
    "--vz-text": "#EAF1FB", "--vz-muted": "#9DB0CB", "--vz-accent": "#186FB7", "--vz-accent-hi": "#4DA3E8",
    "--vz-err": "#F97066", "--vz-err-bg": "rgba(240,68,56,0.14)", "--vz-err-bord": "rgba(240,68,56,0.45)",
    "--vz-ale": "#FDB022", "--vz-ale-bg": "rgba(247,144,9,0.14)", "--vz-ale-bord": "rgba(247,144,9,0.40)",
    "--vz-que": "#84ADFF", "--vz-que-bg": "rgba(41,112,255,0.16)", "--vz-que-bord": "rgba(41,112,255,0.45)",
    "--vz-ok": "#47CD89", "--vz-ok-bg": "rgba(23,178,106,0.14)",
  },
  clair: {
    "--vz-bg": "#F3F6FA", "--vz-surface": "#FFFFFF", "--vz-surface2": "#EEF3F9", "--vz-border": "#DCE4EE",
    "--vz-text": "#0F1B2D", "--vz-muted": "#52627A", "--vz-accent": "#186FB7", "--vz-accent-hi": "#186FB7",
    "--vz-err": "#B42318", "--vz-err-bg": "#FEF3F2", "--vz-err-bord": "#F4B4AE",
    "--vz-ale": "#93370D", "--vz-ale-bg": "#FFF6E5", "--vz-ale-bord": "#F5CF8E",
    "--vz-que": "#1849A9", "--vz-que-bg": "#EEF4FF", "--vz-que-bord": "#B2CCFF",
    "--vz-ok": "#067647", "--vz-ok-bg": "#ECFDF3",
  },
};

const CLE = "verifizy_theme";

export function useThemeVerifizy() {
  const [theme, setTheme] = useState<NomTheme>(() => {
    try { return (localStorage.getItem(CLE) as NomTheme) || "sombre"; } catch { return "sombre"; }
  });
  useEffect(() => {
    try { localStorage.setItem(CLE, theme); } catch { /* sans stockage : sombre par défaut */ }
  }, [theme]);
  return {
    theme,
    variables: THEMES[theme] as React.CSSProperties,
    basculer: () => setTheme((t) => (t === "sombre" ? "clair" : "sombre")),
  };
}

/** Polices du module */
export const SORA = { fontFamily: "'Sora', system-ui, sans-serif" };
export const FIGTREE = { fontFamily: "'Figtree', system-ui, sans-serif" };
export const MONO = { fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace" };

/** Le losange Les Enseignistes, avec la coche */
export function LogoVerifizy({ taille = 36 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 40 40" role="img" aria-label="VérifIzy">
      <rect x="8.5" y="8.5" width="23" height="23" rx="5" transform="rotate(45 20 20)" fill="#186FB7" />
      <path d="M13.6 20.4l4.4 4.4 8.4-9" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NomVerifizy({ taille = 20 }: { taille?: number }) {
  return (
    <span style={{ ...SORA, fontWeight: 800, fontSize: taille, letterSpacing: -0.5 }}>
      Vérif<span className="text-[var(--vz-accent-hi)]">Izy</span>
    </span>
  );
}

/** Pastille de niveau (erreur, alerte, question, remarque, conforme) */
export const NIVEAUX = {
  erreur: { nom: "Erreur", classe: "text-[var(--vz-err)] bg-[var(--vz-err-bg)]", bord: "border-[var(--vz-err-bord)]" },
  alerte: { nom: "Alerte", classe: "text-[var(--vz-ale)] bg-[var(--vz-ale-bg)]", bord: "border-[var(--vz-ale-bord)]" },
  question: { nom: "Question", classe: "text-[var(--vz-que)] bg-[var(--vz-que-bg)]", bord: "border-[var(--vz-que-bord)]" },
  remarque: { nom: "Remarque", classe: "text-[var(--vz-muted)] bg-[var(--vz-surface2)]", bord: "border-[var(--vz-border)]" },
  ok: { nom: "Conforme", classe: "text-[var(--vz-ok)] bg-[var(--vz-ok-bg)]", bord: "border-[var(--vz-border)]" },
} as const;

/* Classes récurrentes */
export const CARTE = "rounded-2xl bg-[var(--vz-surface)] border border-[var(--vz-border)]";
export const BOUTON_PRINCIPAL =
  "inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-xl bg-[var(--vz-accent)] text-white font-bold text-[15px] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed";
export const BOUTON_SECONDAIRE =
  "inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl border border-[var(--vz-border)] text-[var(--vz-text)] font-semibold text-[15px] hover:bg-[var(--vz-surface2)] disabled:opacity-40";
