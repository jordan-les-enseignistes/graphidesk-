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

/** Une photo du projet (une façade, un intérieur...) — le blob est en
 *  IndexedDB (clé = id), seules les métadonnées vivent dans le document */
export interface PhotoMeta {
  id: string;
  name: string; // nom du fichier d'origine
  width: number; // px pleine résolution
  height: number;
}

/** Une FACE = un plan physique calibré (façade rue, mur d'angle, intérieur...)
 *  rattaché à une photo. Une photo peut porter plusieurs faces (bâtiment
 *  d'angle photographié en une seule prise : deux faces, deux calibrations). */
export interface Plane {
  id: string;
  name: string;
  /** Photo porteuse de la face (multi-faces v1.5) */
  photoId: string;
  reference: Reference | null;
  H: H | null;
}

/** Zone mesurée */
export interface Zone {
  id: string;
  /** Identifiant TECHNIQUE immuable ("Zone A", "Zone B"...) : pilote les noms
   *  GD_ZONE_* du recalage Illustrator, les croix lettrées du plugin InDesign
   *  et la reprise de session — ne JAMAIS le modifier après création */
  label: string;
  /** Nom d'affichage libre saisi par le graphiste ("Enseigne", "Bandeau"...) —
   *  purement cosmétique, la lettre reste l'identité */
  nom?: string;
  planeId: string;
  method: "manual" | "wand";
  corners: [Pt, Pt, Pt, Pt]; // en px image
  widthMm: number;
  heightMm: number;
  /** Remplissage à l'export : vitrage (texture) ou blanc (cadre noir) */
  fill?: "blanc" | "vitrage";
  /** Export VT : false = cote restée provisoire (non mesurée par le poseur) */
  vtConfirmed?: boolean;
  /** true = dimensions RÉELLES saisies à la main (remplacent l'estimation photo) */
  manuel?: boolean;
  /** Estimation photo d'ORIGINE (figée à la 1re édition/correction : sert au
   *  retour arrière et au recalage des autres zones, sans dérive cumulative) */
  autoWidthMm?: number;
  autoHeightMm?: number;
}

/** Document de mesure (état UNDOABLE, persisté en localStorage) */
export interface MeasureDoc {
  /** Photos du projet, dans l'ordre (v1.5 multi-faces) */
  photos: PhotoMeta[];
  /** Faces (plans calibrés), dans l'ordre des pages de la future fiche VT */
  planes: Plane[];
  activePlaneId: string;
  zones: Zone[];
  /** Hérité v1 (session mono-photo) — conservé pour la migration */
  imageName: string | null;
  /** Points de référence en cours de placement (0 à 4), en px image */
  draftRefPts: Pt[];
  /** Sommets de zone manuelle en cours de placement (0 à 4), en px image */
  draftZonePts: Pt[];
  /** Compteur pour les labels "Zone A", "Zone B"... (jamais décrémenté,
   *  CONTINU sur tout le projet, toutes faces confondues) */
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
