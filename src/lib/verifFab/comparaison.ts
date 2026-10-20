/**
 * Vérif FAB — comparaison de deux visuels (BAT ou maquette ↔ fichier de FAB).
 *
 * On ne compare pas des pixels « pleins » : la FAB des lettres PVC n'a que des
 * contours, le BAT des lettres remplies, la vitrophanie du blanc sur
 * transparent… On compare les CONTOURS (bords des formes), qui existent dans
 * tous les cas. Chaque visuel est recadré sur ses contours, remis à la même
 * taille, puis superposé :
 *   - part des contours de A retrouvés dans B (élément manquant dans B ?) ;
 *   - part des contours de B retrouvés dans A (élément en trop dans B ?) ;
 *   - proportions largeur/hauteur des deux emprises (déformation ?).
 * Une image résume : gris = commun, rouge = seulement dans A, bleu = seulement dans B.
 *
 * Module pur (pas de DOM) : testé hors ligne sur de vrais dossiers.
 */

export interface Trame {
  largeur: number;
  hauteur: number;
  /** RVBA, 4 octets par pixel */
  donnees: Uint8ClampedArray;
}

export interface ResultatComparaison {
  /** % des contours de A retrouvés dans B */
  aDansB: number;
  /** % des contours de B retrouvés dans A */
  bDansA: number;
  /** largeur / hauteur de l'emprise des formes */
  proportionA: number;
  proportionB: number;
  /** écart de proportion en % (une déformation la fait monter) */
  ecartProportion: number;
  /** zones (en % de l'emprise commune) où A a des formes que B n'a pas, et inversement */
  zonesManquantesDansB: Zone[];
  zonesEnTropDansB: Zone[];
  /** superposition : gris commun, rouge A seul, bleu B seul */
  image: Trame;
}

export interface Zone { gauche: number; haut: number; largeur: number; hauteur: number }

/** Bords : un pixel dont la luminance diffère nettement d'un voisin */
function contours(t: Trame): Uint8Array {
  const { largeur: w, hauteur: h, donnees: d } = t;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    // transparent = blanc (fond de page)
    lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a);
  }
  const m = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      if (gx * gx + gy * gy > 40 * 40) m[i] = 1;
    }
  return m;
}

function emprise(m: Uint8Array, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Recadre le masque sur son emprise et le remet à la taille W x H (plus proche voisin, « au moins un » ) */
function normaliser(m: Uint8Array, w: number, e: { x0: number; y0: number; x1: number; y1: number }, W: number, H: number) {
  const out = new Uint8Array(W * H);
  const sw = (e.x1 - e.x0 + 1) / W, sh = (e.y1 - e.y0 + 1) / H;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // un pixel cible est « contour » si un pixel source de sa cellule l'est
      const xs0 = Math.floor(e.x0 + x * sw), xs1 = Math.max(xs0, Math.floor(e.x0 + (x + 1) * sw) - 1);
      const ys0 = Math.floor(e.y0 + y * sh), ys1 = Math.max(ys0, Math.floor(e.y0 + (y + 1) * sh) - 1);
      let v = 0;
      for (let yy = ys0; yy <= ys1 && !v; yy++) for (let xx = xs0; xx <= xs1; xx++) if (m[yy * w + xx]) { v = 1; break; }
      out[y * W + x] = v;
    }
  return out;
}

function dilater(m: Uint8Array, W: number, H: number, r: number) {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = 1;
        }
    }
  return out;
}

/** Regroupe les pixels « orphelins » en zones (grille 12 x 12), en % */
function zonesOrphelines(orph: Uint8Array, W: number, H: number): Zone[] {
  const N = 12, cw = W / N, ch = H / N;
  const total = new Float32Array(N * N);
  let somme = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (orph[y * W + x]) { total[Math.min(N - 1, Math.floor(y / ch)) * N + Math.min(N - 1, Math.floor(x / cw))]++; somme++; }
  if (!somme) return [];
  const seuil = Math.max(8, (cw * ch) * 0.02);
  const zones: Zone[] = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      if (total[j * N + i] > seuil)
        zones.push({ gauche: Math.round((i / N) * 100), haut: Math.round((j / N) * 100), largeur: Math.round(100 / N), hauteur: Math.round(100 / N) });
  // cellules voisines fusionnées par ligne, pour rester lisible
  zones.sort((a, b) => a.haut - b.haut || a.gauche - b.gauche);
  const fusion: Zone[] = [];
  for (const z of zones) {
    const d = fusion[fusion.length - 1];
    if (d && d.haut === z.haut && d.gauche + d.largeur >= z.gauche - 1) d.largeur = z.gauche + z.largeur - d.gauche;
    else fusion.push({ ...z });
  }
  return fusion.slice(0, 12);
}

/**
 * Recalage : on cherche l'échelle (x, y) et le décalage qui posent le mieux les
 * contours de B sur ceux de A. L'emprise seule ne suffit pas : une ligne de
 * cote ou un cadre sur le BAT l'élargit et décale tout.
 */
type Recalage = { s: number; sx: number; sy: number; tx: number; ty: number };

function recaler(na: Uint8Array, nb: Uint8Array, W: number, H: number, autour?: Recalage): Recalage {
  // 1er passage grossier sur une grille réduite ; 2e passage fin autour du meilleur
  const f = Math.max(1, Math.round(Math.max(W, H) / (autour ? 450 : 220)));
  const w = Math.floor(W / f), h = Math.floor(H / f);
  const reduire = (m: Uint8Array) => {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) {
      const X = Math.min(w - 1, Math.floor(x / f)), Y = Math.min(h - 1, Math.floor(y / f));
      o[Y * w + X] = 1;
    }
    return o;
  };
  const pa = reduire(na), pb = reduire(nb);
  const da = dilater(pa, w, h, 1), db = dilater(pb, w, h, 1);
  const ptsA: number[] = [], ptsB: number[] = [];
  for (let i = 0; i < w * h; i++) { if (pa[i]) ptsA.push(i); if (pb[i]) ptsB.push(i); }
  const cx = w / 2, cy = h / 2;
  let meilleur: Recalage = { s: -1, sx: 1, sy: 1, tx: 0, ty: 0 };
  const echX = autour ? [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03].map((d) => autour.sx * (1 + d)) : [0.7, 0.76, 0.82, 0.87, 0.91, 0.95, 1, 1.05, 1.1, 1.15, 1.22, 1.3, 1.4];
  const echY = autour ? [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03].map((d) => autour.sy * (1 + d)) : echX;
  const decal = (n: number, centre: number) => {
    const pas = autour ? 1 : Math.max(1, Math.round(n / 60));
    const debut = autour ? Math.round(centre / f) - 6 : -Math.round(n * 0.2);
    const fin = autour ? Math.round(centre / f) + 6 : Math.round(n * 0.2);
    const v: number[] = [];
    for (let t = debut; t <= fin; t += pas) v.push(t);
    return v;
  };
  const listeTx = decal(w, autour?.tx ?? 0), listeTy = decal(h, autour?.ty ?? 0);
  for (const sx of echX) for (const sy of echY) {
    if (Math.abs(Math.log(sx / sy)) > 0.35) continue; // déformation au-delà de 40 % : hors sujet
    for (const tx of listeTx)
      for (const ty of listeTy) {
        // B (repère commun) → transformé autour du centre → comparé à A
        let okB = 0;
        for (const i of ptsB) {
          const X = Math.round((i % w - cx) * sx + cx + tx), Y = Math.round((Math.floor(i / w) - cy) * sy + cy + ty);
          if (X >= 0 && Y >= 0 && X < w && Y < h && da[Y * w + X]) okB++;
        }
        let okA = 0;
        for (const i of ptsA) {
          const X = Math.round((i % w - cx - tx) / sx + cx), Y = Math.round((Math.floor(i / w) - cy - ty) / sy + cy);
          if (X >= 0 && Y >= 0 && X < w && Y < h && db[Y * w + X]) okA++;
        }
        const s = (okA / Math.max(1, ptsA.length) + okB / Math.max(1, ptsB.length)) / 2;
        if (s > meilleur.s) meilleur = { s, sx, sy, tx: tx * f, ty: ty * f };
      }
  }
  return meilleur;
}

function transformer(nb: Uint8Array, W: number, H: number, t: { sx: number; sy: number; tx: number; ty: number }) {
  const out = new Uint8Array(W * H);
  const cx = W / 2, cy = H / 2;
  for (let i = 0; i < W * H; i++) {
    if (!nb[i]) continue;
    const X = Math.round((i % W - cx) * t.sx + cx + t.tx), Y = Math.round((Math.floor(i / W) - cy) * t.sy + cy + t.ty);
    if (X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = 1;
  }
  return out;
}

export function comparerTrames(a: Trame, b: Trame, tolerancePct = 0.6): ResultatComparaison | null {
  const ma = contours(a), mb = contours(b);
  const ea = emprise(ma, a.largeur, a.hauteur), eb = emprise(mb, b.largeur, b.hauteur);
  if (!ea || !eb) return null;
  const propA0 = (ea.x1 - ea.x0 + 1) / (ea.y1 - ea.y0 + 1);
  const propB0 = (eb.x1 - eb.x0 + 1) / (eb.y1 - eb.y0 + 1);
  // grille commune : 900 px sur le grand côté, aux proportions de A
  const W = propA0 >= 1 ? 900 : Math.max(60, Math.round(900 * propA0));
  const H = propA0 >= 1 ? Math.max(60, Math.round(900 / propA0)) : 900;
  const na = normaliser(ma, a.largeur, ea, W, H);
  const nb0 = normaliser(mb, b.largeur, eb, W, H);
  const t = recaler(na, nb0, W, H, recaler(na, nb0, W, H));
  const nb = transformer(nb0, W, H, t);
  // proportion des formes de B, corrigée de ce qui ne vient que des emprises
  // différentes (cote, cadre) : sans déformation, elle égale celle de A
  const propA = propA0, propB = propB0 * (t.sy / t.sx);
  const r = Math.max(2, Math.round(Math.max(W, H) * tolerancePct / 100));
  const da = dilater(na, W, H, r), db = dilater(nb, W, H, r);
  let totA = 0, okA = 0, totB = 0, okB = 0;
  const seulA = new Uint8Array(W * H), seulB = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (na[i]) { totA++; if (db[i]) okA++; else seulA[i] = 1; }
    if (nb[i]) { totB++; if (da[i]) okB++; else seulB[i] = 1; }
  }
  const img = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    let c = [255, 255, 255];
    if (seulA[i]) c = [220, 30, 30];
    else if (seulB[i]) c = [30, 90, 230];
    else if (na[i] || nb[i]) c = [150, 150, 150];
    img[i * 4] = c[0]; img[i * 4 + 1] = c[1]; img[i * 4 + 2] = c[2]; img[i * 4 + 3] = 255;
  }
  const arr = (v: number) => Math.round(v * 10) / 10;
  return {
    aDansB: arr((okA / Math.max(1, totA)) * 100),
    bDansA: arr((okB / Math.max(1, totB)) * 100),
    proportionA: Math.round(propA * 1000) / 1000,
    proportionB: Math.round(propB * 1000) / 1000,
    ecartProportion: arr((Math.abs(propA - propB) / propA) * 100),
    zonesManquantesDansB: zonesOrphelines(seulA, W, H),
    zonesEnTropDansB: zonesOrphelines(seulB, W, H),
    image: { largeur: W, hauteur: H, donnees: img },
  };
}
