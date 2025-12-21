import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { heuresKeys } from "./useHeuresSupplementaires";
import type { JourFerie, HeuresJournalieres } from "@/types";
import { toast } from "sonner";

// Clés de requête
export const planningVacancesKeys = {
  all: ["planning-vacances"] as const,
  conges: (annee: number, mois: number) =>
    [...planningVacancesKeys.all, "conges", annee, mois] as const,
  joursFeries: (annee: number, mois: number) =>
    [...planningVacancesKeys.all, "jours-feries", annee, mois] as const,
};

// Types d'absence pour les congés
export type TypeConge = "conge" | "conge_matin" | "conge_aprem";

// Type pour un congé avec le prénom
export type CongeAvecPrenom = {
  date: string;
  prenom: string;
  userId: string;
  type: TypeConge;
};

// Extraire le prénom depuis full_name
function getPrenom(fullName: string): string {
  return fullName.split(" ")[0];
}

// Générer les jours d'un mois calendaire avec padding pour la grille
export function getCalendarDays(annee: number, mois: number): Date[] {
  const days: Date[] = [];

  // Premier jour du mois
  const firstDay = new Date(annee, mois - 1, 1);
  // Dernier jour du mois
  const lastDay = new Date(annee, mois, 0);

  // Ajouter les jours du mois précédent pour compléter la première semaine
  // (lundi = 1, dimanche = 0 -> on veut commencer par lundi)
  const firstDayOfWeek = firstDay.getDay();
  const daysToAddBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  for (let i = daysToAddBefore; i > 0; i--) {
    const date = new Date(annee, mois - 1, 1 - i);
    days.push(date);
  }

  // Ajouter tous les jours du mois
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(annee, mois - 1, d));
  }

  // Ajouter les jours du mois suivant pour compléter la dernière semaine
  const lastDayOfWeek = lastDay.getDay();
  const daysToAddAfter = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;

  for (let i = 1; i <= daysToAddAfter; i++) {
    days.push(new Date(annee, mois, i));
  }

  return days;
}

// Formater une date en string YYYY-MM-DD
export function formatDateToString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Hook pour récupérer les congés de tous les utilisateurs pour un mois
export function useCongesMois(annee: number, mois: number) {
  return useQuery({
    queryKey: planningVacancesKeys.conges(annee, mois),
    queryFn: async () => {
      // Calculer les dates de début et fin incluant le padding du calendrier
      const calendarDays = getCalendarDays(annee, mois);
      const startDate = formatDateToString(calendarDays[0]);
      const endDate = formatDateToString(calendarDays[calendarDays.length - 1]);

      // Récupérer toutes les feuilles de temps avec leurs heures et users
      const { data, error } = await supabase
        .from("feuilles_temps")
        .select(
          `
          user_id,
          user:profiles!feuilles_temps_user_id_fkey(id, full_name),
          heures:heures_journalieres(date, type_absence)
        `
        );

      if (error) throw error;

      // Transformer en Map<date, prénoms[]>
      const congesParJour = new Map<string, CongeAvecPrenom[]>();

      for (const feuille of data || []) {
        // Supabase retourne un objet pour les relations one-to-one
        const user = feuille.user as unknown as { id: string; full_name: string } | null;
        if (!user) continue;

        const heures = feuille.heures as { date: string; type_absence: string | null }[] || [];

        for (const heure of heures) {
          // Filtrer : uniquement les congés (journée complète ou demi-journée) dans la plage de dates
          const isConge = heure.type_absence === "conge" ||
                          heure.type_absence === "conge_matin" ||
                          heure.type_absence === "conge_aprem";
          if (!isConge) continue;
          if (heure.date < startDate || heure.date > endDate) continue;

          const prenom = getPrenom(user.full_name);
          const userId = user.id;

          if (!congesParJour.has(heure.date)) {
            congesParJour.set(heure.date, []);
          }

          // Éviter les doublons
          const existing = congesParJour.get(heure.date)!;
          if (!existing.some((c) => c.userId === userId)) {
            existing.push({
              date: heure.date,
              prenom,
              userId,
              type: heure.type_absence as TypeConge
            });
          }
        }
      }

      return congesParJour;
    },
  });
}

// Hook pour récupérer les jours fériés
export function useJoursFeriesMois(annee: number, mois: number) {
  // Inclure les mois adjacents pour le padding du calendrier
  const anneeMin = mois === 1 ? annee - 1 : annee;
  const moisMin = mois === 1 ? 12 : mois - 1;
  const anneeMax = mois === 12 ? annee + 1 : annee;
  const moisMax = mois === 12 ? 1 : mois + 1;

  return useQuery({
    queryKey: planningVacancesKeys.joursFeries(annee, mois),
    queryFn: async () => {
      const startDate = `${anneeMin}-${moisMin.toString().padStart(2, "0")}-01`;
      const endDate = `${anneeMax}-${moisMax.toString().padStart(2, "0")}-31`;

      const { data, error } = await supabase
        .from("jours_feries")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;

      // Transformer en Map<date, nom du jour férié>
      const feriesParJour = new Map<string, string>();
      for (const ferie of data || []) {
        feriesParJour.set(ferie.date, ferie.nom);
      }

      return feriesParJour;
    },
  });
}

// Hook combiné pour le planning vacances
export function usePlanningVacances(annee: number, mois: number) {
  const congesQuery = useCongesMois(annee, mois);
  const feriesQuery = useJoursFeriesMois(annee, mois);

  return {
    conges: congesQuery.data ?? new Map<string, CongeAvecPrenom[]>(),
    joursFeries: feriesQuery.data ?? new Map<string, string>(),
    isLoading: congesQuery.isLoading || feriesQuery.isLoading,
    isError: congesQuery.isError || feriesQuery.isError,
    error: congesQuery.error || feriesQuery.error,
    refetch: () => {
      congesQuery.refetch();
      feriesQuery.refetch();
    },
  };
}

// Jours de la semaine en français
const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

function getJourSemaine(date: Date): string {
  return JOURS_SEMAINE[date.getDay()];
}

// Type pour la création de congés
export type CreateCongeParams = {
  userId: string;
  dateDebut: string;
  dateFin: string;
  typeConge: TypeConge;
};

// Hook pour créer des congés sur une période
export function useCreateConges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, dateDebut, dateFin, typeConge }: CreateCongeParams) => {
      // Générer toutes les dates entre dateDebut et dateFin
      const dates: string[] = [];
      const start = new Date(dateDebut);
      const end = new Date(dateFin);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Exclure les weekends
        if (d.getDay() !== 0 && d.getDay() !== 6) {
          dates.push(formatDateToString(new Date(d)));
        }
      }

      if (dates.length === 0) {
        throw new Error("Aucun jour ouvré sélectionné");
      }

      // Pour chaque date, on doit :
      // 1. Vérifier/créer la feuille de temps du mois
      // 2. Créer/mettre à jour l'entrée heures_journalieres

      for (const dateStr of dates) {
        const date = new Date(dateStr);
        const annee = date.getFullYear();
        const mois = date.getMonth() + 1;

        // Récupérer ou créer la feuille de temps
        let { data: feuille, error: feuilleError } = await supabase
          .from("feuilles_temps")
          .select("id")
          .eq("user_id", userId)
          .eq("annee", annee)
          .eq("mois", mois)
          .single();

        if (feuilleError && feuilleError.code === "PGRST116") {
          // Créer la feuille si elle n'existe pas
          const { data: newFeuille, error: createError } = await supabase
            .from("feuilles_temps")
            .insert({ user_id: userId, annee, mois })
            .select("id")
            .single();

          if (createError) throw createError;
          feuille = newFeuille;
        } else if (feuilleError) {
          throw feuilleError;
        }

        // Vérifier si l'entrée existe déjà
        const { data: existingHeure } = await supabase
          .from("heures_journalieres")
          .select("id")
          .eq("feuille_id", feuille!.id)
          .eq("date", dateStr)
          .single();

        const jourSemaine = getJourSemaine(date);

        if (existingHeure) {
          // Mettre à jour
          const { error: updateError } = await supabase
            .from("heures_journalieres")
            .update({
              type_absence: typeConge,
              matin_debut: null,
              matin_fin: null,
              aprem_debut: null,
              aprem_fin: null,
            })
            .eq("id", existingHeure.id);

          if (updateError) throw updateError;
        } else {
          // Créer
          const { error: insertError } = await supabase
            .from("heures_journalieres")
            .insert({
              feuille_id: feuille!.id,
              date: dateStr,
              jour_semaine: jourSemaine,
              type_absence: typeConge,
            });

          if (insertError) throw insertError;
        }
      }

      return { count: dates.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: planningVacancesKeys.all });
      queryClient.invalidateQueries({ queryKey: heuresKeys.feuilles() });
      toast.success(`${data.count} jour(s) de congé enregistré(s)`);
    },
    onError: (error) => {
      console.error("Erreur création congés:", error);
      toast.error("Erreur lors de l'enregistrement des congés");
    },
  });
}

// Horaires par défaut (importé depuis le type)
const HORAIRES_BASE_DEFAUT = {
  lundi: { matin: { debut: "08:00", fin: "12:00" }, aprem: { debut: "14:00", fin: "17:00" } },
  mardi: { matin: { debut: "08:00", fin: "12:00" }, aprem: { debut: "14:00", fin: "17:00" } },
  mercredi: { matin: { debut: "08:00", fin: "12:00" }, aprem: { debut: "14:00", fin: "17:00" } },
  jeudi: { matin: { debut: "08:00", fin: "12:00" }, aprem: { debut: "14:00", fin: "17:00" } },
  vendredi: { matin: { debut: "08:00", fin: "12:00" }, aprem: { debut: "14:00", fin: "17:00" } },
  samedi: null,
  dimanche: null,
};

// Hook pour supprimer des congés sur une période
export function useDeleteConges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      dateDebut,
      dateFin,
    }: {
      userId: string;
      dateDebut: string;
      dateFin: string;
    }) => {
      // Récupérer les horaires de base de l'utilisateur
      const { data: profile } = await supabase
        .from("profiles")
        .select("horaires_base")
        .eq("id", userId)
        .single();

      const horairesBase = (profile?.horaires_base as typeof HORAIRES_BASE_DEFAUT) || HORAIRES_BASE_DEFAUT;

      // Générer toutes les dates entre dateDebut et dateFin
      const dates: string[] = [];
      const start = new Date(dateDebut);
      const end = new Date(dateFin);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(formatDateToString(new Date(d)));
      }

      // Pour chaque date, remettre type_absence à null et réinitialiser les horaires
      for (const dateStr of dates) {
        const date = new Date(dateStr);
        const annee = date.getFullYear();
        const mois = date.getMonth() + 1;
        const jourSemaine = getJourSemaine(date);
        const horairesJour = horairesBase[jourSemaine as keyof typeof horairesBase];

        // Récupérer la feuille de temps
        const { data: feuille } = await supabase
          .from("feuilles_temps")
          .select("id")
          .eq("user_id", userId)
          .eq("annee", annee)
          .eq("mois", mois)
          .single();

        if (feuille) {
          await supabase
            .from("heures_journalieres")
            .update({
              type_absence: null,
              matin_debut: horairesJour?.matin?.debut || null,
              matin_fin: horairesJour?.matin?.fin || null,
              aprem_debut: horairesJour?.aprem?.debut || null,
              aprem_fin: horairesJour?.aprem?.fin || null,
            })
            .eq("feuille_id", feuille.id)
            .eq("date", dateStr)
            .in("type_absence", ["conge", "conge_matin", "conge_aprem"]);
        }
      }

      return { count: dates.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningVacancesKeys.all });
      queryClient.invalidateQueries({ queryKey: heuresKeys.feuilles() });
      toast.success("Congé(s) supprimé(s)");
    },
    onError: (error) => {
      console.error("Erreur suppression congés:", error);
      toast.error("Erreur lors de la suppression des congés");
    },
  });
}

// Hook pour récupérer les congés d'un utilisateur spécifique pour une date
export function useCongesUtilisateur(userId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: [...planningVacancesKeys.all, "user", userId, date],
    queryFn: async () => {
      if (!userId || !date) return null;

      const dateObj = new Date(date);
      const annee = dateObj.getFullYear();
      const mois = dateObj.getMonth() + 1;

      const { data: feuille } = await supabase
        .from("feuilles_temps")
        .select("id")
        .eq("user_id", userId)
        .eq("annee", annee)
        .eq("mois", mois)
        .single();

      if (!feuille) return null;

      const { data: heure } = await supabase
        .from("heures_journalieres")
        .select("*")
        .eq("feuille_id", feuille.id)
        .eq("date", date)
        .single();

      return heure as HeuresJournalieres | null;
    },
    enabled: !!userId && !!date,
  });
}
