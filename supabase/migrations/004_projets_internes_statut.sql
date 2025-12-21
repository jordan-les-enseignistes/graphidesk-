-- Ajout de la colonne statut pour les projets internes
-- Permet un système de statuts plus riche (a_faire, en_cours, termine)
-- au lieu du simple booléen is_termine

ALTER TABLE projets_internes
ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'a_faire';

-- Migration des données existantes : convertir is_termine en statut
UPDATE projets_internes
SET statut = CASE
    WHEN is_termine = true THEN 'termine'
    ELSE 'a_faire'
END
WHERE statut IS NULL OR statut = 'a_faire';

-- Créer un index pour les recherches par statut
CREATE INDEX IF NOT EXISTS idx_projets_internes_statut ON projets_internes(statut);
