import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/types";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    error: null,
  });

  // Charger le profil utilisateur
  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Erreur chargement profil:", error);
      return null;
    }
    return data;
  }, []);

  // Initialiser l'auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const profile = await loadProfile(session.user.id);
          setState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error("Erreur initialisation auth:", error);
        setState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          error: "Erreur de connexion au serveur",
        });
      }
    };

    initAuth();

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const profile = await loadProfile(session.user.id);
          setState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: null,
          });
        } else if (event === "SIGNED_OUT") {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            error: null,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Connexion
  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect"
          : error.message,
      }));
      return { error };
    }

    if (data.user) {
      const profile = await loadProfile(data.user.id);

      // Vérifier si l'utilisateur est actif
      if (profile && !(profile as { is_active?: boolean }).is_active) {
        await supabase.auth.signOut();
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Votre compte a été désactivé. Contactez l'administrateur.",
        }));
        return { error: { message: "Account disabled" } };
      }

      setState({
        user: data.user,
        profile,
        session: data.session,
        loading: false,
        error: null,
      });
    }

    return { error: null };
  }, [loadProfile]);

  // Déconnexion
  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      session: null,
      loading: false,
      error: null,
    });
  }, []);

  // Réinitialiser le mot de passe
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  // Recharger le profil
  const refreshProfile = useCallback(async () => {
    if (state.user) {
      const profile = await loadProfile(state.user.id);
      setState((prev) => ({ ...prev, profile }));
    }
  }, [state.user, loadProfile]);

  return {
    ...state,
    isAdmin: state.profile?.role === "admin",
    isAuthenticated: !!state.user && !!state.profile,
    signIn,
    signOut,
    resetPassword,
    refreshProfile,
  };
}
