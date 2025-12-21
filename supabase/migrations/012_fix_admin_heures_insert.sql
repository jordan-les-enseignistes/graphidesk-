-- Migration: Ajouter politique INSERT pour admins sur heures_journalieres
-- Date: 2025-12-19

-- Les admins peuvent insérer des heures pour tous les utilisateurs
DROP POLICY IF EXISTS "Admins can insert all heures" ON heures_journalieres;
CREATE POLICY "Admins can insert all heures" ON heures_journalieres
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
