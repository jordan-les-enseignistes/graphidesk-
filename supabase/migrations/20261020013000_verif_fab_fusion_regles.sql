-- VérifIzy : une proposition de règle peut REMPLACER une règle existante (fusion
-- sur le même sujet) ; Jordan valide d'un clic, la règle cible prend le texte fusionné.
ALTER TABLE public.verif_regles ADD COLUMN IF NOT EXISTS remplace_id uuid REFERENCES public.verif_regles(id) ON DELETE SET NULL;

ALTER TABLE public.verif_regles DROP CONSTRAINT IF EXISTS verif_regles_statut_check;
ALTER TABLE public.verif_regles ADD CONSTRAINT verif_regles_statut_check
  CHECK (statut IN ('proposee', 'validee', 'refusee', 'fusionnee'));

-- Nommage (retour de Jordan, test VLC 20/10/2026) : « DECOUPE » est une option admise dans le nom.
UPDATE public.verif_regles
SET texte = replace(texte, 'OPTION (MIROIR, RAL, taille,', 'OPTION (DECOUPE, MIROIR, RAL, taille,')
WHERE titre = 'Nom des fichiers de FAB' AND statut = 'validee' AND texte NOT LIKE '%OPTION (DECOUPE%';

SELECT titre, left(texte, 160) AS debut FROM public.verif_regles WHERE titre = 'Nom des fichiers de FAB';
