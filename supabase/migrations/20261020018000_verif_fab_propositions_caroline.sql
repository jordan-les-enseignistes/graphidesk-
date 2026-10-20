-- VérifIzy : propositions de règles tirées de la discussion Discord Jordan ↔ Caroline
-- (06/08 → 19/10/2026), regroupées PAR SUJET. Statut « proposee » : rien ne s'applique
-- avant validation par Jordan dans « Coûts, statistiques, règles → Règles → À valider ».
-- Formulation générique (aucun client, aucun dossier, aucune personne). La source est
-- dans `raison`, jamais envoyée à l'IA. Les points contradictoires avec des règles en
-- place sont tenus à part (arbitrage de Jordan d'abord).

INSERT INTO public.verif_regles (categorie, titre, texte, statut, raison) VALUES

('general', 'Méthode : lire tout le dossier avant de juger', $t$
- Lis le devis JUSQU'AU BOUT, y compris les supports annexes : une ligne qui prévoit une impression (plan, visuel) sur un support doit se retrouver au BAT avec ce visuel ; un support « vierge » au BAT alors que le devis prévoit une impression est une erreur.
- Seules les LIGNES chiffrées du devis font foi, pas son titre (le projet a pu évoluer) : un titre qui contredit les lignes est une question.
- Les notes de la commande (si elles sont dans le dossier) priment sur le devis ; un écart entre les deux se signale au commercial (question).
- La vérification porte sur la faisabilité et la conformité (plaques, matières, épaisseurs, process de l'atelier), jamais sur le design.
- Se projeter à la pose : pour chaque fichier de FAB, comment le poseur va-t-il le mettre en place (alignement, niveau, centrage, repères) ? Un fichier qui oblige à mesurer ou calculer sur place est à signaler.
- Les choix techniques qui reviennent au commercial ou à l'atelier (matière, fixation, colle, construction) sont des QUESTIONS, jamais des décisions.
- Des cotes fournies par le client (VT faite par le client) sont souvent peu fiables : contrôle-les avec les photos et pose des questions plutôt que de les présumer justes. Une prévisualisation du client n'est pas à l'échelle : elle ne sert pas de référence de dimensions.
- Un fichier hors standard de l'atelier mais fonctionnel : question ou alerte « à valider avec l'atelier », pas erreur.
- Vérifie que le BAT et la FAB utilisent la DERNIÈRE version de chaque visuel (anciens visuels rangés dans le dossier, BAT d'une commande précédente).
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 07/08, 10/08, 11/08, 19/08, 25/08, 06/10, 16/10, 19/10'),

('general', 'BAT : rédaction des cotes et du descriptif', $t$
- Les dimensions s'écrivent toujours LARGEUR x HAUTEUR : une même pièce notée dans les deux ordres, ou une cote inversée par rapport au reste du BAT, est une alerte (question si ça change la pièce).
- Coquilles de cotes : une valeur à ±1 mm d'une cote ronde attendue (ex. 5599 pour 5600) ou une somme de parties différente du total est une alerte.
- Trame d'une ligne de descriptif : type de produit, épaisseur suivie de « d'épaisseur », matière (et son épaisseur), finition / RAL, dimensions L x H, technique (lettres, composition faces/chants), éclairage, fixation. Une rubrique utile qui manque est à signaler ; l'épaisseur des caissons et des lettres en relief est OBLIGATOIRE (erreur si absente) et doit correspondre au devis.
- La description doit correspondre au visuel actuel (mise à jour quand l'élément change) et à la nature réelle du produit (« panneau » alors que c'est un caisson : erreur ou question).
- Un panneau adhésivé se décrit sur la ligne du panneau, sous le même numéro (pas de numéro séparé pour son adhésif) ; côté FAB il faut bien deux pièces : le support et l'adhésif.
- Un élément ne peut pas être à la fois laqué RAL et adhésivé : incohérence à signaler.
- L'intitulé de matière au BAT décrit la vraie matière produite (ex. « occultant » au BAT mais transparent avec blanc de soutien en FAB : erreur). Une matière particulière prévue au devis (colle renforcée, ultra transparent…) doit être écrite au BAT.
- Aucun reste de gabarit (« Nom du dossier », champ vide) ni annotation de travail oubliée (flèches, repères de couleur sur les photos) : alerte.
- Page de garde : commercial du dossier, référence, cases et informations de la page 1 renseignées.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 07/08, 10/08, 11/08, 12/08, 26/08, 15/09, 23/09, 13/10, 14/10'),

('general', 'BAT : mentions obligatoires selon le cas', $t$
- Mur repeint sur la maquette : mention « Prestation de peinture non réalisée par Les Enseignistes » obligatoire.
- Entretoises dessinées au BAT : mention « L'emplacement des entretoises est représentatif, il sera défini par l'atelier ».
- Adhésif à poser à une hauteur précise : mention au BAT « Adhésif à poser à xxx mm du sol » (pas de repères en hauteur dans le fichier, qui gaspilleraient de la matière).
- Éclairage LED blanc par défaut : une autre couleur doit être écrite, ou « Couleur à nous indiquer » si le client ne l'a pas encore donnée.
- Une partie seulement des éléments est lumineuse : une vue « ce qui sera lumineux » est conseillée (alerte si absente).
- Éléments en relief et adhésifs mélangés : le BAT doit permettre de distinguer l'un de l'autre (vue 3D ou explication). Élément fait de plusieurs pièces superposées : schéma de montage pour l'atelier.
- Plaque transparente fixée par double face (visible à l'arrière) : à montrer et écrire au BAT, après confirmation du commercial (question sinon).
- La mise en situation montre l'emplacement de chaque élément ; s'il est inconnu, question.
- Exceptions : le rendu de l'éclairage sur la maquette n'est pas obligatoire ; un élément intérieur préparé d'avance peut ne pas apparaître sur la mise en situation, mais il figure au BAT avec sa description et son numéro.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 10/08, 13/08, 25/08, 26/08, 02/09, 14/09, 14/10'),

('general', 'Dimensions provisoires, mentions « en attente » et RAL', $t$
- « Dimensions provisoires » n'a de sens que si une VT doit encore venir. Sans VT, le BAT ne doit pas annoncer des dimensions « définitives » (ni sur les mises en situation).
- Quand l'agence ne pose pas et que le client fournit ses cotes, elles sont définitives : la mention provisoire doit disparaître de toutes les pages. Si l'agence pose elle-même, une VT est à prévoir même si le client a donné des cotes.
- Des notes de projet qui demandent de « vérifier les dimensions » imposent un BAT provisoire + un BAT VT.
- Un BAT qui part en FAB ne doit plus porter de mention « en attente » (RAL, dimensions, couleur à nous indiquer) : sinon question (l'information a-t-elle été obtenue ?).
- On ne déduit jamais un RAL d'une photo. Un fichier lancé avec « RAL_ATTENTE_RETOUR_CLIENT » dans son nom est un point en attente (question), pas une erreur ; un RAL précis sans source (ni VT, ni client) : question.
- Une option laissée au choix du client sur le BAT (teinte, effet…) doit avoir été tranchée à la validation, et la FAB doit suivre ce choix : sinon question.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 07/08, 10/08, 11/08, 26/08, 10/09, 15/09, 23/09, 05/10'),

('general', 'Quantités : LE piège', $t$
Contrôle numéro par numéro la quantité au devis, au BAT et le xN de chaque fichier de FAB — c'est l'erreur qui coûte le plus cher.
- Un élément recto verso ou un caisson double face compte une pièce (adhésif, visuel) PAR FACE : compte les faces de l'élément.
- Pièges types : quantités inversées entre deux numéros ; xN copié-collé d'un autre fichier ; élément en double qui compense un élément oublié.
- Recto seul ou recto verso pas clairement précisé au devis ou au BAT : question.
- Un objet visible sur la maquette mais non fabriqué (affiche, élément que le client possède déjà) n'est pas un élément du BAT ; s'il peut créer un doute sur une quantité, le BAT doit le mentionner. Écart de quantité entre la maquette et la légende sans mention : question.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 19/08, 20/08, 26/08, 07/09, 08/09, 16/09, 17/09, 29/09'),

('enseigne', 'Caissons', $t$
- Épaisseurs standard : 45 mm en non lumineux, 70 mm en lumineux (transformateur dans le caisson). L'épaisseur est notée au BAT et cohérente avec la vue 3D. Une autre épaisseur : question (validée par l'atelier ?), pas erreur. Un caisson lumineux nettement moins profond : question (place des LED et du transformateur).
- Plaque d'un caisson : face + 2 rabats (45 ou 70 mm) doit tenir dans le format de plaque (une face de 3050 mm ne passe pas).
- Caisson double face : les fichiers des DEUX faces ; verso préparé par le graphiste, éléments directionnels (flèches…) dans le bon sens de chaque côté.
- Adhésif de caisson : il couvre tout le caisson, rabats compris, avec de la marge. Si la couleur du caisson est imprimée (non laquée), l'adhésif de chaque face déborde sur la tranche (moitié de l'épaisseur par face + environ 5 cm tournant) : au format exact de la face, c'est une erreur.
- Caisson « face plexi diffusant » pleine face : sous-traité (pas fait en interne), avec un retour d'environ 5 cm visible au BAT. À ne pas confondre avec l'ajourage à plat (tôle alu découpée + plexi derrière), fait en interne.
- Ajourage à plat : assez loin du bord (tubes et potences à l'intérieur ; environ 40 mm minimum, sinon question) et détails qui passent une fraise de 4 mm. La plaque de plexi TRANSLUCIDE (pas transparente) derrière l'ajourage a sa ligne ou son fichier de FAB (dimensions, quantité, x2 en double face, numéro) : absente ou « transparent » = erreur.
- L'adhésif d'un caisson ajouré n'est pas évidé (l'atelier détoure au cutter) : les éléments qui correspondent aux zones ajourées sont retirés du visuel. Sur un caisson lumineux, pas d'évidage des blancs (sinon question).
- Caisson double face fait en interne : fichier de construction généré par l'outil interne ; ses trous de potence doivent correspondre à la fixation annoncée au BAT (sinon question).
- Si le client a une fiche technique ou une charte (franchise), type de caisson et épaisseurs doivent suivre la version à jour.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 10/08, 13/08, 19/08, 26/08, 01/09, 03/09, 10/09, 24/09, 14/10, 15/10, 16/10, 19/10'),

('enseigne', 'Lettres en relief : boîtiers, PVC, entretoises', $t$
- Lettres boîtiers = fond + chants alu + face, presque toujours lumineuses, 40 à 90 mm d'épaisseur ; lettres PVC = 19 mm en standard. Une incohérence (« boîtiers » en 19 mm…) : question.
- L'épaisseur des lettres est précisée au BAT (erreur si absente).
- Lettres rétroéclairées : « sur entretoises » obligatoire (sinon la lumière ne se voit pas) : erreur ou question si absent.
- Non lumineux sur entretoises : fichier PVC à l'échelle 1:1, entretoises NON placées (l'atelier s'en charge) + plan de pose papier. Lumineux : entretoises placées dans le fichier. Le nom du fichier contient « SUR_ENTRETOISES ».
- Lettres lumineuses : chaque partie doit être assez large pour être creusée et recevoir des LED ; zones trop fines : alerte.
- Creusage PVC : seule la forme prévue est creusée (pas les détails traités autrement).
- Lettrage en relief adhésivé : pas d'adhésif découpé à la forme de chaque lettre (l'atelier adhésive et détoure). Adhésif d'aplat sur des lettres : un rectangle avec de la marge, sans découpe machine.
- Lettres boîtiers générées par l'outil interne : sorties multiples du même fichier sous des noms différents = normal, pas un doublon.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 10/08, 11/08, 13/08, 14/08, 19/08, 20/08, 28/08, 10/09, 13/10'),

('decoupe', 'Plans de pose', $t$
- Le plan de pose (PDP) est réservé aux lettres et éléments en RELIEF, et se fait à la FAB (pas au BAT). Un dossier uniquement adhésif n'a pas de PDP (un adhésif découpé reçoit des repères de calage). PDP présent sans relief, ou absent avec des lettres en relief : à signaler.
- Type selon la fixation : entretoises, lisses ou tiges filetées → PDP PAPIER ; lettres collées → PDP « pleine chair » (par défaut).
- PDP pleine chair : contour tracé dans la couleur prévue du nuancier de l'atelier (ce n'est PAS un CutContour : ne pas signaler de « mauvais ton direct »), lettres retirées à l'intérieur, repères pour caler les éléments voisins (conseil). Lettres sur un panneau ou un caisson : pleine chair avec les repères du support.
- PDP papier : laize papier 1220 mm (au-delà, plusieurs fichiers, avec une lettre de jonction doublée pour le calage ; aucun élément d'un PDP ne chevauche un autre) ; jamais environ 5 m d'un seul tenant, découpé aussi dans la hauteur si besoin.
- Châssis ou structure tubulaire : PDP papier du châssis avec les tubes dessinés en entier à leur section réelle. Lisses (tubes 30 x 30 en standard) : PDP papier, RAL dans le nom.
- Une pièce non rectangulaire doit avoir un vrai fichier de découpe (l'atelier ne découpe sans fichier que des rectangles) ; un PDP peut être transformé en fichier de découpe (couleur du contour et nom changés).
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 13/08, 14/08, 21/08, 28/08, 09/09, 10/09, 05/10, 13/10'),

('decoupe', 'Plan de travail, CutContour, repères et fichiers clients', $t$
- Le plan de travail est la zone imprimée : recadré au plus juste autour du visuel + fonds perdus (vide important = matière gâchée : alerte).
- Avec un CutContour : environ 2 mm de marge entre le tracé et le bord du plan de travail (sinon la machine rate la découpe). Sans CutContour : bord à bord (taille finale + fonds perdus).
- Un CutContour à la taille finale avec des fonds perdus de pose au-delà est incohérent (les fonds perdus seront coupés) : erreur.
- Découpes et perçages : tracés en CONTOUR sans fond, jamais en plein.
- Repères de pose ou de calage d'un adhésif : sur le tracé de DÉCOUPE (sinon l'atelier les supprime), en contour sans aplat, sans surimpression. Un repère + 20 mm en bas et à droite autour d'un visuel dont le contour du support doit rester visible est normal.
- Microperforé : jamais découpé à la forme (rectangles seulement) : CutContour de forme sur du microperforé = erreur.
- Découpe à la forme d'une pièce très longue : éviter au-delà de 2 m (2,5 m tolérés) : alerte.
- Un CutContour qui ne suit pas la règle générale peut être une découpe propre au client : question.
- Fichiers fournis par le client : chercher les tracés en double ou parasites (il ne doit rester que le tracé voulu) ; entretoises fusionnées. Un logo en image (jpg) ne part jamais tel quel en découpe : vectorisé, ou fichier source demandé.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 19/08, 20/08, 26/08, 31/08, 09/09, 17/09, 01/10, 07/10, 12/10, 19/10'),

('adhesif', 'Fonds perdus : où et combien', $t$
- Les fonds perdus de pose ne vont que du côté où l'adhésif est bord à bord avec son support : un adhésif pleine largeur mais pas pleine hauteur n'en a qu'en largeur. Méthode : sur la maquette, regarde dans chaque direction si l'adhésif couvre tout le support.
- Adhésif de vitrine posé bord à bord : 20 mm de fonds perdus.
- Jamais de fonds perdus qui débordent dans une zone qui doit rester dégagée (ils empêchent la pose).
- Bords recouverts par un cadre ou un profilé et pose hors agence : l'adhésif peut sortir pile à la taille, sans fonds perdus.
- Croisements de couleurs (angles, jonctions) : chaque couleur déborde sous la voisine pour absorber un décalage, surtout au-delà d'environ 1500 mm (conseil : alerte).
- Petit adhésif à découpe droite en grande série : CutContour + fonds perdus ; à l'unité : format fini, sans tracé.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 19/08, 02/09, 16/09, 17/09, 23/09, 13/10, 19/10. Précise « Adhésif sur panneau rectangulaire » (20 mm seulement côté bord à bord)'),

('adhesif', 'Vitrophanie, blanc de soutien et matières transparentes', $t$
- Pose intérieure en miroir : visuel UNIQUEMENT blanc → teinté masse blanc miroir ; visuel en couleur → transparent + blanc de soutien + MIROIR. Le transparent n'est attendu que pour les éléments en couleur.
- Blanc TOTAL seulement si un aplat blanc couvre tout l'adhésif ; sinon SÉLECTIF (même un gros bloc). Méthode : compare l'emprise du ton White à l'emprise de l'adhésif. TOTAL ou SELECTIF doit figurer dans le nom et correspondre au fichier.
- Un DG (dos gris) ou tout support opaque avec du blanc de soutien n'existe pas : erreur de matière ou de nom.
- ULTRA_TRANSPARENT : écrit au BAT ET dans le nom de la FAB. Texte blanc sur ultra transparent ou dépoli imprimé : blanc de soutien sélectif. L'ultra transparent ne se découpe pas en interne : découpe de forme = sous-traitance (sinon erreur).
- Microperforé posé en INTÉRIEUR : impossible à l'atelier (impression côté colle) → sous-traité ; un fichier atelier pour ce cas est une erreur.
- Un adhésif blanc ajouté derrière un transparent imprimé est admis s'il a été demandé : vérifie que cette pièce a son fichier.
- Montage « transparent + teinté masse blanc superposés » : ancienne pratique propre à certains clients → question.
- Couleur d'un élément adhésivé : imprimée en CMJN si c'est la couleur de la charte du client, sinon une référence d'adhésif est attendue → question si aucune des deux.
- Adhésif sur un mur intérieur : en général colle renforcée (sinon question au commercial) ; la colle renforcée se traite comme un adhésif normal (laize 1480 mm).
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 13/08, 02/09, 10/09, 16/09, 12/10, 13/10, 14/10'),

('adhesif', 'Matière vierge posée en intérieur : pas de miroir', $t$
Une matière NON imprimée et identique des deux côtés (dépoli vierge, matière brute) posée en intérieur ne change ni le fichier ni son nom : pas de MIROIR exigé (un rectangle avec fond perdu et découpe suffit). Exception à « Pose intérieure ↔ fichier MIROIR ».
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 02/09 « Car c''est juste de la matière », 16/09 « ça change rien pour la FAB ». Contredit en partie « Pose intérieure ↔ fichier MIROIR »'),

('adhesif', 'Grands adhésifs, parties et obstacles', $t$
- Un visuel qui couvre plusieurs vitrines se fabrique en un adhésif PAR vitrine, chacun à sa taille.
- Avant de conclure qu'un adhésif doit être coupé, compare sa PLUS PETITE dimension à la laize : un adhésif long qui tient dans la laize ne demande ni découpe ni raccord (jusqu'à environ 5 m d'un seul tenant en découpe droite).
- Adhésif non découpé à la forme : l'atelier coupe et fait le raccord (le graphiste fournit la taille finale). Adhésif découpé à la forme : c'est le graphiste qui fournit les parties.
- Surface avec des zones qui restent dégagées (ouverture, équipement) : le graphiste découpe en parties d'après la VT ; un seul fichier qui couvre la zone dégagée : question.
- Une cote de vitrine fournie par le client inclut-elle le châssis ou les montants ? À vérifier avant d'en déduire une taille (question si on ne sait pas).
- Obstacle sur la surface (boîtier, boîte aux lettres…) : démontable → une seule bande ; sinon parties autour ; cotes de l'obstacle inconnues → adhésif plein découpé sur place, ou question.
- Lettrage découpé sur plusieurs panneaux : un adhésif par panneau par défaut ; si les panneaux sont assemblés par un tiers, lettre par lettre possible → question. Élément lumineux en plusieurs plaques : adhésif d'un seul tenant ou par plaque → question.
- Adhésifs qui doivent être alignés ou de niveau : regroupés dans un fichier avec des repères latéraux (conseil : alerte).
- Raccord placé de préférence sur un changement de couleur, pas à la longueur maximale d'une plaque (conseil).
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 07/08, 25/08, 02/09, 09/09, 30/09, 01/10, 08/10, 12/10, 16/10, 19/10'),

('plaque', 'Plaques rigides, perçages et pose', $t$
- PMMA ou dibond posé sur entretoises : trous de perçage dans le fichier, Ø 5 mm à 25 mm du bord, sans tomber dans un texte ou un visuel (un trou sur un logo n'est pas forcément bloquant : question).
- Plexi à poser sur des entretoises EXISTANTES : faisable seulement avec l'emplacement exact des entretoises (on ne perce pas le plexi sur place) → question si absent.
- Pose sur entretoises sur un bardage : le pas du bardage doit être connu (aucune entretoise dans un creux) → question si absent.
- L'agencement des pièces sur les plaques dans un fichier de FAB n'est pas à contrôler (la commande numérique optimise elle-même).
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 26/08, 09/09, 10/09, 13/10, 19/10'),

('nommage', 'Nommage : compléments', $t$
- Pas de mention superflue qui découle déjà de la matière (« sans plis » sur un dibond, épaisseur d'un dibond quand l'atelier n'en a qu'une).
- Suffixe de partie (P1/P2, PA/PB) seulement si l'élément est réellement fabriqué en plusieurs parties.
- L'échelle écrite dans le nom doit être l'échelle réelle du fichier : si la dimension du fichier égale la cote du BAT, il est en 1:1 et aucune mention d'échelle réduite n'est admise (sinon l'atelier multiplie à tort).
- Un nom d'adhésif dit la matière précise, jamais seulement « adhésif ».
- Fichiers repris d'une charte client (fichiers tout prêts) : renommés au nom du dossier en cours avec le numéro.
- Image de banque d'images : achetée (licence) avant la FAB ; une image en aperçu ou filigranée dans un fichier de FAB est une erreur.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 06/08, 13/08, 19/08, 07/09, 05/10'),

('general', 'Sous-traitance', $t$
- Sous-traitance SANS graphisme (potence, caisson vierge, plaques, rampe lumineuse, spots) : c'est l'atelier qui commande ; la FAB contient un sous-dossier de sous-traitance avec un fichier texte « <ÉLÉMENT> A COMMANDER CHEZ … ».
- Sous-traitance AVEC fichier (imprimeur en ligne, lambrequin imprimé, tapis…) : le graphiste commande et dépose le fichier dans le sous-dossier de sous-traitance de la FAB.
- Élément 100 % sous-traité : pas de fichier d'impression interne, mais un descriptif texte numéroté (dimensions, matière, options). Caisson commandé par l'atelier dont l'agence fournit l'adhésif : seul l'adhésif a un fichier.
- Néon : fichier séparé à l'échelle 1:1, aux dimensions finales du plexi, couleur du néon écrite, sans les fixations ; les éléments d'un même mot sont reliés sur un seul plexi (sinon les câbles se voient).
- Lettres ou caissons sous-traités : fichier comme pour l'interne, entretoises placées ; pas besoin de séparer par couleur.
- Bâche plus large que la laize : sous-traitée (pas de soudure en interne) ; une FAB interne hors laize est une erreur.
- Devis renvoyant à une référence fournisseur : l'élément dessiné au BAT doit correspondre à cette référence → question en cas de doute.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 20/08, 28/08, 04/09, 09/09, 17/09, 18/09, 24/09, 12/10, 14/10, 16/10'),

('general', 'VT : contenu et suivi', $t$
- Une VT réalisée (date au dossier) doit avoir son compte rendu dans le dossier VT ; sinon question.
- BAT VT : nom du dossier en haut de chaque page ; chaque cote demandée montre clairement ses extrémités (tirets, repères) ; il demande les cotes de TOUTES les surfaces possiblement concernées ; pour une refabrication à l'identique, toutes les dimensions nécessaires ; pour un aménagement intérieur, une consigne explicite (possibilité et mode d'accroche, photos utiles).
- Un dossier avec VT prévue comporte normalement un BAT provisoire, un BAT VT et le BAT définitif (dimensions issues du retour de VT).
- Visuels produits par le graphiste du client à partir de cotes transmises : ils doivent respecter les cotes de la VT.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 11/08, 12/08, 14/08, 11/09, 24/09, 14/10'),

('general', 'Mairie : compléments', $t$
- Le BAT mairie indique la hauteur entre le sol et le bas de chaque enseigne.
- Vitrophanie seule : normalement pas de dossier mairie ; s'il y en a un (monument historique…), un numéro par vitrine et préciser si les cotes sont celles des vitrines ou des adhésifs.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 02/09, 16/09'),

('general', 'Refabrication et modifications après validation', $t$
- Refabrication : un nouveau BAT (limité aux éléments refaits) n'est demandé que s'il y a des modifications (visuel, graphisme, dimensions) ; sinon son absence n'est pas une erreur. Chaque correction demandée par le client doit être appliquée, le reste identique à la fabrication précédente.
- Réfection d'un existant : tout changement de disposition, et le périmètre exact (pièces refaites ou réutilisées), doivent être confirmés par le commercial → question.
- BAT modifié après validation avec une différence de rendu final (dimensions, matière) : nouvelle validation nécessaire ; sans changement visible, pas de renvoi.
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 12/08, 08/09, 22/09, 13/10'),

('general', 'Cas particuliers : poser la question', $t$
Ces situations ne sont PAS des erreurs : pose la question.
- Produit hors standard, montage jamais vu, dossier atypique : validé par l'atelier ou le commercial ?
- Franchise : qui valide le BAT (franchiseur ou franchisé) ?
- Dimensions d'un remplacement différentes de l'existant visible sur les photos, sans VT.
- Élément habituel de la charte du client absent du BAT, ou élément ajouté sans être au devis ni au brief.
- Élément inhabituel au devis pour ce type de client, ou élément dont la matière ou le prix semble incohérent avec sa nature.
- Nature d'un support ambiguë (panneau sur lisses ou entretoises, ou caisson).
- Dossier de FAB partiel : le lancement en plusieurs fois peut être voulu.
- Validation du client avec une réserve (fixation, perçage) : tranchée par le commercial ou l'atelier ?
- Commande de matière brute sans impression : pas de fichier de FAB attendu ; confirmer que la partie graphique est sans objet.
- Un dossier client rangé sous un autre nom ou une autre lettre n'est PAS une erreur de rangement (on ne déplace pas un dossier existant).
$t$, 'proposee', 'Discussion avec Caroline (Discord) : 07/08, 10/08, 11/08, 14/08, 26/08, 27/08, 05/09, 07/09, 10/09, 11/09, 24/09, 01/10, 05/10, 09/10');

SELECT count(*) AS propositions FROM public.verif_regles WHERE statut = 'proposee' AND raison LIKE 'Discussion avec Caroline%';
