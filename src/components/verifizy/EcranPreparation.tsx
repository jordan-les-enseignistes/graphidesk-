/**
 * VérifIzy — préparation, AVANT tout appel à l'API : ce que contient le
 * dossier, le devis s'il manque (déposé ici ou « continuer sans »), et les
 * annexes que l'analyse aura le droit d'ouvrir.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Eye, FileText, Loader2, RefreshCw, X } from "lucide-react";
import type { Inventaire } from "@/lib/verifFab/inventaire";
import type { DevisDolibarr } from "@/pages/VerifFab";
import { dureeEstimee, formaterDuree } from "@/lib/verifFab/inventaire";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE, MONO, SORA } from "./theme";

const ETATS = {
  trouve: { nom: "Trouvé", classe: "text-[var(--vz-ok)] bg-[var(--vz-ok-bg)]" },
  absent: { nom: "Absent", classe: "text-[var(--vz-err)] bg-[var(--vz-err-bg)]" },
  non_prevu: { nom: "Non prévu", classe: "text-[var(--vz-muted)] bg-[var(--vz-surface2)]" },
  client: { nom: "Client", classe: "text-[var(--vz-que)] bg-[var(--vz-que-bg)]" },
} as const;

export function EcranPreparation(props: {
  chemin: string;
  inventaire: Inventaire;
  /** client déduit du chemin serveur (ex. EDRA) et sa note mémorisée, s'il y en a une */
  client: string | null;
  noteClient: string;
  /** devis cherché dans Dolibarr quand il n'est pas dans le dossier */
  dolibarr: DevisDolibarr | null;
  onLancer: (choix: { devis: File | null; sansDevis: boolean; annexes: string[]; contexte: string; memoriser: boolean }) => void;
  onAnnuler: () => void;
  /** relit le dossier (un fichier ajouté entre-temps : devis, annexe…) sans quitter l'écran */
  onActualiser: () => Promise<void>;
}) {
  const { inventaire } = props;
  const [devis, setDevis] = useState<File | null>(null);
  const [sansDevis, setSansDevis] = useState(false);
  // contexte pour VérifIzy : brief collé de FreshProcess, particularité du client ou du dossier
  const [contexte, setContexte] = useState(props.noteClient);
  const [memoriser, setMemoriser] = useState(!!props.noteClient);
  const [coches, setCoches] = useState<Set<string>>(() => new Set(inventaire.annexes.filter((a) => a.coche).map((a) => a.chemin)));
  const [relecture, setRelecture] = useState(false);
  // aperçu du devis (Dolibarr ou déposé) pour s'assurer que c'est le bon
  const [apercu, setApercu] = useState<string | null>(null);
  const ouvrirApercu = () => { if (devis) setApercu(URL.createObjectURL(devis)); };
  const fermerApercu = () => { if (apercu) URL.revokeObjectURL(apercu); setApercu(null); };
  const enRecherche = props.dolibarr?.etat === "recherche" && !devis;
  // devis trouvé dans Dolibarr : pris comme s'il avait été déposé (le graphiste peut le retirer)
  const depuisDolibarr = !!devis && devis === props.dolibarr?.fichier;
  useEffect(() => {
    if (props.dolibarr?.fichier && !devis && !sansDevis) setDevis(props.dolibarr.fichier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dolibarr?.fichier]);
  // dossier relu : les nouvelles annexes conseillées sont cochées, les choix déjà faits sont gardés
  const dejaVues = useRef(new Set(inventaire.annexes.map((a) => a.chemin)));
  useEffect(() => {
    const nouvelles = inventaire.annexes.filter((a) => !dejaVues.current.has(a.chemin));
    nouvelles.forEach((a) => dejaVues.current.add(a.chemin));
    const presentes = new Set(inventaire.annexes.map((a) => a.chemin));
    setCoches((s) => new Set([...[...s].filter((c) => presentes.has(c)), ...nouvelles.filter((a) => a.coche).map((a) => a.chemin)]));
  }, [inventaire]);
  const actualiser = async () => { setRelecture(true); try { await props.onActualiser(); } finally { setRelecture(false); } };
  const [survol, setSurvol] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  const devisRegle = inventaire.aDevis || !!devis || sansDevis;
  const nbLus = inventaire.lusDOffice.length + (devis ? 1 : 0);
  const duree = dureeEstimee(nbLus, coches.size);
  const basculer = (c: string) => setCoches((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });

  return (
    <main className="w-full max-w-[1000px] mx-auto px-8 pt-10 pb-14 flex flex-col gap-5">
      <div>
        <span className="text-[13px] font-bold tracking-[1px] uppercase text-[var(--vz-accent-hi)]">Étape 1 sur 2 · Préparation</span>
        <h1 style={SORA} className="mt-1.5 mb-0 font-bold text-[30px] tracking-[-0.6px]">Voilà ce que j'ai trouvé dans le dossier</h1>
        <p className="mt-1.5 text-[15px] text-[var(--vz-muted)] flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{inventaire.nbFichiers} fichiers · <span style={MONO} className="break-all">{props.chemin}</span></span>
          <button type="button" onClick={actualiser} disabled={relecture} title="Relire le dossier (un fichier ajouté entre-temps)"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold min-h-[32px] px-3 rounded-lg border border-[var(--vz-border)] text-[var(--vz-text)] hover:border-[var(--vz-accent-hi)] disabled:opacity-50">
            {relecture ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Actualiser
          </button>
        </p>
      </div>

      <section className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {inventaire.pieces.map((p) => (
          <div key={p.nom} className={`${CARTE} p-3.5 flex flex-col gap-1.5 min-w-0`}>
            {p.nom === "Devis" && enRecherche ? (
              <span className="text-[12px] font-bold rounded-full px-2.5 py-0.5 self-start inline-flex items-center gap-1 text-[var(--vz-accent-hi)] bg-[var(--vz-surface2)]">
                <Loader2 className="w-3 h-3 animate-spin" /> Recherche…
              </span>
            ) : p.nom === "Devis" && depuisDolibarr ? (
              <span className="text-[12px] font-bold rounded-full px-2.5 py-0.5 self-start inline-flex items-center gap-1 text-[var(--vz-ok)] bg-[var(--vz-ok-bg)]">
                <Check className="w-3 h-3" /> Récupéré
              </span>
            ) : (
              <span className={`text-[12px] font-bold rounded-full px-2.5 py-0.5 self-start ${ETATS[p.nom === "Devis" && devis ? "trouve" : p.etat].classe}`}>
                {ETATS[p.nom === "Devis" && devis ? "trouve" : p.etat].nom}
              </span>
            )}
            <span className="font-bold text-[15px]">{p.nom}</span>
            <span className="text-[13px] text-[var(--vz-muted)] [overflow-wrap:anywhere]">
              {p.nom === "Devis" && devis
                ? depuisDolibarr ? `Trouvé dans Dolibarr : ${devis.name}` : devis.name
                : p.nom === "Devis" && props.dolibarr?.etat === "recherche" ? `Recherche dans Dolibarr (${props.dolibarr.ref})…`
                : p.nom === "Devis" && props.dolibarr?.etat === "absent" ? `${p.detail}. Dolibarr : ${props.dolibarr.raison ?? "rien trouvé"}` : p.detail}
            </span>
          </div>
        ))}
      </section>

      {!inventaire.aDevis && (
        <section
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault(); setSurvol(false);
            const f = [...e.dataTransfer.files].find((x) => x.type === "application/pdf" || x.name.toLowerCase().endsWith(".pdf"));
            if (f) { setDevis(f); setSansDevis(false); }
          }}
          className={`${CARTE} p-[22px] flex flex-wrap gap-4 items-center ${survol ? "border-[var(--vz-accent-hi)] border-dashed" : ""}`}
        >
          <div className="flex-[1_1_360px] flex flex-col gap-1">
            <span style={SORA} className="font-semibold text-[18px] inline-flex items-center gap-2">
              {enRecherche && <Loader2 className="w-4 h-4 animate-spin text-[var(--vz-accent-hi)]" />}
              {depuisDolibarr && <Check className="w-5 h-5 text-[var(--vz-ok)]" />}
              {devis ? (depuisDolibarr ? "Devis récupéré dans Dolibarr" : "Devis ajouté") : sansDevis ? "Analyse sans devis" : enRecherche ? `Je cherche le devis dans Dolibarr (${props.dolibarr?.ref})…` : "Il me manque le devis"}
            </span>
            <span className="text-[14px] text-[var(--vz-muted)]">
              {devis
                ? "Je comparerai chaque produit vendu au BAT et aux fichiers de FAB."
                : sansDevis
                  ? "Je ne comparerai que le BAT, la maquette et les fichiers de FAB."
                  : "Sans lui, je ne peux pas vérifier que tout ce qui a été vendu est au BAT et en FAB. Glisse le bon de commande (PDF) ici."}
            </span>
          </div>
          {devis ? (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--vz-surface2)] text-[14px]">
              <FileText className="w-4 h-4" /> {devis.name}
              <button type="button" onClick={ouvrirApercu} title="Voir le devis" aria-label="Voir le devis"
                className="inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-1 rounded-lg text-[var(--vz-accent-hi)] hover:bg-[var(--vz-surface)]">
                <Eye className="w-4 h-4" /> Aperçu
              </button>
              <button type="button" onClick={() => setDevis(null)} aria-label="Retirer le devis" className="text-[var(--vz-muted)] hover:text-[var(--vz-text)]"><X className="w-4 h-4" /></button>
            </span>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <input ref={champ} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setDevis(f); setSansDevis(false); } }} />
              <button type="button" onClick={() => champ.current?.click()} className={BOUTON_PRINCIPAL}>Ajouter le devis</button>
              <button type="button" onClick={() => setSansDevis(!sansDevis)} aria-pressed={sansDevis}
                className={sansDevis
                  ? "inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-xl font-semibold text-[15px] bg-[var(--vz-ok-bg)] text-[var(--vz-ok)] border-2 border-[var(--vz-ok)]"
                  : BOUTON_SECONDAIRE}>
                {sansDevis ? <><Check className="w-4 h-4" /> Sans devis</> : "Continuer sans"}
              </button>
            </div>
          )}
        </section>
      )}

      <section className={`${CARTE} p-[22px] flex flex-col gap-3`}>
        <div>
          <label htmlFor="vz-contexte" style={SORA} className="font-semibold text-[18px]">Contexte pour VérifIzy</label>
          <p className="mt-1 mb-0 text-[14px] text-[var(--vz-muted)]">
            Le brief du commercial (copié de FreshProcess), ou une particularité de ce dossier ou de ce client qu'il doit connaître. Facultatif.
            {props.noteClient && <> <span className="text-[var(--vz-accent-hi)]">Note mémorisée pour {props.client} reprise ci-dessous.</span></>}
          </p>
        </div>
        <textarea id="vz-contexte" value={contexte} onChange={(e) => setContexte(e.target.value)} rows={5}
          placeholder="Ex. : le client fournit lui-même les fixations ; adhésif posé en intérieur ; le devis sera mis à jour après la VT."
          className="w-full min-h-[120px] resize-y px-3 py-2.5 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-surface2)] text-[var(--vz-text)] text-[14px] leading-relaxed placeholder:text-[var(--vz-muted)]" />
        {props.client && (
          <label className="flex items-center gap-2.5 text-[14px] cursor-pointer select-none">
            <input type="checkbox" checked={memoriser} onChange={(e) => setMemoriser(e.target.checked)} className="w-[18px] h-[18px] accent-[#186FB7]" />
            Mémoriser pour le client <b>{props.client}</b> (repris à chaque nouvelle vérification de ce client)
          </label>
        )}
      </section>

      {apercu && devis && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={fermerApercu}>
          <div className={`${CARTE} w-[min(1100px,100%)] h-[min(92vh,1000px)] flex flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--vz-border)]">
              <span className="inline-flex items-center gap-2 font-semibold text-[15px] min-w-0">
                <FileText className="w-4 h-4 shrink-0" /><span className="truncate">{devis.name}</span>
                {depuisDolibarr && <span className="text-[12px] font-bold rounded-full px-2 py-0.5 text-[var(--vz-ok)] bg-[var(--vz-ok-bg)]">Dolibarr</span>}
              </span>
              <button type="button" onClick={fermerApercu} aria-label="Fermer l'aperçu" className="p-1.5 rounded-lg text-[var(--vz-muted)] hover:text-[var(--vz-text)]"><X className="w-5 h-5" /></button>
            </div>
            <iframe src={apercu} title={`Aperçu de ${devis.name}`} className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}

      {inventaire.annexes.length > 0 && (
        <section className={`${CARTE} p-[22px] flex flex-col gap-3`}>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span style={SORA} className="font-semibold text-[18px]">Quels fichiers annexes dois-je regarder ?</span>
              <span className="text-[13px] text-[var(--vz-muted)]">
                {coches.size} / {inventaire.annexes.length} coché{coches.size > 1 ? "s" : ""} ·{" "}
                <button type="button" onClick={() => setCoches(new Set())} className="text-[var(--vz-accent-hi)] underline underline-offset-2">tout décocher</button>
              </span>
            </div>
            <p className="mt-1 text-[14px] text-[var(--vz-muted)]">Le BAT, le devis et les fichiers de FAB sont toujours lus. Pour le reste, coche ce qui peut révéler un problème : chaque fichier lu rallonge l'analyse.</p>
          </div>
          {inventaire.annexes.map((a) => (
            <label key={a.chemin} className="flex gap-3 items-start px-3 py-2.5 rounded-xl bg-[var(--vz-surface2)] cursor-pointer">
              <input type="checkbox" checked={coches.has(a.chemin)} onChange={() => basculer(a.chemin)} className="w-[18px] h-[18px] mt-0.5 accent-[#186FB7]" />
              <span className="flex flex-col gap-0.5 min-w-0">
                <span style={MONO} className="text-[14px] font-semibold break-all">{a.chemin}</span>
                <span className="text-[13px] text-[var(--vz-muted)]">{a.pourquoi}</span>
              </span>
            </label>
          ))}
        </section>
      )}

      {/* figée en bas (-bottom-6 : la zone de défilement de GraphiDesk a 1,5 rem de marge intérieure) */}
      <div className="sticky -bottom-6 z-10 -mx-8 px-8 py-4 border-t border-[var(--vz-border)] bg-[var(--vz-bg)] flex flex-wrap justify-between items-center gap-3">
        <button type="button" onClick={props.onAnnuler} className="text-[14px] text-[var(--vz-muted)] hover:text-[var(--vz-text)] underline underline-offset-2">Changer de dossier</button>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[14px] text-[var(--vz-muted)]">Durée estimée : environ {formaterDuree(duree)}</span>
          <button type="button" disabled={!devisRegle}
            onClick={() => props.onLancer({ devis, sansDevis, annexes: [...coches], contexte: contexte.trim(), memoriser })}
            className={BOUTON_PRINCIPAL + " min-h-[52px] px-7 text-[16px]"}
            title={devisRegle ? undefined : "Ajoute le devis ou choisis « Continuer sans »"}>
            Lancer l'analyse
          </button>
        </div>
      </div>
    </main>
  );
}
