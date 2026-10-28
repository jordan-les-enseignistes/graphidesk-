-- VérifIzy : les raccords d'un adhésif plein sont faits par l'atelier, sauf sur panneau
-- ou raccord voulu à un endroit précis, noté au BAT (Jordan, 22/10/2026).
UPDATE public.verif_regles SET texte = replace(texte,
  '- posé sur une VITRINE : il se fournit à la taille finale, c''est la machine d''impression qui fait le raccord (pas de fichiers en parties). Le BAT doit prévenir le client qu''il y aura un ou plusieurs raccords.',
  '- posé directement sur une surface (vitrine, mur…) : il se fournit à la taille finale, c''est l''atelier qui fait le raccord (pas de fichiers en parties). Le BAT doit prévenir le client qu''il y aura un ou plusieurs raccords.
- exception : raccord voulu à un endroit précis (choisi pour le visuel ou la pose) : il est noté au BAT, et le graphiste fournit alors les parties. Des fichiers en parties sans raccord noté au BAT : question.'),
  updated_at = now()
WHERE titre = 'Raccord d''un adhésif seul' AND statut = 'validee';
SELECT count(*) AS ok FROM public.verif_regles WHERE statut = 'validee' AND texte LIKE '%raccord voulu à un endroit précis%';
