// ============================================================
// Homographie DLT à 4 points (image px → millimètres du plan)
// ============================================================
// Pour chaque correspondance image (xi, yi) → monde (Xi, Yi), deux
// lignes du système 8×8 (inconnues h = [h11..h32], h33 fixé à 1) :
//
//   [ xi, yi, 1,  0,  0, 0, -xi*Xi, -yi*Xi ] · h = Xi
//   [  0,  0, 0, xi, yi, 1, -xi*Yi, -yi*Yi ] · h = Yi
//
// Résolution par élimination de Gauss-Jordan avec pivot partiel.

import type { Pt, H } from "../state/types";

export function computeHomography(src: Pt[], dst: Pt[]): H {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("L'homographie requiert exactement 4 correspondances de points");
  }

  // Système augmenté 8×9
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const X = dst[i].x;
    const Y = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
  }

  // Gauss-Jordan avec pivot partiel
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) {
      throw new Error(
        "Points de référence dégénérés : les 4 points doivent former un vrai quadrilatère (pas alignés, pas confondus)"
      );
    }
    if (pivot !== col) {
      const tmp = A[col];
      A[col] = A[pivot];
      A[pivot] = tmp;
    }
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      if (f === 0) continue;
      for (let c = col; c < 9; c++) {
        A[r][c] -= f * A[col][c];
      }
    }
  }

  const h: number[] = [];
  for (let i = 0; i < 8; i++) {
    h.push(A[i][8] / A[i][i]);
  }
  h.push(1);
  return h;
}

export function applyHomography(h: H, x: number, y: number): Pt {
  const d = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / d,
    y: (h[3] * x + h[4] * y + h[5]) / d,
  };
}

/** Inverse de l'homographie (matrice adjuguée / déterminant).
 *  Permet le chemin retour : mm du plan → pixels photo. */
export function invertHomography(h: H): H {
  const [a, b, c, d, e, f, g, i, j] = h;
  const det =
    a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
  if (Math.abs(det) < 1e-12) {
    throw new Error("Homographie non inversible");
  }
  const inv: H = [
    (e * j - f * i) / det,
    (c * i - b * j) / det,
    (b * f - c * e) / det,
    (f * g - d * j) / det,
    (a * j - c * g) / det,
    (c * d - a * f) / det,
    (d * i - e * g) / det,
    (b * g - a * i) / det,
    (a * e - b * d) / det,
  ];
  return inv;
}

// ============================================================
// Auto-test (exécuté en dev au chargement du module Mesure)
// ============================================================
// Un quadrilatère perspectif connu doit ressortir aux dimensions
// saisies à < 0.5 % près (critère d'acceptation de la spec).

export function selfTestHomography(): { ok: boolean; maxErrorPct: number } {
  // rectangle réel type porte : 900 × 2150 mm
  const dst: Pt[] = [
    { x: 0, y: 0 },
    { x: 900, y: 0 },
    { x: 900, y: 2150 },
    { x: 0, y: 2150 },
  ];
  // projection perspective arbitraire (photo de biais simulée)
  const src: Pt[] = [
    { x: 132.4, y: 87.9 },
    { x: 521.7, y: 143.2 },
    { x: 498.1, y: 1012.6 },
    { x: 95.3, y: 918.8 },
  ];

  const hm = computeHomography(src, dst);

  // 1. les 4 coins doivent retomber exactement sur le rectangle
  let maxErrMm = 0;
  for (let i = 0; i < 4; i++) {
    const p = applyHomography(hm, src[i].x, src[i].y);
    const err = Math.hypot(p.x - dst[i].x, p.y - dst[i].y);
    if (err > maxErrMm) maxErrMm = err;
  }

  // 2. les dimensions mesurées via les coins transformés
  const m = src.map((p) => applyHomography(hm, p.x, p.y));
  const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
  const widthErr = Math.abs((dist(m[0], m[1]) + dist(m[3], m[2])) / 2 - 900) / 900;
  const heightErr = Math.abs((dist(m[1], m[2]) + dist(m[0], m[3])) / 2 - 2150) / 2150;

  const diag = Math.hypot(900, 2150);
  const maxErrorPct = Math.max((maxErrMm / diag) * 100, widthErr * 100, heightErr * 100);
  return { ok: maxErrorPct < 0.5, maxErrorPct };
}
