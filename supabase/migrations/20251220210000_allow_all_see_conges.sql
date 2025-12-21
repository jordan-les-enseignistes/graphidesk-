-- Migration: Permettre à tous les graphistes de voir les congés de l'équipe
-- Tous les utilisateurs authentifiés peuvent voir les feuilles_temps et heures_journalieres
-- pour le planning des vacances

-- Ajouter une policy pour que tous les utilisateurs authentifiés puissent voir les feuilles_temps
-- (nécessaire pour le planning vacances)
CREATE POLICY "All users can view feuilles for conges" ON feuilles_temps
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Ajouter une policy pour que tous les utilisateurs authentifiés puissent voir les heures
-- (nécessaire pour le planning vacances - voir les congés de chacun)
CREATE POLICY "All users can view heures for conges" ON heures_journalieres
  FOR SELECT USING (auth.uid() IS NOT NULL);
