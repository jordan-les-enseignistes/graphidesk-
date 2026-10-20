-- VérifIzy : le raccord se juge sur la dimension FINALE de l'adhésif, quelle que
-- soit la règle qui en parle (laize par matière, limites machines, adhésif seul).
-- Retour de Jordan (Camif, 20/10/2026) : l'exception n'était que dans une des trois règles.

INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT 'impression', 'Raccord : toujours sur la dimension FINALE de l''adhésif',
'Avant de conclure à un raccord (laize, limites machines, adhésif seul), vérifie que la cote est celle de l''ADHÉSIF lui-même. Une cote « Pour vitrine L x H », « vitrine », « surface », « façade » ou « emplacement », surtout avec « Découpe à la forme », est la taille du support, pas de l''adhésif : n''en déduis JAMAIS un raccord. Le raccord se juge sur l''emprise réelle du visuel découpé (fichier de FAB, ou maquette à l''échelle). Sans fichier de FAB ni mesure possible : aucun constat de raccord.',
'validee', 'Retour de Jordan après le test Camif (20/10/2026)'
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles WHERE titre = 'Raccord : toujours sur la dimension FINALE de l''adhésif');

UPDATE public.verif_regles SET texte = texte || ' (sur la dimension FINALE de l''adhésif, pas sur une cote de vitrine ou de surface : voir la règle « Raccord : toujours sur la dimension FINALE de l''adhésif »)'
WHERE statut = 'validee' AND titre IN ('Limites machines : raccord au-delà', 'Zone d''impression et de découpe par matière (mm)')
  AND texte NOT LIKE '%dimension FINALE%';

SELECT titre FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%dimension FINALE%';
