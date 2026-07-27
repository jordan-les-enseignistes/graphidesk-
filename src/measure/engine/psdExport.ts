// ============================================================
// Export PSD photomontage — photo + objets dynamiques par zone
// ============================================================
// Structure du PSD généré :
//   - Calque de fond : la photo pleine résolution
//   - Un OBJET DYNAMIQUE par zone, dont :
//       • le contenu embarqué est un PNG à l'ÉCHELLE 1:1 (1 px = 1 mm),
//         pré-rempli (texture vitrage ou blanc)
//       • la transformation "placed layer" épouse les 4 coins cliqués
//         sur la photo (perspective)
// Le graphiste double-clique l'objet dynamique → canevas à plat aux
// dimensions réelles → colle son visuel → enregistre → rendu en
// perspective sur la photo. BAT provisoire photo-réaliste.

import { writePsdUint8Array, type Psd, type Layer } from "ag-psd";
// helpers internes d'ag-psd (RLE par canal — mêmes routines que l'écrivain)
import { writeDataRLE } from "ag-psd/dist-es/helpers.js";
import { roundTo5Mm, orderQuadInImage, zoneNom } from "./zones";
import type { Zone } from "../state/types";

// ============================================================
// CMJN NATIF — le photomontage est écrit DIRECTEMENT en CMJN
// ============================================================
// Pourquoi : convertir un PSD RVB en CMJN dans Photoshop RASTERISE les
// objets dynamiques (vérifié), et convertir les contenus ouvre une fenêtre
// par zone (flashs). On écrit donc nous-mêmes les canaux C/M/Y/K de chaque
// calque (ag-psd est patché via patch-package pour accepter colorMode 4).

/** RGBA → 4 octets/px CMJN (valeurs PSD inversées : 255 = pas d'encre) */
function rgbaToCmykPacked(img: ImageData): Uint8Array {
  const n = img.width * img.height;
  const out = new Uint8Array(n * 4);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const kInk = 255 - Math.max(r, g, b);
    const denom = 255 - kInk;
    let cInk = 0, mInk = 0, yInk = 0;
    if (denom > 0) {
      cInk = Math.round((255 * (255 - r - kInk)) / denom);
      mInk = Math.round((255 * (255 - g - kInk)) / denom);
      yInk = Math.round((255 * (255 - b - kInk)) / denom);
    }
    out[i * 4] = 255 - cInk;
    out[i * 4 + 1] = 255 - mInk;
    out[i * 4 + 2] = 255 - yInk;
    out[i * 4 + 3] = 255 - kInk;
  }
  return out;
}

/** Calque ag-psd avec canaux bruts CMJN (+ transparence) pré-calculés.
 *  psb = format du FICHIER destinataire (le RLE diffère PSD/PSB). */
function calqueCmyk(
  name: string,
  canvas: HTMLCanvasElement,
  left: number,
  top: number,
  psb: boolean,
  extras?: Partial<Layer>
): Layer {
  const ctx = canvas.getContext("2d");
  const img = ctx!.getImageData(0, 0, canvas.width, canvas.height);
  const temp = new Uint8Array(4 * 2 * img.width * img.height + 2 * img.height + 1024);
  const packed = { data: rgbaToCmykPacked(img), width: img.width, height: img.height };

  const channels: { id: number; compression: number; data: Uint8Array; length: number }[] = [];
  // transparence TOUJOURS incluse : sans elle, le premier calque devient un
  // « Arrière-plan » anonyme (la photo doit garder son nom + être déplaçable)
  const a = writeDataRLE(temp, img, [3], psb) as Uint8Array;
  channels.push({ id: -1, compression: 1, data: a, length: 2 + a.length });
  for (let id = 0; id < 4; id++) {
    const c = writeDataRLE(temp, packed, [id], psb) as Uint8Array;
    channels.push({ id, compression: 1, data: c, length: 2 + c.length });
  }

  return {
    name,
    left,
    top,
    right: left + canvas.width,
    bottom: top + canvas.height,
    // canaux fournis tels quels — ag-psd n'y touche plus
    rawData: { channels } as never,
    ...extras,
  } as Layer;
}

/** Rendu du contenu embarqué d'une zone (1 px = 1 mm) */
function renderZoneContent(wMm: number, hMm: number, vitrage: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(wMm));
  canvas.height = Math.max(1, Math.round(hMm));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (vitrage) {
    // dégradé vertical bleu (modèle VITRINE_REMPLISSAGE)
    const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
    grad.addColorStop(0, "#96a9d7");
    grad.addColorStop(1, "#4376ba");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // reflet diagonal blanc
    const refl = ctx.createLinearGradient(
      canvas.width * 0.374,
      canvas.height * 0.003,
      canvas.width * 0.277,
      canvas.height * 0.583
    );
    refl.addColorStop(0, "rgba(255,255,255,0.3)");
    refl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = refl;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.343, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.lineTo(0, 0);
    ctx.lineTo(canvas.width * 0.749, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/** Aperçu du calque dans le document photo : quad rempli (approximation) */
function renderPreview(
  zone: Zone,
  vitrage: boolean
): { canvas: HTMLCanvasElement; left: number; top: number } {
  const xs = zone.corners.map((c) => c.x);
  const ys = zone.corners.map((c) => c.y);
  const left = Math.floor(Math.min(...xs));
  const top = Math.floor(Math.min(...ys));
  const w = Math.max(1, Math.ceil(Math.max(...xs) - left));
  const h = Math.max(1, Math.ceil(Math.max(...ys) - top));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    if (vitrage) {
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, "#96a9d7");
      grad.addColorStop(1, "#4376ba");
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.beginPath();
    ctx.moveTo(zone.corners[0].x - left, zone.corners[0].y - top);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(zone.corners[i].x - left, zone.corners[i].y - top);
    }
    ctx.closePath();
    ctx.fill();
  }
  return { canvas, left, top };
}

/**
 * Construit le PSD photomontage.
 * @param zones zones du plan actif
 * @param photo canvas offscreen pleine résolution de la photo
 */
export async function buildPhotomontagePsd(
  zones: Zone[],
  photo: HTMLCanvasElement
): Promise<Uint8Array> {
  const linkedFiles: NonNullable<Psd["linkedFiles"]> = [];
  const children: Layer[] = [];

  // Calque de fond : la photo (canaux CMJN natifs)
  children.push(calqueCmyk("Photo façade", photo, 0, 0, false));

  // Grandes zones en bas de la pile de calques (une zone englobante opaque
  // masquerait tout ce qu'elle contient)
  const sorted = [...zones].sort(
    (a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm
  );

  for (const zone of sorted) {
    const vitrage = zone.fill === "vitrage";
    const wMm = roundTo5Mm(zone.widthMm);
    const hMm = roundTo5Mm(zone.heightMm);

    // Contenu embarqué 1:1 (1 px = 1 mm) — en PSB, PAS en PNG : un contenu
    // PNG est un format PLAT, dès que le graphiste ajoute ses calques dedans
    // Photoshop refuse le Ctrl+S ("aplatissez les calques..."). Le PSB (le
    // format que Photoshop utilise lui-même pour ses objets dynamiques)
    // accepte les calques : enregistrement direct, objet mis à jour.
    const content = renderZoneContent(wMm, hMm, vitrage);
    const contenuPsb = writePsdUint8Array(
      {
        width: content.width,
        height: content.height,
        colorMode: 4, // CMJN natif (ag-psd patché)
        children: [calqueCmyk("Fond", content, 0, 0, true)],
      } as Psd,
      { psb: true }
    );
    // ⚠️ ag-psd exige un GUID pur pour les placed layers (zone.id est déjà un UUID)
    const fileId = /^[0-9a-f-]{36}$/i.test(zone.id) ? zone.id : crypto.randomUUID();
    const fileName = `${zoneNom(zone).replace(/\s+/g, "_")}_${Math.round(wMm)}x${Math.round(hMm)}mm.psb`;
    linkedFiles.push({ id: fileId, name: fileName, data: contenuPsb });

    // Aperçu dans le document (quad rempli, approximation du rendu)
    const preview = renderPreview(zone, vitrage);

    // Transformation : les 4 coins photo (HG, HD, BD, BG) — perspective.
    // ⚠️ Réordonnés dans l'ESPACE IMAGE : les coins stockés ont pu être
    // ordonnés dans un plan rectifié en miroir (anciennes calibrations),
    // ce qui retournait le contenu de l'objet dynamique gauche/droite.
    const c = orderQuadInImage(zone.corners);
    const t: number[] = [
      c[0].x, c[0].y,
      c[1].x, c[1].y,
      c[2].x, c[2].y,
      c[3].x, c[3].y,
    ];

    children.push(
      calqueCmyk(
        `${zoneNom(zone)} (≈ ${wMm} × ${hMm} mm)`,
        preview.canvas,
        preview.left,
        preview.top,
        false,
        {
          placedLayer: {
            id: fileId,
            type: "raster",
            transform: t,
            nonAffineTransform: t,
            width: content.width,
            height: content.height,
          },
        }
      )
    );
  }

  const psd: Psd = {
    width: photo.width,
    height: photo.height,
    colorMode: 4, // CMJN natif (ag-psd patché)
    children,
    linkedFiles,
  } as Psd;

  return writePsdUint8Array(psd, { generateThumbnail: true });
}

/** Uint8Array → base64 (par blocs pour éviter les limites d'arguments) */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
