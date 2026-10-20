-- VérifIzy : quatrième niveau « REMARQUE » (Jordan, 20/10/2026).
-- ⚠ À APPLIQUER AU MOMENT DU PUSH de la version qui affiche les remarques (avec le
--   déploiement de la fonction verif-fab) : une version de GraphiDesk qui ne connaît
--   pas ce niveau ne saurait pas l'afficher.

-- 1. Gravité : quatre niveaux + ce qui n'est jamais signalé.
UPDATE public.verif_regles SET
  titre = 'Gravité : erreur, alerte, question ou remarque',
  texte = $t$ERREUR = ce qui fausse la fabrication ou la pose : dimension, quantité, matière, pose intérieure/extérieure, élément manquant ou en trop, écart BAT/FAB, refus de la mairie, numérotation fausse, dimensions absentes du BAT, fichier au nom d'un AUTRE dossier.
ALERTE = un vrai RISQUE pour la fab ou la pose, à vérifier (souvent avec l'atelier) : visuel prolongé de moins de 10 mm hors découpe, découpe à la forme ou impression de plus de 2000 mm de long, information de pose ou de matière qui manque pour l'atelier, série d'adhésifs pleins à valider avec l'atelier.
QUESTION = une information manquante ou un écart qui peut être voulu.
REMARQUE = hors de nos standards mais SANS risque pour la fab (sert à la formation) : trou dans la numérotation, mention conseillée absente du BAT, couleurs ou descriptif incomplets sans effet sur la fab, nom de fichier incomplet ou tronqué, CutContour à une autre épaisseur que 1 pt, repères en aplat ou absents quand la pose reste possible, plan de travail trop grand, rangement non conforme, écarts devis/BAT à signaler au commercial.
JAMAIS SIGNALÉ : fautes d'orthographe, d'accent ou d'accord dans NOS textes (BAT, légendes, noms de fichiers) ; le design ; un fichier repris d'un ancien dossier mais conforme au BAT et à la maquette ; une cote à décimale arrondie au mm ailleurs. Exception : une faute réelle dans un texte que le client verra sur un fichier de PRODUCTION (mot mal écrit, accent manquant sur un texte en minuscules) → remarque.
Pas de fichier de FAB du tout : vérification avant FAB, ni erreur ni alerte.$t$,
  updated_at = now()
WHERE titre = 'Gravité : erreur, alerte ou question' AND statut = 'validee';

-- 2. Les points qui passent d'alerte à remarque dans les autres règles.
UPDATE public.verif_regles SET texte = replace(texte, 'est conseillée (alerte si absente)', 'est conseillée (remarque si absente)'), updated_at = now()
WHERE titre = 'BAT : mentions obligatoires selon le cas' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(replace(replace(texte,
  'cote inversée par rapport au reste du BAT, est une alerte (question si ça change la pièce)', 'cote inversée par rapport au reste du BAT, est une remarque (question si ça change la pièce)'),
  'ou une somme de parties différente du total est une alerte.', 'est une remarque ; une somme de parties différente du total est une alerte.'),
  'annotation de travail oubliée (flèches, repères de couleur sur les photos) : alerte.', 'annotation de travail oubliée (flèches, repères de couleur sur les photos) : remarque.'),
  updated_at = now()
WHERE titre = 'BAT : rédaction des cotes et du descriptif' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte, '(conseil : alerte)', '(conseil : remarque)'), updated_at = now()
WHERE titre IN ('Fonds perdus : où et combien', 'Grands adhésifs, parties et obstacles') AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte, 'question ou alerte « à valider avec l''atelier », pas erreur.', 'question ou remarque « à valider avec l''atelier », pas erreur.'), updated_at = now()
WHERE titre = 'Méthode : lire tout le dossier avant de juger' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte, 'Nom tronqué ou d''un autre dossier : alerte, même pour un fichier déjà produit.', 'Nom tronqué : remarque ; nom d''un AUTRE dossier : erreur (même pour un fichier déjà produit).'), updated_at = now()
WHERE titre = 'Nom des fichiers de FAB' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte, 'ALERTE (pas une erreur) : un TROU dans la suite des numéros', 'REMARQUE (pas une erreur) : un TROU dans la suite des numéros'), updated_at = now()
WHERE titre = 'Numérotation du BAT' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte, '(vide important = matière gâchée : alerte)', '(vide important = matière gâchée : remarque)'), updated_at = now()
WHERE titre = 'Plan de travail, CutContour, repères et fichiers clients' AND statut = 'validee';

SELECT count(*) AS regles_touchees FROM public.verif_regles WHERE updated_at > now() - interval '1 minute';
