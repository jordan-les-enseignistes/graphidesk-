-- Migration: Table contacts pour l'annuaire de la société
-- Permet de stocker les contacts internes (collègues) et externes (fournisseurs, partenaires, etc.)

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Informations de base
  nom TEXT NOT NULL,
  prenom TEXT,

  -- Type de contact
  type TEXT NOT NULL DEFAULT 'interne' CHECK (type IN ('interne', 'externe')),

  -- Pour les internes : rôle dans l'entreprise (ex: "Graphiste", "Commercial", "Comptable")
  -- Pour les externes : fonction dans leur entreprise
  fonction TEXT,

  -- Pour les externes uniquement : nom de l'entreprise
  entreprise TEXT,

  -- Coordonnées
  telephone TEXT,
  email TEXT,

  -- Notes additionnelles
  notes TEXT,

  -- Métadonnées
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_nom ON contacts(nom);
CREATE INDEX idx_contacts_entreprise ON contacts(entreprise) WHERE entreprise IS NOT NULL;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- RLS Policies
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les contacts
CREATE POLICY "Tous peuvent voir les contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

-- Tout le monde peut créer des contacts
CREATE POLICY "Tous peuvent créer des contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tout le monde peut modifier les contacts
CREATE POLICY "Tous peuvent modifier les contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (true);

-- Tout le monde peut supprimer les contacts
CREATE POLICY "Tous peuvent supprimer les contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (true);

-- Commentaires
COMMENT ON TABLE contacts IS 'Annuaire de contacts internes et externes de la société';
COMMENT ON COLUMN contacts.type IS 'Type de contact: interne (collègue) ou externe (fournisseur, partenaire, etc.)';
COMMENT ON COLUMN contacts.fonction IS 'Rôle/fonction du contact dans son entreprise';
COMMENT ON COLUMN contacts.entreprise IS 'Nom de l''entreprise (pour les contacts externes uniquement)';
