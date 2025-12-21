-- Table des process (procédures internes)
CREATE TABLE process (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  -- Type de process: 'texte' pour rédigé, 'pdf' pour fichier uploadé
  type TEXT NOT NULL DEFAULT 'texte' CHECK (type IN ('texte', 'pdf')),
  -- Contenu texte (pour type 'texte' ou extraction PDF pour recherche)
  contenu TEXT,
  -- URL du fichier PDF dans le storage (pour type 'pdf')
  fichier_url TEXT,
  fichier_nom TEXT,
  -- Organisation
  categorie TEXT,
  ordre INTEGER DEFAULT 0,
  -- Soft delete pour corbeille admin
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id),
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Index pour la recherche full-text
CREATE INDEX process_contenu_search_idx ON process USING gin(to_tsvector('french', coalesce(titre, '') || ' ' || coalesce(description, '') || ' ' || coalesce(contenu, '')));

-- Index pour le soft delete
CREATE INDEX process_deleted_at_idx ON process(deleted_at);

-- Trigger pour updated_at
CREATE TRIGGER process_updated_at
  BEFORE UPDATE ON process
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE process ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent voir les process non supprimés
CREATE POLICY "process_select" ON process
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- Admins peuvent voir aussi les supprimés (pour la corbeille)
CREATE POLICY "process_select_deleted_admin" ON process
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Tous peuvent créer
CREATE POLICY "process_insert" ON process
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Tous peuvent modifier les process non supprimés
CREATE POLICY "process_update" ON process
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);

-- Seuls les admins peuvent vraiment supprimer (hard delete)
CREATE POLICY "process_delete" ON process
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Storage bucket pour les fichiers PDF
INSERT INTO storage.buckets (id, name, public)
VALUES ('process', 'process', false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage
CREATE POLICY "process_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'process');

CREATE POLICY "process_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'process');

CREATE POLICY "process_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'process');

CREATE POLICY "process_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'process');
