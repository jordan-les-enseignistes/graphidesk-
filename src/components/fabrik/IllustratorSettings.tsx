import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, FolderOpen, Settings } from "lucide-react";
import { DEFAULT_ILLUSTRATOR_PATH } from "./types";

interface IllustratorSettingsProps {
  path: string;
  onPathChange: (path: string) => void;
  onValidate: () => void;
  isValid: boolean | null;
}

export function IllustratorSettings({
  path,
  onPathChange,
  onValidate,
  isValid,
}: IllustratorSettingsProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-slate-600" />
        <h4 className="font-medium">Configuration Adobe Illustrator</h4>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="illustratorPath" className="text-sm">
            Chemin vers Illustrator.exe
          </Label>
          <div className="flex gap-2">
            <Input
              id="illustratorPath"
              type="text"
              value={path}
              onChange={(e) => onPathChange(e.target.value)}
              placeholder={DEFAULT_ILLUSTRATOR_PATH}
              className={`flex-1 font-mono text-sm ${
                isValid === true
                  ? "border-green-500"
                  : isValid === false
                  ? "border-red-500"
                  : ""
              }`}
            />
            <Button type="button" variant="outline" onClick={onValidate}>
              Vérifier
            </Button>
          </div>
        </div>

        {/* Status */}
        {isValid !== null && (
          <div
            className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
              isValid
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {isValid ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Illustrator trouvé à cet emplacement
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                Illustrator non trouvé à cet emplacement
              </>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg space-y-2">
          <p className="font-medium text-slate-700">Comment trouver le chemin :</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Ouvrez l'Explorateur Windows</li>
            <li>
              Naviguez vers{" "}
              <code className="bg-slate-200 px-1 rounded">C:\Program Files\Adobe\</code>
            </li>
            <li>
              Trouvez le dossier <code className="bg-slate-200 px-1 rounded">Adobe Illustrator 20XX</code>
            </li>
            <li>
              Le chemin complet sera similaire à :<br />
              <code className="bg-slate-200 px-1 rounded text-[10px] block mt-1">
                C:\Program Files\Adobe\Adobe Illustrator 2027\Support Files\Contents\Windows\Illustrator.exe
              </code>
            </li>
          </ol>
          <p className="mt-2 text-amber-600">
            <strong>Note :</strong> Le numéro d'année (2026, 2027, etc.) change à chaque mise à jour d'Adobe.
            Mettez à jour ce chemin après chaque mise à jour majeure.
          </p>
        </div>
      </div>
    </Card>
  );
}
