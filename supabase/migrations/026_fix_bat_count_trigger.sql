-- Fix : permettre la mise à jour du compteur BAT par tous les utilisateurs
--
-- Problème :
--   Le trigger update_bat_count() (défini dans 006_bat_system.sql) tentait un
--   UPDATE sur la table dossiers pour maintenir bat_count / dernier_bat à jour.
--   Cet UPDATE était bloqué par la RLS UPDATE sur dossiers (002_rls_policies.sql)
--   pour les utilisateurs n'étant ni propriétaires du dossier ni admin.
--   Résultat : DELETE sur dossier_bats réussissait, mais bat_count restait stale,
--   donnant l'illusion que la suppression n'avait pas fonctionné.
--
-- Solution :
--   Passer la fonction en SECURITY DEFINER pour qu'elle s'exécute avec les
--   privilèges de son créateur (bypass de la RLS sur cette opération interne
--   de bookkeeping). SET search_path = public pour la sécurité.

CREATE OR REPLACE FUNCTION update_bat_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE dossiers
        SET
            bat_count = COALESCE(bat_count, 0) + 1,
            dernier_bat = NEW.date_envoi,
            updated_at = now()
        WHERE id = NEW.dossier_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE dossiers
        SET
            bat_count = GREATEST(COALESCE(bat_count, 0) - 1, 0),
            dernier_bat = (SELECT MAX(date_envoi) FROM dossier_bats WHERE dossier_id = OLD.dossier_id),
            updated_at = now()
        WHERE id = OLD.dossier_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Resynchroniser les bat_count existants (qui ont pu se désynchroniser
-- à cause du bug pour les utilisateurs non-propriétaires de dossier)
UPDATE dossiers d
SET
    bat_count = COALESCE((SELECT COUNT(*) FROM dossier_bats WHERE dossier_id = d.id), 0),
    dernier_bat = (SELECT MAX(date_envoi) FROM dossier_bats WHERE dossier_id = d.id);
