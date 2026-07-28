// ============================================================
// Barre des FACES du projet (v1.5 multi-faces)
// ============================================================
// Une face = un plan calibré rattaché à une photo. La barre liste les
// faces dans l'ordre (= ordre des pages de la future fiche VT), permet
// de renommer (double-clic), réordonner, supprimer, et d'ajouter une
// face sur une NOUVELLE photo ou sur la photo AFFICHÉE (bâtiment
// d'angle : deux faces sur la même prise de vue).

import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Copy,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useMeasureDoc, useMeasureImage } from "../state/store";
import { deletePhotoBlob } from "../engine/imageStore";
import { removeOffscreen } from "../engine/offscreen";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface FacesBarProps {
  /** Ouvre le sélecteur de fichier (nouvelle photo → nouvelle face) */
  onAddPhoto: () => void;
}

export function FacesBar({ onAddPhoto }: FacesBarProps) {
  const photos = useMeasureDoc((s) => s.photos);
  const planes = useMeasureDoc((s) => s.planes);
  const activePlaneId = useMeasureDoc((s) => s.activePlaneId);
  const zones = useMeasureDoc((s) => s.zones);
  const setActiveFace = useMeasureDoc((s) => s.setActiveFace);
  const renameFace = useMeasureDoc((s) => s.renameFace);
  const deleteFace = useMeasureDoc((s) => s.deleteFace);
  const moveFace = useMeasureDoc((s) => s.moveFace);
  const addFaceOnPhoto = useMeasureDoc((s) => s.addFaceOnPhoto);
  const images = useMeasureImage((s) => s.images);
  const removeImageFor = useMeasureImage((s) => s.removeImageFor);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const activeFace = planes.find((p) => p.id === activePlaneId);

  const validerNom = (id: string) => {
    if (renameVal.trim()) renameFace(id, renameVal);
    setRenameId(null);
  };

  const confirmerSuppression = () => {
    const face = planes.find((p) => p.id === deleteId);
    setDeleteId(null);
    if (!face) return;
    const derniereDeLaPhoto =
      planes.filter((p) => p.photoId === face.photoId).length === 1;
    deleteFace(face.id);
    if (derniereDeLaPhoto) {
      // la photo sort du projet : nettoyer blob + canvas + image chargée
      void deletePhotoBlob(face.photoId);
      removeOffscreen(face.photoId);
      removeImageFor(face.photoId);
    }
    toast.success(`Face « ${face.name} » supprimée`);
  };

  const faceASupprimer = planes.find((p) => p.id === deleteId);
  const nbZonesFace = faceASupprimer
    ? zones.filter((z) => z.planeId === faceASupprimer.id).length
    : 0;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {planes.map((face, i) => {
        const img = images[face.photoId];
        const active = face.id === activePlaneId;
        const calibree = !!face.H;
        const nbZones = zones.filter((z) => z.planeId === face.id).length;
        return (
          <div
            key={face.id}
            className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 shrink-0 cursor-pointer transition-colors ${
              active
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
            }`}
            onClick={() => setActiveFace(face.id)}
          >
            {img ? (
              <img
                src={img.url}
                alt=""
                className="h-9 w-14 object-cover rounded border border-slate-200 dark:border-slate-600"
              />
            ) : (
              <div className="h-9 w-14 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            )}
            <div className="min-w-0">
              {renameId === face.id ? (
                <input
                  type="text"
                  value={renameVal}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={() => validerNom(face.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") validerNom(face.id);
                    if (e.key === "Escape") setRenameId(null);
                  }}
                  className="w-24 h-6 px-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200"
                />
              ) : (
                <button
                  type="button"
                  className="text-sm font-medium dark:text-slate-200 truncate max-w-[9rem] block text-left"
                  title="Double-clic pour renommer"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenameId(face.id);
                    setRenameVal(face.name);
                  }}
                >
                  {face.name}
                </button>
              )}
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                {calibree && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                <span>
                  {calibree ? `${nbZones} zone(s)` : "non calibrée"}
                </span>
              </div>
            </div>
            {/* actions au survol */}
            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="h-4 text-slate-400 hover:text-slate-600 disabled:opacity-20"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  moveFace(face.id, -1);
                }}
                title="Avancer (ordre des pages de la fiche VT)"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-4 text-slate-400 hover:text-slate-600 disabled:opacity-20"
                disabled={i === planes.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  moveFace(face.id, 1);
                }}
                title="Reculer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {planes.length > 1 && (
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(face.id);
                }}
                title="Supprimer cette face (et ses zones)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* Ajout de face */}
      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          onClick={onAddPhoto}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
          title="Nouvelle face sur une nouvelle photo"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Nouvelle photo
        </button>
        {activeFace && photos.length > 0 && (
          <button
            type="button"
            onClick={() => {
              addFaceOnPhoto(activeFace.photoId);
              toast.info(
                "Nouvelle face sur la même photo — calibre-la sur SON plan (l'autre mur, l'angle...)"
              );
            }}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="Bâtiment d'angle : une 2e face avec SA calibration, sur la photo affichée"
          >
            <Copy className="h-3.5 w-3.5" />
            Face sur cette photo
          </button>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={`Supprimer la face « ${faceASupprimer?.name ?? ""} »`}
        description={
          nbZonesFace > 0
            ? `Ses ${nbZonesFace} zone(s) mesurée(s) et sa calibration seront supprimées (annulable Ctrl+Z pour les zones).`
            : "Sa calibration sera supprimée."
        }
        confirmText="Supprimer la face"
        variant="danger"
        icon="delete"
        onConfirm={confirmerSuppression}
      />
    </div>
  );
}
