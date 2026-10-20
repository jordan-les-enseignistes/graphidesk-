-- Vérif FAB : la « Bible du graphiste » (PROCESS-IMPRESSION, 7 pages) en règles.
-- Remplace les règles provisoires saisies d'après les messages de Jordan du
-- 19/10 (même contenu, en moins précis) ; garde celle du CutContour en série,
-- qui n'est pas dans la Bible.
DELETE FROM public.verif_regles
WHERE statut = 'validee'
  AND titre IN ('Format maximal des plaques', 'Laize adhésif', 'Fonds perdus', 'Quantité dans le nom de fichier');

INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison)
SELECT v.categorie, v.titre, v.texte, 'validee', 'Bible du graphiste (PROCESS-IMPRESSION)'
FROM (VALUES
  ('impression', 'Adhésif sur panneau rectangulaire',
   $$Le panneau reste à la taille indiquée. L'adhésif a des bords perdus de 20 mm à DROITE et 20 mm en BAS (rien en haut ni à gauche).$$),
  ('impression', 'Adhésif sur panneau découpé à la forme',
   $$Le panneau reste à la taille indiquée avec sa forme de découpe. L'adhésif a 5 mm de bords perdus tout autour par rapport à la forme du panneau, et le visuel est prolongé d'au moins 15 mm au-delà du tracé de découpe de l'adhésif.$$),
  ('decoupe', 'Adhésif découpé à la forme : CutContour',
   $$CutContour pile à la taille de l'adhésif voulu : tracé vectoriel FERMÉ, couleur magenta (ton direct CutContour) de la palette Colorado-2025, épaisseur 1 pt. Aucun masque d'écrêtage ne doit cacher un autre tracé de découpe. Le visuel doit faire au moins 2 mm d'épaisseur. Visuel prolongé d'au moins 15 mm hors du tracé si possible. Pour une découpe sans décalage, zone d'impression de moins de 2000 mm de long si possible. Pas de CutContour sur une découpe droite (voir l'exception des grandes séries).$$),
  ('impression', 'Filets et marges de sécurité (conseil)',
   $$Éviter les filets et contours sur les bords d'un panneau ou d'un adhésif (le moindre décalage se voit). Garder une marge de sécurité intérieure pour ne pas couper les textes.$$),
  ('impression', 'Limites machines : raccord au-delà',
   $$Les imprimantes n'impriment pas au-delà de 1600 mm de laize et les plus grandes plaques font 1500 x 3050 mm : au-delà, un raccord est à prévoir.$$),
  ('impression', 'Raccord d''un adhésif seul',
   $$Un adhésif seul trop grand se fournit à la taille finale : l'atelier coupe le visuel et ajoute le raccord automatiquement. Le BAT doit prévenir le client qu'il y aura un ou plusieurs raccords.$$),
  ('plaque', 'Panneaux en plusieurs parties',
   $$La séparation des panneaux est faite par le graphiste et notée au BAT (pointillés + dimensions de chaque partie, ex. A 2800 x 1500 mm et B 2500 x 1500 mm). Les panneaux sortent pile à la taille, sans recouvrement ; le recouvrement de l'adhésif est pris dans ses 20 mm de bords perdus.$$),
  ('plaque', 'Adhésifs de panneaux raccordés découpés à la forme',
   $$Forme complexe : chaque adhésif a 5 mm de bords perdus tout autour + 20 mm sur le bord droit. Forme simple : 20 mm à droite et 20 mm en bas pour chaque adhésif.$$),
  ('plaque', 'Placement des raccords (conseil)',
   $$Placer les raccords dans les zones avec le moins de visuel (entre deux lettres ou deux mots, jamais au milieu d'une lettre ; zone la moins détaillée d'un dessin) et répartir à peu près également (pas 3 m d'un côté et 50 cm de l'autre).$$),
  ('bache', 'Bâche avec renforts',
   $$44 mm de bords perdus de chaque côté et 44 mm de marge intérieure (zone tranquille). Les œillets sont posés par l'atelier tous les 500 mm. Mention obligatoire au BAT : « renfort de 44mm ».$$),
  ('bache', 'Roll up',
   $$Bâche au format fini 800 x 2000 mm + 200 mm de bord perdu EN BAS pour l'enroulement. Mentionner « impression bâche pour roll up » dans le tableau de FAB. La structure est à la charge de l'atelier.$$),
  ('adhesif', 'Aimant',
   $$Adhésif DG contrecollé sur aimant par l'atelier. Une seule ligne de FAB : DG-Quantité-Nom-N°. AUCUN bord perdu. Découpe à la forme : sous-traitance chez Wowprint.$$),
  ('adhesif', 'Vitrophanie',
   $$Adhésif collé à l'intérieur de la vitre, vu de l'extérieur : impression sur transparent avec blanc de soutien total ou sélectif. Trois calques : Graphisme (tout en dessous, surimpression cochée) ; Cut contour (seulement si découpe de forme : tracés fermés en rose Colorado-2025) ; White (couleur bleue Colorado-2025, au-dessus, surimpression cochée). Le fichier n'est PAS mis en miroir : l'atelier s'en charge, mais « MIROIR » doit figurer dans le nom du fichier de FAB.$$),
  ('adhesif', 'Échelle des fichiers',
   $$Échelle 1 pour les adhésifs de moins de 5000 mm ; échelle 1/10e au-delà, et l'échelle doit alors figurer dans le nom du fichier de FAB.$$),
  ('adhesif', 'Assemblage de teintés masse',
   $$Le montage se fait sur la couleur dominante : deux fichiers. Couleur dominante : fichier complet avec tous les éléments à découper, même ceux de l'autre couleur (ils servent de repères). Couleur secondaire : éléments regroupés au plus serré pour économiser la matière.$$),
  ('adhesif', 'Zone d''impression et de découpe par matière (mm)',
   $$Largeur utile maximale (laize) : Dos gris 1530 ; Dos blanc 1530 ; Dépoli imprimable 1470 ; Covering 1450 ; Colle renforcée 1480 ; Microperforé 1320 ; Blanc ou noir mat/brillant 1150 ; Doré, argent, gris, bleu turquoise, bleu outremer, rouge rubis, carbone noir, bordeaux 1160 ; Plan de pose adhésif 1160 ; Bâche PVC ecoflat 1300 ; Bâche haut de gamme 1530 ; Papier plan de pose 1220 ; Papier haut de gamme 1300 ; Transparent 1530 ; PVC backlight 1470 ; Rouge véhicule Xefi 1450 ; Adhésif pochoir 1150. Au-delà : raccord.$$),
  ('plaque', 'Formats des plaques (mm)',
   $$Plexi translucide 3 mm (caisson lumineux) 1500 x 3000 ; plexi translucide 30 mm (lettres bloc LED) 1900 x 1300 ; plexi transparent 3, 5 ou 8 mm 1500 x 3000 ; panneau alu composite 3 mm 1500 x 3050 ; PVC noir 10 ou 19 mm 1220 x 3050 ; PVC blanc 3, 5, 19 ou 38 mm 1220 x 3050 ; PVC blanc 10 mm 1560 x 3050. Une pièce plus grande se fait en plusieurs parties.$$),
  ('plaque', 'Alu composite teinté d''usine',
   $$Teintes existantes (évitent un laquage, à proposer au client si possible) : RAL 5002, 4008, 6024, 1023, 2004, 3020, 1015, 9006, 7016, 9005, argent brossé, argent miroir, doré miroir.$$),
  ('nommage', 'Nom des fichiers de FAB',
   $$MATIÈRE (DG, DB, DEPOLI, COLLE-RENFORCEE, PVC-BACKLIGHT, DIBOND, PVC…) - LAMINATION si non mat (BRILLANT, SPECIAL-SOL, CONFORMABLE, VELLEDA) - OPTION (MIROIR, RAL, taille, épaisseur, échelle si < 1…) - xN si plus d'un exemplaire - NOM du dossier - NUMÉRO au BAT (1, 2A, 2B, 3…). Exemples : DG-BRILLANT-x2-RIAFR27-8 ; DIBOND-1500x380mm-LAPETITE-COCOTE-5 ; DEPOLI-MIROIR-x7-MAIRIEDESATOLAS-22. Le numéro et la quantité doivent correspondre au BAT.$$),
  ('nommage', 'Finition par défaut : mat',
   $$Les produits sont MAT par défaut. Une finition brillante doit être indiquée au BAT ET dans le nom des fichiers de FAB concernés.$$),
  ('general', 'Rangement du dossier serveur',
   $$Sous-dossiers : VT (visite technique) ; MAQUETTE (fichiers ayant servi au BAT : photos, logos, maquette non vectorisée) ; FAB, nommé avec le numéro de commande (ex. FAB-CO2502-3376), qui contient les fichiers de production vectorisés ; MAIRIE (BAT mairie, cerfa, plans, autorisations). UN SEUL BAT en évidence : les anciennes versions sont supprimées ou rangées dans MAQUETTE. Un client à plusieurs commandes : un sous-dossier par commande.$$)
) AS v(categorie, titre, texte)
WHERE NOT EXISTS (SELECT 1 FROM public.verif_regles r WHERE r.titre = v.titre);
