// ============================================================
// Canvases offscreen pleine résolution (un par PHOTO du projet)
// ============================================================
// Contiennent les images d'origine à leur résolution native. C'est LA
// source pour toute lecture pixel (baguette magique, détection, exports).
// On ne lit JAMAIS les pixels depuis la vue Konva zoomée.
//
// v1.5 multi-faces : registre par photoId + notion de photo ACTIVE.
// Les fonctions historiques (sans argument) travaillent sur la photo
// active — les consommateurs mono-photo n'ont pas changé.

interface Entry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

const registry = new Map<string, Entry>();
let activeId: string | null = null;

export function setOffscreenFromImage(img: HTMLImageElement, photoId: string): void {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  registry.set(photoId, { canvas, ctx });
  if (!activeId) activeId = photoId;
}

/** Photo active (celle de la face sélectionnée) */
export function setActiveOffscreen(photoId: string | null): void {
  activeId = photoId;
}

export function removeOffscreen(photoId: string): void {
  registry.delete(photoId);
  if (activeId === photoId) activeId = registry.keys().next().value ?? null;
}

export function clearOffscreen(): void {
  registry.clear();
  activeId = null;
}

export function hasOffscreen(photoId: string): boolean {
  return registry.has(photoId);
}

function entry(photoId?: string): Entry | null {
  const id = photoId ?? activeId;
  return (id && registry.get(id)) || null;
}

export function getOffscreenSize(photoId?: string): { width: number; height: number } | null {
  const e = entry(photoId);
  return e ? { width: e.canvas.width, height: e.canvas.height } : null;
}

/** Canvas pleine résolution (photo active par défaut) */
export function getOffscreenCanvas(photoId?: string): HTMLCanvasElement | null {
  return entry(photoId)?.canvas ?? null;
}

/** Lecture d'une région de pixels pleine résolution (flood fill, etc.) */
export function getOffscreenImageData(
  x: number,
  y: number,
  w: number,
  h: number,
  photoId?: string
): ImageData | null {
  return entry(photoId)?.ctx.getImageData(x, y, w, h) ?? null;
}
