import { Button } from "@/components/ui/button";
import { Maximize, ImagePlus, Undo2, Redo2, RotateCcw } from "lucide-react";
import { useMeasureView, useMeasureImage, undoDoc, redoDoc } from "../state/store";
import { SaveProjectButton } from "./SaveProjectButton";
import { FicheVtExportButton } from "./FicheVtExportButton";
import type { Pt } from "../state/types";

interface ToolbarProps {
  cursorPos: Pt | null;
  onLoadNewImage: () => void;
  onReset: () => void;
  /** Après sauvegarde d'un projet ; reset=true si l'utilisateur veut vider la page */
  onProjectSaved: (reset: boolean) => void;
}

export function Toolbar({ cursorPos, onLoadNewImage, onReset, onProjectSaved }: ToolbarProps) {
  const scale = useMeasureView((s) => s.scale);
  const requestFit = useMeasureView((s) => s.requestFit);
  const image = useMeasureImage((s) => s.image);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={onLoadNewImage} className="gap-1.5">
        <ImagePlus className="h-4 w-4" />
        Nouvelle image
      </Button>
      <Button variant="outline" size="sm" onClick={requestFit} className="gap-1.5" title="Ajuster à la vue">
        <Maximize className="h-4 w-4" />
        Ajuster
      </Button>
      <Button variant="outline" size="sm" onClick={undoDoc} className="gap-1.5" title="Annuler (Ctrl+Z)">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={redoDoc} className="gap-1.5" title="Rétablir (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        className="gap-1.5 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
        title="Tout remettre à zéro (photo + zones + calibration)"
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
      <SaveProjectButton onSaved={onProjectSaved} />
      <FicheVtExportButton />

      <div className="ml-auto flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 font-mono">
        <span>Zoom : {(scale * 100).toFixed(0)}%</span>
        {image && (
          <span>
            Image : {image.width}×{image.height}px
          </span>
        )}
        <span className="min-w-[130px]">
          {cursorPos ? `x:${cursorPos.x} y:${cursorPos.y}` : "—"}
        </span>
      </div>
    </div>
  );
}
