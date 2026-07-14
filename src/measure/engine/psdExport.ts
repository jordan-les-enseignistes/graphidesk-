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
import { roundTo5Mm, orderQuadInImage } from "./zones";
import type { Zone } from "../state/types";

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

/** PNG bytes d'un canvas */
async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) throw new Error("Échec de génération PNG");
  return new Uint8Array(await blob.arrayBuffer());
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

  // Calque de fond : la photo
  children.push({
    name: "Photo façade",
    canvas: photo,
    left: 0,
    top: 0,
  });

  // Grandes zones en bas de la pile de calques (une zone englobante opaque
  // masquerait tout ce qu'elle contient)
  const sorted = [...zones].sort(
    (a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm
  );

  for (const zone of sorted) {
    const vitrage = zone.fill === "vitrage";
    const wMm = roundTo5Mm(zone.widthMm);
    const hMm = roundTo5Mm(zone.heightMm);

    // Contenu embarqué 1:1 (1 px = 1 mm)
    const content = renderZoneContent(wMm, hMm, vitrage);
    const pngData = await canvasToPng(content);
    // ⚠️ ag-psd exige un GUID pur pour les placed layers (zone.id est déjà un UUID)
    const fileId = /^[0-9a-f-]{36}$/i.test(zone.id) ? zone.id : crypto.randomUUID();
    const fileName = `${zone.label.replace(/\s+/g, "_")}_${Math.round(wMm)}x${Math.round(hMm)}mm.png`;
    linkedFiles.push({ id: fileId, name: fileName, data: pngData });

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

    children.push({
      name: `${zone.label} (≈ ${wMm} × ${hMm} mm)`,
      canvas: preview.canvas,
      left: preview.left,
      top: preview.top,
      placedLayer: {
        id: fileId,
        type: "raster",
        transform: t,
        nonAffineTransform: t,
        width: content.width,
        height: content.height,
      },
    });
  }

  const psd: Psd = {
    width: photo.width,
    height: photo.height,
    children,
    linkedFiles,
  };

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
