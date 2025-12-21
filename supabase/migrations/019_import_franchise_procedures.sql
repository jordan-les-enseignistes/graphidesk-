-- Migration: Import des procedures franchises depuis Excel
-- Date: 2025-12-20
-- IMPORTANT: La table franchises utilise la colonne "nom" (pas "name")
-- NOTE: graphiste_referent est maintenant un UUID, il sera configure via l'interface

-- Ce script insere les procedures pour les franchises existantes
-- Il fait un UPSERT: si la procedure existe deja, elle sera mise a jour

-- Temporis
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'service.logistique@valorisdev.fr',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    '-',
    '• Si on réalise la pose = On doit faire une VT (sauf contre indication de Michael)
• Si on ne réalise pas la pose = Temporis DOIT nous fournir la VT
• Temporis doit aussi nous fournir : La maquette avant / après (pour savoir ou placer les éléments)
• On refait la maquette ET la mise en situation au propre car ils font sans les dimensions juste à l''oeil pour le placement
• Reprendre les éléments existants sur d''autre BAT, si nouvel élément (jamais fait) alors ils doivent fournir le fichier 
• Le BAT est à envoyer SEULEMENT au franchiseur, on ne traite pas avec le franchisé'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Temporis'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Camif Habitat
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'sylvie-jacomet@camif-habitat.fr
catherine-rossard@camif-habitat.fr',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    'Adhésif format A0 (P.21 de la charte Camif que j''ai faite)',
    '• Consulter la charte graphique (en cours de finalisation, mais quasi validée dans sa totalitée) -> Z:\C\CAMIF HABITAT\Z_CHARTES
• Visite technique quasi systématique, mais on réalise le BAT avec ce qu''on a avant la VT
• On doit poser l''adhésif provisoire en même temps que la VT ! Donc important de demander dès le départ le numéro de téléphone du franchisé (au franchisé) pour réaliser cet adhésif au plus tôt
• On ne montre JAMAIS le BAT au client tant qu''il n''est pas validé par le franchiseur
• Après validation franchiseur, on envoit le BAT au franchisé
• Si le franchisé demande une modification, vérifier avec le franchiseur que c''est vu avec eux en amont, on ne modifie pas sans leur accord
• Toute la maquette se base sur la charte graphique établie'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Camif Habitat'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Général des Services
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'molinero@gdservices.fr',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    'Bâche ou adhésif en fonction du chantier (principalement adhésif à favoriser) - Checker des anciens dossiers MAIS RECENT, la charte a légèrement évoluée)',
    '• Initialement, c''est charté, mais Sophie-Amélie refait toujours modifier l''ensemble, le plus simple avec GDS reste de prendre une agence similaire, de taper dans Discord "GDS" et de regarder les photos de dossier posé pour en trouver un similaire et le reprendre en base
• Visite technique quasi systématique, mais on réalise le BAT avec ce qu''on a avant la VT
• On doit poser l''adhésif provisoire en même temps que la VT ! Donc important de demander dès le départ le numéro de téléphone du franchisé (au franchisé) pour réaliser cet adhésif au plus tôt
• On ne montre JAMAIS le BAT au client tant qu''il n''est pas validé par le franchiseur
• Après validation franchiseur, on envoit le BAT au franchisé
• Si le franchisé demande une modification, vérifier avec le franchiseur que c''est vu avec eux en amont, on ne modifie pas sans leur accord
----
Pour les véhicules, se baser sur le fichier "CLIO_2025" et adapter en fonction du modèle -> Z:\G\GDS\Z_CHARTE\VEHICULES'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Général des Services'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Centre Services
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Le franchiseur peut être différent en fonction des dossiers, demander à Michael confirmation',
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    '-',
    '• Le client fournit systématiquement un dossier très complet, avec le rendu qu''il souhaite et une "Visite technique" qui permets au moins de faire le BAT
• On refait toujours une visite technique (sauf contre indication de Michael, on demande au cas où)
• Dossier mairie quasi systématique sur ces dossiers, on ne bloque pas le dossier mairie quand on attends le numéro de téléphone ou le QR des éléments du kit horaire
• On ne montre JAMAIS le BAT au client tant qu''il n''est pas validé par le franchiseur
• Après validation franchiseur, on envoit le BAT au franchisé
• Si le franchisé demande une modification, vérifier avec le franchiseur que c''est vu avec eux en amont, on ne modifie pas sans leur accord
• Bien penser à noter sur le BAT que vous attendez le QR Code et le numéro de téléphone si nécessaire, de ne pas lancer la FAB avec les mauvaises infos
• Tester le QR Code et vérifier qu''il renvoie sur la bonne agence
• Les caissons drapeaux sont toujours sous-traité chez Alicia (BeautyStar) donc sous-traitance atelier'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Centre Services'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Guy Hoquet
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'l.moidan@guy-hoquet.com',
    TRUE,
    TRUE,
    TRUE,
    NULL,
    'Généralement des bâches',
    '1- BAT VT : 
Récupérer éléments sur le devis pour prévoir les éléments à demander sur la VT + l''adresse de l''agence  (en général il n''y a aucun autr élément)

2- BAT (sans attente de VT)
C''est ultra charté donc je me pose pas 10000 quetsions, ( lien vers la charte : Z:\G\Guy Hoquet\Charte et infos\CHARTE$ )
En fonction de l''esapce disponible et de ce qui a été vendu je fais des propositions en receptant la charte (ex : si lettre boitier de 300m de hauteur > les éléments autour "accroche" + "IMMOBILIER" passe à 120mm de hauteur, etc)
Il faut reprendre les termes sur les autres BAT, et être super précis (ref de l''adhésif bleu + dimensions)

3- ENVOIE BAT
En 1er : Franchise > Loris Moidan (elle est super cool) l.moidan@guy-hoquet.com - 06 60 49 08 19
Jusqu''à validation
En 2e : franchisé > En fonction des retours :
- Retour sur le contenue (horaire, num de tel...) on renvoie pas à la franchise
- Retour sur la forme (taille caisson, éléments en plus, éléments à enlever) on renvoie à la franchise avec la demande du franchisé et on dialogue jusqu''à trouvé un terrain d''entente

4- VALIDATION BAT > BAT MAIRIE
Bravo c''est validé ! Mainteant prépare ton BAT mairie suivant les process établie habituellement
Une fois que c''est fait j''envoie un mail à Océane pour la notifier et je suis tranquille pour 2mois

5- RETOUR mairie 
Si éléments refusés : 
On repart à l''étape  3 et rebelote

Si éléments validés :
FAB

6- FAB
En sous-traitance : 
Tous les caissons (simple face + drapeau) chez GEP
Lettres boitier des fois sous-traiter chez Beauty Star Sign
Adhésifs et lettres boitiers chez nous (voir FAB sur dossier EZY-SUR-EURE)

Comme la VT est faite en second temps > bien vérifier les dimensions du BAT avec celle de la VT'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Guy Hoquet'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Axial
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Gwendoline GOLUB et Audrey JOLLY
achats-edra@edragroup.eu
03 26 05 45 91',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    NULL,
    '🧩 PROCESSUS DE CRÉATION D’UN PROJET AXIAL

1. Prise de connaissance du projet
Au début de chaque projet, prendre connaissance des informations présentes dans “Collecte d’informations” et dans le devis.

Télécharger les documents fournis dans le dossier Fichier et les placer dans : MAQUETTE > FICHIERS SOURCES
Ces documents contiennent généralement : des photos de la façade de la carrosserie, les emplacements souhaités, et un bon de commande.

2. Création du BAT
Préparation du dossier Aller dans : Z:\A\AXIAL\00 - ELEMENTS GRAPHIQUES\MODELE DOSSIER - AXIAL
et copier le modèle de dossier Axial.

Contenu de base du projet
En général, la base comprend : le panneau Raison sociale, l’enseigne grand format, les panneaux voiture (toujours par deux, espacés de 30 cm de l’enseigne centrale), les panneaux additionnels (Parking, Accueil, Atelier).

Travail sur le fichier “MAQUETTE_AXIAL” (Illustrator)
Remplir le panneau Raison sociale à partir des informations du bon de commande ou du devis :
Nom de la carrosserie + numéro de téléphone + e-mail.
Décomposer le texte et appliquer la couleur argentée à l’aide de la pipette sur le mot “CARROSSERIE” (sous le plan de travail).
Le panneau est à l’échelle 1:1, pour faciliter les copier-coller et gagner du temps sur la fabrication (c’est le seul panneau à personnaliser, sauf exception).
Supprimer les éléments inutiles et ne garder que ceux figurant sur le devis ou le bon de commande.
→ Ces éléments sont à l’échelle 1:10.

Travail sur le fichier “MAQUETTE 2D_AXIAL”
Créer une maquette à l’échelle 1:10 à partir des mesures indiquées sur le bon de commande.
Ne pas placer les panneaux dont la position n’est pas connue.
Indiquer sur le BAT et dans le mail d’échange :
soit que le panneau sera posé par le client,
soit qu’il faut nous préciser son emplacement pour l’intégrer à la maquette.
Photomontage

Réaliser un photomontage rapide avec les panneaux.

Certaines informations peuvent manquer (mesures, placements) : faire au mieux, les façades sont grandes et les carrossiers sont souvent sur place lors de la pose, donc cela se passe généralement bien.

Finalisation du BAT
Importer les éléments de la maquette et de la maquette 2D.
Tout est pré-rempli.
Supprimer la page 7 lorsqu’il n’y a pas de stickers.
Les stickers sont vendus par lot de deux, mais indiquer les quantités à l’unité pour éviter les malentendus
(exemple : 2 lots = 4 exemplaires).

3. Validation

Faire valider le BAT par Gwendoline ou Audrey. Ce sont elles qui gèrent les retours des franchisés. Elles sont très gentilles et facilement joignables 😊

Apporter les modifications nécessaires selon leurs retours.

4. Préparation de la fabrication (FAB)

Aller dans : Z:\A\AXIAL\00 - ELEMENTS GRAPHIQUES\FAB STANDARD - A PIOCHER - fd perdu adapte
(Il existe aussi des fichiers à piocher pour les panneaux bords carrés mais c''est très rare)

❗Copier-coller les fichiers nécessaires et compléter le nom des FAB avec le nom du projet.

⚠️ Attention pour le panneau N1 : C’est le seul panneau à personnaliser systématiquement.
Fichier : DG_DECOUPE_AXIAL_A COMPLETER_N1
→ Copier-coller le panneau “Raison sociale” depuis la MAQUETTE_AXIAL.

Notes : Tout est dans fichier > Charte + Fab + Modèle dossier + Stock 
Z:\A\AXIAL\00 - ELEMENTS GRAPHIQUES

Infos sur stock : C''est une base de fab que Léa demande régulièrement pour avancer l''atelier, bien préciser les formats pour qu''ils s''y retrouvent par rapport au BAT quand c''est sorti en avance et voir avec Léa, Martin et Michaël quand il faut en ressortir :)'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Axial'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Piscine Ibiza
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Piscine Ibiza'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Point code
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Point code'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Onet
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Onet'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Detail Car
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Detail Car'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Technal
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Technal'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Arvalis
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    'M.HASSNY@arvalis.fr
+33 (0)6 78 00 35 40',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    NULL,
    'Arvalis est composé de 24 sites 
Tous les BAT sont validés il n''y en aura pas d''autres 

Dans le process, ils ont attendus d''avoir tous les BAT de validé pour valider le devis global et passrr à la suite.
Je ne parle qu''avec El Medhi qui transmets à chaque responsable de site

Prochaine étape : 
Réunion récap (pas encore prévi)
Fab des 24 sites suivant priorité établi pendant la réunion'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Arvalis'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Anacours
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'jerome.mattout@anacours.fr
',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    'Voir dossier Toulon ou Le mans',
    '1- BAT VT 
Récupérer éléments sur le devis pour prévoir les éléments à demander sur la VT + l''adresse de l''agence  (en général il n''y a dautres éléments sur FP échanges de mail, photo)

2- BAT (sans attente de VT)
C''est charté donc je me pose pas 10000 quetsions, ( pas de docu charte à dispo mais prendre sur projet Boulogne sur mer)
En fonction de l''esapce disponible et de ce qui a été vendu je fais des propositions en receptant la charte 

Pour les PVC Backlight des portes-affiches : 1 porte-affiche = 2 affiches (= PVC Backlight)
Rajouter page pour que le client choisisse ses visuels pour les PVC Backlight et pouyr les PVC 5mm 1000x1000mm
Lien des visuels en question : Z:\A\Anacours\Z_CHARTE

3- ENVOIE BAT
En 1er : Franchise > Jerome Mattout jerome.mattout@anacours.fr
Si pas de retour dans les 2 jours j''envoie au franchisé en prévenant Jérome

En 2e : franchisé > En fonction des retours :
- Retour sur le contenue (horaire, num de tel...) on renvoie pas à la franchise
- Retour sur la forme (choix des adhésifs sur les vitres, emplacement des éléments) on renvoie à la franchise avec la demande du franchisé et on dialogue jusqu''à trouvé un terrain d''entente

4- VALIDATION BAT > BAT MAIRIE
Bravo c''est validé ! Mainteant prépare ton BAT mairie suivant les process établie habituellement
Une fois que c''est fait j''envoie un mail à Océane pour la notifier et je suis tranquille pour 2mois

5 - RETOUR MAIRIE
Si éléments refusés : 
On repart à l''étape  3 et rebelote

Si éléments validés :
FAB

6- FAB
En sous-traitance : 
Tous les caissons (simple face + drapeau) 
Pour le reste j''en ai encore jamais fait - voir avec Michael 

Comme la VT est faite en second temps > bien vérifier les dimensions du BAT avec celle de la VT'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Anacours'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Bagelstein
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    'Hervé Teyssier
etuderenovation69@gmail.com
06 08 17 90 75
Actif sur Whatsapp',
    TRUE,
    FALSE,
    TRUE,
    NULL,
    'En général, on un document avec la maquette des adhésifs provisoire
Demander les fichiers à Stephane Bacconin
backstage.moe@gmail.com
07 65 22 71 65
',
    '1- BAT VT
S''appuyer sur le devis et le document DAT toujours fourni, il contient la maquette des enseignes 
prendre photo sur google maps, 

2-BAT (SANS ATTENTE DE VT)
S''appuyer sur la maquette pour savoir quoi faire, c''est écrit si int. ou ext. et check en parallèle le BAT pour suivre les dimensions vendus - si ça passe pas sur le projet voir avec Michale pour ajuster
On fait toujours la même chose :
- Lettre boitiers, nouveau sur lisse 
- Adhésifs colle renforcé noir pour mettre sur le carrelage en intérieur 
- Adhésifs teinté masse blanc pour vitre extrétieur 
- drapeau rond lumineux avec adhésifs ajouré (ST chez Beauty Star Sign)
- des fois caisson ou cofrage)

Lien vers projet type  : Z:\B\BAGELSTEIN\ROMAN SUR ISERE

3- ENVOIE BAT
Toujours à Hervé - etuderenovation69@gmail.com - 06 08 17 90 75
C''est le seul correpondant, très sympa mais il a pas le temps et il kiff Sara

4- VALIDATION 
EN génaral pas de dossier mairie 
Direct en FAB

5- FAB
sous-traitance : caisson drapeau rond et caisson si caisson
Atelier : Lettre boitier, adhésif

Pour lettres boitier suivre le gabarit là : Z:\B\BAGELSTEIN\GABARIT TRANCHE LETTRE BOITIER

Comme la VT est faite en second temps > bien vérifier les dimensions du BAT avec celle de la VT'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Bagelstein'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- RIA
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    'Michele 
06 32 14 58 64
mdossantos@riamoneytransfer.com
----
mettre en copie : 
MarketingFR@riafinancial.com
jgoulamhoussen@riamoneytransfer.com',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    NULL,
    '1. Antoine me fournit une photo de la devanture avec le placement et les produits souhaités, et crée simultanément un dossier FP provisoire.
2. Réalisation d’un BAT sans les dimensions, puis envoi du BAT à Michelle.
3. Michelle valide le BAT ou demande des modifications.
4. Une fois le BAT validé, Antoine crée le devis.
5. Après validation du devis, Antoine crée le dossier définitif dans FreshProcess. J’intègre alors le BAT validé dans la ligne « BAT », et la VT doit se faire sur la base de ce BAT.
→ S’il y a des dimensions particulières à prendre, je les indique dans la ligne « VT ».
6. Une fois la VT reçue : mise en fabrication.'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('RIA'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Lady Sushi
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Alain Miller 
06 51 82 57 26
developpement@lady-sushi.fr
----
si il ne répond pas : mathilde.decleir@lady-sushi.fr',
    TRUE,
    TRUE,
    TRUE,
    NULL,
    'A voir celon la demande - ce n''est pas systématique',
    '1. Suivre le devis et le brief client pour créer le BAT.
2. Envoyer le BAT à la franchise.
3. Après validation de la franchise, envoyer le BAT au franchisé.
4. Une fois le BAT validé : mise en production, l’ensemble est fabriqué en atelier.'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Lady Sushi'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Viva Services
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Patrice MONNET 
06 59 35 66 62
patrice.monnet@vivaservices.fr',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    '2 Adhésifs 550x400 mm ',
    '1. Mise en fabrication des deux adhésifs provisoires.
→ Montage d’un BAT provisoire pour l’atelier et l’équipe de pose, puis envoi au franchisé pour valider le placement (cela ne doit toutefois pas bloquer la mise en production).
→ Établissement d’un BAT VT.

2. Création du BAT à l’échelle, en demandant au client de fournir les informations suivantes :
– Horaires d’ouverture
– Numéro de téléphone
– Numéro de SIREN
– Nom de la société
→ Lui demander également de sélectionner les affiches souhaitées pour les portes-affiches.

3. Particularités techniques :
– Le bandeau orange doit être présent sur toutes les vitres, et recoupé sur place pour garantir un alignement parfait en cas de hauteurs différentes.
– Les pétales doivent être alignés sur les côtés des vitres.

4. Envoi du BAT à la franchise et au franchisé en simultané.

5. Une fois le BAT validé par la franchise et le franchisé : mise en production.
→ Les portes-affiches sont commandés par l’atelier auprès d’un sous-traitant.
→ L’impression des PVC backlight est réalisée en interne.'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Viva Services'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Point S
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Célia TETARD 
04 37 48 38 47
celia.tetard@points-france.fr',
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    NULL,
    '1. Attendre la validation technique (VT) avant de réaliser le BAT.
→ En raison de problèmes de dimensions rencontrés précédemment, il a été décidé de ne plus commencer le travail en amont sans VT.

2. Réalisation du BAT selon la charte, le devis et le brief du client.
→ Appeler le client pour obtenir :
– Les horaires
– Le nom de la société
– Le numéro de téléphone à inscrire sur la vitrine
→ Attention : bien aligner le haut des panneaux métier avec le haut de l’enseigne logo et l’indiquer clairement sur le BAT.

3. Envoi du BAT à Célia Tétard.

4. Célia transmet ses éventuelles modifications ou valide le BAT, puis fournit la liste des contacts à qui envoyer le BAT pour validation du franchisé.

5. Mise en fabrication dès validation du franchisé.
→ Tout est fabriqué en atelier, à l’exception du caisson lumineux double face, qui est sous-traité (demande de plusieurs devis pour comparaison)'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Point S'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Gi Group
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Catherine Rogliano 
06 12 52 30 14
Catherine.Rogliano@gigroupholding.com
Iman Touirs
06 24 66 60 90
Iman.Touirs@gigroup.com',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    NULL,
    'Remarque préalable :
→ Vérifier sur FreshProcess ou avec le commercial à qui envoyer la maquette. Il s’agit généralement de Catherine ou Iman, mais cela peut varier.

1. En général, un VT et un brief brouillon sont fournis.
→ Il faut alors établir un BAT en s’appuyant sur la charte graphique, en collaboration avec la cliente.

2. Une fois le BAT validé, Michael réalise le devis.

3. Après validation du devis, la mise en fabrication peut être lancée.'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Gi Group'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Valobat
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    'Elodie Lidor
06.23.36.68.74
elodie.lidor@valobat.fr ',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    NULL,
    '1. Récupérer les fichiers depuis le lien suivant :
→ https://drive.google.com/drive/folders/1NhCKFZGFfFAOvYwH0KpicPlXlhubKrtW

2. Réaliser un BAT propre en s’appuyant sur les anciennes versions.
→ Ne pas oublier les perforations sur les panneaux.

3. Envoyer le BAT à Élodie pour validation.

4. Mise en fabrication dès validation d''Elodie.
→ Support : adhésif sur panneaux.'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Valobat'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- SQ Laverie
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Nathan Delepine 
07 76 97 36 71 
delepine.nathanpro@gmail.com

Paul Bocquillon
06 27 27 34 24
Paul.Bocquillon@alliancels.com',
    TRUE,
    FALSE,
    NULL,
    NULL,
    'Uniquement à la demande du commercial, il s''agira d''une bâche à réaliser sur le modele d''un caisson simple face, c''est à dire : 2 logos blancs sur fonds rouges aux deux extrémités et au centre sur fond gris : "Laverie Libre-service Laundry"',
    'Signalétique extérieure

1. Réalisation du BAT VT.

2. Création du BAT
→ Se baser sur le devis de Michael et sur la photo fournie.
→ Envoyer le BAT à Nathan ou Paul, selon ce qui est précisé dans la section « Collecte d’informations ».

3. La franchise valide ou demande des modifications.
→ Aucune communication avec le franchisé : c’est SQ qui transmet directement.

4. Une fois le BAT validé par la franchise : réalisation du BAT mairie.

5. Mise en fabrication dès réception de la validation mairie.

Remarque importante : même si la lightbox est mentionnée sur le devis extérieur, elle doit figurer uniquement sur le BAT de la signalétique intérieure.
La finition de l''extérieur sera brillant et non mat.


Signalétique intérieure

1. Mettre la tâche en « bloqué » jusqu’à réception du brief de la part de la franchise.
→ Délai habituel : 1 à 2 mois.

2. À réception du brief par mail :
→ Adapter tous les éléments variables de la signalétique en fonction des informations fournies :
Éléments variables selon le brief :
- Horaires d’ouverture
-  Adhésif wifi (si service disponible)
- Inscrire le nom du gérant et son numéro de téléphone sur l’adhésif vidéo surveillance
- Horaire d’ouverture automatique de la porte
- 1 adhésif ozone par machine à laver (si option cochée)
-  1 adhésif rectangulaire ozone (si applicable)
- Numérotation des machines à laver (numéro centré) (selon le nombre total)
-  Numérotation des sèche-linge (fer à droite ou fer à gauche) avec flèches directionnelles
- Tarifs des machines et sèche linge (1 par machine, prix, poids et minutes pour les sèches linge)
- 1 adhésif « lessive et assouplissant » par machine
- Vérification des dimensions de la lightbox par rapport au devis
- Numéros de téléphone sur les panneaux
- Remplir les tarifs sur le panneau tarif
- Choix d’un des 4 panneaux fidélité :
    → Insight ou Simply Pay
    → Avec ou sans crédit de bienvenue
- 2 panneaux ozone (si l’option est présente)
    → Sinon, remplacer par celui avec la femme qui respire son linge

Éléments fixes (toujours présents) :
- Adhésif « Laverie ouverte »
- Adhésif « Ici lessive et hygiénisation incluses »
- Découpe blanche pour la centrale de paiement
- Adhésif transparent QR code
- Lettres en aluminium
- Dépoli pour vitrine
- Panneau sécurité

3. Envoi du BAT à Paul ou Nathan, selon ce qui est indiqué dans la section « Collecte d’informations ».

4. Mise en fabrication après validation.
→ Tout est fabriqué en atelier, à l’exception de la lightbox, qui est commandée par l’atelier.
→ Il faudra uniquement fournir le fichier d’impression diffusant.'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('SQ Laverie'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Euronet
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    'Helmi Ghodbani 
hghodbani@euronetworldwide.com

Clément Cognet
ccognet@euronetworldwide.com

FRprojectsmmf@euronetworldwide.com

Mohamed El Khoumsi
melkhoumsi@euronetworldwide.com',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    NULL,
    '1. Effectuer un BAT VT si cette étape est prévue dans le devis.

2. Réalisation du BAT
→ Le BAT doit être envoyé à la personne indiquée dans le dossier FreshProcess.
→ Il doit être basé sur le brief client et le devis, voici le détails des éléments :
- Topper
- Habillage DAB en adhésif colle renforcée
- Caisson lumineux double face
- Options de panneaux ou d’adhésifs vitres

Spécificités techniques importantes :

    Topper & habillage DAB :
    → 3 types de machines :
    • C20D40
    • DNS100D
    • DNS200H
    → Chaque type existe en 2 couleurs :
    • Bleu Euronet
    • Vert Super U
    → Bien lire la demande du client pour choisir le bon modèle et la bonne couleur.

    Caissons lumineux double face :
    → 2 tailles possibles :
    • 600 × 600 mm
    • 250 × 250 mm
    → 2 couleurs disponibles :
    • Bleu Euronet
    • Vert Super U

Important – Gestion de la fabrication :
    Les DAB, toppers et caissons sont fabriqués par lots.
    → Ne pas les remettre en fabrication à chaque commande.
    → S’ils ne figurent pas sur le devis du dossier dans FreshProcess :
    • Ne pas les mettre en fabrication
    • Créer uniquement le BAT pour la pose et l’atelier
Les éléments unitaires (adhésifs vitres, panneaux) doivent être produits s’ils sont présents dans le devis.

En résumé : le BAT doit être réalisé à partir du brief client + devis, et seule la fabrication des éléments devisés doit être lancée.'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Euronet'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Wash N dry
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Michael',
    'Antoine BENZONI 
06 02 59 07 84 
benzoniantoine34@gmail.com',
    TRUE,
    TRUE,
    NULL,
    NULL,
    NULL,
    'Signalétique extérieure
1. Réalisation du BAT VT.
2. Création du BAT
→ Se baser sur le devis de Michael et la photo fournie.
→ Envoyer le BAT à Antoine Benzoni (franchise) et au franchisé.
3. Une fois le BAT validé par la franchise et le franchisé :
→ Réalisation du BAT mairie.
4. Mise en fabrication dès réception de la validation mairie.

Signalétique intérieure :
Éléments fixes (toujours présents, quel que soit le brief) : 
- Panneau Machine à laver
- Panneau Séchoir
- Panneau Informations
- Panneau Avertissement
- Panneau Carte de fidélité
- Panneau Application Simply Pay
- Panneau Merci pour votre visite
- Adhésif « Ici lessive et hygiénisation incluses »
- Adhésif caméra / vidéo surveillance
- Adhésif interdiction de fumer
Éléments variables (à adapter selon les informations du client) :
- Numéro de téléphone sur le panneau « En cas d’urgence »
- Panneau horaires d’ouverture
- Bonus de chargement 
- Numérotation des machines à laver
- Tarifs des machines à laver
- Numérotation des séchoirs
- Tarifs des séchoirs, avec indication du temps de cycle
- Adhésifs hublot : à adapter en fonction des hublots présents sur place
    → Prévoir du RAB (stock de secours)
- Adhésif wifi (si l’option est présente dans le contrat)
- Lettres en relief : à adapter selon l’espace disponible sur site'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Wash N dry'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();

-- Easy charge
INSERT INTO franchise_procedures (
    franchise_id,
    commercial,
    franchiseur_contacts,
    mail_franchiseur,
    mail_franchise,
    bat_avant_vt,
    signaletique_provisoire,
    signaletique_provisoire_details,
    etapes_cles
)
SELECT 
    f.id,
    'Antoine',
    'Jérémy DAVIN
07 61 40 28 61
Jeremy.davin@easycharge-vinci.com',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    NULL,
    'Prendre connaissance du dossier dans FP et des informations dans "collecte d''informations" en général Antoine indique le nombre de borne et la référence de la borne. Exemple : 10 bornes 22 kW, 9 bornes 60 kW et 2 bornes 120 kW.

Aller dans le Syno-dossiers > Z:\E\EASY CHARGE

Fichiers de fab pour les bornes > Z:\E\EASY CHARGE\_FICHIERS FAB BORNES

Créer un dossier > Nom projet + Numéro de dossier (On ne fonctionne pas par nom de ville systématiquement car les bornes sont parfois posées dans plusieurs villes en même temps)

Réalisation du BAT  
Normalement ils fournissent toujours un PDF de la borne + un fichier source AI à glisser dans "FICHIERS SOURCES" de ton projet
Mise en situation après travaux : PDF global des bornes
Mise en situation sans déformation : Détail de chaque adhésif même si il est sur la même face de la borne. 
Description : Exemple : 1 : Adhésif - Colle renforcée - Mat - Découpe à la forme - 500 x 290 mm - x2 exemplaires
Attention bien préciser sur les BAT pour les demandes d''impression au RAL : Attention les adhésifs seront imprimés à la correspondance du RAL associé + 1 : Adhésif - Colle renforcée - Mat - Découpe à la forme - Correspondance RAL 7024 - 508x298mm - x2 exemplaires

Réalisation des FABS
Si tu as de la chane j''ai déjà fais ce modèle et tu as les fabs dans le dossier "_FICHIERS FAB BORNES"
Sinon tu pars du illustrator fourni par le client, attention leurs fichiers comportent de nombreux tracés et masques d''écrêtages + leurs traits de coupes sont placés après les fonds perdus donc il faut retravailler les fichiers. Exemple forme l''adhésif "Bienvenue sur les bornes Easy charge" DOIT FAIRE 500X290mm et sur leurs fichiers il fait 508x298 car il y a 4 mm de fond perdu tout le tour.

Il faut donc supprimer tous les éléments qui ne sont pas esssentiels dans les calques + jouer avec les contours ctrl+x + pathfinder forme + masque d''écrêtages. Bien vectoriser les tracés.



'
FROM franchises f
WHERE LOWER(TRIM(f.nom)) = LOWER(TRIM('Easy charge'))
ON CONFLICT (franchise_id) DO UPDATE SET
    commercial = EXCLUDED.commercial,
    franchiseur_contacts = EXCLUDED.franchiseur_contacts,
    mail_franchiseur = EXCLUDED.mail_franchiseur,
    mail_franchise = EXCLUDED.mail_franchise,
    bat_avant_vt = EXCLUDED.bat_avant_vt,
    signaletique_provisoire = EXCLUDED.signaletique_provisoire,
    signaletique_provisoire_details = EXCLUDED.signaletique_provisoire_details,
    etapes_cles = EXCLUDED.etapes_cles,
    updated_at = NOW();


-- Verification: afficher les franchises sans procedures
SELECT f.nom FROM franchises f LEFT JOIN franchise_procedures fp ON f.id = fp.franchise_id WHERE fp.id IS NULL;