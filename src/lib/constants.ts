// Statuts disponibles pour les dossiers
// rowBg = couleur de fond de la ligne dans le tableau
// barColor = couleur vive pour les barres de progression
export const STATUTS = [
  { value: "! Urgent !", label: "! Urgent !", color: "bg-red-100 text-red-800 border-red-200", rowBg: "bg-red-50", barColor: "bg-red-500", icon: "AlertCircle" },
  { value: "A faire", label: "A faire", color: "bg-blue-100 text-blue-800 border-blue-200", rowBg: "bg-blue-50", barColor: "bg-blue-500", icon: "Circle" },
  { value: "En cours", label: "En cours", color: "bg-yellow-100 text-yellow-800 border-yellow-200", rowBg: "bg-yellow-50", barColor: "bg-yellow-500", icon: "Clock" },
  { value: "Attente R.", label: "Attente R.", color: "bg-purple-100 text-purple-800 border-purple-200", rowBg: "bg-purple-50", barColor: "bg-purple-500", icon: "Pause" },
  { value: "À relancer", label: "À relancer", color: "bg-orange-100 text-orange-800 border-orange-200", rowBg: "bg-orange-50", barColor: "bg-orange-500", icon: "AlertTriangle" },
  { value: "Mairie", label: "Mairie", color: "bg-pink-100 text-pink-800 border-pink-200", rowBg: "bg-pink-50", barColor: "bg-pink-500", icon: "Building" },
  { value: "Stand-by", label: "Stand-by", color: "bg-gray-100 text-gray-800 border-gray-200", rowBg: "", barColor: "bg-gray-400", icon: "PauseCircle" },
] as const;

export type Statut = (typeof STATUTS)[number]["value"];

export const STATUT_MAP = Object.fromEntries(
  STATUTS.map((s) => [s.value, s])
) as Record<Statut, (typeof STATUTS)[number]>;

// Priorité des statuts pour le tri (plus bas = plus prioritaire = en haut)
// L'ordre correspond à l'ordre dans STATUTS ci-dessus
export const STATUT_PRIORITY: Record<string, number> = {
  "! Urgent !": 0,
  "A faire": 1,
  "En cours": 2,
  "Attente R.": 3,
  "À relancer": 4,
  "Mairie": 5,
  "Stand-by": 6,
};

// Mapping des couleurs de fond par statut pour accès rapide
export const STATUT_ROW_BG: Record<string, string> = Object.fromEntries(
  STATUTS.map((s) => [s.value, s.rowBg])
);

// Rôles utilisateurs
export const ROLES = {
  ADMIN: "admin",
  GRAPHISTE: "graphiste",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Configuration de l'application
// Note: La version est gérée dans useAppUpdate.ts et tauri.conf.json
export const APP_CONFIG = {
  name: "GraphiDesk",
  company: "Les Enseignistes",
} as const;

// Routes de l'application
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/",
  RECHERCHE: "/recherche",
  // Gestion de projet
  MES_DOSSIERS: "/mes-dossiers",
  TOUS_LES_DOSSIERS: "/tous-les-dossiers",
  ARCHIVES: "/archives",
  FRANCHISES: "/franchises",
  PROJETS_INTERNES: "/projets-internes",
  STATISTIQUES: "/statistiques",
  // Mes outils
  FABRIK: "/fabrik",
  HEURES_SUPPLEMENTAIRES: "/heures-supplementaires",
  PLANNING_VACANCES: "/planning-vacances",
  SITES_INTERNET: "/sites-internet",
  PROCESS: "/process",
  REUNIONS: "/reunions",
  RAL_CONVERTER: "/ral-converter",
  CALCULATRICE: "/calculatrice",
  FEEDBACKS: "/feedbacks",
  MON_PROFIL: "/mon-profil",
  ANNUAIRE: "/annuaire",
  // Administration
  UTILISATEURS: "/utilisateurs",
  PARAMETRES: "/parametres",
} as const;

// Mapping des initiales aux noms complets (pour l'import)
export const INITIALS_TO_NAME: Record<string, string> = {
  J: "Jordan",
  C: "Carole",
  JU: "Juliette",
  Q: "Quentin",
};
