-- Migration: Ajout du champ badge_color aux profiles
-- Permet aux graphistes de personnaliser la couleur de leur badge d'initiales

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT NULL;

-- Commentaire pour documenter le champ
COMMENT ON COLUMN profiles.badge_color IS 'Couleur personnalisée du badge d''initiales (blue, green, purple, pink, orange, teal, indigo, red, yellow, cyan)';
