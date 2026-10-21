-- Réception des webhooks FreshProcess (test du contenu envoyé, puis alimentation de VérifIzy).
-- Aucune politique RLS : seule la fonction serveur (rôle service) écrit et lit.
CREATE TABLE IF NOT EXISTS public.fp_webhooks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recu_le timestamptz NOT NULL DEFAULT now(),
  methode text,
  type_contenu text,
  requete jsonb,
  corps_brut text
);
ALTER TABLE public.fp_webhooks ENABLE ROW LEVEL SECURITY;
