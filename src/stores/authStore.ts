import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { setMinimizeOnClose } from "@/lib/tauri";
import { DEFAULT_PREFERENCES } from "@/types/database";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  loadProfile: (userId: string) => Promise<Profile | null>;
  refreshProfile: () => Promise<void>;
  initialize: () => Promise<void>;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  profile: null,
  session: null,
  loading: true,
  error: null,
  initialized: false,
};

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setInitialized: (initialized) => set({ initialized }),

  loadProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Erreur chargement profil:", error);
      return null;
    }

    // Synchroniser les préférences avec Tauri
    if (data) {
      const prefs = data.preferences || DEFAULT_PREFERENCES;
      try {
        await setMinimizeOnClose(prefs.minimize_on_close ?? true);
      } catch (e) {
        console.warn("Impossible de synchroniser les préférences Tauri:", e);
      }
    }

    return data;
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;

    const profile = await get().loadProfile(user.id);
    if (profile) {
      set({ profile });
    }
  },

  // initialize n'est plus utilisée - l'initialisation se fait via onAuthStateChange dans App.tsx
  initialize: async () => {
    // Fonction conservée pour compatibilité mais ne fait rien
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const errorMessage =
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect"
          : error.message;
      set({ loading: false, error: errorMessage });
      return { error: errorMessage };
    }

    if (data.user) {
      const profile = await get().loadProfile(data.user.id);

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        const errorMsg = "Votre compte a été désactivé. Contactez l'administrateur.";
        set({ loading: false, error: errorMsg });
        return { error: errorMsg };
      }

      set({
        user: data.user,
        profile,
        session: data.session,
        loading: false,
        error: null,
      });
    }

    return { error: null };
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({
      user: null,
      profile: null,
      session: null,
      loading: false,
      error: null,
    });
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  },

  reset: () => set(initialState),
}));

// Sélecteurs
export const selectIsAdmin = (state: AuthState) => state.profile?.role === "admin";
export const selectIsAuthenticated = (state: AuthState) => !!state.user && !!state.profile;
export const selectUserInitials = (state: AuthState) => state.profile?.initials ?? "";
export const selectUserName = (state: AuthState) => state.profile?.full_name ?? "";
