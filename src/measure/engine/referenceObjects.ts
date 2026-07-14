// Catalogue d'objets standard à dimensions connues (en mm).
// ⚠️ Ce sont des valeurs NORMALISÉES / TYPIQUES : les objets réels
// varient. À utiliser pour des dimensions PROVISOIRES uniquement —
// toujours confirmer en visite technique.

export interface ReferenceObject {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  note?: string;
}

export const REFERENCE_OBJECTS: ReferenceObject[] = [
  {
    id: "porte-standard",
    label: "Porte standard (avec cadre)",
    widthMm: 900,
    heightMm: 2150,
    note: "Le standard le plus courant — les portes réelles varient de ±50mm",
  },
  {
    id: "porte-83",
    label: "Porte 83 (avec cadre)",
    widthMm: 830,
    heightMm: 2040,
  },
  {
    id: "format-a4",
    label: "Feuille A4 (collée sur vitrine)",
    widthMm: 210,
    heightMm: 297,
    note: "Précis mais petit : à réserver aux zones proches de la feuille",
  },
  // ⚠️ Ne PAS ajouter d'objets qui ne sont pas DANS le plan de la façade
  // (véhicules, mobilier urbain, plaques d'immatriculation...) : la
  // calibration ne vaut que pour son plan.
];
