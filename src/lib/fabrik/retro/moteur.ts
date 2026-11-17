// Lettres rétroéclairées sur entretoises (process atelier V2, demande de Léa du 12/11/2026) — moteur de calcul,
// sans aucune dépendance à Illustrator ni à l'interface.
//
// Le process V2 ne vide plus l'intérieur des lettres PVC : la CNC creuse seulement une RAINURE pour le ruban LED,
// le long du bord de la lettre (pour un éclairage régulier), et grave les repères des entretoises.
//
//   Rainure (vert)      : bande parallèle au bord, à `bordure` mm du trait de découpe, large de `rainureMax` mm,
//                         jamais plus étroite que `rainureMin` (là où ça ne rentre pas, rien n'est creusé et l'endroit
//                         est signalé « à vérifier »). Usinable avec une fraise de Ø `fraise` (aucun creux plus serré).
//   Liaisons            : dans une même pièce, toutes les rainures sont reliées (contour extérieur ↔ intérieurs du
//                         O, A, B…) par le passage le plus court, pour faire passer câbles et ruban.
//   Entretoises (bleu)  : cercles de Ø `diametre` à graver, posés sur la matière PLEINE (jamais dans la rainure ni dans
//                         le vide), en retrait de la rainure (sinon on les verrait dépasser dans le halo), en nombre suffisant
//                         pour que tout point de la lettre soit à moins de `couverture` mm d'une entretoise (2 au moins).
//                         Toutes les entretoises d'un fichier sont posées sur la matière PLEINE, jamais sur la rainure ni encastrées :
//                         sinon elles ne seraient pas à la même hauteur (un fichier = un seul process, Jordan, 13/11/2026).
//   À vérifier          : seulement ce qui BLOQUE la fabrication (pièce sans entretoise possible, rainures impossibles à relier,
//                         tracé ouvert). Le reste (bord non éclairé, entretoise en bout, passage de câble) est dans le bilan,
//                         marqué `info: true`, sans cercle rouge (Jordan : « plein de cercles rouges pour rien »).
//
// Entrée : { coupe: [{ ferme, pts: [[x, y], …] }] } en mm, y vers le bas. Le tracé de découpe n'est jamais modifié.
// Sortie : { rainure: [forme…], entretoises: [{ x, y, repli }], doutes: [{ motif, boite }], pieces: […], stats }
//   (une « forme » = [contour extérieur, trous…], chaque anneau = [[x, y], …] en mm)
// @ts-nocheck — la géométrie passe par clipper-lib, non typée.
import CL from "clipper-lib";

const E = 1000; // 1 mm = 1000 unités (µm)
export const PARAMETRES_RETRO = {
  bordure: 6,          // mm entre le trait de découpe et la rainure (process actuel, inchangé)
  rainureMax: 10,      // mm, largeur de la rainure
  rainureMin: 6,       // mm, largeur en dessous de laquelle le ruban LED ne passe pas
  fraise: 3,           // mm, diamètre minimal de la fraise
  diametre: 9,         // mm, diamètre d'une entretoise
  garde: 2,            // mm de matière pleine laissés entre une entretoise et la rainure
  couverture: 130,     // mm : tout point d'une pièce est à moins de cette distance d'une entretoise (≈ 6 par lettre Peppino, 4–5 sur le logo Quimper)
  profondeurMax: 15,   // mm : dans une grande surface, l'entretoise reste à cette distance de la rainure au plus (placement de Jordan)
  ecartMin: 40,        // mm entre deux entretoises d'une même pièce (sauf pièce trop petite)
  cable: 2,            // mm, largeur du passage de câble (non lumineux) là où une vraie rainure ne passe pas (4 avant la rainure adaptative)
  bordureCable: 3,     // mm de matière gardés entre un passage de câble et le trait de découpe
  arc: 0.05,           // mm, précision des arrondis
  adaptative: true,    // rainure ADAPTATIVE (Jordan, 17/11/2026) : sa largeur suit la place disponible entre les bordures
  rainureCable: 1,     // mm : en adaptatif, la rainure se rétrécit jusqu'à cette largeur (passage de câble) ; en dessous, rien
  pasAdaptatif: 0.1,   // mm, finesse du calcul de la largeur adaptative
  lissage: 1.5,        // mm, rayon du lissage de la rainure adaptative
  deltaMediane: 0.25,  // mm : demi-largeur de la bande qui sert à relever la ligne médiane des traits
  adoucissement: 1.5,  // mm : écart-type de l'adoucissement final du tracé de la rainure adaptative (plus d'ondulations)
  miette: 0.6,         // mm² : en dessous, un reste du lissage est une miette d'angle (supprimée)
  bordureMin: 2,       // mm : sur un trait trop fin, la rainure continue au milieu en réduisant la bordure jusqu'à cette valeur
  raccordMax: 25,      // mm : distance maximale pour raccorder un prolongement à la rainure
  longueurFil: 12,     // mm : longueur minimale d'un tel prolongement (en dessous : simple pointe d'angle, ignorée)
};

// ---------- briques Clipper ----------
const NZ = CL.PolyFillType.pftNonZero, EO = CL.PolyFillType.pftEvenOdd;
const versC = (pts) => pts.map((p) => ({ X: Math.round(p[0] * E), Y: Math.round(p[1] * E) }));
const versMm = (r) => r.map((q) => [q.X / E, q.Y / E]);
function bool(type, a, b, fa = NZ) {
  const c = new CL.Clipper(), sol = [];
  if (a.length) c.AddPaths(a, CL.PolyType.ptSubject, true);
  if (b && b.length) c.AddPaths(b, CL.PolyType.ptClip, true);
  c.Execute(type, sol, fa, NZ);
  return sol;
}
const union = (a, b = [], fa = NZ) => bool(CL.ClipType.ctUnion, a, b, fa);
const inter = (a, b) => (a.length && b.length ? bool(CL.ClipType.ctIntersection, a, b) : []);
const diff = (a, b) => (a.length ? (b.length ? bool(CL.ClipType.ctDifference, a, b) : a) : []);
function decale(paths, mm, fin = CL.EndType.etClosedPolygon) {
  // Les décalages successifs laissent des allers-retours de 1 µm ; décalés à leur tour, chacun deviendrait un petit arc
  // (des « bosses » de quelques mm le long de la rainure) → on nettoie les tracés avant chaque décalage.
  if (fin === CL.EndType.etClosedPolygon) paths = CL.Clipper.CleanPolygons(paths, 20).filter((p) => p.length >= 3 && Math.abs(CL.Clipper.Area(p)) > 400);
  if (!paths.length) return [];
  const co = new CL.ClipperOffset(2, PARAMETRES_RETRO.arc * E), sol = [];
  co.AddPaths(paths, CL.JoinType.jtRound, fin);
  co.Execute(sol, mm * E);
  return sol;
}
const ouverture = (paths, r) => decale(decale(paths, -r), r);
const aire = (paths) => paths.reduce((s, p) => s + CL.Clipper.Area(p), 0) / (E * E);
function formes(paths) {
  const arbre = new CL.PolyTree(), c = new CL.Clipper();
  c.AddPaths(paths, CL.PolyType.ptSubject, true);
  c.Execute(CL.ClipType.ctUnion, arbre, NZ, NZ);
  return CL.JS.PolyTreeToExPolygons(arbre).map((ex) => [ex.outer, ...ex.holes]);
}
function boite(paths) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of paths) for (const q of p) { if (q.X < x0) x0 = q.X; if (q.Y < y0) y0 = q.Y; if (q.X > x1) x1 = q.X; if (q.Y > y1) y1 = q.Y; }
  return [x0, y0, x1, y1];
}
const dedans = (pt, paths) => { let n = 0; for (const p of paths) if (CL.Clipper.PointInPolygon(pt, p) !== 0) n++; return n % 2 === 1; };
/** points le long des anneaux, tous les `pas` mm */
function jalons(paths, pas) {
  const out = [];
  for (const r of paths) for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b.X - a.X, b.Y - a.Y), n = Math.max(1, Math.ceil(L / (pas * E)));
    for (let k = 0; k < n; k++) out.push({ X: a.X + (b.X - a.X) * k / n, Y: a.Y + (b.Y - a.Y) * k / n });
  }
  return out;
}
/** points d'une grille de `pas` mm à l'intérieur de la zone */
function grille(paths, pas) {
  const out = [], [x0, y0, x1, y1] = boite(paths), s = pas * E;
  for (let y = y0 + s / 2; y < y1; y += s) for (let x = x0 + s / 2; x < x1; x += s) { const q = { X: Math.round(x), Y: Math.round(y) }; if (dedans(q, paths)) out.push(q); }
  return out;
}
const boiteMm = (paths, marge = 0) => { const b = boite(paths); return [b[0] / E - marge, b[1] / E - marge, b[2] / E + marge, b[3] / E + marge].map((v) => +v.toFixed(1)); };

/**
 * Sous-tracés d'un même objet → zone. Un sous-tracé contenu dans un autre est un trou (intérieur d'un O) ; des sous-tracés
 * qui se CROISENT (feuilles d'un rameau dessinées l'une sur l'autre dans un même tracé transparent) sont réunis.
 */
function combinerObjet(anneaux) {
  const pos = anneaux.map((r) => (CL.Clipper.Orientation(r) ? r : r.slice().reverse()));
  const aires = pos.map((r) => Math.abs(CL.Clipper.Area(r)));
  const parent = pos.map((_, i) => i), racine = (i) => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
  const bx = pos.map((r) => boite([r]));
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
    const a = bx[i], b = bx[j];
    if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) continue;
    const x = Math.abs(aire(inter([pos[i]], [pos[j]]))) * E * E;
    if (x > 1e4 && x < Math.min(aires[i], aires[j]) * 0.999) parent[racine(i)] = racine(j);   // ils se croisent
  }
  const grappes = new Map();
  pos.forEach((r, i) => { const k = racine(i); if (!grappes.has(k)) grappes.set(k, []); grappes.get(k).push(r); });
  let tout = [];
  for (const g of grappes.values()) tout = tout.concat(g.length > 1 ? union(g) : g);
  return union(tout, [], EO);
}

/** remplissage d'une zone sur une grille (pair-impair, par lignes) : 1 = dedans */
function tramer(paths, x0, y0, pas, nx, ny) {
  const t = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * pas, xs = [];
    for (const r of paths) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      if ((a.Y > y) !== (b.Y > y)) xs.push(a.X + (y - a.Y) * (b.X - a.X) / (b.Y - a.Y));
    }
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - x0) / pas - 0.5)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / pas - 0.5));
      for (let i = i0; i <= i1; i++) t[j * nx + i] = 1;
    }
  }
  return t;
}

/**
 * Passages de câble entre les rainures d'une pièce qui n'ont pas pu être reliées par un passage droit : plus court chemin
 * (grille de 1 mm) dans la matière, à `bordureCable` mm au moins du trait de découpe, en préférant le milieu de la matière.
 */
function passagesCable(piece, G, P) {
  const pas = 1 * E, [bx0, by0, bx1, by1] = boite(piece);
  const x0 = bx0 - pas, y0 = by0 - pas, nx = Math.ceil((bx1 - bx0) / pas) + 3, ny = Math.ceil((by1 - by0) / pas) + 3;
  const permis = tramer(union(decale(piece, -(P.bordureCable + P.cable / 2)), G), x0, y0, pas, nx, ny);
  // préférence pour le milieu : coût plus élevé près du bord de la zone permise (distance de chanfrein 3-4)
  const dist = new Float32Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) dist[k] = permis[k] ? 1e9 : 0;
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i; if (!permis[k]) continue; dist[k] = Math.min(dist[k], dist[k - 1] + 1, dist[k - nx] + 1, dist[k - nx - 1] + 1.4, dist[k - nx + 1] + 1.4); }
  for (let j = ny - 2; j > 0; j--) for (let i = nx - 2; i > 0; i--) { const k = j * nx + i; if (!permis[k]) continue; dist[k] = Math.min(dist[k], dist[k + 1] + 1, dist[k + nx] + 1, dist[k + nx + 1] + 1.4, dist[k + nx - 1] + 1.4); }
  // étiquette de rainure par case
  const comps = formes(G), etiquette = new Int32Array(nx * ny).fill(-1);
  comps.forEach((f, c) => { const t = tramer(f, x0, y0, pas, nx, ny); for (let k = 0; k < t.length; k++) if (t[k]) etiquette[k] = c; });
  const parent = comps.map((_, i) => i), racine = (i) => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
  // les rainures déjà reliées (passages droits) forment déjà une seule composante de G : rien à faire de plus
  const chemins = [];
  const voisins = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  for (let essai = 0; essai < comps.length; essai++) {
    const groupes = new Set(comps.map((_, i) => racine(i)));
    if (groupes.size <= 1) break;
    // Dijkstra depuis le groupe de la composante 0 jusqu'à n'importe quelle autre
    const g0 = racine(0), cout = new Float64Array(nx * ny).fill(Infinity), prec = new Int32Array(nx * ny).fill(-1);
    const tas = [];
    const pousser = (k, c) => { tas.push([c, k]); let i = tas.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (tas[p][0] <= tas[i][0]) break; [tas[p], tas[i]] = [tas[i], tas[p]]; i = p; } };
    const tirer = () => { const h = tas[0], fin = tas.pop(); if (tas.length) { tas[0] = fin; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < tas.length && tas[l][0] < tas[m][0]) m = l; if (r < tas.length && tas[r][0] < tas[m][0]) m = r; if (m === i) break; [tas[m], tas[i]] = [tas[i], tas[m]]; i = m; } } return h; };
    for (let k = 0; k < nx * ny; k++) if (etiquette[k] >= 0 && racine(etiquette[k]) === g0) { cout[k] = 0; pousser(k, 0); }
    let arrivee = -1;
    while (tas.length) {
      const [c, k] = tirer(); if (c > cout[k]) continue;
      if (etiquette[k] >= 0 && racine(etiquette[k]) !== g0) { arrivee = k; break; }
      const i = k % nx, j = (k / nx) | 0;
      for (const [di, dj, l] of voisins) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const kk = jj * nx + ii; if (!permis[kk]) continue;
        const nc = c + l * (1 + 3 / (1 + dist[kk]));                      // plus cher près du bord : le passage reste au milieu
        if (nc < cout[kk]) { cout[kk] = nc; prec[kk] = k; pousser(kk, nc); }
      }
    }
    if (arrivee < 0) break;
    parent[racine(etiquette[arrivee])] = g0;
    const pts = []; for (let k = arrivee; k >= 0; k = prec[k]) pts.push({ X: Math.round(x0 + ((k % nx) + 0.5) * pas), Y: Math.round(y0 + (((k / nx) | 0) + 0.5) * pas) });
    if (pts.length >= 2) chemins.push(simplifier(pts, 0.8 * E));             // le chemin suit la grille de 1 mm : on le lisse
  }
  const restants = new Set(comps.map((_, i) => racine(i))).size - 1;
  return { chemins, restants };
}

/**
 * Tracés (en mm) → pièces. Dans un même objet (tracé transparent), les sous-tracés se combinent en pair-impair : les
 * intérieurs des lettres sont des trous. Des objets distincts qui se chevauchent (feuilles d'un rameau dessinées l'une sur
 * l'autre) sont réunis : la CNC découpe une seule pièce. Les tracés ouverts sont signalés dans `doutes`.
 */
function piecesDe(traces, doutes, motifOuverts = "tracé(s) de découpe ouvert(s), ignoré(s)") {
  const parObjet = new Map();
  traces.forEach((c, i) => { if (!c.ferme || c.pts.length < 3) return; const k = c.objet ?? i; if (!parObjet.has(k)) parObjet.set(k, []); parObjet.get(k).push(versC(c.pts)); });
  const fermes = [];
  for (const anneaux of parObjet.values()) fermes.push(...combinerObjet(anneaux));
  const ouverts = traces.filter((c) => !c.ferme);
  if (ouverts.length && doutes) doutes.push({ motif: `${ouverts.length} ${motifOuverts}`, boite: boiteMm(ouverts.map((c) => versC(c.pts)), 10) });
  return formes(union(fermes)).filter((f) => aire(f) > 20);
}

/** cercle (Clipper) de centre (x, y) et de rayon r, en mm */
function cercleC(x, y, r) {
  const out = [], n = 64;
  for (let a = 0; a < n; a++) out.push({ X: Math.round((x + Math.cos(2 * Math.PI * a / n) * r) * E), Y: Math.round((y + Math.sin(2 * Math.PI * a / n) * r) * E) });
  return out;
}

/**
 * Finalisation d'un fichier (après retouche éventuelle à la main) : D = { coupe, rainure (tracés, comme coupe, rainure
 * ENTIÈRE), entretoises: [{ x, y, d }] } en mm.
 *  - là où une entretoise touche la rainure (lettre fine, entretoise en bout), la rainure s'arrête 1 mm avant l'entretoise ;
 *  - ne signale que ce qui BLOQUE la fabrication : entretoise hors de la lettre, entretoise qui couperait la rainure en deux,
 *    pièce sans entretoise.
 * Renvoie la rainure finale (mêmes formes que calculerRetro) et les doutes.
 */
export function finaliserRetro(D, parametres = {}) {
  const P = { ...PARAMETRES_RETRO, ...parametres };
  const t0 = Date.now();
  const doutes = [];
  const pieces = piecesDe(D.coupe, doutes);
  const boites = pieces.map((f) => boite(f));
  const chevauche = (a, b) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
  let G = union(piecesDe(D.rainure || [], null).flat());
  const parPiece = pieces.map(() => 0);
  let horsLettre = 0, coupees = 0, ecourtees = 0;
  for (const e of D.entretoises || []) {
    const r = (e.d || P.diametre) / 2, c = [cercleC(e.x, e.y, r)], b = boiteMm(c, 3), A = Math.abs(aire(c));
    const bc = boite(c), proches = pieces.filter((f, i) => chevauche(boites[i], bc)).flat();
    const dans = Math.abs(aire(inter(c, proches)));
    if (dans < A * 0.98) { horsLettre++; doutes.push({ motif: dans < A * 0.02 ? "entretoise dans le vide (hors de toute lettre)" : "entretoise qui déborde de la lettre", boite: b }); continue; }
    const pt = { X: Math.round(e.x * E), Y: Math.round(e.y * E) };
    const ip = pieces.findIndex((f) => dedans(pt, f));
    if (ip >= 0) parPiece[ip]++;
    const marge = [cercleC(e.x, e.y, r + 1)];
    // seulement le morceau de rainure qui touche l'entretoise (le reste du fichier n'est pas concerné)
    const bm = boite(marge), touche = G.length && chevauche(boite(G), bm) ? formes(G).filter((f) => chevauche(boite(f), bm)) : [];
    const local = touche.flat();
    if (local.length && Math.abs(aire(inter(marge, local))) > 0.05) {
      const G2l = ouverture(diff(local, marge), rayonOutil(P));
      const G2 = union(diff(G, local), G2l);
      if (formes(G2l).length > touche.length) { coupees++; doutes.push({ motif: "entretoise qui couperait la rainure en deux (à déplacer en bout de jambage)", boite: b }); continue; }
      G = G2; ecourtees++;
    }
  }
  pieces.forEach((f, i) => { if (!parPiece[i]) doutes.push({ motif: "pièce sans entretoise", boite: boiteMm(f, 5) }); });
  const sansEntretoise = parPiece.filter((n) => !n).length;
  return {
    rainure: formes(G).map((f) => f.map(versMm)),
    etroit: zonesEtroites(G, P.rainureMin).map((f) => f.map(versMm)),
    doutes,
    stats: { pieces: pieces.length, entretoises: (D.entretoises || []).length, ecourtees, horsLettre, coupees, sansEntretoise, secondes: +((Date.now() - t0) / 1000).toFixed(1) },
  };
}

/**
 * Rainure ADAPTATIVE (idée de Jordan, 17/11/2026) dans I (l'intérieur des bordures) :
 *  - là où le jambage laisse la place à DEUX rainures de `rainureMax` le long des bords ET à une entretoise entre elles
 *    (demi-largeur de I ≥ rainureMax + rayon + garde), deux bandes de `rainureMax` le long des bords, comme avant ;
 *  - ailleurs, UNE rainure centrée dans le jambage, aussi large que la place le permet, au plus `rainureMax` :
 *    elle se rétrécit en continu (10, 9,9 … 6 … ) jusqu'à `rainureCable` (passage de câble), au lieu de disparaître.
 * « Place disponible » en un point = rayon h du plus grand cercle contenu dans I qui couvre ce point (épaisseur locale) ;
 * la rainure centrée y est l'ensemble des points à au moins h − rainureMax/2 du bord de I. Calculé par paliers de
 * `pasAdaptatif` mm : S(e) = points à ≥ e du bord de I, O(r) = points couverts par un cercle de rayon r contenu dans I ;
 * rainure centrée = ∪ S(e) ∖ O(e + rainureMax/2).
 */
function rainureAdaptative(I, P, piece) {
  if (!I.length) return [];
  const demi = P.rainureMax / 2, H = P.rainureMax + P.diametre / 2 + P.garde, pas = P.pasAdaptatif;
  const S = new Map(), cle = (e) => Math.round(e / pas);
  const niveau = (e) => { const k = cle(e); if (!S.has(k)) S.set(k, k === 0 ? I : decale(I, -k * pas)); return S.get(k); };
  const O = (r) => { const s = niveau(r); return s.length ? decale(s, r) : []; };
  // parties larges : deux bandes le long des bords
  const large = O(H);
  const bandes = large.length ? inter(large, diff(I, niveau(P.rainureMax))) : [];
  // parties étroites : une rainure CENTRÉE. On relève la ligne médiane du trait (points au milieu de l'épaisseur : à au
  // moins h − δ du bord, h = demi-épaisseur locale), puis la rainure = cette ligne élargie de rainureMax/2 de chaque côté,
  // rognée par la bordure. Ses bords sont donc des parallèles à la ligne médiane, ou le décalage du contour de la lettre là
  // où le trait est plus étroit que rainureMax : aucun bord « dessiné à main levée » (Jordan, 17/11/2026).
  const delta = P.deltaMediane;
  let mediane = [];
  for (let k = 0; k * pas <= H - delta + 1e-9; k++) {
    const e = k * pas, Se = niveau(e);
    if (!Se.length) break;
    const m = diff(Se, O(e + delta));
    if (m.length) mediane = mediane.concat(m);
  }
  mediane = formes(union(mediane));
  // dans une pièce qui a des parties larges, les petits bouts de médiane ne sont que des pointes d'angle (le cercle de
  // rayon H n'y entre pas) : on les laisse, sinon ils feraient des ergots
  if (bandes.length) mediane = mediane.filter((f) => aire(f) > 2 * delta * P.longueurFil);
  let etroit = mediane.length ? inter(decale(mediane.flat(), demi - delta), I) : [];
  if (bandes.length && etroit.length) etroit = diff(etroit, large);            // les parties larges ont leurs deux bandes
  let G = union(bandes.concat(etroit));
  // lissage : les paliers de calcul laissent de petits crans ; une fermeture (décalage +r puis −r) les comble et raccorde
  // les bandes des parties larges à la rainure centrée, sans jamais sortir de I
  G = lisser(G, I, P);
  // traits plus fins que 2 × bordure + rainureCable (barre du e, épaule du n…) : la rainure continue quand même, au milieu
  // du trait, de la largeur que permet une bordure réduite jusqu'à `bordureMin` (au plus rainureCable : passage de câble).
  // On ne garde que les vrais traits (assez longs), pas les pointes d'angle.
  if (piece && P.bordureMin < P.bordure) {
    const J = decale(piece, -P.bordureMin);
    if (J.length) {
      const SJ = new Map();
      const nJ = (e) => { const k = Math.round(e / pas); if (!SJ.has(k)) SJ.set(k, k === 0 ? J : decale(J, -k * pas)); return SJ.get(k); };
      const OJ = (r) => { const s = nJ(r); return s.length ? decale(s, r) : []; };
      const dc = P.rainureCable / 2, emax = P.bordure - P.bordureMin + dc;
      // même principe : ligne médiane du trait, élargie à rainureCable
      const dj = Math.min(delta, dc / 2);
      let fil = [];
      for (let k = 0; k * pas <= emax + 1e-9; k++) {
        const e = k * pas, Se = nJ(e);
        if (!Se.length) break;
        const m = diff(Se, OJ(e + dj));
        if (m.length) fil = fil.concat(m);
      }
      fil = fil.length ? inter(decale(union(fil), dc - dj), J) : [];
      // (les morceaux gardés sont reliés au reste de la rainure par l'étape des liaisons, comme les intérieurs des O)
      fil = diff(union(fil), decale(G, 0.3));
      const longs = formes(ouverture(fil, dc * 0.9)).filter((f) => aire(f) > P.longueurFil * P.rainureCable).flat();
      if (longs.length) {
        // chaque prolongement est raccordé à la rainure par SES DEUX BOUTS (barre du e : d'un jambage à l'autre), par un
        // passage droit de la même largeur, s'il reste dans la bordure réduite
        const base = jalons(G, 1), ajouts = [];
        for (const f of formes(longs)) {
          const pts = jalons(f, 0.5);
          const loin = (a) => pts.reduce((m, q) => ((q.X - a.X) ** 2 + (q.Y - a.Y) ** 2 > (m.X - a.X) ** 2 + (m.Y - a.Y) ** 2 ? q : m), pts[0]);
          const b1 = loin(pts[0]), b2 = loin(b1);
          for (const bout of [b1, b2]) {
            let best = Infinity, cible = null;
            for (const q of base) { const d = (q.X - bout.X) ** 2 + (q.Y - bout.Y) ** 2; if (d < best) { best = d; cible = q; } }
            if (!cible || Math.sqrt(best) > P.raccordMax * E) continue;
            const passage = decale([[bout, cible]], P.rainureCable / 2, CL.EndType.etOpenRound);
            if (aire(diff(passage, J)) < 0.05) ajouts.push(...passage);
          }
        }
        G = union(G, longs.concat(ajouts));
        // raccords lissés : fermeture puis ouverture légères, dans la bordure réduite
        G = lisser(G, J, P);
      }
    }
  }
  return G;
}

/**
 * Lissage de la rainure adaptative (« ça doit faire ultra propre, comme un décalage de contour », Jordan) :
 * fermeture (comble les crans), puis ouverture de rayon `lissage` (arrondit les bosses et les angles) ; les parties plus
 * fines que 2 × lissage, que l'ouverture ferait disparaître, sont gardées telles quelles (sauf les miettes d'angle).
 */
function lisser(G, dans, P) {
  const r = P.lissage;
  const ferme = inter(decale(decale(G, r), -r), dans);
  const ouvert = ouverture(ferme, r);
  const fins = formes(diff(ferme, ouvert)).filter((f) => aire(f) > P.miette).flat();
  return ouverture(union(ouvert, fins), P.rainureCable * 0.45);
}

/**
 * Adoucit chaque contour : rééchantillonné tous les 0,25 mm, puis moyenne glissante gaussienne (écart-type `sigma` mm) le
 * long du contour. Les petites ondulations du calcul par paliers disparaissent ; les lignes droites et les grandes courbes
 * ne bougent pas (une moyenne de points alignés reste sur la ligne). Les angles s'arrondissent d'environ `sigma`.
 */
function adoucir(paths, sigma) {
  const pas = 0.25 * E, rayon = Math.ceil((3 * sigma * E) / pas);
  const poids = []; let somme = 0;
  for (let k = -rayon; k <= rayon; k++) { const w = Math.exp(-0.5 * ((k * pas) / (sigma * E)) ** 2); poids.push(w); somme += w; }
  const sortie = [];
  for (const anneau of paths) {
    // rééchantillonnage régulier
    const pts = [];
    for (let i = 0; i < anneau.length; i++) {
      const a = anneau[i], b = anneau[(i + 1) % anneau.length], L = Math.hypot(b.X - a.X, b.Y - a.Y), n = Math.max(1, Math.ceil(L / pas));
      for (let k = 0; k < n; k++) pts.push([a.X + ((b.X - a.X) * k) / n, a.Y + ((b.Y - a.Y) * k) / n]);
    }
    const n = pts.length;
    if (n < 2 * rayon + 3) { sortie.push(anneau); continue; }                 // trop petit pour être adouci : tel quel
    const lisse = [];
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0;
      for (let k = -rayon; k <= rayon; k++) { const q = pts[(((i + k) % n) + n) % n], w = poids[k + rayon]; x += q[0] * w; y += q[1] * w; }
      lisse.push({ X: Math.round(x / somme), Y: Math.round(y / somme) });
    }
    sortie.push(simplifierFerme(lisse, 0.01 * E));
  }
  return union(sortie);
}
/** Douglas-Peucker sur un contour fermé (coupé en deux au point le plus éloigné du premier) */
function simplifierFerme(pts, tol) {
  let loin = 0, dmax = -1;
  for (let i = 1; i < pts.length; i++) { const d = (pts[i].X - pts[0].X) ** 2 + (pts[i].Y - pts[0].Y) ** 2; if (d > dmax) { dmax = d; loin = i; } }
  const a = simplifier(pts.slice(0, loin + 1), tol), b = simplifier(pts.slice(loin).concat([pts[0]]), tol);
  return a.concat(b.slice(1, -1));
}

/** rayon d'arrondi imposé à la rainure : celui de la fraise, ou en adaptatif celui de la rainure la plus fine permise */
// (× 0,9 en adaptatif : la rainure la plus fine fait JUSTE rainureCable ; avec le rayon exact, un arrondi de calcul de
//  quelques µm la ferait disparaître par endroits — et une entretoise en bout passerait pour « coupant la rainure en deux »)
const rayonOutil = (P) => (P.adaptative ? P.rainureCable * 0.9 : P.fraise) / 2;

/** Zones de la rainure plus étroites que `seuil` mm (le ruban LED n'y passe pas) : à mettre en surbrillance. */
function zonesEtroites(G, seuil) {
  if (!G.length) return [];
  return formes(ouverture(diff(G, ouverture(G, seuil / 2)), 0.2)).filter((f) => aire(f) > 3);
}

/** Douglas-Peucker : polyligne simplifiée à `tol` près (unités Clipper) */
function simplifier(pts, tol) {
  if (pts.length < 3) return pts;
  const garde = new Uint8Array(pts.length); garde[0] = garde[pts.length - 1] = 1;
  const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop(), A = pts[a], B = pts[b], L = Math.hypot(B.X - A.X, B.Y - A.Y) || 1;
    let pire = 0, ip = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((B.X - A.X) * (A.Y - pts[i].Y) - (A.X - pts[i].X) * (B.Y - A.Y)) / L; if (d > pire) { pire = d; ip = i; } }
    if (pire > tol) { garde[ip] = 1; pile.push([a, ip], [ip, b]); }
  }
  return pts.filter((_, i) => garde[i]);
}

/** Calcule rainure, liaisons et entretoises. `surProgression` (facultatif) reçoit l'avancement, de 0 à 1. */
export function calculerRetro(D, parametres = {}, surProgression?) {
  const P = { ...PARAMETRES_RETRO, ...parametres };
  const t0 = Date.now();
  const res = { parametres: P, rainure: [], etroit: [], liaisons: [], entretoises: [], doutes: [], pieces: [], stats: null };

  // 1. les pièces
  const pieces = piecesDe(D.coupe, res.doutes);

  let nRainures = 0, nLiaisons = 0, nCables = 0;
  pieces.forEach((piece, ip) => {
    if (surProgression) surProgression(ip / pieces.length);
    const I = decale(piece, -P.bordure);                                     // intérieur de la bordure
    // 2. rainure
    let G = P.adaptative ? rainureAdaptative(I, P, piece) : ouverture(diff(I, decale(piece, -(P.bordure + P.rainureMax))), P.rainureMin / 2);
    // 3. liaisons : toutes les rainures d'une même pièce reliées par le plus court chemin
    let composantes = formes(G);
    const liaisonsPiece = [];
    let nonRelies = 0;
    if (composantes.length > 1) {
      const jal = composantes.map((f) => jalons([f[0]].concat(f.slice(1)), 1));
      const aretes = [];
      for (let a = 0; a < composantes.length; a++) for (let b = a + 1; b < composantes.length; b++) {
        let best = Infinity, pa = null, pb = null;
        for (const p of jal[a]) for (const q of jal[b]) { const d = (p.X - q.X) ** 2 + (p.Y - q.Y) ** 2; if (d < best) { best = d; pa = p; pb = q; } }
        aretes.push({ a, b, d: Math.sqrt(best), pa, pb });
      }
      aretes.sort((u, v) => u.d - v.d);
      const parent = composantes.map((_, i) => i), racine = (i) => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
      for (const ar of aretes) {
        if (racine(ar.a) === racine(ar.b)) continue;
        // le passage déborde de 2 mm dans chaque rainure pour s'y raccorder franchement
        const L = ar.d || 1, ux = (ar.pb.X - ar.pa.X) / L, uy = (ar.pb.Y - ar.pa.Y) / L, k = 2 * E;
        const seg = [{ X: Math.round(ar.pa.X - ux * k), Y: Math.round(ar.pa.Y - uy * k) }, { X: Math.round(ar.pb.X + ux * k), Y: Math.round(ar.pb.Y + uy * k) }];
        let passage = inter(decale([seg], P.rainureMax / 2, CL.EndType.etOpenRound), I);
        let relie = formes(union(G, passage)).length < formes(G).length;
        // rainure adaptative : sinon un passage droit plus fin (câble), dans la bordure réduite
        if (!relie && P.adaptative) {
          passage = inter(decale([seg], Math.max(P.rainureCable, P.cable) / 2, CL.EndType.etOpenRound), decale(piece, -P.bordureMin));
          relie = formes(union(G, passage)).length < formes(G).length;
        }
        if (!relie) { nonRelies++; continue; }
        parent[racine(ar.a)] = racine(ar.b);
        G = union(G, passage);
        liaisonsPiece.push(versMm(seg));
        nLiaisons++;
      }
      // là où une vraie rainure ne passe pas (tige fine, jambage étroit), on creuse au moins un PASSAGE DE CÂBLE, plus étroit
      // et non lumineux, qui suit la matière au plus court (Jordan, 13/11/2026)
      if (nonRelies) {
        const cables = passagesCable(piece, G, P);
        for (const c of cables.chemins) { G = union(G, decale([c], P.cable / 2, CL.EndType.etOpenRound)); liaisonsPiece.push(versMm(c)); nLiaisons++; nCables++; }
        if (cables.restants) res.doutes.push({ motif: `${cables.restants} rainure(s) impossible(s) à relier, même par un passage de câble`, boite: boiteMm(piece, 5) });
        else res.doutes.push({ motif: `passage de câble (${P.cable} mm, non lumineux) entre certaines rainures de cette pièce`, boite: boiteMm(piece, 5), info: true });
      }
      // rainure adaptative : raccords des liaisons lissés comme le reste
      if (P.adaptative) G = lisser(G, decale(piece, -P.bordureMin), P);
      G = ouverture(G, rayonOutil(P));
    }
    // rainure adaptative : tracé final adouci (aucune ondulation), sans sortir de la bordure réduite
    if (P.adaptative && G.length) G = ouverture(inter(adoucir(G, P.adoucissement), decale(piece, -P.bordureMin)), P.rainureCable * 0.45);
    res.liaisons.push(...liaisonsPiece);
    const enregistrer = () => {
      const cs = formes(G); nRainures += cs.length; for (const f of cs) res.rainure.push(f.map(versMm));
      for (const z of zonesEtroites(G, P.rainureMin)) res.etroit.push(z.map(versMm));
      return cs.length;
    };

    // 4. bord non éclairé : un tronçon du bord de la lettre sans rainure à proximité. (Aux angles vifs, la rainure, arrondie
    //    pour la fraise, s'éloigne un peu de la pointe : c'est normal, on ne le signale pas — d'où la tolérance de rainureMin.)
    const bordLettre = diff(piece, decale(piece, -1.5));
    const eclaire = decale(G, P.bordure + P.rainureMin);
    const sombres = formes(diff(bordLettre, eclaire)).map((z) => ouverture(z, 0.3)).filter((z) => aire(z) > 6);
    for (const z of sombres) res.doutes.push({ motif: `bord non éclairé : la rainure (≥ ${P.rainureMin} mm) ne rentre pas ici`, boite: boiteMm(z, 4), info: true });

    // 5. entretoises sur la matière pleine, CENTRÉES dans l'espace restant entre les rainures (règle atelier du 13/11/2026 :
    //    ainsi elles sont invisibles dans le halo, et le placement est le même à chaque fois)
    const r = P.diametre / 2;
    const matiere = diff(I, G);                                             // matière pleine restante
    const bordMat = jalons(matiere, 0.5);
    // distance au bord de la matière (grille de recherche de 20 mm pour aller vite)
    const casier = new Map(), C = 20 * E;
    for (const q of bordMat) { const k = Math.floor(q.X / C) + ',' + Math.floor(q.Y / C); if (!casier.has(k)) casier.set(k, []); casier.get(k).push(q); }
    const auBord = (pt) => {
      const cx = Math.floor(pt.X / C), cy = Math.floor(pt.Y / C); let best = Infinity, bq = null;
      for (let rr = 0; rr < 30 && (bq === null || (rr - 1) * C < best); rr++)
        for (let i = cx - rr; i <= cx + rr; i++) for (let j = cy - rr; j <= cy + rr; j++) {
          if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== rr) continue;
          for (const q of casier.get(i + ',' + j) || []) { const d = Math.hypot(q.X - pt.X, q.Y - pt.Y); if (d < best) { best = d; bq = q; } }
        }
      return { d: best, q: bq };
    };
    // centre : depuis un point, on s'éloigne pas à pas du bord le PLUS PROCHE (qui change en chemin, dans un angle par exemple),
    // tant que la distance au bord augmente : on s'arrête au milieu de l'épaisseur de matière
    const centrer = (pt) => {
      let cur = pt, { d, q } = auBord(pt);
      for (let k = 0; k < 2000 && q; k++) {
        const L = Math.hypot(cur.X - q.X, cur.Y - q.Y) || 1, pas = 0.25 * E;
        const c = { X: Math.round(cur.X + (cur.X - q.X) / L * pas), Y: Math.round(cur.Y + (cur.Y - q.Y) / L * pas) };
        if (!dedans(c, matiere)) break;
        const n = auBord(c);
        if (n.d <= d + 0.02 * E || n.d > P.profondeurMax * E) break;
        cur = c; d = n.d; q = n.q;
      }
      return cur;
    };
    const pas = Math.max(1.5, Math.min(5, Math.sqrt(Math.abs(aire(piece))) / 40));
    const echantillons = grille(piece, Math.max(3, pas * 1.5)).concat(jalons(piece, 5));
    const [bx0, by0, bx1, by1] = boite(piece), taille = Math.hypot(bx1 - bx0, by1 - by0) / E;
    const minimum = taille < 60 ? 1 : 2;
    const ecart = (taille < 3 * P.ecartMin ? P.diametre * 2 : P.ecartMin) * E;
    const pos = [], modes = [];
    const dMin = new Float64Array(echantillons.length).fill(Infinity);
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    // départ : le point de la pièce le plus loin de son centre (une extrémité, un bout de jambage)
    let cible = echantillons.reduce((m, q) => ((q.X - cx) ** 2 + (q.Y - cy) ** 2 > (m.X - cx) ** 2 + (m.Y - cy) ** 2 ? q : m), echantillons[0]);
    const couvrir = (p) => { let pire = 0, ip2 = 0; for (let i = 0; i < echantillons.length; i++) { const q = echantillons[i], d = Math.hypot(q.X - p.X, q.Y - p.Y); if (d < dMin[i]) dMin[i] = d; if (dMin[i] > pire) { pire = dMin[i]; ip2 = i; } } cible = echantillons[ip2]; return pire; };
    for (const p of pos) couvrir(p);
    /** pose des entretoises parmi les candidats de `zone` jusqu'à couvrir la pièce (et au moins `minimum`) */
    const exclus = [];
    const placer = (zone, mode, maxi = 60) => {
      if (aire(zone) < 0.05) return;
      let candidats = grille(zone, pas);
      if (candidats.length < 20) candidats = candidats.concat(jalons(zone, 1));
      let pire = Infinity;
      for (let garde = 0; garde < maxi; garde++) {
        if (pos.length >= minimum && pire <= P.couverture * E) break;
        let choix = null, dc = Infinity;
        for (const c of candidats) {
          if (pos.some((p) => Math.hypot(p.X - c.X, p.Y - c.Y) < ecart)) continue;
          if (exclus.some((p) => Math.hypot(p.X - c.X, p.Y - c.Y) < P.diametre * 2 * E)) continue;
          const d = (c.X - cible.X) ** 2 + (c.Y - cible.Y) ** 2;
          if (d < dc) { dc = d; choix = c; }
        }
        if (!choix) break;
        if (mode === "centre") { const c = centrer(choix); if (auBord(c).d >= (r + P.garde) * E && !pos.some((p) => Math.hypot(p.X - c.X, p.Y - c.Y) < ecart)) choix = c; }
        pos.push(choix); modes.push(mode);
        pire = couvrir(choix);
      }
    };
    // (1) centrées dans la matière restante entre les rainures
    placer(decale(diff(I, decale(G, P.garde)), -r), "centre");
    // (2) lettre trop fine : EN BOUT de jambage, là où la rainure s'arrête (règle Jordan, 13/11/2026), sur la matière pleine
    if (pos.length < minimum) placer(decale(diff(piece, decale(G, 1)), -(r + 1)), "bout");
    // (3) toujours pas de place : en bout de jambage quand même, et la rainure s'arrête 1 mm avant l'entretoise
    //     — seulement là où ça ÉCOURTE la rainure : une entretoise qui la couperait en deux (haut d'un n) est écartée
    const zoneCoupe = decale(piece, -(r + 1)), cibleDepart = cible;
    // rainure telle que la finalisation l'écourtera (toutes les entretoises « en bout » à la fois : deux coupes qui, chacune
    // seule, n'écourtent qu'un bout pourraient ensemble couper la rainure en deux)
    let Gc = G;
    for (let essai = 0; pos.length < minimum && essai < 25; essai++) {
      const avant = pos.length, sauve = Float64Array.from(dMin);
      placer(zoneCoupe, "coupe", 1);
      if (pos.length === avant) break;
      const p = pos[pos.length - 1], cercle = [];
      for (let a = 0; a < 48; a++) cercle.push({ X: Math.round(p.X + Math.cos(a * Math.PI / 24) * (r + 1) * E), Y: Math.round(p.Y + Math.sin(a * Math.PI / 24) * (r + 1) * E) });
      const G2 = ouverture(diff(Gc, [cercle]), rayonOutil(P));
      if (formes(G2).length > formes(Gc).length) { pos.pop(); modes.pop(); exclus.push(p); dMin.set(sauve); cible = cibleDepart; continue; }
      Gc = G2;
      // (à l'étape « Placer » de l'outil, la rainure reste ENTIÈRE : elle n'est écourtée qu'à la finalisation, une fois les
      //  entretoises déplacées à la main là où l'atelier les veut)
      if (!P.rainureEntiere) G = G2;
    }
    pos.forEach((p, k) => res.entretoises.push({ x: +(p.X / E).toFixed(3), y: +(p.Y / E).toFixed(3), repli: modes[k] !== "centre", mode: modes[k] }));
    if (modes.includes("bout") || modes.includes("coupe")) res.doutes.push({ motif: "lettre fine : entretoise(s) en bout de jambage" + (modes.includes("coupe") ? ", rainure écourtée" : ""), boite: boiteMm(piece, 5), info: true });
    if (pos.length < minimum) res.doutes.push({ motif: pos.length ? `${pos.length} entretoise(s) seulement (${minimum} au moins)` : "aucune place pour une entretoise", boite: boiteMm(piece, 5) });
    const nr = enregistrer();
    res.pieces.push({ boite: boiteMm(piece), entretoises: pos.length, rainures: nr, liaisons: liaisonsPiece.length });
  });
  if (surProgression) surProgression(1);
  res.stats = { pieces: pieces.length, rainures: nRainures, liaisons: nLiaisons, cables: nCables, entretoises: res.entretoises.length, doutes: res.doutes.length, secondes: +((Date.now() - t0) / 1000).toFixed(1) };
  return res;
}

/** pour le banc d'essai uniquement */
export const _interne = { rainureAdaptative, piecesDe, decale, formes, aire, boite, diff, union, ouverture, E };
