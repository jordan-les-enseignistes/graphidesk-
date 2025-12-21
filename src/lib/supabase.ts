import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wkdubjbozmdohzezhmsp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHViamJvem1kb2h6ZXpobXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjAxOTcsImV4cCI6MjA4MTYzNjE5N30.T308WxKcKYv2dkTtXSkDY9M9tma47XrSuadJ7EYfB54";

const STORAGE_KEY = "graphidesk-auth";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: STORAGE_KEY,
  },
});

// Helper pour vérifier la connexion
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
