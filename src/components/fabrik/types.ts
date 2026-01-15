// Types pour FabRik

export type FabType = "adhesif" | "caisson" | "lettres-boitiers" | "";
export type CaissonType = "simple" | "multi" | "double";
export type LightingType = "lumineux" | "non-lumineux";
export type PartType = "left" | "center" | "right";

export interface Thickness {
  haut: number;
  bas: number;
  gauche: number;
  droite: number;
  isMulti: boolean;
}

export interface PartData {
  type: PartType;
  largeur: number;
  hauteur: number;
  profondeur: number;
  isMultiThickness: boolean;
  thickness?: Thickness;
  drillingHoles: boolean;
}

export interface CaissonSimpleParams {
  largeur: number;
  hauteur: number;
  profondeur: number;
  thickness?: Thickness;
  drillingHoles: boolean;
}

export interface CaissonMultiParams {
  parts: PartData[];
  drillingHoles: boolean;
}

export interface CaissonDoubleParams {
  largeur: number;
  hauteur: number;
  epaisseur: number;
  drillingHoles: boolean;
  // Entraxe personnalisé pour les potences (null = automatique aux extrémités)
  entraxePotences: number | null;
}

export type TrancheFinition = "MAT" | "BRILLANT" | "";

export interface LettresBoitiersParams {
  destinationPath: string;
  dossierName: string;
  batNumber: string;
  // Options spécifiques aux tranches
  trancheEpaisseur?: string; // Ex: "100" pour 100MM
  trancheRal?: string; // Ex: "8019" pour RAL_8019
  trancheFinition?: TrancheFinition; // MAT ou BRILLANT (uniquement si RAL renseigné)
}

export interface FabrikSettings {
  illustratorPath: string;
}

// Constantes
export const DEFAULT_ILLUSTRATOR_PATH = "C:\\Program Files\\Adobe\\Adobe Illustrator 2026\\Support Files\\Contents\\Windows\\Illustrator.exe";
export const PLAQUE_MAX_WIDTH = 3050;
export const PLAQUE_MAX_HEIGHT = 1500;
export const DEFAULT_DEPTH_LUMINEUX = 70;
export const DEFAULT_DEPTH_NON_LUMINEUX = 45;
