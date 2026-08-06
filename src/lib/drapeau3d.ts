// ============================================================
// Enseigne drapeau — caisson double face perpendiculaire au mur
// ============================================================
// Séparé du module principal : la géométrie n'a rien à voir avec des
// lettres découpées, et ce fichier deviendrait illisible mélangé au reste.
//
// Repère : le mur est le plan z = 0, le caisson s'en éloigne vers +z.
// Sa FACE regarde l'axe X — on la voit en marchant le long de la rue,
// ce qui est tout l'intérêt du produit.

import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/** Épaisseur du dibond : c'est de cette profondeur qu'on creuse la plaque
 *  pour y loger le plexi d'un ajourage à plat. */
export const DIBOND_MM = 3;

export interface ContoursDrapeau {
  shapes: THREE.Shape[];
  couleurs: string[];
  refsDegrade: (string | null)[];
  degrades: Map<string, THREE.Texture>;
  box: THREE.Box2;
  k: number;
}

/**
 * Masque d'opacité dessiné dans le repère du DESSIN puis recalé sur les
 * coordonnées de texture des formes extrudées — sans ce recalage le masque
 * est échantillonné n'importe où et ne se voit pas.
 */
export function masqueDessin(
  box: THREE.Box2,
  k: number,
  dessiner: (ctx: CanvasRenderingContext2D) => void
): THREE.Texture | null {
  const wMm = (box.max.x - box.min.x) * k;
  const hMm = (box.max.y - box.min.y) * k;
  if (wMm <= 0 || hMm <= 0) return null;
  const MM_PAR_PX = 1.5;
  const PAD = 6;
  const cw = Math.max(8, Math.round(wMm / MM_PAR_PX)) + 2 * PAD;
  const ch = Math.max(8, Math.round(hMm / MM_PAR_PX)) + 2 * PAD;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(PAD, PAD);
  ctx.scale(k / MM_PAR_PX, k / MM_PAR_PX);
  ctx.translate(-box.min.x, -box.min.y);
  dessiner(ctx);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  const totalW = cw * MM_PAR_PX;
  const totalH = ch * MM_PAR_PX;
  const padMm = PAD * MM_PAR_PX;
  tex.repeat.set(k / totalW, k / totalH);
  tex.offset.set(
    (-box.min.x * k + padMm) / totalW,
    (-box.min.y * k + padMm) / totalH
  );
  return tex;
}

/** Trace une forme et ses contre-formes dans le contexte 2D */
export function tracer(ctx: CanvasRenderingContext2D, forme: THREE.Shape): Path2D {
  const p = new Path2D();
  const suite = (pts: THREE.Vector2[]) => {
    if (pts.length < 2) return;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    p.closePath();
  };
  suite(forme.getPoints(160));
  for (const t of forme.holes) suite(t.getPoints(160));
  void ctx;
  return p;
}

export interface ZoneAjouree {
  shapes: THREE.Shape[];
  box: THREE.Box2;
  k: number;
  dxMm: number;
  dyMm: number;
}

export interface ReglagesDrapeau {
  mode: "nonLumineux" | "ajourageRelief" | "ajourageAPlat" | "facePlexi";
  epaisseurMm: number;
  ecartMurMm: number;
  potence: "deuxTubes" | "monopotence";
  sectionTubeMm: number;
  couleurChant: string;
  couleurPotence: string;
  couleurDiffusion: string;
  saillieMm: number;
  intensite: number;
  couleursDuFichier: boolean;
  couleurFaceParDefaut: string;
}

/** Analyse le SVG d'une zone à ajourer, relevé dans une seconde sélection */
export function analyserZone(
  svg: string,
  dxMm: number,
  dyMm: number,
  largeurMm: number | undefined,
  kPanneau: number
): ZoneAjouree | null {
  try {
    const data = new SVGLoader().parse(svg);
    const shapes: THREE.Shape[] = [];
    for (const path of data.paths) {
      for (const s of SVGLoader.createShapes(path)) shapes.push(s);
    }
    if (shapes.length === 0) return null;
    const box = new THREE.Box2();
    for (const s of shapes) {
      for (const p of s.getPoints(16)) box.expandByPoint(p);
      for (const t of s.holes) for (const p of t.getPoints(16)) box.expandByPoint(p);
    }
    const larg = box.max.x - box.min.x;
    const k = larg > 0 ? (largeurMm ?? larg * kPanneau) / larg : 1;
    return { shapes, box, k, dxMm, dyMm };
  } catch {
    return null;
  }
}

/**
 * Construit le caisson, son visuel, la zone ajourée et la potence.
 * Renvoie les matériaux et géométries à libérer par l'appelant.
 */
export function construireDrapeau(
  groupe: THREE.Group,
  contours: ContoursDrapeau,
  zone: ZoneAjouree | null,
  r: ReglagesDrapeau,
  hauteurMm: number
): { dispose: () => void }[] {
  const jetables: { dispose: () => void }[] = [];
  const { shapes, couleurs, box, k } = contours;
  if (shapes.length === 0) return jetables;

  const H = hauteurMm;
  const ep = Math.max(5, r.epaisseurMm);
  const ecart = Math.max(0, r.ecartMurMm);
  const lumineux = r.mode !== "nonLumineux";
  // un caisson rond doit l'être vraiment : peu de segments = facettes
  const SEGMENTS = 64;

  // la forme la plus vaste est le caisson ; les autres sont le décor
  let iCaisson = 0;
  let aireMax = -1;
  shapes.forEach((s, i) => {
    const b = new THREE.Box2();
    for (const p of s.getPoints(16)) b.expandByPoint(p);
    const aire = (b.max.x - b.min.x) * (b.max.y - b.min.y);
    if (aire > aireMax) {
      aireMax = aire;
      iCaisson = i;
    }
  });

  // largeur RÉELLE du panneau : c'est l'axe autour duquel les deux faces se
  // reflètent, y compris pour une zone relevée à part
  const largeurPanneauMm = (box.max.x - box.min.x) * k;

  const couleurDe = (i: number) =>
    r.couleursDuFichier ? couleurs[i] ?? r.couleurFaceParDefaut : r.couleurFaceParDefaut;

  /**
   * Pose une géométrie de dessin sur une face du caisson.
   * `face` décide de l'orientation : sur le DOS, le panneau est retourné
   * pour que le visuel s'y lise à l'endroit — un double face s'imprime des
   * deux côtés, il ne se regarde pas par transparence.
   */
  const poser = (
    geo: THREE.BufferGeometry,
    face: "avant" | "arriere",
    avanceX: number,
    src: { box: THREE.Box2; k: number; dxMm: number; dyMm: number }
  ): THREE.Mesh => {
    geo.translate(-src.box.min.x, -src.box.min.y, 0);
    geo.scale(src.k, src.k, src.k);
    jetables.push(geo);
    const mesh = new THREE.Mesh(geo);
    mesh.rotation.x = Math.PI;
    const largeurTotale = largeurPanneauMm;
    if (face === "avant") {
      // ⚠ Vue depuis +X, l'axe +Z part vers la GAUCHE. Pour que le dessin
      // se lise à l'endroit, sa largeur doit donc filer vers -z.
      mesh.rotation.y = -Math.PI / 2;
      mesh.position.set(avanceX, H / 2 - src.dyMm, ecart + largeurTotale - src.dxMm);
    } else {
      // au dos on regarde depuis -X : c'est l'inverse, et le visuel s'y
      // lit à l'endroit lui aussi — un double face s'imprime deux fois
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(avanceX, H / 2 - src.dyMm, ecart + src.dxMm);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const srcPanneau = { box, k, dxMm: 0, dyMm: 0 };
  const extruder = (formes: THREE.Shape[], profondeur: number, kSrc: number) =>
    new THREE.ExtrudeGeometry(formes, {
      depth: kSrc > 0 ? profondeur / kSrc : profondeur,
      bevelEnabled: false,
      curveSegments: SEGMENTS,
    });
  const aplat = (formes: THREE.Shape[]) => new THREE.ShapeGeometry(formes, SEGMENTS);

  // ---------- corps du caisson ----------
  const matChant = new THREE.MeshStandardMaterial({
    color: new THREE.Color(r.couleurChant),
    roughness: 0.35,
    metalness: 0.55,
  });
  // ⚠ La face garde la couleur DU FICHIER : le chant est une pièce
  // d'aluminium rapportée, il n'a aucune raison de repeindre le fond.
  // En face plexi, le CADRE alu tient la plaque : la tôle visible reste
  // donc de la couleur du chant, et c'est le plexi rapporté (posé plus bas,
  // en retrait de 5 mm sur tout le pourtour) qui diffuse.
  // Le fond du caisson garde le visuel du fichier — dégradé compris. En
  // face plexi c'est CE fond qui s'allume : la lumière traverse l'adhésif,
  // elle ne le remplace pas par du blanc.
  const degradeCaisson = contours.refsDegrade[iCaisson]
    ? contours.degrades.get(contours.refsDegrade[iCaisson]!)
    : undefined;
  const matFace = new THREE.MeshStandardMaterial({
    color: new THREE.Color(degradeCaisson ? "#ffffff" : couleurDe(iCaisson)),
    map: degradeCaisson ?? null,
    roughness: 0.55,
    metalness: 0.05,
  });
  if (r.mode === "facePlexi") {
    matFace.emissive = new THREE.Color(degradeCaisson ? "#ffffff" : couleurDe(iCaisson));
    matFace.emissiveMap = degradeCaisson ?? null;
    matFace.emissiveIntensity = 0.5 + 0.9 * r.intensite;
  }
  // ⚠ La tôle est DÉCOUPÉE à l'emplacement du plexi : sans ce percement, la
  // plaque masque la lumière et rien ne s'allume. L'adhésif imprimé est
  // découpé de la même façon — il est posé SUR la tôle, il ne peut pas
  // enjamber la saignée — sinon il rebouche le trou qu'on vient de faire.
  let percee: THREE.Texture | null = null;
  if (r.mode === "ajourageAPlat" && zone) {
    percee = masqueDessin(box, k, (ctx) => {
      ctx.fillStyle = "#fff";
      ctx.fill(tracer(ctx, shapes[iCaisson]), "evenodd");
      ctx.fillStyle = "#000";
      for (const z of zone.shapes) {
        ctx.save();
        ctx.translate(box.min.x + zone.dxMm / k, box.min.y + zone.dyMm / k);
        ctx.scale(zone.k / k, zone.k / k);
        ctx.translate(-zone.box.min.x, -zone.box.min.y);
        ctx.fill(tracer(ctx, z), "evenodd");
        ctx.restore();
      }
    });
    if (percee) {
      matFace.alphaMap = percee;
      // pas de `transparent` : l'alphaTest suffit et garde la tôle dans la
      // passe opaque, donc correctement triée avec le plexi en retrait
      matFace.alphaTest = 0.5;
      jetables.push(percee);
    }
  }
  jetables.push(matChant, matFace);

  // ⚠ Le CORPS n'appartient à aucune des deux faces : c'est le volume qui
  // les porte. Il garde donc une orientation fixe — celle du repère du
  // fichier — et c'est le décor qui se retourne d'un côté. Le faire suivre
  // la face avant le décalait de son épaisseur à chaque inversion.
  const corps = poser(extruder([shapes[iCaisson]], ep, k), "arriere", -ep / 2, srcPanneau);
  corps.material = [matFace, matFace, matChant];
  separerCapotsDrapeau(corps.geometry, ep);
  groupe.add(corps);

  // ---------- visuel imprimé, À PLAT sur les deux faces ----------
  // Un adhésif n'a pas d'épaisseur : surtout pas d'extrusion, sinon le
  // logo prend un relief et des ombres qui n'existent pas.
  const parCouleur = new Map<string, THREE.Shape[]>();
  shapes.forEach((s, i) => {
    if (i === iCaisson) return;
    const c = couleurDe(i);
    const liste = parCouleur.get(c);
    if (liste) liste.push(s);
    else parCouleur.set(c, [s]);
  });
  let rang = 0;
  for (const [hex, formes] of parCouleur) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 0.6,
      metalness: 0.02,
      side: THREE.DoubleSide,
      // décalage de rendu : la seule façon propre de poser un aplat sur
      // une surface sans qu'ils se disputent le même plan
      polygonOffset: true,
      polygonOffsetFactor: -2 - rang,
      polygonOffsetUnits: -2 - rang,
      ...(percee ? { alphaMap: percee, alphaTest: 0.5 } : {}),
    });
    jetables.push(mat);
    const dev = ep / 2 + 0.05;
    const av = poser(aplat(formes), "avant", dev, srcPanneau);
    av.material = mat;
    groupe.add(av);
    const ar = poser(aplat(formes), "arriere", -dev, srcPanneau);
    ar.material = mat;
    groupe.add(ar);
    rang++;
  }

  // ---------- face plexi diffusante ----------
  // Le plexi couvre la face SAUF le retour du cadre alu qui le maintient.
  if (r.mode === "facePlexi") {
    // ⚠ Ce liseré fait 5 mm sur un panneau qui en fait 800 : en masque
    // d'opacité il disparaît purement et simplement (filtrage + mipmaps —
    // mesuré à zéro pixel rendu). C'est donc de la VRAIE géométrie : un
    // anneau extrudé, qui tient à n'importe quelle distance.
    const CADRE_MM = 5;
    const anneau = anneauInterieur(shapes[iCaisson], box, k, CADRE_MM);
    if (anneau) {
      const matCadre = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r.couleurChant),
        roughness: 0.35,
        metalness: 0.55,
      });
      jetables.push(matCadre);
      // 1 mm de saillie : le cadre se voit comme un retour, pas comme un trait
      const SAILLIE = 1;
      const av = poser(extruder([anneau], SAILLIE, k), "avant", ep / 2 + SAILLIE, srcPanneau);
      av.material = matCadre;
      groupe.add(av);
      const ar = poser(extruder([anneau], SAILLIE, k), "arriere", -ep / 2 - SAILLIE, srcPanneau);
      ar.material = matCadre;
      groupe.add(ar);
    }
  }

  // ---------- zone ajourée ----------
  if ((r.mode === "ajourageRelief" || r.mode === "ajourageAPlat") && zone) {
    const matPlexi = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r.couleurDiffusion),
      emissive: new THREE.Color(r.couleurDiffusion),
      emissiveIntensity: 0.8 + 0.9 * r.intensite,
      roughness: 0.5,
    });
    jetables.push(matPlexi);
    if (r.mode === "ajourageRelief") {
      // la zone RESSORT du caisson et s'allume sur ses deux faces
      const s = Math.max(2, r.saillieMm);
      // côté avant, l'extrusion part vers -X : pour RESSORTIR du caisson il
      // faut donc caler son extrémité, pas son origine
      const av = poser(extruder(zone.shapes, s, zone.k), "avant", ep / 2 + s, zone);
      av.material = matPlexi;
      groupe.add(av);
      const ar = poser(extruder(zone.shapes, s, zone.k), "arriere", -ep / 2 - s, zone);
      ar.material = matPlexi;
      groupe.add(ar);
    } else {
      // ajourage À PLAT : on découpe le dibond, le plexi se loge dans la
      // saignée — il est donc EN RETRAIT de l'épaisseur de la plaque.
      const av = poser(aplat(zone.shapes), "avant", ep / 2 - DIBOND_MM, zone);
      av.material = matPlexi;
      groupe.add(av);
      const ar = poser(aplat(zone.shapes), "arriere", -ep / 2 + DIBOND_MM, zone);
      ar.material = matPlexi;
      groupe.add(ar);
    }
  }

  // ---------- potence ----------
  const matPotence = new THREE.MeshStandardMaterial({
    color: new THREE.Color(r.couleurPotence),
    roughness: 0.4,
    metalness: 0.7,
  });
  jetables.push(matPotence);

  // Jusqu'où faut-il aller pour toucher le caisson ? Sur un panneau rond,
  // le bord recule à mesure qu'on monte : un tube s'arrêtant au plan du
  // caisson resterait suspendu dans le vide.
  const bordAvant = mesurerBordAvant(shapes[iCaisson], box, k);
  const poserTube = (section: number, yCentre: number) => {
    const yDessin = H / 2 - yCentre; // repère du dessin, y vers le bas
    const avancee = ecart + bordAvant(yDessin, section);
    if (avancee <= 0.5) return;
    const geo = new THREE.BoxGeometry(section, section, avancee);
    jetables.push(geo);
    const m = new THREE.Mesh(geo, matPotence);
    m.position.set(0, yCentre, avancee / 2);
    m.castShadow = true;
    groupe.add(m);
  };
  const sec = Math.max(10, r.sectionTubeMm);
  if (r.potence === "monopotence") {
    poserTube(sec * 2.2, 0);
  } else {
    // aux EXTRÉMITÉS du caisson, à 3 mm du bord : c'est là qu'on visse
    const bord = 3;
    poserTube(sec, H / 2 - bord - sec / 2);
    poserTube(sec, -H / 2 + bord + sec / 2);
  }

  return jetables;
}

/**
 * Anneau de `largeurMm` le long du contour d'une forme : contour extérieur
 * inchangé, trou = la même forme rétrécie du retrait voulu. Sert au cadre
 * alu qui pince les plaques de plexi.
 *
 * Le rétrécissement se fait par homothétie autour du centre : exact sur un
 * rectangle comme sur un cercle — les deux découpes de caisson que l'on
 * fabrique — et visuellement juste sur le reste.
 */
function anneauInterieur(
  forme: THREE.Shape,
  box: THREE.Box2,
  k: number,
  largeurMm: number
): THREE.Shape | null {
  const wMm = (box.max.x - box.min.x) * k;
  const hMm = (box.max.y - box.min.y) * k;
  if (wMm <= 4 * largeurMm || hMm <= 4 * largeurMm) return null;
  const pts = forme.getPoints(160);
  if (pts.length < 3) return null;
  const anneau = new THREE.Shape(pts);
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const sx = 1 - (2 * largeurMm) / wMm;
  const sy = 1 - (2 * largeurMm) / hMm;
  // ⚠ sens de parcours inversé : un trou se décrit à l'envers du contour
  const trou = new THREE.Path(
    pts
      .map((p) => new THREE.Vector2(cx + (p.x - cx) * sx, cy + (p.y - cy) * sy))
      .reverse()
  );
  anneau.holes.push(trou);
  return anneau;
}

/**
 * Pour une hauteur donnée, distance entre le plan de départ du caisson et
 * la matière réellement présente. Permet à la potence de venir buter
 * contre le panneau, quelle que soit sa découpe.
 */
function mesurerBordAvant(
  forme: THREE.Shape,
  box: THREE.Box2,
  k: number
): (yMm: number, epaisseurTube: number) => number {
  const pts = forme.getPoints(160).map((p) => ({
    x: (p.x - box.min.x) * k,
    y: (p.y - box.min.y) * k,
  }));
  return (yMm, epaisseurTube) => {
    let mini = Infinity;
    const demi = Math.max(1, epaisseurTube / 2);
    for (const p of pts) {
      if (Math.abs(p.y - yMm) <= demi && p.x < mini) mini = p.x;
    }
    // hauteur hors du panneau : on ne sait pas où buter, on reste au plan
    return isFinite(mini) ? mini : 0;
  };
}

/** Sépare face avant, dos et chant d'une extrusion (voir module principal) */
function separerCapotsDrapeau(geo: THREE.BufferGeometry, epaisseurMm: number): void {
  const pos = geo.getAttribute("position");
  if (!pos || geo.groups.length === 0) return;
  const anciens = geo.groups.map((g) => ({ ...g }));
  const zDe = (i: number) => pos.getZ(i);
  const nouveaux: { start: number; count: number; materialIndex: number }[] = [];
  for (const g of anciens) {
    if (g.materialIndex !== 0) {
      nouveaux.push({ start: g.start, count: g.count, materialIndex: 2 });
      continue;
    }
    const fin = g.start + g.count;
    const zPremier = zDe(g.start);
    let i = g.start;
    while (i < fin && Math.abs(zDe(i) - zPremier) < 1e-4) i += 3;
    const premierEstDos = Math.abs(zPremier - epaisseurMm) < 1e-3;
    if (i <= g.start || i >= fin) {
      nouveaux.push({ start: g.start, count: g.count, materialIndex: 0 });
      continue;
    }
    nouveaux.push({ start: g.start, count: i - g.start, materialIndex: premierEstDos ? 1 : 0 });
    nouveaux.push({ start: i, count: fin - i, materialIndex: premierEstDos ? 0 : 1 });
  }
  geo.clearGroups();
  for (const g of nouveaux) geo.addGroup(g.start, g.count, g.materialIndex);
}
