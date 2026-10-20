/**
 * VérifIzy — rapport, pensé comme un document : verdict, constats complets
 * (constaté / attendu / règle / fichiers), conformes en entier ; à droite, la
 * discussion — un clic sur « Demander » attache le constat comme contexte.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Maximize2, MessageCircle, Minimize2, RotateCcw, Send, Undo2, X } from "lucide-react";
import type { Constat, Rapport } from "@/lib/verifFab/conversation";
import { Markdown } from "@/components/verifFab/Elements";
import { compter, verdictEffectif } from "./EcranAccueil";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE, LogoVerifizy, MONO, NIVEAUX, SORA } from "./theme";

/** claude-opus-5-5 → Claude Opus 5.5 */
const nomModele = (id: string) =>
  id.replace(/^claude-/, "Claude ").replace(/-(\d+)-(\d+)$/, " $1.$2").replace(/-(\d+)$/, " $1").replace(/-/g, " ").replace(/\b(opus|sonnet|haiku|fable)\b/, (m) => m[0].toUpperCase() + m.slice(1));

export interface BulleChat { role: "user" | "assistant"; texte: string; contexte?: string }

const TITRES_VERDICT = {
  conforme: { titre: "Conforme : prêt pour la fab", couleur: "text-[var(--vz-ok)]" },
  a_corriger: { titre: "À corriger avant la fab", couleur: "text-[var(--vz-err)]" },
  questions_en_suspens: { titre: "Questions en suspens", couleur: "text-[var(--vz-que)]" },
} as const;

/** L'ancien format (points) ramené au nouveau, pour les vérifications d'avant VérifIzy */
function constatsDe(r: Rapport): { constats: Constat[]; conformes: string[] } {
  if (r.constats) return { constats: r.constats, conformes: r.conformes ?? [] };
  const pts = r.points ?? [];
  return {
    constats: pts.filter((p) => p.statut !== "ok").map((p) => ({
      niveau: p.statut as Constat["niveau"], categorie: p.categorie, titre: p.constat, detail: "", constate: "", attendu: "", regle: "", fichiers: p.fichier,
    })),
    conformes: pts.filter((p) => p.statut === "ok").map((p) => p.constat),
  };
}

export function EcranRapport(props: {
  titre: string;
  chemin: string;
  date: string;
  rapport: Rapport;
  modele?: string | null;
  bulles: BulleChat[];
  enCoursTexte: string;
  occupe: boolean;
  onEnvoyer: (texte: string, contexte: string | null) => void;
  onRelancer: () => void;
  /** marque / démarque un constat comme corrigé (index dans rapport.constats) */
  onCorriger?: (indices: number[], valeur: boolean) => void;
}) {
  const { constats, conformes } = constatsDe(props.rapport);
  const n = compter(props.rapport);
  const effectif = verdictEffectif(props.rapport);
  const v = effectif !== props.rapport.verdict
    ? { titre: "Tout est corrigé : prêt pour la fab", couleur: "text-[var(--vz-ok)]" }
    : TITRES_VERDICT[props.rapport.verdict];
  const indexDe = (c: Constat) => props.rapport.constats?.indexOf(c) ?? -1;
  const [contexte, setContexte] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  // discussion agrandie : passe devant le rapport (Échap pour revenir)
  const [grand, setGrand] = useState(false);
  useEffect(() => {
    if (!grand) return;
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") setGrand(false); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [grand]);
  const bas = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { bas.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [props.bulles.length, props.enCoursTexte]);

  const groupes: { niveau: Constat["niveau"]; titre: string }[] = [
    { niveau: "erreur", titre: n.erreur > 1 ? "Erreurs à corriger" : "Erreur à corriger" },
    { niveau: "alerte", titre: n.alerte > 1 ? "Alertes" : "Alerte" },
    { niveau: "question", titre: n.question > 1 ? "Questions" : "Question" },
    { niveau: "remarque", titre: n.remarque > 1 ? "Remarques" : "Remarque" },
  ];
  const envoyer = () => {
    if (!saisie.trim() || props.occupe) return;
    props.onEnvoyer(saisie.trim(), contexte);
    setSaisie(""); setContexte(null);
  };

  return (
    <div className="w-full px-8 pt-5 pb-8 flex flex-wrap gap-5 items-start">
      <main className="flex-[999_1_640px] min-w-0 flex flex-col gap-3.5">
        <section className={`${CARTE} px-5 py-4 flex flex-col gap-1.5`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 style={SORA} className={`m-0 font-bold text-[22px] tracking-[-0.4px] ${v.couleur}`}>{v.titre}</h1>
            <div className="flex gap-1.5 flex-wrap">
              {([["erreur", n.erreur, "erreur"], ["alerte", n.alerte, "alerte"], ["question", n.question, "question"], ...(n.remarque ? [["remarque", n.remarque, "remarque"] as const] : []), ["ok", conformes.length, "conforme"], ...(n.corrige ? [["ok", n.corrige, "corrigé"] as const] : [])] as const).map(([k, nb, nom]) => (
                <span key={nom} className={`text-[12px] font-bold rounded-full px-2.5 py-0.5 ${NIVEAUX[k].classe} ${nb ? "" : "opacity-50"}`}>
                  {nb} {nom}{nb > 1 ? "s" : ""}
                </span>
              ))}
            </div>
          </div>
          <span className="text-[14px]">{props.rapport.resume}</span>
          <span className="text-[12px] text-[var(--vz-muted)]">
            <span style={MONO} className="break-all">{props.chemin}</span> · rapport du {props.date}{props.modele && <> · {nomModele(props.modele)}</>}
          </span>
        </section>

        {groupes.map((g) => {
          const liste = constats.filter((c) => c.niveau === g.niveau).sort((a, b) => Number(!!a.corrige) - Number(!!b.corrige));
          if (!liste.length) return null;
          return (
            <section key={g.niveau} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <h2 style={SORA} className={`m-0 font-semibold text-[14px] uppercase tracking-[0.5px] ${NIVEAUX[g.niveau].classe.split(" ")[0]}`}>{g.titre}</h2>
                {/* tout le groupe d'un coup : évite de cliquer « Corrigé » sur chaque ligne */}
                {props.onCorriger && liste.filter((c) => !c.corrige).length > 1 && (
                  <button type="button" onClick={() => props.onCorriger!(liste.filter((c) => !c.corrige).map(indexDe).filter((i) => i >= 0), true)}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold min-h-[28px] px-2.5 rounded-lg border border-[var(--vz-border)] text-[var(--vz-ok)] hover:border-[var(--vz-accent-hi)]">
                    <Check className="w-3.5 h-3.5" /> Tout valider ({liste.filter((c) => !c.corrige).length})
                  </button>
                )}
              </div>
              <div className={`${CARTE} overflow-hidden`}>
                {liste.map((c, i) => (
                  <article key={i} className={`group flex gap-3 px-4 py-2.5 border-b last:border-b-0 border-[var(--vz-border)] ${c.corrige ? "opacity-55" : ""}`}>
                    {c.corrige
                      ? <Check className="mt-[3px] w-4 h-4 shrink-0 text-[var(--vz-ok)]" aria-label="Corrigé" />
                      : <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${NIVEAUX[c.niveau].classe.split(" ")[0]}`} style={{ background: "currentColor" }} aria-hidden />}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-[14px]">
                        <span className={`font-bold ${c.corrige ? "line-through" : ""}`}>{c.titre}</span>
                        {c.corrige && <span className="ml-2 text-[12px] font-bold text-[var(--vz-ok)]">Corrigé{c.corrige_le ? ` le ${new Date(c.corrige_le).toLocaleDateString("fr-FR")}` : ""}</span>}
                        {c.detail && <span className="text-[var(--vz-muted)]"> — {c.detail}</span>}
                      </span>
                      {(c.constate || c.attendu) && (
                        <span className="text-[13px]">
                          {c.constate && <><span className="text-[var(--vz-muted)]">Constaté : </span>{c.constate}</>}
                          {c.constate && c.attendu && <span className="text-[var(--vz-muted)]"> → </span>}
                          {c.attendu && <><span className="text-[var(--vz-muted)]">attendu : </span>{c.attendu}</>}
                        </span>
                      )}
                      {(c.regle || c.fichiers) && (
                        <span className="text-[12px] text-[var(--vz-muted)] [overflow-wrap:anywhere]">
                          {c.regle}{c.regle && c.fichiers && " · "}{c.fichiers && <span style={MONO}>{c.fichiers}</span>}
                        </span>
                      )}
                    </div>
                    {props.onCorriger && indexDe(c) >= 0 && (
                      <button type="button" onClick={() => props.onCorriger!([indexDe(c)], !c.corrige)}
                        title={c.corrige ? "Rouvrir ce point" : "Marquer comme corrigé"}
                        className={`self-start shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold min-h-[30px] px-2.5 rounded-lg border border-[var(--vz-border)] hover:border-[var(--vz-accent-hi)] ${c.corrige ? "text-[var(--vz-muted)]" : "text-[var(--vz-ok)]"}`}>
                        {c.corrige ? <><Undo2 className="w-3.5 h-3.5" /> Rouvrir</> : <><Check className="w-3.5 h-3.5" /> Corrigé</>}
                      </button>
                    )}
                    <button type="button" onClick={() => { setContexte(c.titre); zone.current?.focus(); }}
                      title="Demander à VérifIzy" aria-label={`Demander à VérifIzy : ${c.titre}`}
                      className="self-start shrink-0 p-1.5 rounded-lg text-[var(--vz-muted)] opacity-40 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--vz-accent-hi)] hover:bg-[var(--vz-surface2)]">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {conformes.length > 0 && (
          <details className={`${CARTE} px-4 py-2.5`}>
            <summary style={SORA} className="cursor-pointer font-semibold text-[14px] text-[var(--vz-ok)]">
              Conforme — {conformes.length} point{conformes.length > 1 ? "s" : ""} vérifié{conformes.length > 1 ? "s" : ""}
            </summary>
            <div className="flex flex-col gap-1 pt-2">
              {conformes.map((k, i) => (
                <div key={i} className="flex gap-2 text-[13px]"><span className="text-[var(--vz-ok)] font-bold">✓</span><span>{k}</span></div>
              ))}
            </div>
          </details>
        )}
      </main>

      {grand && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setGrand(false)} aria-hidden />}
      <aside className={grand
        ? `${CARTE} fixed z-50 inset-y-6 left-1/2 -translate-x-1/2 w-[min(980px,calc(100vw-48px))] flex flex-col shadow-2xl`
        : `${CARTE} flex-[1_1_320px] max-w-[420px] min-w-0 flex flex-col sticky top-20 max-h-[calc(100vh-180px)]`}>
        <div className="px-5 py-4 border-b border-[var(--vz-border)] flex items-center gap-2.5">
          <LogoVerifizy taille={26} />
          <span style={SORA} className="font-semibold text-[16px] flex-1">Discuter avec VérifIzy</span>
          <button type="button" onClick={() => setGrand(!grand)} title={grand ? "Réduire (Échap)" : "Agrandir la discussion"}
            aria-label={grand ? "Réduire la discussion" : "Agrandir la discussion"}
            className="p-1.5 rounded-lg text-[var(--vz-muted)] hover:text-[var(--vz-text)] hover:bg-[var(--vz-surface2)]">
            {grand ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 flex flex-col gap-3.5 min-h-[220px]">
          {props.bulles.length === 0 && !props.enCoursTexte && (
            <p className="text-[14px] text-[var(--vz-muted)] m-0">Demande le détail d'une mesure, explique un écart voulu, ou clique sur la bulle d'un constat pour en parler.</p>
          )}
          {props.bulles.map((b, i) => b.role === "user" ? (
            <div key={i} className="self-end max-w-[88%] flex flex-col gap-1.5 items-end">
              {b.contexte && <span className="text-[12px] rounded-lg px-2 py-0.5 text-[var(--vz-accent-hi)] bg-[var(--vz-surface2)]">À propos de : {b.contexte}</span>}
              <div className="rounded-[14px_14px_4px_14px] px-3.5 py-3 bg-[var(--vz-accent)] text-white text-[14px] whitespace-pre-wrap">{b.texte}</div>
            </div>
          ) : (
            <div key={i} className="self-start max-w-[92%] min-w-0 rounded-[14px_14px_14px_4px] px-3.5 py-3 bg-[var(--vz-surface2)] text-[14px]">
              <Markdown texte={b.texte} />
            </div>
          ))}
          {props.occupe && (
            <div className="self-start max-w-[92%] rounded-[14px_14px_14px_4px] px-3.5 py-3 bg-[var(--vz-surface2)] text-[14px]">
              {props.enCoursTexte ? <Markdown texte={props.enCoursTexte} /> : <span className="inline-flex items-center gap-2 text-[var(--vz-muted)]"><Loader2 className="w-4 h-4 animate-spin" /> VérifIzy regarde…</span>}
            </div>
          )}
          <div ref={bas} />
        </div>
        <div className="px-4 py-3.5 border-t border-[var(--vz-border)] flex flex-col gap-2">
          {contexte && (
            <div className="flex justify-between items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--vz-surface2)] text-[13px]">
              <span className="min-w-0 truncate">À propos de : {contexte}</span>
              <button type="button" onClick={() => setContexte(null)} aria-label="Retirer le contexte" className="text-[var(--vz-muted)] hover:text-[var(--vz-text)] p-1"><X className="w-4 h-4" /></button>
            </div>
          )}
          <div className="flex gap-2">
            <label htmlFor="vz-message" className="sr-only">Ton message à VérifIzy</label>
            <textarea id="vz-message" ref={zone} rows={2} value={saisie} onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
              placeholder="Demande un détail, explique un écart voulu…" disabled={props.occupe}
              className="flex-1 text-[14px] rounded-xl border border-[var(--vz-border)] px-3 py-2.5 resize-none bg-[var(--vz-surface2)] text-[var(--vz-text)] placeholder:text-[var(--vz-muted)] disabled:opacity-50" />
            <button type="button" onClick={envoyer} disabled={!saisie.trim() || props.occupe} aria-label="Envoyer" className={BOUTON_PRINCIPAL + " px-4"}>
              <Send className="w-4 h-4" />
            </button>
          </div>
          <button type="button" onClick={props.onRelancer} className={BOUTON_SECONDAIRE + " min-h-[42px] text-[14px]"}>
            <RotateCcw className="w-4 h-4" /> Relancer la vérification après correction
          </button>
        </div>
      </aside>
    </div>
  );
}
