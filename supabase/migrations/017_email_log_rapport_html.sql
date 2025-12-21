-- Migration: Ajouter colonne rapport_html à email_heures_sup_log
-- Date: 2025-12-19

-- Stocker le HTML du rapport directement dans la table
ALTER TABLE email_heures_sup_log
ADD COLUMN IF NOT EXISTS rapport_html TEXT;

-- Politique pour lecture publique du rapport (via l'ID)
-- On garde le RLS mais on permet la lecture du rapport_html par ID
CREATE POLICY "Anyone can view rapport by id" ON email_heures_sup_log
  FOR SELECT
  USING (true);

-- Supprimer l'ancienne politique admin-only pour SELECT
DROP POLICY IF EXISTS "Admins can view email logs" ON email_heures_sup_log;
