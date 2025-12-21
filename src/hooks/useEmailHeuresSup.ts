import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

export interface Destinataire {
  email: string;
  type: "to" | "cc" | "bcc";
  label?: string;
}

export interface EmailConfig {
  id: string;
  destinataires: Destinataire[];
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  auto_enabled: boolean;
  auto_frequency: "weekly" | "monthly" | null;
  auto_day: number | null;
  auto_hour: number | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  annee: number;
  mois: number;
  semaines: number[];
  destinataires: Destinataire[];
  status: "pending" | "sent" | "failed";
  error_message: string | null;
  sent_by: string | null;
  sent_at: string;
  created_at: string;
}

// Récupérer la configuration email
export function useEmailConfig() {
  return useQuery({
    queryKey: ["email-config-heures-sup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_config_heures_sup")
        .select("*")
        .single();

      if (error) throw error;
      return data as EmailConfig;
    },
  });
}

// Mettre à jour la configuration email
export function useUpdateEmailConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<EmailConfig>) => {
      // D'abord récupérer l'ID de la config (il n'y a qu'une seule ligne)
      const { data: existing, error: fetchError } = await supabase
        .from("email_config_heures_sup")
        .select("id")
        .single();

      if (fetchError) throw fetchError;
      if (!existing) throw new Error("Configuration non trouvée");

      // Ensuite faire l'update avec l'ID
      const { data, error } = await supabase
        .from("email_config_heures_sup")
        .update(config)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-config-heures-sup"] });
      toast.success("Configuration email mise à jour");
    },
    onError: (error) => {
      console.error("Erreur mise à jour config email:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

// Récupérer l'historique des envois
export function useEmailLogs(limit = 10) {
  return useQuery({
    queryKey: ["email-logs-heures-sup", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_heures_sup_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as EmailLog[];
    },
  });
}

// Envoyer l'email manuellement
export function useSendHeuresSupEmail() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async ({
      annee,
      mois,
      semaines,
    }: {
      annee: number;
      mois: number;
      semaines?: number[];
    }) => {
      // Appeler l'Edge Function avec AbortController pour timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      try {
        const { data, error } = await supabase.functions.invoke("send-heures-sup-email", {
          body: {
            annee,
            mois,
            semaines,
            userId: profile?.id,
          },
        });

        clearTimeout(timeoutId);

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Erreur inconnue");

        return data;
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("Function call error:", err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-logs-heures-sup"] });
      toast.success("Email envoyé avec succès !");
    },
    onError: (error) => {
      console.error("Erreur envoi email:", error);
      toast.error(`Erreur: ${error.message}`);
    },
  });
}
