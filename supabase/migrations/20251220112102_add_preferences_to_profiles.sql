-- Ajouter le champ preferences aux profils pour les préférences utilisateur
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"minimize_on_close": true}'::jsonb;

-- Mettre à jour les profils existants avec la valeur par défaut
UPDATE profiles
SET preferences = '{"minimize_on_close": true}'::jsonb
WHERE preferences IS NULL;
