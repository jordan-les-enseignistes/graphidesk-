// Edge Function : devis d'un dossier, lu dans Dolibarr (API REST officielle).
//
// Entrée  : POST { ref: "CO2609-5738" }  (JWT de l'utilisateur connecté à GraphiDesk)
// Sortie  : { trouve, source: "propal" | "commande", ref, fichier, contenu (PDF base64),
//             notes: { publique, privee }, lignes: [...] }  ou  { trouve: false, raison }
//
// La clé (secret DOLIBARR_API_KEY) est celle d'un utilisateur Dolibarr dédié, en LECTURE
// seule sur les devis et commandes ; elle ne quitte jamais le serveur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = Deno.env.get("DOLIBARR_API_URL") ?? "https://gestion.les-enseignistes.fr/htdocs/api/index.php";

// deno-lint-ignore no-explicit-any
type Json = any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let enDiag = false; let journal: string[] = [];
  const json = (corps: unknown, statut = 200) => {
    const c = enDiag && corps && typeof corps === "object" ? { ...(corps as Record<string, unknown>), contenu: undefined, trace: journal } : corps;
    return new Response(JSON.stringify(c), { status: statut, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  };

  const cle = Deno.env.get("DOLIBARR_API_KEY");
  if (!cle) return json({ trouve: false, raison: "Connexion Dolibarr non configurée (secret DOLIBARR_API_KEY absent)" });

  // diagnostic (mise au point) : protégé par un secret, et ne renvoie jamais le contenu des PDF
  const url = new URL(req.url);
  const diag = !!Deno.env.get("DOLIBARR_DIAG_CLE") && url.searchParams.get("diag") === Deno.env.get("DOLIBARR_DIAG_CLE");

  // sinon, seul un utilisateur connecté à GraphiDesk peut interroger Dolibarr
  if (!diag) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(jeton);
    if (!auth?.user) return json({ erreur: "Non connecté" }, 401);
  }

  let ref = diag ? String(url.searchParams.get("ref") ?? "").toUpperCase() : "";
  if (!diag) try { ref = String((await req.json()).ref ?? "").trim().toUpperCase(); } catch { /* corps illisible */ }
  const trace: string[] = [];
  enDiag = diag; journal = trace;
  if (!/^CO\d{4}-\d{3,6}$/.test(ref)) return json({ trouve: false, raison: `Numéro de commande illisible : « ${ref} »` });

  const appeler = async (chemin: string): Promise<Json> => {
    const r = await fetch(`${BASE}${chemin}`, { headers: { DOLAPIKEY: cle, Accept: "application/json" } });
    trace.push(`${chemin.split("?")[0]} → ${r.status}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Dolibarr ${r.status} sur ${chemin.split("?")[0]}`);
    return await r.json();
  };
  const telecharger = async (modulepart: string, fichier: string): Promise<Json> => {
    try {
      return await appeler(`/documents/download?modulepart=${modulepart}&original_file=${encodeURIComponent(fichier)}`);
    } catch { return null; }
  };

  try {
    // 1. la commande (CO…)
    // selon la version de Dolibarr : accès direct par référence, sinon filtre « = » ou « like »
    let cmd: Json = await appeler(`/orders/ref/${encodeURIComponent(ref)}`).catch(() => null);
    for (const f of [`(t.ref:=:'${ref}')`, `(t.ref:like:'${ref}')`]) {
      if (cmd?.id) break;
      const liste: Json[] = (await appeler(`/orders?sqlfilters=${encodeURIComponent(f)}&limit=1`).catch(() => null)) ?? [];
      if (liste[0]?.id) cmd = await appeler(`/orders/${liste[0].id}`);
    }
    if (!cmd?.id) {
      if (enDiag) {
        const une: Json[] = (await appeler(`/orders?limit=1&sortorder=DESC`).catch(() => null)) ?? [];
        trace.push(`commandes visibles par l'utilisateur : ${une.length ? "oui (ex. " + une[0].ref + ")" : "aucune"}`);
      }
      return json({ trouve: false, raison: `Commande ${ref} introuvable dans Dolibarr` });
    }

    const notes = { publique: cmd.note_public ?? "", privee: cmd.note_private ?? "" };
    const lignes = (cmd.lines ?? []).map((l: Json) => ({
      libelle: l.product_label || l.label || "",
      description: String(l.desc ?? l.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      quantite: Number(l.qty ?? 0),
    }));

    // 2. le devis signé (PR…) lié à la commande, de préférence
    const idsPropal = Object.values(cmd.linkedObjectsIds?.propal ?? {}) as (string | number)[];
    for (const id of idsPropal) {
      const p = await appeler(`/proposals/${id}`);
      if (!p?.ref) continue;
      const docs: Json[] = (await appeler(`/documents?modulepart=propal&ref=${encodeURIComponent(p.ref)}`)) ?? [];
      const pdfs = docs.map((d) => String(d.name ?? d.filename ?? "")).filter((n) => /\.pdf$/i.test(n));
      const choix = pdfs.find((n) => /sign/i.test(n)) ?? pdfs.find((n) => n.toUpperCase() === `${p.ref}.PDF`) ?? pdfs[0];
      if (!choix) continue;
      const f = await telecharger("propal", `${p.ref}/${choix}`);
      if (f?.content) return json({ trouve: true, source: "propal", ref: p.ref, fichier: f.filename ?? choix, contenu: f.content, notes, lignes });
    }

    // 3. sinon, le PDF de la commande elle-même
    const f = await telecharger("commande", `${ref}/${ref}.pdf`);
    if (f?.content) return json({ trouve: true, source: "commande", ref, fichier: f.filename ?? `${ref}.pdf`, contenu: f.content, notes, lignes });

    return json({ trouve: false, raison: `Commande ${ref} trouvée, mais aucun PDF de devis ou de commande`, notes, lignes });
  } catch (e) {
    return json({ trouve: false, raison: String((e as Error)?.message ?? e) });
  }
});
