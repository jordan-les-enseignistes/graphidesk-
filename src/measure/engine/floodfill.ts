// ============================================================
// Baguette magique v2 : flood fill Lab avec garde-fous morphologiques
// ============================================================
// Pipeline "intelligent" pour les vitrages (reflets, ombres) :
//   1. Réduction de l'image (≤1400px) : moins de bruit, plus rapide
//   2. Graine = moyenne d'un patch 5×5 (robuste au bruit local)
//   3. Masque global "dans la tolérance" (distance Lab à la graine)
//   4. ÉROSION du masque (r=2) : détruit les ponts fins par lesquels
//      la sélection "fuit" (ombres sous les montants, reflets sombres)
//   5. Flood fill 4-connexe depuis la graine sur le masque érodé
//   6. DILATATION de la composante (r=2) : restaure la taille réelle
//   7. Rectangle d'aire minimale, coordonnées remontées en pleine résolution
//
// La lecture pixel se fait TOUJOURS sur l'ImageData pleine résolution
// du canvas offscreen (jamais sur la vue zoomée).

import { minAreaRect } from "./minAreaRect";
import type { Pt } from "../state/types";

export interface WandResult {
  corners: [Pt, Pt, Pt, Pt];
  pixelCount: number;
}

const MAX_DIM = 1400; // taille max de l'image de travail
const MORPH_R = 2; // rayon érosion/dilatation (en px réduits)

// ---------- sRGB → Lab (D65), avec table précalculée pour la vitesse ----------
const LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  LINEAR_LUT[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

const F_EPS = 216 / 24389;
const F_K = 24389 / 27;

function fLab(t: number): number {
  return t > F_EPS ? Math.cbrt(t) : (F_K * t + 16) / 116;
}

/** Écrit L,a,b dans out[0..2] à partir de r,g,b 0-255 */
function rgbToLab(r: number, g: number, b: number, out: number[]): void {
  const rl = LINEAR_LUT[r];
  const gl = LINEAR_LUT[g];
  const bl = LINEAR_LUT[b];
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);
  out[0] = 116 * fy - 16;
  out[1] = 500 * (fx - fy);
  out[2] = 200 * (fy - fz);
}

/** Réduction par moyenne de blocs s×s. Retourne {rgb: Uint8ClampedArray, w, h, s} */
function downscale(imageData: ImageData): {
  rgb: Uint8ClampedArray;
  w: number;
  h: number;
  s: number;
} {
  const { width: w0, height: h0, data } = imageData;
  const s = Math.max(1, Math.ceil(Math.max(w0, h0) / MAX_DIM));
  if (s === 1) {
    return { rgb: data, w: w0, h: h0, s: 1 };
  }
  const w = Math.floor(w0 / s);
  const h = Math.floor(h0 / s);
  const out = new Uint8ClampedArray(w * h * 4);
  const area = s * s;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < s; dy++) {
        const rowOff = ((y * s + dy) * w0 + x * s) * 4;
        for (let dx = 0; dx < s; dx++) {
          const o = rowOff + dx * 4;
          r += data[o];
          g += data[o + 1];
          b += data[o + 2];
        }
      }
      const oi = (y * w + x) * 4;
      out[oi] = r / area;
      out[oi + 1] = g / area;
      out[oi + 2] = b / area;
      out[oi + 3] = 255;
    }
  }
  return { rgb: out, w, h, s };
}

/** Érosion (min) ou dilatation (max) séparable d'un masque binaire, fenêtre (2r+1)² */
function morph(mask: Uint8Array, w: number, h: number, r: number, erode: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  // passe horizontale
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let k = x0; k <= x1; k++) {
        const m = mask[row + k];
        if (erode) {
          if (m === 0) { v = 0; break; }
        } else if (m === 1) { v = 1; break; }
      }
      tmp[row + x] = v;
    }
  }
  // passe verticale
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = erode ? 1 : 0;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let k = y0; k <= y1; k++) {
        const m = tmp[k * w + x];
        if (erode) {
          if (m === 0) { v = 0; break; }
        } else if (m === 1) { v = 1; break; }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/**
 * Baguette magique : sélection par couleur depuis la graine (seedX, seedY,
 * en px image pleine résolution), tolérance = distance Lab.
 */
export function magicWand(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number
): WandResult | null {
  // ----- 1. Image de travail réduite -----
  const { rgb, w, h, s } = downscale(imageData);
  const sx = Math.min(w - 1, Math.max(0, Math.round(seedX / s)));
  const sy = Math.min(h - 1, Math.max(0, Math.round(seedY / s)));

  // ----- 2. Graine = moyenne d'un patch 5×5 -----
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = sx + dx;
      const py = sy + dy;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const o = (py * w + px) * 4;
      sr += rgb[o];
      sg += rgb[o + 1];
      sb += rgb[o + 2];
      n++;
    }
  }
  const seedLab: number[] = [0, 0, 0];
  // ⚠️ arrondir : la LUT de conversion est indexée par des entiers 0-255
  rgbToLab(Math.round(sr / n), Math.round(sg / n), Math.round(sb / n), seedLab);

  // ----- 3. Masque global "dans la tolérance" -----
  const tol2 = tolerance * tolerance;
  const mask = new Uint8Array(w * h);
  const lab: number[] = [0, 0, 0];
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    rgbToLab(rgb[o], rgb[o + 1], rgb[o + 2], lab);
    const dL = lab[0] - seedLab[0];
    const dA = lab[1] - seedLab[1];
    const dB = lab[2] - seedLab[2];
    if (dL * dL + dA * dA + dB * dB <= tol2) mask[i] = 1;
  }

  // ----- 4. Érosion : coupe les ponts fins (anti-fuite) -----
  const eroded = morph(mask, w, h, MORPH_R, true);

  // graine érodée ? chercher le pixel érodé le plus proche dans un petit rayon
  let seedIdx = sy * w + sx;
  if (eroded[seedIdx] === 0) {
    let found = -1;
    outer: for (let radius = 1; radius <= MORPH_R + 2; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = sx + dx;
          const py = sy + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          if (eroded[py * w + px] === 1) {
            found = py * w + px;
            break outer;
          }
        }
      }
    }
    if (found === -1) return null; // rien de stable sous le clic
    seedIdx = found;
  }

  // ----- 5. Flood fill 4-connexe sur le masque érodé -----
  const comp = new Uint8Array(w * h);
  const stack: number[] = [seedIdx];
  comp[seedIdx] = 1;
  let count = 0;
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    count++;
    const px = idx % w;
    if (px > 0 && eroded[idx - 1] === 1 && comp[idx - 1] === 0) {
      comp[idx - 1] = 1;
      stack.push(idx - 1);
    }
    if (px < w - 1 && eroded[idx + 1] === 1 && comp[idx + 1] === 0) {
      comp[idx + 1] = 1;
      stack.push(idx + 1);
    }
    if (idx >= w && eroded[idx - w] === 1 && comp[idx - w] === 0) {
      comp[idx - w] = 1;
      stack.push(idx - w);
    }
    if (idx < w * (h - 1) && eroded[idx + w] === 1 && comp[idx + w] === 0) {
      comp[idx + w] = 1;
      stack.push(idx + w);
    }
  }
  if (count < 30) return null; // sélection trop petite

  // ----- 6. Dilatation : restaure la taille réelle de la composante -----
  const dilated = morph(comp, w, h, MORPH_R, false);

  // ----- 7. Extrêmes par ligne → minAreaRect → coordonnées pleine résolution -----
  const pts: Pt[] = [];
  for (let y = 0; y < h; y++) {
    let minX = -1;
    let maxX = -1;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (dilated[row + x] === 1) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX !== -1) {
      pts.push({ x: (minX + 0.5) * s, y: (y + 0.5) * s });
      if (maxX !== minX) pts.push({ x: (maxX + 0.5) * s, y: (y + 0.5) * s });
    }
  }
  const corners = minAreaRect(pts);
  if (!corners) return null;

  return { corners, pixelCount: count * s * s };
}
