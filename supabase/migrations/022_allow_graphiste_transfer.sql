-- ============================================
-- Migration 022: Permettre aux graphistes de transférer leurs dossiers
-- ============================================

-- Le problème actuel : la policy UPDATE vérifie graphiste_id = auth.uid()
-- Mais quand on transfère, le graphiste_id change, donc la policy échoue.
--
-- Solution : Créer une fonction RPC qui bypass les RLS pour le transfert,
-- mais vérifie que l'utilisateur est bien le propriétaire actuel.

-- 1. Créer la fonction de transfert sécurisée
CREATE OR REPLACE FUNCTION transfer_dossier(
  p_dossier_id UUID,
  p_new_graphiste_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Exécute avec les droits du créateur (bypass RLS)
SET search_path = public
AS $$
DECLARE
  v_current_graphiste_id UUID;
  v_user_role TEXT;
  v_user_id UUID;
BEGIN
  -- Récupérer l'utilisateur courant
  v_user_id := auth.uid();

  -- Récupérer le rôle de l'utilisateur
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  -- Récupérer le graphiste actuel du dossier
  SELECT graphiste_id INTO v_current_graphiste_id
  FROM dossiers
  WHERE id = p_dossier_id;

  -- Vérifier que le dossier existe
  IF v_current_graphiste_id IS NULL THEN
    RAISE EXCEPTION 'Dossier non trouvé';
  END IF;

  -- Vérifier les droits : soit admin, soit propriétaire du dossier
  IF v_user_role != 'admin' AND v_current_graphiste_id != v_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez transférer que vos propres dossiers';
  END IF;

  -- Effectuer le transfert
  UPDATE dossiers
  SET
    graphiste_id = p_new_graphiste_id,
    updated_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_dossier_id;

  -- Logger l'activité
  INSERT INTO activity_logs (user_id, table_name, record_id, action, old_values, new_values)
  VALUES (
    v_user_id,
    'dossiers',
    p_dossier_id,
    'transfer',
    jsonb_build_object('graphiste_id', v_current_graphiste_id),
    jsonb_build_object('graphiste_id', p_new_graphiste_id, 'reason', p_reason)
  );

  RETURN TRUE;
END;
$$;

-- 2. Donner les droits d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION transfer_dossier(UUID, UUID, TEXT) TO authenticated;
