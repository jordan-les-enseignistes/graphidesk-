/**
 * VérifIzy — analyse en cours : étapes, pourcentage, durée restante, ce que
 * l'assistant fait en ce moment ; puis, s'il en a, son bilan et ses questions
 * (réponses par boutons) avant le rapport.
 */
import { useState } from "react";
import { Check, Send } from "lucide-react";
import type { Attente } from "@/lib/verifFab/conversation";
import { formaterDuree } from "@/lib/verifFab/inventaire";
import { BOUTON_PRINCIPAL, CARTE, MONO, NIVEAUX, SORA } from "./theme";

export type EtatEtape = "fait" | "encours" | "avenir";
export interface Etape { nom: string; etat: EtatEtape; compte?: string }

export interface Progression {
  etapes: Etape[];
  pourcent: number;
  resteSec: number | null;
  action: string;
}

export function EcranAnalyse(props: {
  titre: string;
  progression: Progression;
  occupe: boolean;
  attente: Attente | null;
  bilan: { erreurs: string[]; alertes: string[]; conforme: string } | null;
  onRepondre: (reponses: string[], precision: string) => void;
  onCibler: (choisis: string[]) => void;
  /** présent quand l'analyse s'est arrêtée sans rapport ni question */
  onRelancer?: () => void;
}) {
  const p = props.progression;
  return (
    <main className="w-full max-w-[960px] mx-auto px-8 pt-10 pb-14 flex flex-col gap-5">
      <section className={`${CARTE} p-[30px] flex flex-col gap-6`}>
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <span className="text-[13px] font-bold tracking-[1px] uppercase text-[var(--vz-accent-hi)]">Étape 2 sur 2 · Analyse</span>
            <h1 style={SORA} className="mt-1.5 mb-0 font-bold text-[28px] tracking-[-0.5px]">
              {props.attente ? "J'ai besoin de toi avant de conclure" : props.titre}
            </h1>
          </div>
          <div className="text-right">
            <span style={SORA} className="block font-bold text-[30px] text-[var(--vz-accent-hi)]">{Math.round(p.pourcent)} %</span>
            <span className="text-[14px] text-[var(--vz-muted)]">
              {props.attente ? "en attente de tes réponses" : p.resteSec != null ? `encore environ ${formaterDuree(p.resteSec)}` : "estimation en cours…"}
            </span>
          </div>
        </div>

        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.pourcent)} aria-label="Progression de l'analyse"
          className="h-3 rounded-full bg-[var(--vz-surface2)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--vz-accent)] transition-[width] duration-700" style={{ width: `${p.pourcent}%` }} />
        </div>

        <ol className="list-none m-0 p-0 grid gap-2" style={{ gridTemplateColumns: `repeat(${p.etapes.length}, minmax(0, 1fr))` }}>
          {p.etapes.map((e, i) => (
            <li key={e.nom} className="flex flex-col items-center gap-2 text-center">
              <span className={`w-[34px] h-[34px] rounded-full border-2 flex items-center justify-center text-[12px] font-extrabold ${
                e.etat === "fait" ? "bg-[var(--vz-accent)] border-[var(--vz-accent)] text-white"
                  : e.etat === "encours" ? "border-[var(--vz-accent-hi)] text-[var(--vz-accent-hi)]"
                    : "bg-[var(--vz-surface2)] border-[var(--vz-surface2)] text-[var(--vz-muted)]"}`}>
                {e.etat === "fait" ? <Check className="w-4 h-4" /> : e.compte ?? i + 1}
              </span>
              <span className={`text-[13px] font-semibold ${e.etat === "encours" ? "text-[var(--vz-accent-hi)]" : e.etat === "fait" ? "" : "text-[var(--vz-muted)]"}`}>{e.nom}</span>
            </li>
          ))}
        </ol>

        {props.occupe && (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--vz-surface2)]">
            <span className="w-[9px] h-[9px] rounded-full bg-[var(--vz-accent-hi)] shrink-0 animate-pulse" />
            <span className="text-[15px]">{p.action}</span>
          </div>
        )}
      </section>

      {props.bilan && (props.bilan.erreurs.length > 0 || props.bilan.alertes.length > 0 || props.bilan.conforme) && (
        <section className="flex flex-col gap-2.5">
          <h2 style={SORA} className="m-0 font-semibold text-[17px]">Déjà repéré</h2>
          {props.bilan.erreurs.map((t, i) => <Ligne key={`e${i}`} niveau="erreur" texte={t} />)}
          {props.bilan.alertes.map((t, i) => <Ligne key={`a${i}`} niveau="alerte" texte={t} />)}
          {props.bilan.conforme && <Ligne niveau="ok" texte={props.bilan.conforme} />}
        </section>
      )}

      {props.attente && !props.occupe && (props.attente.ciblage
        ? <CarteCiblageVz key={props.attente.toolUseId} attente={props.attente} onValider={props.onCibler} />
        : <CarteQuestionsVz key={props.attente.toolUseId} attente={props.attente} onRepondre={props.onRepondre} />)}

      {props.occupe && !props.attente && (
        <p className="text-[14px] text-[var(--vz-muted)] m-0">Tu peux aller ailleurs dans GraphiDesk : l'analyse continue et je te préviens dès que j'ai fini. Ne ferme pas l'application.</p>
      )}

      {!props.occupe && !props.attente && props.onRelancer && (
        <section className={`${CARTE} p-[22px] flex flex-wrap gap-4 items-center justify-between`}>
          <span className="text-[15px]">Cette analyse s'est interrompue avant le rapport (application fermée ou coupure réseau).</span>
          <button type="button" onClick={props.onRelancer} className={BOUTON_PRINCIPAL}>Relancer la vérification</button>
        </section>
      )}
    </main>
  );
}

function Ligne({ niveau, texte }: { niveau: keyof typeof NIVEAUX; texte: string }) {
  const n = NIVEAUX[niveau];
  return (
    <div className={`${CARTE} flex gap-3 items-start px-4 py-3.5`}>
      <span className={`text-[12px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${n.classe}`}>{n.nom}</span>
      <span className="text-[15px]">{texte}</span>
    </div>
  );
}

function CarteQuestionsVz({ attente, onRepondre }: { attente: Attente; onRepondre: (r: string[], p: string) => void }) {
  const [choix, setChoix] = useState<string[]>(() => attente.questions.map(() => ""));
  const [precision, setPrecision] = useState("");
  const complet = choix.every((c) => c.trim());
  return (
    <section className={`${CARTE} p-[22px] flex flex-col gap-5 border-[var(--vz-que-bord)]`}>
      <span style={SORA} className="font-semibold text-[18px] text-[var(--vz-que)]">
        {attente.questions.length > 1 ? `${attente.questions.length} questions` : "Une question"} avant le rapport
      </span>
      {attente.questions.map((q, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <p className="m-0 text-[15px]"><span className="font-bold">{i + 1}.</span> {q.question}</p>
          <div className="flex flex-wrap gap-2">
            {q.choix.map((c) => (
              <button key={c} type="button" aria-pressed={choix[i] === c}
                onClick={() => setChoix((v) => v.map((x, j) => (j === i ? c : x)))}
                className={`min-h-[40px] px-3.5 rounded-xl text-[14px] font-semibold border ${choix[i] === c
                  ? "bg-[var(--vz-accent)] border-[var(--vz-accent)] text-white"
                  : "border-[var(--vz-border)] text-[var(--vz-text)] hover:border-[var(--vz-accent-hi)]"}`}>
                {c}
              </button>
            ))}
            <label className="sr-only" htmlFor={`vz-autre-${i}`}>Autre réponse</label>
            <input id={`vz-autre-${i}`} placeholder="Autre réponse…"
              value={q.choix.includes(choix[i]) ? "" : choix[i]}
              onChange={(e) => setChoix((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1 min-w-[12rem] min-h-[40px] px-3 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-surface2)] text-[var(--vz-text)] text-[14px] placeholder:text-[var(--vz-muted)]" />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="vz-precision">Précision</label>
        <input id="vz-precision" value={precision} onChange={(e) => setPrecision(e.target.value)} placeholder="Une précision à ajouter ? (facultatif)"
          className="flex-1 min-h-[46px] px-3 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-surface2)] text-[var(--vz-text)] text-[14px] placeholder:text-[var(--vz-muted)]" />
        <button type="button" disabled={!complet} onClick={() => onRepondre(choix, precision)} className={BOUTON_PRINCIPAL}>
          <Send className="w-4 h-4" /> Répondre
        </button>
      </div>
    </section>
  );
}

function CarteCiblageVz({ attente, onValider }: { attente: Attente; onValider: (c: string[]) => void }) {
  const groupes = attente.ciblage ?? [];
  const [coches, setCoches] = useState<Set<string>>(() => new Set(groupes.flatMap((g) => g.fichiers.filter((f) => f.conseille).map((f) => f.chemin))));
  const basculer = (c: string) => setCoches((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  return (
    <section className={`${CARTE} p-[22px] flex flex-col gap-3`}>
      <span style={SORA} className="font-semibold text-[18px]">J'aimerais regarder d'autres fichiers</span>
      {groupes.map((g) => (
        <div key={g.titre} className="flex flex-col gap-1.5">
          <span className="text-[12px] uppercase tracking-wide text-[var(--vz-muted)]">{g.titre}</span>
          {g.fichiers.map((f) => (
            <label key={f.chemin} className="flex gap-3 items-start px-3 py-2.5 rounded-xl bg-[var(--vz-surface2)] cursor-pointer">
              <input type="checkbox" checked={coches.has(f.chemin)} onChange={() => basculer(f.chemin)} className="w-[18px] h-[18px] mt-0.5 accent-[#186FB7]" />
              <span className="flex flex-col gap-0.5 min-w-0">
                <span style={MONO} className="text-[14px] font-semibold break-all">{f.chemin}</span>
                <span className="text-[13px] text-[var(--vz-muted)]">{f.pourquoi}</span>
              </span>
            </label>
          ))}
        </div>
      ))}
      <div className="flex justify-end">
        <button type="button" onClick={() => onValider([...coches])} className={BOUTON_PRINCIPAL}>
          {coches.size ? `Examiner ${coches.size} fichier${coches.size > 1 ? "s" : ""}` : "N'examiner aucun fichier"}
        </button>
      </div>
    </section>
  );
}
