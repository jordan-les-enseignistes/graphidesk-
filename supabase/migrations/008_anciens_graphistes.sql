-- ============================================
-- GraphiDesk - Migration 008: Anciens graphistes
-- Permet de gérer les dossiers d'anciens graphistes
-- ============================================

BEGIN;

-- 1. Ajouter une colonne pour stocker les initiales originales du graphiste
-- Utile pour les dossiers d'anciens graphistes qui ne sont plus dans le système
ALTER TABLE dossiers
ADD COLUMN IF NOT EXISTS graphiste_initials TEXT;

-- 2. Rendre graphiste_id nullable pour les dossiers d'anciens graphistes
ALTER TABLE dossiers
ALTER COLUMN graphiste_id DROP NOT NULL;

-- 3. Créer un index sur graphiste_initials pour les requêtes
CREATE INDEX IF NOT EXISTS idx_dossiers_graphiste_initials ON dossiers(graphiste_initials);

COMMIT;
