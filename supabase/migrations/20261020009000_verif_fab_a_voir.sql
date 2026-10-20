-- VérifIzy : une vérification terminée (rapport ou questions) pendant que le
-- graphiste était ailleurs reste « à voir » jusqu'à ce qu'il l'ouvre (badge du menu).
ALTER TABLE public.verif_conversations ADD COLUMN IF NOT EXISTS a_voir boolean NOT NULL DEFAULT false;
