-- Ajout des permissions pour Dashboard, Mes Dossiers et Archives
--
-- Ces 3 modules étaient toujours visibles par défaut dans le Sidebar (no permission required).
-- Suite au feedback utilisateur, ils deviennent conditionnés par une permission.
-- On les ajoute donc au seed admin + graphiste pour ne pas casser l'existant.

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM roles r,
     (VALUES
        ('access:dashboard'),
        ('access:mes_dossiers'),
        ('access:archives')
     ) AS p(key)
WHERE r.slug IN ('admin', 'graphiste')
ON CONFLICT (role_id, permission_key) DO NOTHING;
