-- Système de suivi des BAT (Bon À Tirer)
-- Un BAT = une version envoyée au client

-- Table pour stocker l'historique des BATs
CREATE TABLE IF NOT EXISTS dossier_bats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    date_envoi timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES profiles(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_dossier_bats_dossier_id ON dossier_bats(dossier_id);
CREATE INDEX IF NOT EXISTS idx_dossier_bats_date_envoi ON dossier_bats(date_envoi DESC);

-- Ajouter une colonne pour le compteur de BATs dans dossiers (pour optimiser les requêtes)
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS bat_count integer DEFAULT 0;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS dernier_bat timestamp with time zone;

-- Fonction pour mettre à jour le compteur de BATs
CREATE OR REPLACE FUNCTION update_bat_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE dossiers
        SET
            bat_count = COALESCE(bat_count, 0) + 1,
            dernier_bat = NEW.date_envoi,
            updated_at = now()
        WHERE id = NEW.dossier_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE dossiers
        SET
            bat_count = GREATEST(COALESCE(bat_count, 0) - 1, 0),
            dernier_bat = (SELECT MAX(date_envoi) FROM dossier_bats WHERE dossier_id = OLD.dossier_id),
            updated_at = now()
        WHERE id = OLD.dossier_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour maintenir le compteur à jour
DROP TRIGGER IF EXISTS trigger_update_bat_count ON dossier_bats;
CREATE TRIGGER trigger_update_bat_count
    AFTER INSERT OR DELETE ON dossier_bats
    FOR EACH ROW
    EXECUTE FUNCTION update_bat_count();

-- RLS policies pour dossier_bats
ALTER TABLE dossier_bats ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent voir les BATs
CREATE POLICY "Users can view BATs" ON dossier_bats
    FOR SELECT TO authenticated USING (true);

-- Tous les utilisateurs authentifiés peuvent ajouter des BATs
CREATE POLICY "Users can insert BATs" ON dossier_bats
    FOR INSERT TO authenticated WITH CHECK (true);

-- Tous les utilisateurs authentifiés peuvent supprimer des BATs (en cas de miss-click)
CREATE POLICY "Users can delete BATs" ON dossier_bats
    FOR DELETE TO authenticated USING (true);

-- Supprimer la colonne deadline_premiere_reponse si elle n'est plus utilisée
-- (Commenté pour l'instant, à décommenter après migration complète)
-- ALTER TABLE dossiers DROP COLUMN IF EXISTS deadline_premiere_reponse;
-- ALTER TABLE dossiers DROP COLUMN IF EXISTS deadline_commentaires;
