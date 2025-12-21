-- Migration: Favoris de process par utilisateur
-- Cette table stocke les process favoris/épinglés pour chaque utilisateur

-- Table des favoris de process
CREATE TABLE IF NOT EXISTS process_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, process_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_process_favorites_user_id ON process_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_process_favorites_process_id ON process_favorites(process_id);

-- RLS (Row Level Security)
ALTER TABLE process_favorites ENABLE ROW LEVEL SECURITY;

-- Politique: chaque utilisateur peut voir/gérer ses propres favoris
CREATE POLICY "Les utilisateurs peuvent voir leurs favoris"
  ON process_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent créer leurs favoris"
  ON process_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs favoris"
  ON process_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Commentaires
COMMENT ON TABLE process_favorites IS 'Stocke les process favoris/épinglés pour chaque utilisateur';
COMMENT ON COLUMN process_favorites.user_id IS 'ID de l''utilisateur qui a mis en favori';
COMMENT ON COLUMN process_favorites.process_id IS 'ID du process mis en favori';
