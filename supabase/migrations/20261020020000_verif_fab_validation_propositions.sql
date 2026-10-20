-- VérifIzy : Jordan valide les 20 propositions issues de nos échanges (20/10/2026),
-- en règles de base, sans origine.
UPDATE public.verif_regles
SET statut = 'validee', raison = NULL, valide_par = 'ee6c3b71-9d42-4f09-9c7a-aa7131ad4295', updated_at = now()
WHERE statut = 'proposee' AND raison LIKE 'Discussion avec Caroline%';
SELECT statut, count(*) AS n FROM public.verif_regles GROUP BY statut ORDER BY statut;
