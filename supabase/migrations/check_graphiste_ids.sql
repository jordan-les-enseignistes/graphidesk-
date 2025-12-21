-- Vérifier la répartition des dossiers par graphiste_id
SELECT
  p.full_name,
  p.initials,
  p.id as profile_id,
  COUNT(d.id) as nb_dossiers
FROM profiles p
LEFT JOIN dossiers d ON d.graphiste_id = p.id
GROUP BY p.id, p.full_name, p.initials
ORDER BY nb_dossiers DESC;

-- Vérifier les dossiers avec graphiste_id inconnu (pas dans profiles)
SELECT
  d.graphiste_id,
  COUNT(*) as nb_dossiers
FROM dossiers d
LEFT JOIN profiles p ON p.id = d.graphiste_id
WHERE p.id IS NULL AND d.graphiste_id IS NOT NULL
GROUP BY d.graphiste_id;

-- Vérifier les initiales des profils actifs
SELECT id, full_name, initials, is_active FROM profiles WHERE is_active = true;
