-- VérifIzy : la limite d'environ 2000 mm ne concerne que la DÉCOUPE (Jordan, 22/10/2026) ;
-- un adhésif plein plus long relève du process de raccord, déjà décrit ailleurs.
UPDATE public.verif_regles SET texte = replace(texte,
  'découpe à la forme ou impression de plus de 2000 mm de long',
  'découpe à la forme de plus de 2000 mm de long (pas un adhésif plein à découpe droite : voir les raccords)'),
  updated_at = now()
WHERE titre = 'Gravité : erreur, alerte, question ou remarque' AND statut = 'validee';
SELECT count(*) AS reste FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%ou impression de plus de 2000%';
