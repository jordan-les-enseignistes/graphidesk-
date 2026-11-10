// Fonds perdus intelligents — passerelle entre le relevé Illustrator (fp_intelligent.jsx, étape « export »)
// et le moteur de calcul (moteur.ts), puis du résultat vers la pose des correctifs.
//
// Illustrator travaille en points, axe y vers le HAUT, avec des courbes de Bézier.
// Le moteur travaille en millimètres, axe y vers le BAS, avec des polygones.
// @ts-nocheck — la géométrie passe par clipper-lib, non typée.
import CL from "clipper-lib";
import { calculerFondsPerdus } from "./moteur.ts";

const PT = 25.4 / 72;          // 1 point = 0,3528 mm
const TOLERANCE = 0.02;        // mm : écart maximal entre la courbe et ses segments
const E = 1000;                // unités Clipper par mm

/** Aplatit un sous-chemin Illustrator [[ax,ay, lx,ly, rx,ry], …] en polyligne (mm, y vers le bas). */
function aplatir(sc) {
  const p = sc.p, n = p.length, pts = [];
  if (!n) return pts;
  const X = v => v * PT, Y = v => -v * PT;
  pts.push([X(p[0][0]), Y(p[0][1])]);
  const segments = sc.f ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const a = p[i], b = p[(i + 1) % n];
    const p0 = [X(a[0]), Y(a[1])], p1 = [X(a[4]), Y(a[5])], p2 = [X(b[2]), Y(b[3])], p3 = [X(b[0]), Y(b[1])];
    const fleche = Math.max(
      Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]),
      Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]));
    const k = Math.max(1, Math.ceil(Math.sqrt((0.75 * fleche) / TOLERANCE)));
    for (let j = 1; j <= k; j++) {
      const t = j / k, u = 1 - t;
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
  }
  return pts;
}

const versC = pts => pts.map(q => ({ X: Math.round(q[0] * E), Y: Math.round(q[1] * E) }));
const versMm = paths => paths.map(p => p.map(q => [q.X / E, q.Y / E]));

/** Clé de couleur du moteur à partir de la description Illustrator ('blanc' = pas d'encre). */
export function cleCouleur(desc) {
  if (!desc) return null;
  if (desc === "cmyk:0,0,0,0" || desc === "rgb:255,255,255" || desc === "gris:0") return "blanc";
  if (/^ton:(blanc|white\s*papier)(:|$)/i.test(desc)) return "blanc";       // même convention que l'outil : la nuance « Blanc » = pas d'encre
  return desc;                                                              // 'grad:…', 'motif:…' : pas des aplats, le moteur le sait
}

/** Contour d'un tracé (épaisseur w en points) → polygones, pour savoir ce qui se voit vraiment. */
function contourEnPolygones(sousChemins, wPt) {
  const co = new CL.ClipperOffset(2, 0.01 * E), sol = [];
  for (const sc of sousChemins) {
    const pl = versC(aplatir(sc)); if (pl.length < 2) continue;
    co.AddPath(pl, CL.JoinType.jtRound, sc.f ? CL.EndType.etClosedLine : CL.EndType.etOpenButt);
  }
  co.Execute(sol, (wPt * PT * E) / 2);
  return versMm(sol);
}

function intersecter(chemins, pairImpair, masque) {
  const c = new CL.Clipper(), sol = [];
  c.AddPaths(chemins.map(versC), CL.PolyType.ptSubject, true);
  c.AddPaths(masque.map(versC), CL.PolyType.ptClip, true);
  c.Execute(CL.ClipType.ctIntersection, sol, pairImpair ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero, CL.PolyFillType.pftEvenOdd);
  return versMm(sol);
}

/** Convertit un calque relevé (du dessus vers le dessous) en objets pour le moteur. */
function objets(feuilles, masques, avecSource) {
  const liste = [];
  const masquesMm = masques.map(m => m.map(aplatir).filter(p => p.length >= 3));
  for (const f of feuilles) {
    const pousse = (cle, chemins, pairImpair, contour) => {
      if (!cle || !chemins.length) return;
      for (const m of f.m || []) { chemins = intersecter(chemins, pairImpair, masquesMm[m] || []); pairImpair = false; if (!chemins.length) return; }
      const o = { cle, pairImpair, chemins };
      if (avecSource) { o.source = f.i; o.contour = contour; }
      liste.push(o);
    };
    if (f.g === "image" || f.g === "texte") { pousse("photo:" + f.i, f.c.map(aplatir), false, false); continue; }
    // le contour se dessine au-dessus du fond du même objet
    if (f.s && f.s.w > 0) pousse(cleCouleur(f.s.c), contourEnPolygones(f.c, f.s.w), false, true);
    if (f.f) pousse(cleCouleur(f.f), f.c.map(aplatir).filter(p => p.length >= 3), !!f.eo, false);
  }
  return liste;
}

/** Relevé Illustrator → entrée du moteur. */
export function versEntreeMoteur(geo) {
  const art = objets(geo.art || [], geo.masques || [], true);
  const fp = objets(geo.fp || [], geo.masques || [], false);
  const coupe = (geo.coupe || []).map(sc => {
    const pts = aplatir(sc);
    const ferme = !!sc.f || (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01);
    return { ferme, pts };
  }).filter(c => c.pts.length >= 2);
  // d'où vient la couleur de chaque clé : rang de l'objet du visuel, et s'il s'agit de son contour
  const origine = {};
  for (const o of art) if (!(o.cle in origine)) origine[o.cle] = { source: o.source, contour: !!o.contour };
  return { art, fp, coupe, origine };
}

/** Résultat du moteur → correctifs à dessiner (points, y vers le haut, une « forme » = un contour extérieur + ses trous). */
export function versCorrectifsIllustrator(res, origine) {
  const sortie = [];
  const pt = q => [Math.round((q.X / E / PT) * 1000) / 1000, Math.round((-q.Y / E / PT) * 1000) / 1000];
  for (const c of res.correctifs) {
    const blanc = c.cle === "blanc";
    const o = origine[c.cle];
    if (!blanc && !o) continue;                                  // couleur sans objet d'origine : rien à poser
    const arbre = new CL.PolyTree(), cl = new CL.Clipper();
    cl.AddPaths(c.chemins.map(versC), CL.PolyType.ptSubject, true);
    cl.Execute(CL.ClipType.ctUnion, arbre, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
    const formes = CL.JS.PolyTreeToExPolygons(arbre).map(ex => [ex.outer, ...ex.holes].map(r => r.map(pt)));
    if (formes.length) sortie.push({ cle: c.cle, blanc, source: o ? o.source : -1, contour: o ? o.contour : false, formes });
  }
  return sortie;
}

/** Doutes du moteur → boîtes en points pour les cercles de repérage. */
export function versDoutesIllustrator(res) {
  return res.doutes.filter(d => d.boite).map(d => ({
    motif: d.motif,
    boite: [d.boite[0] / PT, -d.boite[1] / PT, d.boite[2] / PT, -d.boite[3] / PT].map(v => Math.round(v * 100) / 100),
  }));
}

/**
 * Chaîne complète : relevé Illustrator → correctifs et doutes prêts à être posés.
 * `surProgression`, facultatif, reçoit l'avancement du calcul, de 0 à 1.
 */
export function calculerDepuisIllustrator(geo, surProgression) {
  const entree = versEntreeMoteur(geo);
  if (!entree.coupe.length) throw new Error("aucun trait de coupe sur le calque CutContour");
  if (!entree.art.length) throw new Error("aucun objet sur le calque Artwork");
  const res = calculerFondsPerdus({ art: entree.art, coupe: entree.coupe, fp: entree.fp }, surProgression);
  return {
    correctifs: versCorrectifsIllustrator(res, entree.origine),
    doutes: versDoutesIllustrator(res),
    stats: res.stats,
  };
}
