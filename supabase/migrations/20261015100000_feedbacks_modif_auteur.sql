-- L'auteur d'un feedback peut le corriger tant qu'il est « en attente »
-- (Caroline, 14/10/2026). Une fois pris en charge, il ne bouge plus.
-- Politique permissive : elle s'ajoute aux règles existantes sans les changer.
DROP POLICY IF EXISTS "feedbacks_auteur_modifie_en_attente" ON public.feedbacks;
CREATE POLICY "feedbacks_auteur_modifie_en_attente" ON public.feedbacks
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND statut = 'en_attente')
  WITH CHECK (created_by = auth.uid() AND statut = 'en_attente');
