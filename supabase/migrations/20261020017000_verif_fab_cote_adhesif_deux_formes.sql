-- VérifIzy : correction de Jordan (20/10/2026) — pour un adhésif découpé à la forme,
-- les DEUX cotes sont admises au BAT : celle du support (« Pour vitrine L x H ») OU celle
-- de l'adhésif au format fini. Il en faut au moins une.
UPDATE public.verif_regles SET texte = replace(texte,
  'Adhésif découpé à la forme : la cote attendue au BAT est celle du SUPPORT (« Pour vitrine L x H ») ; l''emprise de l''adhésif lui-même n''est pas exigée au BAT.',
  'Adhésif découpé à la forme : le BAT donne SOIT la cote du support (« Pour vitrine L x H »), SOIT la cote de l''adhésif au format fini ; les deux sont admises, il en faut au moins une. N''exige pas l''autre.')
WHERE titre = 'BAT complet : contenu obligatoire' AND statut = 'validee';
SELECT titre FROM public.verif_regles WHERE texte LIKE '%les deux sont admises%';
