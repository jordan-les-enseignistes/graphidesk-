import { useState } from "react";
import { useUpdateDossier } from "@/hooks/useDossiers";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PhoneCall, Mail, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface RelanceCellProps {
  dossierId: string;
  dossierNom?: string;
}

export function RelanceCell({ dossierId, dossierNom }: RelanceCellProps) {
  const [showModal, setShowModal] = useState(false);
  const [relanceMail, setRelanceMail] = useState(false);
  const [relanceTel, setRelanceTel] = useState(false);
  const [comment, setComment] = useState("");

  const updateDossier = useUpdateDossier();

  const handleOpenModal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowModal(true);
    setRelanceMail(false);
    setRelanceTel(false);
    setComment("");
  };

  const handleConfirm = async () => {
    // Vérifier qu'au moins un type de relance est sélectionné
    if (!relanceMail && !relanceTel) {
      return;
    }

    // Construire le type de relance
    const relanceTypes: string[] = [];
    if (relanceMail) relanceTypes.push("mail");
    if (relanceTel) relanceTypes.push("téléphonique");
    const relanceType = relanceTypes.join(" + ");

    // Construire le commentaire auto
    const today = new Date().toLocaleDateString("fr-FR");
    let autoComment = `[${today}] Relance ${relanceType}`;

    // Ajouter le commentaire utilisateur s'il y en a un
    if (comment.trim()) {
      autoComment += ` - ${comment.trim()}`;
    }

    // Récupérer les commentaires actuels depuis la base
    const { data: freshDossier } = await supabase
      .from("dossiers")
      .select("commentaires")
      .eq("id", dossierId)
      .single();

    const existingComments = freshDossier?.commentaires || "";
    const updatedComments = existingComments
      ? `${existingComments}\n${autoComment}`
      : autoComment;

    // Mettre à jour le dossier (ça met aussi à jour updated_at, ce qui remet le compteur à 0)
    await updateDossier.mutateAsync({
      id: dossierId,
      data: { commentaires: updatedComments }
    });

    setShowModal(false);
  };

  const canConfirm = relanceMail || relanceTel;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/30"
        onClick={handleOpenModal}
        title="Enregistrer une relance client"
      >
        <PhoneCall className="h-4 w-4" />
      </Button>

      {/* Modal de relance */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canConfirm && !updateDossier.isPending) {
              e.preventDefault();
              handleConfirm();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-orange-600" />
              Enregistrer une relance
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {dossierNom && (
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Dossier : <span className="font-medium">{dossierNom}</span>
              </p>
            )}

            {/* Type de relance */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                Type de relance <span className="text-red-500">*</span>
              </p>
              <div className="flex gap-3">
                <label
                  className={`flex-1 flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                    relanceMail
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30"
                      : "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={relanceMail}
                    onChange={(e) => setRelanceMail(e.target.checked)}
                    className="sr-only"
                  />
                  <Mail className={`h-5 w-5 ${relanceMail ? "text-orange-600" : "text-gray-400 dark:text-slate-500"}`} />
                  <span className={`text-sm font-medium ${relanceMail ? "text-orange-800 dark:text-orange-300" : "text-gray-600 dark:text-slate-300"}`}>
                    Mail
                  </span>
                </label>

                <label
                  className={`flex-1 flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                    relanceTel
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30"
                      : "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={relanceTel}
                    onChange={(e) => setRelanceTel(e.target.checked)}
                    className="sr-only"
                  />
                  <Phone className={`h-5 w-5 ${relanceTel ? "text-orange-600" : "text-gray-400 dark:text-slate-500"}`} />
                  <span className={`text-sm font-medium ${relanceTel ? "text-orange-800 dark:text-orange-300" : "text-gray-600 dark:text-slate-300"}`}>
                    Téléphone
                  </span>
                </label>
              </div>
              {!canConfirm && (
                <p className="text-xs text-red-500">
                  Sélectionnez au moins un type de relance
                </p>
              )}
            </div>

            {/* Commentaire optionnel */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                Commentaire (optionnel)
              </label>
              <Textarea
                placeholder="Ex: Client absent, rappeler demain..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Sera ajouté à la suite du type de relance
              </p>
            </div>

            {/* Aperçu */}
            {canConfirm && (
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Aperçu du commentaire :</p>
                <p className="text-sm text-gray-700 dark:text-slate-200">
                  [{new Date().toLocaleDateString("fr-FR")}] Relance {relanceMail && relanceTel ? "mail + téléphonique" : relanceMail ? "mail" : "téléphonique"}
                  {comment.trim() && ` - ${comment.trim()}`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || updateDossier.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {updateDossier.isPending ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
