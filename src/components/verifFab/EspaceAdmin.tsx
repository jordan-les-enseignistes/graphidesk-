/**
 * Vérif FAB — espace réservé à l'admin (manage:users) :
 *   - Coûts : montant exact facturé par l'API, par graphiste et par dossier ;
 *   - Statistiques : erreurs et questions les plus fréquentes, tirées des rapports ;
 *   - Règles : file des propositions à valider, base des règles validées.
 * Les graphistes ne voient jamais ces écrans ni aucun montant.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Coins, BarChart3, BookCheck, Check, Ban, Pencil, Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CLE_NOTIFS_VERIFIZY } from "@/hooks/useVerifizyNotifs";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { Rapport } from "@/lib/verifFab/conversation";

const usd = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`;

const CATEGORIES = ["general", "adhesif", "plaque", "impression", "decoupe", "enseigne", "bache", "nommage", "couleur", "autre"];
const LIBELLE_CATEGORIE: Record<string, string> = {
  dimensions: "Dimensions", quantite: "Quantité", matiere: "Matière", finition: "Finition", texte: "Texte",
  couleur: "Couleur", decoupe: "Découpe", fonds_perdus: "Fonds perdus", nommage: "Nommage",
  element_manquant: "Élément manquant", process: "Process", autre: "Autre",
};

/* ------------------------------------------------------------ modèle */

interface ModeleApi { id: string; nom: string; date: string }

/** Le modèle utilisé par VérifIzy : choisi ici, le plus récent en tête */
function ChoixModele() {
  const [modeles, setModeles] = useState<ModeleApi[] | null>(null);
  const [actuel, setActuel] = useState<string>("");
  const [erreur, setErreur] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => {
    supabase.functions.invoke("verif-fab", { body: { action: "modeles" } }).then(({ data, error }) => {
      if (error || data?.erreur) { setErreur(data?.erreur ?? error?.message ?? "?"); return; }
      setModeles(data.modeles);
      setActuel(data.actuel);
    });
  }, []);
  const choisir = async (id: string) => {
    const { error } = await supabase.from("verif_parametres").update({ modele: id, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    setActuel(id);
    queryClient.invalidateQueries({ queryKey: CLE_NOTIFS_VERIFIZY });
    toast.success("Modèle changé : il sert dès la prochaine vérification. Relance un dossier de test pour comparer.");
  };
  const plusRecent = modeles?.[0];
  return (
    <div className="mb-5 p-3 rounded-lg border border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-gray-800 dark:text-slate-200">Modèle utilisé</span>
      {erreur ? <span className="text-sm text-red-500">Liste des modèles indisponible : {erreur}</span> : !modeles ? <span className="text-sm text-gray-400">Chargement…</span> : (
        <>
          <select value={actuel} onChange={(e) => choisir(e.target.value)}
            className="px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm">
            {!modeles.some((m) => m.id === actuel) && <option value={actuel}>{actuel}</option>}
            {modeles.map((m, i) => (
              <option key={m.id} value={m.id}>{m.nom}{i === 0 ? " (le plus récent)" : ""} — {new Date(m.date).toLocaleDateString("fr-FR")}</option>
            ))}
          </select>
          {plusRecent && plusRecent.id !== actuel && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-300">Plus récent disponible : {plusRecent.nom}</span>
          )}
          <span className="text-xs text-gray-400 w-full">Changer de modèle vide le cache (la vérification suivante le réécrit). Le modèle réellement utilisé est indiqué sous chaque rapport.</span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ coûts */

function Couts() {
  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7));
  const [usage, setUsage] = useState<{ user: string; conv: string | null; usd: number; tokens: number; date: string }[]>([]);
  const [convs, setConvs] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const debut = new Date(`${mois}-01T00:00:00`);
      const fin = new Date(debut); fin.setMonth(fin.getMonth() + 1);
      const { data } = await supabase
        .from("verif_usage")
        .select("cout_usd, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, conversation_id, created_at, profiles:user_id(full_name)")
        .gte("created_at", debut.toISOString()).lt("created_at", fin.toISOString());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lignes = ((data ?? []) as any[]).map((u) => ({
        // ligne sans graphiste ni dossier : relance automatique du cache
        user: u.profiles?.full_name ?? (u.conversation_id ? "?" : "Entretien du cache (auto)"),
        conv: u.conversation_id,
        usd: Number(u.cout_usd),
        tokens: u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_write_tokens,
        date: u.created_at as string,
      }));
      setUsage(lignes);
      const ids = [...new Set(lignes.map((l) => l.conv).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: c } = await supabase.from("verif_conversations").select("id, titre").in("id", ids);
        setConvs(Object.fromEntries((c ?? []).map((x: { id: string; titre: string }) => [x.id, x.titre])));
      }
    })();
  }, [mois]);

  const parUser = useMemo(() => {
    const m = new Map<string, { appels: number; usd: number; tokens: number; dossiers: Set<string> }>();
    for (const l of usage) {
      const e = m.get(l.user) ?? { appels: 0, usd: 0, tokens: 0, dossiers: new Set<string>() };
      e.appels++; e.usd += l.usd; e.tokens += l.tokens; if (l.conv) e.dossiers.add(l.conv);
      m.set(l.user, e);
    }
    return [...m.entries()].sort((a, b) => b[1].usd - a[1].usd);
  }, [usage]);
  const parConv = useMemo(() => {
    const m = new Map<string, { user: string; usd: number; appels: number; date: string }>();
    for (const l of usage) {
      if (!l.conv) continue;
      const e = m.get(l.conv) ?? { user: l.user, usd: 0, appels: 0, date: l.date };
      e.usd += l.usd; e.appels++; if (l.date < e.date) e.date = l.date; m.set(l.conv, e);
    }
    // la plus récente en tête (plusieurs vérifications d'un même dossier se distinguent par l'heure)
    return [...m.entries()].sort((a, b) => b[1].date.localeCompare(a[1].date));
  }, [usage]);
  const total = usage.reduce((s, l) => s + l.usd, 0);
  const nbDossiers = parConv.length;

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-6 flex-wrap">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{usd(total)}</p>
          <p className="text-xs text-gray-400">facturés par l'API ce mois-ci (montant exact, en dollars)</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-gray-800 dark:text-slate-200">{nbDossiers ? usd(total / nbDossiers) : "—"}</p>
          <p className="text-xs text-gray-400">en moyenne par dossier vérifié ({nbDossiers})</p>
        </div>
        <input type="month" value={mois} onChange={(e) => setMois(e.target.value)}
          className="ml-auto px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm" />
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-500 dark:text-slate-400"><th className="py-1">Graphiste</th><th>Dossiers</th><th>Appels</th><th>Tokens</th><th className="text-right">Coût</th></tr></thead>
        <tbody>
          {parUser.map(([nom, e]) => (
            <tr key={nom} className="border-t border-gray-100 dark:border-slate-700 text-gray-800 dark:text-slate-200">
              <td className="py-1.5">{nom}</td><td>{e.dossiers.size}</td><td>{e.appels}</td><td>{e.tokens.toLocaleString("fr-FR")}</td><td className="text-right">{usd(e.usd)}</td>
            </tr>
          ))}
          {!parUser.length && <tr><td colSpan={5} className="py-3 text-gray-400">Aucun appel ce mois-ci</td></tr>}
        </tbody>
      </table>
      {parConv.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Par dossier</p>
          <table className="w-full text-sm">
            <tbody>
              {parConv.map(([id, e]) => (
                <tr key={id} className="border-t border-gray-100 dark:border-slate-700 text-gray-700 dark:text-slate-300">
                  <td className="py-1.5">{convs[id] ?? "…"}</td>
                  <td className="text-gray-400">{new Date(e.date).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="text-gray-400">{e.user}</td><td className="text-gray-400">{e.appels} appels</td><td className="text-right">{usd(e.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ statistiques */

function Statistiques() {
  const [convs, setConvs] = useState<{ user: string; rapport: Rapport | null; titre: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("verif_conversations")
        .select("titre, rapport, profiles:user_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(1000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setConvs(((data ?? []) as any[]).map((c) => ({ user: c.profiles?.full_name ?? "?", rapport: c.rapport, titre: c.titre })));
    })();
  }, []);

  const s = useMemo(() => {
    // les remarques (hors standards, sans risque) sont comptées à part : elles ne gonflent pas les alertes
    const parCat = new Map<string, { erreurs: number; questions: number; alertes: number; remarques: number }>();
    const parUser = new Map<string, { dossiers: number; aCorriger: number; erreurs: number }>();
    const verdicts = { conforme: 0, a_corriger: 0, questions_en_suspens: 0, sans_rapport: 0 };
    const dernieres: { titre: string; constat: string; user: string }[] = [];
    for (const c of convs) {
      const u = parUser.get(c.user) ?? { dossiers: 0, aCorriger: 0, erreurs: 0 };
      u.dossiers++;
      if (!c.rapport) { verdicts.sans_rapport++; parUser.set(c.user, u); continue; }
      verdicts[c.rapport.verdict]++;
      if (c.rapport.verdict === "a_corriger") u.aCorriger++;
      // nouveau format VérifIzy (constats) ou ancien (points)
      const points = c.rapport.constats
        ? c.rapport.constats.map((k) => ({ statut: k.niveau as string, categorie: k.categorie, constat: k.titre }))
        : (c.rapport.points ?? []);
      for (const p of points) {
        if (p.statut === "ok") continue;
        const e = parCat.get(p.categorie) ?? { erreurs: 0, questions: 0, alertes: 0, remarques: 0 };
        if (p.statut === "erreur") { e.erreurs++; u.erreurs++; if (dernieres.length < 15) dernieres.push({ titre: c.titre, constat: p.constat, user: c.user }); }
        else if (p.statut === "alerte") e.alertes++;
        else if (p.statut === "remarque") e.remarques++;
        else e.questions++;
        parCat.set(p.categorie, e);
      }
      parUser.set(c.user, u);
    }
    return {
      parCat: [...parCat.entries()].sort((a, b) => b[1].erreurs - a[1].erreurs || b[1].questions - a[1].questions),
      parUser: [...parUser.entries()].sort((a, b) => b[1].dossiers - a[1].dossiers),
      verdicts,
      dernieres,
    };
  }, [convs]);
  const maxCat = Math.max(1, ...s.parCat.map(([, e]) => e.erreurs + e.questions + e.alertes + e.remarques));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          ["Dossiers vérifiés", convs.length, "text-gray-900 dark:text-slate-100"],
          ["Conformes", s.verdicts.conforme, "text-emerald-600"],
          ["À corriger", s.verdicts.a_corriger, "text-red-600"],
          ["Questions en suspens", s.verdicts.questions_en_suspens, "text-amber-600"],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">{l}</p>
            <p className={`text-2xl font-bold ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Erreurs, alertes, questions et remarques les plus fréquentes</p>
        <div className="space-y-1.5">
          {s.parCat.map(([cat, e]) => (
            <div key={cat} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-gray-700 dark:text-slate-300">{LIBELLE_CATEGORIE[cat] ?? cat}</span>
              <div className="flex-1 h-4 bg-gray-100 dark:bg-slate-700 rounded overflow-hidden flex">
                <div className="bg-red-500" style={{ width: `${(e.erreurs / maxCat) * 100}%` }} />
                <div className="bg-orange-300" style={{ width: `${(e.alertes / maxCat) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(e.questions / maxCat) * 100}%` }} />
                <div className="bg-slate-400" style={{ width: `${(e.remarques / maxCat) * 100}%` }} />
              </div>
              <span className="w-40 text-right text-xs text-gray-500">{e.erreurs} err. · {e.alertes} alertes · {e.questions} quest. · {e.remarques} rem.</span>
            </div>
          ))}
          {!s.parCat.length && <p className="text-sm text-gray-400">Pas encore de rapport.</p>}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Par graphiste</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 dark:text-slate-400"><th className="py-1">Graphiste</th><th>Dossiers</th><th>À corriger</th><th>Erreurs relevées</th></tr></thead>
          <tbody>
            {s.parUser.map(([nom, u]) => (
              <tr key={nom} className="border-t border-gray-100 dark:border-slate-700 text-gray-800 dark:text-slate-200">
                <td className="py-1.5">{nom}</td><td>{u.dossiers}</td><td>{u.aCorriger}</td><td>{u.erreurs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.dernieres.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Dernières erreurs relevées</p>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
            {s.dernieres.map((d, i) => <li key={i}><span className="text-gray-400">{d.titre} ({d.user}) —</span> {d.constat}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ règles */

interface Regle {
  id: string;
  categorie: string;
  titre: string;
  texte: string;
  statut: "proposee" | "validee" | "refusee" | "fusionnee";
  /** la proposition remplace cette règle validée (fusion sur le même sujet) */
  remplace_id?: string | null;
  raison: string | null;
  created_at: string;
  propose: { full_name: string } | null;
}

function FicheRegle({ r, onChange, cible }: { r: Regle; onChange: () => void; cible?: Regle }) {
  const monId = useAuthStore((s) => s.profile?.id);
  const [edition, setEdition] = useState(false);
  const [v, setV] = useState({ categorie: r.categorie, titre: r.titre, texte: r.texte });
  const queryClient = useQueryClient();
  const maj = async (champs: Record<string, unknown>, msg: string) => {
    const { error } = await supabase.from("verif_regles").update({ ...champs, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(msg); onChange(); queryClient.invalidateQueries({ queryKey: CLE_NOTIFS_VERIFIZY }); }
  };
  // fusion : la règle existante prend le texte complet proposé, la proposition est classée
  const fusionner = async () => {
    if (!cible) return;
    const maintenant = new Date().toISOString();
    const { error } = await supabase.from("verif_regles")
      .update({ categorie: r.categorie, titre: r.titre, texte: r.texte, valide_par: monId, updated_at: maintenant }).eq("id", cible.id);
    if (error) { toast.error(error.message); return; }
    await maj({ statut: "fusionnee", valide_par: monId }, "Règle fusionnée : le nouveau texte s'applique dès maintenant");
  };
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2">
      {edition ? (
        <>
          <div className="flex gap-2">
            <select value={v.categorie} onChange={(e) => setV({ ...v, categorie: e.target.value })}
              className="px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={v.titre} onChange={(e) => setV({ ...v, titre: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm" />
          </div>
          {/* assez haut pour relire toute la règle sans faire défiler (elles font souvent 10 lignes) */}
          <textarea value={v.texte} onChange={(e) => setV({ ...v, texte: e.target.value })}
            rows={Math.min(24, Math.max(8, v.texte.split("\n").length + Math.ceil(v.texte.length / 110)))}
            className="w-full min-h-[200px] resize-y leading-relaxed px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm" />
          <button onClick={() => { maj(v, "Règle modifiée"); setEdition(false); }}
            className="px-3 py-1 rounded bg-blue-600 text-white text-xs inline-flex items-center gap-1"><Save className="w-3 h-3" /> Enregistrer</button>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 shrink-0">{r.categorie}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{r.titre}</p>
              <p className="text-sm text-gray-600 dark:text-slate-300">{r.texte}</p>
              {r.raison && <p className="text-xs text-gray-400 mt-1">Origine : {r.raison}{r.propose ? ` — proposée par ${r.propose.full_name}` : ""}</p>}
              {r.statut === "proposee" && cible && (
                <div className="mt-2 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-2">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Remplace la règle « {cible.titre} » (même sujet : une seule règle). Texte actuel :</p>
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{cible.texte}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {r.statut === "proposee" && (
              <>
                {cible ? (
                  <button onClick={fusionner}
                    className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs inline-flex items-center gap-1"><Check className="w-3 h-3" /> Valider la fusion</button>
                ) : (
                  <button onClick={() => maj({ statut: "validee", valide_par: monId }, "Règle validée : Claude l'applique dès maintenant")}
                    className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs inline-flex items-center gap-1"><Check className="w-3 h-3" /> Valider</button>
                )}
                <button onClick={() => maj({ statut: "refusee", valide_par: monId }, "Règle refusée")}
                  className="px-2.5 py-1 rounded bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs inline-flex items-center gap-1"><Ban className="w-3 h-3" /> Refuser</button>
              </>
            )}
            {r.statut === "refusee" && (
              <button onClick={() => maj({ statut: "validee", valide_par: monId }, "Règle validée")}
                className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs inline-flex items-center gap-1"><Check className="w-3 h-3" /> Valider quand même</button>
            )}
            <button onClick={() => setEdition(true)} className="px-2.5 py-1 rounded border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-xs inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> Modifier</button>
            {r.statut === "validee" && (
              <button onClick={() => maj({ statut: "refusee" }, "Règle retirée : Claude ne l'applique plus")}
                className="px-2.5 py-1 rounded border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-xs inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> Retirer</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Regles() {
  const monId = useAuthStore((s) => s.profile?.id);
  const [regles, setRegles] = useState<Regle[]>([]);
  const [onglet, setOnglet] = useState<"proposee" | "validee" | "refusee">("proposee");
  const [nouvelle, setNouvelle] = useState<{ categorie: string; titre: string; texte: string } | null>(null);
  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("verif_regles")
      .select("id, categorie, titre, texte, statut, raison, remplace_id, created_at, propose:propose_par(full_name)")
      .order("categorie").order("created_at");
    setRegles((data ?? []) as unknown as Regle[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);
  const compte = (s: string) => regles.filter((r) => r.statut === s).length;

  const ajouter = async () => {
    if (!nouvelle?.titre.trim() || !nouvelle.texte.trim()) return;
    const { error } = await supabase.from("verif_regles").insert({ ...nouvelle, statut: "validee", propose_par: monId, valide_par: monId, raison: "Ajoutée par Jordan" });
    if (error) toast.error(error.message); else { toast.success("Règle ajoutée"); setNouvelle(null); charger(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        {([["proposee", "À valider"], ["validee", "Validées"], ["refusee", "Refusées"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            className={`px-3 py-1 rounded-full text-sm ${onglet === k ? "bg-gray-800 dark:bg-slate-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"}`}>
            {l} ({compte(k)})
          </button>
        ))}
        <button onClick={() => setNouvelle({ categorie: "general", titre: "", texte: "" })}
          className="ml-auto px-3 py-1 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Ajouter une règle</button>
      </div>
      {nouvelle && (
        <div className="rounded-lg border-2 border-blue-300 p-3 space-y-2">
          <div className="flex gap-2">
            <select value={nouvelle.categorie} onChange={(e) => setNouvelle({ ...nouvelle, categorie: e.target.value })}
              className="px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Titre" value={nouvelle.titre} onChange={(e) => setNouvelle({ ...nouvelle, titre: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm" />
          </div>
          <textarea placeholder="La règle, avec ses conditions et exceptions" rows={8} value={nouvelle.texte}
            onChange={(e) => setNouvelle({ ...nouvelle, texte: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded text-sm" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setNouvelle(null)} className="px-3 py-1 rounded text-sm text-gray-500">Annuler</button>
            <button onClick={ajouter} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Ajouter (validée)</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {regles.filter((r) => r.statut === onglet).map((r) => (
          <FicheRegle key={r.id} r={r} onChange={charger} cible={r.remplace_id ? regles.find((x) => x.id === r.remplace_id && x.statut === "validee") : undefined} />
        ))}
        {!compte(onglet) && <p className="text-sm text-gray-400">Rien ici.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ cadre */

export function EspaceAdmin({ onFermer, ongletInitial = "couts" }: { onFermer: () => void; ongletInitial?: "couts" | "stats" | "regles" }) {
  const [onglet, setOnglet] = useState(ongletInitial);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onFermer}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-6 pt-5 pb-3 border-b border-gray-200 dark:border-slate-700">
          {([["couts", "Coûts", Coins], ["stats", "Statistiques", BarChart3], ["regles", "Règles", BookCheck]] as const).map(([k, l, I]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-1.5 ${onglet === k ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200 font-medium" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>
              <I className="w-4 h-4" /> {l}
            </button>
          ))}
          <button onClick={onFermer} className="ml-auto"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto p-6">
          {onglet === "couts" && <><ChoixModele /><Couts /></>}
          {onglet === "stats" && <Statistiques />}
          {onglet === "regles" && <Regles />}
        </div>
      </div>
    </div>
  );
}
