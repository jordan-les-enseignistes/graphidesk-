import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export const CLE_NOTIFS_VERIFIZY = ["verifizy-notifs"];

/**
 * Badge VérifIzy : mes vérifications terminées pendant que j'étais ailleurs
 * (rapport prêt ou questions en attente) + les règles proposées à valider
 * (admin seulement).
 */
export function useVerifizyNotifs(estAdmin: boolean) {
  const monId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: [...CLE_NOTIFS_VERIFIZY, monId, estAdmin],
    enabled: !!monId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count: aVoir } = await supabase.from("verif_conversations")
        .select("id", { count: "exact", head: true }).eq("user_id", monId!).eq("a_voir", true);
      let regles = 0;
      if (estAdmin) {
        const { count } = await supabase.from("verif_regles")
          .select("id", { count: "exact", head: true }).eq("statut", "proposee");
        regles = count ?? 0;
      }
      return { aVoir: aVoir ?? 0, regles, total: (aVoir ?? 0) + regles };
    },
  });
}
