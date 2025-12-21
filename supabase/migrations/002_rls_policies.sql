-- ============================================
-- GraphiDesk - Row Level Security (RLS)
-- ============================================

-- ============================================
-- PROFILES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les profils actifs (pour afficher les noms)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Seul l'admin peut modifier les profils (sauf le sien pour certains champs)
DROP POLICY IF EXISTS "Only admins can update profiles" ON profiles;
CREATE POLICY "Only admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seul l'admin peut créer des profils
DROP POLICY IF EXISTS "Only admins can insert profiles" ON profiles;
CREATE POLICY "Only admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- DOSSIERS
-- ============================================
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;

-- SELECT : graphiste voit les siens + archives, admin voit tout
DROP POLICY IF EXISTS "Users can view own dossiers and archives" ON dossiers;
CREATE POLICY "Users can view own dossiers and archives"
  ON dossiers FOR SELECT
  TO authenticated
  USING (
    graphiste_id = auth.uid()
    OR is_archived = true
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT : graphiste crée pour lui-même, admin pour n'importe qui
DROP POLICY IF EXISTS "Users can create dossiers" ON dossiers;
CREATE POLICY "Users can create dossiers"
  ON dossiers FOR INSERT
  TO authenticated
  WITH CHECK (
    graphiste_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE : graphiste modifie les siens, admin modifie tout
DROP POLICY IF EXISTS "Users can update own dossiers" ON dossiers;
CREATE POLICY "Users can update own dossiers"
  ON dossiers FOR UPDATE
  TO authenticated
  USING (
    graphiste_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE : admin seulement
DROP POLICY IF EXISTS "Only admins can delete dossiers" ON dossiers;
CREATE POLICY "Only admins can delete dossiers"
  ON dossiers FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- FRANCHISES
-- ============================================
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les franchises
DROP POLICY IF EXISTS "Franchises are viewable by all" ON franchises;
CREATE POLICY "Franchises are viewable by all"
  ON franchises FOR SELECT
  TO authenticated
  USING (true);

-- Seul l'admin peut gérer les franchises
DROP POLICY IF EXISTS "Only admins can manage franchises" ON franchises;
CREATE POLICY "Only admins can manage franchises"
  ON franchises FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- FRANCHISE_ASSIGNMENTS
-- ============================================
ALTER TABLE franchise_assignments ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les assignations
DROP POLICY IF EXISTS "Assignments are viewable by all" ON franchise_assignments;
CREATE POLICY "Assignments are viewable by all"
  ON franchise_assignments FOR SELECT
  TO authenticated
  USING (true);

-- Seul l'admin peut gérer les assignations
DROP POLICY IF EXISTS "Only admins can manage assignments" ON franchise_assignments;
CREATE POLICY "Only admins can manage assignments"
  ON franchise_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- PROJETS_INTERNES
-- ============================================
ALTER TABLE projets_internes ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les projets internes
DROP POLICY IF EXISTS "Projets internes are viewable by all" ON projets_internes;
CREATE POLICY "Projets internes are viewable by all"
  ON projets_internes FOR SELECT
  TO authenticated
  USING (true);

-- Graphiste peut créer des projets assignés à lui, admin peut tout créer
DROP POLICY IF EXISTS "Users can create projets internes" ON projets_internes;
CREATE POLICY "Users can create projets internes"
  ON projets_internes FOR INSERT
  TO authenticated
  WITH CHECK (
    graphiste_id = auth.uid()
    OR graphiste_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Graphiste modifie les siens, admin modifie tout
DROP POLICY IF EXISTS "Users can update own projets internes" ON projets_internes;
CREATE POLICY "Users can update own projets internes"
  ON projets_internes FOR UPDATE
  TO authenticated
  USING (
    graphiste_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seul l'admin peut supprimer
DROP POLICY IF EXISTS "Only admins can delete projets internes" ON projets_internes;
CREATE POLICY "Only admins can delete projets internes"
  ON projets_internes FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- ACTIVITY_LOGS
-- ============================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les logs (transparence)
DROP POLICY IF EXISTS "Activity logs are viewable by all" ON activity_logs;
CREATE POLICY "Activity logs are viewable by all"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- Tout le monde peut créer des logs
DROP POLICY IF EXISTS "Users can create logs" ON activity_logs;
CREATE POLICY "Users can create logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- APP_SETTINGS
-- ============================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les paramètres
DROP POLICY IF EXISTS "App settings are viewable by all" ON app_settings;
CREATE POLICY "App settings are viewable by all"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Seul l'admin peut modifier les paramètres
DROP POLICY IF EXISTS "Only admins can update app settings" ON app_settings;
CREATE POLICY "Only admins can update app settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
