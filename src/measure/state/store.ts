import { create } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import { measureQuad } from "../engine/zones";
import type { MeasureDoc, ViewTransform, LoadedImage, Plane, Pt, H, Reference, Zone } from "./types";

// ============================================================
// Store DOCUMENT (undoable via zundo)
// ============================================================
// Seul l'état document (plans, référence, zones, points en cours)
// entre dans l'historique. La vue, l'image chargée et l'outil actif
// sont dans des stores séparés, hors undo.

function makeInitialDoc(): MeasureDoc {
  const plane: Plane = {
    id: "plane-1",
    name: "Plan principal",
    reference: null,
    H: null,
  };
  return {
    planes: [plane],
    activePlaneId: plane.id,
    zones: [],
    draftRefPts: [],
    draftZonePts: [],
    zoneCounter: 0,
    imageName: null,
  };
}

// ============================================================
// Recalage des estimations à partir des cotes RÉELLES saisies
// ============================================================
// Ratio moyen (réel / estimation d'origine) des zones éditées du plan,
// appliqué aux estimations des zones NON éditées. Toujours recalculé
// depuis autoWidthMm/autoHeightMm (valeurs d'origine figées) : pas de
// dérive cumulative. Garde-fou : une saisie très éloignée de l'estimation
// (ratio hors 0,5–2) ne déforme pas les autres zones.
function appliquerCorrection(zones: Zone[], planeId: string): Zone[] {
  const editees = zones.filter(
    (z) => z.planeId === planeId && z.manuel && z.autoWidthMm && z.autoHeightMm
  );
  let r = 1;
  if (editees.length) {
    let somme = 0;
    let n = 0;
    for (const z of editees) {
      if ((z.autoWidthMm as number) > 1) { somme += z.widthMm / (z.autoWidthMm as number); n++; }
      if ((z.autoHeightMm as number) > 1) { somme += z.heightMm / (z.autoHeightMm as number); n++; }
    }
    if (n) r = somme / n;
    if (r < 0.5 || r > 2) r = 1;
  }
  return zones.map((z) => {
    if (z.planeId !== planeId || z.manuel) return z;
    const aw = z.autoWidthMm ?? z.widthMm;
    const ah = z.autoHeightMm ?? z.heightMm;
    return { ...z, autoWidthMm: aw, autoHeightMm: ah, widthMm: aw * r, heightMm: ah * r };
  });
}

interface DocActions {
  /** Réinitialise tout le document (nouvelle image) */
  resetDoc: () => void;
  /** Démarre un nouveau document lié à une photo */
  startNewDoc: (imageName: string) => void;
  /** Ajoute un point de référence (max 4) — undoable */
  addRefPoint: (pt: Pt) => void;
  /** Retire le dernier point de référence en cours */
  removeLastRefPoint: () => void;
  /** Retire le dernier sommet de zone en cours (clic droit) */
  removeLastZonePoint: () => void;
  /** Abandonne tous les points en cours de placement (Échap) */
  cancelDrafts: () => void;
  /** Enregistre la calibration validée sur le plan actif — undoable */
  setCalibration: (reference: Reference, h: H) => void;
  /** Efface la calibration du plan actif (et ses zones, devenues invalides) */
  resetCalibration: () => void;
  /** Ajoute un sommet de zone manuelle ; à 4 points la zone est créée — undoable */
  addZonePoint: (pt: Pt) => void;
  /** Supprime une zone — undoable */
  deleteZone: (id: string) => void;
  /** Bascule le remplissage vitrage d'une zone — undoable */
  toggleZoneVitrage: (id: string) => void;
  /** Crée une zone depuis la baguette magique — undoable */
  addWandZone: (corners: [Pt, Pt, Pt, Pt]) => void;
  /** Renomme une zone (nom d'affichage libre ; vide = retour au nom auto) — undoable */
  setZoneNom: (id: string, nom: string) => void;
  /** Remplace les dimensions d'une zone par des cotes RÉELLES saisies — undoable */
  setZoneDims: (id: string, wMm: number, hMm: number) => void;
  /** Revient à l'estimation photo d'origine d'une zone — undoable */
  resetZoneDims: (id: string) => void;
}

export const useMeasureDoc = create<MeasureDoc & DocActions>()(
  persist(
    temporal(
      (set) => ({
        ...makeInitialDoc(),

        resetDoc: () => set(() => ({ ...makeInitialDoc() })),

        startNewDoc: (imageName) => set(() => ({ ...makeInitialDoc(), imageName })),

      addRefPoint: (pt) =>
        set((s) => {
          if (s.draftRefPts.length >= 4) return s;
          return { draftRefPts: [...s.draftRefPts, pt] };
        }),

      removeLastRefPoint: () =>
        set((s) => ({ draftRefPts: s.draftRefPts.slice(0, -1) })),

      removeLastZonePoint: () =>
        set((s) => ({ draftZonePts: s.draftZonePts.slice(0, -1) })),

      cancelDrafts: () =>
        set(() => ({ draftRefPts: [], draftZonePts: [] })),

      setCalibration: (reference, h) =>
        set((s) => ({
          planes: s.planes.map((p) =>
            p.id === s.activePlaneId ? { ...p, reference, H: h } : p
          ),
          draftRefPts: [],
        })),

      resetCalibration: () =>
        set((s) => ({
          planes: s.planes.map((p) =>
            p.id === s.activePlaneId ? { ...p, reference: null, H: null } : p
          ),
          zones: s.zones.filter((z) => z.planeId !== s.activePlaneId),
          draftRefPts: [],
          draftZonePts: [],
        })),

      addZonePoint: (pt) =>
        set((s) => {
          const plane = s.planes.find((p) => p.id === s.activePlaneId);
          if (!plane || !plane.H) return s;
          const draft = [...s.draftZonePts, pt];
          if (draft.length < 4) {
            return { draftZonePts: draft };
          }
          // 4e point : création de la zone (coins réordonnés canoniquement,
          // l'ordre de clic n'a pas d'importance)
          const { widthMm, heightMm, orderedCorners } = measureQuad(
            plane.H,
            draft as [Pt, Pt, Pt, Pt]
          );
          const zone: Zone = {
            id: crypto.randomUUID(),
            label: "Zone " + String.fromCharCode(65 + (s.zoneCounter % 26)),
            planeId: plane.id,
            method: "manual",
            corners: orderedCorners,
            widthMm,
            heightMm,
          };
          return {
            draftZonePts: [],
            // la nouvelle zone profite du recalage si des cotes réelles existent
            zones: appliquerCorrection([...s.zones, zone], plane.id),
            zoneCounter: s.zoneCounter + 1,
          };
        }),

      deleteZone: (id) =>
        set((s) => ({ zones: s.zones.filter((z) => z.id !== id) })),

      toggleZoneVitrage: (id) =>
        set((s) => ({
          zones: s.zones.map((z) =>
            z.id === id
              ? { ...z, fill: z.fill === "vitrage" ? "blanc" : ("vitrage" as const) }
              : z
          ),
        })),

      addWandZone: (corners) =>
        set((s) => {
          const plane = s.planes.find((p) => p.id === s.activePlaneId);
          if (!plane || !plane.H) return s;
          const { widthMm, heightMm, orderedCorners } = measureQuad(plane.H, corners);
          const zone: Zone = {
            id: crypto.randomUUID(),
            label: "Zone " + String.fromCharCode(65 + (s.zoneCounter % 26)),
            planeId: plane.id,
            method: "wand",
            corners: orderedCorners,
            widthMm,
            heightMm,
          };
          // la nouvelle zone profite du recalage si des cotes réelles existent
          return {
            zones: appliquerCorrection([...s.zones, zone], plane.id),
            zoneCounter: s.zoneCounter + 1,
          };
        }),

      setZoneNom: (id, nom) =>
        set((s) => ({
          zones: s.zones.map((z) =>
            z.id === id ? { ...z, nom: nom.trim() ? nom.trim() : undefined } : z
          ),
        })),

      setZoneDims: (id, wMm, hMm) =>
        set((s) => {
          if (!(wMm > 0) || !(hMm > 0)) return s;
          const cible = s.zones.find((z) => z.id === id);
          if (!cible) return s;
          const zones = s.zones.map((z) =>
            z.id === id
              ? {
                  ...z,
                  autoWidthMm: z.autoWidthMm ?? z.widthMm,
                  autoHeightMm: z.autoHeightMm ?? z.heightMm,
                  widthMm: wMm,
                  heightMm: hMm,
                  manuel: true,
                }
              : z
          );
          return { zones: appliquerCorrection(zones, cible.planeId) };
        }),

      resetZoneDims: (id) =>
        set((s) => {
          const cible = s.zones.find((z) => z.id === id);
          if (!cible) return s;
          const zones = s.zones.map((z) =>
            z.id === id && z.autoWidthMm !== undefined && z.autoHeightMm !== undefined
              ? { ...z, widthMm: z.autoWidthMm, heightMm: z.autoHeightMm, manuel: false }
              : z
          );
          return { zones: appliquerCorrection(zones, cible.planeId) };
        }),
    }),
      {
        limit: 100,
        // ne suivre que les données du document, pas les fonctions
        partialize: (state) => ({
          planes: state.planes,
          activePlaneId: state.activePlaneId,
          zones: state.zones,
          draftRefPts: state.draftRefPts,
          draftZonePts: state.draftZonePts,
          zoneCounter: state.zoneCounter,
          imageName: state.imageName,
        }),
      }
    ),
    {
      // Persistance localStorage : le document survit aux redémarrages.
      // Il suffit de recharger la MÊME photo pour retrouver zones + calibration.
      name: "graphidesk-measure-doc",
      partialize: (state) => ({
        planes: state.planes,
        activePlaneId: state.activePlaneId,
        zones: state.zones,
        draftRefPts: state.draftRefPts,
        draftZonePts: state.draftZonePts,
        zoneCounter: state.zoneCounter,
        imageName: state.imageName,
      }),
    }
  )
);

export function undoDoc() {
  useMeasureDoc.temporal.getState().undo();
}

export function redoDoc() {
  useMeasureDoc.temporal.getState().redo();
}

/** Vide l'historique undo (après chargement d'une nouvelle image) */
export function clearDocHistory() {
  useMeasureDoc.temporal.getState().clear();
}

/** Plan actif (helper) */
export function getActivePlane(): Plane | undefined {
  const s = useMeasureDoc.getState();
  return s.planes.find((p) => p.id === s.activePlaneId);
}

// ============================================================
// Store OUTIL ACTIF (non undoable — réglage d'UI)
// ============================================================

export type MeasureTool = "none" | "reference" | "zone" | "wand";

interface UiState {
  tool: MeasureTool;
  setTool: (t: MeasureTool) => void;
  /** Tolérance de la baguette magique (distance Lab) — réglage, PAS undoable */
  wandTolerance: number;
  setWandTolerance: (t: number) => void;
}

export const useMeasureUi = create<UiState>((set) => ({
  tool: "none",
  setTool: (tool) => set({ tool }),
  wandTolerance: 18,
  setWandTolerance: (wandTolerance) => set({ wandTolerance }),
}));

// ============================================================
// Store VUE (non undoable) : zoom / pan + demande de "fit"
// ============================================================

interface ViewState extends ViewTransform {
  /** compteur incrémenté pour demander un "ajuster à la vue" au canvas */
  fitRequest: number;
  setView: (v: Partial<ViewTransform>) => void;
  requestFit: () => void;
}

export const useMeasureView = create<ViewState>((set) => ({
  scale: 1,
  x: 0,
  y: 0,
  fitRequest: 0,
  setView: (v) => set((s) => ({ ...s, ...v })),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
}));

// ============================================================
// Store IMAGE (non undoable)
// ============================================================

interface ImageState {
  image: LoadedImage | null;
  setImage: (img: LoadedImage | null) => void;
}

export const useMeasureImage = create<ImageState>((set) => ({
  image: null,
  setImage: (image) => set({ image }),
}));
