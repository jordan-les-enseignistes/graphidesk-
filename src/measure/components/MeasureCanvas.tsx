import { useEffect, useRef, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle,
  Line,
  Text,
  Group,
  Label as KonvaLabel,
  Tag,
} from "react-konva";
import type Konva from "konva";
import { toast } from "sonner";
import {
  useMeasureView,
  useMeasureImage,
  useMeasureDoc,
  useMeasureUi,
} from "../state/store";
import { getOffscreenImageData, getOffscreenSize, getOffscreenCanvas } from "../engine/offscreen";
import { magicWand } from "../engine/floodfill";
import { formatDims } from "../engine/zones";
import { ZOOM_MIN, ZOOM_MAX } from "../state/types";
import type { Pt, Zone } from "../state/types";

interface MeasureCanvasProps {
  /** Élément image HTML déjà chargé (même source que l'offscreen) */
  imageEl: HTMLImageElement | null;
  /** Callback : position du curseur en COORDONNÉES IMAGE (ou null hors image) */
  onCursorImagePos?: (pt: Pt | null) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const COLOR_REF = "#3b82f6"; // bleu — référence
const COLOR_ZONE = "#10b981"; // émeraude — zones
const COLOR_DRAFT = "#f59e0b"; // ambre — points en cours

const LOUPE_SIZE = 150; // px écran
const LOUPE_ZOOM = 4; // grossissement (px image → px loupe)

function centroid(corners: [Pt, Pt, Pt, Pt]): Pt {
  return {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  };
}

function flatten(pts: Pt[]): number[] {
  const out: number[] = [];
  for (const p of pts) {
    out.push(p.x, p.y);
  }
  return out;
}

/** Affichage d'une zone validée — label sur fond sombre pour la lisibilité */
function ZoneOverlay({ zone, invScale }: { zone: Zone; invScale: number }) {
  const c = centroid(zone.corners);
  const label = `${zone.label} — ${formatDims(zone.widthMm, zone.heightMm)}`;
  const fontSize = 13 * invScale;
  return (
    <Group>
      <Line
        points={flatten(zone.corners)}
        closed
        stroke={zone.fill === "vitrage" ? "#4376ba" : COLOR_ZONE}
        strokeWidth={2 * invScale}
        fill={zone.fill === "vitrage" ? "rgba(67, 118, 186, 0.25)" : "rgba(16, 185, 129, 0.12)"}
      />
      {zone.corners.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={4 * invScale} fill={COLOR_ZONE} />
      ))}
      <KonvaLabel
        x={c.x}
        y={c.y}
        offsetX={label.length * fontSize * 0.27}
        offsetY={fontSize}
      >
        <Tag
          fill="rgba(15, 23, 42, 0.82)"
          cornerRadius={4 * invScale}
          stroke={COLOR_ZONE}
          strokeWidth={1 * invScale}
        />
        <Text
          text={label}
          fontSize={fontSize}
          fontStyle="bold"
          fill="#ffffff"
          padding={5 * invScale}
        />
      </KonvaLabel>
    </Group>
  );
}

/** Points en cours de placement (référence ou zone), numérotés.
 *  À 4 points le quadrilatère se ferme visuellement. */
function DraftPoints({ pts, color, invScale }: { pts: Pt[]; color: string; invScale: number }) {
  const isComplete = pts.length === 4;
  return (
    <Group>
      {pts.length >= 2 && (
        <Line
          points={flatten(pts)}
          closed={isComplete}
          fill={isComplete ? "rgba(59, 130, 246, 0.08)" : undefined}
          stroke={color}
          strokeWidth={1.5 * invScale}
          dash={[6 * invScale, 4 * invScale]}
        />
      )}
      {pts.map((p, i) => (
        <Group key={i}>
          <Circle
            x={p.x}
            y={p.y}
            radius={6 * invScale}
            stroke={color}
            strokeWidth={2 * invScale}
            fill="rgba(255,255,255,0.85)"
          />
          <Text
            x={p.x}
            y={p.y}
            text={String(i + 1)}
            fontSize={9 * invScale}
            fontStyle="bold"
            fill={color}
            offsetX={2.6 * invScale}
            offsetY={4.5 * invScale}
          />
        </Group>
      ))}
    </Group>
  );
}

export function MeasureCanvas({ imageEl, onCursorImagePos }: MeasureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const middlePanRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);

  const view = useMeasureView();
  const image = useMeasureImage((s) => s.image);
  const tool = useMeasureUi((s) => s.tool);

  // Loupe : position curseur (écran container + image) quand un outil de
  // placement est actif
  const [loupe, setLoupe] = useState<{ sx: number; sy: number; ix: number; iy: number } | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  // État document pour les overlays
  const draftRefPts = useMeasureDoc((s) => s.draftRefPts);
  const draftZonePts = useMeasureDoc((s) => s.draftZonePts);
  const zones = useMeasureDoc((s) => s.zones);
  const planes = useMeasureDoc((s) => s.planes);
  const activePlaneId = useMeasureDoc((s) => s.activePlaneId);
  const activePlane = planes.find((p) => p.id === activePlaneId);

  const invScale = 1 / view.scale;

  // ----- Taille du conteneur (responsive) -----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setContainerSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ----- Barre espace = mode pan -----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ----- Ajuster à la vue (déclenché par fitRequest) -----
  const fitRequest = useMeasureView((s) => s.fitRequest);
  useEffect(() => {
    if (!image || containerSize.width === 0 || containerSize.height === 0) return;
    const scale = clamp(
      Math.min(containerSize.width / image.width, containerSize.height / image.height) * 0.95,
      ZOOM_MIN,
      ZOOM_MAX
    );
    const x = (containerSize.width - image.width * scale) / 2;
    const y = (containerSize.height - image.height * scale) / 2;
    useMeasureView.getState().setView({ scale, x, y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest, image, containerSize.width, containerSize.height]);

  // ----- Conversion écran → image -----
  const screenToImage = useCallback((screenX: number, screenY: number): Pt => {
    const v = useMeasureView.getState();
    return {
      x: (screenX - v.x) / v.scale,
      y: (screenY - v.y) / v.scale,
    };
  }, []);

  // ----- Zoom molette centré sur le curseur -----
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const v = useMeasureView.getState();
    const scaleBy = 1.08;
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = clamp(
      direction > 0 ? v.scale * scaleBy : v.scale / scaleBy,
      ZOOM_MIN,
      ZOOM_MAX
    );
    const imgPt = {
      x: (pointer.x - v.x) / v.scale,
      y: (pointer.y - v.y) / v.scale,
    };
    useMeasureView.getState().setView({
      scale: newScale,
      x: pointer.x - imgPt.x * newScale,
      y: pointer.y - imgPt.y * newScale,
    });
  }, []);

  // ----- Clic : placement de points selon l'outil actif -----
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return; // clic gauche uniquement
      if (spaceDown || middlePanRef.current) return; // pas pendant un pan
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (!pointer || !image) return;

      const pt = screenToImage(pointer.x, pointer.y);
      if (pt.x < 0 || pt.y < 0 || pt.x > image.width || pt.y > image.height) return;

      const currentTool = useMeasureUi.getState().tool;
      const doc = useMeasureDoc.getState();

      if (currentTool === "reference") {
        doc.addRefPoint(pt);
      } else if (currentTool === "zone") {
        doc.addZonePoint(pt);
      } else if (currentTool === "wand") {
        // Baguette magique : lecture pixel sur l'offscreen PLEINE résolution
        const size = getOffscreenSize();
        if (!size) return;
        const imageData = getOffscreenImageData(0, 0, size.width, size.height);
        if (!imageData) {
          toast.error("Image non disponible pour la baguette magique");
          return;
        }
        const tolerance = useMeasureUi.getState().wandTolerance;
        const result = magicWand(imageData, pt.x, pt.y, tolerance);
        if (!result) {
          toast.error("Sélection trop petite — augmente la tolérance ou clique ailleurs");
          return;
        }
        doc.addWandZone(result.corners);
        toast.success(`Zone détectée (${result.pixelCount.toLocaleString()} px) — Ctrl+Z si incorrecte`);
      }
    },
    [spaceDown, image, screenToImage]
  );

  // ----- Clic droit : retirer le dernier point en cours de placement -----
  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const currentTool = useMeasureUi.getState().tool;
    const doc = useMeasureDoc.getState();
    if (currentTool === "reference" && doc.draftRefPts.length > 0) {
      doc.removeLastRefPoint();
    } else if (currentTool === "zone" && doc.draftZonePts.length > 0) {
      doc.removeLastZonePoint();
    }
  }, []);

  // ----- Échap : abandonner le placement en cours -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const doc = useMeasureDoc.getState();
      if (doc.draftRefPts.length > 0 || doc.draftZonePts.length > 0) {
        doc.cancelDrafts();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ----- Pan clic milieu (manuel) -----
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      const v = useMeasureView.getState();
      middlePanRef.current = {
        startX: e.evt.clientX,
        startY: e.evt.clientY,
        viewX: v.x,
        viewY: v.y,
      };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const pan = middlePanRef.current;
      if (pan) {
        useMeasureView.getState().setView({
          x: pan.viewX + (e.evt.clientX - pan.startX),
          y: pan.viewY + (e.evt.clientY - pan.startY),
        });
      }
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (pointer && image) {
        const pt = screenToImage(pointer.x, pointer.y);
        const inside =
          pt.x >= 0 && pt.y >= 0 && pt.x <= image.width && pt.y <= image.height;
        onCursorImagePos?.(inside ? { x: Math.round(pt.x), y: Math.round(pt.y) } : null);

        // loupe uniquement pendant un placement de points, curseur sur l'image
        const currentTool = useMeasureUi.getState().tool;
        const placing = currentTool === "reference" || currentTool === "zone";
        setLoupe(placing && inside && !pan ? { sx: pointer.x, sy: pointer.y, ix: pt.x, iy: pt.y } : null);
      }
    },
    [onCursorImagePos, image, screenToImage]
  );

  // ----- Rendu de la loupe (depuis le canvas offscreen pleine résolution) -----
  useEffect(() => {
    const canvas = loupeCanvasRef.current;
    if (!canvas || !loupe) return;
    const ctx = canvas.getContext("2d");
    const off = getOffscreenCanvas();
    if (!ctx || !off) return;

    const srcSize = LOUPE_SIZE / LOUPE_ZOOM;
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      off,
      loupe.ix - srcSize / 2,
      loupe.iy - srcSize / 2,
      srcSize,
      srcSize,
      0,
      0,
      LOUPE_SIZE,
      LOUPE_SIZE
    );
    // croix de visée
    ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LOUPE_SIZE / 2, 0);
    ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE);
    ctx.moveTo(0, LOUPE_SIZE / 2);
    ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2);
    ctx.stroke();
  }, [loupe]);

  const handleMouseUp = useCallback(() => {
    middlePanRef.current = null;
  }, []);

  // ----- Pan barre espace : stage draggable, on synchronise le store -----
  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target as Konva.Stage;
    if (stage === stageRef.current) {
      useMeasureView.getState().setView({ x: stage.x(), y: stage.y() });
    }
  }, []);

  const cursor = spaceDown ? "grab" : tool !== "none" ? "crosshair" : "default";

  // position de la loupe : décalée du curseur, bascule près des bords
  const loupeLeft =
    loupe && loupe.sx + 24 + LOUPE_SIZE > containerSize.width
      ? (loupe?.sx ?? 0) - 24 - LOUPE_SIZE
      : (loupe?.sx ?? 0) + 24;
  const loupeTop =
    loupe && loupe.sy - 24 - LOUPE_SIZE < 0
      ? (loupe?.sy ?? 0) + 24
      : (loupe?.sy ?? 0) - 24 - LOUPE_SIZE;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-900 rounded-lg border dark:border-slate-700"
      style={{ cursor }}
    >
      {/* Loupe de précision (placement de points) */}
      <canvas
        ref={loupeCanvasRef}
        width={LOUPE_SIZE}
        height={LOUPE_SIZE}
        className="absolute z-10 rounded-full border-2 border-slate-700 dark:border-slate-300 shadow-lg pointer-events-none bg-black"
        style={{
          left: loupeLeft,
          top: loupeTop,
          display: loupe ? "block" : "none",
        }}
      />
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        draggable={spaceDown}
        onDragMove={handleDragMove}
        onWheel={handleWheel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          onCursorImagePos?.(null);
          setLoupe(null);
        }}
      >
        <Layer listening={false}>
          {imageEl && <KonvaImage image={imageEl} x={0} y={0} />}
        </Layer>

        {/* Overlays (non cliquables : les clics vont au Stage) */}
        <Layer listening={false}>
          {/* Référence validée */}
          {activePlane?.reference && (
            <Group>
              <Line
                points={flatten(activePlane.reference.imgPts)}
                closed
                stroke={COLOR_REF}
                strokeWidth={2 * invScale}
                fill="rgba(59, 130, 246, 0.08)"
              />
              {activePlane.reference.imgPts.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={4 * invScale} fill={COLOR_REF} />
              ))}
            </Group>
          )}

          {/* Points de référence en cours */}
          {draftRefPts.length > 0 && (
            <DraftPoints pts={draftRefPts} color={COLOR_REF} invScale={invScale} />
          )}

          {/* Sommets de zone en cours */}
          {draftZonePts.length > 0 && (
            <DraftPoints pts={draftZonePts} color={COLOR_DRAFT} invScale={invScale} />
          )}

          {/* Zones validées */}
          {zones.map((z) => (
            <ZoneOverlay key={z.id} zone={z} invScale={invScale} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
