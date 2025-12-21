-- Table pour stocker les sites internet avec leurs identifiants
CREATE TABLE IF NOT EXISTS sites_internet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  url TEXT,
  identifiant TEXT,
  mot_de_passe TEXT, -- Stocké en clair car c'est un outil interne, pas des credentials de prod
  notes TEXT,
  categorie TEXT,
  ordre INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour le tri
CREATE INDEX IF NOT EXISTS idx_sites_internet_ordre ON sites_internet(ordre, nom);
CREATE INDEX IF NOT EXISTS idx_sites_internet_categorie ON sites_internet(categorie);

-- RLS
ALTER TABLE sites_internet ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent voir les sites
CREATE POLICY "Authenticated users can view sites" ON sites_internet
  FOR SELECT TO authenticated USING (true);

-- Tous les utilisateurs authentifiés peuvent créer des sites
CREATE POLICY "Authenticated users can create sites" ON sites_internet
  FOR INSERT TO authenticated WITH CHECK (true);

-- Tous les utilisateurs authentifiés peuvent modifier des sites
CREATE POLICY "Authenticated users can update sites" ON sites_internet
  FOR UPDATE TO authenticated USING (true);

-- Seuls les admins peuvent supprimer des sites
CREATE POLICY "Only admins can delete sites" ON sites_internet
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_sites_internet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sites_internet_updated_at
  BEFORE UPDATE ON sites_internet
  FOR EACH ROW
  EXECUTE FUNCTION update_sites_internet_updated_at();
