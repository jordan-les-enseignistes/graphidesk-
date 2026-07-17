-- ============================================
-- Injecteur de fichiers : bibliothèque partagée de visuels récurrents
-- ============================================
-- Un item = un fichier vectoriel (.ai dans Storage) + une vignette PNG +
-- des variantes de taille (même visuel, dimensions réelles différentes —
-- ex. enseigne drapeau 400x600 / 600x800). Injection dans le document
-- Illustrator actif à l'échelle 1:10 (défaut) ou 1:1.

-- 1. Table des items
CREATE TABLE IF NOT EXISTS biblio_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nom TEXT NOT NULL,
    categorie TEXT NOT NULL,
    sous_categorie TEXT,
    -- [{ "label": "Standard", "largeurMm": 400, "hauteurMm": 600 }, ...]
    variantes JSONB NOT NULL DEFAULT '[]'::jsonb,
    fichier_path TEXT NOT NULL,
    preview_path TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_biblio_items_categorie ON biblio_items(categorie, sous_categorie);

-- 2. RLS : TOUT LE MONDE (authentifié) lit, ajoute, modifie et supprime
-- (décision Jordan 16/07/2026 — « si trop d'abus, je ferai le tri »)
ALTER TABLE biblio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage biblio items" ON biblio_items;
CREATE POLICY "Authenticated manage biblio items"
    ON biblio_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Bucket Storage (privé, accès authentifié)
INSERT INTO storage.buckets (id, name, public)
VALUES ('biblio-items', 'biblio-items', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated manage biblio files" ON storage.objects;
CREATE POLICY "Authenticated manage biblio files"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'biblio-items')
    WITH CHECK (bucket_id = 'biblio-items');

-- 4. Permission d'accès à la page (admin + graphiste par défaut)
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'access:bibliotheque'
FROM roles r
WHERE r.slug IN ('admin', 'graphiste')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Type d'item : 'objet' (visuel redimensionné à l'injection) ou 'plan'
-- (plan de travail complet réinjecté tel quel, cotes du graphiste incluses)
ALTER TABLE biblio_items ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'objet'
    CHECK (type IN ('objet', 'plan'));

-- ============================================
-- Bibliothèque v2 : corbeille 30 jours, favoris, journal d'injections
-- ============================================
ALTER TABLE biblio_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_biblio_items_deleted ON biblio_items(deleted_at);

CREATE TABLE IF NOT EXISTS biblio_favoris (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES biblio_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, item_id)
);
ALTER TABLE biblio_favoris ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own favoris" ON biblio_favoris;
CREATE POLICY "Users manage own favoris"
    ON biblio_favoris FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS biblio_injections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES biblio_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biblio_injections_item ON biblio_injections(item_id);
ALTER TABLE biblio_injections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage biblio injections" ON biblio_injections;
CREATE POLICY "Authenticated manage biblio injections"
    ON biblio_injections FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
