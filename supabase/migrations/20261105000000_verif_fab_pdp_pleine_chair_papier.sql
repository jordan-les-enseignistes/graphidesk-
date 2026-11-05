-- VérifIzy : un PDP pleine chair peut être découpé dans du papier (proposition de Carole Bouvier, fusionnée
-- dans « Plans de pose » par Jordan le 05/11/2026).
UPDATE public.verif_regles SET texte = replace(texte,
  '- PDP pleine chair : contour tracé',
  '- PDP pleine chair : découpé dans du papier comme dans l''adhésif plan de pose (un fichier nommé « PLAN-POSE-PAPIER » avec un contour PleineChair est cohérent, rien à signaler) ; contour tracé'),
  updated_at = now()
WHERE titre = 'Plans de pose' AND statut = 'validee' AND texte NOT LIKE '%PLAN-POSE-PAPIER%';
UPDATE public.verif_regles SET statut = 'fusionnee', updated_at = now()
WHERE titre = 'PDP pleine chair découpé dans du papier' AND statut = 'proposee';
SELECT titre, statut FROM public.verif_regles
WHERE titre IN ('Plans de pose', 'PDP pleine chair découpé dans du papier')
   OR (statut = 'validee' AND texte LIKE '%PLAN-POSE-PAPIER%');
