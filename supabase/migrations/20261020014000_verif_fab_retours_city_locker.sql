-- VérifIzy : retours de Jordan après le test City Locker Metz (20/10/2026).

-- 1. Numérotation : elle ne figure que sur les visuels SANS DÉFORMATION, pas sur les mises en situation avant/après.
UPDATE public.verif_regles SET texte = replace(texte,
  '- un visuel du BAT sans son numéro (mise en situation, vue à plat), ou une ligne de légende dont le numéro n''apparaît sur aucun visuel ;',
  '- un visuel SANS DÉFORMATION (vue à plat cotée) sans son numéro, ou une ligne de légende dont le numéro n''apparaît sur aucun visuel ;')
  || '
Les mises en situation AVANT et APRÈS (photomontages) ne portent PAS de numéros : c''est normal, ne le signale pas.'
WHERE titre = 'Numérotation du BAT' AND statut = 'validee' AND texte NOT LIKE '%ne portent PAS de numéros%';

-- 2. Matière : correspondance entre le nom d'adhésif au BAT et le code matière de la FAB.
UPDATE public.verif_regles SET texte = texte || '
Correspondance BAT → code matière (en général) : adhésif OCCULTANT = DG (dos gris) ; adhésif DIFFUSANT = DB (dos blanc). Un autre code que celui attendu : question.'
WHERE titre = 'Nom des fichiers de FAB' AND statut = 'validee' AND texte NOT LIKE '%adhésif DIFFUSANT = DB%';

SELECT titre FROM public.verif_regles
WHERE statut = 'validee' AND (texte LIKE '%ne portent PAS de numéros%' OR texte LIKE '%adhésif DIFFUSANT = DB%');
