-- Correction des dates d'archivage pour les dossiers archivés
-- La date_archivage doit être basée sur la date de création du dossier
-- pas sur la date d'import qui met tout au même jour

-- Mettre date_archivage = date_creation pour tous les dossiers archivés
UPDATE dossiers
SET date_archivage = date_creation
WHERE is_archived = true;

-- Vérification après mise à jour (à exécuter dans l'éditeur SQL de Supabase)
-- SELECT id, nom, date_creation, date_archivage FROM dossiers WHERE is_archived = true ORDER BY date_archivage DESC LIMIT 10;
