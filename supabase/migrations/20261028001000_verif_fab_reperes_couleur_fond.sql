-- VérifIzy : les repères de pose ont une couleur de fond (demande de l'atelier, Jordan 28/10/2026).
UPDATE public.verif_regles SET texte = replace(texte,
  'sur le tracé de DÉCOUPE (sinon l''atelier les supprime), en contour sans aplat, sans surimpression.',
  'sur le tracé de DÉCOUPE (sinon l''atelier les supprime), avec une COULEUR DE FOND (pas transparents), sans surimpression : une fois le ruban adhésif posé dessus, un repère transparent, ou simplement marqué « REPERE », ne se voit plus.'),
  updated_at = now()
WHERE titre LIKE 'Plan de travail%' AND statut = 'validee' AND texte LIKE '%en contour sans aplat, sans surimpression%';
UPDATE public.verif_regles SET texte = replace(texte,
  'repères en aplat ou absents quand la pose reste possible',
  'repères transparents (sans couleur de fond) ou absents quand la pose reste possible'),
  updated_at = now()
WHERE titre = 'Gravité : erreur, alerte, question ou remarque' AND statut = 'validee' AND texte LIKE '%repères en aplat ou absents%';
SELECT
  (SELECT count(*) FROM public.verif_regles WHERE statut='validee' AND texte LIKE '%avec une COULEUR DE FOND (pas transparents)%') AS plan_travail,
  (SELECT count(*) FROM public.verif_regles WHERE statut='validee' AND texte LIKE '%repères transparents (sans couleur de fond)%') AS gravite;
