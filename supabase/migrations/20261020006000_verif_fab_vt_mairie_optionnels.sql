-- Vérif FAB : VT et mairie ne sont pas obligatoires (Jordan, 20/10/2026)
INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT 'general', 'VT et mairie : seulement si prévues',
  $$Beaucoup de dossiers n'ont ni VT ni dossier mairie : c'est NORMAL. Leur absence n'est signalée que si quelque chose les annonce : une ligne du devis (visite technique, dossier mairie), l'option « Dossier mairie » cochée sur le BAT, ou une pose réalisée par Les Enseignistes sans aucune cote. Sinon, rien à dire. Le devis, lui, est toujours attendu.$$,
  'validee', 'Jordan, 20/10/2026'
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles WHERE titre = 'VT et mairie : seulement si prévues');
