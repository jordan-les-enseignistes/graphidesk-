-- ============================================
-- Fonction RPC pour les stats de BAT par graphiste
-- Compte le nombre de BAT envoyés par graphiste
-- Avec filtre optionnel par année (basé sur date_envoi)
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
  WHERE (p_annee IS NULL OR EXTRACT(YEAR FROM db.date_envoi) = p_annee)
  GROUP BY d.graphiste_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_stats_bat_par_graphiste(INT) TO authenticated;
