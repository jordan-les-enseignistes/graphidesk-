-- VérifIzy : modèle réellement utilisé (affiché discrètement sous le rapport)
ALTER TABLE public.verif_conversations ADD COLUMN IF NOT EXISTS modele text;
