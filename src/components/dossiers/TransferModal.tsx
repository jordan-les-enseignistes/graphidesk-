import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useTransferDossier } from "@/hooks/useDossiers";
import { useProfiles } from "@/hooks/useProfiles";
import type { DossierWithGraphiste } from "@/types";
import { Send } from "lucide-react";
import { getFirstName } from "@/lib/utils";

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: DossierWithGraphiste | null;
}

export function TransferModal({
  open,
  onOpenChange,
  dossier,
}: TransferModalProps) {
  const { data: profiles } = useProfiles();
  const transferDossier = useTransferDossier();

  const [selectedGraphiste, setSelectedGraphiste] = useState("");
  const [reason, setReason] = useState("");

  const handleTransfer = async () => {
    if (!dossier || !selectedGraphiste) return;

    await transferDossier.mutateAsync({
      dossierId: dossier.id,
      newGraphisteId: selectedGraphiste,
      reason: reason || undefined,
    });

    setSelectedGraphiste("");
    setReason("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedGraphiste("");
    setReason("");
    onOpenChange(false);
  };

  // Exclure le graphiste actuel de la liste
  const availableGraphistes = (profiles ?? [])
    .filter((p) => p.id !== dossier?.graphiste_id)
    .map((p) => ({
      value: p.id,
      label: `${getFirstName(p.full_name)} (${p.initials})`,
    }));

  if (!dossier) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transférer le dossier
          </DialogTitle>
          <DialogDescription>
            Transférer ce dossier à un autre graphiste
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-900">{dossier.nom}</p>
            <p className="text-xs text-gray-500">
              Actuellement assigné à : {getFirstName(dossier.graphiste?.full_name)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-graphiste">Transférer à</Label>
            <Select
              id="new-graphiste"
              options={availableGraphistes}
              placeholder="Sélectionner un graphiste"
              value={selectedGraphiste}
              onChange={(e) => setSelectedGraphiste(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Raison (optionnel)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Congés, surcharge de travail..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedGraphiste || transferDossier.isPending}
          >
            {transferDossier.isPending ? "Transfert..." : "Transférer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
