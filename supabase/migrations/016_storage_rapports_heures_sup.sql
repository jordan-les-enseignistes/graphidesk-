-- Migration: Bucket Storage pour les rapports heures sup
-- Date: 2025-12-19

-- Créer le bucket pour les rapports (public pour accès via lien)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rapports-heures-sup',
  'rapports-heures-sup',
  true,
  5242880, -- 5MB max
  ARRAY['text/html']
)
ON CONFLICT (id) DO NOTHING;

-- Politique: tout le monde peut lire (public)
CREATE POLICY "Public read access for rapports" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'rapports-heures-sup');

-- Politique: seuls les admins peuvent uploader/supprimer
CREATE POLICY "Admins can upload rapports" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'rapports-heures-sup'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete rapports" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'rapports-heures-sup'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Politique: service role peut tout faire (pour l'Edge Function)
CREATE POLICY "Service role full access rapports" ON storage.objects
  FOR ALL
  USING (bucket_id = 'rapports-heures-sup')
  WITH CHECK (bucket_id = 'rapports-heures-sup');
