/**
 * Vérif FAB — outils que Claude appelle et que GraphiDesk exécute sur le
 * poste, en LECTURE SEULE (commandes Rust verif_lister_dossier,
 * verif_lire_fichier, verif_lire_plage, verif_squelette_pdf). Rien ici
 * n'écrit dans le dossier client.
 */
import { invoke } from "@tauri-apps/api/core";
import * as pdfjs from "pdfjs-dist";
import workerPdf from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { analyserPdf, estPdf } from "./analysePdf";
import { comparerTrames } from "./comparaison";

pdfjs.GlobalWorkerOptions.workerSrc = workerPdf;

export interface EntreeDossier {
  chemin: string;
  est_dossier: boolean;
  taille: number;
  modifie: number;
}

/** Bloc de résultat d'outil tel qu'attendu par l'API */
export type ContenuResultat =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png"; data: string } };

export async function listerDossier(dossier: string): Promise<EntreeDossier[]> {
  return invoke<EntreeDossier[]>("verif_lister_dossier", { chemin: dossier });
}

export function inventaireTexte(dossier: string, entrees: EntreeDossier[]): string {
  const date = (s: number) =>
    s ? new Date(s * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "?";
  const taille = (o: number) => (o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.ceil(o / 1024)} Ko`);
  const lignes = entrees.map((e) =>
    e.est_dossier ? `📁 ${e.chemin}/` : `   ${e.chemin}  (${taille(e.taille)}, modifié le ${date(e.modifie)})`
  );
  return `Dossier : ${dossier}\n${entrees.length} éléments\n${lignes.join("\n")}`;
}

/**
 * Repère un devis dans l'inventaire (nom de fichier). Chez Les Enseignistes,
 * c'est souvent le bon de commande Dolibarr rangé tel quel : « CO2607-5542.pdf »
 * (ou la proposition « PR2607-00069.pdf »). Un dossier FAB-CO… n'en est pas un.
 */
export function contientDevis(entrees: EntreeDossier[]): boolean {
  return entrees.some((e) => {
    if (e.est_dossier) return false;
    const nom = e.chemin.split("/").pop() ?? "";
    return /devis|\bDE\d{4}|^DEV[_-]/i.test(nom) || /^(CO|PR)\d{4}-\d{4,5}.*\.pdf$/i.test(nom);
  });
}

function deBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
}

async function lireOctets(dossier: string, relatif: string): Promise<Uint8Array> {
  return deBase64(await invoke<string>("verif_lire_fichier", { dossier, relatif }));
}

/* ---------------------------------------------------------------- PDF lourds */

// au-delà, un PDF n'est pas chargé en entier (cf. verif.rs, « PDF lourds ») :
// pdf.js le lit par morceaux, pdf-lib n'en reçoit que le squelette
const SEUIL_LOURD = 60 * 1024 * 1024;
// une lecture de serveur coupée laisserait pdf.js attendre sans fin
const DELAI_LOURD = 5 * 60 * 1000;
const PLAGE_MAX = 16 * 1024 * 1024;

type Plage = { taille: number; contenu: string };

/** PDF à mesurer ou afficher : en entier, ou (fichier lourd) squelette + lecture à la demande */
interface SourcePdf {
  octets: Uint8Array;
  /** fichier lourd : paramètres pdf.js (nouveau lecteur à chaque document ouvert) */
  plages?: () => Parameters<typeof pdfjs.getDocument>[0];
}

async function lirePlage(dossier: string, relatif: string, debut: number, fin: number): Promise<Uint8Array> {
  // pdf.js demande parfois tout un flux d'image d'un coup : lu en plusieurs fois
  const morceaux: Uint8Array[] = [];
  for (let d = debut; d < fin; d += PLAGE_MAX) {
    const p = await invoke<Plage>("verif_lire_plage", { dossier, relatif, debut: d, fin: Math.min(fin, d + PLAGE_MAX) });
    morceaux.push(deBase64(p.contenu));
  }
  if (morceaux.length === 1) return morceaux[0];
  const r = new Uint8Array(morceaux.reduce((s, m) => s + m.length, 0));
  let o = 0;
  for (const m of morceaux) { r.set(m, o); o += m.length; }
  return r;
}

/** null : pas un PDF lisible (.ai sans compatibilité PDF, autre format) */
async function lirePdf(dossier: string, relatif: string): Promise<SourcePdf | null> {
  const tete = await invoke<Plage>("verif_lire_plage", { dossier, relatif, debut: 0, fin: 65536 });
  const debut = deBase64(tete.contenu);
  if (!estPdf(debut)) return null;
  if (tete.taille <= SEUIL_LOURD) return { octets: await lireOctets(dossier, relatif) };
  const octets = deBase64(await invoke<string>("verif_squelette_pdf", { dossier, relatif }));
  return {
    octets,
    plages: () => {
      const transport = new pdfjs.PDFDataRangeTransport(tete.taille, debut.slice());
      transport.requestDataRange = (de: number, a: number) => {
        void lirePlage(dossier, relatif, de, a).then((o) => transport.onDataRange(de, o), () => { /* le délai rendra l'erreur */ });
      };
      return { range: transport, length: tete.taille, rangeChunkSize: 1 << 20, disableAutoFetch: true, disableStream: true, isEvalSupported: false };
    },
  };
}

function avecDelai<T>(p: Promise<T>, source: SourcePdf): Promise<T> {
  if (!source.plages) return p;
  return Promise.race([
    p,
    new Promise<T>((_, ko) => setTimeout(() => ko(new Error("Lecture du fichier trop longue (serveur lent ou coupé)")), DELAI_LOURD)),
  ]);
}

// une page entière lisible à 1200 px ; pour un détail, Claude agrandit une zone
// (le coût d'une image croît avec sa surface)
const COTE_MAX = 1200;

function canvasEnJpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

type ZonePct = { gauche: number; haut: number; largeur: number; hauteur: number };

async function rendrePage(source: SourcePdf, numero: number, zone?: ZonePct): Promise<string> {
  return canvasEnJpeg(await avecDelai(rendreCanvas(source, numero, zone, COTE_MAX), source));
}

async function rendreCanvas(source: SourcePdf, numero: number, zone: ZonePct | undefined, coteMax: number): Promise<HTMLCanvasElement> {
  const doc = await pdfjs.getDocument(source.plages ? source.plages() : { data: source.octets, isEvalSupported: false }).promise;
  try {
    if (numero < 1 || numero > doc.numPages) throw new Error(`Page ${numero} inexistante (${doc.numPages} pages)`);
    const page = await doc.getPage(numero);
    const vue1 = page.getViewport({ scale: 1 });
    // zone en % de la page → on agrandit pour que la zone seule remplisse l'image
    const z = zone
      ? {
          x: (Math.max(0, zone.gauche) / 100) * vue1.width,
          y: (Math.max(0, zone.haut) / 100) * vue1.height,
          w: (Math.min(100, zone.largeur) / 100) * vue1.width,
          h: (Math.min(100, zone.hauteur) / 100) * vue1.height,
        }
      : { x: 0, y: 0, w: vue1.width, h: vue1.height };
    const echelle = Math.min(coteMax / Math.max(z.w, z.h), 8);
    const vue = page.getViewport({ scale: echelle, offsetX: -z.x * echelle, offsetY: -z.y * echelle });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(z.w * echelle));
    canvas.height = Math.max(1, Math.round(z.h * echelle));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vue, canvas }).promise;
    return canvas;
  } finally {
    await doc.destroy();
  }
}

async function chargerImage(octets: Uint8Array, type: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([octets as Uint8Array<ArrayBuffer>], { type }));
  try {
    return await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Image illisible"));
      i.src = url;
    });
  } finally {
    // l'image décodée reste utilisable après la révocation de l'URL
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

const EXT_IMAGES = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
const typeImage = (ext: string) => (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");

/**
 * Planche de vignettes numérotées (12 images au plus) : un seul coup d'œil pour
 * repérer, parmi les photos de VT, celles qui portent des cotes.
 */
async function planche(dossier: string, chemins: string[]): Promise<{ data: string; legende: string; illisibles: string[] }> {
  const liste = chemins.slice(0, 12);
  const colonnes = liste.length <= 4 ? 2 : 3;
  const lignes = Math.ceil(liste.length / colonnes);
  const L = 400, H = 300, ENTETE = 34;
  const canvas = document.createElement("canvas");
  canvas.width = colonnes * L;
  canvas.height = lignes * (H + ENTETE);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const illisibles: string[] = [];
  for (let i = 0; i < liste.length; i++) {
    const x = (i % colonnes) * L, y = Math.floor(i / colonnes) * (H + ENTETE);
    ctx.fillStyle = "#186fb7";
    ctx.fillRect(x, y, L, ENTETE);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(String(i + 1), x + 10, y + 25);
    try {
      const ext = liste[i].toLowerCase().split(".").pop() ?? "";
      const img = await chargerImage(await lireOctets(dossier, liste[i]), typeImage(ext));
      const k = Math.min(L / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      ctx.drawImage(img, x + (L - w) / 2, y + ENTETE + (H - h) / 2, w, h);
    } catch {
      illisibles.push(liste[i]);
    }
  }
  const legende = liste.map((c, i) => `${i + 1} = ${c}`).join("\n")
    + (chemins.length > liste.length ? `\n(${chemins.length - liste.length} image(s) non affichée(s) : refais un aperçu avec les suivantes)` : "");
  return { data: canvasEnJpeg(canvas), legende, illisibles };
}

async function reduireImage(octets: Uint8Array, type: string): Promise<string> {
  const url = URL.createObjectURL(new Blob([octets as Uint8Array<ArrayBuffer>], { type }));
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Image illisible"));
      i.src = url;
    });
    const k = Math.min(1, COTE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasEnJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const texte = (t: string): ContenuResultat[] => [{ type: "text", text: t }];
const image = (data: string): ContenuResultat => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });

/**
 * Exécute un outil. `rendre_rapport` n'est pas traité ici : c'est la page qui
 * l'enregistre (il ne lit rien sur le disque).
 */
export async function executerOutil(
  dossier: string,
  nom: string,
  entree: Record<string, unknown>
): Promise<{ contenu: ContenuResultat[]; erreur: boolean }> {
  try {
    switch (nom) {
      case "lister_dossier": {
        const e = await listerDossier(dossier);
        return { contenu: texte(inventaireTexte(dossier, e)), erreur: false };
      }
      case "analyser_pdf": {
        const chemin = String(entree.chemin ?? "");
        const source = await lirePdf(dossier, chemin);
        if (!source)
          return { contenu: texte(`${chemin} n'est pas lisible comme PDF (fichier .ai enregistré sans compatibilité PDF, ou autre format).`), erreur: true };
        const r = await avecDelai(analyserPdf(pdfjs, source.octets, source.plages?.()), source);
        return { contenu: texte(JSON.stringify(r)), erreur: false };
      }
      case "voir_page": {
        const chemin = String(entree.chemin ?? "");
        const source = await lirePdf(dossier, chemin);
        if (!source) return { contenu: texte(`${chemin} n'est pas lisible comme PDF.`), erreur: true };
        const zone = entree.zone as { gauche: number; haut: number; largeur: number; hauteur: number } | undefined;
        const jpeg = await rendrePage(source, Number(entree.page ?? 1), zone);
        return { contenu: [image(jpeg)], erreur: false };
      }
      case "comparer_visuels": {
        // A = référence (BAT, maquette), B = fichier de FAB
        const ref = entree.reference as { chemin: string; page: number; zone?: ZonePct };
        const fab = entree.fab as { chemin: string; page: number; zone?: ZonePct };
        const oa = await lirePdf(dossier, ref.chemin);
        const ob = await lirePdf(dossier, fab.chemin);
        if (!oa || !ob) return { contenu: texte("Les deux fichiers doivent être des PDF (ou .ai compatibles PDF)."), erreur: true };
        const trame = async (o: SourcePdf, p: { page: number; zone?: ZonePct }) => {
          const c = await avecDelai(rendreCanvas(o, Number(p.page ?? 1), p.zone, 1600), o);
          const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
          return { largeur: c.width, hauteur: c.height, donnees: d.data };
        };
        const r = comparerTrames(await trame(oa, ref), await trame(ob, fab));
        if (!r) return { contenu: texte("Aucune forme trouvée dans l'une des deux zones : vérifie les zones choisies."), erreur: true };
        const { image: sup, ...chiffres } = r;
        const c = document.createElement("canvas");
        c.width = sup.largeur; c.height = sup.hauteur;
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(sup.donnees), sup.largeur, sup.hauteur), 0, 0);
        return {
          contenu: [
            texte(`Superposition des contours après recalage (zones en % de l'emprise de la référence). gris = commun, ROUGE = seulement dans la référence (manque dans la FAB ?), BLEU = seulement dans la FAB (en trop ?). Les lignes de cote et cadres du BAT ressortent normalement en rouge.\n${JSON.stringify(chiffres)}`)[0],
            image(canvasEnJpeg(c)),
          ],
          erreur: false,
        };
      }
      case "apercu_images": {
        const chemins = (Array.isArray(entree.chemins) ? entree.chemins : []).map(String)
          .filter((c) => EXT_IMAGES.includes(c.toLowerCase().split(".").pop() ?? ""));
        if (!chemins.length) return { contenu: texte("Aucune image (jpg, png…) dans la liste."), erreur: true };
        const p = await planche(dossier, chemins);
        return {
          contenu: [
            image(p.data),
            ...texte(`Vignettes numérotées :\n${p.legende}${p.illisibles.length ? `\nIllisibles : ${p.illisibles.join(", ")}` : ""}\nOuvre ensuite avec voir_image SEULEMENT celles qui portent des cotes ou une information utile.`),
          ],
          erreur: false,
        };
      }
      case "voir_image": {
        const chemin = String(entree.chemin ?? "");
        const ext = chemin.toLowerCase().split(".").pop() ?? "";
        if (!["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext))
          return { contenu: texte(`${chemin} n'est pas une image lisible (jpg, png…).`), erreur: true };
        const octets = await lireOctets(dossier, chemin);
        return { contenu: [image(await reduireImage(octets, ext === "png" ? "image/png" : "image/jpeg"))], erreur: false };
      }
      default:
        return { contenu: texte(`Outil inconnu : ${nom}`), erreur: true };
    }
  } catch (e) {
    return { contenu: texte(`Échec de ${nom} : ${(e as Error)?.message ?? e}`), erreur: true };
  }
}

/** Fichier glissé par l'utilisateur (devis…) → bloc de message pour l'API */
export async function blocDepuisFichier(f: File): Promise<Record<string, unknown> | null> {
  const octets = new Uint8Array(await f.arrayBuffer());
  const type = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (type === "application/pdf") {
    let b = "";
    for (let i = 0; i < octets.length; i += 0x8000) b += String.fromCharCode(...octets.subarray(i, i + 0x8000));
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: btoa(b) }, title: f.name };
  }
  if (type.startsWith("image/")) return image(await reduireImage(octets, type));
  return null;
}
