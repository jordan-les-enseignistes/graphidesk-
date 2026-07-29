// ============================================================
// Import d'un fichier vectoriel pour la simulation 3D
// ============================================================
// Permet d'ouvrir une enseigne SANS Illustrator — les commerciaux n'en ont
// pas. Trois formats acceptés :
//   .svg → utilisé tel quel
//   .pdf / .ai → les tracés sont extraits page 1 et retranscrits en SVG
//
// Un .ai enregistré avec « compatibilité PDF » (le réglage par défaut
// d'Illustrator) EST un PDF : le même lecteur traite les deux.
//
// Le reste de la chaîne 3D ne voit qu'un SVG : rien à adapter en aval.

// ⚠ On s'adresse DIRECTEMENT à pdfjs-dist, pas à la copie interne de
// react-pdf : les deux versions diffèrent et le lecteur refuse de tourner
// si le moteur et son processus de calcul ne sont pas de la même version.
import * as pdfjs from "pdfjs-dist";
// Le processus de calcul est embarqué dans l'application plutôt que chargé
// depuis un CDN : un commercial doit pouvoir ouvrir un PDF sans connexion.
import workerPdf from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// affectation systématique : la valeur par défaut de pdf.js est un chemin
// relatif qui ne se résout pas dans un module empaqueté
pdfjs.GlobalWorkerOptions.workerSrc = workerPdf;

export interface EnseigneImportee {
  svg: string;
  wMm: number;
  hMm: number;
  /** nom lisible, pour l'affichage */
  nom: string;
}

const PT_EN_MM = 25.4 / 72;

/** Longueur CSS (« 210mm », « 595pt », « 800 ») → millimètres */
function longueurEnMm(valeur: string | null): number | null {
  if (!valeur) return null;
  const m = valeur.trim().match(/^([\d.]+)\s*([a-z%]*)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  switch (m[2].toLowerCase()) {
    case "mm": return n;
    case "cm": return n * 10;
    case "in": return n * 25.4;
    case "pt": return n * PT_EN_MM;
    case "pc": return n * 12 * PT_EN_MM;
    case "": case "px": return n * (25.4 / 96);
    default: return null;
  }
}

/**
 * Dimensions réelles du DESSIN contenu dans un SVG — pas celles de la page.
 * ⚠ La distinction est capitale : une enseigne de 1,80 m posée au milieu
 * d'une page A3 doit rester à 1,80 m. Renvoyer la taille de la page
 * l'étirerait à 42 cm... ou à 4 m selon le document.
 * La mesure se fait en insérant le SVG hors écran et en interrogeant le
 * navigateur, seul juge fiable de l'emprise réelle des tracés.
 */
function tailleSvg(svg: string): { wMm: number; hMm: number } {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const racine = doc.documentElement;
  const wPage = longueurEnMm(racine.getAttribute("width"));
  const hPage = longueurEnMm(racine.getAttribute("height"));
  const vb = (racine.getAttribute("viewBox") ?? "")
    .split(/[\s,]+/)
    .map(parseFloat)
    .filter((n) => isFinite(n));

  // combien de millimètres vaut une unité utilisateur du document ?
  let mmParUnite = 25.4 / 96; // pixels CSS par défaut
  if (wPage && vb.length === 4 && vb[2] > 0) mmParUnite = wPage / vb[2];
  else if (wPage && !vb.length) mmParUnite = 1; // dimensions sans viewBox

  const hote = document.createElement("div");
  hote.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden";
  hote.innerHTML = svg;
  document.body.appendChild(hote);
  try {
    const el = hote.querySelector("svg");
    const boite = el ? (el as SVGGraphicsElement).getBBox() : null;
    if (boite && boite.width > 0 && boite.height > 0) {
      return { wMm: boite.width * mmParUnite, hMm: boite.height * mmParUnite };
    }
  } catch {
    // getBBox indisponible : on retombe sur la page
  } finally {
    hote.remove();
  }
  if (wPage && hPage) return { wMm: wPage, hMm: hPage };
  if (vb.length === 4) return { wMm: vb[2] * mmParUnite, hMm: vb[3] * mmParUnite };
  return { wMm: 1000, hMm: 300 };
}

/* ---------- PDF / AI ---------- */

type Matrice = [number, number, number, number, number, number];

function multiplier(a: Matrice, b: Matrice): Matrice {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function appliquer(m: Matrice, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** pdf.js renvoie déjà « #rrggbb » ; les anciennes versions donnaient un
 *  triplet 0-255. On accepte les deux. */
function versHex(valeur: unknown): string {
  if (typeof valeur === "string" && /^#[0-9a-f]{6}$/i.test(valeur)) return valeur;
  if (Array.isArray(valeur) && valeur.length >= 3) {
    const c = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `#${c(valeur[0])}${c(valeur[1])}${c(valeur[2])}`;
  }
  return "#000000";
}

/**
 * Extrait les tracés REMPLIS de la première page et les retranscrit en SVG.
 * On ne garde que le remplissage : c'est la matière de la lettre. Les
 * contours, dégradés et motifs sont ignorés — une lettre découpée est une
 * surface pleine, et c'est tout ce dont l'extrusion a besoin.
 */
async function pdfVersSvg(donnees: ArrayBuffer): Promise<{ svg: string; wMm: number; hMm: number }> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(donnees) }).promise;
  const page = await doc.getPage(1);
  const vue = page.getViewport({ scale: 1 });
  const largeurPt = vue.width;
  const hauteurPt = vue.height;

  const liste = await page.getOperatorList();
  const OPS = pdfjs.OPS;

  // repère PDF : origine en bas à gauche, y vers le haut. SVG : y vers le
  // bas. La matrice de base fait la bascule une fois pour toutes.
  const base: Matrice = [1, 0, 0, -1, 0, hauteurPt];
  let ctm: Matrice = base;
  const pile: { ctm: Matrice; remplissage: string }[] = [];
  let remplissage = "#000000";
  let cheminCourant = "";
  const morceaux: string[] = [];
  let empriseX0 = Infinity, empriseY0 = Infinity;
  let empriseX1 = -Infinity, empriseY1 = -Infinity;

  const emettre = (regle: "nonzero" | "evenodd") => {
    if (!cheminCourant.trim()) return;
    morceaux.push(
      `<path d="${cheminCourant.trim()}" fill="${remplissage}" fill-rule="${regle}"/>`
    );
  };

  for (let i = 0; i < liste.fnArray.length; i++) {
    const fn = liste.fnArray[i];
    const args = liste.argsArray[i];
    switch (fn) {
      case OPS.save:
        pile.push({ ctm, remplissage });
        break;
      case OPS.restore: {
        const p = pile.pop();
        if (p) {
          ctm = p.ctm;
          remplissage = p.remplissage;
        }
        break;
      }
      case OPS.transform:
        ctm = multiplier(ctm, args as unknown as Matrice);
        break;
      case OPS.setFillRGBColor:
        remplissage = versHex(args[0]);
        break;
      case OPS.constructPath: {
        // pdf.js 5 : args = [opérationDePeinture, tracéÀPlat, emprise]
        // Le tracé mélange codes et coordonnées dans un seul tableau :
        //   0 = déplacement (2)   1 = ligne (2)
        //   2 = courbe (6)        4 = fermeture (0)
        // et c'est l'opération de peinture qui dit s'il faut remplir.
        const peinture = args[0] as number;
        // args[1] contient les SOUS-TRACÉS : un tableau par contour fermé.
        // (une lettre creuse en compte plusieurs). Les anciennes versions
        // donnaient un tableau à plat : on accepte les deux formes.
        const brut = args[1] as unknown;
        const sousTraces: ArrayLike<number>[] =
          Array.isArray(brut) && typeof brut[0] === "number"
            ? [brut as ArrayLike<number>]
            : (brut as ArrayLike<number>[]);
        let d = "";
        // emprise du tracé courant : elle ne rejoindra l'emprise générale
        // que si le tracé est RETENU. Sinon un simple trait de repère
        // agrandirait l'enseigne sans rien y ajouter.
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        const pt = (x: number, y: number) => {
          const [px, py] = appliquer(ctm, x, y);
          if (px < bx0) bx0 = px;
          if (px > bx1) bx1 = px;
          if (py < by0) by0 = py;
          if (py > by1) by1 = py;
          return `${px.toFixed(2)},${py.toFixed(2)}`;
        };
        const retenir = () => {
          if (bx0 < empriseX0) empriseX0 = bx0;
          if (bx1 > empriseX1) empriseX1 = bx1;
          if (by0 < empriseY0) empriseY0 = by0;
          if (by1 > empriseY1) empriseY1 = by1;
        };
        for (const st of sousTraces ?? []) {
          const plat = Array.from(st);
          let k = 0;
          let lisible = true;
          while (k < plat.length && lisible) {
            const code = plat[k++];
            if (code === 0) {
              d += ` M ${pt(plat[k], plat[k + 1])}`;
              k += 2;
            } else if (code === 1) {
              d += ` L ${pt(plat[k], plat[k + 1])}`;
              k += 2;
            } else if (code === 2) {
              d += ` C ${pt(plat[k], plat[k + 1])} ${pt(plat[k + 2], plat[k + 3])} ${pt(plat[k + 4], plat[k + 5])}`;
              k += 6;
            } else if (code === 4) {
              d += " Z";
            } else {
              // code inconnu : impossible de deviner combien de valeurs il
              // consomme, on arrête ce tracé plutôt que de produire du faux
              lisible = false;
            }
          }
        }
        cheminCourant += d;
        // la peinture est portée par l'opération elle-même
        if (
          peinture === OPS.fill ||
          peinture === OPS.fillStroke ||
          peinture === OPS.closeFillStroke
        ) {
          emettre("nonzero");
          retenir();
          cheminCourant = "";
        } else if (
          peinture === OPS.eoFill ||
          peinture === OPS.eoFillStroke ||
          peinture === OPS.closeEOFillStroke
        ) {
          emettre("evenodd");
          retenir();
          cheminCourant = "";
        } else {
          // contour seul : rien à extruder
          cheminCourant = "";
        }
        break;
      }
      case OPS.fill:
      case OPS.fillStroke:
      case OPS.closeFillStroke:
        emettre("nonzero");
        cheminCourant = "";
        break;
      case OPS.eoFill:
      case OPS.eoFillStroke:
      case OPS.closeEOFillStroke:
        emettre("evenodd");
        cheminCourant = "";
        break;
      case OPS.stroke:
      case OPS.closeStroke:
      case OPS.endPath:
        // tracé sans remplissage : rien à extruder
        cheminCourant = "";
        break;
      default:
        break;
    }
  }

  if (morceaux.length === 0) {
    throw new Error(
      "Aucun tracé rempli trouvé. Vectorise les textes et aplatis la transparence avant d'exporter."
    );
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeurPt.toFixed(2)} ${hauteurPt.toFixed(2)}">` +
    morceaux.join("") +
    `</svg>`;
  // dimensions du DESSIN (repli sur la page si l'emprise est inexploitable)
  const empriseOk = empriseX1 > empriseX0 && empriseY1 > empriseY0;
  const wPt = empriseOk ? empriseX1 - empriseX0 : largeurPt;
  const hPt = empriseOk ? empriseY1 - empriseY0 : hauteurPt;
  return { svg, wMm: wPt * PT_EN_MM, hMm: hPt * PT_EN_MM };
}

/* ---------- point d'entrée ---------- */

export async function importerFichier(fichier: File): Promise<EnseigneImportee> {
  const nom = fichier.name;
  const ext = nom.toLowerCase().split(".").pop() ?? "";
  if (ext === "svg") {
    const svg = await fichier.text();
    if (!/<svg/i.test(svg)) throw new Error("Ce fichier n'est pas un SVG valide.");
    const { wMm, hMm } = tailleSvg(svg);
    return { svg, wMm, hMm, nom };
  }
  if (ext === "pdf" || ext === "ai") {
    const buf = await fichier.arrayBuffer();
    try {
      const r = await pdfVersSvg(buf);
      return { ...r, nom };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // un .ai enregistré SANS compatibilité PDF n'est pas lisible ici
      throw new Error(
        ext === "ai"
          ? `${msg} (pour un .ai, enregistre-le avec l'option « Créer un fichier compatible PDF »)`
          : msg
      );
    }
  }
  throw new Error("Formats acceptés : .svg, .pdf, .ai");
}
