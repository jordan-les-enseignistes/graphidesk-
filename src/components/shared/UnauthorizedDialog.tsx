import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ShieldX, X } from "lucide-react";
import { useUnauthorizedStore } from "@/stores/unauthorizedStore";

export function UnauthorizedDialog() {
  const { isOpen, hide } = useUnauthorizedStore();

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 animate-fade-in"
        onClick={hide}
      />
      {/* Modal */}
      <div
        className="fixed left-[50%] top-[50%] z-[101] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-gray-200 bg-white p-6 shadow-lg animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={hide}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fermer</span>
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Action non autorisée
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Cette action est réservée à l'administrateur.
            </p>
          </div>
        </div>

        <div className="flex justify-center mt-6">
          <Button onClick={hide}>
            Compris
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
