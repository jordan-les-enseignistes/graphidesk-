// Edge Function : réception des webhooks FreshProcess.
//
// FreshProcess appelle cette adresse quand une tâche change d'état (réglage
// « webhook » d'une tâche). On enregistre le message tel quel dans fp_webhooks :
// première étape pour savoir ce qu'il contient (projet, notes, tâches…).
// L'adresse est protégée par une clé dans l'URL (?cle=…), connue de FreshProcess seul.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const attendue = Deno.env.get("FP_WEBHOOK_CLE");
  if (!attendue || url.searchParams.get("cle") !== attendue) return new Response("non", { status: 403 });

  const brut = req.method === "GET" ? "" : await req.text();
  let requete: unknown = null;
  try { requete = brut ? JSON.parse(brut) : Object.fromEntries(url.searchParams); } catch { /* corps non JSON : gardé brut */ }
  if (requete && typeof requete === "object" && "cle" in (requete as Record<string, unknown>)) delete (requete as Record<string, unknown>).cle;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("fp_webhooks").insert({
    methode: req.method,
    type_contenu: req.headers.get("content-type"),
    requete,
    corps_brut: brut.slice(0, 200_000),
  });
  // FreshProcess attend une réponse positive
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
