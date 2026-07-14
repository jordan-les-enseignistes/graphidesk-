/**
 * Catalogue centralisé des permissions disponibles dans GraphiDesk.
 *
 * Chaque permission a :
 * - une `key` (clé technique, ce qui est stocké en base dans role_permissions.permission_key)
 * - un `label` (libellé court affiché dans l'UI de gestion des rôles)
 * - une `description` (explication plus détaillée)
 * - une `category` (regroupement dans l'UI de gestion)
 *
 * Pour ajouter une nouvelle permission :
 * 1. Ajouter une entrée ici
 * 2. Ajouter la clé dans la migration RBAC (seed admin)
 * 3. L'utiliser dans le code via useHasPermission('ma:nouvelle:permission')
 */

export type PermissionCategory = "access" | "manage";

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: PermissionCategory;
}

export const PERMISSION_CATEGORIES: Record<PermissionCategory, { label: string; description: string }> = {
  access: {
    label: "Accès aux modules",
    description: "Contrôle quels onglets sont visibles dans le menu de navigation.",
  },
  manage: {
    label: "Actions privilégiées",
    description: "Contrôle l'accès aux actions sensibles (création, modification, suppression).",
  },
};

export const PERMISSIONS: PermissionDefinition[] = [
  // ============================================
  // Catégorie 1 : Accès aux modules
  // ============================================
  {
    key: "access:dashboard",
    label: "Tableau de bord",
    description: "Affiche l'onglet \"Tableau de bord\" qui résume l'activité de l'utilisateur.",
    category: "access",
  },
  {
    key: "access:mes_dossiers",
    label: "Mes Dossiers",
    description: "Affiche l'onglet \"Mes Dossiers\" qui liste les dossiers du graphiste.",
    category: "access",
  },
  {
    key: "access:archives",
    label: "Archives",
    description: "Affiche l'onglet \"Archives\".",
    category: "access",
  },
  {
    key: "access:dossiers_all",
    label: "Voir tous les dossiers",
    description: "Affiche l'onglet \"Tous les Dossiers\" qui liste les dossiers de tous les graphistes.",
    category: "access",
  },
  {
    key: "access:franchises",
    label: "Module Franchises",
    description: "Accès à la page Franchises (lecture seule).",
    category: "access",
  },
  {
    key: "access:projets_internes",
    label: "Module Projets Internes",
    description: "Accès à la page Projets Internes.",
    category: "access",
  },
  {
    key: "access:statistiques",
    label: "Module Statistiques",
    description: "Accès à la page Statistiques.",
    category: "access",
  },
  {
    key: "access:process",
    label: "Module Process",
    description: "Accès à la bibliothèque de Process.",
    category: "access",
  },
  {
    key: "access:reunions",
    label: "Module Réunions",
    description: "Accès au module des sujets de réunions.",
    category: "access",
  },
  {
    key: "access:sites_internet",
    label: "Module Sites Internet",
    description: "Accès au coffre-fort des sites internet.",
    category: "access",
  },
  {
    key: "access:fabrik",
    label: "Module FabRik",
    description: "Accès aux outils de calcul FabRik.",
    category: "access",
  },
  {
    key: "access:calculatrice",
    label: "Module Calculatrice",
    description: "Accès à la Calculatrice.",
    category: "access",
  },
  {
    key: "access:mesure",
    label: "Module Mesure photo",
    description: "Accès à l'outil de mesure provisoire par photo (vitrines, façades).",
    category: "access",
  },
  {
    key: "access:maquette_vt",
    label: "Module Maquette suite VT",
    description:
      "Accès aux projets de mesure sauvegardés : saisie des cotes réelles après visite technique et génération de la maquette définitive.",
    category: "access",
  },
  {
    key: "access:nuancier",
    label: "Module Nuancier",
    description: "Accès au convertisseur RAL.",
    category: "access",
  },
  {
    key: "access:feedbacks",
    label: "Module Feedbacks",
    description: "Accès au module Feedbacks (signaler bug / suggérer une amélioration).",
    category: "access",
  },
  {
    key: "access:utilisateurs",
    label: "Module Utilisateurs",
    description: "Accès à la gestion des utilisateurs (admin).",
    category: "access",
  },
  {
    key: "access:parametres",
    label: "Module Paramètres",
    description: "Accès aux paramètres de l'application.",
    category: "access",
  },

  // ============================================
  // Catégorie 2 : Actions privilégiées
  // ============================================
  {
    key: "manage:franchises_assignations",
    label: "Gérer les assignations de franchises",
    description: "Accès à l'onglet \"Attribution\" dans Franchises et possibilité d'assigner des graphistes aux franchises.",
    category: "manage",
  },
  {
    key: "manage:projets_internes_delete",
    label: "Supprimer un projet interne",
    description: "Affiche le bouton de suppression sur les projets internes.",
    category: "manage",
  },
  {
    key: "manage:archives_delete",
    label: "Supprimer définitivement une archive",
    description: "Affiche le bouton de suppression définitive sur les archives.",
    category: "manage",
  },
  {
    key: "manage:process",
    label: "Gérer les process",
    description: "Créer, modifier et supprimer des process.",
    category: "manage",
  },
  {
    key: "manage:reunions",
    label: "Gérer les réunions",
    description: "Éditer et supprimer des sujets de réunion.",
    category: "manage",
  },
  {
    key: "manage:feedbacks_respond",
    label: "Répondre aux feedbacks",
    description: "Accès aux actions admin sur les feedbacks (statut, commentaires).",
    category: "manage",
  },
  {
    key: "manage:dossiers_all",
    label: "Gérer tous les dossiers",
    description: "Modifier et supprimer les dossiers d'autres graphistes.",
    category: "manage",
  },
  {
    key: "manage:stats_per_graphiste",
    label: "Voir les stats par graphiste",
    description: "Accès au détail des statistiques individuelles par graphiste.",
    category: "manage",
  },
  {
    key: "manage:users",
    label: "Gérer les utilisateurs",
    description: "Créer, inviter, désactiver et changer le rôle des utilisateurs.",
    category: "manage",
  },
  {
    key: "manage:settings",
    label: "Modifier les paramètres",
    description: "Modifier les paramètres globaux de l'application.",
    category: "manage",
  },
  {
    key: "manage:roles",
    label: "Gérer les rôles",
    description: "Créer, modifier et supprimer les rôles personnalisés (méta-permission).",
    category: "manage",
  },
];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export function getPermissionDefinition(key: string): PermissionDefinition | undefined {
  return PERMISSIONS.find((p) => p.key === key);
}

export function getPermissionsByCategory(category: PermissionCategory): PermissionDefinition[] {
  return PERMISSIONS.filter((p) => p.category === category);
}
