-- Migration: Convertir graphiste_referent de TEXT vers UUID (référence à profiles)
-- Date: 2025-12-20
-- Cette migration permet de lier le graphiste référent aux graphistes assignés à la franchise

-- 1. Ajouter une nouvelle colonne UUID temporaire (si elle n'existe pas)
ALTER TABLE franchise_procedures
ADD COLUMN IF NOT EXISTS graphiste_referent_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Créer un index sur la nouvelle colonne (si il n'existe pas)
CREATE INDEX IF NOT EXISTS idx_franchise_procedures_graphiste_referent ON franchise_procedures(graphiste_referent_id);

-- 3. Remplir automatiquement avec le premier graphiste assigné à chaque franchise
UPDATE franchise_procedures fp
SET graphiste_referent_id = (
    SELECT fa.graphiste_id
    FROM franchise_assignments fa
    WHERE fa.franchise_id = fp.franchise_id
    ORDER BY fa.created_at
    LIMIT 1
);

-- 4. Supprimer l'ancienne colonne TEXT (si elle existe encore)
ALTER TABLE franchise_procedures DROP COLUMN IF EXISTS graphiste_referent;

-- 5. Renommer la nouvelle colonne (si pas déjà fait)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'franchise_procedures' AND column_name = 'graphiste_referent_id'
    ) THEN
        ALTER TABLE franchise_procedures RENAME COLUMN graphiste_referent_id TO graphiste_referent;
    END IF;
END $$;

-- Commentaire
COMMENT ON COLUMN franchise_procedures.graphiste_referent IS 'Graphiste référent pour cette franchise (doit être un graphiste assigné à cette franchise)';
