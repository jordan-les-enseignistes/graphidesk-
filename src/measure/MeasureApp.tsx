import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { MeasureCanvas } from "./components/MeasureCanvas";
import { Toolbar } from "./components/Toolbar";
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
} from "./state/store";
import { setOffscreenFromImage, clearOffscreen } from "./engine/offscreen";
import { selfTestHomography } from "./engine/homography";
import { savePhotoBlob, loadPhotoBlob, clearPhotoBlob } from "./engine/imageStore";
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
 * Module de mesure provisoire par photo.
 * Jalon 1 : chargement image (drag & drop + input), zoom/pan Konva,
 * conversion écran → coordonnées image, squelette undo/redo.
 */
export function MeasureApp() {
  const image = useMeasureImage((s) => s.image);
  const setImage = useMeasureImage((s) => s.setImage);
  const resetDoc = useMeasureDoc((s) => s.resetDoc);

  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [cursorPos, setCursorPos] = useState<Pt | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----- Chargement d'un blob image (fichier utilisateur OU restauration) -----
  const loadBlob = useCallback(
    (blob: Blob, name: string, opts: { restore: boolean }) => {
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        // libérer l'ancienne URL objet si présente
        const prev = useMeasureImage.getState().image;
        if (prev) URL.revokeObjectURL(prev.url);

        setOffscreenFromImage(img);
        setImage({
          url,
          name,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setImageEl(img);

        // Session : si le document persisté correspond à CETTE photo,
        // on garde zones + calibration.
        const doc = useMeasureDoc.getState();
        const hasContent =
          doc.zones.length > 0 || doc.planes.some((p) => p.reference !== null);
        if (doc.imageName === name && hasContent) {
          toast.success(
            opts.restore
              ? `Session restaurée : ${doc.zones.length} zone(s) + calibration`
              : `Photo rechargée — ${doc.zones.length} zone(s) conservées`
          );
        } else {
          useMeasureDoc.getState().startNewDoc(name);
          toast.success(`Image chargée : ${name} (${img.naturalWidth}×${img.naturalHeight}px)`);
        }
        clearDocHistory();
        useMeasureView.getState().requestFit();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Impossible de charger cette image");
      };
      img.src = url;
    },
    [setImage]
  );

  // ----- Chargement d'un fichier image choisi par l'utilisateur -----
  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Ce fichier n'est pas une image");
        return;
      }
      // persister la photo pour restauration à la prochaine ouverture
      savePhotoBlob(file.name, file).catch(() => {});
      loadBlob(file, file.name, { restore: false });
    },
    [loadBlob]
  );

  // ----- Restauration automatique de la session au montage -----
  useEffect(() => {
    // isolation par utilisateur : la session d'un collègue sur ce poste
    // n'est jamais restaurée (purge silencieuse). Une session SANS
    // propriétaire (antérieure à ce fix) est purgée aussi — impossible de
    // savoir à qui elle appartient, on ne l'attribue jamais par défaut.
    const userId = useAuthStore.getState().profile?.id ?? null;
    const owner = localStorage.getItem(MEASURE_OWNER_KEY);
    if (userId) {
      const doc = useMeasureDoc.getState();
      const hasSession =
        doc.zones.length > 0 || doc.planes.some((p) => p.reference !== null) || !!doc.imageName;
      if (owner !== userId && hasSession) {
        resetDoc();
        clearDocHistory();
        clearPhotoBlob().catch(() => {});
        clearOffscreen();
        localStorage.setItem(MEASURE_OWNER_KEY, userId);
        return;
      }
      localStorage.setItem(MEASURE_OWNER_KEY, userId);
    }

    if (useMeasureImage.getState().image) return; // déjà une image (HMR)
    loadPhotoBlob().then((stored) => {
      if (stored && !useMeasureImage.getState().image) {
        loadBlob(stored.blob, stored.name, { restore: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Reset complet (photo + document) -----
  const resetAll = useCallback(
    (opts: { toast: boolean }) => {
      const prev = useMeasureImage.getState().image;
      if (prev) URL.revokeObjectURL(prev.url);
      setImage(null);
      setImageEl(null);
      clearOffscreen();
      resetDoc();
      clearDocHistory();
      clearPhotoBlob().catch(() => {});
      setShowResetConfirm(false);
      if (opts.toast) toast.success("Tout a été remis à zéro");
    },
    [setImage, resetDoc]
  );

  const handleReset = useCallback(() => resetAll({ toast: true }), [resetAll]);
  // après sauvegarde d'un projet : reset optionnel (choix dans le dialogue)
  const handleProjectSaved = useCallback(
    (reset: boolean) => {
      if (reset) resetAll({ toast: false });
    },
    [resetAll]
  );

  // ----- Drag & drop -----
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
  // capture:true pour passer avant tout autre handler ; toast de feedback
  // pour rendre l'action visible (et diagnostiquer si le raccourci n'arrive pas)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
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
  // ⚠️ On vide AUSSI le store image : sinon, au retour sur la page, une
  // référence morte (URL révoquée) empêche la restauration automatique
  // depuis IndexedDB → photo invisible jusqu'à un rechargement forcé.
  useEffect(() => {
    return () => {
      // diagnostic : horodatage de la sortie (la sonde globale de main.tsx
      // capte les tâches longues JS ; corréler les timestamps)
      const t0 = performance.now();

      const img = useMeasureImage.getState().image;
      if (img) URL.revokeObjectURL(img.url);
      useMeasureImage.getState().setImage(null);
      clearOffscreen();

      // eslint-disable-next-line no-console
      console.info(
        `[Mesure] cleanup sortie : ${Math.round(performance.now() - t0)} ms (à t+${Math.round(t0)} ms)`
      );
    };
  }, []);

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
          e.target.value = ""; // permet de recharger le même fichier
        }}
      />

      {image ? (
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Colonne principale : toolbar + canvas */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <Toolbar
              cursorPos={cursorPos}
              onLoadNewImage={() => fileInputRef.current?.click()}
              onReset={() => setShowResetConfirm(true)}
              onProjectSaved={handleProjectSaved}
            />
            <MeasureCanvas imageEl={imageEl} onCursorImagePos={setCursorPos} />
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

          {/* Confirmation du reset complet */}
          <ConfirmDialog
            open={showResetConfirm}
            onOpenChange={setShowResetConfirm}
            title="Tout remettre à zéro"
            description="La photo, la calibration et toutes les zones mesurées seront définitivement effacées (y compris la session sauvegardée). Continuer ?"
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
              ou clique pour choisir un fichier
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
