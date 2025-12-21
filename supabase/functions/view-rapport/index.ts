// Edge Function publique pour afficher les rapports HTML
// Cette fonction est configurée pour être accessible sans authentification

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);

  // Test simple
  if (url.searchParams.get("test") === "1") {
    return new Response(
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Test</title></head><body style=\"background:blue;color:white;padding:50px\"><h1>Ca marche!</h1><p>Si tu vois ce texte en blanc sur bleu, le HTML fonctionne.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const fileName = url.searchParams.get("f");

  // Validation du nom de fichier
  if (!fileName || !fileName.match(/^detail-\d{4}-\d{2}-S[\d-]+\.html$/)) {
    return new Response(
      "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body><h1>Fichier invalide</h1></body></html>",
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.storage
      .from("rapports-heures-sup")
      .download(fileName);

    if (error || !data) {
      console.error("Download error:", error);
      return new Response(
        "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body><h1>Rapport non trouve</h1><p>Ce rapport n'existe pas ou a expire.</p></body></html>",
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const html = await data.text();
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      }
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      `<!DOCTYPE html><html><head><meta charset='utf-8'></head><body><h1>Erreur</h1><p>${err.message}</p></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
