import { useState } from "react";
import { useAddBat, useDossierBats, useDeleteBat } from "@/hooks/useBats";
import { useUpdateDossier } from "@/hooks/useDossiers";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Plus, ChevronDown, Trash2, FileCheck, Clock, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BatCellProps {
  dossierId: string;
  batCount: number;
  dernierBat: string | null;
  dossierNom?: string;
  currentStatut?: string;
  currentCommentaires?: string | null;
}

export function BatCell({
  dossierId,
  batCount,
  dernierBat,
  dossierNom,
  currentStatut,
  currentCommentaires,
}: BatCellProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showPostBatModal, setShowPostBatModal] = useState(false);
  const [changeStatut, setChangeStatut] = useState(true);
  const [newComment, setNewComment] = useState("");

  const addBat = useAddBat();
  const deleteBat = useDeleteBat();
  const updateDossier = useUpdateDossier();
  const { data: bats, isLoading: loadingBats } = useDossierBats(showHistory ? dossierId : "");

  const handleAddBat = async (e?: React.MouseEvent, fromModal?: boolean) => {
    e?.stopPropagation();

    try {
      // Calculer le numéro du nouveau BAT
      const newBatNumber = batCount + 1;

      // Ajouter le BAT
      await addBat.mutateAsync({ dossierId });

      // Ajouter automatiquement un commentaire avec l'horodatage et la version du BAT
      const today = new Date().toLocaleDateString("fr-FR");
      const autoComment = `[${today}] BAT V${newBatNumber} envoyé`;

      // Récupérer les commentaires actuels depuis la base
      const { data: freshDossier, error: fetchError } = await supabase
        .from("dossiers")
        .select("commentaires")
        .eq("id", dossierId)
        .single();

      if (fetchError) {
        console.error("Erreur récupération commentaires:", fetchError);
      }

      const existingComments = freshDossier?.commentaires || "";
      const updatedComments = existingComments
        ? `${existingComments}\n${autoComment}`
        : autoComment;

      await updateDossier.mutateAsync({
        id: dossierId,
        data: { commentaires: updatedComments }
      });

      // Ouvrir la modale après ajout du BAT (seulement si appelé depuis le bouton, pas depuis la modale)
      if (!fromModal) {
        setShowPostBatModal(true);
        setChangeStatut(true);
        setNewComment("");
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du BAT:", error);
      // Le BAT a peut-être été ajouté mais pas le commentaire
      // On affiche quand même la modale pour que l'utilisateur puisse réessayer
      if (!fromModal) {
        setShowPostBatModal(true);
        setChangeStatut(true);
        setNewComment("");
      }
    }
  };

  const handlePostBatConfirm = async () => {
    const updates: { statut?: string; commentaires?: string } = {};

    if (changeStatut) {
      updates.statut = "Attente R.";
    }

    // Ajouter une note supplémentaire si l'utilisateur en a saisi une
    if (newComment.trim()) {
      // Récupérer les commentaires actuels FRAIS depuis la base (pour ne pas écraser)
      const { data: freshDossier } = await supabase
        .from("dossiers")
        .select("commentaires")
        .eq("id", dossierId)
        .single();

      const existingComments = freshDossier?.commentaires || "";

      // Ajouter la note additionnelle (le commentaire auto BAT est déjà ajouté)
      const today = new Date().toLocaleDateString("fr-FR");
      const commentToAdd = `[${today}] Note: ${newComment.trim()}`;
      updates.commentaires = existingComments
        ? `${existingComments}\n${commentToAdd}`
        : commentToAdd;
    }

    if (Object.keys(updates).length > 0) {
      await updateDossier.mutateAsync({ id: dossierId, data: updates });
    }

    setShowPostBatModal(false);
    setNewComment("");
  };

  const handleDeleteBat = async () => {
    if (deleteConfirm) {
      await deleteBat.mutateAsync({ batId: deleteConfirm, dossierId });
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Affichage du compteur et date */}
        <button
          onClick={() => batCount > 0 && setShowHistory(true)}
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors ${
            batCount > 0
              ? "hover:bg-gray-100 cursor-pointer"
              : "cursor-default"
          }`}
          disabled={batCount === 0}
          title={batCount > 0 ? "Voir l'historique des BATs" : "Aucun BAT envoyé"}
        >
          <FileCheck className={`h-4 w-4 ${batCount > 0 ? "text-green-600" : "text-gray-300"}`} />
          <span className={`font-medium ${batCount > 0 ? "text-green-700" : "text-gray-400"}`}>
            {batCount}
          </span>
        </button>

        {/* Bouton +1 BAT */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={handleAddBat}
          disabled={addBat.isPending}
          title="Ajouter un BAT"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Modal historique des BATs */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              Historique des BATs ({batCount})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {loadingBats ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              </div>
            ) : bats?.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Aucun BAT enregistré</p>
            ) : (
              bats?.map((bat, index) => (
                <div
                  key={bat.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-700">
                      {batCount - index}
                    </span>
                    <div>
                      <p className="font-medium">{formatDateTime(bat.date_envoi)}</p>
                      <p className="text-xs text-gray-500">
                        BAT n°{batCount - index}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(bat.id)}
                    title="Supprimer ce BAT"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              onClick={async () => {
                setShowHistory(false);
                await handleAddBat(undefined, false);
              }}
              disabled={addBat.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un BAT
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression BAT */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Supprimer ce BAT"
        description="Êtes-vous sûr de vouloir supprimer ce BAT ? Cette action est irréversible."
        confirmText="Supprimer"
        variant="danger"
        icon="delete"
        onConfirm={handleDeleteBat}
        loading={deleteBat.isPending}
      />

      {/* Modal après ajout de BAT */}
      <Dialog open={showPostBatModal} onOpenChange={setShowPostBatModal}>
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !updateDossier.isPending) {
              e.preventDefault();
              handlePostBatConfirm();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              BAT envoyé !
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Le BAT a été ajouté{dossierNom ? ` pour "${dossierNom}"` : ""}.
              Souhaitez-vous mettre à jour le dossier ?
            </p>

            {/* Option changer le statut */}
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={changeStatut}
                onChange={(e) => setChangeStatut(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">
                  Passer le statut en "Attente R."
                </span>
              </div>
              {currentStatut === "Attente R." && (
                <span className="text-xs text-gray-400 ml-auto">(déjà en attente)</span>
              )}
            </label>

            {/* Ajouter un commentaire */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MessageSquare className="h-4 w-4" />
                Ajouter une note (optionnel)
              </label>
              <Textarea
                placeholder="Ex: BAT envoyé par email au client..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-gray-400">
                Cette note sera ajoutée aux commentaires existants
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowPostBatModal(false)}
            >
              Ignorer
            </Button>
            <Button
              onClick={handlePostBatConfirm}
              disabled={updateDossier.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateDossier.isPending ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
