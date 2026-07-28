// ============================================================
// Export "Fiche VT" pour le gabarit InDesign (plugin Cotes BAT)
// ============================================================
// Écrit dans Documents\GraphiDesk\fiches_vt\{horodatage}_{nom}\ :
//   - fiche_vt.json : zones sélectionnées (lettre, coins px photo, cotes)
//   - fiche_vt.jpg (+ fiche_vt_2.jpg...) : les photos du projet
// Le plugin InDesign détecte automatiquement la fiche la plus récente.
//
// v2 multi-faces : une PAGE de fiche par face (ordre de la liste des
// faces), les faces d'une même photo partagent le même JPEG. Les champs
// v1 (photoFile/photoWidth/photoHeight/zones) restent renseignés avec la
// première page pour qu'un ancien plugin reste utilisable.

import { invoke } from "@tauri-apps/api/core";
import { getOffscreenCanvas } from "./offscreen";
import { toBase64 } from "./psdExport";
import { zoneNom } from "./zones";
import { useMeasureDoc } from "../state/store";
import type { Zone } from "../state/types";

/** Index → lettre (A..Z, AA, AB...) — même convention que le plugin InDesign */
function lettreAffichage(n: number): string {
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

interface FicheZone {
  letter: string;
  displayLetter: string;
  label: string;
  corners: Zone["corners"];
  widthMm: number;
  heightMm: number;
}

/**
 * Exporte la fiche VT (toutes les faces du projet ayant des zones cochées).
 * Lève une erreur si une photo n'est pas disponible.
 * @param selected zones à faire mesurer par le poseur (toutes faces)
 * @param projet   nom lisible (repris dans le volet du plugin InDesign)
 */
export async function exportFicheVt(selected: Zone[], projet: string): Promise<void> {
  if (selected.length === 0) throw new Error("Aucune zone sélectionnée");
  const doc = useMeasureDoc.getState();

  // pages = faces (ordre de la liste) ayant au moins une zone cochée
  const facePages = doc.planes
    .map((plane) => ({
      plane,
      zones: selected.filter((z) => z.planeId === plane.id),
    }))
    .filter((f) => f.zones.length > 0);
  if (facePages.length === 0) throw new Error("Aucune zone sélectionnée");

  // un JPEG par photo utilisée (les faces d'une même photo le partagent) ;
  // la 1re garde le nom historique fiche_vt.jpg (compat ancien plugin)
  const photoFiles = new Map<
    string,
    { fileName: string; base64: string; width: number; height: number }
  >();
  for (const f of facePages) {
    const photoId = f.plane.photoId;
    if (photoFiles.has(photoId)) continue;
    const canvas = getOffscreenCanvas(photoId);
    if (!canvas) {
      const nomPhoto = doc.photos.find((p) => p.id === photoId)?.name ?? photoId;
      throw new Error(`Photo « ${nomPhoto} » non disponible`);
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
    if (!blob) throw new Error("Échec de la génération JPEG");
    const n = photoFiles.size;
    photoFiles.set(photoId, {
      fileName: n === 0 ? "fiche_vt.jpg" : `fiche_vt_${n + 1}.jpg`,
      base64: toBase64(new Uint8Array(await blob.arrayBuffer())),
      width: canvas.width,
      height: canvas.height,
    });
  }

  // lettres d'AFFICHAGE : suite propre CONTINUE sur toute la fiche
  // (A, B, C page 1 puis D, E page 2...) — le poseur ne voit jamais deux
  // fois la même lettre. La lettre TECHNIQUE ne change jamais.
  let li = 0;
  const pages = facePages.map((f) => {
    const photo = photoFiles.get(f.plane.photoId)!;
    const zones: FicheZone[] = f.zones.map((z) => ({
      letter: z.label.replace(/^Zone\s+/i, ""),
      displayLetter: lettreAffichage(li++),
      label: zoneNom(z),
      corners: z.corners,
      widthMm: Math.round(z.widthMm),
      heightMm: Math.round(z.heightMm),
    }));
    return {
      face: f.plane.name,
      photoFile: photo.fileName,
      photoWidth: photo.width,
      photoHeight: photo.height,
      zones,
    };
  });

  const fiche = {
    version: 2,
    source: "GraphiDesk Mesure photo",
    projet,
    // ---- compat v1 (ancien plugin : mono-page = première page) ----
    photoFile: pages[0].photoFile,
    photoWidth: pages[0].photoWidth,
    photoHeight: pages[0].photoHeight,
    zones: pages[0].zones,
    // ---- v2 : une page de gabarit par face ----
    pages,
  };

  // dossier horodaté : trié par nom = trié par date (le plugin prend le plus récent)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const slug =
    projet
      .replace(/[^a-zA-Z0-9à-ÿÀ-Ÿ _-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "projet";

  const allPhotos = [...photoFiles.values()];
  await invoke<string>("save_fiche_vt", {
    folderName: `${ts}_${slug}`,
    jsonContent: JSON.stringify(fiche, null, 2),
    photoBase64: allPhotos[0].base64,
    extraPhotos: allPhotos.slice(1).map((p) => ({
      fileName: p.fileName,
      contentBase64: p.base64,
    })),
  });
}
