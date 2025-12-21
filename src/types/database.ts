export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Types pour les horaires
export interface PlageHoraire {
  debut: string; // Format "HH:MM"
  fin: string;
}

export interface HorairesJour {
  matin: PlageHoraire | null;
  aprem: PlageHoraire | null;
}

export interface HorairesBase {
  lundi: HorairesJour;
  mardi: HorairesJour;
  mercredi: HorairesJour;
  jeudi: HorairesJour;
  vendredi: HorairesJour;
}

export const HORAIRES_BASE_DEFAUT: HorairesBase = {
  lundi: { matin: { debut: "08:30", fin: "12:30" }, aprem: { debut: "13:30", fin: "17:30" } },
  mardi: { matin: { debut: "08:30", fin: "12:30" }, aprem: { debut: "13:30", fin: "17:30" } },
  mercredi: { matin: { debut: "08:30", fin: "12:30" }, aprem: { debut: "13:30", fin: "17:30" } },
  jeudi: { matin: { debut: "08:30", fin: "12:30" }, aprem: { debut: "13:30", fin: "17:30" } },
  vendredi: { matin: { debut: "08:30", fin: "11:30" }, aprem: null },
};

// Préférences utilisateur
export interface UserPreferences {
  minimize_on_close: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  minimize_on_close: true,
};

// Couleurs de badge disponibles pour les graphistes
export const BADGE_COLORS = [
  { id: "blue", label: "Bleu", bg: "bg-blue-100", text: "text-blue-600" },
  { id: "green", label: "Vert", bg: "bg-green-100", text: "text-green-600" },
  { id: "purple", label: "Violet", bg: "bg-purple-100", text: "text-purple-600" },
  { id: "pink", label: "Rose", bg: "bg-pink-100", text: "text-pink-600" },
  { id: "orange", label: "Orange", bg: "bg-orange-100", text: "text-orange-600" },
  { id: "teal", label: "Turquoise", bg: "bg-teal-100", text: "text-teal-600" },
  { id: "indigo", label: "Indigo", bg: "bg-indigo-100", text: "text-indigo-600" },
  { id: "red", label: "Rouge", bg: "bg-red-100", text: "text-red-600" },
  { id: "yellow", label: "Jaune", bg: "bg-yellow-100", text: "text-yellow-700" },
  { id: "cyan", label: "Cyan", bg: "bg-cyan-100", text: "text-cyan-600" },
] as const;

export type BadgeColorId = typeof BADGE_COLORS[number]["id"];

export const DEFAULT_BADGE_COLOR: BadgeColorId = "blue";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          initials: string;
          role: "admin" | "graphiste";
          is_active: boolean;
          permissions: Json;
          horaires_base: HorairesBase | null;
          preferences: UserPreferences | null;
          badge_color: BadgeColorId | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          initials: string;
          role?: "admin" | "graphiste";
          is_active?: boolean;
          permissions?: Json;
          horaires_base?: HorairesBase | null;
          preferences?: UserPreferences | null;
          badge_color?: BadgeColorId | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          initials?: string;
          role?: "admin" | "graphiste";
          is_active?: boolean;
          permissions?: Json;
          horaires_base?: HorairesBase | null;
          preferences?: UserPreferences | null;
          badge_color?: BadgeColorId | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      dossiers: {
        Row: {
          id: string;
          graphiste_id: string;
          nom: string;
          date_creation: string;
          deadline_premiere_reponse: string | null;
          deadline_commentaires: string | null;
          statut: string;
          has_commentaires: boolean;
          commentaires: string | null;
          is_archived: boolean;
          date_archivage: string | null;
          bat_count: number;
          dernier_bat: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          graphiste_id: string;
          nom: string;
          date_creation?: string;
          deadline_premiere_reponse?: string | null;
          deadline_commentaires?: string | null;
          statut?: string;
          has_commentaires?: boolean;
          commentaires?: string | null;
          is_archived?: boolean;
          date_archivage?: string | null;
          bat_count?: number;
          dernier_bat?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          graphiste_id?: string;
          nom?: string;
          date_creation?: string;
          deadline_premiere_reponse?: string | null;
          deadline_commentaires?: string | null;
          statut?: string;
          has_commentaires?: boolean;
          commentaires?: string | null;
          is_archived?: boolean;
          date_archivage?: string | null;
          bat_count?: number;
          dernier_bat?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      dossier_bats: {
        Row: {
          id: string;
          dossier_id: string;
          date_envoi: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dossier_id: string;
          date_envoi?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          dossier_id?: string;
          date_envoi?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      franchises: {
        Row: {
          id: string;
          nom: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          created_at?: string;
        };
      };
      franchise_assignments: {
        Row: {
          id: string;
          franchise_id: string;
          graphiste_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          franchise_id: string;
          graphiste_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          franchise_id?: string;
          graphiste_id?: string;
          created_at?: string;
        };
      };
      projets_internes: {
        Row: {
          id: string;
          commercial: string | null;
          tache: string;
          demande: string | null;
          graphiste_id: string | null;
          is_termine: boolean;
          statut: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          commercial?: string | null;
          tache: string;
          demande?: string | null;
          graphiste_id?: string | null;
          is_termine?: boolean;
          statut?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          commercial?: string | null;
          tache?: string;
          demande?: string | null;
          graphiste_id?: string | null;
          is_termine?: boolean;
          statut?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          table_name: string;
          record_id: string;
          action: string;
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          table_name: string;
          record_id: string;
          action: string;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          table_name?: string;
          record_id?: string;
          action?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
      };
      feuilles_temps: {
        Row: {
          id: string;
          user_id: string;
          annee: number;
          mois: number;
          total_heures_sup: string | null; // Format interval PostgreSQL
          is_validated: boolean;
          validated_at: string | null;
          validated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          annee: number;
          mois: number;
          total_heures_sup?: string | null;
          is_validated?: boolean;
          validated_at?: string | null;
          validated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          annee?: number;
          mois?: number;
          total_heures_sup?: string | null;
          is_validated?: boolean;
          validated_at?: string | null;
          validated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      heures_journalieres: {
        Row: {
          id: string;
          feuille_id: string;
          date: string;
          jour_semaine: "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi" | "dimanche";
          matin_debut: string | null;
          matin_fin: string | null;
          aprem_debut: string | null;
          aprem_fin: string | null;
          total_jour: string | null; // Format interval PostgreSQL (calculé automatiquement)
          type_absence: "conge" | "conge_matin" | "conge_aprem" | "ferie" | "maladie" | "rtt" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          feuille_id: string;
          date: string;
          jour_semaine: "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi" | "dimanche";
          matin_debut?: string | null;
          matin_fin?: string | null;
          aprem_debut?: string | null;
          aprem_fin?: string | null;
          type_absence?: "conge" | "ferie" | "maladie" | "rtt" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          feuille_id?: string;
          date?: string;
          jour_semaine?: "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi" | "dimanche";
          matin_debut?: string | null;
          matin_fin?: string | null;
          aprem_debut?: string | null;
          aprem_fin?: string | null;
          type_absence?: "conge" | "ferie" | "maladie" | "rtt" | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jours_feries: {
        Row: {
          id: string;
          date: string;
          nom: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          nom: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          nom?: string;
          created_at?: string;
        };
      };
      sites_internet: {
        Row: {
          id: string;
          nom: string;
          url: string | null;
          identifiant: string | null;
          mot_de_passe: string | null;
          notes: string | null;
          categorie: string | null;
          ordre: number;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          url?: string | null;
          identifiant?: string | null;
          mot_de_passe?: string | null;
          notes?: string | null;
          categorie?: string | null;
          ordre?: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          url?: string | null;
          identifiant?: string | null;
          mot_de_passe?: string | null;
          notes?: string | null;
          categorie?: string | null;
          ordre?: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      process: {
        Row: {
          id: string;
          titre: string;
          description: string | null;
          type: "texte" | "pdf";
          contenu: string | null;
          fichier_url: string | null;
          fichier_nom: string | null;
          categorie: string | null;
          ordre: number;
          deleted_at: string | null;
          deleted_by: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          titre: string;
          description?: string | null;
          type?: "texte" | "pdf";
          contenu?: string | null;
          fichier_url?: string | null;
          fichier_nom?: string | null;
          categorie?: string | null;
          ordre?: number;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          titre?: string;
          description?: string | null;
          type?: "texte" | "pdf";
          contenu?: string | null;
          fichier_url?: string | null;
          fichier_nom?: string | null;
          categorie?: string | null;
          ordre?: number;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      reunions_sujets: {
        Row: {
          id: string;
          titre: string;
          description: string | null;
          priorite: "basse" | "normale" | "haute" | "urgente";
          created_by: string | null;
          is_traite: boolean;
          date_traite: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titre: string;
          description?: string | null;
          priorite?: "basse" | "normale" | "haute" | "urgente";
          created_by?: string | null;
          is_traite?: boolean;
          date_traite?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          titre?: string;
          description?: string | null;
          priorite?: "basse" | "normale" | "haute" | "urgente";
          created_by?: string | null;
          is_traite?: boolean;
          date_traite?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      feedbacks: {
        Row: {
          id: string;
          titre: string;
          description: string;
          type: "bug" | "amelioration" | "nouvelle_fonctionnalite";
          priorite: "basse" | "normale" | "haute" | "urgente";
          statut: "en_attente" | "accepte" | "refuse" | "en_cours" | "termine";
          screenshot_url: string | null;
          created_by: string | null;
          admin_comment: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titre: string;
          description: string;
          type?: "bug" | "amelioration" | "nouvelle_fonctionnalite";
          priorite?: "basse" | "normale" | "haute" | "urgente";
          statut?: "en_attente" | "accepte" | "refuse" | "en_cours" | "termine";
          screenshot_url?: string | null;
          created_by?: string | null;
          admin_comment?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          titre?: string;
          description?: string;
          type?: "bug" | "amelioration" | "nouvelle_fonctionnalite";
          priorite?: "basse" | "normale" | "haute" | "urgente";
          statut?: "en_attente" | "accepte" | "refuse" | "en_cours" | "termine";
          screenshot_url?: string | null;
          created_by?: string | null;
          admin_comment?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          nom: string;
          prenom: string | null;
          type: "interne" | "externe";
          fonction: string | null;
          entreprise: string | null;
          telephone: string | null;
          email: string | null;
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          prenom?: string | null;
          type?: "interne" | "externe";
          fonction?: string | null;
          entreprise?: string | null;
          telephone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          prenom?: string | null;
          type?: "interne" | "externe";
          fonction?: string | null;
          entreprise?: string | null;
          telephone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      franchise_procedures: {
        Row: {
          id: string;
          franchise_id: string;
          commercial: string | null;
          graphiste_referent: string | null; // UUID référençant profiles.id
          franchiseur_contacts: string | null;
          mail_franchiseur: boolean;
          mail_franchise: boolean;
          bat_avant_vt: boolean;
          signaletique_provisoire: boolean;
          signaletique_provisoire_details: string | null;
          etapes_cles: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          franchise_id: string;
          commercial?: string | null;
          graphiste_referent?: string | null; // UUID référençant profiles.id
          franchiseur_contacts?: string | null;
          mail_franchiseur?: boolean;
          mail_franchise?: boolean;
          bat_avant_vt?: boolean;
          signaletique_provisoire?: boolean;
          signaletique_provisoire_details?: string | null;
          etapes_cles?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          franchise_id?: string;
          commercial?: string | null;
          graphiste_referent?: string | null; // UUID référençant profiles.id
          franchiseur_contacts?: string | null;
          mail_franchiseur?: boolean;
          mail_franchise?: boolean;
          bat_avant_vt?: boolean;
          signaletique_provisoire?: boolean;
          signaletique_provisoire_details?: string | null;
          etapes_cles?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Types utilitaires
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Dossier = Database["public"]["Tables"]["dossiers"]["Row"];
export type DossierBat = Database["public"]["Tables"]["dossier_bats"]["Row"];
export type Franchise = Database["public"]["Tables"]["franchises"]["Row"];
export type FranchiseAssignment = Database["public"]["Tables"]["franchise_assignments"]["Row"];
export type ProjetInterne = Database["public"]["Tables"]["projets_internes"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];
export type AppSetting = Database["public"]["Tables"]["app_settings"]["Row"];

// Types avec relations
export type DossierWithGraphiste = Dossier & {
  graphiste: Profile;
};

export type FranchiseWithGraphistes = Franchise & {
  graphistes: Profile[];
};

// Types pour les heures supplémentaires
export type FeuilleTempsTables = Database["public"]["Tables"]["feuilles_temps"];
export type FeuilleTemps = FeuilleTempsTables["Row"];
export type FeuilleTempsInsert = FeuilleTempsTables["Insert"];
export type FeuilleTempsUpdate = FeuilleTempsTables["Update"];

export type HeuresJournalieresTables = Database["public"]["Tables"]["heures_journalieres"];
export type HeuresJournalieres = HeuresJournalieresTables["Row"];
export type HeuresJournalieresInsert = HeuresJournalieresTables["Insert"];
export type HeuresJournalieresUpdate = HeuresJournalieresTables["Update"];

export type JourSemaine = HeuresJournalieres["jour_semaine"];

export type FeuilleTempsWithHeures = FeuilleTemps & {
  heures: HeuresJournalieres[];
  user?: Profile;
};

// Types pour les jours fériés
export type JourFerieTables = Database["public"]["Tables"]["jours_feries"];
export type JourFerie = JourFerieTables["Row"];

// Type pour les absences
export type TypeAbsence = HeuresJournalieres["type_absence"];

// Types pour les sites internet
export type SiteInternetTables = Database["public"]["Tables"]["sites_internet"];
export type SiteInternet = SiteInternetTables["Row"];
export type SiteInternetInsert = SiteInternetTables["Insert"];
export type SiteInternetUpdate = SiteInternetTables["Update"];

// Types pour les process
export type ProcessTables = Database["public"]["Tables"]["process"];
export type Process = ProcessTables["Row"];
export type ProcessInsert = ProcessTables["Insert"];
export type ProcessUpdate = ProcessTables["Update"];
export type ProcessType = Process["type"];

// Types pour les réunions
export type ReunionSujetTables = Database["public"]["Tables"]["reunions_sujets"];
export type ReunionSujet = ReunionSujetTables["Row"];
export type ReunionSujetInsert = ReunionSujetTables["Insert"];
export type ReunionSujetUpdate = ReunionSujetTables["Update"];
export type ReunionPriorite = ReunionSujet["priorite"];

export type ReunionSujetWithAuthor = ReunionSujet & {
  author?: Profile;
};

// Types pour les feedbacks
export type FeedbackTables = Database["public"]["Tables"]["feedbacks"];
export type Feedback = FeedbackTables["Row"];
export type FeedbackInsert = FeedbackTables["Insert"];
export type FeedbackUpdate = FeedbackTables["Update"];
export type FeedbackType = Feedback["type"];
export type FeedbackPriorite = Feedback["priorite"];
export type FeedbackStatut = Feedback["statut"];

export type FeedbackWithAuthor = Feedback & {
  author?: Profile;
};

// Types pour les contacts (annuaire)
export type ContactTables = Database["public"]["Tables"]["contacts"];
export type Contact = ContactTables["Row"];
export type ContactInsert = ContactTables["Insert"];
export type ContactUpdate = ContactTables["Update"];
export type ContactType = Contact["type"];

// Types pour les procédures franchises
export type FranchiseProcedureTables = Database["public"]["Tables"]["franchise_procedures"];
export type FranchiseProcedure = FranchiseProcedureTables["Row"];
export type FranchiseProcedureInsert = FranchiseProcedureTables["Insert"];
export type FranchiseProcedureUpdate = FranchiseProcedureTables["Update"];

export type FranchiseWithProcedure = Franchise & {
  procedure?: FranchiseProcedure | null;
};
