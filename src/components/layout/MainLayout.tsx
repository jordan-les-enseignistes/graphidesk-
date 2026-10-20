import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { UnauthorizedDialog } from "@/components/shared/UnauthorizedDialog";
import { ROUTES } from "@/lib/constants";
import VerifFab from "@/pages/VerifFab";
import { useEntretienCacheVerifizy } from "@/hooks/useEntretienCacheVerifizy";

export function MainLayout() {
  const { pathname } = useLocation();
  useEntretienCacheVerifizy();
  const surVerifizy = pathname === ROUTES.VERIF_FAB;
  // VérifIzy reste monté une fois ouvert : une analyse continue pendant qu'on va ailleurs
  const [verifizyOuvert, setVerifizyOuvert] = useState(surVerifizy);
  if (surVerifizy && !verifizyOuvert) setVerifizyOuvert(true);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 dark:bg-slate-900">
          {!surVerifizy && <Outlet />}
          {verifizyOuvert && (
            <div className={surVerifizy ? "contents" : "hidden"}>
              <VerifFab actif={surVerifizy} />
            </div>
          )}
        </main>
      </div>

      {/* Modale d'action non autorisée (globale) */}
      <UnauthorizedDialog />
    </div>
  );
}
