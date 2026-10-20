-- VérifIzy : retours de Jordan après le test Camif Habitat Bouguenais (20/10/2026).
-- Règles génériques : aucune ne dépend d'un dossier.

-- 1. Numérotation : un trou est une ALERTE ; un zoom d'un élément déjà numéroté n'a pas besoin de numéro.
UPDATE public.verif_regles SET texte =
'ERREUR à signaler (pas une question) :
- un visuel du BAT sans son numéro (mise en situation, vue à plat), ou une ligne de légende dont le numéro n''apparaît sur aucun visuel ;
- un numéro en DOUBLE (deux légendes ou deux éléments différents avec le même numéro) ;
- des numéros de fichiers de FAB qui ne correspondent pas aux numéros du BAT, ou un numéro du BAT sans fichier de FAB (et l''inverse) — seulement quand les fichiers de FAB existent.
ALERTE (pas une erreur) : un TROU dans la suite des numéros, même s''il vient d''un élément retiré.
Pas de numéro exigé sur un ZOOM ou une vue de détail d''un élément déjà numéroté ailleurs sur le BAT (ex. zoom du kit horaire d''une porte numérotée).
En cas de doute sur quel visuel correspond à quelle ligne de légende : le signaler comme erreur de numérotation, ne jamais deviner.'
WHERE titre = 'Numérotation du BAT' AND statut = 'validee';

-- 2. Pas encore de FAB : vérification avant FAB, ce n'est ni une erreur ni une alerte.
UPDATE public.verif_regles SET texte = texte || '
Si AUCUN fichier de FAB n''existe encore (dossier FAB vide ou absent), c''est une vérification AVANT la FAB : ce n''est ni une erreur ni une alerte. Dis-le en une ligne dans le résumé, ne fais pas les contrôles propres aux fichiers de FAB, et vérifie tout le reste (devis, BAT, maquette, VT, mairie).'
WHERE titre = 'Fichiers de FAB : rien d''oublié' AND statut = 'validee' AND texte NOT LIKE '%AVANT la FAB%';

-- 3. Raccord : se juge sur la dimension FINALE de l'adhésif, pas sur celle de la surface.
UPDATE public.verif_regles SET texte = texte || '
Le raccord se juge sur la dimension FINALE de l''adhésif. Une cote de surface ou d''emplacement (« pour vitrine », dimensions de la vitre, de la façade) n''est pas la taille de l''adhésif quand il est découpé à la forme ou ne couvre pas toute la surface : mesure l''emprise réelle du visuel. En cas de doute, question.'
WHERE titre = 'Raccord d''un adhésif seul' AND statut = 'validee' AND texte NOT LIKE '%dimension FINALE%';

-- 4. Gravité : le trou de numérotation rejoint la liste des alertes.
UPDATE public.verif_regles SET texte = replace(texte,
  'fichier repris d''un ancien dossier mais conforme.',
  'fichier repris d''un ancien dossier mais conforme, trou dans la numérotation du BAT. Pas de fichier de FAB du tout : vérification avant FAB, ni erreur ni alerte.')
WHERE titre = 'Gravité : erreur, alerte ou question' AND statut = 'validee' AND texte NOT LIKE '%trou dans la numérotation%';

-- contrôle : 4 règles touchées
SELECT titre, left(texte, 80) AS debut FROM public.verif_regles
WHERE statut = 'validee' AND (texte LIKE '%AVANT la FAB%' OR texte LIKE '%dimension FINALE%' OR texte LIKE '%ALERTE (pas une erreur) : un TROU%' OR texte LIKE '%trou dans la numérotation%');
