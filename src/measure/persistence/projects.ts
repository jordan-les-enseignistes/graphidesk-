// ============================================================
// Persistance des projets de mesure (Supabase + Storage)
// ============================================================
// À la sauvegarde, la photo est COMPRESSÉE (max 2560px, JPEG 85%)
// pour tenir dans le quota Storage gratuit (~1MB par projet au lieu
// de 3-8MB). Les coordonnées du document sont mises à l'échelle en
// conséquence — les DIMENSIONS mesurées (mm), elles, sont des valeurs
// déjà calculées : aucune perte de précision.

import { supabase } from "@/lib/supabase";
import type { MeasureDoc, Plane, Zone, Pt, H } from "../state/types";

const BUCKET = "measure-photos";
const MAX_DIM = 2560;
const JPEG_QUALITY = 0.85;

export type ProjectStatut = "attente_vt" | "vt_recue" | "terminee";

export interface VtDims {
  [zoneId: string]: { widthMm: number; heightMm: number };
}

/** Sous-ensemble sérialisable du document (sans les brouillons) */
export interface SavedDoc {
  planes: Plane[];
  activePlaneId: string;
  zones: Zone[];
  imageName: string | null;
}

export interface MeasureProjectRow {
  id: string;
  nom: string;
  dossier_id: string | null;
  statut: ProjectStatut;
  doc: SavedDoc;
  vt_dims: VtDims;
  photo_path: string;
  photo_width: number;
  photo_height: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- mise à l'échelle du document (photo compressée) ----------

function scalePt(p: Pt, s: number): Pt {
  return { x: p.x * s, y: p.y * s };
}

/** H mappe px image → mm. Si px' = px * s, alors H'(x') = H(x'/s). */
function scaleH(h: H, s: number): H {
  return [h[0] / s, h[1] / s, h[2], h[3] / s, h[4] / s, h[5], h[6] / s, h[7] / s, h[8]];
}

function scaleDoc(doc: MeasureDoc, s: number): SavedDoc {
  return {
    activePlaneId: doc.activePlaneId,
    imageName: doc.imageName,
    planes: doc.planes.map((p) => ({
      ...p,
      reference: p.reference
        ? {
            ...p.reference,
            imgPts: p.reference.imgPts.map((pt) => scalePt(pt, s)) as [Pt, Pt, Pt, Pt],
          }
        : null,
      H: p.H ? scaleH(p.H, s) : null,
    })),
    zones: doc.zones.map((z) => ({
      ...z,
      corners: z.corners.map((pt) => scalePt(pt, s)) as [Pt, Pt, Pt, Pt],
    })),
  };
}

/** Compression de la photo : max 2560px, JPEG 85% */
async function compressPhoto(
  photo: HTMLCanvasElement
): Promise<{ blob: Blob; width: number; height: number; scale: number }> {
  const s = Math.min(1, MAX_DIM / Math.max(photo.width, photo.height));
  const w = Math.round(photo.width * s);
  const h = Math.round(photo.height * s);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(photo, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Échec de compression de la photo");
  return { blob, width: w, height: h, scale: s };
}

// ---------- CRUD ----------

export async function saveProject(
  nom: string,
  dossierId: string | null,
  doc: MeasureDoc,
  photo: HTMLCanvasElement
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Non connecté");

  const { blob, width, height, scale } = await compressPhoto(photo);
  const savedDoc = scaleDoc(doc, scale);

  const projectId = crypto.randomUUID();
  const photoPath = `${userId}/${projectId}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(photoPath, blob, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw new Error(`Upload photo : ${upErr.message}`);

  const { error: insErr } = await supabase.from("measure_projects").insert({
    id: projectId,
    nom,
    dossier_id: dossierId,
    statut: "attente_vt",
    doc: savedDoc,
    photo_path: photoPath,
    photo_width: width,
    photo_height: height,
    created_by: userId,
  });
  if (insErr) {
    // nettoyage best-effort de la photo orpheline
    await supabase.storage.from(BUCKET).remove([photoPath]);
    throw new Error(`Enregistrement projet : ${insErr.message}`);
  }
  return projectId;
}

export async function listProjects(): Promise<MeasureProjectRow[]> {
  const { data, error } = await supabase
    .from("measure_projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MeasureProjectRow[];
}

export async function downloadProjectPhoto(photoPath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(photoPath);
  if (error || !data) throw new Error(`Téléchargement photo : ${error?.message ?? "vide"}`);
  return data;
}

export async function updateProjectVt(
  id: string,
  vtDims: VtDims,
  statut: ProjectStatut
): Promise<void> {
  const { error } = await supabase
    .from("measure_projects")
    .update({ vt_dims: vtDims, statut })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setProjectStatut(id: string, statut: ProjectStatut): Promise<void> {
  const { error } = await supabase.from("measure_projects").update({ statut }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string, photoPath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([photoPath]);
  const { error } = await supabase.from("measure_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
