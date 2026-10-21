/**
 * Vérif FAB — lecture d'un PDF (ou d'un .ai enregistré avec la compatibilité
 * PDF) SANS Illustrator : ce que l'atelier mesurerait à la règle.
 *
 * Deux lecteurs, chacun pour ce qu'il sait faire :
 *   - pdf-lib : les boîtes de la page (Media/Trim/Bleed/Art), les tons directs
 *     (CutContour…) et les valeurs CMJN telles qu'écrites dans le fichier ;
 *   - pdf.js  : le texte, les calques, et l'emprise réelle de chaque tracé
 *     (pdf.js fournit la boîte de chaque chemin dans son repère local : on la
 *     replace dans la page en suivant les transformations).
 *
 * Le module ne dépend pas du navigateur : `pdfjs` est injecté (le navigateur
 * fournit sa version avec worker, le banc de test la version Node).
 */
import { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFDict, PDFRef, decodePDFRawStream } from "pdf-lib";
import type * as PdfJs from "pdfjs-dist";

const MM = 25.4 / 72;
const arrondi = (v: number) => Math.round(v * 10) / 10;

export interface BoiteMm {
  largeur: number;
  hauteur: number;
  /** décalage depuis le coin haut-gauche de la MediaBox */
  gauche: number;
  haut: number;
}

export interface EmpriseMm {
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
  largeur: number;
  hauteur: number;
}

export interface CouleurTracee {
  /** couleur telle que rendue (les tons directs y sont convertis) */
  rgb: string;
  remplissages: number;
  contours: number;
  /** épaisseurs des contours de cette couleur, en points (ex. CutContour : 1 pt attendu) */
  epaisseursPt?: number[];
  emprise: EmpriseMm;
}

export interface AnalysePage {
  page: number;
  media: BoiteMm;
  trim: BoiteMm | null;
  bleed: BoiteMm | null;
  art: BoiteMm | null;
  texte: string;
  nbTraces: number;
  emprise: EmpriseMm | null;
  couleurs: CouleurTracee[];
  /** `couleurs` : espace de l'image tel qu'écrit dans le fichier (CMJN, RVB, niveaux de gris, ton direct…) */
  images: { pixels: string; poseeMm: string; dpi: number; couleurs?: string }[];
  /** formes détachées (lettres de découpe) : hauteur de chacune, ligne par ligne */
  formes: ReturnType<typeof formesDetachees>;
}

export interface AnalysePdf {
  pages: number;
  createur: string | null;
  dateModification: string | null;
  calques: { nom: string; visible: boolean }[];
  tonsDirects: string[];
  /** par couleur (ton direct ou quadri) : tracés dessinés en surimpression ou non */
  surimpression: ReturnType<typeof surimpression>;
  /** valeurs CMJN écrites dans le fichier, les plus fréquentes d'abord */
  cmjn: { valeur: string; occurrences: number }[];
  detail: AnalysePage[];
}

/* ------------------------------------------------------------- pdf-lib */

function boite(page: ReturnType<PDFDocument["getPage"]>, quoi: "trim" | "bleed" | "art" | "media"): BoiteMm | null {
  const cle = { trim: "TrimBox", bleed: "BleedBox", art: "ArtBox", media: "MediaBox" }[quoi];
  // une boîte absente du fichier vaut la MediaBox chez pdf-lib : on ne la
  // signale que si elle est réellement écrite
  if (quoi !== "media" && !page.node.lookup(PDFName.of(cle))) return null;
  const m = page.getMediaBox();
  const b =
    quoi === "trim" ? page.getTrimBox() : quoi === "bleed" ? page.getBleedBox() : quoi === "art" ? page.getArtBox() : m;
  return {
    largeur: arrondi(b.width * MM),
    hauteur: arrondi(b.height * MM),
    gauche: arrondi((b.x - m.x) * MM),
    haut: arrondi((m.y + m.height - (b.y + b.height)) * MM),
  };
}

/** Espace de couleur d'une image, en clair (les espaces ICC et indexés sont ramenés à leur base) */
function nomEspace(doc: PDFDocument, cs: unknown, profondeur = 0): string | null {
  const o = cs instanceof PDFRef ? doc.context.lookup(cs) : cs;
  if (profondeur > 4 || !o) return null;
  if (o instanceof PDFName) {
    return { "/DeviceCMYK": "CMJN", "/DeviceRGB": "RVB", "/DeviceGray": "niveaux de gris", "/CalRGB": "RVB", "/CalGray": "niveaux de gris", "/Lab": "Lab" }[o.asString()] ?? null;
  }
  if (!(o instanceof PDFArray) || !o.size()) return null;
  const t = o.get(0);
  const type = t instanceof PDFName ? t.asString() : "";
  if (type === "/ICCBased") {
    const profil = doc.context.lookup(o.get(1));
    const n = profil instanceof PDFRawStream || profil instanceof PDFDict
      ? (profil instanceof PDFRawStream ? profil.dict : profil).lookup(PDFName.of("N")) : null;
    const v = n ? Number(n.toString()) : 0;
    return v === 4 ? "CMJN (profil ICC)" : v === 3 ? "RVB (profil ICC)" : v === 1 ? "niveaux de gris (profil ICC)" : "profil ICC";
  }
  if (type === "/Indexed") return nomEspace(doc, o.get(1), profondeur + 1);
  if (type === "/Separation") {
    const n = o.get(1);
    return n instanceof PDFName ? `ton direct ${decodeURIComponent(n.asString().slice(1).replace(/#/g, "%"))}` : "ton direct";
  }
  if (type === "/DeviceN") {
    const n = o.get(1);
    return n instanceof PDFArray ? `DeviceN (${n.asArray().map((x) => (x instanceof PDFName ? x.asString().slice(1) : "?")).join(", ")})` : "DeviceN";
  }
  return nomEspace(doc, t, profondeur + 1);
}

/** Espace de couleur des images du fichier, par taille en pixels (« 3188 x 3897 px ») */
function espacesImages(doc: PDFDocument): Map<string, string> {
  // les masques de transparence (SMask) sont des images en gris : on ne les compte pas
  const masques = new Set<unknown>();
  const images: PDFDict[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const st = obj.dict.lookup(PDFName.of("Subtype"));
    if (!(st instanceof PDFName) || st.asString() !== "/Image") continue;
    images.push(obj.dict);
    const m = obj.dict.lookup(PDFName.of("SMask"));
    if (m) masques.add(m);
  }
  const parTaille = new Map<string, Set<string>>();
  for (const d of images) {
    if ([...masques].some((m) => m instanceof PDFRawStream && m.dict === d)) continue;
    if (d.lookup(PDFName.of("ImageMask"))?.toString() === "true") continue;
    const w = d.lookup(PDFName.of("Width")), h = d.lookup(PDFName.of("Height"));
    if (!w || !h) continue;
    const filtre = d.lookup(PDFName.of("Filter"))?.toString() ?? "";
    const espace = nomEspace(doc, d.get(PDFName.of("ColorSpace")))
      ?? (filtre.includes("JPX") ? "défini dans l'image (JPEG 2000)" : "inconnu");
    const cle = `${w.toString()} x ${h.toString()} px`;
    const s = parTaille.get(cle) ?? new Set<string>();
    s.add(espace);
    parTaille.set(cle, s);
  }
  return new Map([...parTaille].map(([k, s]) => [k, [...s].join(" / ")]));
}

function tonsDirects(doc: PDFDocument): string[] {
  const noms = new Set<string>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const visiter = (o: unknown, profondeur: number) => {
      if (profondeur > 4 || !o) return;
      if (o instanceof PDFArray && o.size() > 1) {
        const t = o.get(0);
        if (t instanceof PDFName && t.asString() === "/Separation") {
          const n = o.get(1);
          if (n instanceof PDFName) noms.add(decodeURIComponent(n.asString().slice(1).replace(/#/g, "%")));
        }
        if (t instanceof PDFName && t.asString() === "/DeviceN") {
          const n = o.get(1);
          if (n instanceof PDFArray)
            n.asArray().forEach((x) => x instanceof PDFName && noms.add(x.asString().slice(1)));
        }
        o.asArray().forEach((x) => visiter(x, profondeur + 1));
      } else if (o instanceof PDFDict) {
        o.values().forEach((x) => visiter(x, profondeur + 1));
      }
    };
    visiter(obj, 0);
  }
  ["All", "None"].forEach((n) => noms.delete(n));
  return [...noms].sort();
}

/** Valeurs CMJN des opérateurs k / K de tous les flux de dessin */
function valeursCmjn(doc: PDFDocument): { valeur: string; occurrences: number }[] {
  const compte = new Map<string, number>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const st = obj.dict.lookup(PDFName.of("Subtype"));
    const type = obj.dict.lookup(PDFName.of("Type"));
    // flux de page (sans Subtype) ou Form XObject ; on saute images et polices
    if (st instanceof PDFName && st.asString() !== "/Form") continue;
    if (type instanceof PDFName && type.asString() !== "/XObject") continue;
    let texte: string;
    try {
      texte = new TextDecoder("latin1").decode(decodePDFRawStream(obj).decode());
    } catch {
      continue;
    }
    if (texte.length > 5_000_000) continue;
    for (const m of texte.matchAll(/(?:^|\s)([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+[kK](?=\s)/g)) {
      const v = m.slice(1, 5).map((x) => Math.round(parseFloat(x) * 100));
      const cle = `C${v[0]} M${v[1]} J${v[2]} N${v[3]}`;
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
  }
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([valeur, occurrences]) => ({ valeur, occurrences }));
}

/**
 * Surimpression : pour chaque ton direct (White, CutContour…) et pour la
 * quadri, combien de remplissages/contours sont dessinés avec la surimpression
 * active. En vitrophanie, le calque White doit être en surimpression au-dessus
 * du graphisme (sinon le blanc « défonce » le visuel) — Jordan, 19/10/2026.
 * Lecture séquentielle des flux : approximation suffisante pour Illustrator.
 */
function surimpression(doc: PDFDocument) {
  // noms de ressources → ton direct / état de surimpression, sur tout le document
  const espaces = new Map<string, string>();
  const etats = new Map<string, boolean>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null;
    if (!dict) continue;
    const res = dict.lookup(PDFName.of("Resources"));
    const sources = [res instanceof PDFDict ? res : null, dict];
    for (const r of sources) {
      if (!r) continue;
      const cs = r.lookup(PDFName.of("ColorSpace"));
      if (cs instanceof PDFDict)
        for (const [k, v] of cs.entries()) {
          const a = doc.context.lookup(v);
          if (a instanceof PDFArray && a.size() > 1 && a.lookup(0) instanceof PDFName && (a.lookup(0) as PDFName).asString() === "/Separation") {
            const n = a.lookup(1);
            if (n instanceof PDFName) espaces.set(k.asString().slice(1), decodeURIComponent(n.asString().slice(1).replace(/#/g, "%")));
          }
        }
      const gs = r.lookup(PDFName.of("ExtGState"));
      if (gs instanceof PDFDict)
        for (const [k, v] of gs.entries()) {
          const g = doc.context.lookup(v);
          if (!(g instanceof PDFDict)) continue;
          const op = g.lookup(PDFName.of("op")) ?? g.lookup(PDFName.of("OP"));
          if (op) etats.set(k.asString().slice(1), op.toString() === "true");
        }
    }
  }
  if (!espaces.size) return null;
  const compte = new Map<string, { total: number; surimp: number }>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const st = obj.dict.lookup(PDFName.of("Subtype"));
    if (st instanceof PDFName && st.asString() !== "/Form") continue;
    if (obj.dict.lookup(PDFName.of("Type")) instanceof PDFName && (obj.dict.lookup(PDFName.of("Type")) as PDFName).asString() !== "/XObject") continue;
    let t: string;
    try { t = new TextDecoder("latin1").decode(decodePDFRawStream(obj).decode()); } catch { continue; }
    if (t.length > 20_000_000) continue;
    let sur = false, remplir = "quadri", tracer = "quadri";
    const pile: [boolean, string, string][] = [];
    for (const m of t.matchAll(/\/([A-Za-z0-9_.#-]+)\s+(gs|cs|CS)\b|\b(q|Q|k|K|rg|RG|g|G|f\*?|F|B\*?|b\*?|S|s)(?=\s)/g)) {
      if (m[2] === "gs") sur = etats.get(m[1]) ?? sur;
      else if (m[2] === "cs") remplir = espaces.get(m[1]) ?? "quadri";
      else if (m[2] === "CS") tracer = espaces.get(m[1]) ?? "quadri";
      else {
        const o = m[3];
        if (o === "q") pile.push([sur, remplir, tracer]);
        else if (o === "Q") [sur, remplir, tracer] = pile.pop() ?? [sur, remplir, tracer];
        else if (o === "k" || o === "rg" || o === "g") remplir = "quadri";
        else if (o === "K" || o === "RG" || o === "G") tracer = "quadri";
        else {
          const cible = o === "S" || o === "s" ? tracer : remplir;
          const e = compte.get(cible) ?? { total: 0, surimp: 0 };
          e.total++; if (sur) e.surimp++;
          compte.set(cible, e);
        }
      }
    }
  }
  return [...compte.entries()].map(([couleur, e]) => ({
    couleur,
    traces: e.total,
    enSurimpression: e.surimp,
  }));
}

/* ------------------------------------------------------------- pdf.js */

type Matrice = [number, number, number, number, number, number];
const multiplier = (m: Matrice, n: Matrice): Matrice => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

class Cumul {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  ajouter(m: Matrice, b: ArrayLike<number>) {
    const coins = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]];
    for (const [x, y] of coins) {
      const X = m[0] * x + m[2] * y + m[4];
      const Y = m[1] * x + m[3] * y + m[5];
      this.x0 = Math.min(this.x0, X); this.x1 = Math.max(this.x1, X);
      this.y0 = Math.min(this.y0, Y); this.y1 = Math.max(this.y1, Y);
    }
  }
  vide() { return this.x0 === Infinity; }
  /** en mm, origine en haut à gauche de la MediaBox */
  enMm(media: [number, number, number, number]): EmpriseMm {
    const gauche = (this.x0 - media[0]) * MM;
    const droite = (this.x1 - media[0]) * MM;
    const haut = (media[3] - this.y1) * MM;
    const bas = (media[3] - this.y0) * MM;
    return {
      gauche: arrondi(gauche), haut: arrondi(haut), droite: arrondi(droite), bas: arrondi(bas),
      largeur: arrondi(droite - gauche), hauteur: arrondi(bas - haut),
    };
  }
}

function enHex(args: unknown[]): string {
  const a = args[0];
  if (typeof a === "string") return a.toLowerCase();
  const v = (Array.isArray(args) && args.length >= 3 ? args : (a as number[])) as number[];
  return "#" + v.slice(0, 3).map((x) => Math.round(Number(x)).toString(16).padStart(2, "0")).join("");
}

async function lirePageJs(pdfjs: typeof PdfJs, page: PdfJs.PDFPageProxy) {
  const OPS = pdfjs.OPS;
  const media = page.view as [number, number, number, number];
  const ops = await page.getOperatorList();
  let ctm: Matrice = [1, 0, 0, 1, 0, 0];
  const pile: Matrice[] = [];
  let remplissage = "#000000";
  let contour = "#000000";
  // épaisseur de trait courante (unités du PDF, avant transformation)
  let trait = 1;
  const pileCouleurs: [string, string, number][] = [];
  const total = new Cumul();
  const parCouleur = new Map<string, { c: Cumul; f: number; s: number; ep: Map<number, number> }>();
  const images: AnalysePage["images"] = [];
  const sousTraces: Boite[] = [];
  let nbTraces = 0;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];
    switch (fn) {
      case OPS.save: pile.push(ctm); pileCouleurs.push([remplissage, contour, trait]); break;
      case OPS.restore: ctm = pile.pop() ?? ctm; [remplissage, contour, trait] = pileCouleurs.pop() ?? [remplissage, contour, trait]; break;
      case OPS.setLineWidth: trait = Number(args[0]) || 0; break;
      case OPS.setGState: {
        // l'épaisseur peut venir d'un état graphique (clé LW)
        for (const [cle, valeur] of (args[0] as [string, unknown][]) ?? []) if (cle === "LW") trait = Number(valeur) || 0;
        break;
      }
      case OPS.transform: ctm = multiplier(ctm, args as Matrice); break;
      case OPS.paintFormXObjectBegin: {
        pile.push(ctm); pileCouleurs.push([remplissage, contour, trait]);
        const mat = args[0] as Matrice | null;
        if (mat) ctm = multiplier(ctm, mat);
        break;
      }
      case OPS.paintFormXObjectEnd: ctm = pile.pop() ?? ctm; [remplissage, contour, trait] = pileCouleurs.pop() ?? [remplissage, contour, trait]; break;
      case OPS.setFillRGBColor: remplissage = enHex(args); break;
      case OPS.setStrokeRGBColor: contour = enHex(args); break;
      case OPS.setFillGray: remplissage = enHex([args[0], args[0], args[0]].map((g) => Number(g) * 255)); break;
      case OPS.setStrokeGray: contour = enHex([args[0], args[0], args[0]].map((g) => Number(g) * 255)); break;
      case OPS.constructPath: {
        const op = args[0] as number;
        const minMax = args[2] as ArrayLike<number> | null;
        if (!minMax || !isFinite(minMax[0])) break;
        const remplit = op === OPS.fill || op === OPS.eoFill || op === OPS.fillStroke || op === OPS.eoFillStroke
          || op === OPS.closeFillStroke || op === OPS.closeEOFillStroke;
        const trace = op === OPS.stroke || op === OPS.closeStroke || op === OPS.fillStroke || op === OPS.eoFillStroke
          || op === OPS.closeFillStroke || op === OPS.closeEOFillStroke;
        if (!remplit && !trace) break; // tracé de masque (clip) : il ne s'imprime pas
        nbTraces++;
        total.ajouter(ctm, minMax);
        const noter = (couleur: string, estContour: boolean) => {
          let e = parCouleur.get(couleur);
          if (!e) parCouleur.set(couleur, (e = { c: new Cumul(), f: 0, s: 0, ep: new Map() }));
          e.c.ajouter(ctm, minMax);
          if (estContour) {
            e.s++;
            // épaisseur réelle : celle du PDF mise à l'échelle de la transformation courante
            const pt = Math.round(trait * Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) * 100) / 100;
            e.ep.set(pt, (e.ep.get(pt) ?? 0) + 1);
          } else e.f++;
        };
        if (remplit) noter(remplissage, false);
        if (trace) noter(contour, true);
        // chaque sous-tracé (une lettre, le trou d'un « O », le point d'un « i »)
        const donnees = (args[1] as unknown[] | undefined)?.[0];
        if (donnees && ArrayBuffer.isView(donnees) && sousTraces.length < 4000)
          for (const b of boitesSousTraces(donnees as unknown as Float32Array)) sousTraces.push(boiteDansPage(ctm, b, media));
        break;
      }
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject: {
        const w = Number(args[1] ?? 0), h = Number(args[2] ?? 0);
        const posL = Math.hypot(ctm[0], ctm[1]), posH = Math.hypot(ctm[2], ctm[3]);
        total.ajouter(ctm, [0, 0, 1, 1]);
        if (w && posL)
          images.push({
            pixels: `${w} x ${h} px`,
            poseeMm: `${arrondi(posL * MM)} x ${arrondi(posH * MM)} mm`,
            dpi: Math.round(w / (posL / 72)),
          });
        break;
      }
    }
  }

  // les 6 couleurs les plus présentes + toutes celles qui ont des contours (le CutContour peut n'avoir qu'un tracé)
  const triees = [...parCouleur.entries()].sort((a, b) => b[1].f + b[1].s - (a[1].f + a[1].s));
  const couleurs = triees
    .filter(([, e], i) => i < 6 || e.s > 0)
    .slice(0, 12)
    .map(([rgb, e]) => ({
      rgb, remplissages: e.f, contours: e.s,
      ...(e.s ? { epaisseursPt: [...e.ep.keys()].sort((a, b) => a - b).slice(0, 6) } : {}),
      emprise: e.c.enMm(media),
    }));

  const contenu = await page.getTextContent();
  let texte = "";
  for (const it of contenu.items) if ("str" in it) texte += it.str + (it.hasEOL ? "\n" : " ");
  // le BAT est relu mot à mot (coquilles) : texte gardé presque en entier
  texte = texte.replace(/[ \t]+/g, " ").trim().slice(0, 6000);

  return { nbTraces, emprise: total.vide() ? null : total.enMm(media), couleurs, images: images.slice(0, 10), texte, formes: formesDetachees(sousTraces) };
}

/* ------------------------------------------------------------- lettres */

/** boîte en mm, origine en haut à gauche de la page */
interface Boite { x0: number; y0: number; x1: number; y1: number }

/** Boîtes des sous-tracés d'un chemin pdf.js (opérations DrawOPS à plat) */
function boitesSousTraces(p: Float32Array): Boite[] {
  const out: Boite[] = [];
  let b: Boite | null = null;
  const ajouter = (x: number, y: number) => {
    if (!b) b = { x0: x, y0: y, x1: x, y1: y };
    else { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); }
  };
  for (let i = 0; i < p.length;) {
    const op = p[i++];
    if (op === 0) { if (b) out.push(b); b = null; ajouter(p[i], p[i + 1]); i += 2; }       // moveTo
    else if (op === 1) { ajouter(p[i], p[i + 1]); i += 2; }                                // lineTo
    else if (op === 2) { ajouter(p[i], p[i + 1]); ajouter(p[i + 2], p[i + 3]); ajouter(p[i + 4], p[i + 5]); i += 6; } // curveTo
    else if (op === 3) { ajouter(p[i], p[i + 1]); ajouter(p[i + 2], p[i + 3]); i += 4; }   // quadraticCurveTo
    else if (op === 4) { /* closePath */ }
    else break; // format inconnu : on s'arrête plutôt que de lire n'importe quoi
  }
  if (b) out.push(b);
  return out;
}

function boiteDansPage(m: Matrice, b: Boite, media: [number, number, number, number]): Boite {
  const xs: number[] = [], ys: number[] = [];
  for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]]) {
    xs.push(m[0] * x + m[2] * y + m[4]);
    ys.push(m[1] * x + m[3] * y + m[5]);
  }
  return {
    x0: (Math.min(...xs) - media[0]) * MM, x1: (Math.max(...xs) - media[0]) * MM,
    y0: (media[3] - Math.max(...ys)) * MM, y1: (media[3] - Math.min(...ys)) * MM,
  };
}

/**
 * Formes détachées d'un fichier de découpe (lettres PVC, lettrage adhésif…) :
 * on fusionne les sous-tracés contenus dans un autre (trou d'un « O », contour
 * doublé), puis on mesure la hauteur de chaque forme. Une lettre plus petite
 * que ses voisines — 63 mm au lieu de 70 — se voit ici, pas dans l'emprise
 * de la ligne. Les lettres rondes dépassent naturellement de 1 à 4 %.
 */
function formesDetachees(boites: Boite[]) {
  if (boites.length < 2) return null;
  const tri = [...boites].sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
  const formes: Boite[] = [];
  const tol = 0.3;
  for (const b of tri) {
    const parent = formes.find((f) => b.x0 >= f.x0 - tol && b.x1 <= f.x1 + tol && b.y0 >= f.y0 - tol && b.y1 <= f.y1 + tol);
    if (!parent) formes.push({ ...b });
  }
  // un cadre ou un fond qui contient tout n'est pas une lettre
  const grandes = formes.filter((f) => f.x1 - f.x0 > 0.5 && f.y1 - f.y0 > 0.5);
  if (grandes.length < 2 || grandes.length > 400) return { nombre: grandes.length };
  const hauteurs = grandes.map((f) => f.y1 - f.y0).sort((a, b) => a - b);
  const mediane = hauteurs[Math.floor(hauteurs.length / 2)];
  // lignes de texte : formes regroupées par hauteur ET par position verticale
  const lettres = grandes.filter((f) => f.y1 - f.y0 >= mediane * 0.4).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lignes: Boite[][] = [];
  for (const f of lettres) {
    const l = lignes.find((li) => {
      const ref = li[0];
      const centre = (f.y0 + f.y1) / 2;
      return centre > ref.y0 && centre < ref.y1;
    });
    if (l) l.push(f); else lignes.push([f]);
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    nombre: grandes.length,
    petitesFormes: grandes.length - lettres.length, // points, accents, ponctuation
    lignes: lignes.slice(0, 12).map((li) => {
      const hs = li.map((f) => f.y1 - f.y0).sort((a, b) => a - b);
      const med = hs[Math.floor(hs.length / 2)];
      li.sort((a, b) => a.x0 - b.x0);
      return {
        lettres: li.length,
        largeurTotale: r(li[li.length - 1].x1 - li[0].x0),
        hauteurMediane: r(med),
        hauteurMin: r(hs[0]),
        hauteurMax: r(hs[hs.length - 1]),
        // chaque forme, de gauche à droite (hauteur en mm) — une seule hors norme suffit à fausser une enseigne
        hauteurs: li.length <= 60 ? li.map((f) => r(f.y1 - f.y0)) : undefined,
        // une lettre PLUS PETITE que la capitale de sa ligne est suspecte ; plus
        // grande de quelques % c'est le dépassement normal des O, S, U, C, G
        horsNorme: li
          .map((f, i) => ({ rang: i + 1, x: r(f.x0), hauteur: r(f.y1 - f.y0) }))
          .filter((f) => (med - f.hauteur) / med > 0.03 || (f.hauteur - med) / med > 0.08),
      };
    }),
  };
}

/**
 * Hauteurs de capitale comparées d'une ligne à l'autre : deux lignes censées
 * avoir la même hauteur (même cote au BAT) qui diffèrent de plus de 3 % sont
 * le cas « EXAMEN DE VUE » à 63 mm au milieu de lignes à 70 mm (Optic Duroc,
 * 19/10/2026). À l'IA de confronter ces hauteurs aux cotes du BAT.
 */
export function resumeHauteurs(formes: ReturnType<typeof formesDetachees>): string | null {
  if (!formes || !("lignes" in formes) || !formes.lignes) return null;
  return formes.lignes
    .map((l, i) => `ligne ${i + 1} : ${l.lettres} lettres, capitale ${l.hauteurMediane} mm (lettres rondes jusqu'à ${l.hauteurMax} mm)`)
    .join(" ; ");
}

/* ------------------------------------------------------------- entrée */

/**
 * `source` (fichiers lourds) : pdf.js lit alors le vrai fichier à la demande, et `octets`
 * n'est que son squelette (sans les données des images) pour pdf-lib.
 */
export async function analyserPdf(pdfjs: typeof PdfJs, octets: Uint8Array, source?: Parameters<typeof PdfJs.getDocument>[0]): Promise<AnalysePdf> {
  // chaque lecteur reçoit sa copie : pdf.js transfère le tampon à son worker
  const docLib = await PDFDocument.load(source ? octets : octets.slice(), { ignoreEncryption: true, updateMetadata: false });
  const docJs = await pdfjs.getDocument(source ?? { data: octets.slice(), isEvalSupported: false }).promise;
  try {
    const calques: AnalysePdf["calques"] = [];
    try {
      const config = await docJs.getOptionalContentConfig();
      for (const [, groupe] of config) calques.push({ nom: groupe.name ?? "?", visible: groupe.visible });
    } catch { /* pas de calques */ }

    const detail: AnalysePage[] = [];
    const espaces = espacesImages(docLib);
    const nb = Math.min(docJs.numPages, 30);
    for (let i = 1; i <= nb; i++) {
      const pLib = docLib.getPage(i - 1);
      const pJs = await docJs.getPage(i);
      const js = await lirePageJs(pdfjs, pJs);
      detail.push({
        page: i,
        media: boite(pLib, "media")!,
        trim: boite(pLib, "trim"),
        bleed: boite(pLib, "bleed"),
        art: boite(pLib, "art"),
        ...js,
        images: js.images.map((im) => ({ ...im, couleurs: espaces.get(im.pixels) ?? "inconnu" })),
      });
      pJs.cleanup();
    }
    const info = await docJs.getMetadata().catch(() => null);
    const inf = (info?.info ?? {}) as Record<string, string>;
    return {
      pages: docJs.numPages,
      createur: inf.Creator ?? null,
      dateModification: inf.ModDate ?? null,
      calques,
      tonsDirects: tonsDirects(docLib),
      surimpression: surimpression(docLib),
      cmjn: valeursCmjn(docLib),
      detail,
    };
  } finally {
    await docJs.destroy();
  }
}

/** PDF ou .ai compatible PDF ? (un .ai sans compatibilité PDF ne se lit pas) */
export function estPdf(octets: Uint8Array): boolean {
  const tete = new TextDecoder("latin1").decode(octets.slice(0, 1024));
  return tete.includes("%PDF-");
}

