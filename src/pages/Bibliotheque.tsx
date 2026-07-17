// ============================================================
// Bibliothèque — « Injecteur de fichiers »
// ============================================================
// Visuels récurrents partagés par l'équipe, rangés par catégorie /
// sous-catégorie. UX type panneau de bibliothèque pro :
//   - cartes COMPACTES : clic sur la carte = sélectionner
//   - loupe (au survol) = aperçu grand format ; poubelle = supprimer
//   - variante choisie via liste déroulante (si plusieurs tailles)
//   - échelle 1:10 / 1:1 en sélecteur segmenté — les dimensions affichées
//     sous chaque carte s'adaptent à l'échelle choisie
//   - « Injecter (N) » : tous les visuels cochés arrivent dans le document
//     Illustrator actif, éditables, aux bonnes dimensions

import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Library,
  Search,
  Trash2,
  Syringe,
  PlusCircle,
  Folder as FolderIcon,
  X,
  Plus,
  ZoomIn,
  Check,
  Star,
  Pencil,
  RotateCcw,
  BarChart3,
  Archive,
} from "lucide-react";
import {
  useBiblioItems,
  useAddBiblioItem,
  useDeleteBiblioItem,
  useRestoreBiblioItem,
  useHardDeleteBiblioItem,
  useUpdateBiblioItem,
  useBiblioCorbeille,
  useBiblioFavoris,
  useToggleFavori,
  useBiblioStats,
  enregistrerInjections,
  previewUrl,
  downloadItemFile,
  type BiblioItem,
  type BiblioVariante,
} from "@/hooks/useBibliotheque";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { DEFAULT_ILLUSTRATOR_PATH } from "@/components/fabrik/types";

const ILLUSTRATOR_PATH_KEY = "fabrik_illustrator_path";

function illustratorPath(): string {
  return localStorage.getItem(ILLUSTRATOR_PATH_KEY) ?? DEFAULT_ILLUSTRATOR_PATH;
}

/** base64 → bytes */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** normalisation pour la recherche : minuscules, sans accents */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** dimensions affichées selon l'échelle active */
function dimsAffichees(v: BiblioVariante, reelle: boolean): string {
  if (reelle) return `${Math.round(v.largeurMm)} × ${Math.round(v.hauteurMm)} mm`;
  return `${Math.round(v.largeurMm / 10)} × ${Math.round(v.hauteurMm / 10)} mm (éch. 1:10)`;
}

// ============================================================
// Carte compacte d'un item
// ============================================================
interface CarteProps {
  item: BiblioItem;
  echelleReelle: boolean;
  varianteIdx: number;
  selectionnee: boolean;
  favori: boolean;
  onToggle: () => void;
  onDoubleClic: () => void;
  onVariante: (idx: number) => void;
  onApercu: () => void;
  onEdit: () => void;
  onFavori: () => void;
  onDelete: () => void;
}

function CarteItem({
  item,
  echelleReelle,
  varianteIdx,
  selectionnee,
  favori,
  onToggle,
  onDoubleClic,
  onVariante,
  onApercu,
  onEdit,
  onFavori,
  onDelete,
}: CarteProps) {
  const { data: url } = useQuery({
    queryKey: ["biblio_preview", item.preview_path],
    queryFn: () => previewUrl(item.preview_path),
    staleTime: 55 * 60 * 1000,
  });
  const v = item.variantes[Math.min(varianteIdx, item.variantes.length - 1)];

  return (
    <div
      onClick={onToggle}
      onDoubleClick={onDoubleClic}
      className={`group relative rounded-lg border cursor-pointer select-none transition-all ${
        selectionnee
          ? "border-teal-500 ring-1 ring-teal-500 bg-teal-50/50 dark:bg-teal-900/20"
          : "border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-sm"
      }`}
      title="Clic = sélectionner · double-clic = injecter tout de suite"
    >
      {/* badge sélection */}
      {selectionnee && (
        <div className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center shadow">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* vignette compacte */}
      <div className="relative h-20 rounded-t-lg bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:12px_12px] flex items-center justify-center overflow-hidden p-2">
        {url ? (
          <img src={url} alt={item.nom} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="animate-pulse text-xs text-slate-400">…</div>
        )}
        {item.type === "plan" && (
          <span className="absolute bottom-1 left-1 rounded bg-indigo-600/90 text-white text-[9px] font-medium px-1 py-0.5">
            PLAN
          </span>
        )}
        {/* étoile favori : toujours visible si favori, au survol sinon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFavori();
          }}
          className={`absolute bottom-1 right-1 h-6 w-6 rounded flex items-center justify-center transition-opacity ${
            favori
              ? "text-amber-400 opacity-100"
              : "text-white bg-slate-900/60 opacity-0 group-hover:opacity-100 hover:text-amber-300"
          }`}
          title={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <Star className={`h-4 w-4 ${favori ? "fill-amber-400" : ""}`} />
        </button>
        {/* actions au survol */}
        <div className="absolute inset-x-0 top-0 p-1 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApercu();
            }}
            className="h-6 w-6 rounded bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900"
            title="Aperçu grand format"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-6 w-6 rounded bg-slate-900/70 text-white flex items-center justify-center hover:bg-teal-600"
              title="Modifier (nom, catégorie, variantes)"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-6 w-6 rounded bg-slate-900/70 text-white flex items-center justify-center hover:bg-red-600"
              title="Mettre à la corbeille (restaurable 30 jours)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* infos */}
      <div className="p-2 space-y-1">
        <p className="text-xs font-medium truncate dark:text-slate-200" title={item.nom}>
          {item.nom}
        </p>
        {item.variantes.length > 1 ? (
          <select
            value={varianteIdx}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onVariante(parseInt(e.target.value))}
            className="w-full h-6 text-[11px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-300 px-1"
            title="Choisir la variante de taille"
          >
            {item.variantes.map((va, i) => (
              <option key={i} value={i}>
                {va.label} — {dimsAffichees(va, echelleReelle)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            {v
              ? item.type === "plan"
                ? `${Math.round(v.largeurMm)} × ${Math.round(v.hauteurMm)} mm (tel quel)`
                : dimsAffichees(v, echelleReelle)
              : "—"}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Page
// ============================================================
export default function Bibliotheque() {
  const { data: items, isLoading } = useBiblioItems();
  const addItem = useAddBiblioItem();
  const deleteItem = useDeleteBiblioItem();
  const restoreItem = useRestoreBiblioItem();
  const hardDeleteItem = useHardDeleteBiblioItem();
  const updateItem = useUpdateBiblioItem();
  const { data: corbeille } = useBiblioCorbeille();
  const { data: favoris } = useBiblioFavoris();
  const toggleFavori = useToggleFavori();
  const { isAdmin } = useEffectiveRole();
  const [statsOpen, setStatsOpen] = useState(false);
  const { data: stats } = useBiblioStats(statsOpen && isAdmin);
  const [editItem, setEditItem] = useState<BiblioItem | null>(null);

  const [categorieActive, setCategorieActive] = useState<string>("Objet récurrent");
  const [recherche, setRecherche] = useState("");
  /** ids sélectionnés (l'ordre d'insertion = ordre d'injection) */
  const [selection, setSelection] = useState<Set<string>>(new Set());
  /** variante choisie par item (index) */
  const [variantesChoisies, setVariantesChoisies] = useState<Map<string, number>>(new Map());
  const [echelleReelle, setEchelleReelle] = useState(false);
  const [avecCotes, setAvecCotes] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [apercu, setApercu] = useState<BiblioItem | null>(null);
  const { data: apercuUrl } = useQuery({
    queryKey: ["biblio_preview", apercu?.preview_path],
    queryFn: () => previewUrl(apercu!.preview_path),
    enabled: !!apercu,
    staleTime: 55 * 60 * 1000,
  });

  // ---------- ajout depuis la sélection Illustrator ----------
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addFichier, setAddFichier] = useState<Uint8Array | null>(null);
  const [addPreview, setAddPreview] = useState<Uint8Array | null>(null);
  const [addPreviewUrl, setAddPreviewUrl] = useState<string>("");
  const [nom, setNom] = useState("");
  const [addType, setAddType] = useState<"objet" | "plan">("objet");
  const [categorie, setCategorie] = useState("Objet récurrent");
  const [catNouvelle, setCatNouvelle] = useState(false);
  const [sousCategorie, setSousCategorie] = useState("");
  const [variantes, setVariantes] = useState<BiblioVariante[]>([
    { label: "Standard", largeurMm: 0, hauteurMm: 0 },
  ]);

  const catOptions = useMemo(() => {
    const set = new Set<string>(["Objet récurrent"]);
    for (const it of items ?? []) set.add(it.categorie);
    return [...set];
  }, [items]);

  const categories = useMemo(() => {
    const map = new Map<string, { sous: Set<string>; n: number }>();
    for (const it of items ?? []) {
      if (!map.has(it.categorie)) map.set(it.categorie, { sous: new Set(), n: 0 });
      const entry = map.get(it.categorie)!;
      entry.n++;
      if (it.sous_categorie) entry.sous.add(it.sous_categorie);
    }
    // « Objet récurrent » toujours en tête, le reste en alphabétique
    const triees = [...map.entries()].sort((a, b) => {
      if (a[0] === "Objet récurrent") return -1;
      if (b[0] === "Objet récurrent") return 1;
      return a[0].localeCompare(b[0], "fr");
    });
    return new Map(triees);
  }, [items]);

  const visibles = useMemo(() => {
    if (!items) return [];
    let liste = items;
    const q = norm(recherche.trim());
    // une recherche active balaie TOUTES les catégories ; sinon on filtre
    // sur la vue sélectionnée (favoris ou catégorie)
    if (!q && categorieActive === "__favoris__") {
      liste = liste.filter((i) => favoris?.has(i.id));
    } else if (!q && categorieActive) {
      const [cat, sous] = categorieActive.split("§");
      liste = liste.filter(
        (i) => i.categorie === cat && (!sous || i.sous_categorie === sous)
      );
    }
    if (q) {
      liste = liste.filter(
        (i) =>
          norm(i.nom).includes(q) ||
          norm(i.categorie).includes(q) ||
          (i.sous_categorie && norm(i.sous_categorie).includes(q))
      );
    }
    return liste;
  }, [items, categorieActive, recherche, favoris]);

  const litTemp = async (fileName: string): Promise<string | null> => {
    try {
      return await invoke<string>("read_temp_binary", { fileName });
    } catch {
      return null;
    }
  };

  const handleCapture = async (mode: "objet" | "plan") => {
    setAddBusy(true);
    try {
      toast.info(
        mode === "plan"
          ? "Récupération du plan de travail actif…"
          : "Récupération de ta sélection Illustrator…"
      );
      await invoke<string>("run_illustrator_script", {
        illustratorPath: illustratorPath(),
        scriptName: "biblio_export_selection.jsx",
        params: JSON.stringify({ mode }),
      });
      let metaB64: string | null = null;
      for (let i = 0; i < 40 && !metaB64; i++) {
        await new Promise((r) => setTimeout(r, 500));
        metaB64 = await litTemp("graphidesk_biblio/meta.json");
      }
      if (!metaB64) throw new Error("Illustrator n'a rien exporté (sélection vide ?)");
      const meta = JSON.parse(atob(metaB64));
      if (meta.erreur) throw new Error(meta.erreur);

      const fichierB64 = await litTemp("graphidesk_biblio/item.ai");
      const previewB64 = await litTemp("graphidesk_biblio/preview.png");
      if (!fichierB64 || !previewB64) throw new Error("Fichiers d'export introuvables");

      const previewBytes = b64ToBytes(previewB64);
      setAddFichier(b64ToBytes(fichierB64));
      setAddPreview(previewBytes);
      setAddPreviewUrl(URL.createObjectURL(new Blob([previewBytes as BlobPart], { type: "image/png" })));
      if (meta.mode === "plan") {
        setAddType("plan");
        // dimensions DESSINÉES du plan de travail + décalage du contenu
        setVariantes([
          {
            label: "Plan de travail",
            largeurMm: Math.round((meta.wMm ?? 0) * 10) / 10,
            hauteurMm: Math.round((meta.hMm ?? 0) * 10) / 10,
            offXMm: meta.offXMm ?? 0,
            offYMm: meta.offYMm ?? 0,
          },
        ]);
      } else {
        setAddType("objet");
        setVariantes([
          {
            label: "Standard",
            largeurMm: Math.round((meta.wMm ?? 0) * 10),
            hauteurMm: Math.round((meta.hMm ?? 0) * 10),
          },
        ]);
      }
      setNom("");
      setSousCategorie("");
      setCatNouvelle(false);
      if (!catOptions.includes(categorie)) setCategorie(catOptions[0] ?? "Objet récurrent");
      setAddOpen(true);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setAddBusy(false);
    }
  };

  const handleEditOpen = (item: BiblioItem) => {
    setEditItem(item);
    setNom(item.nom);
    setCategorie(item.categorie);
    setSousCategorie(item.sous_categorie ?? "");
    setVariantes(item.variantes.map((v) => ({ ...v })));
    setAddType(item.type);
    setCatNouvelle(false);
  };

  const handleEditSubmit = () => {
    if (!editItem || !nom.trim() || !categorie.trim()) {
      toast.error("Nom et catégorie sont requis");
      return;
    }
    const vs = variantes.filter((v) => v.largeurMm > 0 && v.hauteurMm > 0);
    if (!vs.length) {
      toast.error("Au moins une variante avec ses dimensions");
      return;
    }
    updateItem.mutate(
      {
        id: editItem.id,
        nom: nom.trim(),
        categorie: categorie.trim(),
        sous_categorie: sousCategorie.trim() || null,
        variantes: vs,
      },
      {
        onSuccess: () => {
          toast.success("Fiche mise à jour");
          setEditItem(null);
        },
        onError: (e) => toast.error(String(e)),
      }
    );
  };

  const handleAddSubmit = () => {
    if (!nom.trim() || !categorie.trim() || !addFichier || !addPreview) {
      toast.error("Nom et catégorie sont requis");
      return;
    }
    const vs = variantes.filter((v) => v.largeurMm > 0 && v.hauteurMm > 0);
    if (!vs.length) {
      toast.error("Renseigne au moins une variante avec ses dimensions réelles (mm)");
      return;
    }
    addItem.mutate(
      {
        nom: nom.trim(),
        type: addType,
        categorie: categorie.trim(),
        sous_categorie: sousCategorie.trim() || null,
        variantes: vs,
        fichierBytes: addFichier,
        previewBytes: addPreview,
      },
      {
        onSuccess: () => {
          toast.success(`« ${nom.trim()} » ajouté à la bibliothèque`);
          setAddOpen(false);
        },
        onError: (e) => toast.error(String(e)),
      }
    );
  };

  // ---------- sélection / injection ----------
  const toggleItem = (item: BiblioItem) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const changeVariante = (item: BiblioItem, idx: number) => {
    setVariantesChoisies((prev) => new Map(prev).set(item.id, idx));
  };

  const injecterListe = async (liste: BiblioItem[]) => {
    if (liste.length === 0) return;
    setInjecting(true);
    try {
      const payload: Array<{
        fichier: string;
        nom: string;
        mode: "objet" | "plan";
        largeurMm: number;
        hauteurMm: number;
        offXMm: number;
        offYMm: number;
      }> = [];
      let i = 0;
      for (const item of liste) {
        const idx = Math.min(variantesChoisies.get(item.id) ?? 0, item.variantes.length - 1);
        const variante = item.variantes[idx];
        const bytes = await downloadItemFile(item.fichier_path);
        const b64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
        const path = await invoke<string>("save_temp_binary", {
          fileName: `graphidesk_biblio/inject_${i++}.ai`,
          contentBase64: b64,
        });
        payload.push({
          fichier: path.replace(/\\/g, "/"),
          nom: item.nom + (item.type === "objet" && item.variantes.length > 1 ? ` (${variante.label})` : ""),
          mode: item.type,
          largeurMm: variante.largeurMm,
          hauteurMm: variante.hauteurMm,
          offXMm: variante.offXMm ?? 0,
          offYMm: variante.offYMm ?? 0,
        });
      }
      await invoke<string>("run_illustrator_script", {
        illustratorPath: illustratorPath(),
        scriptName: "biblio_injecte.jsx",
        params: JSON.stringify({ echelle: echelleReelle ? 1 : 10, avecCotes, items: payload }),
      });
      toast.success(
        `${payload.length} visuel(s) injecté(s) — échelle ${echelleReelle ? "1:1" : "1:10"}`
      );
      void enregistrerInjections(liste.map((it) => it.id));
      setSelection(new Set());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setInjecting(false);
    }
  };

  const handleInjecter = () => {
    if (!items) return;
    const liste = [...selection]
      .map((id) => items.find((x) => x.id === id))
      .filter((x): x is BiblioItem => !!x);
    void injecterListe(liste);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
            <Library className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Bibliothèque</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Clic sur une carte = sélectionner · loupe = aperçu · l'injection arrive au centre de ta vue Illustrator
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setStatsOpen(true)}
              className="gap-2"
              title="Statistiques d'utilisation de la bibliothèque"
            >
              <BarChart3 className="h-4 w-4" />
              Stats
            </Button>
          )}
          <Button
            onClick={() => handleCapture("objet")}
            disabled={addBusy}
            className="gap-2 bg-teal-600 hover:bg-teal-700"
          >
            <PlusCircle className="h-4 w-4" />
            {addBusy ? "Récupération…" : "Ajouter la sélection"}
          </Button>
          <Button
            onClick={() => handleCapture("plan")}
            disabled={addBusy}
            variant="outline"
            className="gap-2 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"
            title="Capture le plan de travail actif ENTIER (avec tes cotes et annotations) — réinjecté tel quel comme nouveau plan de travail"
          >
            <FolderIcon className="h-4 w-4" />
            Ajouter le plan de travail actif
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Catégories */}
        <Card className="w-52 shrink-0 p-3 space-y-1 self-start">
          {(favoris?.size ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setCategorieActive("__favoris__")}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                categorieActive === "__favoris__" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium" : "hover:bg-slate-50 dark:hover:bg-slate-800"
              } dark:text-slate-200`}
            >
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              Favoris
              <span className="ml-auto text-[10px] rounded-full bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-slate-500 dark:text-slate-400">
                {favoris?.size ?? 0}
              </span>
            </button>
          )}
          {[...categories.entries()].map(([cat, entry]) => (
            <div key={cat}>
              <button
                type="button"
                onClick={() => setCategorieActive(cat)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                  categorieActive === cat ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                } dark:text-slate-200`}
              >
                <FolderIcon className="h-4 w-4" />
                <span className="truncate">{cat}</span>
                <span className="ml-auto text-[10px] rounded-full bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-slate-500 dark:text-slate-400">
                  {entry.n}
                </span>
              </button>
              {[...entry.sous].sort().map((sous) => (
                <button
                  key={sous}
                  type="button"
                  onClick={() => setCategorieActive(`${cat}§${sous}`)}
                  className={`w-full text-left pl-8 pr-2 py-1 rounded text-xs ${
                    categorieActive === `${cat}§${sous}` ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {sous}
                </button>
              ))}
            </div>
          ))}
          {(corbeille?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setCategorieActive("__corbeille__")}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 mt-2 pt-2 ${
                categorieActive === "__corbeille__" ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium" : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Archive className="h-4 w-4" />
              Corbeille
              <span className="ml-auto text-[10px] rounded-full bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-slate-500 dark:text-slate-400">
                {corbeille?.length ?? 0}
              </span>
            </button>
          )}
        </Card>

        {/* Grille */}
        <div className="flex-1 space-y-3">
          {/* Barre outils : recherche + échelle + injection */}
          <Card className="p-2.5 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 h-8 text-sm"
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* sélecteur d'échelle segmenté — les dims des cartes suivent */}
            <div className="flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setEchelleReelle(false)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  !echelleReelle
                    ? "bg-teal-600 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
                title="Injection à l'échelle maquette (dimensions ÷ 10)"
              >
                Maquette 1:10
              </button>
              <button
                type="button"
                onClick={() => setEchelleReelle(true)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  echelleReelle
                    ? "bg-teal-600 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
                title="Injection en taille réelle"
              >
                Réel 1:1
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAvecCotes(!avecCotes)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                avecCotes
                  ? "bg-teal-600 border-teal-600 text-white"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
              title="Génère des cotes autour de chaque visuel injecté — toujours justes, calculées depuis la variante choisie"
            >
              {avecCotes && <Check className="h-3.5 w-3.5" />}
              Ajouter les cotes
            </button>

            {selection.size > 0 && (
              <button
                type="button"
                onClick={() => setSelection(new Set())}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
              >
                Tout désélectionner
              </button>
            )}
            <Button
              onClick={handleInjecter}
              disabled={selection.size === 0 || injecting}
              size="sm"
              className="gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <Syringe className="h-4 w-4" />
              {injecting ? "Injection…" : `Injecter (${selection.size})`}
            </Button>
          </Card>

          {isLoading && <p className="text-sm text-slate-400">Chargement…</p>}
          {!isLoading && visibles.length === 0 && (
            <Card className="p-10 text-center text-sm text-slate-400">
              {recherche
                ? `Aucun visuel ne correspond à « ${recherche} »`
                : "Bibliothèque vide — sélectionne un visuel dans Illustrator puis clique « Ajouter depuis la sélection Illustrator »."}
            </Card>
          )}

          {categorieActive === "__corbeille__" ? (
            <div className="space-y-2">
              {(corbeille ?? []).map((item) => {
                const joursRestants = Math.max(
                  0,
                  30 - Math.floor((Date.now() - new Date(item.deleted_at ?? 0).getTime()) / 86400000)
                );
                return (
                  <Card key={item.id} className="p-3 flex items-center gap-3">
                    <Archive className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate dark:text-slate-200">{item.nom}</p>
                      <p className="text-xs text-slate-400">
                        {item.categorie}
                        {item.sous_categorie ? ` › ${item.sous_categorie}` : ""} — purge définitive dans{" "}
                        {joursRestants} j
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        restoreItem.mutate(item, {
                          onSuccess: () => toast.success(`« ${item.nom} » restauré`),
                          onError: (e) => toast.error(String(e)),
                        })
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
                      onClick={() => {
                        if (confirm(`Supprimer DÉFINITIVEMENT « ${item.nom} » ? (irréversible)`)) {
                          hardDeleteItem.mutate(item, { onError: (e) => toast.error(String(e)) });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Définitif
                    </Button>
                  </Card>
                );
              })}
              {(corbeille?.length ?? 0) === 0 && (
                <Card className="p-10 text-center text-sm text-slate-400">Corbeille vide</Card>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-3">
              {visibles.map((item) => (
                <CarteItem
                  key={item.id}
                  item={item}
                  echelleReelle={echelleReelle}
                  varianteIdx={variantesChoisies.get(item.id) ?? 0}
                  selectionnee={selection.has(item.id)}
                  favori={favoris?.has(item.id) ?? false}
                  onToggle={() => toggleItem(item)}
                  onDoubleClic={() => void injecterListe([item])}
                  onVariante={(idx) => changeVariante(item, idx)}
                  onApercu={() => setApercu(item)}
                  onEdit={() => handleEditOpen(item)}
                  onFavori={() =>
                    toggleFavori.mutate(
                      { itemId: item.id, favori: !(favoris?.has(item.id) ?? false) },
                      { onError: (e) => toast.error(String(e)) }
                    )
                  }
                  onDelete={() => {
                    deleteItem.mutate(item, {
                      onSuccess: () =>
                        toast.success(`« ${item.nom} » déplacé vers la corbeille (restaurable 30 jours)`),
                      onError: (e) => toast.error(String(e)),
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aperçu grand format */}
      <Dialog open={!!apercu} onOpenChange={(o) => !o && setApercu(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{apercu?.nom}</DialogTitle>
          </DialogHeader>
          <div className="rounded bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:16px_16px] p-4 flex items-center justify-center min-h-64">
            {apercuUrl && <img src={apercuUrl} alt={apercu?.nom} className="max-h-[60vh] object-contain" />}
          </div>
          {apercu && (
            <p className="text-xs text-slate-400 text-center">
              {apercu.categorie}
              {apercu.sous_categorie ? ` › ${apercu.sous_categorie}` : ""} —{" "}
              {apercu.variantes
                .map((v) => `${v.label} : ${Math.round(v.largeurMm)} × ${Math.round(v.hauteurMm)} mm réels`)
                .join(" · ")}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-teal-500" />
              Modifier « {editItem?.nom} »
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="edit-nom">Nom</Label>
                <Input id="edit-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-cat">Catégorie</Label>
                <Input id="edit-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-sous">Sous-catégorie</Label>
                <Input id="edit-sous" value={sousCategorie} onChange={(e) => setSousCategorie(e.target.value)} />
              </div>
            </div>
            {addType === "objet" && (
              <div className="space-y-2">
                <Label>Variantes — dimensions réelles (mm)</Label>
                {variantes.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={v.label}
                      onChange={(e) =>
                        setVariantes((vs) => vs.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                      }
                      className="w-32"
                    />
                    <Input
                      type="number"
                      value={v.largeurMm || ""}
                      onChange={(e) =>
                        setVariantes((vs) =>
                          vs.map((x, i) => (i === idx ? { ...x, largeurMm: parseFloat(e.target.value) || 0 } : x))
                        )
                      }
                      className="w-24"
                    />
                    <span className="text-slate-400">×</span>
                    <Input
                      type="number"
                      value={v.hauteurMm || ""}
                      onChange={(e) =>
                        setVariantes((vs) =>
                          vs.map((x, i) => (i === idx ? { ...x, hauteurMm: parseFloat(e.target.value) || 0 } : x))
                        )
                      }
                      className="w-24"
                    />
                    {variantes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setVariantes((vs) => vs.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setVariantes((vs) => [...vs, { label: `Taille ${vs.length + 1}`, largeurMm: 0, hauteurMm: 0 }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter une variante
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Annuler
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateItem.isPending} className="bg-teal-600 hover:bg-teal-700">
              {updateItem.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog stats admin */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-500" />
              Statistiques d'utilisation
            </DialogTitle>
          </DialogHeader>
          {stats ? (
            <div className="space-y-4 text-sm">
              <p className="dark:text-slate-300">
                <strong>{stats.total}</strong> injection(s) au total
              </p>
              <div>
                <h4 className="font-medium mb-1 dark:text-slate-200">Visuels les plus utilisés</h4>
                {stats.parItem.slice(0, 8).map((r) => (
                  <div key={r.itemId} className="flex justify-between text-xs py-0.5 dark:text-slate-300">
                    <span>{items?.find((i) => i.id === r.itemId)?.nom ?? "(supprimé)"}</span>
                    <span className="font-mono text-slate-400">{r.n}×</span>
                  </div>
                ))}
                {stats.parItem.length === 0 && <p className="text-xs text-slate-400">Aucune injection encore</p>}
              </div>
              <div>
                <h4 className="font-medium mb-1 dark:text-slate-200">Par utilisateur</h4>
                {stats.parUtilisateur.map((r) => (
                  <div key={r.userId} className="flex justify-between text-xs py-0.5 dark:text-slate-300">
                    <span>{r.nom}</span>
                    <span className="font-mono text-slate-400">{r.n}×</span>
                  </div>
                ))}
              </div>
              {items && (
                <div>
                  <h4 className="font-medium mb-1 dark:text-slate-200">Jamais utilisés</h4>
                  <p className="text-xs text-slate-400">
                    {items
                      .filter((i) => !stats.parItem.some((r) => r.itemId === i.id))
                      .map((i) => i.nom)
                      .join(", ") || "—"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Chargement…</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog d'ajout */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-teal-500" />
              Ajouter à la bibliothèque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addPreviewUrl && (
              <div className="rounded bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] p-3 flex justify-center">
                <img src={addPreviewUrl} alt="aperçu" className="max-h-32 object-contain" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="biblio-nom">Nom</Label>
                <Input id="biblio-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Interphone 2 boutons" />
              </div>
              <div>
                <Label htmlFor="biblio-cat">Catégorie</Label>
                {catNouvelle ? (
                  <div className="flex items-center gap-1">
                    <Input
                      id="biblio-cat"
                      value={categorie}
                      onChange={(e) => setCategorie(e.target.value)}
                      placeholder="Nom de la nouvelle catégorie"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCatNouvelle(false);
                        setCategorie(catOptions[0] ?? "Objet récurrent");
                      }}
                      className="text-slate-400 hover:text-slate-600 shrink-0"
                      title="Revenir aux catégories existantes"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <select
                    id="biblio-cat"
                    value={categorie}
                    onChange={(e) => {
                      if (e.target.value === "__nouvelle__") {
                        setCatNouvelle(true);
                        setCategorie("");
                      } else {
                        setCategorie(e.target.value);
                      }
                    }}
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 px-2 text-sm"
                  >
                    {catOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__nouvelle__">➕ Nouvelle catégorie…</option>
                  </select>
                )}
              </div>
              <div>
                <Label htmlFor="biblio-sous">Sous-catégorie (optionnel)</Label>
                <Input id="biblio-sous" value={sousCategorie} onChange={(e) => setSousCategorie(e.target.value)} placeholder="Camif Habitat" />
              </div>
            </div>
            {addType === "plan" && variantes[0] && (
              <p className="text-xs rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 p-2">
                Plan de travail complet : {Math.round(variantes[0].largeurMm)} ×{" "}
                {Math.round(variantes[0].hauteurMm)} mm — réinjecté <strong>tel quel</strong> comme
                nouveau plan de travail (tes cotes et annotations incluses).
              </p>
            )}
            <div className={addType === "plan" ? "hidden" : "space-y-2"}>
              <Label>
                Variantes — dimensions <strong>réelles</strong> en mm (pré-rempli = dessin × 10)
              </Label>
              {variantes.map((v, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={v.label}
                    onChange={(e) =>
                      setVariantes((vs) => vs.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                    }
                    placeholder="Standard"
                    className="w-32"
                  />
                  <Input
                    type="number"
                    value={v.largeurMm || ""}
                    onChange={(e) =>
                      setVariantes((vs) =>
                        vs.map((x, i) => (i === idx ? { ...x, largeurMm: parseFloat(e.target.value) || 0 } : x))
                      )
                    }
                    placeholder="L (mm)"
                    className="w-24"
                  />
                  <span className="text-slate-400">×</span>
                  <Input
                    type="number"
                    value={v.hauteurMm || ""}
                    onChange={(e) =>
                      setVariantes((vs) =>
                        vs.map((x, i) => (i === idx ? { ...x, hauteurMm: parseFloat(e.target.value) || 0 } : x))
                      )
                    }
                    placeholder="H (mm)"
                    className="w-24"
                  />
                  {variantes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVariantes((vs) => vs.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setVariantes((vs) => [...vs, { label: `Taille ${vs.length + 1}`, largeurMm: 0, hauteurMm: 0 }])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter une variante
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddSubmit} disabled={addItem.isPending} className="bg-teal-600 hover:bg-teal-700">
              {addItem.isPending ? "Envoi…" : "Ajouter à la bibliothèque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
