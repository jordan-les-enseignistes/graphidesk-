-- VérifIzy : correction de Jordan (20/10/2026) — entretoises des éléments lumineux SOUS-TRAITÉS.
UPDATE public.verif_regles SET texte = replace(texte,
  '- Non lumineux sur entretoises : fichier PVC à l''échelle 1:1, entretoises NON placées (l''atelier s''en charge) + plan de pose papier. Lumineux : entretoises placées dans le fichier.',
  '- Non lumineux sur entretoises : fichier PVC à l''échelle 1:1, entretoises NON placées (l''atelier s''en charge) + plan de pose papier. Lumineux fabriqué EN INTERNE : emplacements des entretoises prévus dans le fichier. Lumineux SOUS-TRAITÉ : rien à préciser spécialement dans le fichier ; alerte « à vérifier avec l''atelier » (jamais erreur).'),
  updated_at = now()
WHERE titre = 'Lettres en relief : boîtiers, PVC, entretoises' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte,
  '- Lettres ou caissons sous-traités : fichier comme pour l''interne, entretoises placées ; pas besoin de séparer par couleur.',
  '- Lettres ou caissons sous-traités : pas besoin de séparer par couleur ; entretoises non exigées dans le fichier (alerte « à vérifier avec l''atelier »).'),
  updated_at = now()
WHERE titre = 'Sous-traitance' AND statut = 'validee';
SELECT count(*) AS reste FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%entretoises placées%';
