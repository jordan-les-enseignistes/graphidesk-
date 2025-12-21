-- Migration: Ajouter politique INSERT pour admins sur feuilles_temps
-- Date: 2025-12-19

-- Les admins peuvent créer des feuilles pour tous les utilisateurs
DROP POLICY IF EXISTS "Admins can insert all feuilles" ON feuilles_temps;
CREATE POLICY "Admins can insert all feuilles" ON feuilles_temps
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
