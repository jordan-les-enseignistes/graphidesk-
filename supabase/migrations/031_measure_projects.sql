-- ============================================
-- Module Mesure photo : projets sauvegardés + workflow VT
-- ============================================
-- Un projet = une photo (Storage) + un document de mesure (jsonb)
-- Workflow : attente_vt → vt_recue (cotes réelles saisies) → terminee

-- 1. Table des projets
CREATE TABLE IF NOT EXISTS measure_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nom TEXT NOT NULL,
    dossier_id UUID REFERENCES dossiers(id) ON DELETE SET NULL,
    statut TEXT NOT NULL DEFAULT 'attente_vt'
        CHECK (statut IN ('attente_vt', 'vt_recue', 'terminee')),
    -- document de mesure complet (zones, plans, calibration) — coordonnées
    -- exprimées dans les pixels de la photo COMPRESSÉE stockée
    doc JSONB NOT NULL,
    -- cotes réelles saisies après VT : { "<zoneId>": { "widthMm": n, "heightMm": n } }
    vt_dims JSONB DEFAULT '{}'::jsonb,
    photo_path TEXT NOT NULL,
    photo_width INT NOT NULL,
    photo_height INT NOT NULL,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_measure_projects_created_by ON measure_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_measure_projects_statut ON measure_projects(statut);

-- 2. RLS : chacun ne voit que SES projets (l'admin voit tout)
ALTER TABLE measure_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own measure projects" ON measure_projects;
CREATE POLICY "Users manage own measure projects"
    ON measure_projects FOR ALL
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION update_measure_projects_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_measure_projects_updated_at ON measure_projects;
CREATE TRIGGER trigger_measure_projects_updated_at
    BEFORE UPDATE ON measure_projects
    FOR EACH ROW EXECUTE FUNCTION update_measure_projects_updated_at();

-- 4. Bucket Storage pour les photos (privé)
INSERT INTO storage.buckets (id, name, public)
VALUES ('measure-photos', 'measure-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Politiques Storage : les authentifiés gèrent les photos de ce bucket
DROP POLICY IF EXISTS "Authenticated manage measure photos" ON storage.objects;
CREATE POLICY "Authenticated manage measure photos"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'measure-photos')
    WITH CHECK (bucket_id = 'measure-photos');

-- 5. Permission du nouvel outil "Maquette suite VT"
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'access:maquette_vt'
FROM roles r
WHERE r.slug IN ('admin', 'graphiste')
ON CONFLICT (role_id, permission_key) DO NOTHING;
