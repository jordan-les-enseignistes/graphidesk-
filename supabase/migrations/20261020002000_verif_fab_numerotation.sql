-- Vérif FAB : la numérotation du BAT est une vérification à part entière (Jordan, 19/10/2026)
UPDATE public.verif_regles
SET titre = 'Numérotation du BAT',
    texte = $$ERREUR à signaler (pas une question) :
- un visuel du BAT sans son numéro (mise en situation, vue à plat, détail), ou une ligne de légende dont le numéro n'apparaît sur aucun visuel ;
- un numéro en DOUBLE (deux légendes ou deux éléments différents avec le même numéro) ;
- un TROU dans la suite (1, 2, 3, 5 : où est le 4 ?) — à signaler, même s'il vient d'un élément retiré ;
- des numéros de fichiers de FAB (N1, N2, -3, 1-2…) qui ne correspondent pas aux numéros du BAT, ou un numéro du BAT sans fichier de FAB (et l'inverse).
En cas de doute sur quel visuel correspond à quelle ligne de légende : le signaler comme erreur de numérotation, ne jamais deviner.$$,
    raison = 'Camif Habitat Bouguenais, 19/10/2026 : page 5 sans numéros, suite 1-2-3-5-6 (le 4 manque) — Jordan veut que ce soit relevé comme une erreur',
    updated_at = now()
WHERE titre = 'Chaque visuel du BAT porte son numéro' AND statut = 'validee';
