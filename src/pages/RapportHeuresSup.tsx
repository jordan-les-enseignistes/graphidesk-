import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function RapportHeuresSup() {
  const { id } = useParams<{ id: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRapport() {
      if (!id) {
        setError("ID manquant");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("email_heures_sup_log")
        .select("rapport_html")
        .eq("id", id)
        .single();

      if (fetchError || !data?.rapport_html) {
        setError("Rapport non trouvé ou expiré");
        setLoading(false);
        return;
      }

      setHtml(data.rapport_html);
      setLoading(false);
    }

    fetchRapport();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 dark:text-red-500 mb-2">Erreur</h1>
          <p className="text-gray-600 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  // Afficher le HTML directement
  return (
    <div
      className="rapport-container"
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
}
