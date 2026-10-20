-- Vérif FAB : assistant de vérification des dossiers de production (lot 1)
-- Chacun ne voit QUE ses conversations ; l'admin (manage:users) voit tout.
-- Archiver ne supprime jamais : aucune règle DELETE n'est ouverte.

CREATE TABLE IF NOT EXISTS public.verif_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  titre text NOT NULL DEFAULT 'Nouvelle vérification',
  chemin_dossier text,
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'terminee')),
  is_archived boolean NOT NULL DEFAULT false,
  rapport jsonb,
  cout_usd numeric(12, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verif_conversations_user_idx ON public.verif_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.verif_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.verif_conversations(id) ON DELETE CASCADE,
  ordre integer NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  -- blocs de contenu tels qu'échangés avec l'API (texte, outils, réflexion…)
  contenu jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, ordre)
);

-- Une ligne par appel à l'API : écrite UNIQUEMENT par l'Edge Function
-- (service role), d'après l'usage renvoyé par l'API — coût exact, non falsifiable.
CREATE TABLE IF NOT EXISTS public.verif_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  conversation_id uuid REFERENCES public.verif_conversations(id) ON DELETE SET NULL,
  modele text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,
  cout_usd numeric(12, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verif_usage_user_idx ON public.verif_usage (user_id, created_at DESC);

ALTER TABLE public.verif_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verif_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verif_usage ENABLE ROW LEVEL SECURITY;

-- conversations
DROP POLICY IF EXISTS "verif_conv_select" ON public.verif_conversations;
CREATE POLICY "verif_conv_select" ON public.verif_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_has_permission('manage:users'));
DROP POLICY IF EXISTS "verif_conv_insert" ON public.verif_conversations;
CREATE POLICY "verif_conv_insert" ON public.verif_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND user_has_permission('access:verif_fab'));
DROP POLICY IF EXISTS "verif_conv_update" ON public.verif_conversations;
CREATE POLICY "verif_conv_update" ON public.verif_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- messages : ceux de MES conversations
DROP POLICY IF EXISTS "verif_msg_select" ON public.verif_messages;
CREATE POLICY "verif_msg_select" ON public.verif_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.verif_conversations c WHERE c.id = conversation_id
                 AND (c.user_id = auth.uid() OR user_has_permission('manage:users'))));
DROP POLICY IF EXISTS "verif_msg_insert" ON public.verif_messages;
CREATE POLICY "verif_msg_insert" ON public.verif_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.verif_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- usage : lecture seule côté application (écriture par l'Edge Function)
DROP POLICY IF EXISTS "verif_usage_select" ON public.verif_usage;
CREATE POLICY "verif_usage_select" ON public.verif_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_has_permission('manage:users'));

-- Accès au module : Jordan (rôle admin) d'abord ; à cocher ensuite pour les graphistes
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'access:verif_fab' FROM roles r WHERE r.slug = 'admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;
