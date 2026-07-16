// Mesure d'un quadrilatère (px image) via l'homographie du plan
import { applyHomography } from "./homography";
import type { Pt, H } from "../state/types";

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Applique H aux 4 sommets et retourne les dimensions réelles en mm.
 * ⚠️ INDÉPENDANT de l'ordre de clic : les coins sont réordonnés
 * canoniquement (HG → HD → BD → BG) dans l'espace RECTIFIÉ (mm), où
 * "haut" et "gauche" ont un vrai sens métrique. La largeur est donc
 * toujours l'horizontale du plan, la hauteur toujours la verticale,
 * quel que soit l'ordre dans lequel l'utilisateur a cliqué.
 * Retourne aussi les coins px réordonnés (pour un polygone propre).
 */
export function measureQuad(
  h: H,
  corners: [Pt, Pt, Pt, Pt]
): { widthMm: number; heightMm: number; orderedCorners: [Pt, Pt, Pt, Pt] } {
  // paires (px, mm) pour réordonner les deux ensembles ensemble
  const pairs = corners.map((c) => ({
    px: c,
    mm: applyHomography(h, c.x, c.y),
  }));

  // tri canonique dans l'espace rectifié : 2 plus hauts (petit y) puis 2 plus bas
  const byY = [...pairs].sort((a, b) => a.mm.y - b.mm.y);
  const top = byY.slice(0, 2).sort((a, b) => a.mm.x - b.mm.x); // HG, HD
  const bottom = byY.slice(2, 4).sort((a, b) => a.mm.x - b.mm.x); // BG, BD
  const ordered = [top[0], top[1], bottom[1], bottom[0]]; // HG, HD, BD, BG

  const m = ordered.map((p) => p.mm);
  const widthMm = (dist(m[0], m[1]) + dist(m[3], m[2])) / 2;
  const heightMm = (dist(m[1], m[2]) + dist(m[0], m[3])) / 2;

  return {
    widthMm,
    heightMm,
    orderedCorners: [ordered[0].px, ordered[1].px, ordered[2].px, ordered[3].px],
  };
}

/**
 * Réordonne les 4 coins d'un quadrilatère EN ESPACE IMAGE (y vers le bas)
 * en HG → HD → BD → BG, quel que soit l'ordre de clic.
 * Indispensable pour la RÉFÉRENCE de calibration : si les coins cliqués
 * sont mappés vers (0,0)(W,0)(W,H)(0,H) dans le mauvais ordre, tout le
 * plan rectifié est construit en miroir et les exports (prémaquette, PSD,
 * fiche VT) sortent inversés gauche/droite.
 */
export function orderQuadInImage(pts: [Pt, Pt, Pt, Pt]): [Pt, Pt, Pt, Pt] {
  const byY = [...pts].sort((a, b) => a.y - b.y);
  const top = byY.slice(0, 2).sort((a, b) => a.x - b.x); // HG, HD
  const bottom = byY.slice(2, 4).sort((a, b) => a.x - b.x); // BG, BD
  return [top[0], top[1], bottom[1], bottom[0]]; // HG, HD, BD, BG
}

/** Arrondi au 5mm le plus proche (affichage des cotes provisoires) */
export function roundTo5Mm(mm: number): number {
  return Math.round(mm / 5) * 5;
}

/** Formatage d'affichage d'une cote : "≈ 570 × 4430 mm" */
export function formatDims(widthMm: number, heightMm: number): string {
  return `≈ ${roundTo5Mm(widthMm)} × ${roundTo5Mm(heightMm)} mm`;
}

/** Lettre technique d'une zone ("A", "B"...) — extraite du label immuable */
export function zoneLettre(z: { label: string }): string {
  return z.label.replace(/^Zone\s+/i, "");
}

/** Nom d'AFFICHAGE d'une zone : nom saisi par le graphiste, sinon
 *  "Vitrine X" si marquée vitrage, sinon le label "Zone X".
 *  Purement cosmétique : l'identité technique reste z.label. */
export function zoneNom(z: { label: string; nom?: string; fill?: string }): string {
  if (z.nom && z.nom.trim()) return z.nom.trim();
  if (z.fill === "vitrage") return `Vitrine ${zoneLettre(z)}`;
  return z.label;
}

/** Échelle indicative au point donné : mm réels par pixel image */
export function mmPerPixelAt(h: H, x: number, y: number): number {
  const p0 = applyHomography(h, x, y);
  const px = applyHomography(h, x + 1, y);
  const py = applyHomography(h, x, y + 1);
  return (dist(p0, px) + dist(p0, py)) / 2;
}
