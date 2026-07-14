import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PencilRuler,
  ArrowLeft,
  Trash2,
  FolderOpen,
  Save,
  FileDown,
  ImageIcon,
  RefreshCw,
  Wand2,
  BarChart3,
} from "lucide-react";
import { StatsVt } from "@/measure/components/StatsVt";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import {
  listProjects,
  downloadProjectPhoto,
  updateProjectVt,
  setProjectStatut,
  deleteProject,
  type MeasureProjectRow,
  type ProjectStatut,
  type VtDims,
} from "@/measure/persistence/projects";
import { buildPremaquetteSvg, downloadSvg, gdZoneName, gdProjetKey } from "@/measure/engine/svgExport";
import { roundTo5Mm } from "@/measure/engine/zones";
import { buildPhotomontagePsd, toBase64 } from "@/measure/engine/psdExport";
import { DEFAULT_ILLUSTRATOR_PATH } from "@/components/fabrik/types";
import type { Zone } from "@/measure/state/types";
import { formatDate } from "@/lib/utils";

const ILLUSTRATOR_PATH_KEY = "fabrik_illustrator_path";
const PHOTOSHOP_PATH_KEY = "measure_photoshop_path";
const DEFAULT_PHOTOSHOP_PATH =
  "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe";

const STATUT_BADGE: Record<ProjectStatut, { label: string; cls: string }> = {
  attente_vt: {
    label: "🟡 Attente VT",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  vt_recue: {
    label: "🟢 VT reçue",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  terminee: {
    label: "✅ Terminée",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

export default function MaquetteVT() {
  const [projects, setProjects] = useState<MeasureProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MeasureProjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MeasureProjectRow | null>(null);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<"all" | ProjectStatut>("all");
  // stats de précision : réservées à l'admin (les graphistes n'en ont pas l'usage)
  const { isAdmin } = useEffectiveRole();
  const [showStats, setShowStats] = useState(false);

  const filtered = projects.filter((p) => {
    if (statutFilter !== "all" && p.statut !== statutFilter) return false;
    if (search.trim() && !p.nom.toLowerCase().includes(search.trim().toLowerCase()))
      return false;
    return true;
  });

  const countByStatut = (s: ProjectStatut) => projects.filter((p) => p.statut === s).length;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (err) {
      toast.error(`Chargement des projets : ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id, deleteTarget.photo_path);
      toast.success("Projet supprimé");
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) setSelected(null);
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
            <PencilRuler className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Maquette suite VT
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Projets de mesure sauvegardés — saisis les cotes réelles et génère la maquette
              définitive
            </p>
          </div>
        </div>
        {!selected && (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant={showStats ? "default" : "outline"}
                size="sm"
                onClick={() => setShowStats((s) => !s)}
                className="gap-1.5"
                title="Précision des mesures photo vs cotes VT (tous les graphistes)"
              >
                <BarChart3 className="h-4 w-4" />
                Stats précision
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
        )}
      </div>

      {!selected && showStats && isAdmin ? (
        <StatsVt projects={projects} />
      ) : selected ? (
        <ProjectDetail
          project={selected}
          onBack={() => {
            setSelected(null);
            refresh();
          }}
        />
      ) : (
        <>
          {/* Recherche + filtres de statut */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Rechercher un projet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-9"
            />
            <div className="flex items-center gap-1">
              {(
                [
                  ["all", `Tous (${projects.length})`],
                  ["attente_vt", `🟡 Attente VT (${countByStatut("attente_vt")})`],
                  ["vt_recue", `🟢 VT reçue (${countByStatut("vt_recue")})`],
                  ["terminee", `✅ Terminée (${countByStatut("terminee")})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatutFilter(value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statutFilter === value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <Card className="p-12 text-center text-gray-500 dark:text-slate-400">
              Chargement...
            </Card>
          ) : projects.length === 0 ? (
            <Card className="p-12 text-center border-2 border-dashed">
              <div className="text-5xl mb-3">📐</div>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Aucun projet sauvegardé
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Depuis l'outil <strong>Mesure photo</strong>, utilise « Sauvegarder → attente de
                VT » pour envoyer un projet ici.
              </p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-gray-500 dark:text-slate-400">
              Aucun projet ne correspond à la recherche / au filtre.
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group"
                  onClick={() => setSelected(p)}
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium w-28 text-center ${STATUT_BADGE[p.statut].cls}`}
                  >
                    {STATUT_BADGE[p.statut].label}
                  </span>
                  <span className="font-medium text-sm dark:text-slate-100 truncate flex-1">
                    {p.nom}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-mono shrink-0">
                    {p.doc.zones.length} zone(s)
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0 w-20 text-right">
                    {formatDate(p.created_at)}
                  </span>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      onClick={() => setSelected(p)}
                      title="Ouvrir"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      onClick={() => setDeleteTarget(p)}
                      title="Supprimer le projet"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Supprimer "${deleteTarget?.nom ?? ""}"`}
        description="Le projet et sa photo seront définitivement supprimés."
        confirmText="Supprimer"
        variant="danger"
        icon="delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ============================================================
// Détail d'un projet : photo + tableau d'édition des cotes VT
// ============================================================

function ProjectDetail({
  project,
  onBack,
}: {
  project: MeasureProjectRow;
  onBack: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoCanvas, setPhotoCanvas] = useState<HTMLCanvasElement | null>(null);
  // Préremplissage : cotes VT déjà saisies, sinon les cotes provisoires
  // (la VT confirme souvent — il n'y a plus qu'à corriger les écarts)
  const [vtDims, setVtDims] = useState<VtDims>(() => {
    const init: VtDims = {};
    for (const z of project.doc.zones) {
      const saved = project.vt_dims?.[z.id];
      init[z.id] =
        saved && saved.widthMm > 0
          ? saved
          : { widthMm: Math.round(z.widthMm), heightMm: Math.round(z.heightMm) };
    }
    return init;
  });
  const [statut, setStatut] = useState<ProjectStatut>(project.statut);
  const [busy, setBusy] = useState(false);
  const [showPsdDialog, setShowPsdDialog] = useState(false);
  const [psdExcluded, setPsdExcluded] = useState<Set<string>>(new Set());
  const [showRecaleDialog, setShowRecaleDialog] = useState(false);
  const [recaleExcluded, setRecaleExcluded] = useState<Set<string>>(new Set());

  const togglePsdExcluded = (id: string) => {
    setPsdExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Télécharger la photo du projet + dessiner les zones dessus (affichage)
  useEffect(() => {
    let revoked: string | null = null;
    downloadProjectPhoto(project.photo_path)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        revoked = url;
        const img = new window.Image();
        img.onload = () => {
          // canvas PROPRE (pour les exports PSD / échantillonnage couleur)
          const clean = document.createElement("canvas");
          clean.width = img.naturalWidth;
          clean.height = img.naturalHeight;
          clean.getContext("2d")?.drawImage(img, 0, 0);
          setPhotoCanvas(clean);

          // canvas ANNOTÉ (affichage : quadrilatères + labels des zones)
          const annotated = document.createElement("canvas");
          annotated.width = img.naturalWidth;
          annotated.height = img.naturalHeight;
          const ctx = annotated.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const lw = Math.max(2, img.naturalWidth / 900);
            const fontSize = Math.max(14, img.naturalWidth / 70);
            ctx.font = `bold ${fontSize}px Arial`;
            for (const z of project.doc.zones) {
              const vitrage = z.fill === "vitrage";
              ctx.beginPath();
              ctx.moveTo(z.corners[0].x, z.corners[0].y);
              for (let i = 1; i < 4; i++) ctx.lineTo(z.corners[i].x, z.corners[i].y);
              ctx.closePath();
              ctx.fillStyle = vitrage ? "rgba(67,118,186,0.25)" : "rgba(16,185,129,0.18)";
              ctx.fill();
              ctx.strokeStyle = vitrage ? "#4376ba" : "#10b981";
              ctx.lineWidth = lw;
              ctx.stroke();
              // label sur fond sombre au centre
              const cx = (z.corners[0].x + z.corners[1].x + z.corners[2].x + z.corners[3].x) / 4;
              const cy = (z.corners[0].y + z.corners[1].y + z.corners[2].y + z.corners[3].y) / 4;
              const text = z.label;
              const tw = ctx.measureText(text).width;
              const pad = fontSize * 0.4;
              ctx.fillStyle = "rgba(15,23,42,0.82)";
              ctx.fillRect(cx - tw / 2 - pad, cy - fontSize / 2 - pad, tw + 2 * pad, fontSize + 2 * pad);
              ctx.fillStyle = "#ffffff";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(text, cx, cy);
            }
          }
          setPhotoUrl(annotated.toDataURL("image/jpeg", 0.9));
          URL.revokeObjectURL(url);
          revoked = null;
        };
        img.src = url;
      })
      .catch((err) => toast.error(`Photo : ${String(err)}`));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [project.photo_path, project.doc.zones]);

  const zones = project.doc.zones;
  const plane = project.doc.planes.find((p) => p.id === project.doc.activePlaneId);

  const getVt = (z: Zone) => vtDims[z.id] ?? { widthMm: 0, heightMm: 0 };
  const setVt = (zoneId: string, field: "widthMm" | "heightMm", value: number) => {
    setVtDims((prev) => ({
      ...prev,
      [zoneId]: {
        widthMm: field === "widthMm" ? value : prev[zoneId]?.widthMm ?? 0,
        heightMm: field === "heightMm" ? value : prev[zoneId]?.heightMm ?? 0,
      },
    }));
  };

  /** Zones avec cotes VT substituées (fallback : cote provisoire, marquée) */
  const zonesWithVt = (): Zone[] =>
    zones.map((z) => {
      const v = vtDims[z.id];
      const confirmed = !!v && v.widthMm > 0 && v.heightMm > 0;
      return confirmed
        ? { ...z, widthMm: v.widthMm, heightMm: v.heightMm, vtConfirmed: true }
        : { ...z, vtConfirmed: false };
    });

  const handleSaveVt = async () => {
    setBusy(true);
    try {
      const next: ProjectStatut = statut === "terminee" ? "terminee" : "vt_recue";
      await updateProjectVt(project.id, vtDims, next);
      setStatut(next);
      toast.success("Cotes VT enregistrées");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSvg = async () => {
    if (!plane) return;
    setBusy(true);
    try {
      const svg = buildPremaquetteSvg(
        zonesWithVt(),
        plane,
        project.doc.imageName ?? project.nom,
        photoCanvas,
        { vt: true }
      );
      if (!svg) {
        toast.error("Impossible de générer la maquette");
        return;
      }
      const illustratorPath =
        localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
      try {
        const svgPath = await invoke<string>("save_temp_file", {
          fileName: `maquette_vt_${project.nom.replace(/[^a-zA-Z0-9]/g, "_")}.svg`,
          content: svg,
        });
        await invoke<string>("run_illustrator_script", {
          illustratorPath,
          scriptName: "premaquette_open.jsx",
          params: JSON.stringify({ svgPath }),
        });
        toast.success("Maquette VT ouverte dans Illustrator");
      } catch (err) {
        toast.error(`${String(err)} — téléchargement à la place`);
        downloadSvg(svg, "maquette_vt.svg");
      }
      // génération SVG = projet terminé
      await updateProjectVt(project.id, vtDims, "terminee");
      setStatut("terminee");
    } finally {
      setBusy(false);
    }
  };

  // ---- Recalage de la maquette .ai OUVERTE aux cotes VT ----
  // Les blocs générés portent des noms GD_ZONE_* qui survivent au .ai :
  // le script les retrouve et redimensionne cadres/verre (centre conservé)
  // SANS toucher au travail posé par le graphiste.
  const openRecaleDialog = () => {
    // pré-cochées : les vitrines uniquement (le reste est rarement recalé)
    setRecaleExcluded(new Set(zones.filter((z) => z.fill !== "vitrage").map((z) => z.id)));
    setShowRecaleDialog(true);
  };

  const toggleRecaleExcluded = (id: string) => {
    setRecaleExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRecale = async () => {
    const selected = zones.filter((z) => !recaleExcluded.has(z.id));
    if (selected.length === 0) {
      toast.error("Aucune zone sélectionnée");
      return;
    }
    setShowRecaleDialog(false);
    setBusy(true);
    try {
      const zonesParams = selected.map((z) => {
        const v = vtDims[z.id];
        // base du ratio = la cote DESSINÉE dans la prémaquette (provisoire
        // arrondie au 5mm), cible = cote VT (axe sans cote VT : inchangé)
        const provW = roundTo5Mm(z.widthMm);
        const provH = roundTo5Mm(z.heightMm);
        const vtW = v && v.widthMm > 0 ? v.widthMm : null;
        const vtH = v && v.heightMm > 0 ? v.heightMm : null;
        const full = vtW !== null && vtH !== null;
        return {
          key: gdZoneName(z.label),
          label: z.label,
          provW,
          provH,
          vtW,
          vtH,
          dimsText: `${vtW ?? provW} × ${vtH ?? provH} mm${full ? " (VT)" : " (VT partielle)"}`,
        };
      });
      const illustratorPath =
        localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
      await invoke<string>("run_illustrator_script", {
        illustratorPath,
        scriptName: "recale_vt.jsx",
        params: JSON.stringify({
          zones: zonesParams,
          projetKey: gdProjetKey(project.doc.imageName ?? project.nom),
        }),
      });
      // sauvegarde AUTOMATIQUE des cotes VT (deltas pour les stats de
      // précision) + le recalage clôt le projet
      try {
        await updateProjectVt(project.id, vtDims, "terminee");
        setStatut("terminee");
      } catch {
        // la sauvegarde ne doit pas masquer le succès du recalage
      }
      toast.success(
        "Recalage lancé — rapport dans Illustrator. Cotes VT enregistrées, projet terminé ✔",
        { duration: 7000 }
      );
    } catch (err) {
      toast.error(`Recalage : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePsd = async () => {
    if (!photoCanvas) {
      toast.error("Photo non chargée");
      return;
    }
    const selectedZones = zonesWithVt().filter((z) => !psdExcluded.has(z.id));
    if (selectedZones.length === 0) {
      toast.error("Aucune zone sélectionnée pour le PSD");
      return;
    }
    setShowPsdDialog(false);
    setBusy(true);
    try {
      toast.info("Génération du PSD...", { duration: 3000 });
      const psdBytes = await buildPhotomontagePsd(selectedZones, photoCanvas);
      const psdPath = await invoke<string>("save_temp_binary", {
        fileName: `photomontage_vt_${project.nom.replace(/[^a-zA-Z0-9]/g, "_")}.psd`,
        contentBase64: toBase64(psdBytes),
      });
      const photoshopPath =
        localStorage.getItem(PHOTOSHOP_PATH_KEY) ?? DEFAULT_PHOTOSHOP_PATH;
      try {
        await invoke("open_file_with", { appPath: photoshopPath, filePath: psdPath });
        toast.success("PSD ouvert dans Photoshop");
      } catch {
        toast.info(`PSD généré : ${psdPath}`);
      }
    } catch (err) {
      toast.error(`PSD : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Retour aux projets
        </Button>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUT_BADGE[statut].cls}`}
        >
          {STATUT_BADGE[statut].label}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Photo */}
        <Card className="p-3">
          <h3 className="font-medium mb-2 dark:text-slate-200">{project.nom}</h3>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={project.nom}
              className="w-full rounded border dark:border-slate-700"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              Chargement de la photo...
            </div>
          )}
        </Card>

        {/* Tableau des cotes */}
        <Card className="p-4 space-y-3">
          <h3 className="font-medium dark:text-slate-200">Cotes réelles (visite technique)</h3>
          <div className="space-y-2">
            {zones.map((z) => {
              const v = getVt(z);
              // delta erreur mesure photo vs cote réelle
              const dW = v.widthMm > 0 ? v.widthMm - z.widthMm : 0;
              const dH = v.heightMm > 0 ? v.heightMm - z.heightMm : 0;
              const pW = z.widthMm > 0 ? (dW / z.widthMm) * 100 : 0;
              const pH = z.heightMm > 0 ? (dH / z.heightMm) * 100 : 0;
              // paliers MÉTIER en mm absolus (la tolérance de fab ne dépend
              // pas de la taille de la vitrine) : <10 vert, <50 ambre, sinon rouge
              const maxMm = Math.max(Math.abs(dW), Math.abs(dH));
              const deltaCls =
                maxMm < 10
                  ? "text-emerald-600 dark:text-emerald-400"
                  : maxMm < 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400";
              const fmt = (d: number, p: number) =>
                `${d >= 0 ? "+" : ""}${Math.round(d)}mm (${p >= 0 ? "+" : ""}${p.toFixed(1)}%)`;
              return (
                <div
                  key={z.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded border dark:border-slate-700 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium dark:text-slate-200">{z.label}</span>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">
                      provisoire : ≈ {Math.round(z.widthMm)} × {Math.round(z.heightMm)} mm
                      {z.fill === "vitrage" ? " · vitrage" : ""}
                    </p>
                    {(Math.round(dW) !== 0 || Math.round(dH) !== 0) && (
                      <p className={`text-[11px] font-mono ${deltaCls}`}>
                        Δ L {fmt(dW, pW)} · H {fmt(dH, pH)}
                      </p>
                    )}
                  </div>
                  <Input
                    type="number"
                    min="1"
                    placeholder="L"
                    className="w-24 h-8 text-sm font-mono"
                    value={v.widthMm || ""}
                    onChange={(e) => setVt(z.id, "widthMm", parseFloat(e.target.value) || 0)}
                    title="Largeur réelle (mm)"
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="H"
                    className="w-24 h-8 text-sm font-mono"
                    value={v.heightMm || ""}
                    onChange={(e) => setVt(z.id, "heightMm", parseFloat(e.target.value) || 0)}
                    title="Hauteur réelle (mm)"
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-2 border-t dark:border-slate-700">
            <Button
              onClick={openRecaleDialog}
              disabled={busy}
              size="sm"
              className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              title="Redimensionne les vitrines de la maquette .ai OUVERTE dans Illustrator aux cotes VT — sans toucher à votre travail. Enregistre les cotes et termine le projet."
            >
              <Wand2 className="h-4 w-4" />
              Recaler la maquette ouverte (cotes VT)
            </Button>
            <p className="text-[11px] text-gray-400 dark:text-slate-500">
              💡 Enregistre aussi les cotes VT (stats d'écart) et passe le projet en « Terminé ».
              Zone non mesurée par le poseur : vide ses champs, elle restera provisoire.
            </p>
            <Button
              onClick={handleSvg}
              disabled={busy}
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
              title="Repart de zéro : nouvelle maquette propre aux cotes VT (si tu n'as pas encore travaillé sur la prémaquette)"
            >
              <FileDown className="h-4 w-4" />
              Générer une maquette VT vierge (Illustrator)
            </Button>
            <Button
              onClick={() => setShowPsdDialog(true)}
              disabled={busy}
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400"
            >
              <ImageIcon className="h-4 w-4" />
              Re-générer le PSD photomontage
            </Button>
            <Button
              onClick={handleSaveVt}
              disabled={busy}
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-gray-500 dark:text-slate-400"
              title="Sauvegarde intermédiaire (saisie en plusieurs fois) — le recalage enregistre déjà tout seul"
            >
              <Save className="h-4 w-4" />
              Enregistrer les cotes sans générer
            </Button>
          </div>
        </Card>
      </div>

      {/* Sélection des zones à recaler dans la maquette Illustrator ouverte */}
      <Dialog open={showRecaleDialog} onOpenChange={setShowRecaleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Wand2 className="h-5 w-5 text-emerald-500" />
              Zones à recaler aux cotes VT
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Agit sur la maquette <strong>ouverte dans Illustrator</strong> (celle issue de la
            prémaquette de ce projet). Seuls les blocs générés par GraphiDesk sont
            redimensionnés, centre conservé — jamais vos éléments.
          </p>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {zones.map((z) => {
              const v = vtDims[z.id];
              const hasVt = !!v && (v.widthMm > 0 || v.heightMm > 0);
              return (
                <label
                  key={z.id}
                  className="flex items-center gap-3 rounded p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    checked={!recaleExcluded.has(z.id)}
                    onChange={() => toggleRecaleExcluded(z.id)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm dark:text-slate-200">{z.label}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-mono ml-auto">
                    {roundTo5Mm(z.widthMm)} × {roundTo5Mm(z.heightMm)}
                    {hasVt && v
                      ? ` → ${v.widthMm > 0 ? v.widthMm : "?"} × ${v.heightMm > 0 ? v.heightMm : "?"}`
                      : " (pas de cote VT)"}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            ⚠ Les blocs dégroupés gardent leur nom et restent recalables ; un bloc renommé ou
            supprimé sera signalé « introuvable » dans le rapport Illustrator.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecaleDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleRecale} className="bg-emerald-600 hover:bg-emerald-700">
              Recaler dans Illustrator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sélection des zones pour le PSD */}
      <Dialog open={showPsdDialog} onOpenChange={setShowPsdDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <ImageIcon className="h-5 w-5 text-indigo-500" />
              Zones à inclure dans le PSD
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {zones.map((z) => {
              const v = vtDims[z.id];
              const dims =
                v && v.widthMm > 0
                  ? `${v.widthMm} × ${v.heightMm} mm`
                  : `≈ ${Math.round(z.widthMm)} × ${Math.round(z.heightMm)} mm`;
              return (
                <label
                  key={z.id}
                  className="flex items-center gap-3 rounded p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    checked={!psdExcluded.has(z.id)}
                    onChange={() => togglePsdExcluded(z.id)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm dark:text-slate-200">{z.label}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-mono ml-auto">
                    {dims}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Décoche par exemple le fond de devanture si tu ne veux que les vitrines.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPsdDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handlePsd} className="bg-indigo-600 hover:bg-indigo-700">
              Générer le PSD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
