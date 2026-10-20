-- Vérif FAB : la checklist de Jordan (prise en charge, BAT VT, BAT, fichiers de FAB),
-- limitée à ce qui se vérifie dans le dossier serveur (pas FreshProcess).
INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT v.categorie, v.titre, v.texte, v.statut, 'Checklist de Jordan (19/10/2026)'
FROM (VALUES
  ('general', 'Le BAT doit être parfait pour l''atelier', 'validee',
   $$Le BAT n'est pas qu'une validation client : l'atelier et les poseurs fabriquent et posent d'après lui. Chaque mention du BAT doit se retrouver à l'identique dans les fichiers de FAB (nom ET contenu) : pose intérieure/extérieure (miroir), finition (mat/brillant), matière, épaisseur, RAL, découpe, quantité, numéro. « Marqué extérieur au BAT mais fichier en miroir », « brillant au BAT mais pas dans le nom de la FAB » : erreurs.$$),
  ('general', 'BAT complet : contenu obligatoire', 'validee',
   $$Le BAT contient : une mise en situation AVANT et APRÈS (la maquette « après » à jour en cas de V2) ; TOUS les éléments du devis, chacun numéroté ; pour chacun la matière, les dimensions, la fixation, la pose (intérieur/extérieur), la finition et les RAL ; le schéma de découpe si plusieurs parties ; un zoom des kits horaires. Les informations doivent suffire à l'atelier pour produire ET aux poseurs pour intervenir. La maquette doit être cohérente et réalisable.$$),
  ('general', 'Devis ↔ BAT final', 'validee',
   $$Tout élément du devis doit être au BAT, et inversement. Une modification entre le devis et le BAT final (élément ajouté, retiré, changé de matière ou de dimension) doit être signalée : le graphiste doit en faire le retour au commercial du dossier.$$),
  ('general', 'Fichiers de FAB : rien d''oublié', 'validee',
   $$Chaque élément du BAT à fabriquer a son (ou ses) fichier(s) de FAB, au bon numéro. Dans chaque fichier : bonne matière, bonnes dimensions, bon CutContour (ton direct, quand il y a découpe de forme), bons fonds perdus (de pose ou d'impression selon le cas), bonne quantité, nom conforme, textes VECTORISÉS (un texte encore en police dans une FAB est une erreur), images incorporées.$$),
  ('general', 'Fichier fourni par le client', 'validee',
   $$Quand le visuel vient du client : vérifier son échelle, son format (vectoriel obligatoire pour toute découpe), l'incorporation des images, leur qualité à l'échelle 1:1 et la faisabilité machine (épaisseur minimale des traits et lettres, dimensions maximales).$$),
  ('general', 'BAT VT complet', 'validee',
   $$Le BAT de visite technique doit : demander TOUTES les dimensions utiles (et le tableau doit être rempli au retour de la VT), signaler les épaisseurs d'une casquette ou d'un débord qui peut gêner, préciser si le RAL de la façade est nécessaire, montrer la maquette si elle existe, et indiquer clairement OUI ou NON pour des enseignes lumineuses (arrivées électriques).$$),
  ('general', 'Validation client sans réserve', 'validee',
   $$Vérifier qu'aucune note ou réserve du client n'accompagne la validation (BAT annoté, signé avec remarques, mail de validation avec demandes) avant de lancer la FAB. Si une réserve existe, elle doit être appliquée dans les fichiers.$$),
  ('impression', 'Résolution des images à l''échelle 1:1', 'proposee',
   $$Une image imprimée doit avoir au moins 100 dpi effectifs à sa taille réelle de pose (au moins 1000 dpi dans un fichier à l'échelle 1/10e). En dessous : à signaler.$$)
) AS v(categorie, titre, statut, texte)
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles r WHERE r.titre = v.titre);
