import { BADGE_COLORS, DEFAULT_BADGE_COLOR, type BadgeColorId } from "@/types/database";

/**
 * Retourne les classes CSS pour un badge de graphiste
 * @param colorId - L'ID de la couleur du badge (ou null pour la couleur par défaut)
 * @returns Un objet avec les classes bg et text
 */
export function getBadgeClasses(colorId: BadgeColorId | null | undefined): { bg: string; text: string } {
  const color = BADGE_COLORS.find((c) => c.id === (colorId ?? DEFAULT_BADGE_COLOR));
  return color ?? BADGE_COLORS[0]; // Fallback to blue
}

/**
 * Retourne la classe CSS complète pour un badge de graphiste
 * @param colorId - L'ID de la couleur du badge
 * @returns La classe CSS combinée (bg + text)
 */
export function getBadgeClassName(colorId: BadgeColorId | null | undefined): string {
  const { bg, text } = getBadgeClasses(colorId);
  return `${bg} ${text}`;
}
