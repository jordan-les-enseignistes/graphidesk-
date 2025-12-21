-- Migration: Ajout gestion des congés et jours fériés
-- Date: 2025-12-19

-- Ajouter le type d'absence sur les heures journalières
ALTER TABLE heures_journalieres
ADD COLUMN IF NOT EXISTS type_absence TEXT DEFAULT NULL
CHECK (type_absence IN ('conge', 'ferie', 'maladie', 'rtt', NULL));

-- Table des jours fériés (partagée pour tout le monde)
CREATE TABLE IF NOT EXISTS jours_feries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fonction pour calculer la date de Pâques (algorithme de Meeus/Jones/Butcher)
CREATE OR REPLACE FUNCTION calculer_paques(annee INTEGER)
RETURNS DATE AS $$
DECLARE
  a INTEGER;
  b INTEGER;
  c INTEGER;
  d INTEGER;
  e INTEGER;
  f INTEGER;
  g INTEGER;
  h INTEGER;
  i INTEGER;
  k INTEGER;
  l INTEGER;
  m INTEGER;
  n INTEGER;
  p INTEGER;
  mois INTEGER;
  jour INTEGER;
BEGIN
  a := annee % 19;
  b := annee / 100;
  c := annee % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  n := (h + l - 7 * m + 114) / 31;
  p := (h + l - 7 * m + 114) % 31;
  mois := n;
  jour := p + 1;
  RETURN make_date(annee, mois, jour);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour générer les jours fériés d'une année
CREATE OR REPLACE FUNCTION generer_jours_feries(annee INTEGER)
RETURNS VOID AS $$
DECLARE
  paques DATE;
BEGIN
  paques := calculer_paques(annee);

  -- Supprimer les anciens jours fériés de cette année (pour éviter les doublons)
  DELETE FROM jours_feries WHERE EXTRACT(YEAR FROM date) = annee;

  -- Jours fériés fixes
  INSERT INTO jours_feries (date, nom) VALUES
    (make_date(annee, 1, 1), 'Jour de l''An'),
    (make_date(annee, 5, 1), 'Fête du Travail'),
    (make_date(annee, 5, 8), 'Victoire 1945'),
    (make_date(annee, 7, 14), 'Fête Nationale'),
    (make_date(annee, 8, 15), 'Assomption'),
    (make_date(annee, 11, 1), 'Toussaint'),
    (make_date(annee, 11, 11), 'Armistice'),
    (make_date(annee, 12, 25), 'Noël')
  ON CONFLICT (date) DO NOTHING;

  -- Jours fériés mobiles (basés sur Pâques)
  INSERT INTO jours_feries (date, nom) VALUES
    (paques + INTERVAL '1 day', 'Lundi de Pâques'),
    (paques + INTERVAL '39 days', 'Ascension'),
    (paques + INTERVAL '50 days', 'Lundi de Pentecôte')
  ON CONFLICT (date) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Générer les jours fériés pour les 10 prochaines années
DO $$
DECLARE
  annee_courante INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  i INTEGER;
BEGIN
  FOR i IN 0..10 LOOP
    PERFORM generer_jours_feries(annee_courante + i);
  END LOOP;
END $$;

-- RLS pour jours_feries (lecture pour tous les authentifiés)
ALTER TABLE jours_feries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jours fériés visibles par tous" ON jours_feries;
CREATE POLICY "Jours fériés visibles par tous" ON jours_feries
  FOR SELECT TO authenticated USING (true);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_heures_journalieres_type_absence ON heures_journalieres(type_absence) WHERE type_absence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jours_feries_date ON jours_feries(date);

-- Activer realtime pour jours_feries (ignore si déjà ajouté)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE jours_feries;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
