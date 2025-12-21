import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Archive, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  icon?: "delete" | "archive" | "transfer" | "warning";
  onConfirm: () => void;
  loading?: boolean;
}

const iconMap = {
  delete: Trash2,
  archive: Archive,
  transfer: Send,
  warning: AlertTriangle,
};

const variantStyles = {
  danger: {
    icon: "bg-red-100 text-red-600",
    button: "bg-red-600 hover:bg-red-700",
  },
  warning: {
    icon: "bg-yellow-100 text-yellow-600",
    button: "bg-yellow-600 hover:bg-yellow-700",
  },
  info: {
    icon: "bg-blue-100 text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  variant = "danger",
  icon = "warning",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const Icon = iconMap[icon];
  const styles = variantStyles[variant];

  if (!open) return null;

  return createPortal(
    <>
      {/* Overlay avec z-index élevé */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      {/* Modal avec z-index encore plus élevé */}
      <div
        className={cn(
          "fixed left-[50%] top-[50%] z-[101] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-gray-200 bg-white p-6 shadow-lg animate-slide-in"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fermer</span>
        </button>

        <div className="flex flex-col space-y-1.5 text-left">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${styles.icon}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
              <p className="text-sm text-gray-500 mt-2">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            className={styles.button}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Chargement..." : confirmText}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
