-- Filtrage des RPC stats sur is_graphiste + hardcode admin comme graphiste
--
-- Problème : les RPC get_stats_par_graphiste / get_stats_graphiste_par_statut /
-- get_stats_archives_par_graphiste retournaient les stats pour TOUS les profils actifs,
-- y compris les non-graphistes (qui n'ont jamais de dossiers, donc 0 partout mais
-- apparaissent comme "0 dossiers" dans les graphiques).
--
-- Solution :
--   1. Filtrer ces RPC sur les rôles is_graphiste = true (via JOIN avec roles)
--   2. Hardcoder le rôle admin comme is_graphiste = true (Jordan veut apparaître
--      dans les listes de graphistes tout en gardant ses droits admin)

-- ============================================
-- 1. Hardcode admin comme is_graphiste
-- ============================================
UPDATE roles SET is_graphiste = true WHERE slug = 'admin';

-- ============================================
-- 2. get_stats_par_graphiste — total dossiers actifs + archives par graphiste
-- ============================================
CREATE OR REPLACE FUNCTION get_stats_par_graphiste()
RETURNS TABLE (
  graphiste_id UUID,
  total_actifs BIGINT,
  total_archives BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS graphiste_id,
    COALESCE(actifs.cnt, 0)::BIGINT AS total_actifs,
    COALESCE(archives.cnt, 0)::BIGINT AS total_archives
  FROM profiles p
  LEFT JOIN roles r ON r.id = p.role_id
  LEFT JOIN (
    SELECT graphiste_id, COUNT(*) AS cnt
    FROM dossiers
    WHERE is_archived = false
    GROUP BY graphiste_id
  ) actifs ON actifs.graphiste_id = p.id
  LEFT JOIN (
    SELECT graphiste_id, COUNT(*) AS cnt
    FROM dossiers
    WHERE is_archived = true
    GROUP BY graphiste_id
  ) archives ON archives.graphiste_id = p.id
  WHERE p.is_active = true
    AND (COALESCE(r.is_graphiste, false) = true OR p.role = 'admin');
END;
$$;

-- ============================================
-- 3. get_stats_graphiste_par_statut — détail par statut par graphiste
-- ============================================
CREATE OR REPLACE FUNCTION get_stats_graphiste_par_statut()
RETURNS TABLE (
  graphiste_id UUID,
  statut TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.graphiste_id,
    d.statut,
    COUNT(*)::BIGINT AS count
  FROM dossiers d
  INNER JOIN profiles p ON p.id = d.graphiste_id
  LEFT JOIN roles r ON r.id = p.role_id
  WHERE d.is_archived = false
    AND p.is_active = true
    AND (COALESCE(r.is_graphiste, false) = true OR p.role = 'admin')
  GROUP BY d.graphiste_id, d.statut;
END;
$$;

-- ============================================
-- 4. get_stats_archives_par_graphiste — archives par graphiste avec filtre année
-- ============================================
CREATE OR REPLACE FUNCTION get_stats_archives_par_graphiste(p_annee INT DEFAULT NULL)
RETURNS TABLE (
  graphiste_id UUID,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.graphiste_id,
    COUNT(*)::BIGINT AS count
  FROM dossiers d
  INNER JOIN profiles p ON p.id = d.graphiste_id
  LEFT JOIN roles r ON r.id = p.role_id
  WHERE d.is_archived = true
    AND (p_annee IS NULL OR EXTRACT(YEAR FROM COALESCE(d.date_archivage, d.date_creation)) = p_annee)
    AND (COALESCE(r.is_graphiste, false) = true OR p.role = 'admin')
  GROUP BY d.graphiste_id;
END;
$$;

-- ============================================
-- 5. get_stats_bat_par_graphiste — déjà filtré mais on s'assure pour cohérence
-- ============================================
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
    AND (COALESCE(r.is_graphiste, false) = true OR p.role = 'admin')
  GROUP BY d.graphiste_id;
END;
$$;
