-- Migration: Configuration emails heures supplémentaires
-- Date: 2025-12-19

-- Table de configuration des emails pour les heures sup
CREATE TABLE IF NOT EXISTS email_config_heures_sup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Destinataires
  destinataires JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Ex: [{"email": "comptable@...", "type": "to"}, {"email": "direction@...", "type": "cc"}]

  -- Configuration SMTP (stockée de manière sécurisée)
  smtp_host TEXT NOT NULL DEFAULT 'mail.les-enseignistes.fr',
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  smtp_user TEXT NOT NULL DEFAULT 'no-reply@les-enseignistes.fr',
  -- Le mot de passe SMTP sera stocké dans les secrets Supabase, pas ici

  -- Configuration envoi automatique (pour le futur)
  auto_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_frequency TEXT CHECK (auto_frequency IN ('weekly', 'monthly')),
  auto_day INTEGER, -- 1-7 pour weekly (1=lundi), 1-28 pour monthly
  auto_hour INTEGER CHECK (auto_hour >= 0 AND auto_hour <= 23),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Une seule ligne de configuration
INSERT INTO email_config_heures_sup (destinataires)
VALUES ('[]'::jsonb)
ON CONFLICT DO NOTHING;

-- Historique des envois
CREATE TABLE IF NOT EXISTS email_heures_sup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Période envoyée
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL,
  semaines INTEGER[] NOT NULL, -- Numéros de semaines incluses

  -- Destinataires au moment de l'envoi
  destinataires JSONB NOT NULL,

  -- Statut
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,

  -- Métadonnées
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_email_log_periode ON email_heures_sup_log(annee, mois);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_heures_sup_log(status);

-- RLS
ALTER TABLE email_config_heures_sup ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_heures_sup_log ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent voir/modifier la config
CREATE POLICY "Admins can manage email config" ON email_config_heures_sup
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seuls les admins peuvent voir les logs
CREATE POLICY "Admins can view email logs" ON email_heures_sup_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seuls les admins peuvent créer des logs
CREATE POLICY "Admins can insert email logs" ON email_heures_sup_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger updated_at
CREATE TRIGGER email_config_updated_at
  BEFORE UPDATE ON email_config_heures_sup
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
