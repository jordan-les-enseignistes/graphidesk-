-- VérifIzy : réponses de Jordan (20/10/2026) — raccords selon le support, prolongation 10 mm, fixation.

-- 1. Raccord d'un adhésif PLEIN : selon le support.
UPDATE public.verif_regles SET texte = $t$Adhésif PLEIN (non découpé à la forme) :
- posé sur une VITRINE : il se fournit à la taille finale, c'est la machine d'impression qui fait le raccord (pas de fichiers en parties). Le BAT doit prévenir le client qu'il y aura un ou plusieurs raccords.
- posé sur des panneaux, un caisson…, ou sur un panneau que nous découpons en parties : un fichier d'adhésif PAR partie, à la taille de la partie + ses bords perdus (ex. panneau de 500 mm de haut découpé en 2000 + 3000 mm → adhésifs de 2020 x 520 et 3020 x 520 mm). Un adhésif unique sur plusieurs parties : erreur.
Adhésif DÉCOUPÉ À LA FORME : c'est le graphiste qui fournit les parties ; au-delà de 2000 mm de long, alerte « à valider avec l'atelier » (normalement on ne dépasse pas 2000 mm).
Le raccord se juge sur la dimension FINALE de l'adhésif. Une cote de surface ou d'emplacement (« pour vitrine », dimensions de la vitre, de la façade) n'est pas la taille de l'adhésif quand il est découpé à la forme ou ne couvre pas toute la surface : mesure l'emprise réelle du visuel. En cas de doute, question.$t$,
  updated_at = now()
WHERE titre = 'Raccord d''un adhésif seul' AND statut = 'validee';

UPDATE public.verif_regles SET texte = replace(texte,
  '- Adhésif non découpé à la forme : l''atelier coupe et fait le raccord (le graphiste fournit la taille finale). Adhésif découpé à la forme : c''est le graphiste qui fournit les parties.',
  '- Parties et raccords d''un adhésif : voir la règle « Raccord d''un adhésif seul » (vitrine : raccord par la machine ; panneaux ou caisson : un adhésif par partie ; découpé à la forme : parties fournies par le graphiste).'),
  updated_at = now()
WHERE titre = 'Grands adhésifs, parties et obstacles' AND statut = 'validee';

UPDATE public.verif_regles SET texte = replace(texte,
  '- Découpe à la forme d''une pièce très longue : éviter au-delà de 2 m (2,5 m tolérés) : alerte.',
  '- Découpe à la forme de plus de 2000 mm de long : alerte « à valider avec l''atelier » (normalement on ne dépasse pas 2000 mm).'),
  updated_at = now()
WHERE titre = 'Plan de travail, CutContour, repères et fichiers clients' AND statut = 'validee';

-- 2. Prolongation du visuel hors découpe : 10 mm suffisent, ALERTE seulement.
UPDATE public.verif_regles SET texte = replace(texte, 'Visuel prolongé d''au moins 15 mm hors du tracé si possible', 'Visuel prolongé d''environ 10 mm hors du tracé (moins : alerte, jamais erreur)'), updated_at = now()
WHERE titre = 'Adhésif découpé à la forme : CutContour' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte, 'le visuel est prolongé d''au moins 15 mm au-delà du tracé de découpe de l''adhésif', 'le visuel est prolongé d''environ 10 mm au-delà du tracé de découpe de l''adhésif (moins : alerte)'), updated_at = now()
WHERE titre = 'Adhésif sur panneau découpé à la forme' AND statut = 'validee';
UPDATE public.verif_regles SET texte = replace(texte, 'visuel prolongé de moins de 15 mm hors découpe', 'visuel prolongé de moins de 10 mm hors découpe'), updated_at = now()
WHERE titre = 'Gravité : erreur, alerte ou question' AND statut = 'validee';

-- 3. Fixation : au BAT, sinon issue de la VT ou du devis, sinon question.
UPDATE public.verif_regles SET texte = texte || '
Fixation : si elle n''est pas au BAT, elle doit venir de la VT ou du devis (commercial) ; si aucune des deux ne la donne, c''est une question à leur poser, pas une erreur.',
  updated_at = now()
WHERE titre = 'BAT complet : contenu obligatoire' AND statut = 'validee' AND texte NOT LIKE '%Fixation : si elle n''est pas au BAT%';

SELECT titre FROM public.verif_regles WHERE updated_at > now() - interval '1 minute' ORDER BY titre;
SELECT count(*) AS reste_15mm FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%15 mm%';
