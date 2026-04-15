import { useState, useRef } from "react";
import { useUpdateDossier } from "@/hooks/useDossiers";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface NoteAddButtonProps {
  dossierId: string;
}

export function NoteAddButton({ dossierId }: NoteAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateDossier = useUpdateDossier();

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNote("");
    setOpen(true);
  };

  const handleConfirm = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;

    // Récupérer les commentaires actuels FRAIS depuis la base pour éviter les race conditions
    const { data: freshDossier, error: fetchError } = await supabase
      .from("dossiers")
      .select("commentaires")
      .eq("id", dossierId)
      .single();

    if (fetchError) {
      console.error("Erreur récupération commentaires:", fetchError);
    }

    const today = new Date().toLocaleDateString("fr-FR");
    const newLine = `[${today}] Note: ${trimmed}`;
    const existing = freshDossier?.commentaires || "";
    const updated = existing ? `${existing}\n${newLine}` : newLine;

    await updateDossier.mutateAsync({
      id: dossierId,
      data: {
        commentaires: updated,
        has_commentaires: true,
      },
    });

    setOpen(false);
    setNote("");
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        onClick={handleOpen}
        title="Ajouter une note datée"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !updateDossier.isPending && note.trim()) {
              e.preventDefault();
              handleConfirm();
            }
          }}
        >
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 pr-8">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Ajouter une note datée
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              autoFocus
              placeholder="Ex: En attente des côtes clients"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                autoResize();
              }}
              rows={2}
              className="resize-none overflow-hidden min-h-[60px] max-h-[300px]"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              La note sera préfixée par la date du jour et ajoutée aux commentaires existants.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={updateDossier.isPending || !note.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateDossier.isPending ? "Enregistrement..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
