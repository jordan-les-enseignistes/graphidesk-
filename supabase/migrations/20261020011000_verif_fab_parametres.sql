-- VérifIzy : paramètres globaux (modèle choisi par l'admin, entretien du cache).
CREATE TABLE IF NOT EXISTS public.verif_parametres (
  id integer PRIMARY KEY CHECK (id = 1),
  modele text NOT NULL DEFAULT 'claude-opus-5-5',
  -- dernière relance automatique du cache (évite les doublons entre postes)
  cache_entretenu_le timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.verif_parametres (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.verif_parametres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verif_param_select" ON public.verif_parametres;
CREATE POLICY "verif_param_select" ON public.verif_parametres FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "verif_param_update" ON public.verif_parametres;
CREATE POLICY "verif_param_update" ON public.verif_parametres FOR UPDATE TO authenticated
  USING (user_has_permission('manage:users')) WITH CHECK (user_has_permission('manage:users'));

-- les relances automatiques du cache ne sont faites par personne
ALTER TABLE public.verif_usage ALTER COLUMN user_id DROP NOT NULL;
