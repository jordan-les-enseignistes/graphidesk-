-- ============================================
-- Système RBAC (Role-Based Access Control) granulaire
-- ============================================
--
-- Objectif :
--   Passer d'un rôle binaire (admin/graphiste) à un système de rôles
--   configurables avec des permissions cochables (type Discord).
--
-- Stratégie :
--   - Tables roles + role_permissions
--   - profiles.role_id NULLABLE FK roles (backfill depuis profiles.role)
--   - Garder profiles.role en place pour la rétro-compat (deprecate plus tard)
--   - Seed des 2 rôles système admin/graphiste avec leurs permissions par défaut
--   - Helper SQL user_has_permission(key) en SECURITY DEFINER pour les RLS futures
--
-- Cette migration ne modifie AUCUNE policy RLS existante.

-- ============================================
-- 1. TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    is_system BOOLEAN DEFAULT false NOT NULL,
    is_graphiste BOOLEAN DEFAULT false NOT NULL,
    couleur TEXT DEFAULT '#6b7280' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_slug ON roles(slug);
CREATE INDEX IF NOT EXISTS idx_roles_is_graphiste ON roles(is_graphiste);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key ON role_permissions(permission_key);

-- ============================================
-- 2. AJOUT role_id SUR profiles
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);

-- ============================================
-- 3. SEED DES RÔLES SYSTÈME
-- ============================================

INSERT INTO roles (slug, label, is_system, is_graphiste, couleur) VALUES
    ('admin', 'Administrateur', true, false, '#dc2626'),
    ('graphiste', 'Graphiste', true, true, '#3b82f6')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 4. BACKFILL profiles.role_id DEPUIS profiles.role
-- ============================================

UPDATE profiles p
SET role_id = r.id
FROM roles r
WHERE p.role_id IS NULL
  AND r.slug = p.role;

-- ============================================
-- 5. SEED DES PERMISSIONS PAR DÉFAUT
-- ============================================
-- Liste complète des 24 permissions définies pour GraphiDesk.
-- L'admin a TOUTES les permissions, le graphiste a un set de base.

-- Helper temporaire : récupérer les IDs des rôles système
DO $$
DECLARE
    admin_role_id UUID;
    graphiste_role_id UUID;
    all_perms TEXT[] := ARRAY[
        -- Catégorie 1 : Accès aux modules
        'access:dossiers_all',
        'access:franchises',
        'access:projets_internes',
        'access:statistiques',
        'access:process',
        'access:reunions',
        'access:sites_internet',
        'access:fabrik',
        'access:calculatrice',
        'access:nuancier',
        'access:feedbacks',
        'access:utilisateurs',
        'access:parametres',
        -- Catégorie 2 : Actions privilégiées
        'manage:franchises_assignations',
        'manage:projets_internes_delete',
        'manage:archives_delete',
        'manage:process',
        'manage:reunions',
        'manage:feedbacks_respond',
        'manage:dossiers_all',
        'manage:stats_per_graphiste',
        'manage:users',
        'manage:settings',
        'manage:roles'
    ];
    graphiste_perms TEXT[] := ARRAY[
        -- Le graphiste de base a accès aux modules courants mais pas aux actions privilégiées
        'access:franchises',
        'access:projets_internes',
        'access:statistiques',
        'access:process',
        'access:reunions',
        'access:sites_internet',
        'access:fabrik',
        'access:calculatrice',
        'access:nuancier',
        'access:feedbacks'
    ];
    perm TEXT;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE slug = 'admin';
    SELECT id INTO graphiste_role_id FROM roles WHERE slug = 'graphiste';

    -- Admin : toutes les permissions
    FOREACH perm IN ARRAY all_perms LOOP
        INSERT INTO role_permissions (role_id, permission_key) VALUES (admin_role_id, perm)
        ON CONFLICT (role_id, permission_key) DO NOTHING;
    END LOOP;

    -- Graphiste : permissions de base
    FOREACH perm IN ARRAY graphiste_perms LOOP
        INSERT INTO role_permissions (role_id, permission_key) VALUES (graphiste_role_id, perm)
        ON CONFLICT (role_id, permission_key) DO NOTHING;
    END LOOP;
END $$;

-- ============================================
-- 6. FONCTION HELPER user_has_permission()
-- ============================================
-- À utiliser dans les RLS policies futures.
-- SECURITY DEFINER pour bypass la RLS sur roles/role_permissions/profiles.

CREATE OR REPLACE FUNCTION user_has_permission(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_perm BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM profiles p
        INNER JOIN role_permissions rp ON rp.role_id = p.role_id
        WHERE p.id = auth.uid()
          AND rp.permission_key = p_key
    ) INTO has_perm;
    RETURN COALESCE(has_perm, false);
END;
$$;

GRANT EXECUTE ON FUNCTION user_has_permission(TEXT) TO authenticated;

-- ============================================
-- 7. TRIGGER updated_at SUR roles
-- ============================================

CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_roles_updated_at ON roles;
CREATE TRIGGER trigger_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_roles_updated_at();

-- ============================================
-- 8. RLS POLICIES SUR roles ET role_permissions
-- ============================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les authentifiés (pour que le frontend puisse afficher le badge rôle, etc.)
DROP POLICY IF EXISTS "Roles are viewable by authenticated users" ON roles;
CREATE POLICY "Roles are viewable by authenticated users"
    ON roles FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Role permissions are viewable by authenticated users" ON role_permissions;
CREATE POLICY "Role permissions are viewable by authenticated users"
    ON role_permissions FOR SELECT
    TO authenticated USING (true);

-- Écriture : admins uniquement (utilise le système existant pour la rétro-compat)
DROP POLICY IF EXISTS "Only admins can manage roles" ON roles;
CREATE POLICY "Only admins can manage roles"
    ON roles FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Only admins can manage role permissions" ON role_permissions;
CREATE POLICY "Only admins can manage role permissions"
    ON role_permissions FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- 9. CONTRAINTE : empêcher la suppression des rôles système
-- ============================================

CREATE OR REPLACE FUNCTION prevent_system_role_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_system = true THEN
        RAISE EXCEPTION 'Impossible de supprimer un rôle système (%)', OLD.slug;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_system_role_deletion ON roles;
CREATE TRIGGER trigger_prevent_system_role_deletion
    BEFORE DELETE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_system_role_deletion();

-- ============================================
-- 10. MISE À JOUR DES RPC STATS POUR FILTRER SUR is_graphiste
-- ============================================
-- Ces RPC retournaient des stats pour TOUS les profils actifs, y compris admins.
-- On les filtre pour ne garder que les rôles is_graphiste = true.

-- get_stats_bat_par_graphiste : filtrer
CREATE OR REPLACE FUNCTION get_stats_bat_par_graphiste(p_annee INT DEFAULT NULL)
RETURNS TABLE (
  graphiste_id UUID,
  total_bats BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.graphiste_id,
    COUNT(db.id)::BIGINT as total_bats
  FROM dossier_bats db
  INNER JOIN dossiers d ON db.dossier_id = d.id
  INNER JOIN profiles p ON p.id = d.graphiste_id
  LEFT JOIN roles r ON r.id = p.role_id
  WHERE (p_annee IS NULL OR EXTRACT(YEAR FROM db.date_envoi) = p_annee)
    AND COALESCE(r.is_graphiste, true) = true
  GROUP BY d.graphiste_id;
END;
$$;

-- NOTE : pour les autres RPC (get_stats_par_graphiste, get_stats_graphiste_par_statut,
-- get_stats_archives_par_graphiste) définis dans 024_stats_aggregated_rpc.sql,
-- elles seront mises à jour dans une migration séparée car elles touchent à des
-- structures de stats plus complexes. Pour l'instant le filtrage est appliqué
-- côté frontend via useGraphistes() qui ne renvoie plus que les is_graphiste=true.

-- ============================================
-- FIN
-- ============================================
