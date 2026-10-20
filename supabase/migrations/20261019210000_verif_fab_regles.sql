-- Vérif FAB, lot 2 : base de règles atelier qui grandit avec l'usage.
-- Un graphiste (ou Claude, à sa demande) PROPOSE ; seul l'admin valide.
-- Seules les règles validées sont envoyées à Claude.

CREATE TABLE IF NOT EXISTS public.verif_regles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie text NOT NULL DEFAULT 'general',
  titre text NOT NULL,
  texte text NOT NULL,
  statut text NOT NULL DEFAULT 'proposee' CHECK (statut IN ('proposee', 'validee', 'refusee')),
  raison text,                       -- d'où vient la proposition (cas rencontré)
  propose_par uuid REFERENCES public.profiles(id),
  valide_par uuid REFERENCES public.profiles(id),
  conversation_id uuid REFERENCES public.verif_conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verif_regles_statut_idx ON public.verif_regles (statut, categorie);

ALTER TABLE public.verif_regles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verif_regles_select" ON public.verif_regles;
CREATE POLICY "verif_regles_select" ON public.verif_regles FOR SELECT TO authenticated
  USING (user_has_permission('access:verif_fab') OR user_has_permission('manage:users'));
-- proposer : uniquement au statut « proposee », en son nom
DROP POLICY IF EXISTS "verif_regles_insert" ON public.verif_regles;
CREATE POLICY "verif_regles_insert" ON public.verif_regles FOR INSERT TO authenticated
  WITH CHECK (
    (statut = 'proposee' AND propose_par = auth.uid() AND user_has_permission('access:verif_fab'))
    OR user_has_permission('manage:users')
  );
-- valider, refuser, corriger, supprimer : l'admin seul
DROP POLICY IF EXISTS "verif_regles_update" ON public.verif_regles;
CREATE POLICY "verif_regles_update" ON public.verif_regles FOR UPDATE TO authenticated
  USING (user_has_permission('manage:users')) WITH CHECK (user_has_permission('manage:users'));
DROP POLICY IF EXISTS "verif_regles_delete" ON public.verif_regles;
CREATE POLICY "verif_regles_delete" ON public.verif_regles FOR DELETE TO authenticated
  USING (user_has_permission('manage:users'));

-- Les règles énoncées par Jordan le 19/10/2026 (jusqu'ici écrites en dur dans le prompt)
INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT * FROM (VALUES
  ('plaque', 'Format maximal des plaques', 'Une plaque mesure au maximum 1500 x 3000 mm. Au-delà : en plusieurs parties.', 'validee', 'Énoncée par Jordan, 19/10/2026'),
  ('adhesif', 'Laize adhésif', 'Laize de 1530 mm : un adhésif plus large ET plus haut que 1530 mm nécessite un raccord.', 'validee', 'Énoncée par Jordan, 19/10/2026'),
  ('adhesif', 'Pas de CutContour sur un adhésif plein', 'Un adhésif plein posé tel quel n''a PAS de CutContour. Exception admise : grande série (ex. 20 exemplaires), où une découpe automatique évite de couper chaque exemplaire à la main.', 'validee', 'Énoncée par Jordan, 19/10/2026 (cas VLC Conseil x20)'),
  ('impression', 'Fonds perdus', 'Fonds perdus des fichiers d''impression : 20 mm à DROITE et 20 mm en BAS, pas ailleurs. Des cas particuliers existent : signaler tout autre schéma et demander.', 'validee', 'Énoncée par Jordan, 19/10/2026'),
  ('nommage', 'Quantité dans le nom de fichier', 'Le nom des fichiers de fab porte la quantité (ex. DG_DECOUPE_x10_CLIENT_N1) : elle doit correspondre à la quantité du BAT.', 'validee', 'Constaté sur VLC Conseil, 19/10/2026')
) AS v(categorie, titre, texte, statut, raison)
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles);
