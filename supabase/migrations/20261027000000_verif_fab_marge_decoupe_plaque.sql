-- VérifIzy : une pièce découpée à la forme dans une plaque doit rester un peu sous le format
-- de la plaque, sinon la machine ne peut pas la découper (Jordan, 27/10/2026).
UPDATE public.verif_regles SET texte = texte || '
Pièce DÉCOUPÉE À LA FORME dans une plaque (contour, coins arrondis…) : chaque cote doit rester au moins 4 mm sous la dimension de la plaque qu''elle occupe, sinon la machine ne peut pas la découper (ex. plaque 1500 x 3050 : 1496 mm maximum sur le petit côté ; un panneau découpé de 1500 x 1500 passe en 1496 x 1496). Une cote égale au format de la plaque, ou à moins de 4 mm : erreur.',
  updated_at = now()
WHERE titre = 'Formats des plaques (mm)' AND statut = 'validee' AND texte NOT LIKE '%au moins 4 mm sous%';
SELECT count(*) AS ok FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%au moins 4 mm sous%';
UPDATE public.verif_regles SET texte = replace(texte,
  'Une cote égale au format de la plaque, ou à moins de 4 mm : erreur.',
  'Une cote égale au format de la plaque, ou à moins de 4 mm : erreur. Un panneau à découpe DROITE n''est pas concerné : il peut faire le format exact de la plaque.'),
  updated_at = now()
WHERE titre = 'Formats des plaques (mm)' AND statut = 'validee' AND texte NOT LIKE '%découpe DROITE n''est pas concerné%';
SELECT count(*) AS ok2 FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%découpe DROITE n''est pas concerné%';
