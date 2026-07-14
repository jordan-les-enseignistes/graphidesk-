/*
 * geometry.js — calculs purs pour Cotes BAT.
 *
 * Aucune dépendance UXP : testable sous Node.
 * Convention :
 *   - une "bounds" InDesign = [y1, x1, y2, x2] (haut, gauche, bas, droite)
 *   - un "point" = { x, y }
 *   - un "segment" = { x1, y1, x2, y2 }
 *
 * La croix de cote suit la FORME dessinée : pour un quadrilatère (4 points),
 * on relie les milieux des côtés opposés (les "bimédianes"). Pour un rectangle
 * droit ça donne une croix horizontale/verticale ; pour une forme inclinée à la
 * plume, la croix s'incline avec la forme. Sinon, repli sur la boîte englobante.
 */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function median(nums) {
  if (!nums.length) return 0;
  const s = nums.slice().sort(function (a, b) { return a - b; });
  const m = Math.floor(s.length / 2);
  return (s.length % 2) ? s[m] : (s[m - 1] + s[m]) / 2;
}

function letterFromIndex(n) {
  n = Math.floor(n);
  if (n < 0) n = 0;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function indexFromLetter(s) {
  s = String(s == null ? "" : s).trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return -1;
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

/* Tri par position de lecture : haut -> bas, puis gauche -> droite. */
function sortBlocks(blocks) {
  if (!blocks || !blocks.length) return [];
  const heights = blocks.map(function (b) { return Math.abs(b.bounds[2] - b.bounds[0]); });
  const tol = Math.max(median(heights) * 0.6, 1);
  return blocks.slice().sort(function (a, b) {
    const ay = Math.min(a.bounds[0], a.bounds[2]);
    const by = Math.min(b.bounds[0], b.bounds[2]);
    if (Math.abs(ay - by) > tol) return ay - by;
    return Math.min(a.bounds[1], a.bounds[3]) - Math.min(b.bounds[1], b.bounds[3]);
  });
}

/* 4 coins (sens horaire) d'une boîte englobante. */
function cornersFromBounds(bounds) {
  const y1 = Math.min(bounds[0], bounds[2]);
  const y2 = Math.max(bounds[0], bounds[2]);
  const x1 = Math.min(bounds[1], bounds[3]);
  const x2 = Math.max(bounds[1], bounds[3]);
  return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
}

function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function segLen(s) { return Math.sqrt((s.x2 - s.x1) * (s.x2 - s.x1) + (s.y2 - s.y1) * (s.y2 - s.y1)); }

function centroid(pts) {
  let sx = 0, sy = 0;
  pts.forEach(function (p) { sx += p.x; sy += p.y; });
  return { x: sx / pts.length, y: sy / pts.length };
}

/* Décompose un segment en une flèche propre : un TRAIT raccourci (qui s'arrête
 * à la base de chaque pointe) + deux TÊTES (triangles pleins) dont le sommet est
 * au bout. Ainsi le trait ne dépasse jamais la pointe.
 * Renvoie { shaft:{x1,y1,x2,y2}, heads:[tri,tri] }. */
function arrowParts(line, headLen) {
  const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const hl = Math.min(headLen, len * 0.4); // pas plus de 40 % de la flèche par tête
  const ux = dx / len, uy = dy / len;       // direction
  const px = -uy, py = ux;                   // perpendiculaire
  const hw = hl * 0.45;                      // demi-largeur de la base (pointe fine)
  const b1x = line.x1 + ux * hl, b1y = line.y1 + uy * hl; // base près de P1
  const b2x = line.x2 - ux * hl, b2y = line.y2 - uy * hl; // base près de P2
  return {
    shaft: { x1: b1x, y1: b1y, x2: b2x, y2: b2y }, // trait entre les deux bases
    heads: [
      [[line.x1, line.y1], [b1x + px * hw, b1y + py * hw], [b1x - px * hw, b1y - py * hw]],
      [[line.x2, line.y2], [b2x + px * hw, b2y + py * hw], [b2x - px * hw, b2y - py * hw]]
    ]
  };
}

/*
 * Croix + losange d'une cote, à partir des points (coins) de la forme.
 *   corners: [{x,y}, ...]
 * Renvoie { letter, lines:[seg,seg], diamond:[[x,y]x4], center, strokeWeight, letterHeight }.
 */
function computeCote(corners, letter, opts) {
  opts = opts || {};
  let lines, center, m;

  if (corners && corners.length === 4) {
    // Bimédianes : milieux des côtés opposés -> croix qui épouse la forme.
    const m01 = mid(corners[0], corners[1]);
    const m12 = mid(corners[1], corners[2]);
    const m23 = mid(corners[2], corners[3]);
    const m30 = mid(corners[3], corners[0]);
    lines = [
      { x1: m01.x, y1: m01.y, x2: m23.x, y2: m23.y },
      { x1: m12.x, y1: m12.y, x2: m30.x, y2: m30.y }
    ];
    center = centroid(corners);
    m = Math.min(segLen(lines[0]), segLen(lines[1]));
  } else {
    // Repli : boîte englobante des points -> croix droite.
    const xs = corners.map(function (p) { return p.x; });
    const ys = corners.map(function (p) { return p.y; });
    const x1 = Math.min.apply(null, xs), x2 = Math.max.apply(null, xs);
    const y1 = Math.min.apply(null, ys), y2 = Math.max.apply(null, ys);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    lines = [
      { x1: x1, y1: cy, x2: x2, y2: cy },
      { x1: cx, y1: y1, x2: cx, y2: y2 }
    ];
    center = { x: cx, y: cy };
    m = Math.min(x2 - x1, y2 - y1);
  }

  // Épaisseur du trait : proportionnelle à la zone (flèches adaptées).
  const strokeWeight = clamp(m * (opts.weightRatio || 0.018), opts.weightMin || 0.4, opts.weightMax || 5);
  // Têtes de flèche DESSINÉES (triangles) : taille calée sur l'épaisseur du
  // trait (comme les pointes natives qu'on aimait), mais SANS taille plancher
  // -> elles rétrécissent vraiment sur les zones minuscules.
  const headLen = clamp(strokeWeight * (opts.headK || 3.5), 0.8, opts.headMax || 26);
  const shafts = [];
  const heads = [];
  lines.forEach(function (ln) {
    const ap = arrowParts(ln, headLen);
    shafts.push(ap.shaft);
    ap.heads.forEach(function (t) { heads.push(t); });
  });
  // Repère : taille LISIBLE et proportionnelle (jamais rétréci pour rentrer).
  const badge = clamp(m * (opts.badgeRatio || 0.20), opts.badgeMin || 12, opts.badgeMax || 48);
  const r = badge / 2;

  // Placement automatique : s'il tient dans la zone -> centré ; sinon (petite
  // zone) -> décalé LE LONG de la plus longue flèche (donc toujours SUR le
  // tracé), juste assez pour quitter le croisement sans masquer les flèches.
  const Lw = segLen(lines[0]);
  const Lh = segLen(lines[1]);
  const fits = m >= badge * (opts.fitFactor || 1.6);
  let place = center;
  if (!fits) {
    const longer = (Lw >= Lh) ? lines[0] : lines[1];
    let ux = longer.x2 - longer.x1, uy = longer.y2 - longer.y1;
    const L = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= L; uy /= L;
    if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uy < 0)) { ux = -ux; uy = -uy; } // vers droite/bas
    const halfLong = Math.max(Lw, Lh) / 2;
    const shift = Math.min(r + badge * 0.2, Math.max(0, halfLong - r)); // sur le tracé, hors croisement
    place = { x: center.x + ux * shift, y: center.y + uy * shift };
  }

  const cx = place.x, cy = place.y;
  const diamond = [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy]
  ];
  // Hauteur cible de la lettre vectorisée : strictement proportionnelle au
  // losange (pas de minimum) -> la lettre ne dépasse jamais son losange.
  const letterHeight = Math.min(badge * (opts.letterRatio || 0.5), 70);

  return {
    letter: letter,
    lines: lines,
    shafts: shafts,
    heads: heads,
    diamond: diamond,
    center: place,
    centered: fits,
    badge: badge,
    strokeWeight: strokeWeight,
    letterHeight: letterHeight
  };
}

module.exports = {
  clamp: clamp,
  median: median,
  letterFromIndex: letterFromIndex,
  indexFromLetter: indexFromLetter,
  sortBlocks: sortBlocks,
  cornersFromBounds: cornersFromBounds,
  centroid: centroid,
  segLen: segLen,
  computeCote: computeCote
};
