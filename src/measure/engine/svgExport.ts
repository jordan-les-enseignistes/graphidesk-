// ============================================================
// Export "Prémaquette provisoire" en SVG éditable (Illustrator)
// ============================================================
// Les zones sont projetées via l'homographie dans le plan réel de
// la façade (mm), puis dessinées comme rectangles idéalisés :
//   - position = coin haut-gauche du quadrilatère rectifié
//   - taille   = dimensions mesurées (largeur × hauteur)
// Échelle 1:10 : 1 unité SVG = 1 mm de dessin = 10 mm réels.
// (le SVG déclare width/height en mm → Illustrator ouvre à la
// bonne taille papier)

import { applyHomography, invertHomography } from "./homography";
import { roundTo5Mm } from "./zones";
import type { Zone, Plane } from "../state/types";

const SCALE = 10; // 1:10
const MARGIN_MM = 300; // marge autour du dessin, en mm réels
const TITLE_MM = 500; // hauteur du bloc titre, en mm réels
const FOND_MARGIN_MM = 0; // le fond colle exactement à l'enveloppe des zones
const CADRE_VITRINE_MM = 50; // largeur du cadre de menuiserie autour du vitrage
const CADRE_VITRINE_COLOR = "#4a5056"; // alu anthracite typique

/**
 * Échantillonne la couleur médiane du fond de façade (montants, mur) DANS
 * la photo : on prend des points en espace rectifié (mm) qui ne tombent
 * dans AUCUNE zone, on les reprojette en pixels photo via l'homographie
 * inverse, et on lit les pixels. La médiane est robuste aux intrus
 * (ciel, sol, reflets).
 */
function sampleFondColor(
  photo: HTMLCanvasElement,
  hInv: number[],
  rectsMm: { x: number; y: number; w: number; h: number }[],
  envelope: { minX: number; minY: number; maxX: number; maxY: number }
): string | null {
  const ctx = photo.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const w = envelope.maxX - envelope.minX;
  const h = envelope.maxY - envelope.minY;
  const step = Math.max(w, h) / 45;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  for (let y = envelope.minY; y <= envelope.maxY; y += step) {
    for (let x = envelope.minX; x <= envelope.maxX; x += step) {
      // hors de toutes les zones (avec une petite garde de 20mm)
      let insideZone = false;
      for (const r of rectsMm) {
        if (x >= r.x - 20 && x <= r.x + r.w + 20 && y >= r.y - 20 && y <= r.y + r.h + 20) {
          insideZone = true;
          break;
        }
      }
      if (insideZone) continue;

      const px = applyHomography(hInv, x, y);
      const ix = Math.round(px.x);
      const iy = Math.round(px.y);
      if (ix < 0 || iy < 0 || ix >= photo.width || iy >= photo.height) continue;

      const d = ctx.getImageData(ix, iy, 1, 1).data;
      rs.push(d[0]);
      gs.push(d[1]);
      bs.push(d[2]);
    }
  }

  if (rs.length < 10) return null;
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(median(rs))}${toHex(median(gs))}${toHex(median(bs))}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface SvgExportOptions {
  /** true = maquette définitive avec cotes réelles de visite technique */
  vt?: boolean;
}

/**
 * Détecte une homographie "miroir" et la redresse. Historiquement, si les
 * 4 points de référence étaient cliqués dans un ordre inattendu, le plan
 * rectifié était construit inversé gauche/droite (les LONGUEURS restaient
 * justes, mais les POSITIONS X étaient en miroir dans les exports). Test :
 * signe du jacobien de la projection — négatif = orientation inversée →
 * on nie la ligne X de H (x_mm → -x_mm), l'export normalisant ensuite par
 * la bounding box. Soigne aussi les projets sauvegardés avant le fix.
 */
function unmirrorH(h: number[], at: { x: number; y: number }): number[] {
  const p = applyHomography(h, at.x, at.y);
  const px = applyHomography(h, at.x + 1, at.y);
  const py = applyHomography(h, at.x, at.y + 1);
  const det = (px.x - p.x) * (py.y - p.y) - (px.y - p.y) * (py.x - p.x);
  if (det >= 0) return h;
  return [-h[0], -h[1], -h[2], h[3], h[4], h[5], h[6], h[7], h[8]];
}

export function buildPremaquetteSvg(
  zones: Zone[],
  plane: Plane,
  imageName: string,
  photo?: HTMLCanvasElement | null,
  opts?: SvgExportOptions
): string | null {
  if (!plane.H || !plane.reference) return null;
  const planeZones = zones.filter((z) => z.planeId === plane.id);
  if (planeZones.length === 0) return null;
  const isVt = opts?.vt === true;

  // auto-correction des calibrations "miroir" (jacobien négatif)
  const H = unmirrorH(plane.H, planeZones[0].corners[0]);
  plane = { ...plane, H };

  // Rectangles idéalisés en mm réels du plan
  interface RectMm {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    dims: string;
    vitrage: boolean;
  }
  const rects: RectMm[] = [];
  for (const z of planeZones) {
    const pts = z.corners.map((c) => applyHomography(plane.H as number[], c.x, c.y));
    const x = Math.min(pts[0].x, pts[1].x, pts[2].x, pts[3].x);
    const y = Math.min(pts[0].y, pts[1].y, pts[2].y, pts[3].y);
    // provisoire : dimensions ARRONDIES au 5mm — VT : cotes réelles exactes
    // (en mode VT, une zone non confirmée par le poseur garde sa cote
    // provisoire, arrondie et marquée ≈)
    const confirmed = isVt && z.vtConfirmed !== false;
    const wR = confirmed ? z.widthMm : roundTo5Mm(z.widthMm);
    const hR = confirmed ? z.heightMm : roundTo5Mm(z.heightMm);
    rects.push({
      x,
      y,
      w: wR,
      h: hR,
      label: z.label,
      dims: confirmed
        ? `${wR} × ${hR} mm`
        : isVt
          ? `≈ ${wR} × ${hR} mm (provisoire)`
          : `≈ ${wR} × ${hR} mm`,
      vitrage: z.fill === "vitrage",
    });
  }

  // ⚠️ Z-ORDER : les grandes zones (façade entière, bandeau...) doivent être
  // dessinées DERRIÈRE les petites, sinon une zone englobante opaque masque
  // tout ce qu'elle contient. Tri par surface décroissante.
  rects.sort((a, b) => b.w * b.h - a.w * a.h);

  // Zones CONTENEURS (façade entière...) : elles contiennent le centre
  // d'au moins une autre zone. Elles seront remplies avec la couleur du
  // mur échantillonnée dans la photo (→ les montants apparaissent entre
  // les vitrines), et ne bloquent pas l'échantillonnage.
  const isContainer = (r: (typeof rects)[number]) =>
    rects.some(
      (o) =>
        o !== r &&
        o.x + o.w / 2 > r.x &&
        o.x + o.w / 2 < r.x + r.w &&
        o.y + o.h / 2 > r.y &&
        o.y + o.h / 2 < r.y + r.h
    );
  const containerFlags = rects.map(isContainer);

  // Bornes globales
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }

  // Conversion mm réels → unités SVG (1 unité = 1 mm dessiné = SCALE mm réels)
  const u = (mmReal: number) => mmReal / SCALE;
  const ox = MARGIN_MM - minX; // translation pour placer le dessin dans la marge
  const oy = MARGIN_MM + TITLE_MM - minY;

  const docWmm = u(maxX - minX + 2 * MARGIN_MM);
  const docHmm = u(maxY - minY + 2 * MARGIN_MM + TITLE_MM);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${docWmm.toFixed(2)}mm" height="${docHmm.toFixed(2)}mm" viewBox="0 0 ${docWmm.toFixed(2)} ${docHmm.toFixed(2)}">`
  );

  // ---- Défs : texture vitrage (dégradés relatifs → s'adaptent à chaque rect) ----
  parts.push(`<defs>`);
  parts.push(
    `<linearGradient id="gradVitrage" x1="0" y1="1" x2="0" y2="0">` +
      `<stop offset="0" stop-color="#96a9d7"/>` +
      `<stop offset="1" stop-color="#4376ba"/>` +
      `</linearGradient>`
  );
  parts.push(
    `<linearGradient id="gradReflet" x1="0.374" y1="0.003" x2="0.277" y2="0.583">` +
      `<stop offset="0" stop-color="#ffffff" stop-opacity="0.3"/>` +
      `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
      `</linearGradient>`
  );
  parts.push(`</defs>`);

  // ---- Fond de façade : bloc derrière les zones (les montants =
  //      espaces entre vitrines, aux cotes issues des mesures) ----
  let fondColor = "#d9d9d9";
  if (photo && plane.H) {
    try {
      const hInv = invertHomography(plane.H);
      // seules les zones NON conteneurs excluent des points d'échantillonnage
      // (sinon une zone "façade entière" bloquerait tout l'intérieur)
      const excluding = rects.filter((_, i) => !containerFlags[i]);
      const sampled = sampleFondColor(photo, hInv, excluding, { minX, minY, maxX, maxY });
      if (sampled) fondColor = sampled;
    } catch (e) {
      // fallback gris si l'échantillonnage échoue
    }
  }

  // ---- Groupe 1 : les CADRES seuls (destiné à devenir la maquette) ----
  parts.push(`<g id="CADRES">`);
  {
    // bloc FOND en premier (donc derrière), débordant légèrement des zones
    const fx = u(minX + ox - FOND_MARGIN_MM);
    const fy = u(minY + oy - FOND_MARGIN_MM);
    const fw = u(maxX - minX + 2 * FOND_MARGIN_MM);
    const fh = u(maxY - minY + 2 * FOND_MARGIN_MM);
    parts.push(
      `<rect id="FOND_FACADE" x="${fx.toFixed(2)}" y="${fy.toFixed(2)}" width="${fw.toFixed(2)}" height="${fh.toFixed(2)}" fill="${fondColor}" stroke="#000000" stroke-width="0.3"/>`
    );
  }
  for (let ri = 0; ri < rects.length; ri++) {
    const r = rects[ri];
    const x = u(r.x + ox);
    const y = u(r.y + oy);
    const w = u(r.w);
    const h = u(r.h);
    const idAttr = esc(r.label.replace(/\s+/g, "_"));
    if (containerFlags[ri] && !r.vitrage) {
      // zone conteneur (façade) : couleur du mur échantillonnée → les
      // montants apparaissent naturellement entre les zones posées dessus
      parts.push(
        `<rect id="${idAttr}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fondColor}" stroke="#000000" stroke-width="0.3"/>`
      );
    } else if (r.vitrage) {
      parts.push(`<g id="${idAttr}">`);
      // cadre de menuiserie AUTOUR du vitrage mesuré (la mesure = le verre,
      // le cadre s'ajoute à l'extérieur)
      const cw = u(CADRE_VITRINE_MM);
      parts.push(
        `<rect x="${(x - cw).toFixed(2)}" y="${(y - cw).toFixed(2)}" width="${(w + 2 * cw).toFixed(2)}" height="${(h + 2 * cw).toFixed(2)}" fill="${CADRE_VITRINE_COLOR}" stroke="#000000" stroke-width="0.3"/>`
      );
      // vitrage aux cotes exactes : dégradé bleu + reflet diagonal
      parts.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="url(#gradVitrage)" stroke="#000000" stroke-width="0.3"/>`
      );
      // polygone de reflet : fractions du modèle 497.5² → (0.343,1) (0,1) (0,0) (0.749,0)
      const px = (fx: number) => (x + w * fx).toFixed(2);
      const py = (fy: number) => (y + h * fy).toFixed(2);
      parts.push(
        `<polygon points="${px(0.343)},${py(1)} ${px(0)},${py(1)} ${px(0)},${py(0)} ${px(0.749)},${py(0)}" fill="url(#gradReflet)"/>`
      );
      parts.push(`</g>`);
    } else {
      // blanc OPAQUE (le bloc FOND est derrière : un fill "none" le laisserait voir)
      parts.push(
        `<rect id="${idAttr}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="#ffffff" stroke="#000000" stroke-width="0.3"/>`
      );
    }
  }
  parts.push(`</g>`);

  // ---- Groupe 2 : tous les TEXTES (titre + cotes) — supprimable en un clic ----
  const dateStr = new Date().toLocaleDateString("fr-FR");
  const title = isVt
    ? `MAQUETTE — COTES VT du ${dateStr} — échelle 1:10`
    : "PRÉMAQUETTE PROVISOIRE — échelle 1:10 — cotes arrondies au 5 mm";
  const subtitle = isVt
    ? `Cotes réelles saisies après visite technique — photo : ${imageName}`
    : `Référence : ${plane.reference.widthMm} × ${plane.reference.heightMm} mm — photo : ${imageName} — À CONFIRMER EN VISITE TECHNIQUE`;
  const titleColor = isVt ? "#15803d" : "#b45309";
  parts.push(`<g id="TEXTES" font-family="Arial, sans-serif">`);
  parts.push(
    `<text x="${u(MARGIN_MM).toFixed(2)}" y="${u(MARGIN_MM + 150).toFixed(2)}" font-size="${u(180).toFixed(2)}" font-weight="bold" fill="${titleColor}">${esc(title)}</text>`
  );
  parts.push(
    `<text x="${u(MARGIN_MM).toFixed(2)}" y="${u(MARGIN_MM + 380).toFixed(2)}" font-size="${u(120).toFixed(2)}" fill="#525252">${esc(subtitle)}</text>`
  );
  for (const r of rects) {
    const x = u(r.x + ox);
    const y = u(r.y + oy);
    const w = u(r.w);
    const h = u(r.h);
    const fontSize = Math.min(u(140), Math.max(u(60), h * 0.25));
    parts.push(
      `<text x="${(x + w / 2).toFixed(2)}" y="${(y + h / 2).toFixed(2)}" font-size="${fontSize.toFixed(2)}" fill="#6b7280" text-anchor="middle" dominant-baseline="middle">${esc(r.label)} ${esc(r.dims)}</text>`
    );
  }
  parts.push(`</g>`);
  parts.push(`</svg>`);

  return parts.join("\n");
}

/** Déclenche le téléchargement du SVG */
export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
