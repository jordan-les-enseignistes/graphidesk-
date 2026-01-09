import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type {
  FeuilleTemps,
  FeuilleTempsWithHeures,
  HeuresJournalieres,
  HeuresJournalieresInsert,
  HeuresJournalieresUpdate,
  HorairesBase,
  JourSemaine,
  Profile,
} from "@/types";
import { HORAIRES_BASE_DEFAUT } from "@/types/database";
import { toast } from "sonner";
import { planningVacancesKeys } from "./usePlanningVacances";

// Clés de requête
export const heuresKeys = {
  all: ["heures"] as const,
  feuilles: () => [...heuresKeys.all, "feuilles"] as const,
  feuille: (userId: string, annee: number, mois: number) =>
    [...heuresKeys.feuilles(), userId, annee, mois] as const,
  allFeuilles: (annee: number, mois: number) =>
    [...heuresKeys.feuilles(), "all", annee, mois] as const,
};

// Noms des jours de la semaine
export const JOURS_SEMAINE: JourSemaine[] = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

export const JOURS_SEMAINE_LABELS: Record<JourSemaine, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

// Noms des mois
export const MOIS_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// Utilitaires de calcul
export function parseTime(time: string | null): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function formatMinutesToHuman(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

export function calculateDayTotal(
  matinDebut: string | null,
  matinFin: string | null,
  apremDebut: string | null,
  apremFin: string | null
): number {
  let total = 0;

  const md = parseTime(matinDebut);
  const mf = parseTime(matinFin);
  if (md !== null && mf !== null && mf > md) {
    total += mf - md;
  }

  const ad = parseTime(apremDebut);
  const af = parseTime(apremFin);
  if (ad !== null && af !== null && af > ad) {
    total += af - ad;
  }

  return total;
}

// Générer les jours d'un mois (calendaire)
export function getDaysInMonth(annee: number, mois: number): Date[] {
  const days: Date[] = [];
  const date = new Date(annee, mois - 1, 1);

  while (date.getMonth() === mois - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }

  return days;
}

// Générer les jours d'un mois comptable (semaines ISO)
// Un mois comptable INCLUT la semaine qui contient le 1er du mois
// Et EXCLUT la semaine qui contient le 1er du mois suivant
export function getDaysInMonthISO(annee: number, mois: number): Date[] {
  const days: Date[] = [];

  // Trouver le 1er du mois
  const firstOfMonth = new Date(annee, mois - 1, 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=dim, 1=lun, etc.

  // Calculer le LUNDI de la semaine qui contient le 1er du mois
  let startDate: Date;
  if (firstDayOfWeek === 0) {
    // Le 1er est un dimanche -> le lundi était 6 jours avant
    startDate = new Date(annee, mois - 1, 1 - 6);
  } else if (firstDayOfWeek === 1) {
    // Le 1er est un lundi
    startDate = new Date(firstOfMonth);
  } else {
    // Le lundi était (firstDayOfWeek - 1) jours avant
    startDate = new Date(annee, mois - 1, 1 - (firstDayOfWeek - 1));
  }

  // Trouver le 1er du mois suivant
  const firstOfNextMonth = new Date(annee, mois, 1);
  const nextMonthDayOfWeek = firstOfNextMonth.getDay();

  // Calculer le LUNDI de la semaine qui contient le 1er du mois suivant
  let mondayOfNextMonthWeek: Date;
  if (nextMonthDayOfWeek === 0) {
    mondayOfNextMonthWeek = new Date(annee, mois, 1 - 6);
  } else if (nextMonthDayOfWeek === 1) {
    mondayOfNextMonthWeek = new Date(annee, mois, 1);
  } else {
    mondayOfNextMonthWeek = new Date(annee, mois, 1 - (nextMonthDayOfWeek - 1));
  }

  // La fin est le dimanche AVANT ce lundi
  const endDate = new Date(mondayOfNextMonthWeek);
  endDate.setDate(endDate.getDate() - 1);

  // Générer tous les jours
  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function getJourSemaine(date: Date): JourSemaine {
  const jours: JourSemaine[] = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  return jours[date.getDay()];
}

export function getNumeroSemaine(date: Date): number {
  // Créer une copie pour ne pas modifier l'original
  const d = new Date(date.getTime());
  // Ajuster au jeudi de la semaine ISO (lundi = 1, dimanche = 7)
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  // Premier janvier de l'année du jeudi
  const yearStart = new Date(d.getFullYear(), 0, 1);
  // Calculer le numéro de semaine
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Trouver le mois comptable ISO auquel une date appartient
// Le mois comptable ISO est celui dont les semaines incluent cette date
// Par exemple : 26 janvier 2026 (semaine 5) appartient à février 2026 en comptabilité ISO
export function getMoisComptableISO(date: Date): { annee: number; mois: number } {
  const semaine = getNumeroSemaine(date);

  // Parcourir les mois pour trouver celui qui contient cette semaine
  // On vérifie le mois de la date et les mois adjacents
  const anneeDate = date.getFullYear();
  const moisDate = date.getMonth() + 1;

  // Vérifier d'abord le mois calendaire de la date
  const semainesMoisActuel = getSemainesOfMonth(anneeDate, moisDate);
  if (semainesMoisActuel.includes(semaine)) {
    return { annee: anneeDate, mois: moisDate };
  }

  // Si pas dans le mois actuel, vérifier le mois suivant
  const moisSuivant = moisDate === 12 ? 1 : moisDate + 1;
  const anneeSuivante = moisDate === 12 ? anneeDate + 1 : anneeDate;
  const semainesMoisSuivant = getSemainesOfMonth(anneeSuivante, moisSuivant);
  if (semainesMoisSuivant.includes(semaine)) {
    return { annee: anneeSuivante, mois: moisSuivant };
  }

  // Si pas dans le mois suivant, vérifier le mois précédent
  const moisPrecedent = moisDate === 1 ? 12 : moisDate - 1;
  const anneePrecedente = moisDate === 1 ? anneeDate - 1 : anneeDate;
  const semainesMoisPrecedent = getSemainesOfMonth(anneePrecedente, moisPrecedent);
  if (semainesMoisPrecedent.includes(semaine)) {
    return { annee: anneePrecedente, mois: moisPrecedent };
  }

  // Fallback au mois calendaire (ne devrait pas arriver)
  return { annee: anneeDate, mois: moisDate };
}

// Obtenir les numéros de semaines ISO d'un mois comptable
function getSemainesOfMonth(annee: number, mois: number): number[] {
  const days = getDaysInMonthISO(annee, mois);
  const semaines = new Set<number>();
  days.forEach(d => semaines.add(getNumeroSemaine(d)));
  return Array.from(semaines);
}

// Parser une date ISO sans problème de timezone
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Hook pour récupérer ou créer une feuille de temps
export function useFeuilleTemps(annee: number, mois: number, userId?: string) {
  const profile = useAuthStore((state) => state.profile);
  const effectiveUserId = userId || profile?.id;

  return useQuery({
    queryKey: heuresKeys.feuille(effectiveUserId ?? "", annee, mois),
    queryFn: async () => {
      // Récupérer la feuille existante avec les heures
      const { data: feuille, error } = await supabase
        .from("feuilles_temps")
        .select(`
          *,
          heures:heures_journalieres(*)
        `)
        .eq("user_id", effectiveUserId!)
        .eq("annee", annee)
        .eq("mois", mois)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw error;
      }

      if (feuille) {
        return feuille as FeuilleTempsWithHeures;
      }

      // Créer une nouvelle feuille si elle n'existe pas
      const { data: newFeuille, error: createError } = await supabase
        .from("feuilles_temps")
        .insert({
          user_id: effectiveUserId!,
          annee,
          mois,
        })
        .select()
        .single();

      if (createError) throw createError;

      return { ...newFeuille, heures: [] } as FeuilleTempsWithHeures;
    },
    enabled: !!effectiveUserId && !!annee && !!mois,
  });
}

// Hook pour récupérer toutes les feuilles de temps (admin)
export function useAllFeuillesTemps(annee: number, mois: number) {
  return useQuery({
    queryKey: heuresKeys.allFeuilles(annee, mois),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feuilles_temps")
        .select(`
          *,
          heures:heures_journalieres(*),
          user:profiles!feuilles_temps_user_id_fkey(id, full_name, initials, horaires_base)
        `)
        .eq("annee", annee)
        .eq("mois", mois)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as (FeuilleTempsWithHeures & { user: Profile })[];
    },
  });
}

// Hook pour mettre à jour une heure journalière
export function useUpdateHeureJournaliere() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feuilleId,
      date,
      jourSemaine,
      data,
    }: {
      feuilleId: string;
      date: string;
      jourSemaine: JourSemaine;
      data: Partial<HeuresJournalieresUpdate>;
    }) => {
      // Vérifier si l'entrée existe
      const { data: existing } = await supabase
        .from("heures_journalieres")
        .select("id")
        .eq("feuille_id", feuilleId)
        .eq("date", date)
        .single();

      if (existing) {
        // Update
        const { data: updated, error } = await supabase
          .from("heures_journalieres")
          .update(data)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      } else {
        // Insert
        const { data: created, error } = await supabase
          .from("heures_journalieres")
          .insert({
            feuille_id: feuilleId,
            date,
            jour_semaine: jourSemaine,
            ...data,
          } as HeuresJournalieresInsert)
          .select()
          .single();

        if (error) throw error;
        return created;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: heuresKeys.feuilles() });
      // Synchroniser avec Planning Vacances
      queryClient.invalidateQueries({ queryKey: planningVacancesKeys.all });
    },
    onError: (error) => {
      console.error("Erreur mise à jour heure:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

// Helper pour formater une date sans problème de timezone
function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Hook pour initialiser les heures du mois avec les valeurs par défaut
export function useInitialiserMois() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feuilleId,
      annee,
      mois,
      horairesBase,
    }: {
      feuilleId: string;
      annee: number;
      mois: number;
      horairesBase: HorairesBase;
    }) => {
      // Utiliser les jours ISO (semaines comptables)
      const days = getDaysInMonthISO(annee, mois);
      const entries: HeuresJournalieresInsert[] = [];

      for (const day of days) {
        const jourSemaine = getJourSemaine(day);
        const dateStr = formatDateLocal(day);
        const horairesJour = horairesBase[jourSemaine as keyof HorairesBase];

        entries.push({
          feuille_id: feuilleId,
          date: dateStr,
          jour_semaine: jourSemaine,
          matin_debut: horairesJour?.matin?.debut || null,
          matin_fin: horairesJour?.matin?.fin || null,
          aprem_debut: horairesJour?.aprem?.debut || null,
          aprem_fin: horairesJour?.aprem?.fin || null,
        });
      }

      // Supprimer les entrées existantes
      await supabase
        .from("heures_journalieres")
        .delete()
        .eq("feuille_id", feuilleId);

      // Insérer les nouvelles
      const { error } = await supabase
        .from("heures_journalieres")
        .insert(entries);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: heuresKeys.feuilles() });
      toast.success("Mois initialisé avec les horaires par défaut");
    },
    onError: (error) => {
      console.error("Erreur initialisation:", error);
      toast.error("Erreur lors de l'initialisation");
    },
  });
}

// Hook pour récupérer les horaires de base d'un utilisateur
export function useHorairesBase(userId?: string) {
  const profile = useAuthStore((state) => state.profile);
  const effectiveUserId = userId || profile?.id;

  return useQuery({
    queryKey: ["horaires-base", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("horaires_base")
        .eq("id", effectiveUserId!)
        .single();

      if (error) throw error;
      return data.horaires_base as HorairesBase | null;
    },
    enabled: !!effectiveUserId,
  });
}

// Hook pour mettre à jour les horaires de base
// Met également à jour les jours futurs (>= aujourd'hui) dans les feuilles existantes
export function useUpdateHorairesBase() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  return useMutation({
    mutationFn: async (horairesBase: HorairesBase) => {
      // 1. Mettre à jour les horaires dans le profil
      const { error } = await supabase
        .from("profiles")
        .update({ horaires_base: horairesBase as unknown as Record<string, unknown> })
        .eq("id", profile!.id);

      if (error) throw error;

      // 2. Mettre à jour les jours futurs dans les feuilles existantes
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

      // D'abord récupérer les IDs des feuilles non validées de l'utilisateur
      const { data: feuilles, error: feuillesError } = await supabase
        .from("feuilles_temps")
        .select("id")
        .eq("user_id", profile!.id)
        .eq("is_validated", false);

      if (feuillesError || !feuilles || feuilles.length === 0) {
        // Pas de feuilles non validées, rien à mettre à jour
        return;
      }

      const feuilleIds = feuilles.map((f) => f.id);

      // Récupérer toutes les heures journalières futures de ces feuilles
      const { data: futureHeures, error: fetchError } = await supabase
        .from("heures_journalieres")
        .select("id, date, jour_semaine, feuille_id")
        .gte("date", todayStr)
        .in("feuille_id", feuilleIds);

      if (fetchError) {
        console.error("Erreur récupération heures futures:", fetchError);
        // On continue quand même, la mise à jour du profil a réussi
        return;
      }

      // Mettre à jour chaque jour futur avec les nouveaux horaires
      if (futureHeures && futureHeures.length > 0) {
        const updates = futureHeures.map((heure) => {
          const jourSemaine = heure.jour_semaine as keyof HorairesBase;
          const horairesJour = horairesBase[jourSemaine];

          return supabase
            .from("heures_journalieres")
            .update({
              matin_debut: horairesJour?.matin?.debut || null,
              matin_fin: horairesJour?.matin?.fin || null,
              aprem_debut: horairesJour?.aprem?.debut || null,
              aprem_fin: horairesJour?.aprem?.fin || null,
            })
            .eq("id", heure.id);
        });

        // Exécuter toutes les mises à jour
        await Promise.all(updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horaires-base"] });
      queryClient.invalidateQueries({ queryKey: heuresKeys.feuilles() });
      toast.success("Horaires mis à jour (jours futurs également)");
    },
    onError: (error) => {
      console.error("Erreur mise à jour horaires:", error);
      toast.error("Erreur lors de la mise à jour des horaires");
    },
  });
}

// Base légale : 35h par semaine = 7h par jour ouvré (lundi-vendredi)
const HEURES_BASE_PAR_JOUR = 7 * 60; // 420 minutes = 7h

// Calculer les heures prévues pour un jour selon les horaires de base
function getHeuresPrevuesJour(
  jourSemaine: JourSemaine,
  horairesBase?: HorairesBase | null
): { matin: number; aprem: number; total: number } {
  if (!horairesBase) {
    // Fallback: 7h par jour ouvré (3.5h matin + 3.5h après-midi)
    if (["samedi", "dimanche"].includes(jourSemaine)) {
      return { matin: 0, aprem: 0, total: 0 };
    }
    return { matin: 210, aprem: 210, total: 420 }; // 3h30 + 3h30 = 7h
  }

  const horairesJour = horairesBase[jourSemaine as keyof HorairesBase];
  if (!horairesJour) {
    return { matin: 0, aprem: 0, total: 0 };
  }

  let matin = 0;
  let aprem = 0;

  if (horairesJour.matin?.debut && horairesJour.matin?.fin) {
    const md = parseTime(horairesJour.matin.debut);
    const mf = parseTime(horairesJour.matin.fin);
    if (md !== null && mf !== null && mf > md) {
      matin = mf - md;
    }
  }

  if (horairesJour.aprem?.debut && horairesJour.aprem?.fin) {
    const ad = parseTime(horairesJour.aprem.debut);
    const af = parseTime(horairesJour.aprem.fin);
    if (ad !== null && af !== null && af > ad) {
      aprem = af - ad;
    }
  }

  return { matin, aprem, total: matin + aprem };
}

// Base hebdomadaire légale : 35h = 2100 minutes
const HEURES_BASE_SEMAINE = 35 * 60;

// Calculer le total des heures sup pour un mois
// La règle est simple : HS = heures travaillées - 35h par semaine
// Les congés payés et jours fériés comptent comme les heures prévues du graphiste
// Si validWeekNumbers est fourni, seules les heures des semaines listées sont comptées
// Si joursFeriesDates est fourni, les jours correspondants sont traités comme fériés même sans type_absence
export function calculateMonthlyHoursSup(
  heures: HeuresJournalieres[],
  horairesBase?: HorairesBase | null,
  validWeekNumbers?: number[],
  joursFeriesDates?: Set<string>
): {
  totalTravaille: number;
  totalBase: number;
  heuresSup: number;
  parSemaine: Record<number, { travaille: number; base: number; sup: number }>;
} {
  const parSemaine: Record<number, { travaille: number; base: number; sup: number }> = {};

  for (const heure of heures) {
    const date = parseDateString(heure.date);
    const semaine = getNumeroSemaine(date);

    // Si validWeekNumbers est fourni, ignorer les heures des semaines non listées
    if (validWeekNumbers && !validWeekNumbers.includes(semaine)) {
      continue;
    }

    const jourSemaine = heure.jour_semaine as JourSemaine;

    if (!parSemaine[semaine]) {
      // Initialiser avec base = 35h pour chaque semaine
      parSemaine[semaine] = { travaille: 0, base: HEURES_BASE_SEMAINE, sup: 0 };
    }

    const isJourOuvre = !["samedi", "dimanche"].includes(jourSemaine);
    const heuresPrevues = getHeuresPrevuesJour(jourSemaine, horairesBase);

    // Vérifier si c'est un jour férié (via type_absence OU via la liste des jours fériés)
    const isJourFerie = heure.type_absence === "ferie" || joursFeriesDates?.has(heure.date);
    if (isJourFerie) {
      // Jour férié = heures prévues du graphiste comptées comme travaillées
      if (isJourOuvre) {
        parSemaine[semaine].travaille += heuresPrevues.total;
      }
      continue;
    }

    // Gestion des congés payés
    if (heure.type_absence === "conge") {
      // Congé journée complète = heures prévues du graphiste comptées comme travaillées
      if (isJourOuvre) {
        parSemaine[semaine].travaille += heuresPrevues.total;
      }
      continue;
    }

    if (heure.type_absence === "conge_matin") {
      // Congé matin = heures matin prévues comptées + heures travaillées l'après-midi
      const travailleAprem = calculateDayTotal(null, null, heure.aprem_debut, heure.aprem_fin);
      const totalJour = heuresPrevues.matin + travailleAprem;
      parSemaine[semaine].travaille += totalJour;
      continue;
    }

    if (heure.type_absence === "conge_aprem") {
      // Congé après-midi = heures travaillées le matin + heures après-midi prévues comptées
      const travailleMatin = calculateDayTotal(heure.matin_debut, heure.matin_fin, null, null);
      const totalJour = travailleMatin + heuresPrevues.aprem;
      parSemaine[semaine].travaille += totalJour;
      continue;
    }

    // Jour normal : heures travaillées
    const travaille = calculateDayTotal(
      heure.matin_debut,
      heure.matin_fin,
      heure.aprem_debut,
      heure.aprem_fin
    );
    parSemaine[semaine].travaille += travaille;
  }

  // Calculer les heures sup par semaine (travaillé - 35h)
  let totalTravaille = 0;
  let totalBase = 0;
  for (const semaine in parSemaine) {
    const s = parSemaine[semaine];
    s.sup = s.travaille - s.base;
    totalTravaille += s.travaille;
    totalBase += s.base;
  }

  return {
    totalTravaille,
    totalBase,
    heuresSup: totalTravaille - totalBase,
    parSemaine,
  };
}
