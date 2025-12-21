import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useProfiles } from "@/hooks/useProfiles";
import { getFirstName } from "@/lib/utils";
import {
  useCreateConges,
  useDeleteConges,
  formatDateToString,
  type TypeConge,
  type CongeAvecPrenom,
} from "@/hooks/usePlanningVacances";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Palmtree, Trash2, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CongeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  existingConges: CongeAvecPrenom[];
}

export function CongeModal({
  isOpen,
  onClose,
  selectedDate,
  existingConges,
}: CongeModalProps) {
  const profile = useAuthStore((state) => state.profile);
  const { isAdmin } = useEffectiveRole();

  const { data: profiles } = useProfiles();
  const createConges = useCreateConges();
  const deleteConges = useDeleteConges();

  // États du formulaire
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [typeConge, setTypeConge] = useState<TypeConge>("conge");

  // Initialiser les valeurs quand la modale s'ouvre
  useEffect(() => {
    if (isOpen && selectedDate) {
      const dateStr = formatDateToString(selectedDate);
      setDateDebut(dateStr);
      setDateFin(dateStr);
      setSelectedUserId(profile?.id || "");
      setTypeConge("conge");
    }
  }, [isOpen, selectedDate, profile?.id]);

  const handleSubmit = async () => {
    if (!selectedUserId || !dateDebut || !dateFin) return;

    await createConges.mutateAsync({
      userId: selectedUserId,
      dateDebut,
      dateFin,
      typeConge,
    });

    onClose();
  };

  const handleDelete = async (userId: string) => {
    if (!selectedDate) return;

    const dateStr = formatDateToString(selectedDate);
    await deleteConges.mutateAsync({
      userId,
      dateDebut: dateStr,
      dateFin: dateStr,
    });
  };

  // Vérifier si l'utilisateur peut modifier un congé
  const canModifyConge = (congeUserId: string) => {
    return isAdmin || congeUserId === profile?.id;
  };

  // Label pour le type de congé
  const getTypeLabel = (type: TypeConge) => {
    switch (type) {
      case "conge":
        return "Journée complète";
      case "conge_matin":
        return "Matin";
      case "conge_aprem":
        return "Après-midi";
    }
  };

  if (!selectedDate) return null;

  const formattedDate = selectedDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Options pour le select des graphistes
  const graphisteOptions = profiles?.map((p) => ({
    value: p.id,
    label: getFirstName(p.full_name),
  })) || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palmtree className="h-5 w-5 text-emerald-600" />
            Gérer les congés
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date sélectionnée */}
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <span className="font-medium capitalize">{formattedDate}</span>
          </div>

          {/* Congés existants ce jour */}
          {existingConges.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Congés ce jour</Label>
              <div className="space-y-2">
                {existingConges.map((conge) => (
                  <div
                    key={conge.userId}
                    className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Palmtree className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">
                        {conge.prenom}
                      </span>
                      <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                        {getTypeLabel(conge.type)}
                      </span>
                    </div>
                    {canModifyConge(conge.userId) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(conge.userId)}
                        disabled={deleteConges.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulaire d'ajout */}
          <div className="border-t pt-4 space-y-4">
            <Label className="text-sm font-medium">Ajouter un congé</Label>

            {/* Sélection utilisateur (admin only) */}
            {isAdmin && profiles && (
              <div className="space-y-2">
                <Label htmlFor="user" className="text-sm">
                  Graphiste
                </Label>
                <Select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  options={graphisteOptions}
                  placeholder="Sélectionner un graphiste"
                />
              </div>
            )}

            {/* Type de congé */}
            <div className="space-y-2">
              <Label className="text-sm">Type de congé</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTypeConge("conge")}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors",
                    typeConge === "conge"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Palmtree className="h-5 w-5" />
                  <span className="text-xs font-medium">Journée</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTypeConge("conge_matin")}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors",
                    typeConge === "conge_matin"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Sun className="h-5 w-5" />
                  <span className="text-xs font-medium">Matin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTypeConge("conge_aprem")}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors",
                    typeConge === "conge_aprem"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Moon className="h-5 w-5" />
                  <span className="text-xs font-medium">Après-midi</span>
                </button>
              </div>
            </div>

            {/* Période */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateDebut" className="text-sm">
                  Du
                </Label>
                <Input
                  id="dateDebut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFin" className="text-sm">
                  Au
                </Label>
                <Input
                  id="dateFin"
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  min={dateDebut}
                />
              </div>
            </div>

            {/* Note sur les weekends */}
            <p className="text-xs text-gray-500 italic">
              Les weekends sont automatiquement exclus.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createConges.isPending || !selectedUserId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {createConges.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
