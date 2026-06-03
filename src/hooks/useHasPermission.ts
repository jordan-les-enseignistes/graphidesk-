import { useAuthStore } from "@/stores/authStore";
import { useCurrentUserPermissions } from "@/hooks/useRoles";
import { useViewAsStore } from "@/stores/viewAsStore";

/**
 * Hook central pour vérifier si l'utilisateur courant a une permission donnée.
 *
 * Logique :
 * 1. Si l'utilisateur est en mode "Voir comme" → on simule l'absence de droits admin
 *    (le viewAsStore force isAdmin à false). On retourne ce que le rôle simulé permet.
 *    NOTE : pour le moment, en mode "Voir comme", on retourne false par défaut pour
 *    toutes les manage:*, sauf si le rôle effectif a réellement la permission.
 * 2. Sinon, on regarde si la permission est dans le set des permissions du rôle.
 * 3. Fallback rétrocompat : si le profile a `role === 'admin'` ET pas de role_id chargé
 *    (transition migration), on retourne true (l'admin garde tous ses droits).
 *
 * Utilisation :
 *   const canManageUsers = useHasPermission('manage:users');
 *   if (canManageUsers) { ... }
 */
export function useHasPermission(key: string): boolean {
  const profile = useAuthStore((state) => state.profile);
  const { isViewingAs } = useViewAsStore();
  const { data: permissions } = useCurrentUserPermissions();

  if (!profile) return false;

  // Mode "Voir comme" (admin simulant un graphiste lambda)
  if (isViewingAs) {
    if (key === "access:utilisateurs" || key === "access:parametres") return false;
    if (key.startsWith("manage:")) return false;
    return key.startsWith("access:");
  }

  // ★ Super-admin : si role legacy = 'admin', toutes les permissions sont accordées.
  // Le système granulaire ne s'applique qu'aux rôles non-admin.
  if (profile.role === "admin") return true;

  // Système granulaire : check dans le Set des permissions du rôle
  if (permissions) {
    return permissions.has(key);
  }

  return false;
}

/**
 * Variante pratique : vérifie si l'user a AU MOINS UNE des permissions données.
 * Utile pour afficher un bouton si "manage:foo OU manage:bar".
 */
export function useHasAnyPermission(keys: string[]): boolean {
  const profile = useAuthStore((state) => state.profile);
  const { isViewingAs } = useViewAsStore();
  const { data: permissions } = useCurrentUserPermissions();

  if (!profile) return false;

  if (isViewingAs) {
    return keys.some((key) => {
      if (key === "access:utilisateurs" || key === "access:parametres") return false;
      if (key.startsWith("manage:")) return false;
      return key.startsWith("access:");
    });
  }

  // Super-admin
  if (profile.role === "admin") return true;

  if (permissions) {
    return keys.some((key) => permissions.has(key));
  }

  return false;
}
