// Fonds perdus intelligents de l'outil Adhésif — moteur de calcul (aucune dépendance à Illustrator ni à l'interface).
//
// Règle : dans la chute, à moins de 5 mm d'une pièce, la couleur du débord est celle du point le plus proche
// juste à l'intérieur du trait de coupe. Deux pièces proches se partagent l'espace par moitié.
// Le moteur ne modifie JAMAIS un tracé de découpe ni le visuel : il rend des CORRECTIFS (tracés fermés) à poser
// sur le calque FondPerdu, par-dessus le décalage de 5 mm que fait déjà l'outil.
//
// Entrée (mm, axe y vers le bas) :
//   art   : objets du visuel, du DESSUS vers le dessous — { cle, couleur?, source?, pairImpair?, chemins }
//   coupe : traits de coupe — { ferme, pts }
//   fp    : (facultatif) objets déjà présents sur le calque FondPerdu, du dessus vers le dessous ; s'il est absent
//           (banc d'essai), le moteur simule le décalage de 5 mm de l'outil
// Clés de couleur : 'blanc' = pas d'encre ; une clé qui commence par 'degrade', 'grad:', 'photo' ou 'motif' n'est pas
// un aplat : elle garde sa zone mais ne reçoit pas de correctif (signalé dans les doutes).
//
// Mis au point et prouvé sur fichiers réels avec le banc d'essai Y:/JORDAN/TEST/FP_INTELLIGENT (10/11/2026).
// @ts-nocheck — portage direct du banc (JavaScript) ; la géométrie passe par clipper-lib, non typée.
import CL from "clipper-lib";

const E = 1000;                     // 1 mm = 1000 unités (µm)
export const PARAMETRES_FP = {
  debord: 5,                        // mm
  soudure: 0.005,                   // surépaisseur (mm) qui soude deux pièces collées en un seul bloc
  eps: 0.02,                        // demi-épaisseur des « murs » de coupe (ferme les micro-écarts)
  bande: 1.2,                       // profondeur (mm) de la bande où l'on lit les couleurs sous le trait de coupe
  lecture: 0.1,                     // profondeur (mm) de la ligne de lecture des couleurs le long de la coupe
  fenetre: 0.4,                     // demi-fenêtre (mm) du vote majoritaire qui nettoie la lecture des couleurs
  raccord: 0.6,                     // longueur (mm) du petit segment droit commun à deux tronçons voisins
  accroche: 0.7,                    // rayon (mm) de recherche du point exact autour d'une rencontre de couleurs
  lissageLecture: 0.03,             // tolérance (mm) de lissage de la ligne de lecture
  arrondi: 0.8,                     // distance maxi (mm) sur laquelle un angle de la ligne de partage est arrondi
  lamelle: 0.12,                    // rayon (mm) de nettoyage des lamelles alternées entre deux couleurs
  maille: 0.1,                      // longueur maxi (mm) des segments de cette ligne = précision du point de rencontre
  pas: 0.05,                        // pas de distance pour départager deux tronçons qui se recouvrent
  arc: 0.01,                        // tolérance des arcs
  lissage: 0.02,                    // tolérance de lissage final des correctifs (mm)
  lissageFrontiere: 0.05,           // tolérance de lissage des frontières entre couleurs (mm), > pas
  depassement: 0.3,                 // chaque correctif dépasse de cette valeur ce qu'il recouvre (mm)
  eclatMin: 0.15,                   // on supprime les éclats plus fins que 2 x cette valeur
  aireMin: 0.25,                    // mm² : correctif plus petit = ignoré
  couvertureMin: 0.5,               // une zone fermée par la coupe est une « pièce » si le visuel la couvre à ≥ 50 %
};
const P = PARAMETRES_FP;

// ---------- petites briques Clipper ----------
const NZ = CL.PolyFillType.pftNonZero, EO = CL.PolyFillType.pftEvenOdd;
const versC = pts => pts.map(p => ({ X: Math.round(p[0] * E), Y: Math.round(p[1] * E) }));
const versMm = paths => paths.map(p => p.map(q => [q.X / E, q.Y / E]));
function bool(type, a, b, fa = NZ, fb = NZ) {
  const c = new CL.Clipper(), sol = [];
  if (a.length) c.AddPaths(a, CL.PolyType.ptSubject, true);
  if (b && b.length) c.AddPaths(b, CL.PolyType.ptClip, true);
  c.Execute(type, sol, fa, fb);
  return sol;
}
const union = (a, b = [], fa = NZ) => bool(CL.ClipType.ctUnion, a, b, fa, NZ);
const inter = (a, b) => (a.length && b.length ? bool(CL.ClipType.ctIntersection, a, b) : []);
const diff = (a, b) => (a.length ? (b.length ? bool(CL.ClipType.ctDifference, a, b) : a) : []);
function decale(paths, mm, fin = CL.EndType.etClosedPolygon, joint = CL.JoinType.jtRound) {
  // Clipper oriente tout d'après le chemin le plus bas : un éclat dégénéré de sens inverse (aire ~0) ferait
  // traiter toutes les formes comme des trous → on écarte ces éclats avant de décaler un polygone fermé.
  if (fin === CL.EndType.etClosedPolygon) paths = paths.filter(p => p.length >= 3 && Math.abs(CL.Clipper.Area(p)) > 400);
  if (!paths.length) return [];
  const co = new CL.ClipperOffset(2, P.arc * E), sol = [];
  co.AddPaths(paths, joint, fin);
  co.Execute(sol, mm * E);
  return sol;
}
const aire = paths => paths.reduce((s, p) => s + CL.Clipper.Area(p), 0) / (E * E);   // mm² (trous négatifs)
const ouverture = (paths, r) => decale(decale(paths, -r), r);                        // retire les éclats
function boite(paths) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of paths) for (const q of p) { if (q.X < x0) x0 = q.X; if (q.X > x1) x1 = q.X; if (q.Y < y0) y0 = q.Y; if (q.Y > y1) y1 = q.Y; }
  return [x0, y0, x1, y1];
}
const croise = (a, b, m = 0) => a[0] - m <= b[2] && b[0] - m <= a[2] && a[1] - m <= b[3] && b[1] - m <= a[3];

// simplification Douglas-Peucker d'un contour fermé (tolérance en unités)
function dp(pts, tol) {
  if (pts.length < 8) return pts;
  let i1 = 0, dmax = -1;
  for (let i = 1; i < pts.length; i++) { const d = (pts[i].X - pts[0].X) ** 2 + (pts[i].Y - pts[0].Y) ** 2; if (d > dmax) { dmax = d; i1 = i; } }
  const demi = (a, b) => {
    const seg = []; for (let i = a; ; i = (i + 1) % pts.length) { seg.push(pts[i]); if (i === b) break; }
    const garde = new Uint8Array(seg.length); garde[0] = garde[seg.length - 1] = 1;
    const pile = [[0, seg.length - 1]];
    while (pile.length) {
      const [u, v] = pile.pop(); if (v - u < 2) continue;
      const ax = seg[u].X, ay = seg[u].Y, dx = seg[v].X - ax, dy = seg[v].Y - ay, L = Math.hypot(dx, dy) || 1;
      let m = -1, im = -1;
      for (let i = u + 1; i < v; i++) { const d = Math.abs((seg[i].X - ax) * dy - (seg[i].Y - ay) * dx) / L; if (d > m) { m = d; im = i; } }
      if (m > tol) { garde[im] = 1; pile.push([u, im], [im, v]); }
    }
    return seg.filter((_, i) => garde[i]);
  };
  const h1 = demi(0, i1), h2 = demi(i1, 0);
  return h1.concat(h2.slice(1, -1));
}
// retire les composantes qui ne sont QUE des éclats (elles disparaissent à l'ouverture de rayon r) ; les autres sont
// gardées entières, pointes comprises — un correctif doit rester aussi pointu que l'angle dans lequel il entre
function sansEclats(paths, r) {
  if (!paths.length) return [];
  const arbre = new CL.PolyTree(), c = new CL.Clipper(); let garde = [];
  c.AddPaths(paths, CL.PolyType.ptSubject, true); c.Execute(CL.ClipType.ctUnion, arbre, NZ, NZ);
  for (const ex of CL.JS.PolyTreeToExPolygons(arbre)) { const comp = [ex.outer, ...ex.holes]; if (aire(ouverture(comp, r)) > 0.01) garde = garde.concat(comp); }
  return garde;
}
// Nettoie un correctif brut. Le vrai décalage d'Illustrator ne tombe pas au centième comme la zone idéale : la différence
// laisse des éclats et de fines AIGUILLES accrochées aux vrais correctifs. Une ouverture de rayon r les retire toutes… mais
// rabote aussi les POINTES légitimes (un correctif entre dans un angle jusqu'à son sommet). On rend donc à la forme chaque
// morceau retiré qui touche un point de rencontre de deux couleurs sur le bord des pièces : c'est une pointe, pas une aiguille.
function sansAiguilles(paths, r, rencontres) {
  if (!paths.length) return [];
  const base = ouverture(paths, r);
  if (!base.length) return [];
  let garde = base;
  const retire = diff(paths, base);
  if (retire.length && rencontres.length) {
    const arbre = new CL.PolyTree(), c = new CL.Clipper();
    c.AddPaths(retire, CL.PolyType.ptSubject, true); c.Execute(CL.ClipType.ctUnion, arbre, NZ, NZ);
    for (const ex of CL.JS.PolyTreeToExPolygons(arbre)) {
      const comp = [ex.outer, ...ex.holes], large = decale(comp, 0.12), b = boite(large);
      let touche = false;
      for (const J of rencontres) {
        if (J.X < b[0] || J.X > b[2] || J.Y < b[1] || J.Y > b[3]) continue;
        let n = 0; for (const q of large) if (CL.Clipper.PointInPolygon(J, q) !== 0) n++;
        if (n % 2) { touche = true; break; }
      }
      if (touche && inter(decale(comp, 0.02), base).length) garde = union(garde, comp);   // pointe attachée à un vrai correctif
    }
  }
  return sansEclats(garde, r);
}
// simplification Douglas-Peucker d'une ligne OUVERTE (extrémités conservées)
function dpOuvert(seg, tol) {
  if (seg.length < 3) return seg;
  const garde = new Uint8Array(seg.length); garde[0] = garde[seg.length - 1] = 1;
  const pile = [[0, seg.length - 1]];
  while (pile.length) {
    const [u, v] = pile.pop(); if (v - u < 2) continue;
    const ax = seg[u].X, ay = seg[u].Y, dx = seg[v].X - ax, dy = seg[v].Y - ay, L = Math.hypot(dx, dy) || 1;
    let m = -1, im = -1;
    for (let i = u + 1; i < v; i++) { const d = Math.abs((seg[i].X - ax) * dy - (seg[i].Y - ay) * dx) / L; if (d > m) { m = d; im = i; } }
    if (m > tol) { garde[im] = 1; pile.push([u, im], [im, v]); }
  }
  return seg.filter((_, i) => garde[i]);
}
// arrondit les angles d'une ligne ouverte : chaque sommet est remplacé par une petite courbe qui démarre et finit à au plus
// `rayon` du sommet (et jamais plus loin que 40 % du segment voisin)
function arrondir(seg, rayon) {
  if (seg.length < 3) return seg;
  const out = [seg[0]];
  for (let i = 1; i < seg.length - 1; i++) {
    const a = seg[i - 1], b = seg[i], c = seg[i + 1];
    const la = Math.hypot(b.X - a.X, b.Y - a.Y), lc = Math.hypot(c.X - b.X, c.Y - b.Y);
    if (!la || !lc) continue;
    const cos = ((b.X - a.X) * (c.X - b.X) + (b.Y - a.Y) * (c.Y - b.Y)) / (la * lc);
    if (cos > 0.996) { out.push(b); continue; }                         // presque droit (< 5°) : rien à arrondir
    const d = Math.min(rayon, 0.4 * la, 0.4 * lc);
    const p0 = { X: b.X - (b.X - a.X) / la * d, Y: b.Y - (b.Y - a.Y) / la * d }, p2 = { X: b.X + (c.X - b.X) / lc * d, Y: b.Y + (c.Y - b.Y) / lc * d };
    for (let k = 0; k <= 6; k++) { const t = k / 6, u = 1 - t; out.push({ X: Math.round(u * u * p0.X + 2 * u * t * b.X + t * t * p2.X), Y: Math.round(u * u * p0.Y + 2 * u * t * b.Y + t * t * p2.Y) }); }
  }
  out.push(seg[seg.length - 1]);
  return out;
}
const lisse = (paths, tolMm) => { const r = paths.map(p => dp(p, tolMm * E)).filter(p => p.length >= 3); return r.length ? union(r) : []; };

const estAplat = c => !/^(degrade|grad:|photo|motif)/.test(c);

/**
 * Calcule les correctifs de fond perdu. Voir l'en-tête du fichier pour le format d'entrée.
 * `surProgression`, facultatif, reçoit l'avancement du calcul, de 0 à 1.
 */
export function calculerFondsPerdus(D, surProgression) {
const t0 = Date.now();
const estBlanc = c => c[0] > 0.995 && c[1] > 0.995 && c[2] > 0.995;
const cleDe = o => o.cle || o.degrade || (estBlanc(o.couleur) ? 'blanc' : o.couleur.map(v => v.toFixed(3)).join(','));
const prepare = liste => liste.map((o, i) => {
  const g = union(o.chemins.map(versC), [], (o.pairImpair || o.pair_impair) ? EO : NZ);
  return { z: o.z === undefined ? -i : o.z, cle: cleDe(o), couleur: o.couleur || [0.5, 0.5, 0.5], source: o.source, g, b: boite(g) };
}).filter(o => o.g.length).sort((a, b) => b.z - a.z);

// objets du visuel, du DESSUS vers le dessous ; objets déjà présents sur le calque FondPerdu (s'ils sont fournis)
const art = prepare(D.art);
const fpReel = D.fp ? prepare(D.fp) : null;
const sources = {}; for (const o of art) if (o.source !== undefined && sources[o.cle] === undefined) sources[o.cle] = o.source;

// ---------- 1. les pièces : zones fermées par le trait de coupe et couvertes par le visuel ----------
const fermes = D.coupe.filter(c => c.ferme).map(c => versC(c.pts));
const ouverts = D.coupe.filter(c => !c.ferme).map(c => versC(c.pts));
const murs = union(decale(fermes, P.eps, CL.EndType.etClosedLine), decale(ouverts, P.eps, CL.EndType.etOpenSquare));
const emprise = boite(fermes.concat(ouverts).concat(art.map(o => [{ X: o.b[0], Y: o.b[1] }, { X: o.b[2], Y: o.b[3] }])));
const M = 20 * E, cadre = [[{ X: emprise[0] - M, Y: emprise[1] - M }, { X: emprise[2] + M, Y: emprise[1] - M }, { X: emprise[2] + M, Y: emprise[3] + M }, { X: emprise[0] - M, Y: emprise[3] + M }]];
const arbre = new CL.PolyTree();
{ const c = new CL.Clipper(); c.AddPaths(cadre, CL.PolyType.ptSubject, true); c.AddPaths(murs, CL.PolyType.ptClip, true); c.Execute(CL.ClipType.ctDifference, arbre, NZ, NZ); }
const zones = CL.JS.PolyTreeToExPolygons(arbre).map(z => [z.outer, ...z.holes]);
const pieces = [];
let nChutes = 0;
for (const z of zones) {
  const b = boite(z);
  if (b[0] <= emprise[0] - M + 1) continue;                          // l'extérieur de la planche
  const a = aire(z); if (a <= 0) continue;
  let couv = [];
  for (const o of art) if (croise(o.b, b)) couv = union(couv, inter(o.g, z));
  // (chaque pièce est regonflée de l'épaisseur du mur, plus un rien : deux pièces collées se RECOUVRENT alors franchement,
  //  sans fente d'épaisseur nulle entre elles — le rien est retiré une fois le bloc réuni)
  if (aire(couv) / a >= P.couvertureMin) pieces.push({ g: decale(z, P.eps + P.soudure), b }); else nChutes++;
}

// ---------- 2. groupes de pièces voisines (à moins de 2 débords l'une de l'autre) ----------
const parent = pieces.map((_, i) => i);
const racine = i => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
const marge = (2 * P.debord + 1) * E;
for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++)
  if (croise(pieces[i].b, pieces[j].b, marge)) parent[racine(i)] = racine(j);
const groupes = {};
pieces.forEach((p, i) => (groupes[racine(i)] = groupes[racine(i)] || []).push(p));

// ---------- 3. par groupe : carte correcte, débord actuel, correctifs ----------
const res = { parametres: P, groupes: [], doutes: [], correctifs: [], sources, stats: null };
let piecesFaites = 0;
for (const gid of Object.keys(groupes)) {
  // avancement : chaque groupe pèse son nombre de pièces ; `avance(f)` situe le calcul à la fraction f de CE groupe
  const debutGroupe = piecesFaites, poidsGroupe = groupes[gid].length; piecesFaites += poidsGroupe;
  const avance = f => { if (surProgression) surProgression((debutGroupe + f * poidsGroupe) / pieces.length); };
  avance(0);
  let K = union(groupes[gid].flatMap(p => p.g));
  K = decale(K, -P.soudure);                                          // blocs soudés, bord remis à sa place
  // (au fond d'un angle très fermé, la soudure peut laisser un trou microscopique : ce n'est pas une chute, et son contour
  //  serait pris pour un sommet d'angle — on l'écarte)
  K = K.filter(r => Math.abs(CL.Clipper.Area(r)) > 0.05 * E * E);
  const bK = boite(K), m5 = (P.debord + 1) * E;
  const local = art.filter(o => croise(o.b, bK, m5));
  const zone5 = decale(K, P.debord);                                  // pièces + 5 mm
  const B = diff(zone5, K);                                           // la bande de débord, dans la chute
  const couvArt = inter(K, union(local.flatMap(o => o.g)));  // là où le visuel cache le calque de fond perdu

  // 3a. couleurs lues sous le trait de coupe, pièce par pièce, sur une bande de P.bande mm.
  //     Les éclats (plus fins que 2 x rayon) sont ignorés : un visuel qui s'arrête 0,2 mm avant la coupe
  //     ne doit pas donner un débord blanc. Le rayon s'adapte aux pièces très fines (petits textes).
  const germes = {}; const vusTous = {}; const teinte = { blanc: [1, 1, 1], nu: [1, 1, 1] }; for (const o of local) teinte[o.cle] = o.couleur;
  // Les couleurs se lisent par BLOC de pièces réunies (composantes de K), pas par pièce : le résultat ne dépend ainsi pas des
  // traits de coupe intérieurs — que le CutContour soit déjà fusionné ou encore fait du contour de chaque objet.
  const blocs = [];
  { const arbreK = new CL.PolyTree(), ck = new CL.Clipper(); ck.AddPaths(K, CL.PolyType.ptSubject, true); ck.Execute(CL.ClipType.ctUnion, arbreK, NZ, NZ);
    for (const ex of CL.JS.PolyTreeToExPolygons(arbreK)) { const g = [ex.outer, ...ex.holes]; blocs.push({ g, b: boite(g) }); } }
  for (const piece of blocs) {
    let bande = diff(piece.g, decale(piece.g, -P.bande)); if (!bande.length) bande = piece.g;
    const vus = {}; let couvert = [];
    for (const o of local) {
      if (!croise(o.b, piece.b)) continue;
      const g = inter(o.g, bande); if (!g.length) continue;
      const vis = diff(g, couvert);
      if (vis.length) { vus[o.cle] = union(vus[o.cle] || [], vis); teinte[o.cle] = o.couleur; }
      couvert = union(couvert, g);
    }
    const nu = diff(bande, couvert); if (nu.length) vus.nu = nu;       // rien d'imprimé à cet endroit (ni couleur ni objet blanc)
    const aBande = aire(bande); let retenus = vus;
    for (const rayon of [0.3, 0.15, 0.07, 0.03]) {
      const essai = {}; let tot = 0;
      for (const c of Object.keys(vus)) { const o = ouverture(vus[c], rayon); if (o.length) { essai[c] = o; tot += aire(o); } }
      retenus = essai; if (tot >= 0.6 * aBande) break;
    }
    // doute : un éclat blanc notable le long de la coupe (le visuel ne rejoint pas le trait)
    if (vus.nu) {
      const perdu = ouverture(diff(vus.nu, retenus.nu || []), 0.04);
      if (aire(perdu) > 1.5) res.doutes.push({ motif: 'le visuel ne rejoint pas tout à fait le trait de coupe (liseré blanc possible)', aire: +aire(perdu).toFixed(2), boite: boite(perdu).map(v => +(v / E).toFixed(1)) });
    }
    // une vraie marge non imprimée entre le visuel et la coupe : voulue (liseré blanc) ou visuel trop court ? Le moteur ne peut pas
    // le savoir → il ne touche à rien à cet endroit et le signale.
    if (retenus.nu && aire(retenus.nu) > 1) res.doutes.push({ motif: 'marge non imprimée entre le visuel et le trait de coupe (voulue ?) : débord laissé tel quel', aire: +aire(retenus.nu).toFixed(1), boite: boite(retenus.nu).map(v => +(v / E).toFixed(1)) });
    for (const c of Object.keys(vus)) vusTous[c] = (vusTous[c] || []).concat(vus[c]);
    for (const c of Object.keys(retenus)) germes[c] = (germes[c] || []).concat(retenus[c]);
  }
  const couleurs = Object.keys(germes);
  avance(0.15);
  if (!couleurs.length) { res.doutes.push({ motif: 'aucune couleur lue sous le trait de coupe', boite: bK.map(v => v / E) }); continue; }

  // 3b. carte correcte du débord.
  //     (1) le trait de coupe (lu à P.lecture mm à l'intérieur) est découpé en TRONÇONS d'une seule couleur ;
  //     (2) chaque tronçon est extrudé vers la chute, bien perpendiculairement (extrémités droites) : la frontière
  //         entre deux couleurs qui se suivent part donc tout droit du point de rencontre ;
  //     (3) là où deux extrusions se recouvrent (angles rentrants, pièces face à face) ou là où aucune ne passe
  //         (angles saillants), c'est le tronçon le plus proche qui gagne (comparaison de distances par pas de P.pas mm).
  const carte = {};
  const rencontres = [];                                             // points où deux couleurs se rencontrent sur le bord des pièces
  const sansEncre = c => c === 'blanc' || c === 'nu';
  const ordre = couleurs.slice().sort((a, b) => Number(sansEncre(a)) - Number(sansEncre(b)));   // à égalité stricte, la couleur passe avant le blanc
  if (couleurs.length === 1) carte[couleurs[0]] = B;
  else {
    const index = {}; for (const c of couleurs) index[c] = germes[c].map(p => ({ p, b: boite([p]) }));
    const couleurAu = pt => {
      for (const c of ordre) {
        let n = 0;
        for (const e of index[c]) if (pt.X >= e.b[0] && pt.X <= e.b[2] && pt.Y >= e.b[1] && pt.Y <= e.b[3] && CL.Clipper.PointInPolygon(pt, e.p) !== 0) n++;
        if (n % 2) return c;
      }
      return null;
    };
    // points EXACTS où une couleur commence ou s'arrête le long du bord des pièces : extrémités des portions du bord
    // touchées par cette couleur (croisement du visuel avec la coupe, sommet de l'angle entre deux pièces)
    const exacts = [];
    // sommets d'angle du bord des pièces (le bord tourne de plus de 20° sur ± 0,03 mm) : là où deux pièces se rejoignent
    const coins = [];
    for (const r of K) {
      const n = r.length; if (n < 4) continue;
      for (let i = 0; i < n; i++) {
        let a = i, b2 = i, da = 0, db = 0;
        while (da < 30 && a !== (i + 1) % n) { const q = (a + n - 1) % n; da += Math.hypot(r[a].X - r[q].X, r[a].Y - r[q].Y); a = q; if (a === i) break; }
        while (db < 30 && b2 !== (i + n - 1) % n) { const q = (b2 + 1) % n; db += Math.hypot(r[b2].X - r[q].X, r[b2].Y - r[q].Y); b2 = q; if (b2 === i) break; }
        const ux = r[i].X - r[a].X, uy = r[i].Y - r[a].Y, vx = r[b2].X - r[i].X, vy = r[b2].Y - r[i].Y, lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
        if (!(lu && lv && (ux * vx + uy * vy) / (lu * lv) < 0.94)) continue;
        // directions d'arrivée et de départ, sur 0,3 mm de part et d'autre
        let a3 = i, b3 = i, d3 = 0;
        while (d3 < 300) { const q = (a3 + n - 1) % n; d3 += Math.hypot(r[a3].X - r[q].X, r[a3].Y - r[q].Y); a3 = q; if (a3 === i) break; }
        d3 = 0; while (d3 < 300) { const q = (b3 + 1) % n; d3 += Math.hypot(r[b3].X - r[q].X, r[b3].Y - r[q].Y); b3 = q; if (b3 === i) break; }
        const ax = r[i].X - r[a3].X, ay = r[i].Y - r[a3].Y, bx = r[b3].X - r[i].X, by = r[b3].Y - r[i].Y, la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
        coins.push({ X: r[i].X, Y: r[i].Y, ux: ax / la, uy: ay / la, vx: bx / lb, vy: by / lb });
      }
    }
    {
      const bordK = K.map(r => r.concat([r[0]])), departs = {}; for (const r of K) departs[r[0].X + ',' + r[0].Y] = 1;
      for (const c of Object.keys(vusTous)) {
        const voisin = decale(vusTous[c], 0.012); if (!voisin.length) continue;
        const cl = new CL.Clipper(), arbreO = new CL.PolyTree();
        cl.AddPaths(bordK, CL.PolyType.ptSubject, false); cl.AddPaths(voisin, CL.PolyType.ptClip, true);
        cl.Execute(CL.ClipType.ctIntersection, arbreO, NZ, NZ);
        for (const ligne of CL.Clipper.OpenPathsFromPolyTree(arbreO)) for (const q of [ligne[0], ligne[ligne.length - 1]])
          if (!departs[q.X + ',' + q.Y]) {
            let s0 = q, d0 = 60;                                           // un sommet d'angle à moins de 0,06 mm : c'est lui, le point exact
            for (const k of coins) { const d = Math.hypot(k.X - q.X, k.Y - q.Y); if (d < d0) { d0 = d; s0 = k; } }
            exacts.push({ X: s0.X, Y: s0.Y, c, coin: s0 !== q ? s0 : null });
          }
      }
    }
    const coupesAngle = [];                                            // sommets d'angle : { J, tx, ty, avant, apres }
    const troncons = {}, vrais = {}; for (const c of couleurs) { troncons[c] = []; vrais[c] = []; }           // polylignes ouvertes (un anneau entier = polyligne rebouclée)
    for (const anneauBrut of decale(K, -P.lecture)) {
      const anneau = dp(anneauBrut, P.lissageLecture * E);                 // gomme les micro-zigzags d'un trait de coupe repris à la main
      const pts = [];
      for (let i = 0; i < anneau.length; i++) {
        const a = anneau[i], b2 = anneau[(i + 1) % anneau.length], L = Math.hypot(b2.X - a.X, b2.Y - a.Y), n = Math.max(1, Math.ceil(L / (P.maille * E)));
        for (let k = 0; k < n; k++) pts.push({ X: Math.round(a.X + (b2.X - a.X) * k / n), Y: Math.round(a.Y + (b2.Y - a.Y) * k / n) });
      }
      let N = pts.length; if (N < 3) continue;
      const lab = new Array(N), lon = new Array(N);
      let premier = -1;
      // côté intérieur de l'anneau (pour sonder plus profond quand rien n'est lu à P.lecture : visuel en retrait de la coupe)
      const dedansK = pt => { let n = 0; for (const p of K) if (CL.Clipper.PointInPolygon(pt, p) !== 0) n++; return n % 2 === 1; };
      let sens = 0;
      for (let i = 0; i < N && !sens; i++) {
        const a = pts[i], b2 = pts[(i + 1) % N], L = Math.hypot(b2.X - a.X, b2.Y - a.Y); if (L < 20) continue;
        const nx = -(b2.Y - a.Y) / L, ny = (b2.X - a.X) / L, mx = (a.X + b2.X) / 2, my = (a.Y + b2.Y) / 2;
        const g = dedansK({ X: Math.round(mx + nx * 300), Y: Math.round(my + ny * 300) }), d = dedansK({ X: Math.round(mx - nx * 300), Y: Math.round(my - ny * 300) });
        if (g !== d) sens = g ? 1 : -1;
      }
      for (let i = 0; i < N; i++) {
        const a = pts[i], b2 = pts[(i + 1) % N]; lon[i] = Math.hypot(b2.X - a.X, b2.Y - a.Y);
        const mx = (a.X + b2.X) / 2, my = (a.Y + b2.Y) / 2;
        lab[i] = couleurAu({ X: Math.round(mx), Y: Math.round(my) });
        if (lab[i] === null && sens && lon[i] > 0) {
          const nx = -(b2.Y - a.Y) / lon[i] * sens, ny = (b2.X - a.X) / lon[i] * sens;
          for (const prof of [0.15, 0.3, 0.5, 0.75, 1.0]) { lab[i] = couleurAu({ X: Math.round(mx + nx * prof * E), Y: Math.round(my + ny * prof * E) }); if (lab[i] !== null) break; }
        }
        if (lab[i] !== null && premier < 0) premier = i;
      }
      if (premier < 0) { res.doutes.push({ motif: 'couleur illisible sous un trait de coupe', boite: boite([anneau]).map(v => +(v / E).toFixed(1)) }); continue; }
      // segments sans couleur lue (éclats retirés, coins arrondis) : ils prennent la couleur du voisin le plus proche le long du trait
      for (let d = 1; d <= N; d++) {
        const i = (premier + d) % N; if (lab[i] !== null) continue;
        let fin = d, total = 0; while (lab[(premier + fin) % N] === null) { total += lon[(premier + fin) % N]; fin++; }
        const avant = lab[(premier + d - 1) % N], apres = lab[(premier + fin) % N];
        let cumul = 0;
        for (let q = d; q < fin; q++) { const j = (premier + q) % N; cumul += lon[j]; lab[j] = (avant === apres || cumul - lon[j] / 2 <= total / 2) ? avant : apres; }
        if (avant !== apres && total > 3 * E) res.doutes.push({ motif: 'couleur incertaine le long du trait de coupe sur ' + (total / E).toFixed(1) + ' mm', boite: [pts[i].X / E, pts[i].Y / E, pts[(premier + fin) % N].X / E, pts[(premier + fin) % N].Y / E].map(v => +v.toFixed(1)) });
        d = fin - 1;
      }
      // une seule transition nette par rencontre de couleurs : chaque segment prend la couleur majoritaire (en longueur)
      // dans une fenêtre de ± P.fenetre mm le long du trait — sinon des bandelettes alternées apparaissent au point de rencontre
      for (let passe = 0; passe < 2; passe++) {
        const neuf = new Array(N);
        for (let i = 0; i < N; i++) {
          const poids = {}; poids[lab[i]] = lon[i];
          for (const dir of [1, -1]) { let d = 0, j = i; while (d < P.fenetre * E) { j = (j + dir + N) % N; if (j === i) break; d += lon[j]; poids[lab[j]] = (poids[lab[j]] || 0) + lon[j]; } }
          let best = lab[i], pm = -1; for (const c of ordre) if ((poids[c] || 0) > pm) { pm = poids[c] || 0; best = c; }
          neuf[i] = best;
        }
        for (let i = 0; i < N; i++) lab[i] = neuf[i];
      }
      // accrochage : la lecture ci-dessus situe chaque rencontre de couleurs à 0,1–0,3 mm près. On la ramène au point EXACT
      // (croisement du visuel avec la coupe, ou sommet de l'angle entre deux pièces) pour que la frontière parte pile de l'angle.
      if (exacts.length) {
        const tr = []; for (let i = 0; i < N; i++) if (lab[i] !== lab[(i + N - 1) % N]) tr.push(i);
        for (let k = tr.length - 1; k >= 0; k--) {                                  // en remontant : une insertion ne décale pas les rencontres à venir
          let t = tr[k]; const a = lab[(t + N - 1) % N], b = lab[t], J = pts[t];
          let cible = null, dCible = P.accroche * E;
          for (const q of exacts) { if (q.c !== a && q.c !== b) continue; const d = Math.hypot(q.X - J.X, q.Y - J.Y); if (d < dCible) { dCible = d; cible = q; } }
          if (!cible) continue;
          // fenêtre de ± 1,2 mm le long de l'anneau autour de la rencontre
          let dMin = 0, dMax = 0, s = 0;
          while (s < 1.2 * E && dMin > -N / 2) { dMin--; s += lon[(t + dMin + N * 4) % N]; }
          s = 0; while (s < 1.2 * E && dMax < N / 2) { s += lon[(t + dMax) % N]; dMax++; }
          // pied de la cible sur l'anneau (segment le plus proche)
          let dF = Infinity, dSeg = 0, uSeg = 0, F = null;
          for (let d = dMin; d < dMax; d++) {
            const p0 = pts[(t + d + N * 4) % N], p1 = pts[(t + d + 1 + N * 4) % N], vx = p1.X - p0.X, vy = p1.Y - p0.Y, L2 = vx * vx + vy * vy;
            const u = L2 ? Math.max(0, Math.min(1, ((cible.X - p0.X) * vx + (cible.Y - p0.Y) * vy) / L2)) : 0;
            const fx = p0.X + vx * u, fy = p0.Y + vy * u, dist = Math.hypot(cible.X - fx, cible.Y - fy);
            if (dist < dF) { dF = dist; dSeg = d; uSeg = u; F = { X: Math.round(fx), Y: Math.round(fy) }; }
          }
          // sommets à la même distance de la cible : un angle rentrant (petit arc autour du sommet) → on vise le milieu de l'arc
          const proches = []; for (let d = dMin; d <= dMax; d++) { const p = pts[(t + d + N * 4) % N]; if (Math.hypot(cible.X - p.X, cible.Y - p.Y) <= dF + 4) proches.push(d); }
          let m;                                                                       // décalage (en sommets) de la rencontre exacte par rapport à t
          if (proches.length >= 3) m = proches[proches.length >> 1];
          else if (uSeg < 0.02) m = dSeg;
          else if (uSeg > 0.98) m = dSeg + 1;
          else {
            const seg = (t + dSeg + N * 4) % N, p0 = pts[seg], p1 = pts[(seg + 1) % N];
            pts.splice(seg + 1, 0, F); lab.splice(seg + 1, 0, lab[seg]);
            lon[seg] = Math.hypot(F.X - p0.X, F.Y - p0.Y); lon.splice(seg + 1, 0, Math.hypot(p1.X - F.X, p1.Y - F.Y));
            N++;
            if (seg + 1 <= t) t++;                                                     // le sommet de rencontre a glissé d'un cran
            m = dSeg >= 0 ? dSeg + 1 : dSeg;                                          // position du nouveau sommet par rapport à t
          }
          const mAbs = (t + m + N * 4) % N;
          const poseAngle = () => {
            if (!cible.coin) return;
            // Direction de passage au sommet = perpendiculaire à la bissectrice de l'angle. Bord presque droit : c'est la moyenne
            // des deux directions (u + v). Angle fermé : u + v devient minuscule et instable (à 15°, une erreur de 5° sur u ou v
            // le fait tourner de 45°) → on prend alors la bissectrice elle-même, v − u, qui est grande et stable, et sa perpendiculaire.
            const k0 = cible.coin; let tx, ty;
            const sx = k0.ux + k0.vx, sy = k0.uy + k0.vy, dx = k0.vx - k0.ux, dy = k0.vy - k0.uy;
            if (Math.hypot(sx, sy) >= Math.hypot(dx, dy)) { const l = Math.hypot(sx, sy); tx = sx / l; ty = sy / l; }
            else { const l = Math.hypot(dx, dy); tx = -dy / l; ty = dx / l; }
            const Jv = pts[mAbs]; let nx = -ty, ny = tx, prof = (Jv.X - cible.X) * nx + (Jv.Y - cible.Y) * ny;
            if (prof < 0) { nx = -nx; ny = -ny; prof = -prof; }
            prof = Math.max(prof, 30);
            const Jx = { X: Math.round(cible.X + nx * prof), Y: Math.round(cible.Y + ny * prof), tF: [tx, ty] };
            pts[mAbs] = Jx;
            const av = (mAbs + N - 1) % N, ap = (mAbs + 1) % N;
            lon[av] = Math.hypot(Jx.X - pts[av].X, Jx.Y - pts[av].Y); lon[mAbs] = Math.hypot(pts[ap].X - Jx.X, pts[ap].Y - Jx.Y);
          };
          if (m === 0) { poseAngle(); continue; }
          // la rencontre se déplace : les segments franchis changent de couleur — seulement s'ils sont bien tous de la couleur attendue
          // (sinon on enjamberait une autre rencontre : on ne touche à rien)
          let ok = true;
          if (m > 0) { for (let i = t; i !== mAbs; i = (i + 1) % N) if (lab[i] !== b) { ok = false; break; } if (ok) for (let i = t; i !== mAbs; i = (i + 1) % N) lab[i] = a; }
          else { for (let i = mAbs; i !== t; i = (i + 1) % N) if (lab[i] !== a) { ok = false; break; } if (ok) for (let i = mAbs; i !== t; i = (i + 1) % N) lab[i] = b; }
          if (ok) poseAngle();
        }
      }
      // découpe en tronçons. À chaque rencontre de deux couleurs (sommet J), les deux tronçons voisins se terminent par un
      // petit segment droit de même direction (la tangente au trait, mesurée sur ± h) : leurs extrémités « coupées droit »
      // tombent alors sur LA MÊME ligne → frontière parfaitement droite, perpendiculaire au trait (ou bissectrice d'un angle).
      const trans = []; for (let i = 0; i < N; i++) if (lab[i] !== lab[(i + N - 1) % N]) trans.push(i);
      if (trans.length < 2) { troncons[lab[0]].push(pts.concat([pts[0]])); vrais[lab[0]].push(pts.concat([pts[0]])); continue; }
      const T = trans.length;
      const pasDe = k => (trans[(k + 1) % T] - trans[k] + N) % N;                 // nombre de segments du tronçon k
      const lens = trans.map((v, k) => { let L = 0; for (let q = 0; q < pasDe(k); q++) L += lon[(v + q) % N]; return L; });
      const marche = (i, dir, h) => {                                             // point à la distance h du sommet i, le long de l'anneau
        let reste = h, j = i;
        for (let garde = 0; garde < N; garde++) {
          const seg = dir > 0 ? j : (j + N - 1) % N, nxt = dir > 0 ? (j + 1) % N : (j + N - 1) % N, L = lon[seg];
          if (L >= reste) { const a = pts[j], b2 = pts[nxt], u = reste / (L || 1); return { p: { X: a.X + (b2.X - a.X) * u, Y: a.Y + (b2.Y - a.Y) * u }, apres: nxt }; }
          reste -= L; j = nxt;
        }
        return { p: pts[i], apres: i };
      };
      const racc = trans.map((v, k) => {
        const h = Math.max(0.1, Math.min(P.raccord, 0.45 * lens[k] / E, 0.45 * lens[(k + T - 1) % T] / E)) * E;
        const av = marche(v, 1, h), ar = marche(v, -1, h);
        let tx = av.p.X - ar.p.X, ty = av.p.Y - ar.p.Y; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
        const J = pts[v];
        if (J.tF) { const sg = J.tF[0] * tx + J.tF[1] * ty >= 0 ? 1 : -1; tx = J.tF[0] * sg; ty = J.tF[1] * sg; }   // sommet d'angle : bissectrice exacte
        rencontres.push(J);
        if (J.tF) coupesAngle.push({ J, tx, ty, avant: lab[(v + N - 1) % N], apres: lab[v] });
        return { J, plus: { X: Math.round(J.X + tx * h), Y: Math.round(J.Y + ty * h) }, moins: { X: Math.round(J.X - tx * h), Y: Math.round(J.Y - ty * h) }, iPlus: av.apres, iMoins: ar.apres };
      });
      for (let k = 0; k < T; k++) {
        const A = racc[k], Z = racc[(k + 1) % T], v = trans[k], total = pasDe(k);
        const poly = [A.J, A.plus];
        const p0 = (A.iPlus - v + N) % N, p1 = (Z.iMoins - v + N) % N;            // rangs, depuis le début du tronçon, des sommets à garder
        if (p0 <= p1 && p1 <= total) for (let q = p0; q <= p1; q++) poly.push(pts[(v + q) % N]);
        poly.push(Z.moins, Z.J);
        troncons[lab[v]].push(poly);
        const vrai = []; for (let q = 0; q <= total; q++) vrai.push(pts[(v + q) % N]);
        vrais[lab[v]].push(vrai);
      }
    }

    avance(0.25);
    // (2) extrusion perpendiculaire de chaque tronçon
    const Dp = P.debord + P.lecture + 0.1;
    const reclame = {}; let tout = [];
    const allege = l => (l.length > 6 ? [l[0]].concat(dpOuvert(l.slice(1, -1), 3), [l[l.length - 1]]) : l);
    for (const c of couleurs) reclame[c] = inter(union(decale(troncons[c].map(allege), Dp, CL.EndType.etOpenButt)), B);
    // Sommets d'angle : la frontière est la bissectrice, EXACTEMENT, sur toute la largeur du débord. Autour du sommet (demi-disque
    // de rayon débord + 1 mm), chaque couleur renonce au côté de l'autre. Sans cela, l'intérieur de l'angle serait partagé par
    // comparaison de distances, trop grossière quand l'angle est très fermé : la pointe fine serait rabotée.
    {
      const Rc = (P.debord + 1) * E, demi = (J, tx, ty, sens) => {
        const pts = [], a0 = Math.atan2(ty, tx) * 1;                       // demi-disque du côté « sens » (+1 : devant, −1 : derrière)
        for (let q = 0; q <= 16; q++) { const a = a0 - Math.PI / 2 + (Math.PI * q) / 16; pts.push({ X: Math.round(J.X + sens * Rc * Math.cos(a)), Y: Math.round(J.Y + sens * Rc * Math.sin(a)) }); }
        return union([pts]);
      };
      for (const k of coupesAngle) {
        if (k.avant === k.apres || !reclame[k.avant] || !reclame[k.apres]) continue;
        reclame[k.avant] = diff(reclame[k.avant], demi(k.J, k.tx, k.ty, 1));    // la couleur d'avant le sommet ne prend rien devant
        reclame[k.apres] = diff(reclame[k.apres], demi(k.J, k.tx, k.ty, -1));   // celle d'après ne prend rien derrière
      }
    }
    for (const c of couleurs) tout = union(tout, reclame[c]);
    const exclusif = {}; let dispute = [];
    for (const c of couleurs) {
      let autres = []; for (const o of couleurs) if (o !== c) autres = union(autres, reclame[o]);
      exclusif[c] = diff(reclame[c], autres); dispute = union(dispute, inter(reclame[c], autres));
    }

    // (3) zones disputées ou oubliées : au plus proche, composante par composante
    const attribue = {}; for (const c of couleurs) attribue[c] = [];
    const arbreQ = new CL.PolyTree();
    { const cq = new CL.Clipper(); cq.AddPaths(union(dispute, diff(B, tout)), CL.PolyType.ptSubject, true); cq.Execute(CL.ClipType.ctUnion, arbreQ, NZ, NZ); }
    const nPas = Math.ceil((P.debord + P.lecture + 0.3) / P.pas), mg = (P.debord + 1) * E;
    const zonesQ = CL.JS.PolyTreeToExPolygons(arbreQ);
    for (let iq = 0; iq < zonesQ.length; iq++) {
      const ex = zonesQ[iq];
      avance(0.35 + 0.5 * iq / zonesQ.length);
      const comp = [ex.outer, ...ex.holes]; if (aire(comp) < 0.003) continue;
      const bb = boite(comp), loc = {}; let presents = [];
      for (const c of ordre) {
        loc[c] = [];
        for (const t of vrais[c]) {
          let seg = [];
          for (const q of t) {
            if (q.X >= bb[0] - mg && q.X <= bb[2] + mg && q.Y >= bb[1] - mg && q.Y <= bb[3] + mg) seg.push(q);
            else { if (seg.length > 1) loc[c].push(seg); seg = []; }
          }
          if (seg.length > 1) loc[c].push(seg);
        }
        if (loc[c].length) presents.push(c);
      }
      if (!presents.length) continue;
      if (presents.length === 1) { attribue[presents[0]] = union(attribue[presents[0]], comp); continue; }
      // Un point va à la couleur dont le tronçon est le plus proche : il est « réclamé » par c sur l'intervalle de distances
      // ]lo, hi] s'il est à moins de hi de c et à plus de lo de toutes les autres. Si, sur un intervalle, aucun point n'est
      // réclamé par deux couleurs à la fois, inutile de le découper plus finement : le partage y est déjà exact. On ne descend
      // donc au pas le plus fin (P.pas) que là où la frontière passe vraiment — quelques décalages au lieu d'une centaine.
      const memo = {}; for (const c of presents) { memo[c] = new Map(); memo[c].set(0, []); loc[c] = loc[c].map(l => dpOuvert(l, 4)); }
      const tampon = (c, k) => {
        let t = memo[c].get(k);
        if (!t) { t = inter(decale(loc[c], k * P.pas, CL.EndType.etOpenRound), comp); memo[c].set(k, t); }
        return t;
      };
      const reclames = (lo, hi) => presents.map(c => {
        let autres = []; for (const o of presents) if (o !== c) autres = union(autres, tampon(o, lo));
        return diff(tampon(c, hi), autres);
      });
      const parts = presents.map(() => []);
      const affiner = (lo, hi) => {
        const r = reclames(lo, hi);
        if (hi - lo > 1) {
          let somme = 0, tous = []; for (const g of r) { somme += aire(g); tous = union(tous, g); }
          if (somme - aire(tous) > 0.0005) { const mi = (lo + hi) >> 1; affiner(lo, mi); affiner(mi, hi); return; }
        }
        r.forEach((g, i) => { if (g.length) parts[i].push(g); });
      };
      affiner(0, nPas);
      const brut = {}; let pris = [];
      presents.forEach((c, i) => {
        let reg = []; for (const g of parts[i]) reg = union(reg, g);
        brut[c] = diff(reg, pris); pris = union(pris, brut[c]);
      });
      // Frontière nette DANS cette zone seulement (la comparaison par pas laisse des dents de P.pas mm, et la ligne se brise là où
      // le voisin le plus proche change). On travaille sur la LIGNE de partage, jamais sur les surfaces — une zone étroite reste
      // ainsi intacte de part et d'autre : (1) on extrait les lignes de partage, (2) on les simplifie et on arrondit leurs angles,
      // (3) on recoupe la zone avec, (4) chaque morceau va à la couleur qui l'occupait le plus.
      const interieur = decale(comp, -0.015); let lignes = [];
      for (let i = 0; i < presents.length - 1 && interieur.length; i++) {
        if (!brut[presents[i]].length) continue;
        const cl = new CL.Clipper(), arb = new CL.PolyTree();
        cl.AddPaths(brut[presents[i]].map(r => r.concat([r[0]])), CL.PolyType.ptSubject, false); cl.AddPaths(interieur, CL.PolyType.ptClip, true);
        cl.Execute(CL.ClipType.ctIntersection, arb, NZ, NZ);
        lignes = lignes.concat(CL.Clipper.OpenPathsFromPolyTree(arb));
      }
      const murs = [];
      for (const l of lignes) {
        let q = arrondir(dpOuvert(l, P.lissageFrontiere * E), P.arrondi * E);
        if (q.length < 2) continue;
        // prolongée de 0,1 mm à chaque bout pour traverser franchement le bord de la zone
        const allonge = (p0, p1) => { const L = Math.hypot(p1.X - p0.X, p1.Y - p0.Y) || 1; return { X: Math.round(p1.X + (p1.X - p0.X) / L * 100), Y: Math.round(p1.Y + (p1.Y - p0.Y) / L * 100) }; };
        q = [allonge(q[1], q[0])].concat(q, [allonge(q[q.length - 2], q[q.length - 1])]);
        murs.push(q);
      }
      const arbM = new CL.PolyTree();
      { const cm = new CL.Clipper(); cm.AddPaths(murs.length ? diff(comp, decale(murs, 0.002, CL.EndType.etOpenButt)) : comp, CL.PolyType.ptSubject, true); cm.Execute(CL.ClipType.ctUnion, arbM, NZ, NZ); }
      for (const exm of CL.JS.PolyTreeToExPolygons(arbM)) {
        const morceau = [exm.outer, ...exm.holes]; let qui = presents[presents.length - 1], mieux = 0;
        for (const c of presents) { const a = aire(inter(morceau, brut[c])); if (a > mieux) { mieux = a; qui = c; } }
        attribue[qui] = union(attribue[qui], decale(morceau, 0.002));
      }
    }
    for (const c of couleurs) carte[c] = union(exclusif[c], attribue[c]);

    // ce qui n'a été attribué à personne (miettes) va au blanc — pas d'encre dans le doute ; les simples cheveux le long
    // des bords ne comptent pas
    const refuge = carte.blanc ? 'blanc' : (carte.nu ? 'nu' : null);
    if (refuge) { let pris = []; for (const c of couleurs) pris = union(pris, carte[c]); carte[refuge] = union(carte[refuge], ouverture(diff(B, pris), 0.05)); }
  }

  avance(0.85);
  // 3c. le débord déjà en place : celui du calque FondPerdu s'il est fourni (cas réel), sinon la simulation de l'outil
  //     (chaque objet non blanc décalé de 5 mm, empilé comme le visuel)
  const actuel = {}; let couvertA = [];
  const zoneLibre = diff(zone5, couvArt);                              // là où le visuel ne cache pas le débord
  if (fpReel) {
    let dessus = [];                                                   // tout ce qui est déjà posé au-dessus, blanc compris
    for (const o of fpReel) {
      if (!croise(o.b, bK, m5)) continue;
      const d5 = inter(o.g, zoneLibre); if (!d5.length) continue;
      const vis = diff(d5, dessus);
      if (vis.length && o.cle !== 'blanc') { actuel[o.cle] = union(actuel[o.cle] || [], vis); couvertA = union(couvertA, vis); teinte[o.cle] = teinte[o.cle] || o.couleur; }
      dessus = union(dessus, d5);
    }
  } else {
    for (const o of local) {
      if (o.cle === 'blanc') continue;
      const d5 = inter(decale(o.g, P.debord), zoneLibre); if (!d5.length) continue;
      const vis = diff(d5, couvertA);
      if (vis.length) actuel[o.cle] = union(actuel[o.cle] || [], vis);
      couvertA = union(couvertA, d5);
    }
  }

  // 3d. correctifs = carte correcte − ce qui est déjà de la bonne couleur
  //     (le blanc couvre aussi les zones de pièce non imprimées où un débord voisin se verrait)
  // zones de pièce réellement non imprimées. Un simple filet entre le visuel et la coupe (visuel un peu court) n'en est pas une :
  // le débord de couleur doit continuer à s'y voir, on ne le masque surtout pas par du blanc.
  const nonImprime = ouverture(diff(K, couvArt), 0.3);
  const bruts = {};
  for (const c of couleurs) {
    if (c === 'nu') continue;                                          // zone douteuse : on ne corrige rien
    if (c !== 'blanc' && !estAplat(c)) {                               // dégradé, image : pas de correctif en V1, on le dit
      const besoin = sansEclats(diff(carte[c] || [], actuel[c] || []), P.eclatMin);
      if (aire(besoin) > 2) res.doutes.push({ motif: 'dégradé ou image : fond perdu à retoucher à la main à cet endroit', aire: +aire(besoin).toFixed(1), boite: boite(besoin).map(v => +(v / E).toFixed(1)) });
      continue;
    }
    let manque = c === 'blanc' ? inter(carte[c] || [], couvertA) : diff(carte[c] || [], actuel[c] || []);
    manque = sansAiguilles(manque, P.eclatMin, rencontres);            // retire éclats et aiguilles, garde les pointes qui partent d'une rencontre
    if (manque.length && aire(manque) >= P.aireMin) bruts[c] = union(manque);
  }
  // finition. Chaque correctif DÉPASSE de P.depassement mm ce qu'il doit recouvrir, pour ne laisser aucun liseré
  // de l'ancienne couleur sur son pourtour : il déborde sous le visuel, sous les correctifs posés au-dessus de lui,
  // sur sa propre couleur et dans la chute libre — jamais sur la zone d'une autre couleur ni sur une pièce non imprimée.
  const correctifs = {}; const ordreC = Object.keys(bruts);
  for (let i = 0; i < ordreC.length; i++) {
    const c = ordreC[i]; let g = bruts[c];
    let dessus = []; for (let j = i + 1; j < ordreC.length; j++) dessus = union(dessus, bruts[ordreC[j]]);
    let interdit = diff(K, couvArt);                                   // même un simple filet entre le visuel et la coupe
    for (const o of couleurs) if (o !== c) interdit = union(interdit, carte[o] || []);
    interdit = diff(interdit, union(couvArt, dessus));
    g = union(g, diff(decale(g, P.depassement), interdit));
    if (c !== 'blanc') g = inter(g, zone5);                             // une couleur ne dépasse jamais la limite des 5 mm (un blanc, si : il ne s'imprime pas)
    g = decale(decale(g, 0.03), -0.03);                                // referme les fentes capillaires
    g = lisse(g, P.lissage).filter(q => Math.abs(CL.Clipper.Area(q)) > 0.05 * E * E);   // ni miette ni micro-trou : que des tracés fermés francs
    if (g.length) correctifs[c] = g;
  }

  const mm = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, versMm(v)]));
  res.groupes.push({
    boite: bK.map(v => v / E), pieces: groupes[gid].length, couleurs, teintes: teinte,
    K: versMm(K), carte: mm(carte), actuel: mm(actuel), correctifs: mm(correctifs), ordre: Object.keys(correctifs),
    aires: Object.fromEntries(Object.entries(correctifs).map(([k, v]) => [k, +aire(v).toFixed(2)])),
    points: Object.values(correctifs).reduce((s, v) => s + v.reduce((t, p) => t + p.length, 0), 0),
  });
}
if (surProgression) surProgression(1);
for (const g of res.groupes) for (const c of g.ordre) res.correctifs.push({ cle: c, teinte: g.teintes[c], source: sources[c], chemins: g.correctifs[c] });
res.stats = { pieces: pieces.length, chutes: nChutes, groupes: res.groupes.length, multicolores: res.groupes.filter(g => g.couleurs.length > 1).length,
  correctifs: res.correctifs.reduce((n, c) => n + c.chemins.length, 0), secondes: +((Date.now() - t0) / 1000).toFixed(1) };
return res;
}
