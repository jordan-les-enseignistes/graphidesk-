-- VérifIzy : taille du plexi derrière un ajourage à plat (Jordan, 27/10/2026).
UPDATE public.verif_regles SET texte = replace(texte,
  'absente ou « transparent » = erreur.',
  'absente ou « transparent » = erreur. Ce plexi ne couvre que la ZONE AJOURÉE (emprise des découpes + quelques centimètres tout autour pour la fixation, plus sur un grand caisson, moins sur un petit : pas de chiffre fixe), jamais toute la face ; les éléments seulement adhésivés (non découpés, ex. logos imprimés) n''ont pas de plexi derrière. Il doit tenir à l''intérieur du caisson : un plexi aux dimensions de la face, ou plus grand (ex. 1000 x 1000 pour un caisson de 1000 x 1000), ne rentre pas : erreur.'),
  updated_at = now()
WHERE titre = 'Caissons' AND statut = 'validee' AND texte NOT LIKE '%ne couvre que la ZONE AJOURÉE%';
SELECT count(*) AS ok FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%ne couvre que la ZONE AJOURÉE%';
