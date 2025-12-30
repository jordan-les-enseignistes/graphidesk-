import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import { ROUTES } from "@/lib/constants";
import { LoadingPage } from "@/components/ui/loading";
import { MainLayout } from "@/components/layout/MainLayout";
import { ImportProgressBar } from "@/components/import/ImportProgressBar";
import { UpdateChecker } from "@/components/update/UpdateChecker";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MesDossiers from "@/pages/MesDossiers";
import TousLesDossiers from "@/pages/TousLesDossiers";
import Archives from "@/pages/Archives";
import Franchises from "@/pages/Franchises";
import ProjetsInternes from "@/pages/ProjetsInternes";
import Statistiques from "@/pages/Statistiques";
import HeuresSupplementaires from "@/pages/HeuresSupplementaires";
import MonProfil from "@/pages/MonProfil";
import Utilisateurs from "@/pages/Utilisateurs";
import Parametres from "@/pages/Parametres";
import RapportHeuresSup from "@/pages/RapportHeuresSup";
import PlanningVacances from "@/pages/PlanningVacances";
import SitesInternet from "@/pages/SitesInternet";
import Process from "@/pages/Process";
import Reunions from "@/pages/Reunions";
import RalConverter from "@/pages/RalConverter";
import Feedbacks from "@/pages/Feedbacks";
import Annuaire from "@/pages/Annuaire";
import Recherche from "@/pages/Recherche";
import FabRik from "@/pages/FabRik";
import Calculatrice from "@/pages/Calculatrice";

// Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuthStore();

  if (loading) {
    return <LoadingPage />;
  }

  if (!user || !profile) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <>{children}</>;
}

// Admin Route Component
function AdminRoute({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((state) => state.profile);

  if (profile?.role !== "admin") {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}

// Auth Initializer
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { initialized, setUser, setProfile, setSession, loadProfile, setLoading, setInitialized } =
    useAuthStore();

  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;

    // Fonction pour charger le profil et mettre à jour le state
    const handleSession = async (session: import("@supabase/supabase-js").Session | null) => {
      if (!isMounted) return;

      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (isMounted) {
          setUser(session.user);
          setProfile(profile);
          setSession(session);
        }
      } else {
        setUser(null);
        setProfile(null);
        setSession(null);
      }

      if (isMounted && !hasInitialized) {
        hasInitialized = true;
        setLoading(false);
        setInitialized(true);
      }
    };

    // Écouter les changements d'auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "INITIAL_SESSION") {
        // C'est l'événement initial - on l'utilise pour initialiser
        await handleSession(session);
      } else if (event === "SIGNED_IN" && session?.user) {
        // Connexion manuelle (pas au refresh)
        if (hasInitialized) {
          setLoading(true);
          const profile = await loadProfile(session.user.id);
          if (isMounted) {
            setUser(session.user);
            setProfile(profile);
            setSession(session);
            setLoading(false);
          }
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setSession(null);
      } else if (event === "TOKEN_REFRESHED" && session) {
        setSession(session);
      }
    });

    // Timeout de sécurité si INITIAL_SESSION ne se déclenche pas
    const timeout = setTimeout(() => {
      if (isMounted && !hasInitialized) {
        hasInitialized = true;
        setLoading(false);
        setInitialized(true);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadProfile, setUser, setProfile, setSession, setLoading, setInitialized]);

  if (!initialized) {
    return <LoadingPage />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path={ROUTES.LOGIN} element={<Login />} />
            <Route path="/rapport/:id" element={<RapportHeuresSup />} />

            {/* Protected routes */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
              <Route path={ROUTES.RECHERCHE} element={<Recherche />} />
              <Route path={ROUTES.MES_DOSSIERS} element={<MesDossiers />} />
              <Route
                path={ROUTES.TOUS_LES_DOSSIERS}
                element={
                  <AdminRoute>
                    <TousLesDossiers />
                  </AdminRoute>
                }
              />
              <Route path={ROUTES.ARCHIVES} element={<Archives />} />
              <Route path={ROUTES.FRANCHISES} element={<Franchises />} />
              <Route path={ROUTES.PROJETS_INTERNES} element={<ProjetsInternes />} />
              <Route path={ROUTES.STATISTIQUES} element={<Statistiques />} />
              <Route path={ROUTES.FABRIK} element={<FabRik />} />
              <Route path={ROUTES.HEURES_SUPPLEMENTAIRES} element={<HeuresSupplementaires />} />
              <Route path={ROUTES.PLANNING_VACANCES} element={<PlanningVacances />} />
              <Route path={ROUTES.SITES_INTERNET} element={<SitesInternet />} />
              <Route path={ROUTES.PROCESS} element={<Process />} />
              <Route path={ROUTES.REUNIONS} element={<Reunions />} />
              <Route path={ROUTES.RAL_CONVERTER} element={<RalConverter />} />
              <Route path={ROUTES.CALCULATRICE} element={<Calculatrice />} />
              <Route path={ROUTES.FEEDBACKS} element={<Feedbacks />} />
              <Route path={ROUTES.ANNUAIRE} element={<Annuaire />} />
              <Route path={ROUTES.MON_PROFIL} element={<MonProfil />} />
              <Route
                path={ROUTES.UTILISATEURS}
                element={
                  <AdminRoute>
                    <Utilisateurs />
                  </AdminRoute>
                }
              />
              <Route
                path={ROUTES.PARAMETRES}
                element={
                  <AdminRoute>
                    <Parametres />
                  </AdminRoute>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          </Routes>
        </BrowserRouter>

        {/* Import Progress Bar - Fixed at top */}
        <ImportProgressBar />

        {/* Update Checker - Vérifie les mises à jour au démarrage */}
        <UpdateChecker />

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </AuthInitializer>
    </QueryClientProvider>
  );
}

export default App;
