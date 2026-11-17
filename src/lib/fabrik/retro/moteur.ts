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
  espacement: 300,     // mm entre deux entretoises le long de la rainure (Jordan, 17/11 : « partons sur 30 cm »)
  largeurMilieu: 500,  // mm : au-delà de cette largeur de surface, des entretoises aussi au milieu
  equilibre: 2,
  bonusBout: 20,
  mietteRainure: 30,   // mm² : un bout de rainure plus petit, détaché par une entretoise, est supprimé (rainure raccourcie)       // mm « offerts » à une entretoise posée au bout d'un trait (lettre fine)        // poids de l'équilibre (ligne entre les deux entretoises d'une lettre fine passant près de son centre)
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
function piecesDe(traces, doutes, motifOuverts = "tracé(s) de découpe ouvert(s), ignoré(s)", aireMin = 20) {
  const parObjet = new Map();
  traces.forEach((c, i) => { if (!c.ferme || c.pts.length < 3) return; const k = c.objet ?? i; if (!parObjet.has(k)) parObjet.set(k, []); parObjet.get(k).push(versC(c.pts)); });
  const fermes = [];
  for (const anneaux of parObjet.values()) fermes.push(...combinerObjet(anneaux));
  const ouverts = traces.filter((c) => !c.ferme);
  if (ouverts.length && doutes) doutes.push({ motif: `${ouverts.length} ${motifOuverts}`, boite: boiteMm(ouverts.map((c) => versC(c.pts)), 10) });
  return formes(union(fermes)).filter((f) => aire(f) > aireMin);
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
  // (aucun seuil de surface pour la rainure : une toute petite rainure — feuille d'un rameau — ne doit pas disparaître)
  let G = union(piecesDe(D.rainure || [], null, undefined, 0.5).flat());
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
      const centre = { X: Math.round(e.x * E), Y: Math.round(e.y * E) };
      const G2 = union(diff(G, local), couperRainure(local, centre, P));
      // qui couperait la rainure en deux (milieu du trait d'une lettre fine) : la rainure n'est PAS coupée — pas de LED à cet
      // endroit, le câble passe (Jordan, 17/11/2026)
      // ne doit JAMAIS isoler un morceau de rainure (Jordan, 17/11/2026) : au bout, ou sur le côté pour que le câble passe
      if (coupeLaRainure(local, centre, P)) { coupees++; doutes.push({ motif: "entretoise qui coupe la rainure : à mettre au bout, ou sur le côté pour que le câble passe", boite: b }); continue; }
      G = G2; ecourtees++;
    }
  }
  pieces.forEach((f, i) => { if (!parPiece[i]) doutes.push({ motif: "pièce sans entretoise", boite: boiteMm(f, 5) }); });
  const sansEntretoise = parPiece.filter((n) => !n).length;
  return {
    rainure: formes(G).map((f) => f.map((r) => versMm(allege(r)))),
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
/** contour envoyé à Illustrator : points superflus retirés (écart ≤ 0,01 mm), pour des tracés légers */
const allege = (r) => (r.length > 16 ? simplifierFerme(r, 0.01 * E) : r);
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

/** centre de gravité d'une pièce (contour + trous) */
function centreDe(piece) {
  let A = 0, cx = 0, cy = 0;
  for (const r of piece) for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], k = a.X * b.Y - b.X * a.Y;
    A += k; cx += (a.X + b.X) * k; cy += (a.Y + b.Y) * k;
  }
  return A ? { X: cx / (3 * A), Y: cy / (3 * A) } : { X: 0, Y: 0 };
}
const distSegment = (p, a, b) => {
  const dx = b.X - a.X, dy = b.Y - a.Y, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / L2)) : 0;
  return Math.hypot(p.X - (a.X + t * dx), p.Y - (a.Y + t * dy));
};
/** parties de polylignes (ouvertes) contenues dans une zone */
function couperLignes(lignes, zone) {
  if (!lignes.length || !zone.length) return [];
  const c = new CL.Clipper(), arbre = new CL.PolyTree();
  for (const l of lignes) c.AddPath(l, CL.PolyType.ptSubject, false);
  c.AddPaths(zone, CL.PolyType.ptClip, true);
  c.Execute(CL.ClipType.ctIntersection, arbre, NZ, NZ);
  return CL.Clipper.OpenPathsFromPolyTree(arbre);
}
const longueur = (l) => { let L = 0; for (let i = 1; i < l.length; i++) L += Math.hypot(l[i].X - l[i - 1].X, l[i].Y - l[i - 1].Y); return L; };
/** point à l'abscisse curviligne `t` d'une polyligne */
function pointA(l, t) {
  for (let i = 1; i < l.length; i++) {
    const L = Math.hypot(l[i].X - l[i - 1].X, l[i].Y - l[i - 1].Y);
    if (t <= L || i === l.length - 1) { const u = L ? Math.min(1, t / L) : 0; return { X: Math.round(l[i - 1].X + (l[i].X - l[i - 1].X) * u), Y: Math.round(l[i - 1].Y + (l[i].Y - l[i - 1].Y) * u) }; }
    t -= L;
  }
  return l[l.length - 1];
}

/** distance (unités Clipper) au bord d'une zone, par points du bord tous les `pas` mm rangés dans une grille */
function distanceAuBord(paths, pas) {
  const C = 5 * E, casier = new Map();
  for (const q of jalons(paths, pas)) { const k = Math.floor(q.X / C) + "," + Math.floor(q.Y / C); if (!casier.has(k)) casier.set(k, []); casier.get(k).push(q); }
  return (x, y) => {
    const cx = Math.floor(x / C), cy = Math.floor(y / C); let best = Infinity;
    for (let rr = 0; rr < 60 && (best === Infinity || (rr - 1) * C < best); rr++)
      for (let i = cx - rr; i <= cx + rr; i++) for (let j = cy - rr; j <= cy + rr; j++) {
        if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== rr) continue;
        for (const q of casier.get(i + "," + j) || []) { const d = Math.hypot(q.X - x, q.Y - y); if (d < best) best = d; }
      }
    return best;
  };
}
/**
 * « Crête » d'une zone : points d'une grille de `pas` mm plus loin du bord que leurs deux voisins dans au moins une
 * direction — c'est l'axe des traits, continu aux jonctions (bas d'un v).
 */
function crete(paths, pas) {
  const dB = distanceAuBord(paths, Math.min(0.5, pas / 2)), s0 = pas * E, [x0, y0, x1, y1] = boite(paths);
  const nx = Math.ceil((x1 - x0) / s0) + 3, ny = Math.ceil((y1 - y0) / s0) + 3, ox = x0 - s0, oy = y0 - s0;
  const dist = new Float64Array(nx * ny).fill(-1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = ox + i * s0, y = oy + j * s0;
    if (dedans({ X: x, Y: y }, paths)) dist[j * nx + i] = dB(x, y);
  }
  const out = [], garde = new Uint8Array(nx * ny);
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const k = j * nx + i, d = dist[k];
    if (d <= 0) continue;
    // une vraie crête descend des deux côtés (marge de 0,2 pas : les petites ondulations du contour ne font pas de crête)
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const a1 = dist[k - dj * nx - di], a2 = dist[k + dj * nx + di], m = 0.2 * s0 * Math.hypot(di, dj);
      if (a1 >= 0 && a2 >= 0 && d >= a1 + m * 0.25 && d >= a2 + m * 0.25 && d - a1 + d - a2 > m) { garde[k] = 1; break; }
    }
  }
  // ébarbage : les petites branches (vers les angles du contour, bruit de calcul) sont retirées par le bout, 6 fois
  for (let passe = 0; passe < 6; passe++) {
    const retirer = [];
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i; if (!garde[k]) continue;
      let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && garde[k + dj * nx + di]) n++;
      if (n <= 1) retirer.push(k);
    }
    if (!retirer.length) break;
    for (const k of retirer) garde[k] = 0;
  }
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) if (garde[j * nx + i]) out.push({ X: Math.round(ox + i * s0), Y: Math.round(oy + j * s0) });
  return out;
}
/** rainure coupée par une entretoise en c (marge de 1 mm), sans les miettes : un bout raccourci ne laisse pas de morceau */
function couperRainure(G, c, P, rayon = rayonOutil(P)) {
  const marge = [cercleC(c.X / E, c.Y / E, P.diametre / 2 + 1)];
  if (Math.abs(aire(inter(marge, G))) < 0.05) return G;
  // chaque rainure touchée : on garde son plus grand morceau ; un petit bout détaché AU-DELÀ de l'entretoise (pointe d'une
  // queue de e) est supprimé — la rainure est raccourcie, sans morceau isolé. Deux grands morceaux = rainure coupée en deux.
  const sortie = [];
  for (const f of formes(G)) {
    const morceaux = formes(ouverture(diff(f, marge), rayon)).sort((a, b) => aire(b) - aire(a));
    if (!morceaux.length) continue;
    // (la coupe n'est faite qu'après le test « coupeLaRainure » : un seul vrai morceau reste ; tout autre bout, même de plus
    //  de 30 mm², est une pointe détachée au-delà de l'entretoise → supprimée, jamais laissée flottante)
    sortie.push(morceaux[0]);
  }
  return sortie.flat();
}
/** vrai si une entretoise en c couperait la rainure en morceaux (le câble — `cable` mm — ne passerait plus) */
function coupeLaRainure(G, c, P, surplus = 0) {
  // Test MONOTONE (une entretoise plus grosse ne peut jamais « couper moins ») : on retire de la rainure le cercle de
  // l'entretoise ÉLARGI de la largeur du câble ; si la rainure reste d'un seul tenant, il reste à côté de l'entretoise un
  // passage d'au moins `cable` mm. Au bout d'une rainure, ça ne fait que la raccourcir.
  // (surplus : marge de sécurité de Placer, Finaliser vérifie sans)
  const r = P.diametre / 2 + 1, grand = [cercleC(c.X / E, c.Y / E, r + P.cable + surplus)], petit = [cercleC(c.X / E, c.Y / E, r)];
  const bm = boite(grand);
  const touche = formes(G).filter((f) => { const b = boite(f); return !(b[2] < bm[0] || bm[2] < b[0] || b[3] < bm[1] || bm[3] < b[1]); });
  if (!touche.length || Math.abs(aire(inter(petit, touche.flat()))) < 0.05) return false;   // l'entretoise ne touche pas la rainure
  const morceaux = (g) => formes(g).filter((m) => aire(m) > P.mietteRainure);
  const trous = (l) => l.reduce((t, m) => t + m.length - 1, 0);
  for (const f of touche) {
    if (Math.abs(aire(inter(petit, f))) < 0.05) continue;
    const avant = morceaux(f), apres = morceaux(diff(f, grand));
    if (apres.length > avant.length) return true;                          // coupée en deux (le câble ne passe pas)
    if (trous(apres) < trous(avant)) return true;                          // boucle ouverte (e, o, a) : interdit aussi
    // (presque) effacée : une petite rainure (point d'un i) ne doit pas perdre plus de la moitié de sa lumière
    const A = Math.abs(aire(f)), reste = Math.abs(aire(diff(f, petit)));
    if (reste < 0.5 * A && A < 4 * P.mietteRainure) return true;
    if (reste < 0.05 * A) return true;
  }
  return false;
}

/**
 * Entretoises d'une pièce (règles de Jordan, 17/11/2026) :
 *  - « bord » : là où il y a la place, LE LONG DE LA RAINURE, côté intérieur, à `profondeurMax` mm d'elle, tous les
 *    `espacement` mm (environ) — rien au milieu de la surface ;
 *  - « milieu » : seulement si la surface est plus large que `largeurMilieu`, des entretoises en plus au milieu, à
 *    `espacement` mm les unes des autres ;
 *  - « trait » : lettre fine (pas la place le long de la rainure) : DEUX entretoises au milieu du trait (une pour un point
 *    ou une très petite pièce), aussi loin l'une de l'autre que possible, la ligne qui les relie passant près du centre de la
 *    lettre (sinon elle porte mal : sur un c, pas les deux bouts du même côté). Au besoin sur la rainure : pas de LED à cet
 *    endroit, le câble passe (« on fait comme on peut »).
 */
function placerEntretoises(piece, G, P) {
  const r = P.diametre / 2;
  const [bx0, by0, bx1, by1] = boite(piece), taille = Math.hypot(bx1 - bx0, by1 - by0) / E;
  const minimum = taille < 60 ? 1 : 2;
  const pos = [], modes = [];
  const ecart = Math.max(P.diametre * 2, Math.min(P.ecartMin, taille / 4)) * E;
  const libre = (c) => !pos.some((p) => Math.hypot(p.X - c.X, p.Y - c.Y) < ecart);
  const ajouter = (c, mode) => { if (libre(c)) { pos.push(c); modes.push(mode); return true; } return false; };
  // centres possibles sur la matière pleine : cercle entier dans la lettre, à `garde` mm au moins de la rainure
  const plein = diff(decale(piece, -(r + 0.5)), G.length ? decale(G, P.garde + r) : []);

  // (1) le long de la rainure, côté intérieur
  if (G.length && plein.length) {
    const d = Math.max(P.garde + r, P.profondeurMax);
    const lignes = couperLignes(decale(G, d).map((a) => a.concat([a[0]])), plein).filter((l) => longueur(l) > 10 * E);
    lignes.sort((u, v) => longueur(v) - longueur(u));                      // la plus grande boucle d'abord (contour de la lettre)
    for (const l of lignes) {
      const L = longueur(l), boucle = Math.hypot(l[0].X - l[l.length - 1].X, l[0].Y - l[l.length - 1].Y) < 1 * E;
      if (boucle) {
        // boucle : nombre pair (symétrie), départ au point le plus à gauche (une entretoise à chaque bout d'une forme allongée)
        // petite boucle (intérieur d'un o, d'un p) : rien si la lettre a déjà ses entretoises (trop serré sinon)
        const n = 2 * Math.round(L / (2 * P.espacement * E)) || (pos.length ? 0 : 2);
        let i0 = 0; for (let i = 1; i < l.length; i++) if (l[i].X < l[i0].X) i0 = i;
        const tour = l.slice(i0, l.length - 1).concat(l.slice(0, i0 + 1));
        for (let k = 0; k < n; k++) ajouter(pointA(tour, (k * L) / n), "bord");
      } else {
        const n = Math.max(1, Math.round(L / (P.espacement * E)));
        for (let k = 0; k < n; k++) ajouter(pointA(l, ((k + 0.5) * L) / n), "bord");
      }
    }
  }
  // (2) au milieu, seulement pour une surface vraiment large
  if (pos.length && plein.length && decale(piece, -P.largeurMilieu / 2).length) {
    const coeur = decale(plein, -P.espacement / 2);
    for (const c of grille(coeur, P.espacement / 3)) {
      if (!pos.some((p) => Math.hypot(p.X - c.X, p.Y - c.Y) < P.espacement * E)) { pos.push(c); modes.push("milieu"); }
    }
  }
  if (pos.length >= minimum) return { pos, modes, minimum };

  // (3) lettre fine — règle tirée du placement à la main de Jordan sur « Services » (17/11/2026) :
  //   • UNE ENTRETOISE PAR PIED : chaque bout de rainure dans le bas de la lettre (bas du r, du i, queue du e, bas du c, les
  //     deux pieds du n…), centrée sur le bout de la rainure (il ne reste rien de la rainure au-delà) ;
  //   • PLUS UNE D'ÉQUILIBRE si la lettre n'a pas trois pieds : celle qui fait le mieux porter la lettre (haut du S, du i,
  //     bout du bras du r, haut du n ; pour le c et le e : le côté gauche à mi-hauteur, posée sur le côté pour que le câble passe) ;
  //   • jamais une entretoise qui coupe la rainure ou ouvre une boucle (sinon elle est décalée sur le côté, ou écartée).
  pos.length = 0; modes.length = 0;
  const centre = centreDe(piece);
  const dPiece = distanceAuBord(piece, 0.5);
  const tient = (q) => dPiece(q.X, q.Y) >= (r + 0.5) * E;
  const axe0 = (G.length ? crete(G, 0.5) : []).filter(tient);
  const axe = axe0.length ? axe0 : crete(piece, 0.5).filter(tient);
  if (!axe.length) return { pos, modes, minimum };
  let garde = []; for (const q of axe) if (!garde.some((g) => Math.abs(g.X - q.X) + Math.abs(g.Y - q.Y) < 1.5 * E)) garde.push(q);
  { const g2 = garde.filter((q) => garde.filter((v) => v !== q && Math.hypot(v.X - q.X, v.Y - q.Y) < 3.5 * E).length >= 2); if (g2.length) garde = g2; }
  // bouts de l'axe : voisins tous du même côté ; un seul représentant par bout (le plus avancé)
  const R = 6 * E, bouts = [];
  for (const q of garde) {
    let sx = 0, sy = 0, n = 0;
    for (const v of garde) { const d = Math.hypot(v.X - q.X, v.Y - q.Y); if (d > 0 && d < R) { sx += v.X - q.X; sy += v.Y - q.Y; n++; } }
    if (n < 3) continue;
    const m = Math.hypot(sx / n, sy / n);
    if (m > 0.35 * R) bouts.push({ q, avance: m });
  }
  const tetes = [];
  for (const b of bouts.sort((u, v) => v.avance - u.avance)) if (!tetes.some((t) => Math.hypot(t.X - b.q.X, t.Y - b.q.Y) < 8 * E)) tetes.push(b.q);
  if (P.debug) P.debug.push({ garde, tetes, centre });
  const [, py0, , py1] = boite(piece);
  const bas = (q) => q.Y > centre.Y + 0.1 * (py1 - py0);
  let Gc = G;
  const valider = (c) => {
    const sur = 0.5;
    if (!Gc.length || !coupeLaRainure(Gc, c, P, sur)) return c;
    for (let d = 1; d <= 10; d++) for (let a = 0; a < 16; a++) {
      const q = { X: Math.round(c.X + Math.cos((a * Math.PI) / 8) * d * E), Y: Math.round(c.Y + Math.sin((a * Math.PI) / 8) * d * E) };
      if (tient(q) && !coupeLaRainure(Gc, q, P, sur)) return q;
    }
    return null;
  };
  const poser = (q) => { pos.push(q); modes.push("trait"); if (Gc.length) Gc = couperRainure(Gc, q, P); };
  const proche = (q, l, d) => l.some((p) => Math.hypot(p.X - q.X, p.Y - q.Y) < d * E);

  if (minimum === 1) {
    // une seule (point du i, petite pièce) : un bout de rainure s'il y en a, sinon le côté droit (schéma de Jordan)
    const ordre = tetes.length ? tetes : garde.slice().sort((a, b) => b.X - a.X);
    for (const q of ordre) { const v = valider(q); if (v) { poser(v); break; } }
    return { pos, modes, minimum };
  }
  // pieds : les bouts dans le bas de la lettre ; aucun (v) → le point le plus bas de l'axe
  let pieds = tetes.filter(bas);
  if (!pieds.length) pieds = [garde.reduce((m, q) => (q.Y > m.Y ? q : m), garde[0])];
  for (const q of pieds) { const v = valider(q); if (v && !proche(v, pos, 15)) poser(v); }
  // équilibre : parmi les autres bouts et les points extrêmes de l'axe (gauche, droite, haut), celui qui porte le mieux
  if (pos.length && pos.length < 3) {
    const ext = [
      garde.reduce((m, q) => (q.X < m.X ? q : m), garde[0]), garde.reduce((m, q) => (q.X > m.X ? q : m), garde[0]),
      garde.reduce((m, q) => (q.Y < m.Y ? q : m), garde[0]),
    ];
    const cands = tetes.concat(ext).filter((q) => !proche(q, pos, 15));
    const qualite = (q) => {
      if (pos.length === 1) return -P.equilibre * distSegment(centre, pos[0], q) + 0.3 * Math.hypot(q.X - pos[0].X, q.Y - pos[0].Y);
      // deux pieds : le triangle formé doit contenir le centre de la lettre, le plus grand possible
      const [a, b] = pos, aireT = Math.abs((b.X - a.X) * (q.Y - a.Y) - (q.X - a.X) * (b.Y - a.Y)) / 2;
      const s1 = Math.sign((b.X - a.X) * (centre.Y - a.Y) - (centre.X - a.X) * (b.Y - a.Y));
      const s2 = Math.sign((q.X - b.X) * (centre.Y - b.Y) - (centre.X - b.X) * (q.Y - b.Y));
      const s3 = Math.sign((a.X - q.X) * (centre.Y - q.Y) - (centre.X - q.X) * (a.Y - q.Y));
      const dedansT = s1 === s2 && s2 === s3;
      return Math.sqrt(aireT) + (dedansT ? 1e9 : 0);
    };
    for (const q of cands.sort((u, v) => qualite(v) - qualite(u))) { const v = valider(q); if (v && !proche(v, pos, 15)) { poser(v); break; } }
  }
  return { pos, modes, minimum };
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
      const cs = formes(G); nRainures += cs.length; for (const f of cs) res.rainure.push(f.map((r) => versMm(allege(r))));
      for (const z of zonesEtroites(G, P.rainureMin)) res.etroit.push(z.map(versMm));
      return cs.length;
    };

    // 4. bord non éclairé : un tronçon du bord de la lettre sans rainure à proximité. (Aux angles vifs, la rainure, arrondie
    //    pour la fraise, s'éloigne un peu de la pointe : c'est normal, on ne le signale pas — d'où la tolérance de rainureMin.)
    const bordLettre = diff(piece, decale(piece, -1.5));
    const eclaire = decale(G, P.bordure + P.rainureMin);
    const sombres = formes(diff(bordLettre, eclaire)).map((z) => ouverture(z, 0.3)).filter((z) => aire(z) > 6);
    for (const z of sombres) res.doutes.push({ motif: `bord non éclairé : la rainure (≥ ${P.rainureMin} mm) ne rentre pas ici`, boite: boiteMm(z, 4), info: true });

    // 5. entretoises (règles de Jordan du 17/11/2026, tirées de son replacement à la main sur Centre Services)
    const { pos, modes, minimum } = placerEntretoises(piece, G, P);
    pos.forEach((p, k) => res.entretoises.push({ x: +(p.X / E).toFixed(3), y: +(p.Y / E).toFixed(3), repli: modes[k] !== "bord", mode: modes[k] }));
    if (modes.includes("trait")) res.doutes.push({ motif: "lettre fine : entretoises au milieu du trait (sur la rainure si besoin)", boite: boiteMm(piece, 5), info: true });
    if (pos.length < minimum) res.doutes.push({ motif: pos.length ? `${pos.length} entretoise(s) seulement (${minimum} au moins)` : "aucune place pour une entretoise", boite: boiteMm(piece, 5) });
    const nr = enregistrer();
    res.pieces.push({ boite: boiteMm(piece), entretoises: pos.length, rainures: nr, liaisons: liaisonsPiece.length });
  });
  if (surProgression) surProgression(1);
  res.stats = { pieces: pieces.length, rainures: nRainures, liaisons: nLiaisons, cables: nCables, entretoises: res.entretoises.length, doutes: res.doutes.length, secondes: +((Date.now() - t0) / 1000).toFixed(1) };
  return res;
}

/** pour le banc d'essai uniquement */
export const _interne = { couperRainure, coupeLaRainure, distSegment, placerEntretoises, centreDe, rainureAdaptative, piecesDe, decale, formes, aire, boite, diff, union, ouverture, E };
