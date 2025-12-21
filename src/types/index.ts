export * from "./database";

// Types pour les formulaires
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface DossierFormData {
  nom: string;
  deadline_premiere_reponse: string | null;
  statut: string;
  commentaires: string | null;
  graphiste_id?: string;
}

export interface UserFormData {
  email: string;
  full_name: string;
  initials: string;
  role: "admin" | "graphiste";
}

export interface FranchiseFormData {
  nom: string;
  graphiste_ids: string[];
}

export interface ProjetInterneFormData {
  commercial: string | null;
  tache: string;
  demande: string | null;
  graphiste_id: string | null;
}

// Types pour les filtres
export interface DossierFilters {
  search: string;
  statut: string | null;
  graphiste_id: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

// Types pour les statistiques
export interface DossierStats {
  total: number;
  parStatut: Record<string, number>;
  parGraphiste: Record<string, number>;
  urgents: number;
  enRetard: number;
}

// Type pour le contexte utilisateur
export interface AuthUser {
  id: string;
  email: string;
  profile: {
    id: string;
    full_name: string;
    initials: string;
    role: "admin" | "graphiste";
    is_active: boolean;
  };
}
