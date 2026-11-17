// Lettres rétroéclairées sur entretoises — passerelle entre le relevé Illustrator (retro_entretoises.jsx)
// et le moteur (moteur.ts), puis du résultat vers ce qu'Illustrator dessine.
//
// Illustrator travaille en points, axe y vers le HAUT, avec des courbes de Bézier.
// Le moteur travaille en millimètres, axe y vers le BAS, avec des polygones.
// @ts-nocheck — données venues d'Illustrator, non typées.
import { aplatir } from "../fondPerdu/illustrator.ts";
import { calculerRetro, finaliserRetro } from "./moteur.ts";

const PT = 25.4 / 72; // 1 point = 0,3528 mm

/** sous-chemins relevés [{ o: n° d'objet, f: fermé, p: [[ax,ay, lx,ly, rx,ry]…] }] → tracés du moteur (mm, y vers le bas) */
function traces(liste) {
  return (liste || []).map((sc) => {
    const pts = aplatir(sc);
    const ferme = !!sc.f || (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01);
    if (ferme && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01) pts.pop();
    return { ferme, objet: sc.o, pts };
  }).filter((c) => c.pts.length >= 2);
}

const versPt = (q) => [Math.round((q[0] / PT) * 1000) / 1000, Math.round((-q[1] / PT) * 1000) / 1000];
const boitePt = (b) => [b[0] / PT, -b[1] / PT, b[2] / PT, -b[3] / PT].map((v) => Math.round(v * 100) / 100);
const bloquants = (doutes) => doutes.filter((d) => !d.info && d.boite).map((d) => ({ motif: d.motif, boite: boitePt(d.boite) }));

/** « Placer » : relevé de la découpe → rainure, entretoises et points bloquants, en points Illustrator. */
export function placerDepuisIllustrator(geo, parametres, surProgression) {
  const coupe = traces(geo.coupe);
  if (!coupe.some((c) => c.ferme)) throw new Error("aucun tracé de découpe fermé trouvé");
  const res = calculerRetro({ coupe }, { ...parametres, rainureEntiere: true }, surProgression);
  const infos = {};
  for (const d of res.doutes) if (d.info) {
    const cle = d.motif.startsWith("bord non éclairé") ? "bordsNonEclaires" : d.motif.startsWith("lettre fine") ? "lettresFines" : d.motif.startsWith("passage de câble") ? "piecesAvecCable" : "autres";
    infos[cle] = (infos[cle] || 0) + 1;
  }
  return {
    rainure: res.rainure.map((forme) => forme.map((anneau) => anneau.map(versPt))),
    etroit: res.etroit.map((forme) => forme.map((anneau) => anneau.map(versPt))),
    entretoises: res.entretoises.map((e) => ({ x: Math.round((e.x / PT) * 1000) / 1000, y: Math.round((-e.y / PT) * 1000) / 1000, mode: e.mode })),
    diametre: res.parametres.diametre / PT,
    doutes: bloquants(res.doutes),
    infos,
    stats: res.stats,
  };
}

/** « Finaliser » : relevé de la découpe, de la rainure entière et des entretoises → rainure finale et points bloquants. */
export function finaliserDepuisIllustrator(geo, parametres) {
  const coupe = traces(geo.coupe);
  if (!coupe.some((c) => c.ferme)) throw new Error("aucun tracé de découpe fermé trouvé");
  const entretoises = (geo.entretoises || []).map((e) => ({ x: e.x * PT, y: -e.y * PT, d: e.d * PT }));
  const res = finaliserRetro({ coupe, rainure: traces(geo.rainure), entretoises }, parametres);
  return {
    rainure: res.rainure.map((forme) => forme.map((anneau) => anneau.map(versPt))),
    etroit: res.etroit.map((forme) => forme.map((anneau) => anneau.map(versPt))),
    doutes: bloquants(res.doutes),
    stats: res.stats,
  };
}
