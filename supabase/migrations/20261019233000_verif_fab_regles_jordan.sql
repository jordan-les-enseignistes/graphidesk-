-- Vérif FAB : règles tirées des erreurs réelles relevées par Jordan (19/10/2026)
INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT v.categorie, v.titre, v.texte, 'validee', v.raison
FROM (VALUES
  ('general', 'Cohérence de TOUT le dossier',
   $$Devis, BAT client, BAT mairie, VT, maquette et fichiers de FAB doivent dire la même chose : dimensions, quantités, matières, finitions, pose. Toute dimension qui diffère d'un document à l'autre (ou d'un côté à l'autre d'un même plan) est une question à poser, jamais un choix à faire soi-même.$$,
   $$Guy Hoquet Miribel (09/10/2026) : drapeau fabriqué plus grand que les dimensions acceptées par la mairie ; dimensions contradictoires dans le dossier, non recoupées$$),
  ('general', 'Mairie : ne pas dépasser ce qui est autorisé',
   $$Si un dossier MAIRIE existe, les dimensions et le type d'enseigne fabriqués doivent correspondre au BAT mairie déposé. S'il contient un refus, un avis défavorable (ABF) ou des réserves : alerte « ATTENTION LA MAIRIE REFUSE » et le détail. Si aucun accord n'est présent dans le dossier : demander si l'autorisation a été obtenue avant de lancer.$$,
   $$Guy Hoquet Miribel (09/10/2026) : à refaire et reposer à nos frais en cas de passage des ABF$$),
  ('enseigne', 'Sorties électriques',
   $$Une sortie électrique ne se prévoit que pour une enseigne LUMINEUSE. Un plan de sorties électriques qui en place pour une enseigne non lumineuse est une erreur.$$,
   $$Guy Hoquet Miribel (09/10/2026) : 6 trous inutiles, électricien facturé au client, plainte$$),
  ('decoupe', 'Hauteur de chaque lettre',
   $$Vérifier la hauteur de CHAQUE lettre des fichiers de découpe (PVC, adhésif), pas seulement l'emprise de la ligne : la hauteur de capitale doit être la même pour toutes les lignes annoncées à la même hauteur au BAT. Les lettres rondes (O, S, U, C, G) dépassent naturellement de quelques %. Attention : selon la police, la cote du BAT peut correspondre à la capitale ou à la ligne entière — en cas de doute, demander.$$,
   $$Optic Duroc Challans (19/10/2026) : BAT à 70 mm, certaines lettres du fichier à 63 mm — refab complète de 2 lignes$$),
  ('adhesif', 'Pose intérieure ↔ fichier MIROIR',
   $$Un fichier de FAB « MIROIR » se pose en INTÉRIEUR (vitrophanie) : le BAT doit indiquer « pose en intérieur ». Un BAT « pose en extérieur » avec une FAB en miroir (ou l'inverse) est une erreur à signaler.$$,
   $$Cas relevé par Jordan, 19/10/2026$$),
  ('adhesif', 'Vitrophanie : surimpression du blanc',
   $$Avec un blanc de soutien, le calque blanc (ton direct White) doit être dessiné EN SURIMPRESSION au-dessus du graphisme ; sinon le blanc masque le visuel à l'impression. Les noms de calques (WORK/WHITE ou Graphisme/White) importent peu.$$,
   $$Jordan, 19/10/2026$$)
) AS v(categorie, titre, texte, raison)
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles r WHERE r.titre = v.titre);
