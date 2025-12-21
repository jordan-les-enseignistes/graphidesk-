-- ============================================
-- GraphiDesk - Configuration Realtime
-- ============================================

-- Activer Realtime sur les tables nécessaires
-- Note: Ces commandes doivent être exécutées avec les droits superuser
-- Dans Supabase, aller dans Database > Replication et activer les tables

-- Pour activer via SQL (si vous avez les droits) :
-- ALTER PUBLICATION supabase_realtime ADD TABLE dossiers;
-- ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
-- ALTER PUBLICATION supabase_realtime ADD TABLE projets_internes;

-- Sinon, activez manuellement dans le dashboard Supabase :
-- 1. Allez dans Database > Replication
-- 2. Trouvez la publication "supabase_realtime"
-- 3. Activez les tables : dossiers, profiles, projets_internes
