/**
 * Vérif FAB — éléments d'affichage de la discussion : texte mis en forme,
 * messages, carte de rapport, carte de questions à boutons.
 */
import { useState } from "react";
import {
  ShieldCheck, FolderOpen, FileText, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle,
  HelpCircle, Wrench, Brain, Lightbulb, Send, Info,
} from "lucide-react";
import type { Bloc, GroupeCiblage, MessageApi, Question, Rapport } from "@/lib/verifFab/conversation";

export const MARQUE_INVENTAIRE = "[INVENTAIRE]";

/* ------------------------------------------------------------ texte */

function enLigne(t: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > dernier) out.push(t.slice(dernier, m.index));
    const x = m[0];
    out.push(x.startsWith("**")
      ? <strong key={m.index}>{x.slice(2, -2)}</strong>
      : <code key={m.index} className="px-1 rounded bg-gray-100 dark:bg-slate-700 text-[0.9em]">{x.slice(1, -1)}</code>);
    dernier = m.index + x.length;
  }
  if (dernier < t.length) out.push(t.slice(dernier));
  return out;
}

/** Lignes consécutives « | a | b | » regroupées en un vrai tableau (défilant s'il est trop large) */
function Tableau({ lignes }: { lignes: string[] }) {
  const cellules = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const utiles = lignes.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l));
  const [tete, ...corps] = utiles.map(cellules);
  return (
    <div className="max-w-full overflow-x-auto my-1">
      <table className="text-[12px] border-collapse">
        {tete && <thead><tr>{tete.map((c, i) => <th key={i} className="text-left font-semibold px-2 py-1 border-b border-current/20 whitespace-nowrap">{enLigne(c)}</th>)}</tr></thead>}
        <tbody>{corps.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1 align-top whitespace-nowrap">{enLigne(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Markdown({ texte }: { texte: string }) {
  const blocs: (string | string[])[] = [];
  for (const l of texte.split("\n")) {
    const dernier = blocs[blocs.length - 1];
    if (/^\s*\|/.test(l)) { if (Array.isArray(dernier)) dernier.push(l); else blocs.push([l]); }
    else blocs.push(l);
  }
  return (
    <div className="space-y-1 leading-relaxed min-w-0 [overflow-wrap:anywhere]">
      {blocs.map((l, i) => {
        if (Array.isArray(l)) return <Tableau key={i} lignes={l} />;
        if (/^#{1,4}\s/.test(l)) return <p key={i} className="font-semibold mt-2">{enLigne(l.replace(/^#+\s/, ""))}</p>;
        if (/^\s*[-*•]\s/.test(l)) return <p key={i} className="pl-4 -indent-3">• {enLigne(l.replace(/^\s*[-*•]\s/, ""))}</p>;
        if (/^\s*\d+[.)]\s/.test(l)) return <p key={i} className="pl-4 -indent-3">{enLigne(l.trim())}</p>;
        if (!l.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{enLigne(l)}</p>;
      })}
    </div>
  );
}

/* ------------------------------------------------------------ rapport */

// erreur : bloque la FAB ; alerte : conseil non suivi, coquille — on notifie sans bloquer (Jordan, 20/10/2026)
const ORDRE: Record<string, number> = { erreur: 0, question: 1, alerte: 2, ok: 3 };
const ICONE = (s: string) =>
  s === "ok" ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
    : s === "erreur" ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      : s === "alerte" ? <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        : <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;

export function CarteRapport({ r }: { r: Rapport }) {
  // classes écrites en entier : Tailwind ne génère pas une classe composée à la volée
  const t = {
    conforme: { cadre: "border-emerald-300 dark:border-emerald-500/50", titre: "text-emerald-700 dark:text-emerald-300", nom: "Dossier conforme" },
    a_corriger: { cadre: "border-red-300 dark:border-red-500/50", titre: "text-red-700 dark:text-red-300", nom: "Dossier à corriger" },
    questions_en_suspens: { cadre: "border-amber-300 dark:border-amber-500/50", titre: "text-amber-700 dark:text-amber-300", nom: "Questions en suspens" },
  }[r.verdict] ?? { cadre: "border-gray-300", titre: "text-gray-700", nom: "Rapport" };
  return (
    <div className={`rounded-xl border-2 ${t.cadre} bg-white dark:bg-slate-800 p-4`}>
      <div className={`font-semibold ${t.titre} flex items-center gap-2`}>
        <ShieldCheck className="w-5 h-5" /> Rapport — {t.nom}
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{r.resume}</p>
      <div className="mt-3 space-y-1.5">
        {[...(r.points ?? [])].sort((a, b) => (ORDRE[a.statut] ?? 9) - (ORDRE[b.statut] ?? 9)).map((p, i) => (
          <div key={i} className="flex gap-2 text-sm">
            {ICONE(p.statut)}
            <div>
              <span className="text-gray-800 dark:text-slate-100">{p.constat}</span>
              {p.fichier && <span className="block text-xs text-gray-400 dark:text-slate-500">{p.fichier}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bilan */

/** Bilan d'étape : erreurs, puis alertes, puis une ligne pour tout ce qui est conforme */
export function Bilan({ erreurs, alertes = [], conforme }: { erreurs: string[]; alertes?: string[]; conforme: string }) {
  if (!erreurs.length && !alertes.length && !conforme) return null;
  return (
    <div className="space-y-1.5 text-sm">
      {erreurs.map((e, i) => (
        <div key={i} className="flex gap-2"><AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span>{e}</span></div>
      ))}
      {alertes.map((e, i) => (
        <div key={`a${i}`} className="flex gap-2 text-gray-700 dark:text-slate-300"><Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" /><span>{e}</span></div>
      ))}
      {conforme && (
        <div className="flex gap-2 text-gray-600 dark:text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>{conforme}</span></div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ questions */

export function CarteQuestions({
  questions,
  actif,
  onRepondre,
}: {
  questions: Question[];
  actif: boolean;
  onRepondre: (reponses: string[], precision: string) => void;
}) {
  const [choix, setChoix] = useState<string[]>(() => questions.map(() => ""));
  const [precision, setPrecision] = useState("");
  const complet = choix.every((c) => c.trim());
  return (
    <div className="rounded-xl border-2 border-amber-300 dark:border-amber-500/50 bg-amber-50/60 dark:bg-amber-500/10 p-4 space-y-4">
      <div className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <HelpCircle className="w-5 h-5" /> {questions.length > 1 ? `${questions.length} questions` : "Une question"} avant de conclure
      </div>
      {questions.map((q, i) => (
        <div key={i} className="space-y-2">
          <p className="text-sm text-gray-800 dark:text-slate-100"><span className="font-semibold">{i + 1}.</span> {q.question}</p>
          <div className="flex flex-wrap gap-2">
            {q.choix.map((c) => (
              <button key={c} disabled={!actif}
                onClick={() => setChoix((v) => v.map((x, j) => (j === i ? c : x)))}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
                  choix[i] === c
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-blue-400"
                }`}>
                {c}
              </button>
            ))}
            <input
              value={q.choix.includes(choix[i]) ? "" : choix[i]}
              onChange={(e) => setChoix((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              disabled={!actif}
              placeholder="Autre réponse…"
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 min-w-[12rem] flex-1"
            />
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input value={precision} onChange={(e) => setPrecision(e.target.value)} disabled={!actif}
          placeholder="Une précision à ajouter ? (facultatif)"
          className="flex-1 px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
        <button disabled={!actif || !complet} onClick={() => onRepondre(choix, precision)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2">
          <Send className="w-4 h-4" /> Répondre
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ ciblage */

/** Fichiers annexes proposés à l'examen : le graphiste coche, seuls ceux-là sont lus */
export function CarteCiblage({
  groupes,
  actif,
  onValider,
}: {
  groupes: GroupeCiblage[];
  actif: boolean;
  onValider: (choisis: string[]) => void;
}) {
  const [coches, setCoches] = useState<Set<string>>(
    () => new Set(groupes.flatMap((g) => g.fichiers.filter((f) => f.conseille).map((f) => f.chemin)))
  );
  const basculer = (c: string) =>
    setCoches((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  return (
    <div className="rounded-xl border-2 border-sky-300 dark:border-sky-500/50 bg-sky-50/60 dark:bg-sky-500/10 p-4 space-y-3">
      <div className="font-semibold text-sky-800 dark:text-sky-200 flex items-center gap-2">
        <FolderOpen className="w-5 h-5" /> Quels fichiers dois-je examiner ?
      </div>
      <p className="text-xs text-sky-700 dark:text-sky-300">Coche seulement ce qui peut révéler un problème : je ne lirai que ces fichiers.</p>
      {groupes.map((g) => (
        <div key={g.titre} className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{g.titre}</p>
          {g.fichiers.map((f) => (
            <label key={f.chemin} className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={coches.has(f.chemin)} disabled={!actif} onChange={() => basculer(f.chemin)} className="mt-1" />
              <span>
                <span className="font-mono text-xs text-gray-800 dark:text-slate-100 break-all">{f.chemin}</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">{f.pourquoi}</span>
              </span>
            </label>
          ))}
        </div>
      ))}
      <div className="flex justify-end">
        <button disabled={!actif} onClick={() => onValider([...coches])}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2">
          <Send className="w-4 h-4" /> {coches.size ? `Examiner ${coches.size} fichier${coches.size > 1 ? "s" : ""}` : "N'examiner aucun fichier"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ messages */

function BlocReflexion({ texte }: { texte: string }) {
  const [ouvert, setOuvert] = useState(false);
  if (!texte.trim()) return null;
  return (
    <button onClick={() => setOuvert(!ouvert)} className="text-left w-full text-xs text-gray-400 dark:text-slate-500">
      <span className="inline-flex items-center gap-1">
        {ouvert ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Brain className="w-3 h-3" /> Réflexion
      </span>
      {ouvert && <div className="mt-1 pl-4 border-l-2 border-gray-200 dark:border-slate-700 whitespace-pre-wrap">{texte}</div>}
    </button>
  );
}

const LIBELLE_OUTIL: Record<string, string> = {
  analyser_pdf: "Mesure",
  voir_page: "Regarde",
  voir_image: "Regarde",
  comparer_visuels: "Compare",
  lister_dossier: "Inventaire du dossier",
};

const OUTILS_DISCRETS = new Set(["analyser_pdf", "voir_page", "voir_image", "lister_dossier", "comparer_visuels"]);

/** « Mesure ×3 · Regarde ×2 », le détail des fichiers au survol */
function LigneOutils({ blocs }: { blocs: Bloc[] }) {
  const outils = blocs.filter((b) => b.type === "tool_use" && OUTILS_DISCRETS.has(b.name));
  if (!outils.length) return null;
  const compte = new Map<string, number>();
  for (const b of outils) compte.set(LIBELLE_OUTIL[b.name], (compte.get(LIBELLE_OUTIL[b.name]) ?? 0) + 1);
  const detail = outils.map((b) => `${LIBELLE_OUTIL[b.name]} ${b.input?.chemin ?? ""}${b.input?.page ? ` p.${b.input.page}` : ""}`).join("\n");
  return (
    <div title={detail} className="text-xs text-gray-400 dark:text-slate-500 inline-flex items-center gap-1">
      <Wrench className="w-3 h-3" /> {[...compte.entries()].map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(" · ")}
    </div>
  );
}

/** Réponses aux questions (résultat de poser_questions) : « 1. … \n→ … » */
const estReponse = (b: Bloc) =>
  b.type === "tool_result" && typeof b.content === "string" &&
  (b.content.includes("\n→ ") || b.content.startsWith("Fichiers cochés") || b.content.startsWith("Le graphiste n'a coché"));

export function Message({ m }: { m: MessageApi }) {
  const [inventaireOuvert, setInventaireOuvert] = useState(false);
  if (m.role === "user") {
    const reponses = m.content.filter(estReponse);
    const visibles = m.content.filter((b) => b.type !== "tool_result");
    if (!reponses.length && !visibles.length) return null;
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-blue-600 text-white px-4 py-2.5 space-y-2 text-sm">
          {reponses.map((b, i) => (
            <div key={`r${i}`} className="whitespace-pre-wrap">{String(b.content).replace(/\n→ /g, "\n→ ")}</div>
          ))}
          {visibles.map((b: Bloc, i) => {
            if (b.type === "text" && b.text.startsWith(MARQUE_INVENTAIRE))
              return (
                <button key={i} onClick={() => setInventaireOuvert(!inventaireOuvert)} className="text-left text-blue-100 text-xs block">
                  <span className="inline-flex items-center gap-1"><FolderOpen className="w-3 h-3" /> Inventaire du dossier {inventaireOuvert ? "▾" : "▸"}</span>
                  {inventaireOuvert && <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px]">{b.text.slice(MARQUE_INVENTAIRE.length)}</pre>}
                </button>
              );
            if (b.type === "text") return <p key={i} className="whitespace-pre-wrap">{b.text}</p>;
            if (b.type === "document") return <p key={i} className="inline-flex items-center gap-1 text-blue-100"><FileText className="w-4 h-4" /> {b.title ?? "Document"}</p>;
            if (b.type === "image") return <p key={i} className="text-blue-100 text-xs">🖼 Image jointe</p>;
            return null;
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm text-gray-800 dark:text-slate-100">
      {m.content.map((b: Bloc, i) => {
        if (b.type === "thinking") return <BlocReflexion key={i} texte={b.thinking ?? ""} />;
        if (b.type === "text" && b.text.trim()) return <Markdown key={i} texte={b.text} />;
        if (b.type === "tool_use") {
          if (b.name === "rendre_rapport") return <CarteRapport key={i} r={b.input as Rapport} />;
          // le bilan reste dans l'historique ; les boutons, eux, sont affichés par la page
          if (b.name === "poser_questions") return <Bilan key={i} erreurs={b.input?.erreurs ?? []} alertes={b.input?.alertes ?? []} conforme={b.input?.conforme ?? ""} />;
          if (b.name === "cibler_fichiers") return null; // carte à cases affichée par la page
          if (b.name === "proposer_regle")
            return (
              <div key={i} className="text-xs rounded-lg border border-violet-200 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-200 px-3 py-2 flex gap-2">
                <Lightbulb className="w-4 h-4 shrink-0" />
                <span>Règle proposée à Jordan — <strong>{b.input?.titre}</strong> : {b.input?.texte}</span>
              </div>
            );
          return null; // regroupés sur une ligne, plus bas
        }
        return null;
      })}
      <LigneOutils blocs={m.content} />
    </div>
  );
}

/** Questions déjà répondues, affichées en lecture seule dans l'historique */
export function questionsDuMessage(m: MessageApi): Question[] | null {
  const q = m.content.find((b) => b.type === "tool_use" && b.name === "poser_questions");
  return q ? ((q.input?.questions ?? []) as Question[]) : null;
}
