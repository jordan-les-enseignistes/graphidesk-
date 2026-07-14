// ============================================================
// Canvas offscreen pleine résolution
// ============================================================
// Contient l'image d'origine à sa résolution native. C'est LA
// source pour toute lecture pixel (baguette magique, détection).
// On ne lit JAMAIS les pixels depuis la vue Konva zoomée.

let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

export function setOffscreenFromImage(img: HTMLImageElement): void {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    offscreenCanvas = null;
    offscreenCtx = null;
    return;
  }
  ctx.drawImage(img, 0, 0);
  offscreenCanvas = canvas;
  offscreenCtx = ctx;
}

export function clearOffscreen(): void {
  offscreenCanvas = null;
  offscreenCtx = null;
}

export function getOffscreenSize(): { width: number; height: number } | null {
  if (!offscreenCanvas) return null;
  return { width: offscreenCanvas.width, height: offscreenCanvas.height };
}

/** Canvas pleine résolution (pour la loupe : drawImage direct) */
export function getOffscreenCanvas(): HTMLCanvasElement | null {
  return offscreenCanvas;
}

/** Lecture d'une région de pixels pleine résolution (pour flood fill, etc.) */
export function getOffscreenImageData(
  x: number,
  y: number,
  w: number,
  h: number
): ImageData | null {
  if (!offscreenCtx) return null;
  return offscreenCtx.getImageData(x, y, w, h);
}
