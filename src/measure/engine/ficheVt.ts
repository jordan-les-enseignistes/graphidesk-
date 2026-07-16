// ============================================================
// Export "Fiche VT" pour le gabarit InDesign (plugin Cotes BAT)
// ============================================================
// Écrit dans Documents\GraphiDesk\fiches_vt\{horodatage}_{nom}\ :
//   - fiche_vt.json : zones sélectionnées (lettre, coins px photo, cotes)
//   - fiche_vt.jpg  : la photo
// Le plugin InDesign détecte automatiquement la fiche la plus récente.

import { invoke } from "@tauri-apps/api/core";
import { getOffscreenCanvas } from "./offscreen";
import { toBase64 } from "./psdExport";
import { zoneNom } from "./zones";
import type { Zone } from "../state/types";

/**
 * Exporte la fiche VT. Lève une erreur si la photo n'est pas disponible.
 * @param selected zones à faire mesurer par le poseur
 * @param projet   nom lisible (repris dans le volet du plugin InDesign)
 */
export async function exportFicheVt(selected: Zone[], projet: string): Promise<void> {
  if (selected.length === 0) throw new Error("Aucune zone sélectionnée");
  const photo = getOffscreenCanvas();
  if (!photo) throw new Error("Photo non disponible");

  const blob = await new Promise<Blob | null>((resolve) =>
    photo.toBlob((b) => resolve(b), "image/jpeg", 0.9)
  );
  if (!blob) throw new Error("Échec de la génération JPEG");
  const photoB64 = toBase64(new Uint8Array(await blob.arrayBuffer()));

  const fiche = {
    version: 1,
    source: "GraphiDesk Mesure photo",
    projet,
    photoFile: "fiche_vt.jpg",
    photoWidth: photo.width,
    photoHeight: photo.height,
    zones: selected.map((z) => ({
      // la LETTRE technique ne change jamais (croix lettrées du plugin InDesign)
      letter: z.label.replace(/^Zone\s+/i, ""),
      // le label affiché dans le tableau de la fiche = nom libre du graphiste
      label: zoneNom(z),
      corners: z.corners,
      widthMm: Math.round(z.widthMm),
      heightMm: Math.round(z.heightMm),
    })),
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

  await invoke<string>("save_fiche_vt", {
    folderName: `${ts}_${slug}`,
    jsonContent: JSON.stringify(fiche, null, 2),
    photoBase64: photoB64,
  });
}
