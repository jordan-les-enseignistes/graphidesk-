-- ============================================
-- Onglet « Suivi VT »
-- ============================================
-- Le tableau de suivi des visites techniques est un Google Sheet partagé avec
-- un prestataire extérieur. On l'affiche DANS GraphiDesk pour éviter d'ouvrir
-- un navigateur et de retrouver le lien à chaque fois.
--
-- ⚠ L'URL vit en réglage d'application, jamais dans le code : changer de
-- document (ou en changer le partage) ne doit pas demander une nouvelle
-- version de l'application.

INSERT INTO public.app_settings (key, value)
VALUES ('suivi_vt_url',
        '"https://docs.google.com/spreadsheets/d/1X-fCnCVNTyETgap7iLY81NPUL7QrIHCbzE1KRXAr-KI/edit"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();

-- Accès : admin + graphiste, comme les autres onglets de Gestion de projet
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'access:suivi_vt'
FROM roles r
WHERE r.slug IN ('admin', 'graphiste')
ON CONFLICT (role_id, permission_key) DO NOTHING;
