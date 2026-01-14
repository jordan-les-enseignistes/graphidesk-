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
import { useBulkTransfer } from "@/hooks/useDossiers";
import { useProfiles } from "@/hooks/useProfiles";
import { Send } from "lucide-react";
import { getFirstName } from "@/lib/utils";

interface BulkTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}

export function BulkTransferModal({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkTransferModalProps) {
  const { data: profiles } = useProfiles();
  const bulkTransfer = useBulkTransfer();

  const [selectedGraphiste, setSelectedGraphiste] = useState("");
  const [reason, setReason] = useState("");

  const handleTransfer = async () => {
    if (selectedIds.length === 0 || !selectedGraphiste) return;

    await bulkTransfer.mutateAsync({
      ids: selectedIds,
      newGraphisteId: selectedGraphiste,
      reason: reason || undefined,
    });

    setSelectedGraphiste("");
    setReason("");
    onOpenChange(false);
    onSuccess();
  };

  const handleClose = () => {
    setSelectedGraphiste("");
    setReason("");
    onOpenChange(false);
  };

  const availableGraphistes = (profiles ?? []).map((p) => ({
    value: p.id,
    label: `${getFirstName(p.full_name)} (${p.initials})`,
  }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transférer les dossiers
          </DialogTitle>
          <DialogDescription>
            Transférer {selectedIds.length} dossier(s) à un autre graphiste
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-gray-50 dark:bg-slate-700/50 p-3">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {selectedIds.length} dossier(s) sélectionné(s)
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
            disabled={!selectedGraphiste || bulkTransfer.isPending}
          >
            {bulkTransfer.isPending ? "Transfert..." : "Transférer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
