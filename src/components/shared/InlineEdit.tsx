import { useState, useRef, useEffect } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Edit } from "lucide-react";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  type?: "text" | "date" | "textarea";
  className?: string;
  placeholder?: string;
  displayValue?: string; // Valeur formatée à afficher (optionnel)
}

export function InlineEdit({ value, onSave, type = "text", className, placeholder, displayValue }: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type !== "date") {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Pour textarea: Entrée seule sauvegarde, Shift+Entrée fait un retour à la ligne
      if (type === "textarea") {
        if (!e.shiftKey) {
          e.preventDefault();
          handleSave();
        }
        // Shift+Entrée : comportement par défaut (retour à la ligne)
      } else {
        e.preventDefault();
        handleSave();
      }
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  // Formater l'affichage pour les dates
  const getDisplayValue = () => {
    if (displayValue) return displayValue;
    if (type === "date" && value) {
      return formatDate(value);
    }
    // Pour textarea, on affiche le texte complet avec retour à la ligne
    return value;
  };

  if (isEditing) {
    if (type === "textarea") {
      return (
        <div className="flex items-start gap-1">
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[60px] rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={placeholder}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn(
            "rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
            type === "date" ? "w-36" : "w-full"
          )}
          placeholder={placeholder}
        />
      </div>
    );
  }

  const displayText = getDisplayValue();

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "group relative cursor-pointer rounded px-1 py-0.5 text-left transition-colors hover:bg-blue-50",
        type === "textarea" && "whitespace-pre-wrap break-words",
        className
      )}
      title="Cliquer pour modifier"
    >
      {displayText || <span className="text-gray-400 italic">{placeholder || "Cliquer pour ajouter"}</span>}
      <Edit className="absolute -right-4 top-0 h-3 w-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
