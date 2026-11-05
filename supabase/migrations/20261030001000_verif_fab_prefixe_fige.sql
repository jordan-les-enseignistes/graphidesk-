-- VérifIzy : une vérification garde, du début à la fin, les règles et le modèle avec lesquels elle a commencé.
-- Une règle validée pendant une vérification changeait le prompt système en cours de route : l'API refuse alors
-- la réflexion des tours précédents (400 « thinking block bound to a different conversation », Quentin 30/10/2026).
ALTER TABLE public.verif_conversations ADD COLUMN IF NOT EXISTS regles_bloc text;
ALTER TABLE public.verif_conversations ADD COLUMN IF NOT EXISTS modele_fige text;
SELECT count(*) AS colonnes FROM information_schema.columns
WHERE table_name = 'verif_conversations' AND column_name IN ('regles_bloc', 'modele_fige');
