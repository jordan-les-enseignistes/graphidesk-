-- Nouveau module "Mesure photo" : permission d'accès
-- Seed pour les rôles système admin + graphiste (les rôles custom
-- devront cocher la permission via l'UI de gestion des rôles).

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'access:mesure'
FROM roles r
WHERE r.slug IN ('admin', 'graphiste')
ON CONFLICT (role_id, permission_key) DO NOTHING;
