/**
 * VérifIzy — accueil : le chemin du dossier d'abord, puis les dossiers
 * GraphiDesk (chemin mémorisé, trouvé automatiquement ou introuvable) et les
 * dernières vérifications.
 */
import { useState } from "react";
import { Archive, ArchiveRestore, FolderOpen, Loader2, Search, X } from "lucide-react";
import type { Rapport } from "@/lib/verifFab/conversation";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE, MONO, NIVEAUX, SORA } from "./theme";

export interface DossierGD {
  id: string;
  nom: string;
  statut: string;
  chemin: string | null;
  origine: "memorise" | "auto" | "introuvable" | "recherche";
}

export interface ConversationResume {
  id: string;
  titre: string;
  chemin_dossier: string | null;
  is_archived: boolean;
  rapport: Rapport | null;
  /** terminée pendant que le graphiste était ailleurs, pas encore ouverte */
  a_voir?: boolean;
  updated_at: string;
}

const VERDICTS = {
  conforme: { nom: "Conforme", classe: NIVEAUX.ok.classe },
  a_corriger: { nom: "À corriger", classe: NIVEAUX.erreur.classe },
  questions_en_suspens: { nom: "Questions", classe: NIVEAUX.question.classe },
  corrige: { nom: "Corrigé", classe: NIVEAUX.ok.classe },
} as const;

/** Constats encore ouverts (ceux marqués « corrigé » ne comptent plus) */
/** Verdict après les corrections du graphiste : plus d'erreur ni de question ouverte → prêt */
/**
 * Verdict après les corrections du graphiste : plus d'erreur ni de question ouverte →
 * « corrigé » s'il y avait des erreurs, « conforme » s'il n'y avait que des alertes ou
 * des remarques (elles n'empêchent pas la fab).
 */
export function verdictEffectif(r: Rapport): Rapport["verdict"] | "corrige" {
  if (r.verdict === "conforme" || !r.constats) return r.verdict;
  const n = compter(r);
  if (n.erreur > 0 || n.question > 0) return r.verdict;
  return r.constats.some((k) => k.niveau === "erreur") ? "corrige" : "conforme";
}

export function compter(r: Rapport | null) {
  const c = { erreur: 0, alerte: 0, question: 0, remarque: 0, corrige: 0 };
  if (!r) return c;
  if (r.constats) for (const k of r.constats) { if (k.corrige) c.corrige++; else c[k.niveau]++; }
  else for (const p of r.points ?? []) if (p.statut !== "ok") c[p.statut as "erreur" | "alerte" | "question"]++;
  return c;
}

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function EcranAccueil(props: {
  prenom: string;
  racine: string;
  onRacine: (r: string) => void;
  onVerifierChemin: (chemin: string) => void;
  onParcourir: () => void;
  dossiers: DossierGD[];
  /** recherche dans « Mes dossiers » ; trouves = null tant qu'on ne cherche pas */
  recherche: string;
  onRecherche: (q: string) => void;
  trouves: DossierGD[] | null;
  onVerifierDossier: (d: DossierGD) => void;
  conversations: ConversationResume[];
  onOuvrir: (id: string) => void;
  onArchiver: (id: string, valeur: boolean) => void;
}) {
  const [chemin, setChemin] = useState("");
  const [toutVoir, setToutVoir] = useState(false);
  const [editionRacine, setEditionRacine] = useState(false);
  // recherche : dans TOUTES les vérifications (archivées comprises), par nom ou chemin du dossier
  const [filtre, setFiltre] = useState("");
  const q = filtre.trim().toLowerCase();
  const visibles = q
    ? props.conversations.filter((c) => `${c.titre} ${c.chemin_dossier ?? ""}`.toLowerCase().includes(q)).slice(0, 60)
    : props.conversations.filter((c) => toutVoir || !c.is_archived).slice(0, toutVoir ? 200 : 6);

  return (
    <main className="w-full max-w-[1080px] mx-auto px-8 pt-12 pb-14 flex flex-col gap-9">
      <section className="flex flex-col gap-4">
        <div>
          <h1 style={SORA} className="m-0 font-bold text-[34px] tracking-[-0.8px]">Quel dossier on vérifie, {props.prenom} ?</h1>
          <p className="mt-2 text-[16px] text-[var(--vz-muted)]">
            Donne-moi le chemin d'accès du dossier sur le serveur : je compare devis, BAT, fichiers de FAB, maquette, VT et mairie, sans rien modifier.
          </p>
        </div>
        <form
          className={`${CARTE} p-2.5 flex flex-wrap gap-2.5`}
          onSubmit={(e) => { e.preventDefault(); if (chemin.trim()) props.onVerifierChemin(chemin.trim()); }}
        >
          <label htmlFor="vz-chemin" className="sr-only">Chemin d'accès du dossier</label>
          <input
            id="vz-chemin"
            value={chemin}
            onChange={(e) => setChemin(e.target.value)}
            placeholder={`${props.racine}T\\CLIENT\\DOSSIER`}
            style={MONO}
            className="flex-[1_1_360px] min-h-[52px] px-4 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-surface2)] text-[var(--vz-text)] text-[15px] placeholder:text-[var(--vz-muted)] outline-none focus:border-[var(--vz-accent-hi)]"
          />
          <button type="button" onClick={props.onParcourir} className={BOUTON_SECONDAIRE + " min-h-[52px]"}>
            <FolderOpen className="w-4 h-4" /> Parcourir…
          </button>
          <button type="submit" disabled={!chemin.trim()} className={BOUTON_PRINCIPAL + " min-h-[52px] px-6"}>Vérifier ce dossier</button>
        </form>
        <div className="text-[13px] text-[var(--vz-muted)] flex items-center gap-2 flex-wrap">
          Racine du serveur sur ce poste :
          {editionRacine ? (
            <input
              autoFocus
              defaultValue={props.racine}
              onBlur={(e) => { props.onRacine(e.target.value.trim() || "Z:\\"); setEditionRacine(false); }}
              style={MONO}
              className="w-24 px-2 py-1 rounded-md border border-[var(--vz-border)] bg-[var(--vz-surface2)] text-[var(--vz-text)]"
            />
          ) : (
            <>
              <span style={MONO} className="text-[var(--vz-text)]">{props.racine}</span>
              <button type="button" onClick={() => setEditionRacine(true)} className="text-[var(--vz-accent-hi)] underline underline-offset-2">modifier</button>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 style={SORA} className="m-0 font-semibold text-[18px]">Depuis tes dossiers GraphiDesk</h2>
            <span className="text-[13px] text-[var(--vz-muted)]">Le chemin est cherché sur le serveur d'après le nom du dossier : confirme-le la première fois, il est ensuite mémorisé.</span>
          </div>
          <div className="relative flex-[0_1_320px] min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-muted)]" aria-hidden />
            <label htmlFor="vz-recherche" className="sr-only">Chercher un dossier GraphiDesk</label>
            <input id="vz-recherche" value={props.recherche} onChange={(e) => props.onRecherche(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") props.onRecherche(""); }}
              placeholder="Chercher dans mes dossiers (client, ville…)"
              className="w-full min-h-[42px] pl-9 pr-9 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-surface2)] text-[var(--vz-text)] text-[14px] placeholder:text-[var(--vz-muted)] outline-none focus:border-[var(--vz-accent-hi)]" />
            {props.recherche && (
              <button type="button" onClick={() => props.onRecherche("")} aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vz-muted)] hover:text-[var(--vz-text)]"><X className="w-4 h-4" /></button>
            )}
          </div>
        </div>
        {(() => {
          const liste = props.trouves ?? props.dossiers;
          if (!liste.length) return (
            <p className="m-0 text-[14px] text-[var(--vz-muted)]">
              {props.trouves ? "Aucun de tes dossiers en cours ne porte ce nom." : props.recherche.trim().length >= 2 ? "Recherche…" : "Aucun dossier en cours : cherche-le ci-dessus."}
            </p>
          );
          return (
            <div className={`${CARTE} overflow-hidden`}>
              {liste.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3.5 px-[18px] py-3 border-b last:border-b-0 border-[var(--vz-border)]">
                  <div className="flex-[1_1_260px] flex flex-col gap-0.5 min-w-0">
                    <span className="font-bold text-[15px]">{d.nom}</span>
                    <span style={MONO} className="text-[13px] text-[var(--vz-muted)] break-all">{d.chemin ?? (d.origine === "recherche" ? "Recherche sur le serveur…" : "Chemin introuvable : indique-le une fois")}</span>
                    <span className={`text-[12px] font-semibold ${d.origine === "memorise" ? "text-[var(--vz-ok)]" : d.origine === "auto" ? "text-[var(--vz-que)]" : d.origine === "introuvable" ? "text-[var(--vz-ale)]" : "text-[var(--vz-muted)]"}`}>
                      {d.origine === "memorise" && "Chemin mémorisé"}
                      {d.origine === "auto" && "Trouvé automatiquement · à confirmer"}
                      {d.origine === "introuvable" && "Aucun dossier serveur ne correspond au nom"}
                      {d.origine === "recherche" && <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> recherche…</span>}
                    </span>
                  </div>
                  <span className="text-[13px] text-[var(--vz-muted)]">{d.statut}</span>
                  <button type="button" onClick={() => props.onVerifierDossier(d)} disabled={d.origine === "recherche"} className={BOUTON_SECONDAIRE + " min-h-[40px] text-[14px]"}>Vérifier</button>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 style={SORA} className="m-0 font-semibold text-[18px]">Mes dernières vérifications</h2>
          {props.conversations.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-[260px] max-w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-muted)]" aria-hidden />
                <label htmlFor="vz-recherche-verif" className="sr-only">Chercher dans mes vérifications</label>
                <input id="vz-recherche-verif" value={filtre} onChange={(e) => setFiltre(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setFiltre(""); }}
                  placeholder="Chercher une vérification…"
                  className="w-full min-h-[38px] pl-9 pr-8 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-surface2)] text-[var(--vz-text)] text-[14px] placeholder:text-[var(--vz-muted)] outline-none focus:border-[var(--vz-accent-hi)]" />
                {filtre && (
                  <button type="button" onClick={() => setFiltre("")} aria-label="Effacer la recherche"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vz-muted)] hover:text-[var(--vz-text)]"><X className="w-4 h-4" /></button>
                )}
              </div>
              {!q && (
                <button type="button" onClick={() => setToutVoir(!toutVoir)} className="text-[14px] font-semibold text-[var(--vz-accent-hi)]">
                  {toutVoir ? "Voir les récentes" : "Tout voir (archivées comprises)"}
                </button>
              )}
            </div>
          )}
        </div>
        {visibles.length === 0 ? (
          <p className="text-[14px] text-[var(--vz-muted)]">{q ? "Aucune vérification ne correspond à cette recherche." : "Aucune vérification pour l'instant."}</p>
        ) : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {visibles.map((c) => {
              const n = compter(c.rapport);
              const v = c.rapport ? VERDICTS[verdictEffectif(c.rapport)] : null;
              return (
                <div key={c.id} className={`${CARTE} relative p-[18px] flex flex-col gap-3 group transition duration-200 hover:scale-[1.02] hover:border-[var(--vz-accent-hi)] hover:shadow-[0_0_0_1px_var(--vz-accent-hi),0_8px_28px_-6px_var(--vz-accent)] focus-within:border-[var(--vz-accent-hi)]`}>
                  {/* toute la carte est cliquable (le bouton s'étend dessus) ; l'archivage reste au-dessus */}
                  <button type="button" onClick={() => props.onOuvrir(c.id)} title="Ouvrir cette vérification"
                    className="text-left flex justify-between items-start gap-2 cursor-pointer outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']">
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-bold text-[15px] truncate flex items-center gap-2">
                        {c.a_voir && <span className="w-2 h-2 rounded-full bg-[var(--vz-accent-hi)] shrink-0" title="Nouveau" aria-label="Nouveau" />}
                        {c.titre}
                      </span>
                      <span className="text-[13px] text-[var(--vz-muted)]">{quand(c.updated_at)}{c.is_archived ? " · archivée" : ""}</span>
                    </span>
                    <span className={`text-[12px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${v ? v.classe : "text-[var(--vz-muted)] bg-[var(--vz-surface2)]"}`}>
                      {v ? v.nom : "En cours"}
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-[var(--vz-muted)]">
                      {c.rapport ? `${n.erreur} erreur${n.erreur > 1 ? "s" : ""} · ${n.alerte} alerte${n.alerte > 1 ? "s" : ""} · ${n.question} question${n.question > 1 ? "s" : ""}${n.remarque ? ` · ${n.remarque} remarque${n.remarque > 1 ? "s" : ""}` : ""}${n.corrige ? ` · ${n.corrige} corrigé${n.corrige > 1 ? "s" : ""}` : ""}` : "Analyse non terminée"}
                    </span>
                    <button
                      type="button"
                      onClick={() => props.onArchiver(c.id, !c.is_archived)}
                      title={c.is_archived ? "Désarchiver" : "Archiver (rien n'est supprimé)"}
                      aria-label={c.is_archived ? "Désarchiver" : "Archiver"}
                      className="relative z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--vz-muted)] hover:text-[var(--vz-text)] p-1"
                    >
                      {c.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
