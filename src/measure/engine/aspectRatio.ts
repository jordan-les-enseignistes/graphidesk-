// ============================================================
// Estimation du ratio largeur/hauteur réel d'un rectangle à
// partir de sa projection perspective (4 coins image)
// ============================================================
// Méthode de Zhang & He ("Whiteboard Scanning", Microsoft Research) :
// en supposant une caméra sténopé standard (pixels carrés, point
// principal au centre de l'image), les 4 coins projetés déterminent
// la focale ET le ratio du rectangle réel.
//
// Hypothèses (à rappeler à l'utilisateur) :
//   - photo non recadrée de façon asymétrique
//   - objectif standard (pas de fisheye)
// Précision typique : ±2-5 % → réservé aux cotes PROVISOIRES.

import type { Pt } from "../state/types";

type V3 = [number, number, number];

function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Ratio largeur/hauteur du rectangle réel.
 * @param corners 4 coins image dans l'ordre HG → HD → BD → BG
 * @param imageW largeur de la photo (px)
 * @param imageH hauteur de la photo (px)
 * @returns ratio W/H, ou null si l'estimation est impossible/dégénérée
 */
export function estimateAspectRatio(
  corners: [Pt, Pt, Pt, Pt],
  imageW: number,
  imageH: number
): number | null {
  const u0 = imageW / 2;
  const v0 = imageH / 2;

  // ordre Zhang : m1=HG, m2=HD, m3=BG, m4=BD — coordonnées centrées
  const toV3 = (p: Pt): V3 => [p.x - u0, p.y - v0, 1];
  const m1 = toV3(corners[0]);
  const m2 = toV3(corners[1]);
  const m3 = toV3(corners[3]);
  const m4 = toV3(corners[2]);

  const c14 = cross(m1, m4);
  const d2 = dot(cross(m2, m4), m3);
  const d3 = dot(cross(m3, m4), m2);
  if (Math.abs(d2) < 1e-9 || Math.abs(d3) < 1e-9) return null;

  const k2 = dot(c14, m3) / d2;
  const k3 = dot(c14, m2) / d3;

  const n2: V3 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
  const n3: V3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];

  let ratio: number;

  const nz = n2[2] * n3[2];
  if (Math.abs(n2[2]) < 1e-6 && Math.abs(n3[2]) < 1e-6) {
    // quadrilatère ≈ parallélogramme (photo quasi frontale) :
    // le ratio se lit directement dans l'image
    const w = Math.hypot(m2[0] - m1[0], m2[1] - m1[1]);
    const h = Math.hypot(m3[0] - m1[0], m3[1] - m1[1]);
    if (h < 1e-9) return null;
    ratio = w / h;
  } else {
    // focale au carré
    const f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / nz;
    if (!isFinite(f2) || f2 <= 0) {
      // perspective trop faible / incohérente → repli parallélogramme
      const w = Math.hypot(m2[0] - m1[0], m2[1] - m1[1]);
      const h = Math.hypot(m3[0] - m1[0], m3[1] - m1[1]);
      if (h < 1e-9) return null;
      ratio = w / h;
    } else {
      const num = (n2[0] * n2[0] + n2[1] * n2[1]) / f2 + n2[2] * n2[2];
      const den = (n3[0] * n3[0] + n3[1] * n3[1]) / f2 + n3[2] * n3[2];
      if (den < 1e-12) return null;
      ratio = Math.sqrt(num / den);
    }
  }

  // garde-fous : un ratio absurde signale une estimation dégénérée
  if (!isFinite(ratio) || ratio < 0.02 || ratio > 50) return null;
  return ratio;
}
