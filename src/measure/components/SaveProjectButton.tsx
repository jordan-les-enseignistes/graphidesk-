import { useState } from "react";
import { toast } from "sonner";
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
import { Save } from "lucide-react";
import { useMeasureDoc } from "../state/store";
import { getOffscreenCanvas } from "../engine/offscreen";
import { saveProject } from "../persistence/projects";
import { exportFicheVt } from "../engine/ficheVt";
import { formatDims } from "../engine/zones";

interface SaveProjectButtonProps {
  /** Appelé après une sauvegarde réussie ; reset=true si l'utilisateur veut vider la page */
  onSaved: (reset: boolean) => void;
}

export function SaveProjectButton({ onSaved }: SaveProjectButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [nom, setNom] = useState("");
  // décoché par défaut : on garde la page en l'état pour pouvoir encore
  // exporter la fiche VT / le PSD après la sauvegarde
  const [resetAfter, setResetAfter] = useState(false);
  // le même geste exporte la fiche VT InDesign (même nom de projet)
  const [withFiche, setWithFiche] = useState(true);
  const [ficheExcluded, setFicheExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const zones = useMeasureDoc((s) => s.zones);

  const toggleFicheExcluded = (id: string) => {
    setFicheExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!nom.trim()) {
      toast.error("Donne un nom au projet");
      return;
    }
    const photo = getOffscreenCanvas();
    if (!photo) {
      toast.error("Photo non disponible");
      return;
    }
    setBusy(true);
    try {
      await saveProject(nom.trim(), null, useMeasureDoc.getState(), photo);
      let ficheMsg = "";
      if (withFiche) {
        const selected = zones.filter((z) => !ficheExcluded.has(z.id));
        try {
          await exportFicheVt(selected, nom.trim());
          ficheMsg = ` Fiche VT exportée (${selected.length} zone(s)) — panneau Cotes BAT dans InDesign.`;
        } catch (err) {
          toast.error(`Fiche VT non exportée : ${String(err)}`);
        }
      }
      setShowDialog(false);
      setNom("");
      toast.success(
        `Projet "${nom.trim()}" sauvegardé — en attente de visite technique.${ficheMsg}`,
        { duration: 8000 }
      );
      onSaved(resetAfter);
    } catch (err) {
      toast.error(`Sauvegarde impossible : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || zones.length === 0}
        className="gap-1.5 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
        onClick={() => setShowDialog(true)}
        title={
          zones.length === 0
            ? "Mesure au moins une zone avant de sauvegarder"
            : "Sauvegarde le projet (photo + zones + calibration) pour finaliser la maquette après la visite technique"
        }
      >
        {busy ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-600 border-t-transparent" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Sauvegarder → attente de VT
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy && nom.trim()) {
              e.preventDefault();
              handleSave();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Save className="h-5 w-5 text-emerald-500" />
              Sauvegarder le projet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="proj-nom">Nom du projet *</Label>
            <Input
              id="proj-nom"
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Boulangerie Kerlann — devanture"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              La photo (compressée), la calibration, les zones et leurs marquages vitrage sont
              sauvegardés.
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={withFiche}
                onChange={(e) => setWithFiche(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm dark:text-slate-200">
                Exporter la fiche VT pour InDesign (même nom)
              </span>
            </label>
            {withFiche && (
              <div className="ml-6 space-y-1 max-h-44 overflow-y-auto rounded border border-gray-200 dark:border-slate-700 p-1.5">
                {zones.map((z) => (
                  <label
                    key={z.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <input
                      type="checkbox"
                      checked={!ficheExcluded.has(z.id)}
                      onChange={() => toggleFicheExcluded(z.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs dark:text-slate-200">{z.label}</span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400 font-mono ml-auto">
                      {formatDims(z.widthMm, z.heightMm)}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={resetAfter}
                onChange={(e) => setResetAfter(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm dark:text-slate-200">
                Remettre la page Mesure à zéro après la sauvegarde
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={busy || !nom.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {busy ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
