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

/**
 * Parois d'une découpe faite de PLUSIEURS formes : seul le contour de leur
 * réunion est gardé. Un segment de contour dont les deux côtés sont dans la
 * zone est une jointure interne (le bord d'un E posé sur un losange) : la
 * découpe réelle n'y a pas de bord. Parois de `profondeur` (unités du
 * dessin), de z = 0 à z = profondeur, comme une extrusion.
 */
export function tranchesExterieures(formes: THREE.Shape[], profondeur: number): THREE.BufferGeometry {
  const contours = formes.map((f) => ({
    ext: f.getPoints(64),
    trous: f.holes.map((t) => t.getPoints(64)),
  }));
  const dansPoly = (p: THREE.Vector2, pts: THREE.Vector2[]) => {
    let dedans = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        dedans = !dedans;
      }
    }
    return dedans;
  };
  const dansZone = (p: THREE.Vector2) =>
    contours.some((c) => dansPoly(p, c.ext) && !c.trous.some((t) => dansPoly(p, t)));

  const boite = new THREE.Box2();
  for (const c of contours) for (const p of c.ext) boite.expandByPoint(p);
  const taille = boite.getSize(new THREE.Vector2());
  // pas de sondage : un millième de la zone, de part et d'autre du bord
  const eps = Math.max(taille.x, taille.y) * 1e-3;

  const pos: number[] = [];
  const paroi = (a: THREE.Vector2, b: THREE.Vector2) => {
    const d = new THREE.Vector2().subVectors(b, a);
    const l = d.length();
    if (l < 1e-9) return;
    const m = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5);
    const n = new THREE.Vector2(-d.y / l, d.x / l).multiplyScalar(eps);
    // un bord n'existe que s'il sépare la zone de ce qui n'en est pas
    if (dansZone(m.clone().add(n)) === dansZone(m.clone().sub(n))) return;
    pos.push(a.x, a.y, 0, b.x, b.y, 0, b.x, b.y, profondeur);
    pos.push(a.x, a.y, 0, b.x, b.y, profondeur, a.x, a.y, profondeur);
  };
  for (const c of contours) {
    for (const boucle of [c.ext, ...c.trous]) {
      for (let i = 0; i < boucle.length; i++) {
        paroi(boucle[i], boucle[(i + 1) % boucle.length]);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

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
  dessiner: (ctx: CanvasRenderingContext2D) => void,
  /** finesse du dessin ; 1,5 mm par pixel par défaut */
  mmParPx = 1.5
): THREE.Texture | null {
  const wMm = (box.max.x - box.min.x) * k;
  const hMm = (box.max.y - box.min.y) * k;
  if (wMm <= 0 || hMm <= 0) return null;
  const MM_PAR_PX = mmParPx;
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
  epaisseurPotenceMm: number;
  hauteurPotenceMm: number;
  /** débord de la platine autour du tube, de chaque côté */
  debordPlatineMm: number;
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

  // ⚠ Finesse des dessins PROPORTIONNELLE au caisson. À 1,5 mm par pixel, un
  // drapeau de 300 mm tenait sur 200 pixels : le logo d'un ajourage sortait
  // flou et le bord de la découpe crénelé, alors qu'un caisson de 3 m était
  // net. ~2 000 pixels sur le grand côté, quelle que soit la taille.
  const mmParPxFin = Math.max(0.1, Math.max(largeurPanneauMm, hauteurMm) / 2048);

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
    }, mmParPxFin);
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
  // ⚠ Orienté comme la face ARRIÈRE, le corps porte le dessin EN MIROIR sur
  // sa face avant. Invisible sur un visuel symétrique, faux partout ailleurs :
  // une zone ajourée dans le coin haut-gauche était percée dans le coin
  // haut-droit de la face avant, et l'on y voyait le plexi de l'AUTRE face
  // (constaté le 21/09/2026) ; un dégradé de fond s'y inversait de même.
  // La face avant reçoit donc ses textures retournées autour de l'axe du
  // panneau. Mesuré : face avant = matériau n° 1, face arrière = n° 0.
  const retourner = (t: THREE.Texture | null): THREE.Texture | null => {
    if (!t) return null;
    const m = t.clone();
    // u = x·r + o dans le repère du dessin ; x' = (min + max) − x
    m.repeat.x = -t.repeat.x;
    m.offset.x = t.offset.x + (box.min.x + box.max.x) * t.repeat.x;
    m.needsUpdate = true;
    jetables.push(m);
    return m;
  };
  const matFaceAvant = matFace.clone();
  matFaceAvant.map = retourner(matFace.map);
  matFaceAvant.emissiveMap = retourner(matFace.emissiveMap);
  matFaceAvant.alphaMap = retourner(matFace.alphaMap);
  jetables.push(matFaceAvant);
  corps.material = [matFace, matFaceAvant, matChant];
  separerCapotsDrapeau(corps.geometry, ep);
  groupe.add(corps);

  // ---------- visuel imprimé, À PLAT sur les deux faces ----------
  // Un adhésif n'a pas d'épaisseur : surtout pas d'extrusion, sinon le
  // logo prend un relief et des ombres qui n'existent pas.
  //
  // ⚠ Les couches d'adhésif sont COPLANAIRES. Leur ordre reposait sur un
  // « décalage de profondeur » (polygonOffset) que la profondeur
  // logarithmique du moteur NEUTRALISE : qui passait devant se décidait aux
  // arrondis, donc selon l'angle de vue. Mesuré le 21/09/2026 sur un E posé
  // dans un losange : 0 % du E perdu de face, mais 27 à 63 % de trois-quarts
  // ou en plongée — « la moitié du E qui saute selon la caméra ».
  // Elles sont donc PEINTES dans l'ordre du fichier, comme un vrai empilement
  // de vinyles : sans écrire la profondeur, la dernière posée recouvre les
  // précédentes, quel que soit l'angle. Elles restent testées contre le
  // caisson et la potence, qui les masquent normalement.
  // Une forme par couche, dans l'ordre d'Illustrator : regrouper par couleur
  // perdait cet ordre (un détail gris posé sur un E bleu passait dessous).
  const matsParCouleur = new Map<string, THREE.MeshStandardMaterial>();
  const dev = ep / 2 + 0.05;
  let ordre = 0;
  shapes.forEach((forme, i) => {
    if (i === iCaisson) return;
    const hex = couleurDe(i);
    let mat = matsParCouleur.get(hex);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: 0.6,
        metalness: 0.02,
        side: THREE.DoubleSide,
        depthWrite: false,
        ...(percee ? { alphaMap: percee, alphaTest: 0.5 } : {}),
      });
      matsParCouleur.set(hex, mat);
      jetables.push(mat);
    }
    for (const [face, x] of [["avant", dev], ["arriere", -dev]] as const) {
      const m = poser(aplat([forme]), face, x, srcPanneau);
      m.material = mat;
      m.renderOrder = 1 + ordre;
      // ⚠ Un adhésif n'a pas d'épaisseur : il ne porte pas d'ombre. Posé à
      // 0,05 mm du caisson, il s'ombrait lui-même en bandes hachurées qui
      // bougeaient avec la lumière (acné d'ombre).
      m.castShadow = false;
      groupe.add(m);
    }
    ordre++;
  });

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
    // ⚠ L'ADHÉSIF reste collé sur le plexi de la zone : c'est lui que la
    // lumière traverse. Un aplat de couleur uni à la place effaçait tout ce
    // qui se trouvait dans la zone — le « E » d'un losange ajouré disparaissait
    // sous un losange blanc, en relief comme à plat (constaté le 21/09/2026).
    // Le plexi porte donc le visuel du fichier, rétroéclairé : le logo s'allume
    // dans ses propres couleurs, filtrées par la couleur des LED.
    //
    // La zone est ramenée dans le repère du PANNEAU : ses coordonnées de
    // texture coïncident alors avec celles du visuel, dessiné dans ce même
    // repère. Même transformation que celle du percement plus haut.
    const echelle = zone.k / k;
    const versPanneau = (pt: THREE.Vector2) =>
      new THREE.Vector2(
        box.min.x + zone.dxMm / k + (pt.x - zone.box.min.x) * echelle,
        box.min.y + zone.dyMm / k + (pt.y - zone.box.min.y) * echelle
      );
    const formesPanneau = zone.shapes.map((forme) => {
      const f = new THREE.Shape(forme.getPoints(SEGMENTS).map(versPanneau));
      f.holes = forme.holes.map((t) => new THREE.Path(t.getPoints(SEGMENTS).map(versPanneau)));
      return f;
    });
    // ⚠ Couleurs BRUTES du fichier, sans égaliser leur luminosité. Un adhésif
    // bleu laisse passer bien moins de lumière qu'une zone blanche : si on les
    // ramène au même niveau, pousser l'éclairage les brûle ENSEMBLE au blanc.
    // Mesuré le 21/09/2026, à puissance 0,6 : luminosité égalisée, le losange
    // ne paraissait pas allumé (224) tant que le E gardait sa teinte ; couleurs
    // brutes, le losange est allumé (255) ET le E reste bleu (teinte 208 pour
    // 212 dans le fichier). Un noir reste noir : l'encre bloque la lumière.
    //
    // ⚠ La COULEUR DE DIFFUSION est celle des LED : elle teinte la lumière qui
    // traverse le plexi ET l'adhésif. Peinte en fond du visuel, elle restait
    // cachée sous l'adhésif dès que la zone en était couverte — le réglage
    // « ne faisait rien » (constaté le 21/09/2026). Elle porte donc sur
    // l'ÉMISSION, par multiplication : le visuel dit ce que chaque endroit
    // laisse passer (plexi nu = tout), les LED disent quelle lumière passe.
    const visuel = masqueDessin(box, k, (ctx) => {
      // le plexi nu laisse tout passer...
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(box.min.x, box.min.y, box.max.x - box.min.x, box.max.y - box.min.y);
      // ...et l'adhésif posé dessus la filtre, forme par forme
      shapes.forEach((forme, i) => {
        if (i === iCaisson) return;
        ctx.fillStyle = couleurDe(i);
        ctx.fill(tracer(ctx, forme), "evenodd");
      });
    }, mmParPxFin);
    if (visuel) {
      visuel.colorSpace = THREE.SRGBColorSpace;
      jetables.push(visuel);
    }
    // ⚠ Intensité ÉTALONNÉE à la mesure (21/09/2026), sur deux critères à
    // tenir sur TOUTE la course du curseur : le plexi doit RAYONNER (halo
    // mesurable autour de la zone) et l'adhésif doit garder SA teinte. Pour
    // un E bleu de teinte 212 dans le fichier, à puissance 0,6 :
    //   émission 0,58 → aucun halo, la zone ne paraît pas allumée
    //   émission 0,9  → halo net, E à 208
    //   émission 1,5  → E à 196 (vire au cyan) ; 2,0 → brûlé au blanc
    // Plage retenue 0,85 → 1,15 : halo dès la puissance 0, E entre 203 et 208.
    // L'ancienne formule (0,8 + 0,9 × puissance) brûlait l'adhésif. Celle du
    // panneau à plat ne se transpose pas : sa scène s'assombrit en mode
    // ajourage, celle du drapeau reste en plein jour.
    // (Le halo des LED de COULEUR se règle côté post-traitement : voir
    // `majBloom`, seuil par canal sur un drapeau.)
    const intensite = 0.85 + 0.3 * r.intensite;
    const matAdhesif = new THREE.MeshStandardMaterial({
      // teinté lui aussi : la lumière du jour renvoyée par un plexi blanc
      // ramenait la zone au blanc (255, 255, 244 mesuré en LED jaunes, le
      // 21/09/2026). En LED blanches, rendu inchangé.
      color: new THREE.Color(r.couleurDiffusion),
      map: visuel,
      emissive: new THREE.Color(r.couleurDiffusion),
      emissiveMap: visuel,
      emissiveIntensity: intensite,
      roughness: 0.5,
      // la rotation qui redresse le dessin retourne aussi la normale d'une
      // surface PLANE : sans double face, un des deux côtés disparaît
      side: THREE.DoubleSide,
    });
    // le chant d'un plexi en saillie n'est pas imprimé : il diffuse
    const matChantPlexi = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r.couleurDiffusion),
      emissive: new THREE.Color(r.couleurDiffusion),
      emissiveIntensity: intensite,
      roughness: 0.5,
    });
    jetables.push(matAdhesif, matChantPlexi);

    if (r.mode === "ajourageRelief") {
      // la zone RESSORT du caisson et s'allume sur ses deux faces ; côté
      // avant, l'extrusion part vers -X : pour RESSORTIR du caisson il faut
      // donc caler son extrémité, pas son origine. Groupes d'une extrusion :
      // 0 = les deux faces (imprimées), 1 = le chant.
      const s = Math.max(2, r.saillieMm);
      for (const [face, x] of [["avant", ep / 2 + s], ["arriere", -ep / 2 - s]] as const) {
        const m = poser(extruder(formesPanneau, s, k), face, x, srcPanneau);
        m.material = [matAdhesif, matChantPlexi];
        // ⚠ Un plexi allumé n'a pas d'ombre noire à son pied : il éclaire la
        // face autour de lui. Son ombre portée dessinait une bande sombre le
        // long de la zone, lue comme du dibond qui dépasse (21/09/2026).
        m.castShadow = false;
        groupe.add(m);
      }
    } else {
      // ajourage À PLAT : on découpe le dibond, le plexi se loge dans la
      // saignée — il est donc EN RETRAIT de l'épaisseur de la plaque.
      for (const [face, x] of [["avant", ep / 2 - DIBOND_MM], ["arriere", -ep / 2 + DIBOND_MM]] as const) {
        const m = poser(aplat(formesPanneau), face, x, srcPanneau);
        m.material = matAdhesif;
        m.castShadow = false;
        groupe.add(m);
      }

      // ⚠ TRANCHE DE LA DÉCOUPE : le bord du dibond, de la face jusqu'au
      // plexi. Sans elle, de biais, on voyait par l'interstice l'intérieur
      // creux du caisson (le « caisson transparent »).
      // Elle ne suit que le contour EXTÉRIEUR de la zone : une zone relevée
      // est souvent faite de plusieurs formes jointives (un losange et le E
      // posé dessus), mais la découpe du dibond, elle, est d'un seul tenant.
      // Extruder chaque forme dessinait un trait sombre le long du E
      // (constaté le 21/09/2026).
      // Couleur de l'âme d'un composite aluminium, que la découpe met à nu.
      const matSaignee = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#2e2e2e"),
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      jetables.push(matSaignee);
      // côté avant la géométrie file vers -X depuis son origine : posée au
      // ras de la face, elle descend jusqu'au plexi ; côté arrière, l'inverse
      for (const [face, x] of [["avant", ep / 2], ["arriere", -ep / 2]] as const) {
        const m = poser(tranchesExterieures(formesPanneau, DIBOND_MM / k), face, x, srcPanneau);
        m.material = matSaignee;
        m.castShadow = false;
        groupe.add(m);
      }
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
  // `epaisseur` suit l'axe X (celui de l'épaisseur du caisson), `hauteur` l'axe Y
  const poserTube = (epaisseur: number, hauteur: number, yCentre: number) => {
    const yDessin = H / 2 - yCentre; // repère du dessin, y vers le bas
    const avancee = ecart + bordAvant(yDessin, hauteur);
    if (avancee <= 0.5) return;
    const geo = new THREE.BoxGeometry(epaisseur, hauteur, avancee);
    jetables.push(geo);
    const m = new THREE.Mesh(geo, matPotence);
    m.position.set(0, yCentre, avancee / 2);
    m.castShadow = true;
    groupe.add(m);
    {
      // platine vissée au mur, SYSTÉMATIQUE sur une potence (son absence
      // était un oubli, 05/10/2026) : le tube y est soudé, elle déborde autour
      const debord = Math.max(0, r.debordPlatineMm);
      const EP_PLATINE = 8;
      const geoP = new THREE.BoxGeometry(epaisseur + 2 * debord, hauteur + 2 * debord, EP_PLATINE);
      jetables.push(geoP);
      const p = new THREE.Mesh(geoP, matPotence);
      p.position.set(0, yCentre, EP_PLATINE / 2);
      p.castShadow = true;
      p.receiveShadow = true;
      groupe.add(p);
    }
  };
  const sec = Math.max(10, r.sectionTubeMm);
  if (r.potence === "monopotence") {
    // ⚠ Dimensions PROPRES, jamais déduites de la section des tubes : elle
    // était multipliée par 2,2 — 30 mm réglés donnaient une potence de 66 mm,
    // plus épaisse qu'un caisson de 30 (21/09/2026). Une monopotence est
    // souvent habillée d'un cache : c'est lui qu'on voit, et c'est lui qu'on
    // règle. Elle ne dépasse pas le caisson en hauteur.
    poserTube(
      Math.max(10, r.epaisseurPotenceMm),
      Math.min(H, Math.max(10, r.hauteurPotenceMm)),
      0
    );
  } else {
    // aux EXTRÉMITÉS du caisson, à 3 mm du bord : c'est là qu'on visse
    const bord = 3;
    poserTube(sec, sec, H / 2 - bord - sec / 2);
    poserTube(sec, sec, -H / 2 + bord + sec / 2);
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
