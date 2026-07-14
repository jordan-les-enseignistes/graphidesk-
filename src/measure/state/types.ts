// ============================================================
// Mesure photo — types du module
// ============================================================
// Règle centrale : TOUTES les entités du document (points de
// référence, sommets de zones) sont stockées en COORDONNÉES IMAGE
// (pixels de l'image d'origine). La vue applique un transform
// séparé { scale, x, y } qui n'entre JAMAIS dans l'historique undo.
//
// Toutes les dimensions réelles sont en MILLIMÈTRES (convention
// GraphiDesk / FabRik).
// ============================================================

/** Point en pixels image (jamais en pixels écran) */
export interface Pt {
  x: number;
  y: number;
}

/** Homographie 3x3 aplatie, h[8] = 1 (image px → mm du plan) */
export type H = number[];

/** Référence de calibration : rectangle réel connu du plan */
export interface Reference {
  imgPts: [Pt, Pt, Pt, Pt]; // HG → HD → BD → BG, en px image
  widthMm: number;
  heightMm: number;
}

/** Un plan physique (façade RDC, étage en retrait...) = une calibration */
export interface Plane {
  id: string;
  name: string;
  reference: Reference | null;
  H: H | null;
}

/** Zone mesurée */
export interface Zone {
  id: string;
  label: string; // "Zone A", "Zone B"...
  planeId: string;
  method: "manual" | "wand";
  corners: [Pt, Pt, Pt, Pt]; // en px image
  widthMm: number;
  heightMm: number;
  /** Remplissage à l'export : vitrage (texture) ou blanc (cadre noir) */
  fill?: "blanc" | "vitrage";
  /** Export VT : false = cote restée provisoire (non mesurée par le poseur) */
  vtConfirmed?: boolean;
}

/** Document de mesure (état UNDOABLE, persisté en localStorage) */
export interface MeasureDoc {
  planes: Plane[];
  activePlaneId: string;
  zones: Zone[];
  /** Nom du fichier photo associé (pour restaurer la session en rechargeant la même photo) */
  imageName: string | null;
  /** Points de référence en cours de placement (0 à 4), en px image */
  draftRefPts: Pt[];
  /** Sommets de zone manuelle en cours de placement (0 à 4), en px image */
  draftZonePts: Pt[];
  /** Compteur pour les labels "Zone A", "Zone B"... (jamais décrémenté) */
  zoneCounter: number;
}

/** Transform de vue (état NON undoable) */
export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

/** Métadonnées de l'image chargée (état NON undoable) */
export interface LoadedImage {
  url: string;
  name: string;
  width: number; // px pleine résolution
  height: number;
}

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 20;
