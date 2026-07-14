import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ClipboardList } from "lucide-react";
import { useMeasureDoc, useMeasureImage } from "../state/store";
import { formatDims } from "../engine/zones";
import { exportFicheVt } from "../engine/ficheVt";

/**
 * Export "Fiche VT" pour le gabarit InDesign (plugin Cotes BAT UXP).
 * Produit un dossier temp avec :
 *   - fiche_vt.json : zones sélectionnées (lettre, coins en px photo, cotes)
 *   - fiche_vt.jpg  : la photo
 * Le plugin InDesign « Importer depuis GraphiDesk » consomme ces fichiers
 * pour placer la photo dans le gabarit et générer les flèches natives.
 */
export function FicheVtExportButton() {
  const [showDialog, setShowDialog] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [ficheName, setFicheName] = useState("");
  const [busy, setBusy] = useState(false);
  const zones = useMeasureDoc((s) => s.zones);

  const toggleExcluded = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    const s = useMeasureDoc.getState();
    const selected = s.zones.filter((z) => !excluded.has(z.id));
    if (selected.length === 0) {
      toast.error("Aucune zone sélectionnée");
      return;
    }
    setShowDialog(false);
    setBusy(true);
    try {
      const imageName = useMeasureImage.getState().image?.name ?? "photo";
      const projet = ficheName.trim() || imageName.replace(/\.[^.]+$/, "");
      await exportFicheVt(selected, projet);
      toast.success(
        `Fiche VT exportée (${selected.length} zone(s)) — dans InDesign : panneau Cotes BAT → « Importer depuis GraphiDesk »`,
        { duration: 9000 }
      );
    } catch (err) {
      toast.error(`Export fiche VT : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  if (zones.length === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        className="gap-1.5 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20"
        onClick={() => setShowDialog(true)}
        title="Exporte la photo + les zones pour générer la fiche « Dimensions à prendre » dans le gabarit InDesign"
      >
        <ClipboardList className="h-4 w-4" />
        Fiche VT (InDesign)
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <ClipboardList className="h-5 w-5 text-sky-500" />
              Dimensions à demander au poseur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <label
              htmlFor="fiche-vt-name"
              className="text-sm font-medium dark:text-slate-200"
            >
              Nom de la fiche
            </label>
            <input
              id="fiche-vt-name"
              type="text"
              value={ficheName}
              onChange={(e) => setFicheName(e.target.value)}
              placeholder="ex. AXIAL Bonaparte"
              className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              C'est ce nom que tu retrouveras dans le volet du plugin InDesign.
            </p>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {zones.map((z) => (
              <label
                key={z.id}
                className="flex items-center gap-3 rounded p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <input
                  type="checkbox"
                  checked={!excluded.has(z.id)}
                  onChange={() => toggleExcluded(z.id)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm dark:text-slate-200">{z.label}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono ml-auto">
                  {formatDims(z.widthMm, z.heightMm)}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Chaque zone cochée devient une flèche lettrée sur la fiche « Dimensions à prendre »
            du gabarit VT. Les lettres correspondent aux zones pour la saisie au retour.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleExport} className="bg-sky-600 hover:bg-sky-700">
              Exporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
