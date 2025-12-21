-- Ajouter le champ app_url à la config email pour les liens dans les emails
ALTER TABLE email_config_heures_sup
ADD COLUMN IF NOT EXISTS app_url TEXT DEFAULT 'https://graphidesk.lesenseignistes.com';

-- Mettre à jour la config existante avec l'URL de production
UPDATE email_config_heures_sup SET app_url = 'https://graphidesk.lesenseignistes.com' WHERE app_url IS NULL;
