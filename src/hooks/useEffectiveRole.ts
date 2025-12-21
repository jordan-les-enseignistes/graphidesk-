import { useAuthStore } from "@/stores/authStore";
import { useViewAsStore } from "@/stores/viewAsStore";

/**
 * Hook qui retourne le rôle effectif de l'utilisateur.
 * En mode "Voir comme", l'admin est traité comme un graphiste (pas de droits admin).
 *
 * @returns {Object} - { isAdmin, effectiveProfile, isViewingAs }
 * - isAdmin: true si l'utilisateur a les droits admin (false en mode "Voir comme")
 * - effectiveProfile: le profil effectif (viewAsUser ou profile)
 * - isViewingAs: true si l'admin est en mode "Voir comme"
 * - realIsAdmin: true si l'utilisateur réel est admin (même en mode "Voir comme")
 */
export function useEffectiveRole() {
  const profile = useAuthStore((state) => state.profile);
  const { viewAsUser, isViewingAs } = useViewAsStore();

  // L'admin réel
  const realIsAdmin = profile?.role === "admin";

  // En mode "Voir comme", l'admin perd ses droits admin pour simuler l'expérience graphiste
  const isAdmin = realIsAdmin && !isViewingAs;

  // Le profil effectif (celui dont on simule la vue)
  const effectiveProfile = isViewingAs && viewAsUser ? viewAsUser : profile;

  return {
    isAdmin,
    effectiveProfile,
    isViewingAs,
    realIsAdmin,
  };
}
