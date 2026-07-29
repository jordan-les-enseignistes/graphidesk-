// ============================================================
// Simulation 3D — Lettres relief sur entretoises (BAT)
// ============================================================
// Construit une scène Three.js à partir du SVG exporté d'Illustrator
// (tracé de découpe des lettres) et des entretoises RÉELLES relevées
// sur le calque ENTRETOISES_PREVIEW.
//
// Le SVG ne sert QU'À LA GÉOMÉTRIE : les couleurs du rendu sont
// choisies dans l'interface (le fichier de FAB est en CMJN, ses
// couleurs techniques rose/vert n'ont rien à faire sur un BAT).
//
// Repère métier : 1 unité Three.js = 1 mm réel.
//   - les lettres occupent z ∈ [0, épaisseur] (face avant vers +z)
//   - le mur est en z = -déport (déport = longueur des entretoises)

import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
// Matériaux de mur : photos + cartes de relief embarquées dans le binaire
import betonCouleur from "@/assets/textures/beton.jpg";
import betonRelief from "@/assets/textures/beton_relief.jpg";
import briqueCouleur from "@/assets/textures/brique.jpg";
import briqueRelief from "@/assets/textures/brique_relief.jpg";
import crepiCouleur from "@/assets/textures/crepi.jpg";
import crepiRelief from "@/assets/textures/crepi_relief.jpg";
import bardageCouleur from "@/assets/textures/bardage.jpg";
import bardageRelief from "@/assets/textures/bardage_relief.jpg";
import carrelageCouleur from "@/assets/textures/carrelage.jpg";
import carrelageRelief from "@/assets/textures/carrelage_relief.jpg";

export type VueNom =
  | "face"
  | "troisQuartsGauche"
  | "troisQuartsDroit"
  | "profilGauche"
  | "profilDroit"
  | "plongee"
  | "contrePlongee"
  | "rasant";

export const VUES: { valeur: VueNom; label: string }[] = [
  { valeur: "face", label: "Face" },
  { valeur: "troisQuartsGauche", label: "3/4 gauche" },
  { valeur: "troisQuartsDroit", label: "3/4 droit" },
  { valeur: "profilGauche", label: "Profil gauche" },
  { valeur: "profilDroit", label: "Profil droit" },
  { valeur: "plongee", label: "Plongée" },
  { valeur: "contrePlongee", label: "Contre-plongée" },
  { valeur: "rasant", label: "Rasant (relief marqué)" },
];

export interface Entretoise {
  /** mm depuis le bord GAUCHE des lettres */
  xMm: number;
  /** mm depuis le bord HAUT des lettres (y vers le bas, repère Illustrator) */
  yMm: number;
  dMm: number;
}

export interface Relief3dInput {
  svg: string;
  /** largeur réelle des lettres en mm (après application de l'échelle du fichier) */
  wMm: number;
  hMm: number;
  entretoises: Entretoise[];
  /** lisses dessinées par le graphiste (mode manuel) */
  lisses?: LisseFichier[];
}

export type MotifMur = "uni" | "beton" | "brique" | "crepi" | "bardage" | "carrelage";

export const MOTIFS_MUR: { valeur: MotifMur; label: string; couleur: string }[] = [
  { valeur: "uni", label: "Uni", couleur: "#5a5a5a" },
  // teinte blanche : la photo s'affiche telle quelle, le graphiste peut
  // ensuite l'assombrir ou la colorer avec la palette
  { valeur: "beton", label: "Béton", couleur: "#ffffff" },
  { valeur: "brique", label: "Brique", couleur: "#ffffff" },
  { valeur: "crepi", label: "Crépi", couleur: "#ffffff" },
  { valeur: "bardage", label: "Bardage", couleur: "#ffffff" },
  { valeur: "carrelage", label: "Carrelage", couleur: "#ffffff" },
];

/**
 * Matériaux photographiques embarqués dans l'application (ambientCG, licence
 * CC0 : usage commercial et redistribution libres, sans attribution).
 * Les images sont compilées dans le binaire : aucun accès réseau à l'usage.
 *
 * `tuileMm` = taille RÉELLE couverte par une image. C'est ce qui donne
 * l'échelle : une brique doit mesurer 21 cm sur le mur, pas « à peu près ».
 */
const MATIERES: Record<
  Exclude<MotifMur, "uni">,
  { couleur: string; relief: string; tuileMm: number; forceRelief: number }
> = {
  beton: { couleur: betonCouleur, relief: betonRelief, tuileMm: 2400, forceRelief: 0.6 },
  brique: { couleur: briqueCouleur, relief: briqueRelief, tuileMm: 1800, forceRelief: 1 },
  crepi: { couleur: crepiCouleur, relief: crepiRelief, tuileMm: 1000, forceRelief: 0.7 },
  bardage: { couleur: bardageCouleur, relief: bardageRelief, tuileMm: 1000, forceRelief: 1 },
  carrelage: { couleur: carrelageCouleur, relief: carrelageRelief, tuileMm: 2000, forceRelief: 0.8 },
};

/** Les textures sont chargées UNE fois et réutilisées : la scène est
 *  reconstruite à chaque réglage, un rechargement ferait clignoter le mur. */
const cacheTextures = new Map<string, THREE.Texture>();

function chargerTexture(url: string, couleur: boolean): THREE.Texture {
  const cle = url + (couleur ? "|c" : "|n");
  const dejaLa = cacheTextures.get(cle);
  if (dejaLa) return dejaLa;
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // ⚠ seule la photo est en espace sRGB ; une carte de relief interprétée
  // comme une couleur donnerait un éclairage faux
  if (couleur) tex.colorSpace = THREE.SRGBColorSpace;
  cacheTextures.set(cle, tex);
  return tex;
}


/** Largeur du chant conservé au dos d'un caisson rétroéclairé (mm) —
 *  c'est la bande sur laquelle se vissent les entretoises. */
const CHANT_MM = 4;

export type Fixation = "entretoises" | "lisses" | "tiges" | "aplat";
export type Eclairage = "aucun" | "face" | "retro" | "rampe" | "spot";

/** Une lisse relevée dans le fichier du graphiste (repère des lettres, mm) */
export interface LisseFichier {
  /** centre */
  xMm: number;
  yMm: number;
  longueurMm: number;
  epaisseurMm: number;
  /** inclinaison en degrés, repère mm (y vers le bas) */
  angleDeg: number;
}

export const FIXATIONS: { valeur: Fixation; label: string }[] = [
  { valeur: "entretoises", label: "Sur entretoises" },
  { valeur: "lisses", label: "Sur lisses (30 × 30)" },
  { valeur: "tiges", label: "Sur tiges filetées" },
  { valeur: "aplat", label: "À plat contre le mur" },
];

export const ECLAIRAGES: { valeur: Eclairage; label: string }[] = [
  { valeur: "aucun", label: "Éteint" },
  { valeur: "face", label: "Lumineux en façade" },
  { valeur: "retro", label: "Rétroéclairé (halo au mur)" },
  { valeur: "rampe", label: "Rampe (barre sur la longueur)" },
  { valeur: "spot", label: "Spots" },
];

/** Un « mot » = groupe de lettres proches, porté par sa propre structure de
 *  lisses (deux mots distincts = deux châssis, jamais une barre géante). */
export interface GroupeMot {
  xMinMm: number;
  xMaxMm: number;
  yMinMm: number;
  yMaxMm: number;
  /** index des contours appartenant au groupe */
  indices: number[];
}

export interface Relief3dOptions {
  fixation: Fixation;
  eclairage: Eclairage;
  /** couleur émise au dos (rétroéclairage) — indépendante de la face :
   *  la source est derrière, elle ne « voit » pas l'adhésif de façade */
  couleurHalo: string;
  /** lisses : section carrée (30 mm standard atelier) */
  sectionLisseMm: number;
  /** lisses : nombre par mot (2 = une haute, une basse) */
  nbLisses: number;
  /** lisses : retrait depuis le haut et le bas des lettres, en % de leur hauteur */
  retraitLissePct: number;
  /** habiller les lettres avec les couleurs LUES dans le fichier Illustrator */
  couleursDuFichier: boolean;
  /** tiges filetées : diamètre (une simple tige, bien plus fine qu'une entretoise) */
  tigeDiamMm: number;
  /** tranche identique à la face (chaque lettre garde SA couleur sur le chant) */
  trancheCommeFace: boolean;
  /** dos des lettres — blanc d'usine par défaut */
  couleurArriere: string;
  /** lisses : calculées par GraphiDesk, ou reprises de la sélection Illustrator */
  lissesAuto: boolean;
  /** rampe : longueur en % de la largeur de l'enseigne */
  rampeLongueurPct: number;
  /** spots : nombre de projecteurs répartis devant l'enseigne */
  nbSpots: number;
  /** couleur du CORPS de la rampe (la peinture du profilé) */
  couleurRampe: string;
  /** couleur du CORPS des spots */
  couleurSpots: string;
  /** couleur de la LUMIÈRE émise par la rampe */
  couleurLumiereRampe: string;
  /** couleur de la LUMIÈRE émise par les spots */
  couleurLumiereSpots: string;
  /** peinture des lisses — métal brut par défaut */
  couleurLisse: string;
  /** matière du mur de fond (béton, brique…) */
  motifMur: MotifMur;
  /** lettres sur entretoises, elles-mêmes vissées SUR les lisses */
  entretoisesSurLisses: boolean;
  /** épaisseur des lettres (PVC 19 mm par défaut) */
  epaisseurMm: number;
  /** longueur des entretoises = écart mur ↔ dos des lettres */
  deportMm: number;
  /** diamètre utilisé pour le placement automatique */
  entretoiseDiamMm: number;
  /** placer les entretoises automatiquement quand le fichier n'en a pas */
  entretoisesAuto: boolean;
  /** distance max entre un point de lettre et une entretoise */
  couvertureMm: number;
  /** garde entre le bord de l'entretoise et le tracé de découpe */
  gardeMm: number;
  halo: boolean;
  /** 0 → 2 : intensité du rétroéclairage sur le mur */
  haloIntensite: number;
  couleurFace: string;
  couleurTranche: string;
  couleurMur: string;
  couleurEntretoise: string;
}

export const RELIEF3D_DEFAUTS: Relief3dOptions = {
  epaisseurMm: 19,
  deportMm: 30,
  entretoiseDiamMm: 9,
  entretoisesAuto: true,
  couvertureMm: 150,
  gardeMm: 2,
  // par défaut l'enseigne est posée à plat sur le mur : c'est l'état le
  // plus neutre pour démarrer un BAT, on ajoute la fixation ensuite
  fixation: "aplat",
  // cohérent avec la pose à plat : sans déport, aucun halo n'est possible.
  // Le rétroéclairage s'active en même temps qu'un système de fixation.
  eclairage: "aucun",
  couleurHalo: "#ffffff",
  sectionLisseMm: 30,
  nbLisses: 2,
  retraitLissePct: 18,
  couleursDuFichier: true,
  tigeDiamMm: 3,
  trancheCommeFace: false,
  couleurArriere: "#ffffff",
  lissesAuto: true,
  rampeLongueurPct: 100,
  nbSpots: 3,
  couleurRampe: "#2f3338",
  couleurSpots: "#2f3338",
  halo: true,
  haloIntensite: 1,
  couleurFace: "#f5f5f5",
  couleurTranche: "#ffffff",
  couleurMur: "#5a5a5a",
  couleurEntretoise: "#9aa0a6",
  // métal brut par défaut ; le graphiste les peint s'il le souhaite
  couleurLisse: "#9aa0a6",
  entretoisesSurLisses: false,
  motifMur: "uni",
  couleurLumiereRampe: "#ffffff",
  couleurLumiereSpots: "#ffffff",
};

/** Silhouette floutée des lettres → texture de halo projetée sur le mur.
 *  (Le vrai rétroéclairage — une source lumineuse par lettre — coûterait
 *  une lumière par contour ; la silhouette floutée donne le même rendu
 *  qu'une photo de nuit pour une fraction du coût.) */
function textureHalo(
  contours: Contours,
  wMm: number,
  hMm: number,
  margeMm: number,
  flouMm: number
): THREE.Texture | null {
  const totalW = wMm + 2 * margeMm;
  const totalH = hMm + 2 * margeMm;
  const px = 1024;
  const scale = px / Math.max(totalW, totalH);
  const cw = Math.max(2, Math.round(totalW * scale));
  const ch = Math.max(2, Math.round(totalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  // pixels canvas ← mm (origine lettres) ← unités SVG
  ctx.translate(margeMm * scale, margeMm * scale);
  ctx.scale(scale * contours.k, scale * contours.k);
  ctx.translate(-contours.box.min.x, -contours.box.min.y);
  ctx.filter = `blur(${Math.max(2, flouMm * scale)}px)`;
  ctx.fillStyle = "#ffffff";

  const tracer = (path: Path2D, pts: THREE.Vector2[]) => {
    if (pts.length < 2) return;
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
    path.closePath();
  };
  for (const shape of contours.shapes) {
    const path = new Path2D();
    tracer(path, shape.getPoints(24));
    // les contre-formes (intérieur du O, du P...) ne doivent pas rayonner
    for (const trou of shape.holes) tracer(path, trou.getPoints(24));
    ctx.fill(path, "evenodd");
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Placement AUTOMATIQUE des entretoises, sans passer par Illustrator.
 * Même règle métier que le script de FAB : aucun point de lettre à plus
 * de `couvertureMm` d'une entretoise, et un bord d'entretoise toujours à
 * au moins `gardeMm` du tracé de découpe.
 *
 * Méthode : on rastérise les lettres (avec leurs contre-formes), on
 * calcule la distance au bord de chaque point intérieur, puis on pose
 * gloutonnement les entretoises sur les points les PLUS ÉLOIGNÉS du bord
 * (donc bien au cœur de la matière) jusqu'à couvrir toute la surface.
 */
export function placerEntretoisesAuto(
  contours: Contours,
  wMm: number,
  hMm: number,
  reglages: { couvertureMm: number; gardeMm: number; diamMm: number }
): Entretoise[] {
  const m = construireMasque(contours, wMm, hMm);
  if (!m) return [];
  const { cw, ch, dist, MM_PAR_PX, PAD } = m;

  const rayonMini = (reglages.diamMm / 2 + reglages.gardeMm) / MM_PAR_PX;
  const couverturePx = reglages.couvertureMm / MM_PAR_PX;
  // points intérieurs à couvrir + candidats capables d'accueillir un pied
  const aCouvrir: number[] = [];
  const candidats: number[] = [];
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] <= 0) continue;
    aCouvrir.push(i);
    if (dist[i] >= rayonMini) candidats.push(i);
  }
  if (candidats.length === 0) return [];
  // On privilégie les points JUSTE assez éloignés du tracé : en atelier les
  // entretoises se posent près du bord de la lettre, pas en plein milieu.
  // Le tri croissant sur la distance au bord donne exactement ça, la règle
  // de couverture continuant d'assurer la répartition.
  candidats.sort((a, b) => dist[a] - dist[b]);

  const couvert = new Uint8Array(dist.length);
  const restant = new Set(aCouvrir);
  const poses: Entretoise[] = [];
  const couv2 = couverturePx * couverturePx;

  for (const c of candidats) {
    if (restant.size === 0 || poses.length >= 400) break;
    if (couvert[c]) continue;
    const cx = c % cw;
    const cy = Math.floor(c / cw);
    // marque tout ce que cette entretoise couvre
    const r = Math.ceil(couverturePx);
    for (let y = Math.max(0, cy - r); y <= Math.min(ch - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(cw - 1, cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > couv2) continue;
        const i = y * cw + x;
        if (dist[i] > 0 && !couvert[i]) {
          couvert[i] = 1;
          restant.delete(i);
        }
      }
    }
    poses.push({
      xMm: (cx - PAD) * MM_PAR_PX,
      yMm: (cy - PAD) * MM_PAR_PX,
      dMm: reglages.diamMm,
    });
  }
  return poses;
}

interface Masque extends MasqueLettres {
  cw: number;
  ch: number;
  dist: Float64Array;
  MM_PAR_PX: number;
  PAD: number;
}

/**
 * Rastérise les lettres et calcule, pour chaque point intérieur, sa distance
 * au tracé de découpe. Sert au placement des entretoises (au mur comme sur
 * les lisses) : c'est ce qui garantit qu'un pied ne déborde jamais.
 */
export function construireMasque(
  contours: Contours,
  wMm: number,
  hMm: number
): Masque | null {
  const { shapes, box, k } = contours;
  if (shapes.length === 0 || wMm <= 0) return null;

  const MM_PAR_PX = 2;
  // ⚠ marge indispensable : sans elle, les lettres touchent le bord du
  // raster, la distance au bord y est surestimée (il n'y a pas de « dehors »
  // au-delà du canvas) et des entretoises se posent à ras du tracé.
  const PAD = 8;
  const cw = Math.max(4, Math.round(wMm / MM_PAR_PX)) + 2 * PAD;
  const ch = Math.max(4, Math.round(hMm / MM_PAR_PX)) + 2 * PAD;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(PAD, PAD);
  ctx.scale(k / MM_PAR_PX, k / MM_PAR_PX);
  ctx.translate(-box.min.x, -box.min.y);
  ctx.fillStyle = "#fff";
  const tracer = (p: Path2D, pts: THREE.Vector2[]) => {
    if (pts.length < 2) return;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    p.closePath();
  };
  for (const s of shapes) {
    const p = new Path2D();
    tracer(p, s.getPoints(24));
    for (const trou of s.holes) tracer(p, trou.getPoints(24));
    ctx.fill(p, "evenodd");
  }
  ctx.restore();

  const img = ctx.getImageData(0, 0, cw, ch).data;
  // distance au bord (chamfer 2 passes), en pixels
  const INF = 1e9;
  const dist = new Float64Array(cw * ch);
  for (let i = 0, p = 0; i < dist.length; i++, p += 4) {
    dist[i] = img[p] > 127 ? INF : 0;
  }
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (y > 0) d = Math.min(d, dist[i - cw] + 1);
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0 && x > 0) d = Math.min(d, dist[i - cw - 1] + 1.414);
      if (y > 0 && x < cw - 1) d = Math.min(d, dist[i - cw + 1] + 1.414);
      dist[i] = d;
    }
  }
  for (let y = ch - 1; y >= 0; y--) {
    for (let x = cw - 1; x >= 0; x--) {
      const i = y * cw + x;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (y < ch - 1) d = Math.min(d, dist[i + cw] + 1);
      if (x < cw - 1) d = Math.min(d, dist[i + 1] + 1);
      if (y < ch - 1 && x < cw - 1) d = Math.min(d, dist[i + cw + 1] + 1.414);
      if (y < ch - 1 && x > 0) d = Math.min(d, dist[i + cw - 1] + 1.414);
      dist[i] = d;
    }
  }

  return {
    cw,
    ch,
    dist,
    MM_PAR_PX,
    PAD,
    /** distance au tracé de découpe, en mm (0 = hors matière) */
    distanceBordMm(xMm: number, yMm: number): number {
      const x = Math.round(xMm / MM_PAR_PX) + PAD;
      const y = Math.round(yMm / MM_PAR_PX) + PAD;
      if (x < 0 || y < 0 || x >= cw || y >= ch) return 0;
      return dist[y * cw + x] * MM_PAR_PX;
    },
  };
}

/**
 * Découpe l'enseigne en MOTS : on projette les contours sur l'axe
 * horizontal et on coupe là où le blanc dépasse un seuil proportionnel à
 * la hauteur des lettres. Deux mots distincts reçoivent ainsi chacun leur
 * structure de lisses, au lieu d'un châssis unique démesuré.
 * Le point du « i » reste rattaché à son fût : leurs plages horizontales
 * se recouvrent, donc le même groupe les absorbe.
 */
export function grouperMots(contours: Contours, hMm: number): GroupeMot[] {
  const { shapes, box, k } = contours;
  if (shapes.length === 0) return [];

  const mm = (v: number, min: number) => (v - min) * k;
  const boites = shapes.map((s, i) => {
    const b = new THREE.Box2();
    for (const p of s.getPoints(16)) b.expandByPoint(p);
    return {
      i,
      xMin: mm(b.min.x, box.min.x),
      xMax: mm(b.max.x, box.min.x),
      yMin: mm(b.min.y, box.min.y),
      yMax: mm(b.max.y, box.min.y),
    };
  });
  boites.sort((a, b) => a.xMin - b.xMin);

  // un blanc supérieur à ~35 % de la hauteur des lettres = séparation de mots
  const seuil = Math.max(20, hMm * 0.35);
  const groupes: GroupeMot[] = [];
  let courant: GroupeMot | null = null;
  for (const b of boites) {
    if (courant && b.xMin - courant.xMaxMm <= seuil) {
      courant.xMaxMm = Math.max(courant.xMaxMm, b.xMax);
      courant.yMinMm = Math.min(courant.yMinMm, b.yMin);
      courant.yMaxMm = Math.max(courant.yMaxMm, b.yMax);
      courant.indices.push(b.i);
    } else {
      courant = {
        xMinMm: b.xMin,
        xMaxMm: b.xMax,
        yMinMm: b.yMin,
        yMaxMm: b.yMax,
        indices: [b.i],
      };
      groupes.push(courant);
    }
  }
  return groupes;
}

/**
 * Sépare les deux CAPOTS de l'extrusion pour pouvoir habiller la face avant
 * et la face arrière différemment.
 *
 * ExtrudeGeometry range ses triangles en deux lots : les capots (avant +
 * arrière confondus) puis les tranches. On repère la frontière entre les
 * deux capots par leur cote en z, et on réécrit les groupes en trois :
 *   0 = face avant, 1 = dos, 2 = tranches.
 *
 * ⚠ C'est la SEULE façon correcte de colorer le dos : une plaque rapportée
 * derrière les lettres, même de quelques dixièmes, se décale en perspective
 * et trahit un liseré tout autour des lettres.
 */
function separerCapots(geo: THREE.BufferGeometry, epaisseurMm: number): boolean {
  const pos = geo.getAttribute("position");
  if (!pos || geo.groups.length === 0) return false;

  // ⚠ ExtrudeGeometry crée un couple de groupes PAR CONTOUR (capots puis
  // tranches, forme après forme) : ne traiter que le premier reviendrait à
  // ne plus afficher les autres lettres du même bloc de couleur.
  const anciens = geo.groups.map((g) => ({ ...g }));
  const zDe = (i: number) => pos.getZ(i);
  const nouveaux: { start: number; count: number; materialIndex: number }[] = [];

  for (const g of anciens) {
    if (g.materialIndex !== 0) {
      // tranches : simple renumérotation
      nouveaux.push({ start: g.start, count: g.count, materialIndex: 2 });
      continue;
    }
    const fin = g.start + g.count;
    const zPremier = zDe(g.start);
    let i = g.start;
    while (i < fin && Math.abs(zDe(i) - zPremier) < 1e-4) i += 3;
    // le capot situé à l'épaisseur regardera le mur une fois la géométrie
    // retournée (voir la rotation appliquée au maillage)
    const premierEstDos = Math.abs(zPremier - epaisseurMm) < 1e-3;
    if (i <= g.start || i >= fin) {
      // un seul capot identifiable : on ne prend pas de risque
      nouveaux.push({ start: g.start, count: g.count, materialIndex: 0 });
      continue;
    }
    nouveaux.push({
      start: g.start,
      count: i - g.start,
      materialIndex: premierEstDos ? 1 : 0,
    });
    nouveaux.push({ start: i, count: fin - i, materialIndex: premierEstDos ? 0 : 1 });
  }

  geo.clearGroups();
  for (const g of nouveaux) geo.addGroup(g.start, g.count, g.materialIndex);
  return true;
}

/** Une lisse, décrite dans le repère incliné de son mot. */
interface Rail {
  uMin: number;
  uMax: number;
  /** position perpendiculaire à la ligne des lettres */
  v: number;
  /** inclinaison du mot, en radians (repère mm, y vers le bas) */
  angle: number;
  longueur: number;
}


/**
 * Entretoises posées SUR LES LISSES (et non au mur).
 * Une entretoise ne peut exister qu'à un croisement : il lui faut une lisse
 * dessous pour se visser, et de la matière de lettre devant pour se fixer.
 * On parcourt donc chaque lisse et on ne retient que les points qui tombent
 * dans une lettre, avec la garde au tracé, espacés de `pasMm`.
 */
export function placerEntretoisesSurLisses(
  masque: MasqueLettres,
  rails: { uMin: number; uMax: number; v: number; angle: number }[],
  reglages: { pasMm: number; gardeMm: number; diamMm: number }
): Entretoise[] {
  const out: Entretoise[] = [];
  const rayonMini = reglages.diamMm / 2 + reglages.gardeMm;
  for (const r of rails) {
    const cos = Math.cos(r.angle), sin = Math.sin(r.angle);
    const longueur = r.uMax - r.uMin;
    const n = Math.max(1, Math.floor(longueur / Math.max(20, reglages.pasMm)));
    // on balaie finement pour trouver les zones tenables, puis on espace
    let dernierU = -Infinity;
    const pasFin = Math.max(4, longueur / 400);
    for (let u = r.uMin; u <= r.uMax; u += pasFin) {
      const x = u * cos - r.v * sin;
      const y = u * sin + r.v * cos;
      if (masque.distanceBordMm(x, y) < rayonMini) continue;
      if (u - dernierU < longueur / (n + 1) - pasFin) continue;
      dernierU = u;
      out.push({ xMm: x, yMm: y, dMm: reglages.diamMm });
    }
  }
  return out;
}

/** Masque des lettres + distance au tracé, réutilisable par les placements */
export interface MasqueLettres {
  distanceBordMm(xMm: number, yMm: number): number;
}

/**
 * Masque d'ouverture du fond : opaque sur le CHANT (la bande de matière
 * conservée au bord, sur laquelle se vissent les entretoises), transparent
 * au-delà. C'est ce qui donne un caisson ouvert et non une lettre évidée
 * jusqu'au bord.
 */
function textureChant(
  contours: Contours,
  wMm: number,
  hMm: number,
  chantMm: number
): THREE.Texture | null {
  const masque = construireMasque(contours, wMm, hMm);
  if (!masque) return null;
  const { cw, ch, dist, MM_PAR_PX } = masque;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(cw, ch);
  const seuil = chantMm / MM_PAR_PX;
  for (let i = 0; i < dist.length; i++) {
    // dans la matière ET à moins de `chant` du bord → on garde la matière
    const garde = dist[i] > 0 && dist[i] <= seuil ? 255 : 0;
    const p = i * 4;
    img.data[p] = garde;
    img.data[p + 1] = garde;
    img.data[p + 2] = garde;
    img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  // le repère du masque part du coin HAUT-gauche : pas de retournement
  tex.flipY = false;

  // ExtrudeGeometry fabrique les coordonnées de texture des capots à partir
  // des coordonnées du CONTOUR (unités SVG, avant mise à l'échelle) : on
  // recale donc la texture sur ce repère, marge du masque comprise.
  const { k, box } = contours;
  const totalW = masque.cw * MM_PAR_PX;
  const totalH = masque.ch * MM_PAR_PX;
  const padMm = masque.PAD * MM_PAR_PX;
  tex.repeat.set(k / totalW, k / totalH);
  tex.offset.set(
    (-box.min.x * k + padMm) / totalW,
    (-box.min.y * k + padMm) / totalH
  );
  return tex;
}

/** Contours bruts du SVG + la transformation vers les mm réels.
 *  On ne touche JAMAIS aux contours eux-mêmes : c'est la géométrie
 *  extrudée (et le contexte 2D du halo) qu'on met à l'échelle. */
interface Contours {
  shapes: THREE.Shape[];
  /** couleur de remplissage LUE DANS LE FICHIER, contour par contour */
  couleurs: string[];
  box: THREE.Box2;
  /** unités SVG → mm */
  k: number;
}

export class Relief3dScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private groupe: THREE.Group = new THREE.Group();
  private raf = 0;
  private input: Relief3dInput;
  private options: Relief3dOptions;
  /** contours du SVG (unités d'origine) + facteur vers les mm */
  private contours: Contours = {
    shapes: [],
    couleurs: [],
    box: new THREE.Box2(),
    k: 1,
  };
  private disposables: { dispose: () => void }[] = [];
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  /** true quand une source lumineuse doit « déborder » (façade, leds, spots) */
  private avecBloom = false;
  private autoCache: { cle: string; ents: Entretoise[] } | null = null;
  /** nombre d'entretoises réellement affichées (fichier ou automatique) */
  entretoisesRendues = 0;
  /** nombre de lisses générées */
  lissesRendues = 0;
  /** éléments (point du i, accent…) que la structure de lisses ne tient pas */
  elementsNonTenus = 0;
  /** couleurs distinctes trouvées dans le fichier du graphiste */
  couleursFichier: string[] = [];

  /**
   * Barrettes de leds à l'intérieur du caisson, plaquées contre la face
   * avant et tournées vers le mur. Elles ne sont visibles qu'en tournant
   * derrière l'enseigne — exactement comme sur un chantier avant la pose.
   */
  private poserLeds(o: Relief3dOptions, W: number, H: number): void {
    if (o.eclairage !== "retro") return;
    const masque = construireMasque(this.contours, W, H);
    if (!masque) return;

    const matLed = new THREE.MeshBasicMaterial({
      color: new THREE.Color(o.couleurHalo),
    });
    const matSupport = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d8d8d8"),
      roughness: 0.7,
      metalness: 0.1,
    });
    this.disposables.push(matLed, matSupport);

    // Les leds suivent le TRACÉ de la lettre : ce sont des modules répartis
    // le long des jambages, pas une barre traversant la lettre de part en
    // part. On les sème donc sur les points suffisamment au cœur de la
    // matière, à pas régulier — le chemin épouse naturellement la forme.
    const marge = Math.max(12, CHANT_MM + 8);
    const pas = Math.max(60, Math.min(130, H / 9));
    const taille = Math.max(8, Math.min(16, o.epaisseurMm * 0.5));
    // les leds éclairent vers l'arrière : elles sont collées à la face avant
    const zLed = Math.max(2, o.epaisseurMm - taille * 0.7);

    const geoModule = new THREE.BoxGeometry(taille, taille * 0.55, taille * 0.5);
    const geoSupport = new THREE.BoxGeometry(taille * 1.5, taille * 0.9, 2);
    this.disposables.push(geoModule, geoSupport);

    let poses = 0;
    for (let y = pas / 2; y < H; y += pas) {
      for (let x = pas / 2; x < W; x += pas / 1.6) {
        if (masque.distanceBordMm(x, y) < marge) continue;
        const module = new THREE.Mesh(geoModule, matLed);
        module.position.set(x - W / 2, H / 2 - y, zLed);
        this.groupe.add(module);
        const socle = new THREE.Mesh(geoSupport, matSupport);
        socle.position.set(x - W / 2, H / 2 - y, zLed + taille * 0.4);
        this.groupe.add(socle);
        poses++;
        if (poses > 900) return;
      }
    }
  }

  /**
   * Entretoises vissées SUR LES LISSES : les lettres ne touchent alors plus
   * le châssis, elles sont déportées devant lui. Le pied ne va donc pas du
   * mur aux lettres, mais de la FACE AVANT de la lisse aux lettres.
   */
  private poserEntretoisesSurLisses(
    o: Relief3dOptions,
    W: number,
    H: number,
    deport: number,
    profLisse: number,
    rails: Rail[],
    materiau: THREE.Material
  ): void {
    if (!o.entretoisesSurLisses || rails.length === 0) return;
    const masque = construireMasque(this.contours, W, H);
    if (!masque) return;
    const pieds = placerEntretoisesSurLisses(masque, rails, {
      pasMm: o.couvertureMm,
      gardeMm: o.gardeMm,
      diamMm: o.entretoiseDiamMm,
    });
    // longueur restante entre l'avant de la lisse et le dos des lettres
    const longueur = Math.max(2, deport - profLisse);
    this.entretoisesRendues = pieds.length;
    for (const p of pieds) {
      const cyl = new THREE.CylinderGeometry(p.dMm / 2, p.dMm / 2, longueur, 14);
      cyl.rotateX(Math.PI / 2);
      this.disposables.push(cyl);
      const mesh = new THREE.Mesh(cyl, materiau);
      mesh.position.set(
        p.xMm - W / 2,
        H / 2 - p.yMm,
        -deport + profLisse + longueur / 2
      );
      mesh.castShadow = true;
      this.groupe.add(mesh);
    }
  }

  /** Couleur la plus représentée dans le fichier (teinte du débordement
   *  lumineux quand ce sont les faces qui éclairent) */
  private couleurDominante(): string {
    const compte = new Map<string, number>();
    for (const c of this.contours.couleurs) {
      compte.set(c, (compte.get(c) ?? 0) + 1);
    }
    let best = "#ffffff", n = -1;
    for (const [c, v] of compte) {
      if (v > n) { n = v; best = c; }
    }
    return best;
  }

  /** Coins d'un contour, en mm (origine coin haut-gauche, y vers le bas) */
  private coinsContourMm(i: number): { x: number; y: number }[] {
    const { shapes, box, k } = this.contours;
    const b = new THREE.Box2();
    for (const p of shapes[i].getPoints(16)) b.expandByPoint(p);
    const x0 = (b.min.x - box.min.x) * k;
    const x1 = (b.max.x - box.min.x) * k;
    const y0 = (b.min.y - box.min.y) * k;
    const y1 = (b.max.y - box.min.y) * k;
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x0, y: y1 },
      { x: x1, y: y1 },
    ];
  }

  /** Un contour est « tenu » si son emprise croise celle d'une lisse,
   *  test mené dans le repère INCLINÉ de la lisse. */
  private compterNonTenus(rails: Rail[], section: number): number {
    let nb = 0;
    for (let i = 0; i < this.contours.shapes.length; i++) {
      const coins = this.coinsContourMm(i);
      const tenu = rails.some((r) => {
        const cos = Math.cos(r.angle), sin = Math.sin(r.angle);
        let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
        for (const p of coins) {
          const u = p.x * cos + p.y * sin;
          const v = -p.x * sin + p.y * cos;
          if (u < uMin) uMin = u;
          if (u > uMax) uMax = u;
          if (v < vMin) vMin = v;
          if (v > vMax) vMax = v;
        }
        return (
          uMax >= r.uMin &&
          uMin <= r.uMax &&
          vMax >= r.v - section / 2 &&
          vMin <= r.v + section / 2
        );
      });
      if (!tenu) nb++;
    }
    return nb;
  }

  constructor(canvas: HTMLCanvasElement, input: Relief3dInput, options: Relief3dOptions) {
    this.input = input;
    this.options = options;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      // canal alpha nécessaire à l'export détouré (fond transparent)
      alpha: true,
      // indispensable pour « Exporter le PNG » (sinon buffer vidé après rendu)
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(35, w / h, 1, 20000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.contours = this.parseShapes();
    this.scene.add(this.groupe);
    this.build();
    this.cadrerCamera();
    this.resize();

    const boucle = () => {
      this.raf = requestAnimationFrame(boucle);
      this.controls.update();
      this.dessiner();
    };
    boucle();
  }

  /** Un rendu : direct, ou via la chaîne de post-traitement (halo lumineux) */
  private dessiner(): void {
    if (this.avecBloom && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Le débordement lumineux n'a de sens que si quelque chose émet. */
  private majBloom(o: Relief3dOptions): void {
    this.avecBloom =
      o.eclairage === "face" || o.eclairage === "retro" || o.eclairage === "spot" || o.eclairage === "rampe";
    if (!this.avecBloom) return;
    if (!this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(this.renderPass);
      const taille = new THREE.Vector2(
        this.renderer.domElement.width,
        this.renderer.domElement.height
      );
      this.bloom = new UnrealBloomPass(taille, 0.6, 0.7, 0.85);
      this.composer.addPass(this.bloom);
    }
    if (this.renderPass) this.renderPass.scene = this.scene;
    if (this.bloom) {
      // ⚠ Un seuil élevé rend la réponse TOUT OU RIEN : en dessous rien ne
      // déborde, au-dessus tout crame d'un coup — et seules les teintes
      // claires le franchissent, les lettres colorées restant éteintes.
      // Seuil bas + amplitude pilotée par le curseur = réponse progressive.
      const fort = o.eclairage === "face";
      const dose = fort ? o.haloIntensite * 0.7 : o.haloIntensite;
      this.bloom.strength = (fort ? 0.22 : 0.3) * Math.max(0.3, dose);
      this.bloom.threshold = fort ? 0.45 : 0.8;
      this.bloom.radius = fort ? 0.4 : 0.35;
    }
  }

  /** SVG Illustrator → contours bruts + facteur d'échelle vers les mm */
  private parseShapes(): Contours {
    const data = new SVGLoader().parse(this.input.svg);
    const shapes: THREE.Shape[] = [];
    const couleurs: string[] = [];
    for (const path of data.paths) {
      // couleur RÉELLE du fichier : c'est elle qui habille les lettres,
      // le graphiste n'a pas à ressaisir sa charte
      const style = (path.userData as { style?: { fill?: string } } | undefined)?.style;
      const fill =
        style?.fill && style.fill !== "none"
          ? new THREE.Color(style.fill).getHexString()
          : path.color.getHexString();
      for (const shape of SVGLoader.createShapes(path)) {
        shapes.push(shape);
        couleurs.push(`#${fill}`);
      }
    }
    const box = new THREE.Box2();
    if (shapes.length === 0) return { shapes, couleurs, box, k: 1 };

    for (const s of shapes) {
      for (const p of s.getPoints(12)) box.expandByPoint(p);
      for (const trou of s.holes) for (const p of trou.getPoints(12)) box.expandByPoint(p);
    }
    const larg = box.max.x - box.min.x;
    // le SVG est exporté dans ses propres unités : on le ramène à la
    // largeur RÉELLE des lettres mesurée dans Illustrator
    const k = larg > 0 ? this.input.wMm / larg : 1;
    return { shapes, couleurs, box, k };
  }

  /** Hauteur réelle rendue, déduite du SVG (le ratio prime sur le hMm
   *  déclaré : les deux viennent des mêmes bounds, mais si le SVG porte
   *  une marge d'export, c'est lui qui fait foi pour la géométrie) */
  private get hauteurRendue(): number {
    const b = this.contours.box;
    const haut = b.max.y - b.min.y;
    return haut > 0 ? haut * this.contours.k : this.input.hMm;
  }

  private build(): void {
    const o = this.options;
    // purge du contenu précédent (changement de réglage = reconstruction)
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    // Repartir d'une scène NEUVE plutôt que de vider l'ancienne : c'est la
    // seule façon de garantir qu'aucune lumière, aucun matériel d'éclairage
    // ni aucun réglage de rendu du mode précédent ne survive (passer de
    // « façade » à « rétro » laissait un décor incohérent).
    this.scene = new THREE.Scene();
    this.groupe = new THREE.Group();
    this.scene.add(this.groupe);
    if (this.renderPass) this.renderPass.scene = this.scene;

    const W = this.input.wMm;
    const H = this.hauteurRendue;
    // « à plat » : les lettres sont collées au mur, plus aucun jeu ni halo
    const deport = o.fixation === "aplat" ? 0 : o.deportMm;

    this.scene.background = new THREE.Color(o.couleurMur).multiplyScalar(0.55);

    // ---- lettres ----
    // Les contours restent dans les unités du SVG : on extrude avec une
    // profondeur convertie, puis on met TOUTE la géométrie à l'échelle mm.
    // Une géométrie PAR COULEUR du fichier : un logo bicolore reste bicolore.
    const k = this.contours.k;
    const parCouleur = new Map<string, THREE.Shape[]>();
    this.contours.shapes.forEach((s, i) => {
      const c = o.couleursDuFichier
        ? this.contours.couleurs[i] ?? o.couleurFace
        : o.couleurFace;
      const liste = parCouleur.get(c);
      if (liste) liste.push(s);
      else parCouleur.set(c, [s]);
    });
    this.couleursFichier = [...new Set(this.contours.couleurs)];
    // Le SVG est en repère « y vers le bas » : il faut retourner l'axe Y.
    // ⚠ Un scale(1,-1,1) inverserait le sens de parcours des triangles :
    // les faces avant deviendraient des faces arrière et les lettres
    // disparaîtraient (élimination des faces cachées). On passe donc par
    // une ROTATION de 180° autour de X, qui préserve l'orientation.
    // Après rotation : y ∈ [-H, 0] et z ∈ [-épaisseur, 0], d'où le recentrage.

    const matTrancheCommune = new THREE.MeshStandardMaterial({
      color: new THREE.Color(o.couleurTranche),
      roughness: 0.6,
      metalness: 0.02,
    });
    this.disposables.push(matTrancheCommune);

    for (const [hex, formes] of parCouleur) {
      // tranche : soit une couleur commune, soit celle de la lettre
      const matTranche = o.trancheCommeFace
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color(hex),
            roughness: 0.6,
            metalness: 0.02,
          })
        : matTrancheCommune;
      if (o.trancheCommeFace) this.disposables.push(matTranche);

      const geo = new THREE.ExtrudeGeometry(formes, {
        depth: k > 0 ? o.epaisseurMm / k : o.epaisseurMm,
        bevelEnabled: false,
        curveSegments: 12,
      });
      // unités SVG → mm, origine au coin haut-gauche des lettres
      geo.translate(-this.contours.box.min.x, -this.contours.box.min.y, 0);
      geo.scale(k, k, k);
      this.disposables.push(geo);

      const matFace = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: 0.45,
        metalness: 0.02,
      });
      if (o.eclairage === "face") {
        // Lettres lumineuses en façade : c'est la FACE qui émet, la couleur
        // vue est celle de l'adhésif posé dessus. L'émission doit dépasser
        // le blanc pur pour que le post-traitement la fasse « déborder » —
        // sinon on ne voit pas que ça éclaire, on voit juste du clair.
        matFace.emissive = new THREE.Color(hex);
        // Une face lumineuse rayonne À TRAVERS son adhésif : le flux derrière
        // est le même pour toutes les lettres, c'est la couleur qui filtre.
        // Sans compensation, une lettre foncée resterait éteinte à côté d'une
        // blanche cramée. On divise donc par la clarté de la teinte.
        const c = new THREE.Color(hex);
        const clarte = Math.max(0.18, 0.3 * c.r + 0.59 * c.g + 0.11 * c.b);
        // le curseur est recalé : sa position centrale correspond au dosage
        // jugé bon à l'usage (l'ancien 0,7), pas à un maximum
        const dose = o.haloIntensite * 0.7;
        matFace.emissiveIntensity = Math.min(2.2, (0.2 + 0.5 * dose) / clarte);
      }
      this.disposables.push(matFace);
      // Rétroéclairé : le caisson est OUVERT à l'arrière, mais il reste un
      // CHANT de quelques millimètres tout autour — c'est dessus que se
      // vissent les entretoises. Le fond n'est donc pas supprimé : il est
      // ajouré au-delà de cette bande.
      const creux = o.eclairage === "retro";
      const matDos = new THREE.MeshStandardMaterial({
        color: new THREE.Color(creux ? "#ffffff" : o.couleurArriere),
        roughness: 0.85,
        metalness: 0,
      });
      if (creux) {
        const chant = textureChant(this.contours, W, H, CHANT_MM);
        if (chant) {
          matDos.alphaMap = chant;
          matDos.transparent = true;
          matDos.alphaTest = 0.5;
          matDos.side = THREE.DoubleSide;
          this.disposables.push(chant);
        }
      }
      this.disposables.push(matDos);
      // 0 = face avant, 1 = dos, 2 = tranches (voir separerCapots)
      const separe = separerCapots(geo, o.epaisseurMm);
      const lettres = new THREE.Mesh(
        geo,
        separe ? [matFace, matDos, matTranche] : [matFace, matTranche]
      );
      lettres.rotation.x = Math.PI;
      lettres.position.set(-W / 2, H / 2, o.epaisseurMm);
      lettres.castShadow = true;
      lettres.receiveShadow = true;
      this.groupe.add(lettres);

      if (creux) {
        // Doublure INTÉRIEURE : la même coque rendue par ses faces arrière.
        // L'intérieur d'un caisson est blanc — jamais la couleur du décor,
        // qui n'est qu'un adhésif posé sur la face avant.
        const matInterieur = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#ffffff"),
          roughness: 0.9,
          metalness: 0,
          side: THREE.BackSide,
        });
        const matInterieurDos = matInterieur.clone();
        if (matDos.alphaMap) {
          matInterieurDos.alphaMap = matDos.alphaMap;
          matInterieurDos.transparent = true;
          matInterieurDos.alphaTest = 0.5;
        }
        this.disposables.push(matInterieur, matInterieurDos);
        const doublure = new THREE.Mesh(
          geo,
          separe
            ? [matInterieur, matInterieurDos, matInterieur]
            : [matInterieur, matInterieur]
        );
        doublure.rotation.x = Math.PI;
        doublure.position.set(-W / 2, H / 2, o.epaisseurMm);
        this.groupe.add(doublure);
      }
    }

    // ---- mur ----
    const murW = Math.max(W * 2.2, W + 600);
    const murH = Math.max(H * 3.2, H + 600);
    const murGeo = new THREE.PlaneGeometry(murW, murH);
    const murMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(o.couleurMur),
      roughness: 0.95,
      metalness: 0,
    });
    this.disposables.push(murGeo, murMat);
    // matière du mur : la texture est en niveaux de gris, la couleur choisie
    // la teinte — un béton peut ainsi être clair ou anthracite
    if (o.motifMur !== "uni") {
      const m = MATIERES[o.motifMur];
      const aniso = this.renderer.capabilities.getMaxAnisotropy();
      const rep = new THREE.Vector2(murW / m.tuileMm, murH / m.tuileMm);
      // ⚠ Sans filtrage anisotrope, la matière part en bouillie dès que le
      // mur est vu de biais — et un BAT se regarde presque toujours de 3/4.
      const photo = chargerTexture(m.couleur, true);
      photo.repeat.copy(rep);
      photo.anisotropy = aniso;
      photo.needsUpdate = true;
      const relief = chargerTexture(m.relief, false);
      relief.repeat.copy(rep);
      relief.anisotropy = aniso;
      relief.needsUpdate = true;

      murMat.map = photo;
      // carte de NORMALES : elle décrit l'orientation réelle de la surface,
      // là où un simple relief en niveaux de gris donne un aspect gonflé
      murMat.normalMap = relief;
      murMat.normalScale = new THREE.Vector2(m.forceRelief, m.forceRelief);
      murMat.roughness = 0.9;
      // les textures sont mises en cache : surtout ne pas les libérer ici
    }
    const mur = new THREE.Mesh(murGeo, murMat);
    mur.position.z = -deport;
    mur.receiveShadow = true;
    this.groupe.add(mur);

    // ---- halo de rétroéclairage projeté sur le mur ----
    // Uniquement en rétroéclairé : la source est DERRIÈRE les lettres, sa
    // couleur ne dépend donc pas de l'adhésif de façade (blanc, jaune…).
    // Rétroéclairé : la source est derrière, sa couleur est indépendante de
    // la façade. Lumineux en façade : la lumière déborde aussi sur le mur,
    // mais TEINTÉE par l'adhésif — plus discrètement.
    const haloRetro = o.eclairage === "retro" && o.halo;
    const haloFacade = o.eclairage === "face";
    if (
      (haloRetro || haloFacade) &&
      o.haloIntensite > 0 &&
      deport > 0 &&
      this.contours.shapes.length > 0
    ) {
      // la lumière qui s'échappe derrière les lettres s'étale sur environ
      // deux à trois fois la longueur des entretoises
      const marge = Math.max(80, deport * 4);
      const tex = textureHalo(this.contours, W, H, marge, Math.max(15, deport * 2));
      if (tex) {
        const haloGeo = new THREE.PlaneGeometry(W + 2 * marge, H + 2 * marge);
        // ⚠ Plafonner l'opacité bridait le halo dès l'intensité 1 : au-delà
        // le curseur ne faisait plus rien. On garde l'opacité pleine et on
        // pousse la COULEUR au-delà de 1 — en mélange additif, c'est ce qui
        // donne un rétroéclairage franc, sans limite basse ni haute.
        const force = (haloRetro ? 1.15 : 0.4) * o.haloIntensite;
        const haloMat = new THREE.MeshBasicMaterial({
          map: tex,
          color: new THREE.Color(
            haloRetro ? o.couleurHalo : this.couleurDominante()
          ).multiplyScalar(force),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 1,
        });
        this.disposables.push(haloGeo, haloMat, tex);
        const halo = new THREE.Mesh(haloGeo, haloMat);
        // très légèrement devant le mur pour éviter le z-fighting
        halo.position.z = -deport + 0.6;
        this.groupe.add(halo);
      }
    }

    // ---- système de fixation ----
    this.entretoisesRendues = 0;
    this.lissesRendues = 0;
    this.elementsNonTenus = 0;
    // les lisses sont PEINTES (couleur de façade), les entretoises et tiges
    // restent des pièces métalliques brutes
    const lisse = o.fixation === "lisses";
    const matFix = new THREE.MeshStandardMaterial({
      color: new THREE.Color(lisse ? o.couleurLisse : o.couleurEntretoise),
      roughness: lisse ? 0.7 : 0.35,
      metalness: lisse ? 0.1 : 0.75,
    });
    this.disposables.push(matFix);

    if (o.fixation === "entretoises" || o.fixation === "tiges") {
      // Celles du fichier font foi ; sinon GraphiDesk les place lui-même
      // (résultat mémorisé : le calcul ne se refait que si sa règle change).
      const diam = o.fixation === "tiges" ? o.tigeDiamMm : o.entretoiseDiamMm;
      let ents: Entretoise[] = this.input.entretoises;
      if (ents.length === 0 && o.entretoisesAuto) {
        const cle = `${diam}|${o.couvertureMm}|${o.gardeMm}`;
        if (this.autoCache?.cle !== cle) {
          this.autoCache = {
            cle,
            ents: placerEntretoisesAuto(this.contours, W, H, {
              couvertureMm: o.couvertureMm,
              gardeMm: o.gardeMm,
              diamMm: diam,
            }),
          };
        }
        ents = this.autoCache.ents;
      }
      this.entretoisesRendues = ents.length;
      for (const e of ents) {
        const d = e.dMm > 0 ? e.dMm : diam;
        const cyl = new THREE.CylinderGeometry(d / 2, d / 2, deport, 16);
        // le cylindre naît selon Y : on le couche selon Z (mur → lettres)
        cyl.rotateX(Math.PI / 2);
        this.disposables.push(cyl);
        const mesh = new THREE.Mesh(cyl, matFix);
        mesh.position.set(e.xMm - W / 2, H / 2 - e.yMm, -deport / 2);
        mesh.castShadow = true;
        this.groupe.add(mesh);
      }
    } else if (o.fixation === "lisses") {
      // une structure PAR MOT : deux mots éloignés ne partagent pas un
      // châssis démesuré (règle atelier)
      const section = Math.max(5, o.sectionLisseMm);
      const prof = Math.min(section, deport);

      // ---- lisses DESSINÉES par le graphiste ----
      // Sur un visuel à plusieurs hauteurs, l'automatique ne peut pas
      // deviner le châssis : on reprend alors exactement sa sélection.
      if (!o.lissesAuto) {
        const dessinees = this.input.lisses ?? [];
        this.lissesRendues = dessinees.length;
        const railsManuels: Rail[] = [];
        for (const l of dessinees) {
          const a = (l.angleDeg * Math.PI) / 180;
          const cos = Math.cos(a), sin = Math.sin(a);
          const geoL = new THREE.BoxGeometry(
            Math.max(1, l.longueurMm),
            Math.max(1, l.epaisseurMm),
            prof
          );
          this.disposables.push(geoL);
          const mesh = new THREE.Mesh(geoL, matFix);
          mesh.position.set(l.xMm - W / 2, H / 2 - l.yMm, -deport + prof / 2);
          mesh.rotation.z = -a;
          mesh.castShadow = true;
          this.groupe.add(mesh);
          // repère local pour le contrôle des éléments tenus
          const u = l.xMm * cos + l.yMm * sin;
          const v = -l.xMm * sin + l.yMm * cos;
          railsManuels.push({
            uMin: u - l.longueurMm / 2,
            uMax: u + l.longueurMm / 2,
            v,
            angle: a,
            longueur: l.longueurMm,
          });
        }
        this.elementsNonTenus = railsManuels.length
          ? this.compterNonTenus(railsManuels, section)
          : 0;
        this.poserEntretoisesSurLisses(o, W, H, deport, prof, railsManuels, matFix);
        this.poserLeds(o, W, H);
        this.finaliserLumieres(o, W, H, deport);
        return;
      }

      const mots = grouperMots(this.contours, H);
      // Une lisse suit l'INCLINAISON du mot : sur un logo en biais (ou dont
      // les lettres montent), une barre horizontale ne tient rien. On ajuste
      // la droite des centres de lettres au moindre carré, et les lisses sont
      // parallèles à cette ligne, décalées de part et d'autre.
      const rails: Rail[] = [];
      for (const mot of mots) {
        // Lisses TOUJOURS DROITES par défaut : c'est ce qui se pose en
        // atelier. Un châssis suivant l'inclinaison du logo se relève à la
        // main, en important ses propres barres.
        const angle = 0;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        // repère local du mot : u le long des lettres, v perpendiculaire
        let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
        for (const i of mot.indices) {
          for (const p of this.coinsContourMm(i)) {
            const u = p.x * cos + p.y * sin;
            const v = -p.x * sin + p.y * cos;
            if (u < uMin) uMin = u;
            if (u > uMax) uMax = u;
            if (v < vMin) vMin = v;
            if (v > vMax) vMax = v;
          }
        }
        const hMot = vMax - vMin;
        const retrait = (hMot * o.retraitLissePct) / 100;
        const n = Math.max(1, Math.round(o.nbLisses));
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          const v = vMin + retrait + t * Math.max(0, hMot - 2 * retrait);
          rails.push({ uMin, uMax, v, angle, longueur: Math.max(1, uMax - uMin) });
        }
      }
      this.lissesRendues = rails.length;
      for (const r of rails) {
        const geoL = new THREE.BoxGeometry(r.longueur, section, prof);
        this.disposables.push(geoL);
        const mesh = new THREE.Mesh(geoL, matFix);
        // centre du rail exprimé dans le repère mm (y vers le bas)
        const uc = (r.uMin + r.uMax) / 2;
        const cos = Math.cos(r.angle), sin = Math.sin(r.angle);
        const xMm = uc * cos - r.v * sin;
        const yMm = uc * sin + r.v * cos;
        mesh.position.set(xMm - W / 2, H / 2 - yMm, -deport + prof / 2);
        // l'axe Y du monde est inversé par rapport au repère mm
        mesh.rotation.z = -r.angle;
        mesh.castShadow = true;
        this.groupe.add(mesh);
      }
      // contrôle honnête : quels éléments ne touchent AUCUNE lisse ?
      // (typiquement les points sur les i — c'est là que l'automatique
      //  ne remplace pas l'œil du graphiste)
      this.elementsNonTenus = this.compterNonTenus(rails, section);
      this.poserEntretoisesSurLisses(o, W, H, deport, prof, rails, matFix);
    }
    // "aplat" : aucune pièce de fixation, les lettres touchent le mur

    this.poserLeds(o, W, H);
    this.finaliserLumieres(o, W, H, deport);
  }

  /**
   * Lumières de la scène + matériel d'éclairage VISIBLE (rampe, spots).
   * En éclairage extérieur on passe en ambiance nocturne : sans cela, la
   * lumière projetée se noie dans l'éclairage neutre et « on ne voit pas
   * que ça éclaire ».
   */
  private finaliserLumieres(
    o: Relief3dOptions,
    W: number,
    H: number,
    deport: number
  ): void {
    const exterieur = o.eclairage === "rampe" || o.eclairage === "spot";
    // Seul l'éclairage EXTÉRIEUR justifie une scène de nuit : ce sont les
    // projecteurs qui doivent sculpter l'enseigne. En rétroéclairé ou en
    // façade, l'enseigne reste lisible — sinon on ne voit plus le produit.
    const ambiance = exterieur ? 0.14 : o.eclairage === "face" ? 0.4 : 0.5;
    const appoint = exterieur ? 0.22 : o.eclairage === "face" ? 0.55 : 0.9;
    this.scene.add(new THREE.AmbientLight(0xffffff, ambiance));

    if (exterieur) {
      // la PEINTURE du matériel et la COULEUR DE SA LUMIÈRE sont deux
      // réglages distincts : un spot noir peut éclairer en blanc chaud
      const teinteCorps = o.eclairage === "rampe" ? o.couleurRampe : o.couleurSpots;
      const chaud = new THREE.Color(
        o.eclairage === "rampe" ? o.couleurLumiereRampe : o.couleurLumiereSpots
      );
      const matCorps = new THREE.MeshStandardMaterial({
        color: new THREE.Color(teinteCorps),
        roughness: 0.4,
        metalness: 0.8,
      });
      const matVerre = new THREE.MeshBasicMaterial({ color: chaud });
      this.disposables.push(matCorps, matVerre);

      // hauteur et avancée du matériel devant l'enseigne
      const yHaut = H / 2 + Math.max(140, H * 0.28);
      const zAvant = deport + o.epaisseurMm + Math.max(220, W * 0.10);

      if (o.eclairage === "rampe") {
        // une barre continue sur (une part de) la longueur du logo
        const longueur = Math.max(50, (W * o.rampeLongueurPct) / 100);
        const corps = new THREE.CylinderGeometry(22, 22, longueur, 20);
        corps.rotateZ(Math.PI / 2); // couchée selon X
        this.disposables.push(corps);
        const barre = new THREE.Mesh(corps, matCorps);
        barre.position.set(0, yHaut, zAvant);
        this.groupe.add(barre);

        // le tube lumineux sous la barre (c'est LUI qu'on doit voir allumé)
        const verre = new THREE.CylinderGeometry(13, 13, longueur * 0.96, 16);
        verre.rotateZ(Math.PI / 2);
        this.disposables.push(verre);
        const tube = new THREE.Mesh(verre, matVerre);
        tube.position.set(0, yHaut - 16, zAvant + 4);
        this.groupe.add(tube);

        // potences de fixation au mur
        for (const cx of [-longueur * 0.4, longueur * 0.4]) {
          const bras = new THREE.BoxGeometry(18, 18, zAvant + deport);
          this.disposables.push(bras);
          const b = new THREE.Mesh(bras, matCorps);
          b.position.set(cx, yHaut, (zAvant - deport) / 2);
          this.groupe.add(b);
        }

        // Une rampe éclaire de façon CONTINUE : une source surfacique
        // linéaire, pas une file de projecteurs (qui dessinerait une
        // succession de dômes sur le mur).
        RectAreaLightUniformsLib.init();
        const barreLumiere = new THREE.RectAreaLight(
          chaud,
          5.5 * o.haloIntensite,
          longueur,
          Math.max(60, H * 0.25)
        );
        barreLumiere.position.set(0, yHaut - 30, zAvant);
        barreLumiere.lookAt(0, 0, 0);
        this.scene.add(barreLumiere);
        // une source ponctuelle très douce, uniquement pour porter l'ombre
        const ombre = new THREE.SpotLight(chaud, 90 * o.haloIntensite, 0, Math.PI / 3, 0.9, 0.7);
        ombre.position.set(0, yHaut, zAvant);
        ombre.target.position.set(0, 0, 0);
        ombre.distance = Math.max(W, H) * 5;
        ombre.castShadow = true;
        ombre.shadow.mapSize.set(2048, 2048);
        this.scene.add(ombre);
        this.scene.add(ombre.target);
      } else {
        // Spots individuels. Le corps ET la lentille sont assemblés dans un
        // GROUPE que l'on oriente d'un bloc vers l'enseigne : c'est la seule
        // façon de garantir que la lentille reste dans l'ouverture du spot.
        const n = Math.max(1, Math.round(o.nbSpots));
        const LONG = 110;
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          const x = -W / 2 + W * (0.12 + 0.76 * t);
          const cible = new THREE.Vector3(x, -H * 0.1, 0);
          const origine = new THREE.Vector3(x, yHaut, zAvant);

          const spot = new THREE.Group();
          // corps : cylindre né selon Y, couché pour pointer vers -Z…
          const corps = new THREE.CylinderGeometry(34, 44, LONG, 20);
          corps.rotateX(-Math.PI / 2); // axe = Z
          this.disposables.push(corps);
          spot.add(new THREE.Mesh(corps, matCorps));
          // …et la lentille au bout qui REGARDE L'ENSEIGNE. lookAt oriente
          // le +Z du groupe vers la cible : la sortie est donc en +Z, pas
          // en -Z (c'est ce qui mettait le halo derrière le spot).
          const lentille = new THREE.CircleGeometry(33, 20);
          this.disposables.push(lentille);
          const verre = new THREE.Mesh(lentille, matVerre);
          verre.position.z = LONG / 2 + 0.5;
          spot.add(verre);

          spot.position.copy(origine);
          // …puis l'ensemble regarde l'enseigne (le -Z du groupe vise la cible)
          spot.lookAt(cible);
          this.groupe.add(spot);

          const bras = new THREE.BoxGeometry(16, 16, zAvant + deport);
          this.disposables.push(bras);
          const b = new THREE.Mesh(bras, matCorps);
          b.position.set(x, yHaut + 34, (zAvant - deport) / 2);
          this.groupe.add(b);

          const sl = new THREE.SpotLight(chaud, 700 * o.haloIntensite, 0, Math.PI / 6, 0.5, 0.9);
          sl.position.copy(origine);
          sl.target.position.copy(cible);
          sl.distance = Math.max(W, H) * 5;
          sl.castShadow = i === 0;
          if (sl.castShadow) sl.shadow.mapSize.set(2048, 2048);
          this.scene.add(sl);
          this.scene.add(sl.target);
        }
      }
    }

    // lumière d'appoint : forte de jour, discrète dès qu'une source domine
    const key = new THREE.DirectionalLight(0xffffff, o.eclairage === "aucun" ? 1.5 : appoint);
    key.position.set(-W * 0.6, H * 1.2, Math.max(W, 400));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const port = Math.max(W, H) * 1.4;
    key.shadow.camera.left = -port;
    key.shadow.camera.right = port;
    key.shadow.camera.top = port;
    key.shadow.camera.bottom = -port;
    key.shadow.camera.far = port * 6;
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, exterieur ? 0.1 : 0.3);
    fill.position.set(W, -H, Math.max(W, 400));
    this.scene.add(fill);

    // Rebond du mur : éclaire ce qui est TOURNÉ VERS LUI (dos des lettres,
    // dessous des tranches). Sans elle, le dos blanc reste terne et ne
    // ressemble pas au blanc des faces.
    const rebond = new THREE.DirectionalLight(0xffffff, exterieur ? 0.35 : 0.75);
    rebond.position.set(-W * 0.2, H * 0.4, -Math.max(W, 600));
    this.scene.add(rebond);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.majBloom(o);
  }

  /** Cadrage initial : léger 3/4 pour montrer le relief et les entretoises */
  private cadrerCamera(): void {
    const W = this.input.wMm;
    const H = this.hauteurRendue;
    // Plans de coupe adaptés à la TAILLE RÉELLE : un rapport lointain/proche
    // trop grand ruine la précision du tampon de profondeur (les faces
    // séparées de quelques millimètres se mettent à clignoter).
    const taille = Math.max(W, H, 100);
    this.camera.near = Math.max(1, taille / 400);
    this.camera.far = taille * 40;
    this.camera.updateProjectionMatrix();
    const dist = Math.max(W, H) * 1.9 + 400;
    this.camera.position.set(dist * 0.42, dist * 0.24, dist * 0.88);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Vue de face stricte (pour un BAT « à plat ») */
  vueDeFace(): void {
    this.vue("face");
  }

  vueTroisQuarts(): void {
    this.vue("troisQuartsGauche");
  }

  /** Angles proposés dans le menu des vues */
  vue(nom: VueNom): void {
    const d = Math.max(this.input.wMm, this.hauteurRendue) * 1.9 + 400;
    const p: Record<VueNom, [number, number, number]> = {
      face: [0, 0, d],
      troisQuartsGauche: [d * 0.42, d * 0.24, d * 0.88],
      troisQuartsDroit: [-d * 0.42, d * 0.24, d * 0.88],
      profilGauche: [d * 0.86, d * 0.1, d * 0.5],
      profilDroit: [-d * 0.86, d * 0.1, d * 0.5],
      plongee: [d * 0.2, d * 0.62, d * 0.76],
      contrePlongee: [d * 0.2, -d * 0.55, d * 0.8],
      rasant: [d * 0.7, d * 0.05, d * 0.18],
    };
    const [x, y, z] = p[nom] ?? p.face;
    this.camera.position.set(x, y, z);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  setOptions(options: Relief3dOptions): void {
    this.options = options;
    this.build();
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * PNG du rendu courant.
   * `sansFond` : mur et halo masqués, fond transparent — l'enseigne est
   * alors détourée, prête à être posée sur une photo de devanture.
   */
  exportPng(sansFond = false, facteur = 2): string {
    // rendu à une définition supérieure à l'affichage : le BAT part souvent
    // en impression, une capture d'écran ne suffirait pas
    const canvas = this.renderer.domElement;
    const wAff = canvas.width;
    const hAff = canvas.height;
    const agrandir = facteur > 1;
    if (agrandir) {
      const w = Math.round(canvas.clientWidth * facteur);
      const h = Math.round(canvas.clientHeight * facteur);
      this.renderer.setSize(w, h, false);
      this.composer?.setSize(w, h);
    }
    const restaurer = () => {
      if (!agrandir) return;
      this.renderer.setSize(wAff, hAff, false);
      this.composer?.setSize(wAff, hAff);
      this.dessiner();
    };

    if (!sansFond) {
      this.dessiner();
      const url = canvas.toDataURL("image/png");
      restaurer();
      return url;
    }
    const fond = this.scene.background;
    const caches: THREE.Object3D[] = [];
    for (const enfant of this.groupe.children) {
      const geo = (enfant as THREE.Mesh).geometry;
      if (enfant.visible && geo && geo.type === "PlaneGeometry") {
        enfant.visible = false;
        caches.push(enfant);
      }
    }
    this.scene.background = null;
    this.renderer.setClearAlpha(0);
    // rendu direct : la chaîne de post-traitement écraserait la transparence
    this.renderer.render(this.scene, this.camera);
    const url = canvas.toDataURL("image/png");
    for (const c of caches) c.visible = true;
    this.scene.background = fond;
    this.renderer.setClearAlpha(1);
    restaurer();
    return url;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    // ⚠ Effacer la toile AVANT de libérer le contexte : sans cela elle
    // garde sa dernière image affichée, et l'ancienne enseigne resterait
    // visible derrière l'écran d'accueil après une remise à zéro.
    try {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, true, true);
    } catch {
      // contexte déjà perdu : rien à effacer
    }
    this.controls.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.renderer.dispose();
  }
}
