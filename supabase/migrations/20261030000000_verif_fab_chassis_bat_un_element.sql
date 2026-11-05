-- VérifIzy : châssis coté tube compris (proposition de Caroline, retouchée par Jordan le 30/10/2026)
-- et nommage cohérent avec « Numérotation du BAT » (BAT à un seul élément : pas de numéro).
UPDATE public.verif_regles SET texte = replace(texte,
  'sont cotées tube compris des deux côtés ; leur somme dépasse donc le total de (nombre de montants intermédiaires x section du tube), ex. 1115 + 1575 + 2000 + 1540 − 3 x 30 = 6140. Vérifier ce calcul avant de signaler un écart.',
  'peuvent être cotées tube compris des deux côtés : leur somme dépasse alors le total d''exactement (nombre de montants intermédiaires x section du tube), ex. 1115 + 1575 + 2000 + 1540 − 3 x 30 = 6140. Vérifier ce calcul avant de signaler un écart ; si l''excédent ne correspond pas exactement, c''est bien un écart.'),
  updated_at = now()
WHERE id = '47ad899a-9d28-4c0f-a8c4-831436c98611' AND statut = 'proposee';
UPDATE public.verif_regles SET texte = replace(texte,
  'n''a pas besoin de numéros dans son nom.',
  'n''a pas besoin de numéros dans son nom ; un BAT qui ne contient qu''UN SEUL élément non plus (voir « Numérotation du BAT »).'),
  updated_at = now()
WHERE titre = 'Nom des fichiers de FAB' AND statut = 'validee' AND texte NOT LIKE '%UN SEUL élément non plus%';
SELECT
  (SELECT count(*) FROM public.verif_regles WHERE id = '47ad899a-9d28-4c0f-a8c4-831436c98611' AND texte LIKE '%peuvent être cotées tube compris%') AS chassis,
  (SELECT count(*) FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%UN SEUL élément non plus%') AS nommage;
