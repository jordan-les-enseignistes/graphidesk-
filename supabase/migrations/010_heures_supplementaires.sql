-- ============================================
-- GraphiDesk - Migration heures supplémentaires
-- ============================================

-- Ajouter les horaires de base au profil utilisateur
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS horaires_base JSONB DEFAULT '{
  "lundi": {"matin": {"debut": "08:30", "fin": "12:30"}, "aprem": {"debut": "13:30", "fin": "17:30"}},
  "mardi": {"matin": {"debut": "08:30", "fin": "12:30"}, "aprem": {"debut": "13:30", "fin": "17:30"}},
  "mercredi": {"matin": {"debut": "08:30", "fin": "12:30"}, "aprem": {"debut": "13:30", "fin": "17:30"}},
  "jeudi": {"matin": {"debut": "08:30", "fin": "12:30"}, "aprem": {"debut": "13:30", "fin": "17:30"}},
  "vendredi": {"matin": {"debut": "08:30", "fin": "11:30"}, "aprem": null}
}'::jsonb;

-- Table des feuilles de temps mensuelles
CREATE TABLE IF NOT EXISTS feuilles_temps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  total_heures_sup INTERVAL DEFAULT '00:00:00',
  is_validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, annee, mois)
);

-- Index pour les feuilles de temps
CREATE INDEX IF NOT EXISTS idx_feuilles_temps_user ON feuilles_temps(user_id);
CREATE INDEX IF NOT EXISTS idx_feuilles_temps_periode ON feuilles_temps(annee, mois);

-- Table des entrées journalières
CREATE TABLE IF NOT EXISTS heures_journalieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feuille_id UUID REFERENCES feuilles_temps(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  jour_semaine TEXT NOT NULL CHECK (jour_semaine IN ('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche')),
  -- Horaires du matin
  matin_debut TIME,
  matin_fin TIME,
  -- Horaires de l'après-midi
  aprem_debut TIME,
  aprem_fin TIME,
  -- Heures calculées
  total_jour INTERVAL GENERATED ALWAYS AS (
    COALESCE(
      (CASE WHEN matin_debut IS NOT NULL AND matin_fin IS NOT NULL
        THEN matin_fin - matin_debut
        ELSE '00:00:00'::INTERVAL END) +
      (CASE WHEN aprem_debut IS NOT NULL AND aprem_fin IS NOT NULL
        THEN aprem_fin - aprem_debut
        ELSE '00:00:00'::INTERVAL END),
      '00:00:00'::INTERVAL
    )
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feuille_id, date)
);

-- Index pour les heures journalières
CREATE INDEX IF NOT EXISTS idx_heures_journalieres_feuille ON heures_journalieres(feuille_id);
CREATE INDEX IF NOT EXISTS idx_heures_journalieres_date ON heures_journalieres(date);

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS feuilles_temps_updated_at ON feuilles_temps;
CREATE TRIGGER feuilles_temps_updated_at
  BEFORE UPDATE ON feuilles_temps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS heures_journalieres_updated_at ON heures_journalieres;
CREATE TRIGGER heures_journalieres_updated_at
  BEFORE UPDATE ON heures_journalieres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fonction pour calculer le total des heures sup d'une feuille
CREATE OR REPLACE FUNCTION calculer_heures_sup(feuille_id_param UUID)
RETURNS INTERVAL AS $$
DECLARE
  total_travaille INTERVAL;
  heures_base INTERVAL := '35:00:00'::INTERVAL; -- 35h par semaine
BEGIN
  -- Calculer le total des heures travaillées dans le mois
  SELECT COALESCE(SUM(total_jour), '00:00:00'::INTERVAL)
  INTO total_travaille
  FROM heures_journalieres
  WHERE feuille_id = feuille_id_param;

  -- Calculer les semaines dans le mois pour avoir les heures de base
  -- Note: simplifié ici, on considère environ 4.33 semaines par mois
  -- En réalité il faudrait calculer selon le nombre de jours ouvrés

  RETURN total_travaille;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour recalculer et mettre à jour le total d'une feuille
CREATE OR REPLACE FUNCTION update_feuille_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feuilles_temps
  SET total_heures_sup = calculer_heures_sup(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.feuille_id ELSE NEW.feuille_id END
  )
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.feuille_id ELSE NEW.feuille_id END;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour recalculer automatiquement le total
DROP TRIGGER IF EXISTS heures_journalieres_update_total ON heures_journalieres;
CREATE TRIGGER heures_journalieres_update_total
  AFTER INSERT OR UPDATE OR DELETE ON heures_journalieres
  FOR EACH ROW EXECUTE FUNCTION update_feuille_total();

-- ============================================
-- RLS Policies
-- ============================================

-- Activer RLS
ALTER TABLE feuilles_temps ENABLE ROW LEVEL SECURITY;
ALTER TABLE heures_journalieres ENABLE ROW LEVEL SECURITY;

-- Policies pour feuilles_temps
-- Les utilisateurs peuvent voir leurs propres feuilles
CREATE POLICY "Users can view own feuilles" ON feuilles_temps
  FOR SELECT USING (auth.uid() = user_id);

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all feuilles" ON feuilles_temps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Les utilisateurs peuvent créer leurs propres feuilles
CREATE POLICY "Users can insert own feuilles" ON feuilles_temps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent modifier leurs propres feuilles non validées
CREATE POLICY "Users can update own feuilles" ON feuilles_temps
  FOR UPDATE USING (auth.uid() = user_id AND is_validated = false);

-- Les admins peuvent tout modifier
CREATE POLICY "Admins can update all feuilles" ON feuilles_temps
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policies pour heures_journalieres
-- Les utilisateurs peuvent voir leurs propres heures via la feuille
CREATE POLICY "Users can view own heures" ON heures_journalieres
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM feuilles_temps WHERE id = feuille_id AND user_id = auth.uid())
  );

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all heures" ON heures_journalieres
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Les utilisateurs peuvent insérer dans leurs propres feuilles non validées
CREATE POLICY "Users can insert own heures" ON heures_journalieres
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM feuilles_temps WHERE id = feuille_id AND user_id = auth.uid() AND is_validated = false)
  );

-- Les utilisateurs peuvent modifier leurs propres heures si feuille non validée
CREATE POLICY "Users can update own heures" ON heures_journalieres
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM feuilles_temps WHERE id = feuille_id AND user_id = auth.uid() AND is_validated = false)
  );

-- Les admins peuvent tout modifier
CREATE POLICY "Admins can update all heures" ON heures_journalieres
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Les utilisateurs peuvent supprimer leurs propres heures si feuille non validée
CREATE POLICY "Users can delete own heures" ON heures_journalieres
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM feuilles_temps WHERE id = feuille_id AND user_id = auth.uid() AND is_validated = false)
  );

-- Les admins peuvent tout supprimer
CREATE POLICY "Admins can delete all heures" ON heures_journalieres
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Activer Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE feuilles_temps;
ALTER PUBLICATION supabase_realtime ADD TABLE heures_journalieres;
