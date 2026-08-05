// Demande au graphiste les coordonnées qui doivent figurer sur les BAT, juste
// avant de lui livrer un gabarit ou un dossier de chantier.
//
// ⚠ Les champs sont PRÉ-REMPLIS depuis le profil mais restent libres : Jordan
// prépare parfois un dossier pour quelqu'un d'autre. On propose, on n'impose
// pas — et on ne déduit jamais le nom à partir du profil sans le montrer.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPen } from "lucide-react";

export interface CoordonneesBat {
  nomComplet: string;
  prenom: string;
  nom: string;
  mail: string;
}

export function CoordonneesBatDialog({
  ouvert,
  defaut,
  reference,
  onValider,
  onAnnuler,
}: {
  ouvert: boolean;
  defaut: CoordonneesBat;
  /** Formes présentes dans les gabarits, celles qui vont être remplacées */
  reference: Record<keyof CoordonneesBat, string[]> | null;
  onValider: (c: CoordonneesBat) => void;
  onAnnuler: () => void;
}) {
  const [val, setVal] = useState<CoordonneesBat>(defaut);

  useEffect(() => {
    if (ouvert) setVal(defaut);
  }, [ouvert, defaut]);

  if (!ouvert) return null;

  const champ = (
    cle: keyof CoordonneesBat,
    label: string,
    placeholder: string,
    type = "text"
  ) => (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type={type}
        value={val[cle]}
        placeholder={placeholder}
        onChange={(e) => setVal({ ...val, [cle]: e.target.value })}
        className="mt-1 w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm dark:text-slate-100"
      />
      {!!reference?.[cle]?.length && (
        <span className="text-[11px] text-slate-400">
          remplace {reference[cle].map((v) => `« ${v} »`).join(" et ")}
        </span>
      )}
    </label>
  );

  const complet = val.nomComplet.trim() && val.mail.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15">
            <UserPen className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
          </span>
          <div>
            <h3 className="font-semibold dark:text-slate-100">Tes coordonnées sur les BAT</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              GraphiDesk va mettre les gabarits à ce nom. Seuls le nom et l'e-mail changent — les
              coordonnées des commerciaux restent intactes.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {champ("nomComplet", "Nom complet, tel qu'il doit s'afficher", "Camille MARTIN")}
          <div className="grid grid-cols-2 gap-3">
            {champ("prenom", "Prénom seul", "Camille")}
            {champ("nom", "Nom seul", "MARTIN")}
          </div>
          {champ("mail", "Adresse e-mail", "camille@les-enseignistes.fr", "email")}
        </div>

        <p className="text-[11px] text-slate-400">
          Le prénom et le nom seuls servent aux endroits du gabarit où ils apparaissent séparément.
          Laisse vide ce qui ne s'applique pas.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onAnnuler}>
            Annuler
          </Button>
          <Button size="sm" disabled={!complet} onClick={() => onValider(val)}>
            Continuer
          </Button>
        </div>
      </Card>
    </div>
  );
}
