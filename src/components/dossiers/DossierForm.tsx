import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useStatuts } from "@/hooks/useStatuts";
import { useCreateDossier, useUpdateDossier } from "@/hooks/useDossiers";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuthStore } from "@/stores/authStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import type { Dossier } from "@/types";
import { getFirstName } from "@/lib/utils";

interface DossierFormData {
  nom: string;
  deadline_premiere_reponse: string;
  statut: string;
  commentaires: string;
  graphiste_id: string;
}

interface DossierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier?: Dossier | null;
  mode?: "create" | "edit";
}

export function DossierForm({
  open,
  onOpenChange,
  dossier,
  mode = "create",
}: DossierFormProps) {
  const profile = useAuthStore((state) => state.profile);
  const { isAdmin } = useEffectiveRole();
  const { data: profiles } = useProfiles();
  const { data: statuts } = useStatuts();

  const createDossier = useCreateDossier();
  const updateDossier = useUpdateDossier();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DossierFormData>({
    defaultValues: {
      nom: dossier?.nom ?? "",
      deadline_premiere_reponse: dossier?.deadline_premiere_reponse ?? "",
      statut: dossier?.statut ?? "A faire",
      commentaires: dossier?.commentaires ?? "",
      graphiste_id: dossier?.graphiste_id ?? profile?.id ?? "",
    },
  });

  const onSubmit = async (data: DossierFormData) => {
    try {
      const payload = {
        nom: data.nom,
        deadline_premiere_reponse: data.deadline_premiere_reponse || null,
        statut: data.statut || "A faire",
        commentaires: data.commentaires || null,
        graphiste_id: data.graphiste_id || profile?.id,
      };

      if (mode === "edit" && dossier) {
        await updateDossier.mutateAsync({ id: dossier.id, data: payload });
      } else {
        await createDossier.mutateAsync(payload);
      }

      reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur soumission:", error);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const statutOptions = statuts?.map((s) => ({ value: s.value, label: s.label })) || [];
  const graphisteOptions = (profiles ?? []).map((p) => ({
    value: p.id,
    label: `${getFirstName(p.full_name)} (${p.initials})`,
  }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Modifier le dossier" : "Nouveau dossier"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">
              Nom du dossier <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nom"
              placeholder="Ex: Anacours - Enseigne Lyon"
              {...register("nom", { required: "Le nom est requis" })}
              className={errors.nom ? "border-red-500" : ""}
            />
            {errors.nom && (
              <p className="text-sm text-red-500">{errors.nom.message}</p>
            )}
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="graphiste_id">Graphiste assigné</Label>
              <Select
                id="graphiste_id"
                options={graphisteOptions}
                {...register("graphiste_id")}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="deadline_premiere_reponse">
              Deadline première réponse
            </Label>
            <Input
              id="deadline_premiere_reponse"
              type="date"
              {...register("deadline_premiere_reponse")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="statut">Statut</Label>
            <Select
              id="statut"
              options={statutOptions}
              {...register("statut")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commentaires">Commentaires</Label>
            <Textarea
              id="commentaires"
              placeholder="Notes sur l'avancement du dossier..."
              rows={4}
              {...register("commentaires")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Enregistrement..."
                : mode === "edit"
                ? "Enregistrer"
                : "Créer le dossier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
