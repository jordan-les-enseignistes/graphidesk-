-- Migration: Ajout des demi-journées de congés
-- Date: 2025-12-19

-- Modifier la contrainte CHECK pour accepter les demi-journées
ALTER TABLE heures_journalieres
DROP CONSTRAINT IF EXISTS heures_journalieres_type_absence_check;

ALTER TABLE heures_journalieres
ADD CONSTRAINT heures_journalieres_type_absence_check
CHECK (type_absence IN ('conge', 'conge_matin', 'conge_aprem', 'ferie', 'maladie', 'rtt', NULL));
