-- VérifIzy : mention de pose « double face + silicone » sur les lettrages (mail de Léa, responsable d'atelier,
-- confirmé par Michaël le 29/10/2026 : « double face + silicone »).
UPDATE public.verif_regles SET texte = replace(texte,
  E'- La mise en situation montre l''emplacement de chaque élément',
  E'- Lettrage découpé posé directement sur le support (lettrage PVC, grand lettrage dibond…), hors pose sur entretoises : la fixation s''écrit au BAT « Fixation double-face + silicone » (remarque si le BAT n''écrit que « double-face » ou rien ; suite mail de Léa, responsable d''atelier, du 29/10/2026).\n- La mise en situation montre l''emplacement de chaque élément'),
  updated_at = now()
WHERE titre = 'BAT : mentions obligatoires selon le cas' AND statut = 'validee' AND texte NOT LIKE '%silicone%';
-- première version (appliquée le 29/10 au matin) : « au double face et au silicone, fournis par Les Enseignistes »
UPDATE public.verif_regles SET texte = replace(texte,
  'mention de pose au BAT « à poser au double face et au silicone, fournis par Les Enseignistes » (remarque si absente ;',
  'la fixation s''écrit au BAT « Fixation double-face + silicone » (remarque si le BAT n''écrit que « double-face » ou rien ;'),
  updated_at = now()
WHERE titre = 'BAT : mentions obligatoires selon le cas' AND statut = 'validee';
SELECT count(*) AS ok FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%« Fixation double-face + silicone »%';
