import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dossierKeys } from "./useDossiers";
import { profileKeys } from "./useProfiles";
import { toast } from "sonner";

// Hook pour écouter les changements en temps réel sur les dossiers
export function useRealtimeDossiers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("dossiers-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dossiers",
        },
        (payload) => {
          // Invalider le cache pour forcer le refresh
          queryClient.invalidateQueries({ queryKey: dossierKeys.all });

          // Notification optionnelle
          if (payload.eventType === "INSERT") {
            toast.info("Nouveau dossier créé", { duration: 3000 });
          } else if (payload.eventType === "UPDATE") {
            // Ne pas notifier pour les propres modifications
            // On pourrait comparer payload.new.updated_by avec l'utilisateur courant
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

// Hook pour écouter les changements sur les profils
export function useRealtimeProfiles() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: profileKeys.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

// Hook combiné pour toutes les souscriptions temps réel
export function useRealtime() {
  useRealtimeDossiers();
  useRealtimeProfiles();
}
