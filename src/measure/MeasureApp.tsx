import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { MeasureCanvas } from "./components/MeasureCanvas";
import { Toolbar } from "./components/Toolbar";
import { FacesBar } from "./components/FacesBar";
import { ReferencePanel } from "./components/ReferencePanel";
import { ZoneList } from "./components/ZoneList";
import { IndesignPluginCard } from "./components/IndesignPluginCard";
import {
  useMeasureImage,
  useMeasureView,
  useMeasureDoc,
  useMeasureUi,
  undoDoc,
  redoDoc,
  clearDocHistory,
  LEGACY_PHOTO_ID,
} from "./state/store";
import {
  setOffscreenFromImage,
  setActiveOffscreen,
  clearOffscreen,
} from "./engine/offscreen";
import { selfTestHomography } from "./engine/homography";
import {
  savePhotoBlob,
  loadPhotoBlob,
  migrateLegacyBlob,
  clearPhotoBlobs,
} from "./engine/imageStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuthStore } from "@/stores/authStore";
import type { Pt } from "./state/types";

// La session Mesure photo (localStorage + IndexedDB) est stockée PAR POSTE :
// on la marque avec l'id de son propriétaire, et si un AUTRE utilisateur se
// connecte sur le même PC, elle est purgée au lieu d'être restaurée.
const MEASURE_OWNER_KEY = "graphidesk-measure-owner";

// Auto-test de l'homographie en dev (critère : < 0.5 % d'erreur)
if (import.meta.env.DEV) {
  const t = selfTestHomography();
  // eslint-disable-next-line no-console
  console.info(
    `[Mesure] Auto-test homographie : ${t.ok ? "OK" : "ÉCHEC"} (erreur max ${t.maxErrorPct.toExponential(2)} %)`
  );
}

/**
 * Module de mesure provisoire par photo — v1.5 MULTI-FACES :
 * un projet = plusieurs photos, chaque photo porte 1..N faces (plans
 * calibrés), les zones appartiennent à une face, lettres continues.
 */
export function MeasureApp() {
  const photos = useMeasureDoc((s) => s.photos);
  const activePlaneId = useMeasureDoc((s) => s.activePlaneId);
  const resetDoc = useMeasureDoc((s) => s.resetDoc);

  // Un HTMLImageElement décodé par photo (pour le canvas Konva)
  const imageElsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [activeImageEl, setActiveImageEl] = useState<HTMLImageElement | null>(null);
  const [cursorPos, setCursorPos] = useState<Pt | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // true tant que la page est montée : décodage asynchrone abandonné si
  // l'utilisateur quitte la page avant la fin
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ----- Chargement du blob d'UNE photo (fichier utilisateur OU restauration) -----
  const loadBlob = useCallback(
    (blob: Blob, name: string, photoId: string, opts: { addToDoc: boolean }) => {
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        if (!aliveRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        setOffscreenFromImage(img, photoId);
        imageElsRef.current.set(photoId, img);
        const meta = {
          id: photoId,
          name,
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
        useMeasureImage.getState().setImageFor(photoId, {
          url,
          name,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        if (opts.addToDoc) {
          useMeasureDoc.getState().addPhoto(meta);
          toast.success(`Photo ajoutée : ${name} (${img.naturalWidth}×${img.naturalHeight}px)`);
        } else {
          // restauration : compléter les dims (photos migrées v1 à 0×0)
          useMeasureDoc.getState().updatePhotoMeta(photoId, {
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        }
        // si c'est la photo de la face active, l'afficher
        const st = useMeasureDoc.getState();
        const face = st.planes.find((p) => p.id === st.activePlaneId);
        if (face?.photoId === photoId || opts.addToDoc) {
          useMeasureImage.getState().activateImage(photoId);
          setActiveOffscreen(photoId);
          setActiveImageEl(img);
          useMeasureView.getState().requestFit();
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Impossible de charger cette image");
      };
      img.src = url;
    },
    []
  );

  // ----- Chargement d'un fichier image choisi par l'utilisateur -----
  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Ce fichier n'est pas une image");
        return;
      }
      const photoId = crypto.randomUUID();
      savePhotoBlob(photoId, file.name, file).catch(() => {});
      loadBlob(file, file.name, photoId, { addToDoc: true });
    },
    [loadBlob]
  );

  // ----- Restauration automatique de la session au montage -----
  useEffect(() => {
    // isolation par utilisateur (session d'un collègue jamais restaurée)
    const userId = useAuthStore.getState().profile?.id ?? null;
    const owner = localStorage.getItem(MEASURE_OWNER_KEY);
    if (userId) {
      const doc = useMeasureDoc.getState();
      const hasSession = doc.zones.length > 0 || doc.planes.length > 0 || doc.photos.length > 0;
      if (owner !== userId && hasSession) {
        resetDoc();
        clearDocHistory();
        clearPhotoBlobs().catch(() => {});
        clearOffscreen();
        localStorage.setItem(MEASURE_OWNER_KEY, userId);
        return;
      }
      localStorage.setItem(MEASURE_OWNER_KEY, userId);
    }

    const doc = useMeasureDoc.getState();
    if (doc.photos.length === 0) return;
    const dejaChargees = useMeasureImage.getState().images;
    let restaurees = 0;
    (async () => {
      for (const photo of doc.photos) {
        if (dejaChargees[photo.id]) continue; // HMR / retour sur la page
        const stored =
          photo.id === LEGACY_PHOTO_ID
            ? await migrateLegacyBlob(LEGACY_PHOTO_ID)
            : await loadPhotoBlob(photo.id);
        if (stored) {
          loadBlob(stored.blob, stored.name, photo.id, { addToDoc: false });
          restaurees++;
        }
      }
      if (restaurees > 0) {
        const s = useMeasureDoc.getState();
        toast.success(
          `Session restaurée : ${s.photos.length} photo(s), ${s.planes.length} face(s), ${s.zones.length} zone(s)`
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Bascule de face active : afficher SA photo -----
  useEffect(() => {
    const face = useMeasureDoc.getState().planes.find((p) => p.id === activePlaneId);
    if (!face) {
      useMeasureImage.getState().activateImage(null);
      setActiveOffscreen(null);
      setActiveImageEl(null);
      return;
    }
    const prev = useMeasureImage.getState().image;
    const next = useMeasureImage.getState().images[face.photoId] ?? null;
    useMeasureImage.getState().activateImage(face.photoId);
    setActiveOffscreen(face.photoId);
    setActiveImageEl(imageElsRef.current.get(face.photoId) ?? null);
    // fit uniquement si on change réellement de photo (pas au simple re-render)
    if (next && next.url !== prev?.url) useMeasureView.getState().requestFit();
  }, [activePlaneId, photos]);

  // ----- Reset complet (photos + document) -----
  const resetAll = useCallback(
    (opts: { toast: boolean }) => {
      for (const img of Object.values(useMeasureImage.getState().images)) {
        URL.revokeObjectURL(img.url);
      }
      useMeasureImage.getState().clearImages();
      imageElsRef.current.clear();
      setActiveImageEl(null);
      clearOffscreen();
      resetDoc();
      clearDocHistory();
      clearPhotoBlobs().catch(() => {});
      setShowResetConfirm(false);
      if (opts.toast) toast.success("Tout a été remis à zéro");
    },
    [resetDoc]
  );

  const handleReset = useCallback(() => resetAll({ toast: true }), [resetAll]);
  const handleProjectSaved = useCallback(
    (reset: boolean) => {
      if (reset) resetAll({ toast: false });
    },
    [resetAll]
  );

  // ----- Drag & drop (ajoute une photo au projet) -----
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  // ----- Raccourcis clavier undo/redo -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // un dialogue ouvert gère ses propres raccourcis (ex : Mesure satellite)
      if (document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const past = useMeasureDoc.temporal.getState().pastStates.length;
        if (past === 0) {
          toast.info("Rien à annuler", { duration: 1200 });
        } else {
          undoDoc();
          toast.info("Annulé", { duration: 800 });
        }
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        e.stopPropagation();
        redoDoc();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  // ----- Nettoyage à la fermeture du module -----
  // On vide le store image (URLs mortes) pour que la restauration IndexedDB
  // reparte proprement au retour sur la page.
  useEffect(() => {
    return () => {
      for (const img of Object.values(useMeasureImage.getState().images)) {
        URL.revokeObjectURL(img.url);
      }
      useMeasureImage.getState().clearImages();
      clearOffscreen();
    };
  }, []);

  const hasProject = photos.length > 0;

  return (
    <div
      className="flex flex-col gap-3 h-full min-h-0"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
          e.target.value = "";
        }}
      />

      {hasProject ? (
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Colonne principale : faces + toolbar + canvas */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <FacesBar onAddPhoto={() => fileInputRef.current?.click()} />
            <Toolbar
              cursorPos={cursorPos}
              onLoadNewImage={() => fileInputRef.current?.click()}
              onReset={() => setShowResetConfirm(true)}
              onProjectSaved={handleProjectSaved}
            />
            <MeasureCanvas imageEl={activeImageEl} onCursorImagePos={setCursorPos} />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              🖱️ Molette = zoom • Espace + glisser (ou clic milieu) = déplacer • Clic droit =
              retirer le dernier point • Ctrl+Z = annuler
            </p>
          </div>
          {/* Panneau latéral : référence + zones */}
          <div className="w-80 shrink-0 space-y-3 overflow-y-auto">
            <ReferencePanel />
            <ZoneList />
            <IndesignPluginCard />
          </div>

          <ConfirmDialog
            open={showResetConfirm}
            onOpenChange={setShowResetConfirm}
            title="Tout remettre à zéro"
            description="Toutes les photos, faces, calibrations et zones mesurées seront définitivement effacées (y compris la session sauvegardée). Continuer ?"
            confirmText="Tout effacer"
            variant="danger"
            icon="delete"
            onConfirm={handleReset}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 min-h-[400px] flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
          }`}
        >
          <Upload className="h-12 w-12 text-slate-400" />
          <div className="text-center">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              Glisse une photo de façade ici
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              ou clique pour choisir un fichier — tu pourras ajouter d'autres photos
              (autres faces, intérieur...) ensuite
            </p>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md text-center">
            💡 Photo Google Maps acceptée. Évite les photos grand angle prises de près
            (distorsion) — les résultats restent PROVISOIRES dans tous les cas.
          </p>
        </button>
      )}
    </div>
  );
}
