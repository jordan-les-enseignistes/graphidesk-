-- Vérif FAB : règles de contenu du BAT énoncées par Jordan le 19/10/2026
INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT v.categorie, v.titre, v.texte, 'validee', v.raison
FROM (VALUES
  ('plaque', 'Enseigne en plusieurs parties : schéma de découpe',
   $$Toute enseigne ou tout panneau en plusieurs parties doit avoir son schéma de découpe sur le BAT (séparations en pointillés + dimensions de chaque partie). Les découpes ne tombent JAMAIS dans un texte ni au milieu d'une lettre : toujours entre deux mots ou deux lettres, ou dans une zone sans visuel. Une découpe qui coupe du texte : question à poser (cas exceptionnel possible), jamais validée d'office. Vérifier aussi que les fichiers de FAB respectent les mêmes coupes que le schéma.$$,
   'Jordan, 19/10/2026'),
  ('general', 'Kit horaire : zoom sur le BAT',
   $$S'il y a un kit horaire (horaires d'ouverture, téléphone, site, QR code…), le BAT doit en montrer un ZOOM lisible, pour que le client valide chaque information (jours, heures, numéro, adresse du site).$$,
   'Jordan, 19/10/2026'),
  ('general', 'Chaque visuel du BAT porte son numéro',
   $$Chaque élément de la légende du BAT doit être repéré par son numéro SUR son visuel (mise en situation ou vue à plat). Un visuel sans numéro, ou un numéro de légende sans visuel, prête à confusion pour l'atelier : à signaler. En cas de doute sur quel visuel correspond à quelle ligne de légende, DEMANDER plutôt que supposer.$$,
   'Camif Habitat Bouguenais, 19/10/2026 : page 5 sans numéros, visuel du n°5 confondu avec le tapis n°6')
) AS v(categorie, titre, texte, raison)
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles r WHERE r.titre = v.titre);
