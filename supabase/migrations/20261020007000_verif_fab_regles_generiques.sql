-- Vérif FAB : règles 100 % génériques (Jordan, 20/10/2026) — aucune ne doit
-- reprendre un détail d'un dossier précis (quantité, noms de calques, suite de
-- numéros) : ce serait induire l'analyse en erreur. Les cas particuliers se
-- traitent par des QUESTIONS. Le dossier d'origine reste dans « raison », jamais envoyé à l'IA.
UPDATE public.verif_regles SET updated_at = now(), texte =
  $$Un adhésif plein posé tel quel n'a PAS de CutContour. Exception admise : une grande série, où une découpe automatique évite de couper chaque exemplaire à la main. Si un adhésif plein a un CutContour et que la quantité ne paraît pas justifier une découpe automatique, poser la question.$$
WHERE titre = 'Pas de CutContour sur un adhésif plein' AND statut = 'validee';

UPDATE public.verif_regles SET updated_at = now(), texte =
  $$Adhésif collé à l'intérieur de la vitre, vu de l'extérieur : impression sur transparent avec blanc de soutien total ou sélectif. Calques : graphisme (tout en dessous, SANS surimpression) ; cut contour (seulement si découpe de forme : tracés fermés en rose Colorado-2025) ; blanc (ton direct White, couleur bleue Colorado-2025, au-dessus, EN surimpression). Les noms des calques importent peu. Le fichier n'est PAS mis en miroir : l'atelier s'en charge, mais « MIROIR » doit figurer dans le nom du fichier de FAB.$$
WHERE titre = 'Vitrophanie' AND statut = 'validee';

UPDATE public.verif_regles SET updated_at = now(), texte =
  $$Avec un blanc de soutien, le ton direct White doit être dessiné EN SURIMPRESSION au-dessus du graphisme ; sinon le blanc masque le visuel à l'impression. Le graphisme, lui, n'est pas en surimpression. Les noms des calques importent peu.$$
WHERE titre = 'Vitrophanie : surimpression du blanc' AND statut = 'validee';

UPDATE public.verif_regles SET updated_at = now(), texte =
  $$ERREUR à signaler (pas une question) :
- un visuel du BAT sans son numéro (mise en situation, vue à plat, détail), ou une ligne de légende dont le numéro n'apparaît sur aucun visuel ;
- un numéro en DOUBLE (deux légendes ou deux éléments différents avec le même numéro) ;
- un TROU dans la suite des numéros — à signaler même s'il vient d'un élément retiré ;
- des numéros de fichiers de FAB qui ne correspondent pas aux numéros du BAT, ou un numéro du BAT sans fichier de FAB (et l'inverse).
En cas de doute sur quel visuel correspond à quelle ligne de légende : le signaler comme erreur de numérotation, ne jamais deviner.$$
WHERE titre = 'Numérotation du BAT' AND statut = 'validee';

UPDATE public.verif_regles SET updated_at = now(), texte =
  $$Si un dossier MAIRIE existe, les dimensions et le type d'enseigne fabriqués doivent correspondre au BAT mairie déposé. Une réponse de la mairie (arrêté, autorisation, avis ABF) se lit en entier : un refus, ou des réserves non respectées par le BAT ou la FAB, est une ERREUR « ATTENTION LA MAIRIE REFUSE : … » avec le détail. Si un dossier mairie existe sans aucune réponse : demander si l'autorisation a été obtenue avant de lancer.$$
WHERE titre = 'Mairie : ne pas dépasser ce qui est autorisé' AND statut = 'validee';

UPDATE public.verif_regles SET updated_at = now(), texte =
  $$Un repère de calage ou de pose (texte de repère, croix, traits de repérage) aide l'atelier : il n'a JAMAIS besoin d'être vectorisé et n'est pas une erreur. Seuls les textes du visuel imprimé ou découpé doivent être vectorisés.$$
WHERE titre = 'Repères de calage' AND statut = 'validee';
