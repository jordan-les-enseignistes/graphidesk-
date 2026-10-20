-- Vérif FAB : niveaux de gravité et précisions de Jordan sur le cas Temporis (20/10/2026)
INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT v.categorie, v.titre, v.texte, 'validee', v.raison
FROM (VALUES
  ('general', 'Gravité : erreur, alerte ou question',
   $$ERREUR = ce qui fausse la fabrication ou la pose (dimension, quantité, matière, pose intérieure/extérieure, élément manquant ou en trop, écart BAT/FAB, refus mairie, numérotation fausse, dimensions absentes du BAT). ALERTE = un CONSEIL de la Bible non suivi, une coquille (référence mal tapée, faute de frappe), un écart tolérable : on notifie, on ne bloque pas. Sont des ALERTES et non des erreurs : CutContour à une autre épaisseur que 1 pt, visuel prolongé de moins de 15 mm hors découpe, zone d'impression de plus de 2000 mm de long, fichier repris d'un ancien dossier mais conforme. QUESTION = une information manquante ou un écart qui peut être voulu.$$,
   'Jordan, 20/10/2026 (cas Temporis Mont-de-Marsan)'),
  ('decoupe', 'Repères de calage',
   $$Un repère de calage ou de pose (texte « REPERE », croix, traits de repérage) aide l'atelier : il n'a JAMAIS besoin d'être vectorisé et n'est pas une erreur. Seuls les textes du visuel imprimé ou découpé doivent être vectorisés.$$,
   'Jordan, 20/10/2026 (Temporis Mont-de-Marsan, fichier n°4)'),
  ('adhesif', 'Teinté masse en miroir',
   $$Un adhésif teinté masse (non imprimé) découpé « MIROIR » est correct pour une pose en intérieur. Quand le visuel contient de la couleur, on passe en transparent + blanc de soutien ; quand il n'y a qu'une couleur unie, le teinté masse convient (les deux sont possibles).$$,
   'Jordan, 20/10/2026 (Temporis Mont-de-Marsan, n°4-5 et 6-7)'),
  ('nommage', 'Fichiers de sous-traitance numérotés',
   $$Les fichiers envoyés en sous-traitance portent eux aussi le numéro de leur élément au BAT (N1, N3…), comme tout fichier de FAB.$$,
   'Jordan, 20/10/2026 (Temporis Mont-de-Marsan)')
) AS v(categorie, titre, texte, raison)
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles r WHERE r.titre = v.titre);
