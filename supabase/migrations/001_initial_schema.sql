-- ============================================
-- GraphiDesk - Migration initiale
-- ============================================

-- Table des profils utilisateurs (extension de auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'graphiste' CHECK (role IN ('admin', 'graphiste')),
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des dossiers
CREATE TABLE IF NOT EXISTS dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graphiste_id UUID REFERENCES profiles(id) NOT NULL,
  nom TEXT NOT NULL,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  deadline_premiere_reponse DATE,
  deadline_commentaires DATE,
  statut TEXT DEFAULT 'A faire',
  has_commentaires BOOLEAN DEFAULT false,
  commentaires TEXT,
  is_archived BOOLEAN DEFAULT false,
  date_archivage TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_dossiers_graphiste ON dossiers(graphiste_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut ON dossiers(statut);
CREATE INDEX IF NOT EXISTS idx_dossiers_archived ON dossiers(is_archived);
CREATE INDEX IF NOT EXISTS idx_dossiers_created ON dossiers(date_creation DESC);

-- Table des franchises
CREATE TABLE IF NOT EXISTS franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table d'association franchise-graphiste (many-to-many)
CREATE TABLE IF NOT EXISTS franchise_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
  graphiste_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(franchise_id, graphiste_id)
);

-- Table des projets internes
CREATE TABLE IF NOT EXISTS projets_internes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial TEXT,
  tache TEXT NOT NULL,
  demande TEXT,
  graphiste_id UUID REFERENCES profiles(id),
  is_termine BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_record ON activity_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- Table des paramètres applicatifs
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paramètres initiaux
INSERT INTO app_settings (key, value) VALUES
  ('statuts', '["A faire", "En cours", "Attente R.", "Stand-by", "À relancer", "Mairie", "! Urgent !"]'),
  ('app_version', '"1.0.0"')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur les tables concernées
DROP TRIGGER IF EXISTS dossiers_updated_at ON dossiers;
CREATE TRIGGER dossiers_updated_at
  BEFORE UPDATE ON dossiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projets_internes_updated_at ON projets_internes;
CREATE TRIGGER projets_internes_updated_at
  BEFORE UPDATE ON projets_internes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger pour créer automatiquement le profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, initials, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'initials', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'graphiste')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger pour mettre à jour has_commentaires automatiquement
CREATE OR REPLACE FUNCTION update_has_commentaires()
RETURNS TRIGGER AS $$
BEGIN
  NEW.has_commentaires = (NEW.commentaires IS NOT NULL AND NEW.commentaires != '' AND NEW.commentaires != '-');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dossiers_has_commentaires ON dossiers;
CREATE TRIGGER dossiers_has_commentaires
  BEFORE INSERT OR UPDATE ON dossiers
  FOR EACH ROW EXECUTE FUNCTION update_has_commentaires();

-- Trigger pour mettre à jour date_archivage automatiquement
CREATE OR REPLACE FUNCTION update_date_archivage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_archived = true AND OLD.is_archived = false THEN
    NEW.date_archivage = NOW();
  ELSIF NEW.is_archived = false THEN
    NEW.date_archivage = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dossiers_date_archivage ON dossiers;
CREATE TRIGGER dossiers_date_archivage
  BEFORE UPDATE ON dossiers
  FOR EACH ROW EXECUTE FUNCTION update_date_archivage();
