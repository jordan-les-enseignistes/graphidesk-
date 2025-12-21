-- Migration: Corriger les policies UPDATE pour les admins sur heures_journalieres
-- Date: 2025-12-19
-- Le problème: les policies UPDATE nécessitent USING (pour lire la ligne) ET WITH CHECK (pour écrire)

-- Supprimer et recréer la policy admin pour UPDATE sur heures_journalieres
DROP POLICY IF EXISTS "Admins can update all heures" ON heures_journalieres;
CREATE POLICY "Admins can update all heures" ON heures_journalieres
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Aussi pour les feuilles_temps (au cas où)
DROP POLICY IF EXISTS "Admins can update all feuilles" ON feuilles_temps;
CREATE POLICY "Admins can update all feuilles" ON feuilles_temps
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Aussi pour DELETE (nécessaire pour le refresh qui supprime puis réinsère)
DROP POLICY IF EXISTS "Admins can delete all heures" ON heures_journalieres;
CREATE POLICY "Admins can delete all heures" ON heures_journalieres
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
