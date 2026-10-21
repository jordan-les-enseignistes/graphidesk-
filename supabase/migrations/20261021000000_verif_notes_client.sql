-- VérifIzy : contexte mémorisé par client (particularités propres à un client,
-- ex. un process demandé par l'atelier pour ce client). Jamais une règle générale.
CREATE TABLE IF NOT EXISTS public.verif_notes_client (
  client text PRIMARY KEY,              -- nom du dossier client sur le serveur, en majuscules
  note text NOT NULL,
  modifie_par uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verif_notes_client ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verif_notes_client_lecture" ON public.verif_notes_client;
CREATE POLICY "verif_notes_client_lecture" ON public.verif_notes_client FOR SELECT TO authenticated
  USING (user_has_permission('access:verif_fab'));
DROP POLICY IF EXISTS "verif_notes_client_ecriture" ON public.verif_notes_client;
CREATE POLICY "verif_notes_client_ecriture" ON public.verif_notes_client FOR ALL TO authenticated
  USING (user_has_permission('access:verif_fab')) WITH CHECK (user_has_permission('access:verif_fab'));
