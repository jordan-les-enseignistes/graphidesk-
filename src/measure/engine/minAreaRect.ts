// ============================================================
// Rectangle englobant d'aire minimale d'un nuage de points
// (enveloppe convexe par chaîne monotone + rotating calipers)
// ============================================================

import type { Pt } from "../state/types";

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Enveloppe convexe (chaîne monotone d'Andrew), O(n log n) */
export function convexHull(points: Pt[]): Pt[] {
  if (points.length <= 3) return [...points];
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Rectangle d'aire minimale contenant tous les points.
 * Parcourt chaque arête de l'enveloppe (le rectangle optimal est
 * aligné sur l'une d'elles) et garde la plus petite aire.
 * Retourne les 4 coins ordonnés HG → HD → BD → BG (approximation
 * par tri haut/bas puis gauche/droite).
 */
export function minAreaRect(points: Pt[]): [Pt, Pt, Pt, Pt] | null {
  const hull = convexHull(points);
  if (hull.length < 3) return null;

  let best: { area: number; corners: Pt[] } | null = null;

  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    const ux = ex / len;
    const uy = ey / len;
    // axe perpendiculaire
    const vx = -uy;
    const vy = ux;

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * ux + p.y * uy;
      const v = p.x * vx + p.y * vy;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      const corner = (u: number, v: number): Pt => ({
        x: u * ux + v * vx,
        y: u * uy + v * vy,
      });
      best = {
        area,
        corners: [
          corner(minU, minV),
          corner(maxU, minV),
          corner(maxU, maxV),
          corner(minU, maxV),
        ],
      };
    }
  }
  if (!best) return null;

  // Ordonner HG → HD → BD → BG (par y puis x)
  const sorted = [...best.corners].sort((p, q) => p.y - q.y);
  const top = sorted.slice(0, 2).sort((p, q) => p.x - q.x);
  const bottom = sorted.slice(2, 4).sort((p, q) => p.x - q.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}
