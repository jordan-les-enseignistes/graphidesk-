-- ============================================
-- Fonctions RPC pour les statistiques agrégées
-- Retourne les compteurs au lieu des lignes (pas de limite de 1000)
-- Permet à tous les utilisateurs de voir les stats de tous les dossiers
-- ============================================

-- Fonction pour récupérer les stats globales
CREATE OR REPLACE FUNCTION get_stats_global()
RETURNS TABLE (
  total_en_cours BIGINT,
  total_archives BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM dossiers WHERE is_archived = false)::BIGINT as total_en_cours,
    (SELECT COUNT(*) FROM dossiers WHERE is_archived = true)::BIGINT as total_archives;
END;
$$;

-- Fonction pour récupérer le compte par statut (dossiers actifs uniquement)
CREATE OR REPLACE FUNCTION get_stats_par_statut()
RETURNS TABLE (
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
    d.statut,
    COUNT(*)::BIGINT as count
  FROM dossiers d
  INNER JOIN profiles p ON d.graphiste_id = p.id AND p.is_active = true
  WHERE d.is_archived = false
  GROUP BY d.statut;
END;
$$;

-- Fonction pour récupérer le compte par graphiste (dossiers actifs et archives)
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
    p.id as graphiste_id,
    COALESCE((SELECT COUNT(*) FROM dossiers d WHERE d.graphiste_id = p.id AND d.is_archived = false), 0)::BIGINT as total_actifs,
    COALESCE((SELECT COUNT(*) FROM dossiers d WHERE d.graphiste_id = p.id AND d.is_archived = true), 0)::BIGINT as total_archives
  FROM profiles p
  WHERE p.is_active = true;
END;
$$;

-- Fonction pour récupérer le détail par graphiste et par statut
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
    COUNT(*)::BIGINT as count
  FROM dossiers d
  INNER JOIN profiles p ON d.graphiste_id = p.id AND p.is_active = true
  WHERE d.is_archived = false
  GROUP BY d.graphiste_id, d.statut;
END;
$$;

-- Fonction pour récupérer les archives par année (pour le filtre)
CREATE OR REPLACE FUNCTION get_stats_archives_par_annee()
RETURNS TABLE (
  annee INT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM COALESCE(d.date_archivage, d.date_creation))::INT as annee,
    COUNT(*)::BIGINT as count
  FROM dossiers d
  WHERE d.is_archived = true
  GROUP BY annee
  ORDER BY annee DESC;
END;
$$;

-- Fonction pour récupérer le compte d'archives par graphiste et par année
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
    COUNT(*)::BIGINT as count
  FROM dossiers d
  WHERE d.is_archived = true
    AND (p_annee IS NULL OR EXTRACT(YEAR FROM COALESCE(d.date_archivage, d.date_creation)) = p_annee)
  GROUP BY d.graphiste_id;
END;
$$;

-- Donner accès aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_stats_global() TO authenticated;
GRANT EXECUTE ON FUNCTION get_stats_par_statut() TO authenticated;
GRANT EXECUTE ON FUNCTION get_stats_par_graphiste() TO authenticated;
GRANT EXECUTE ON FUNCTION get_stats_graphiste_par_statut() TO authenticated;
GRANT EXECUTE ON FUNCTION get_stats_archives_par_annee() TO authenticated;
GRANT EXECUTE ON FUNCTION get_stats_archives_par_graphiste(INT) TO authenticated;
