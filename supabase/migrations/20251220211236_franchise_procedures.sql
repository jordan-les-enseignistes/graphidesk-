-- Migration: Table franchise_procedures pour documenter les procédures spécifiques à chaque franchise
-- Permet aux graphistes de documenter et partager les process de chaque franchise

CREATE TABLE franchise_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien vers la franchise (unique = une seule procédure par franchise)
  franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- Contacts et responsables
  commercial TEXT,
  graphiste_referent TEXT,
  franchiseur_contacts TEXT, -- Emails/contacts du franchiseur

  -- Options de workflow (boolean)
  mail_franchiseur BOOLEAN DEFAULT false, -- Envoyer les BAT au franchiseur ?
  mail_franchise BOOLEAN DEFAULT false,   -- Envoyer les BAT au franchisé ?
  bat_avant_vt BOOLEAN DEFAULT false,     -- Faire le BAT avant la visite technique ?
  signaletique_provisoire BOOLEAN DEFAULT false, -- Signalétique provisoire nécessaire ?

  -- Détails signalétique provisoire
  signaletique_provisoire_details TEXT,

  -- Étapes clés et informations supplémentaires (texte long, peut contenir du markdown)
  etapes_cles TEXT,

  -- Métadonnées
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_franchise_procedures_franchise ON franchise_procedures(franchise_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_franchise_procedures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER franchise_procedures_updated_at
  BEFORE UPDATE ON franchise_procedures
  FOR EACH ROW
  EXECUTE FUNCTION update_franchise_procedures_updated_at();

-- RLS Policies
ALTER TABLE franchise_procedures ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les procédures
CREATE POLICY "Tous peuvent voir les procédures franchises"
  ON franchise_procedures FOR SELECT
  TO authenticated
  USING (true);

-- Tout le monde peut créer des procédures
CREATE POLICY "Tous peuvent créer des procédures franchises"
  ON franchise_procedures FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tout le monde peut modifier les procédures
CREATE POLICY "Tous peuvent modifier les procédures franchises"
  ON franchise_procedures FOR UPDATE
  TO authenticated
  USING (true);

-- Tout le monde peut supprimer les procédures
CREATE POLICY "Tous peuvent supprimer les procédures franchises"
  ON franchise_procedures FOR DELETE
  TO authenticated
  USING (true);

-- Commentaires
COMMENT ON TABLE franchise_procedures IS 'Procédures et workflows spécifiques à chaque franchise';
COMMENT ON COLUMN franchise_procedures.mail_franchiseur IS 'Faut-il envoyer les BAT au franchiseur pour validation ?';
COMMENT ON COLUMN franchise_procedures.mail_franchise IS 'Faut-il envoyer les BAT au franchisé ?';
COMMENT ON COLUMN franchise_procedures.bat_avant_vt IS 'Faut-il faire le BAT avant la visite technique ?';
COMMENT ON COLUMN franchise_procedures.signaletique_provisoire IS 'Y a-t-il une signalétique provisoire à prévoir ?';
COMMENT ON COLUMN franchise_procedures.etapes_cles IS 'Étapes clés et informations importantes pour traiter cette franchise';
