-- ============================================
-- Fonction RPC pour les statistiques
-- Permet à tous les utilisateurs de voir les stats de tous les dossiers
-- ============================================

-- Fonction pour récupérer tous les dossiers actifs (pour les stats)
-- SECURITY DEFINER = s'exécute avec les droits du créateur (bypass RLS)
CREATE OR REPLACE FUNCTION get_all_dossiers_for_stats()
RETURNS TABLE (
  id UUID,
  nom TEXT,
  statut TEXT,
  graphiste_id UUID,
  date_creation TIMESTAMPTZ,
  is_archived BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.nom,
    d.statut,
    d.graphiste_id,
    d.date_creation,
    d.is_archived
  FROM dossiers d
  WHERE d.is_archived = false
  ORDER BY d.date_creation DESC;
END;
$$;

-- Fonction pour récupérer toutes les archives (pour les stats)
CREATE OR REPLACE FUNCTION get_all_archives_for_stats()
RETURNS TABLE (
  id UUID,
  nom TEXT,
  statut TEXT,
  graphiste_id UUID,
  date_creation TIMESTAMPTZ,
  date_archivage TIMESTAMPTZ,
  is_archived BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.nom,
    d.statut,
    d.graphiste_id,
    d.date_creation,
    d.date_archivage,
    d.is_archived
  FROM dossiers d
  WHERE d.is_archived = true
  ORDER BY d.date_archivage DESC NULLS LAST;
END;
$$;

-- Donner accès aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_all_dossiers_for_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_archives_for_stats() TO authenticated;
