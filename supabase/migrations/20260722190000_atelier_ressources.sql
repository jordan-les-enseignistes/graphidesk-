-- ============================================
-- Kit du nouvel arrivant : ressources de l'atelier installables en un clic
-- ============================================
-- Une ressource = un fichier (nuancier Illustrator, gabarit InDesign, script
-- InDesign, squelette de dossier zippé...) que GraphiDesk sait déposer
-- DIRECTEMENT au bon endroit sur le poste, sans que le graphiste ait à savoir
-- où Adobe range ses préréglages.
--
-- ⚠ Migration IDEMPOTENTE : elle peut être rejouée sans casse. La version
--   précédente de ce fichier n'a jamais été commitée et peut avoir été
--   appliquée à la main — on ne veut pas avoir à le savoir.

CREATE TABLE IF NOT EXISTS public.atelier_ressources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    categorie TEXT NOT NULL,
    fichier_path TEXT NOT NULL,
    taille BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Nom de fichier RÉEL, extension comprise. Sans lui, `nom` servait de nom de
-- fichier : un nuancier appelé « RAL Classic » atterrissait sans extension et
-- Illustrator ne le voyait pas.
ALTER TABLE public.atelier_ressources
    ADD COLUMN IF NOT EXISTS fichier_nom TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS version TEXT,
    ADD COLUMN IF NOT EXISTS ordre INT NOT NULL DEFAULT 0;

UPDATE public.atelier_ressources SET fichier_nom = nom WHERE fichier_nom IS NULL;

-- Les catégories décident de la DESTINATION d'installation, pas seulement de
-- l'affichage : c'est le cœur du module.
--   nuancier        -> préréglages Nuancier d'Illustrator (poste utilisateur)
--   script_indesign -> panneau Scripts d'InDesign
--   gabarit         -> Documents (aucun dossier système ne convient)
--   squelette       -> .zip déplié à l'endroit choisi, pour ouvrir un chantier
--   autre           -> Documents
ALTER TABLE public.atelier_ressources DROP CONSTRAINT IF EXISTS atelier_ressources_categorie_check;
ALTER TABLE public.atelier_ressources ADD CONSTRAINT atelier_ressources_categorie_check
    CHECK (categorie IN ('nuancier', 'gabarit', 'script_indesign', 'squelette', 'autre'));

CREATE INDEX IF NOT EXISTS idx_atelier_ressources_cat
    ON public.atelier_ressources (categorie, ordre, nom);

-- RLS : tout authentifié lit et gère, comme la bibliothèque d'injection
-- (décision Jordan 16/07/2026). Le garde-fou est dans l'interface : seuls les
-- admins voient la zone d'ajout et de suppression.
ALTER TABLE public.atelier_ressources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atelier_ressources_select" ON public.atelier_ressources;
DROP POLICY IF EXISTS "atelier_ressources_insert" ON public.atelier_ressources;
DROP POLICY IF EXISTS "atelier_ressources_delete" ON public.atelier_ressources;
DROP POLICY IF EXISTS "Authenticated manage atelier ressources" ON public.atelier_ressources;
CREATE POLICY "Authenticated manage atelier ressources"
    ON public.atelier_ressources FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Bucket privé pour les fichiers
INSERT INTO storage.buckets (id, name, public)
VALUES ('atelier-ressources', 'atelier-ressources', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "atelier_ressources_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "atelier_ressources_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "atelier_ressources_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated manage atelier files" ON storage.objects;
CREATE POLICY "Authenticated manage atelier files"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'atelier-ressources')
    WITH CHECK (bucket_id = 'atelier-ressources');

-- Permission d'accès à la page (admin + graphiste par défaut)
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'access:ressources'
FROM roles r
WHERE r.slug IN ('admin', 'graphiste')
ON CONFLICT (role_id, permission_key) DO NOTHING;
