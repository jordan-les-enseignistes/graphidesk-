import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Satellite, RotateCcw, Check, Search } from "lucide-react";

// Orthophotos IGN (Géoplateforme) : accès libre et gratuit, sans clé API
const IGN_ORTHO_URL =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM" +
  "&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";

// Géocodage : Base Adresse Nationale (gratuit, sans clé)
const BAN_URL = "https://api-adresse.data.gouv.fr/search/";

interface BanFeature {
  properties: { label: string; score: number };
  geometry: { coordinates: [number, number] }; // [lon, lat]
}

interface SatelliteMeasureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reçoit la distance mesurée, en millimètres */
  onUseMeasure: (mm: number) => void;
}

export function SatelliteMeasureDialog({
  open,
  onOpenChange,
  onUseMeasure,
}: SatelliteMeasureDialogProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pointsRef = useRef<L.LatLng[]>([]);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const lineRef = useRef<L.Polyline | null>(null);

  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<BanFeature[]>([]);
  const [searching, setSearching] = useState(false);

  // ----- Cycle de vie de la carte (créée à l'ouverture, détruite à la fermeture) -----
  useEffect(() => {
    if (!open) return;
    // le contenu du Dialog est monté avec une animation : on attend un tick
    const t = setTimeout(() => {
      if (!mapDivRef.current || mapRef.current) return;
      const map = L.map(mapDivRef.current, {
        center: [46.6, 2.4], // France
        zoom: 6,
        zoomControl: true,
      });
      L.tileLayer(IGN_ORTHO_URL, {
        attribution: "© IGN — Géoplateforme",
        maxZoom: 21,
        maxNativeZoom: 19,
        tileSize: 256,
      }).addTo(map);

      map.on("click", (e: L.LeafletMouseEvent) => {
        pointsRef.current.push(e.latlng);
        const marker = L.circleMarker(e.latlng, {
          radius: 5,
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);
        markersRef.current.push(marker);
        redrawLine(map);
      });

      // clic droit = retirer le dernier point (convention du module Mesure)
      map.on("contextmenu", (e: L.LeafletMouseEvent) => {
        e.originalEvent.preventDefault();
        removeLastPoint();
      });

      // curseur croix : on est là pour placer des points, pas pour se balader
      map.getContainer().style.cursor = "crosshair";

      mapRef.current = map;
      map.invalidateSize();
    }, 80);

    return () => {
      clearTimeout(t);
      mapRef.current?.remove();
      mapRef.current = null;
      pointsRef.current = [];
      markersRef.current = [];
      lineRef.current = null;
      setDistanceM(null);
      setPointCount(0);
      setSuggestions([]);
    };
  }, [open]);

  // Ctrl+Z dans le dialogue = retirer le dernier point (l'undo global du
  // module est neutralisé quand un dialogue a le focus, voir MeasureApp)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        removeLastPoint();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const removeLastPoint = () => {
    const map = mapRef.current;
    if (!map) return;
    const marker = markersRef.current.pop();
    if (marker) map.removeLayer(marker);
    pointsRef.current.pop();
    redrawLine(map);
  };

  const redrawLine = (map: L.Map) => {
    lineRef.current?.remove();
    lineRef.current = null;
    const pts = pointsRef.current;
    setPointCount(pts.length);
    if (pts.length >= 2) {
      lineRef.current = L.polyline(pts, {
        color: "#f59e0b",
        weight: 3,
        dashArray: "6 4",
      }).addTo(map);
      let total = 0;
      for (let i = 1; i < pts.length; i++) total += map.distance(pts[i - 1], pts[i]);
      setDistanceM(total);
    } else {
      setDistanceM(null);
    }
  };

  const resetMeasure = () => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    pointsRef.current = [];
    redrawLine(map);
  };

  // ----- Recherche d'adresse (BAN) avec debounce -----
  useEffect(() => {
    if (!open || query.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(
          `${BAN_URL}?q=${encodeURIComponent(query.trim())}&limit=5`
        );
        const json = await r.json();
        setSuggestions(json.features ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, open]);

  const goTo = (f: BanFeature) => {
    const [lon, lat] = f.geometry.coordinates;
    mapRef.current?.setView([lat, lon], 19);
    setSuggestions([]);
    setQuery(f.properties.label);
  };

  const handleUse = () => {
    if (distanceM === null || distanceM <= 0) return;
    const mm = Math.round(distanceM * 1000);
    onUseMeasure(mm);
    onOpenChange(false);
    toast.success(
      `Mesure satellite : ${(distanceM ?? 0).toFixed(2)} m utilisée comme référence`
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Satellite className="h-5 w-5 text-amber-500" />
            Mesure satellite (orthophotos IGN)
          </DialogTitle>
        </DialogHeader>

        {/* Recherche d'adresse */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Adresse du bâtiment (ex : 12 rue des Frères Lumière, Blagnac)"
              autoFocus
            />
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-[1000] left-6 right-0 mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
              {suggestions.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(f)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200"
                >
                  {f.properties.label}
                </button>
              ))}
            </div>
          )}
          {searching && (
            <p className="absolute right-2 top-2 text-xs text-slate-400">…</p>
          )}
        </div>

        {/* Carte */}
        <div
          ref={mapDivRef}
          className="h-[420px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100"
        />

        {/* Barre de mesure */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <p className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center justify-center h-5 min-w-5 px-1 rounded font-mono font-semibold ${
                  pointCount === 0
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
                }`}
              >
                {pointCount}
              </span>
              <span>
                {pointCount === 0
                  ? "Clique le 1er angle de la façade sur la carte"
                  : pointCount === 1
                    ? "Clique le 2e angle — la distance s'affichera"
                    : "Points placés (Ctrl+Z ou clic droit = retirer le dernier)"}
              </span>
            </p>
            <p className="mt-0.5">
              Précision ≈ ±20-40 cm — largeurs au sol uniquement, jamais les hauteurs.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {distanceM !== null && (
              <span className="text-sm font-mono font-medium text-amber-600 dark:text-amber-400">
                {distanceM.toFixed(2)} m
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={resetMeasure}
              disabled={pointCount === 0}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Recommencer
            </Button>
            <Button
              size="sm"
              onClick={handleUse}
              disabled={distanceM === null || distanceM <= 0}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            >
              <Check className="h-4 w-4" />
              Utiliser comme largeur de référence
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
