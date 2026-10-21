# Plan — FabRik : Lettres relief PVC rétroéclairées sur entretoises

**Demandeur** : Jordan
**Contexte** : nouveau module d'automatisation FabRik, sur le modèle des "Adhésifs découpés à la forme" (`full_automation.jsx`)
**Version cible** : 1.3.0 (nouvelle feature FabRik)
**Fichiers de référence (placements faits main, vérité terrain)** :
- `\\192.168.10.199\Syno-dossiers\C\CENTRE SERVICES\QUIMPER\FAB_CO2601-4928\PVC_19mm_RETROECLAIREES_SUR_ENTRETOISES_SUR_LISSES_CENTRE_SERVICES_QUIMPER_N2.pdf`
- AMEDEO (cursive, fallback cercles entiers intérieurs)
- LA GRANGE AU BOUC (serif capitales)
- AU P'TIT TERNOIS (VFR Publicité)

## Spécification métier (validée avec Jordan)

### Tracés
- **Rose** : tracé de découpe à l'échelle 1:1 (existant dans le fichier du graphiste)
- **Vert** : offset intérieur de **5mm** (défaut, paramétrable au cas par cas) — généré par le script
- **Entretoises** : cercles de **Ø9mm** (défaut = minimum, paramétrable à la hausse)

### Placement — style par défaut (Centre Services)
- Centre de l'entretoise **sur le tracé vert** → après pathfinder, l'encoche "mange" le vert en demi-cercle
- Contrainte dure : le cercle **entier** doit tenir dans le tracé rose (l'entretoise physique doit rentrer dans la lettre)

### Placement — fallback (style Amedeo)
- Si le cercle centré sur le vert ne tient pas dans le rose → **glisser vers l'intérieur** de la forme
- Avec **marge supplémentaire** au-delà du strict minimum (l'entretoise près du bord se voit dans le halo du rétroéclairage → moins esthétique). Marge paramétrable, défaut à définir (~3mm ?)
- Ces cercles-là ne sont PAS pathfindés (ils ne touchent pas le vert), ils restent des trous entiers

### Intelligence de placement (le cœur du sujet) — règle de COUVERTURE
Principe : la densité d'entretoises est une contrainte **physique du PVC 19mm**, pas un choix par dossier. Fichiers à l'échelle 1:1 → règle en mm absolus.

> **Règle** : tout point de la surface d'une sous-forme doit être à ≤ X mm d'une entretoise.
> X = rayon de couverture, constante calibrée sur les fichiers d'exemple (hypothèse initiale : 120–180mm).

Règles structurelles complémentaires :
1. **Minimum 2 entretoises par sous-forme fermée** (anti-rotation), sauf forme trop petite pour 2 → 1 seule (ex : point de "i")
2. **Priorité aux extrémités et angles** : les premiers candidats sont les maxima de courbure du tracé vert (fins de jambes, coins, pointes) — c'est le placement naturel du graphiste
3. Complétion des longues portions par écartement maximal (farthest-point sampling) jusqu'à satisfaire la couverture

### V2 (plus tard, hors scope V1)
- Mode "sur lisses" : alignement des entretoises sur N lignes horizontales (guides tracés par le graphiste ou hauteurs proposées par le script). Les fichiers Amedeo / La Grange au Bouc montrent ce pattern.

## Workflow utilisateur (2 boutons, comme convenu)

### Bouton 1 — "Placer les entretoises"
1. Dialogue : offset contour (déf. 5mm), Ø entretoise (déf. 9mm), rayon de couverture X (déf. calibré, réglable en avancé), marge fallback
2. Le script :
   - Vérifie/génère le tracé vert (offset intérieur du rose)
   - Décompose en sous-formes fermées
   - Calcule les emplacements (règles ci-dessus)
   - Pose les cercles sur un calque **`ENTRETOISES_PREVIEW`** (éditables : le graphiste peut déplacer/ajouter/supprimer)
   - Rapport : "N entretoises placées, dont M en fallback intérieur, K sous-formes détectées, 0 conflit"
3. Le graphiste ajuste à l'œil si besoin (les 10% de cas où l'algo est moins bon)

### Bouton 2 — "Finaliser"
1. Reprend les cercles du calque preview (y compris ceux ajoutés/déplacés à la main)
2. Re-vérifie la contrainte "cercle dans le rose" (alerte si un cercle déplacé à la main déborde)
3. Pathfinder : découpe les encoches dans le tracé vert (uniquement les cercles qui l'intersectent)
4. Mise au propre : couleurs (rose = tracé découpe, vert = offset), calques, nomenclature → conforme au fichier Centre Services
5. Rapport final

## Architecture technique

- **Script ExtendScript** : `src-tauri/assets/fabrik/scripts/entretoises_automation.jsx` (nouveau, même pattern que `full_automation.jsx`)
- **Formulaire React** : nouveau composant dans `src/components/fabrik/` (s'inspirer de `AdhesifForm.tsx`)
- **Intégration FabRik** : nouvelle entrée dans la page FabRik ("Lettres relief rétroéclairées / entretoises")
- **Géométrie en pur ExtendScript** (pas de lib) :
  - Aplatissement Bézier → polylignes (échantillonnage fin)
  - Distance point-segment, point-in-polygon (ray casting)
  - Offset : `offsetPath` natif d'Illustrator (action ou menu Objet > Tracé > Décalage)
  - Courbure discrète pour détecter angles/extrémités
  - Couverture : échantillonnage de la surface (grille ou points du contour) + test distance aux entretoises posées
  - Pathfinder : `app.executeMenuCommand("group")` + Pathfinder Minus Front par paires, ou opération de groupe composé

## Analyse du dossier POUR_NOUVEAU_GRAPHISTE (05/08/2026)
- BAT_.indd, VT_.indd et BAT_MAIRIE_.indd sont présents DEUX fois (racine +
  squelette), identiques au hash md5. Source classique de désynchronisation.
- BAT_MAIRIE_MR_ENSEIGNES.indd et BAT_MR_MR_ENSEIGNES.indd n'existent qu'à la
  racine et sont bien distincts : à conserver.
- EMPLACEMENT.txt du nuancier vise C:\Program Files\ (droits admin + chemin
  versé « 2026 »). On visera l'équivalent utilisateur, sans droits admin.
- GraphiDesk_1.0.7_x64-setup.exe : périmé (courant = 1.6.1). La librairie doit
  servir le lien de la dernière release, pas un .exe figé.
- BAT_Les_Enseignistes_V5.0.jsx distribué alors que le poste de Jordan a la V5.1.
- Polices Raleway_L.E.* présentes mais hors périmètre V1 (licences à vérifier).

## Choix techniques
- Squelette livré en .zip (le zip sait stocker les dossiers VIDES, et Jordan le
  met à jour en rezippant son dossier). Crate `zip` déjà présente dans le lock.
- Règle de nommage unique et auto-documentée : GraphiDesk remplace le jeton
  littéral NOMDUDOSSIER partout, dossiers ET noms de fichiers. Jordan renomme
  une fois BAT_.indd en BAT_NOMDUDOSSIER.indd dans son zip, et c'est réglé.
- Migration rendue IDEMPOTENTE (drop policy if exists) : elle s'applique qu'elle
  ait déjà tourné ou non, la question ne se pose plus.

## Étapes d'implémentation

- [ ] **Étape 0 — Calibration** : mini-script de mesure à lancer sur les 4 fichiers d'exemple → extrait Ø réels, offsets réels, distances entre entretoises voisines, distance max surface→entretoise. Fixe la valeur par défaut de X.
- [ ] **Étape 1 — Squelette du script** : lecture du document, identification du tracé rose (sélection ou calque), génération de l'offset vert 5mm
- [ ] **Étape 2 — Géométrie de base** : aplatissement, sous-formes, point-in-polygon, distance
- [ ] **Étape 3 — Placement** : candidats sur le vert, filtre "cercle dans le rose", extrémités/angles d'abord, complétion par couverture, fallback glissement intérieur
- [ ] **Étape 4 — Mode Placer** : calque preview + rapport
- [ ] **Étape 5 — Mode Finaliser** : re-validation, pathfinder, couleurs/calques Centre Services
- [ ] **Étape 6 — Formulaire React FabRik** + intégration (2 boutons)
- [ ] **Étape 7 — Tests réels** : rejouer les 4 dossiers d'exemple, comparer aux placements faits main, tuning de X et des heuristiques
- [ ] Bump 1.3.0, commit, tag, push (procédure GitHub Desktop habituelle)

## Points ouverts
1. Valeur de la marge fallback (défaut ~3mm ?) — à valider à l'usage
2. Comment le script identifie le tracé rose en entrée : sélection active ? calque nommé ? couleur ? (les adhésifs découpés ont déjà une convention → reprendre la même)
3. Anti-collision entre entretoises proches (deux encoches qui se chevauchent sur une pointe fine) → distance min entre centres = Ø + qq mm

## Review post-implémentation (V1 validée le jour même sur JŌTŌ + Centre Services)

### Livré
- ✅ `entretoises_automation.jsx` : modes Placer / Finaliser complets
- ✅ `LettresReliefForm.tsx` + carte FabRik "💡 Lettres Relief"
- ✅ `tools/entretoises_calibration.jsx` (outil de mesure, calibration à faire plus tard)
- ✅ Placement : couverture physique + extrémités/angles + min 2/forme + garde bord (2mm déf.) + fallback intérieur bidirectionnel
- ✅ Finalisation : encoches GÉOMÉTRIQUES (arc inséré dans la polyligne) — le Pathfinder scripté d'Illustrator a été abandonné après 3 échecs (résultats vides, il exige des surfaces remplies et reste peu fiable)

### Bugs corrigés en cours de route (leçons)
1. `ZOrderMethod.SENDTOFRONT` n'existe pas → `BRINGTOFRONT`
2. Normale de glissement : direction indécidable par point-dans-forme au milieu d'un trait large → choisir la direction qui ÉLOIGNE du bord, essayer les deux
3. Aplatissement Bézier fixe (10 pas) → adaptatif (~2mm) sinon les grands arcs faussent les distances
4. Tracés "ouverts" à extrémités confondues (flag closed=false) → accepter et refermer implicitement (les O étaient invisibles)
5. Perf : index de parité avec bbox (30-45s → 6s)
6. `setEntirePath` limité à ~1000 points → simplification de polyligne (tol. 0.05mm)
7. Segments droits aplatis en 1 point/sommet → densifier avant encochage (T/macrons sans encoches)

### Limites connues V1 (acceptées)
- Le placement auto nécessite du repositionnement manuel à l'œil (workflow preview prévu pour ça)
- Rayon de couverture 150mm par défaut non calibré (lancer tools/entretoises_calibration.jsx sur Amedeo pour affiner)
- Les anneaux verts encochés deviennent des polylignes denses (déviation < 0.05mm, OK fab)

### V2 envisagée
- Mode "sur lisses" : alignement des entretoises sur N lignes horizontales
- Amélioration des heuristiques de placement d'après retours d'usage

---

# Kit du nouvel arrivant (librairie de ressources) — plan V1

Contexte : arrivée d'une nouvelle graphiste. Objectif = un endroit unique où
chacun récupère et INSTALLE réellement les ressources de l'atelier, au lieu de
recevoir des fichiers à ranger soi-même.

Arbitrages Jordan (05/08/2026) :
- Stockage MIXTE : embarqué pour ce qui est couplé à la version de l'app,
  Supabase pour le reste.
- Personnalisation des gabarits au nom du graphiste : PLUS TARD.
- Squelette de dossier : bouton « Créer l'arborescence » dans GraphiDesk.
- Référence des gabarits = ceux du squelette NOMDUDOSSIER. Les copies à la
  racine sont des résidus SAUF les deux MR ENSEIGNES, qui sont distincts et
  doivent être conservés.
- Préréglages PDF / polices / checklist / espaces de travail : PAS en V1.

Périmètre V1 : nuanciers Illustrator, gabarits InDesign, scripts InDesign,
+ le plugin Cotes BAT déjà existant, regroupés sur une seule page.

## Découvertes (vérifiées sur le poste de Jordan, pas supposées)
- Nuanciers AI  : %APPDATA%\Adobe\Adobe Illustrator 30 Settings\fr_FR\x64\Nuancier\
- Scripts InDD  : %APPDATA%\Adobe\InDesign\Version 21.0\fr_FR\Scripts\Scripts Panel\
- Actions .aia  : <programme>\Presets\fr_FR\Scripts d'action\  (droits admin)
- Gabarits      : aucun dossier système -> Documents\
- PIÈGE 1 : les noms de dossiers Adobe sont LOCALISÉS (Nuancier/Swatches) et le
  numéro de version bouge (Illustrator 30, InDesign 21.0). À résoudre par scan.
- PIÈGE 2 : le Scripts Panel de Jordan contient déjà BAT_Les_Enseignistes_V5.0
  ET V5.1. Un installateur qui empile aggrave le problème.

## Analyse du dossier POUR_NOUVEAU_GRAPHISTE (05/08/2026)
- BAT_.indd, VT_.indd et BAT_MAIRIE_.indd sont présents DEUX fois (racine +
  squelette), identiques au hash md5. Source classique de désynchronisation.
- BAT_MAIRIE_MR_ENSEIGNES.indd et BAT_MR_MR_ENSEIGNES.indd n'existent qu'à la
  racine et sont bien distincts : à conserver.
- EMPLACEMENT.txt du nuancier vise C:\Program Files\ (droits admin + chemin
  versé « 2026 »). On visera l'équivalent utilisateur, sans droits admin.
- GraphiDesk_1.0.7_x64-setup.exe : périmé (courant = 1.6.1). La librairie doit
  servir le lien de la dernière release, pas un .exe figé.
- BAT_Les_Enseignistes_V5.0.jsx distribué alors que le poste de Jordan a la V5.1.
- Polices Raleway_L.E.* présentes mais hors périmètre V1 (licences à vérifier).

## Choix techniques
- Squelette livré en .zip (le zip sait stocker les dossiers VIDES, et Jordan le
  met à jour en rezippant son dossier). Crate `zip` déjà présente dans le lock.
- Règle de nommage unique et auto-documentée : GraphiDesk remplace le jeton
  littéral NOMDUDOSSIER partout, dossiers ET noms de fichiers. Jordan renomme
  une fois BAT_.indd en BAT_NOMDUDOSSIER.indd dans son zip, et c'est réglé.
- Migration rendue IDEMPOTENTE (drop policy if exists) : elle s'applique qu'elle
  ait déjà tourné ou non, la question ne se pose plus.

## Étapes
- [x] 1. Réécrire la migration 20260722190000 (jamais commitée) en idempotente.
- [x] 2. Migration : catégories nuancier|gabarit|script_indesign|autre,
      colonnes fichier_nom (nom réel + extension), description, version, ordre.
      + catégorie squelette. RLS alignée sur le motif maison (authentifié = tout).
- [x] 3. Rust : resoudre_dossier_adobe(cible) — scan par version décroissante,
      tolérant à la locale, erreur explicite listant ce qui a été cherché.
- [x] 4. Rust : installer_ressource() + statut_ressources() (non installé /
      installé / version différente), sur le modèle de get_indesign_plugin_status.
- [x] 5. Rust : détecter les versions PÉRIMÉES d'un même script et les proposer
      à la suppression — jamais de suppression silencieuse.
- [x] 6. Front : useAtelierRessources étendu (statut + install par catégorie).
- [x] 7. Front : page Ressources en sections, chaque ligne = état + bouton,
      carte plugin Cotes BAT intégrée, zone d'ajout réservée aux admins.
- [x] 8. Câblage : route + entrée Sidebar + permission access:ressources
      (aujourd'hui la page existe mais n'est atteignable par personne).
- [ ] 9. Vérification : installer un fichier témoin dans chaque cible sur ce
      poste, puis confirmer qu'Illustrator et InDesign le voient réellement.

## Parqué (non oublié)
- Bugs restants du module Simulation 3D (drapeau) — Jordan n'est pas satisfait,
  à reprendre après ce chantier. Rien n'est poussé, version locale en 1.7.0.

## Fait le 05/08/2026 — reste l'étape 9 (bout en bout dans l'app)
- src-tauri/src/ressources.rs : résolution des dossiers Adobe par SCAN (version
  décroissante + noms localisés), installation, statut, ménage des versions
  périmées, dépliage du squelette. 5 tests unitaires.
- Vérifié sur le poste : nuancier -> ...\Illustrator 30 Settings\fr_FR\x64\Nuancier,
  script -> ...\InDesign\Version 21.0\fr_FR\Scripts\Scripts Panel, et la détection
  de version périmée a bien repéré BAT_Les_Enseignistes_V5.0.jsx à côté de la V5.1.
- PIÈGE ZIP découvert à la mesure : Compress-Archive englobe le dossier racine et
  écrit des « \ » ; .NET part du contenu avec des « / ». Sans normalisation on
  obtenait un dossier imbriqué deux fois. Test qui compare les deux styles.
- Migration APPLIQUÉE en production le 05/08/2026 (feu vert Jordan). Vérifié :
  11 colonnes en place, permission access:ressources accordée à admin + graphiste.
  Constat au passage : le bucket atelier-ressources existait déjà alors que la
  table non — l'ancienne migration avait donc été jouée à moitié. L'idempotence
  a absorbé le cas sans qu'on ait à le diagnostiquer.
- RESTE : téléverser les vrais fichiers depuis la page (Jordan, admin), puis
  confirmer dans Illustrator que le .ase déposé apparaît bien dans
  Fenêtre > Nuancier > Bibliothèque de nuances. C'est le dernier maillon non
  prouvé de la chaîne.

## Kit du graphiste — notification de mise à jour (05/08/2026, fait)
- Colonnes `empreinte` (SHA-256) + `maj_le` sur atelier_ressources ; empreinte
  calculée au téléversement (crypto.subtle) et au statut (SHA-256 maison en
  Rust, validé sur les vecteurs du NIST).
- « À jour ? » se décide par EMPREINTE, pas par taille ni date : les deux
  mentent dès qu'un fichier est réenregistré sans changer.
- Signalement à trois endroits, même palette sky : pastille dans la barre
  latérale (mécanisme `badge` existant, réutilisé), bandeau en tête de page,
  ligne + bouton « Mettre à jour » sur la ressource concernée.
- Vérifié en faussant une empreinte en base : les trois apparaissent, puis
  l'empreinte réelle a été restaurée (aucune fausse alerte laissée).

## Personnalisation des gabarits — état des lieux
- Les coordonnées sont en clair dans les .indd : « Jordan NEAU » +
  « jordan@les-enseignistes.fr », MAIS aussi « Michael Renassia » +
  « contact@les-enseignistes.fr », et le téléphone 04 78 03 95 96 partout.
- Patcher les octets est EXCLU : les chaînes sont précédées de leur longueur,
  un nom plus court ou plus long casserait le fichier.
- Reste donc un script InDesign (find/replace) — en attente des réponses de
  Jordan sur QUOI remplacer et QUAND le déclencher.

## Personnalisation des gabarits (05/08/2026)
Consigne Jordan, après deux fausses pistes de ma part :
- SEULS son nom (« Jordan NEAU », « Jordan », « NEAU ») et son e-mail changent.
- Les autres adresses et TOUS les téléphones sont ceux des COMMERCIAUX :
  intouchables. J'avais commencé une détection automatique des contacts du
  fichier — supprimée, elle serait allée les écraser.
- Les valeurs sont SAISIES par l'utilisateur (pré-remplies depuis le profil,
  jamais imposées) : Jordan prépare parfois un dossier pour quelqu'un d'autre.
- L'identité de référence (celle présente DANS les gabarits) est un réglage
  d'application, `app_settings.gabarits_identite_reference` : elle appartient
  aux fichiers, pas à la personne qui télécharge.

Fait :
- `gabarit_personnaliser.jsx` : remplacements explicites, DANS L'ORDRE reçu
  (nom complet avant prénom seul, sinon le nom complet n'est jamais reconnu).
  Préférences de recherche InDesign remises à zéro puis RESTAURÉES — elles sont
  globales et persistantes, un réglage laissé par un autre script fausserait
  tout en silence. Casse activée, gabarits de page inclus.
- Rust : `personnaliser_gabarit` (COM InDesign via PowerShell, DoScript
  synchrone), `personnaliser_dossier`, `zipper_dossier`, `dossier_temporaire`.
- Les trois parcours passent par le même dialogue : gabarit, « Créer un
  dossier », et « Télécharger le .zip » (déplié → personnalisé → recompressé,
  sinon l'archive resterait au nom du précédent).
- Les échecs partiels sont affichés un par un : un gabarit resté au mauvais nom
  ne doit jamais partir sans qu'on le sache.

RESTE À FAIRE — jamais exécuté sur un vrai gabarit. À tester sur une COPIE.

### Test réel du 05/08/2026 sur une COPIE de BAT_.indd (original intact)
- Le gabarit porte les DEUX formes : « Jordan NEAU » (×3) ET l'emplacement vide
  « xxxx XXXX » (×1) sous le titre « VOTRE GRAPHISTE ». Idem pour les mails.
  La référence liste donc PLUSIEURS formes par champ, pas une seule.
- Résultat vérifié en interrogeant InDesign (pas les octets) : anciennes
  valeurs → 0, nouvelles → 4, et contact@ / Michael Renassia / 04 78 03 95 96
  intacts.
- PIÈGE : `doc.save()` sans argument fait une sauvegarde INCRÉMENTALE — le
  document est juste mais l'ancien nom reste lisible dans le fichier livré.
  `doc.save(File)` force une sauvegarde complète : 3928 Ko → 2600 Ko et plus
  aucun résidu exploitable. Le contrôle par octets seul est TROMPEUR, il faut
  demander à InDesign.
- Diagnostic sur 127 articles : l'unique occurrence restant dans les octets
  n'est rattachée à aucun article, hyperlien ni métadonnée — donnée morte.
- Ajouté ensuite : recherche dans les calques MASQUÉS et les notes de bas de
  page (exclus par défaut) — un nom manqué là partirait chez le client.

## Publication v1.7.0 — le drapeau reste au chaud (05/08/2026)
Jordan : publier SANS la 3D du caisson double face, pas finalisée.
Choix : ne pas extraire les changements du lot (ils sont entremêlés dans
relief3d.ts, Relief3dStudio.tsx…, un tri risquerait de perdre du travail), mais
masquer le CHOIX dans l'interface via `DRAPEAU_PRET = false`.
Vérifié : `typeEnseigne` n'est modifiable qu'à un seul endroit, à l'intérieur du
bloc masqué, et sa valeur par défaut est « lettres ». Le drapeau est donc
inatteignable, moteur intact. Repasser la constante à true le rétablit.

Ne PAS committer : .claude/settings.local.json, .claude/launch.json (locaux).

## Ajourage sur enseignes à plat (05/08/2026)
Demande Jordan, avec l'exemple du caisson « 10ème AVENUE » 6500x750 : seul le
texte + filet + étoiles s'allument. LED BLANCHES à l'intérieur, mais l'adhésif
doré/dégradé est devant → la zone doit s'allumer AUX COULEURS DU FICHIER.

Fait :
- `analyserZoneLumineuse` conserve désormais couleurs ET dégradés de la zone
  (elle ne gardait que les formes ; son résultat n'était utilisé nulle part).
- Deux modes ajoutés à l'éclairage : « Ajourage relief » et « Ajourage à plat ».
- `construireZoneAjouree` : une géométrie par couleur, émissive avec le dégradé
  du fichier en `emissiveMap`. Une seule face (le dos est contre le mur).
- `masqueAjourage` : perce la tôle à l'emplacement de la zone, sinon le plexi
  logé 3 mm derrière reste caché — le défaut déjà rencontré sur le drapeau.

Deux pièges trouvés À LA MESURE, invisibles à la relecture :
1. La rotation de 180° qui redresse le dessin RETOURNE la normale d'une surface
   plane : le plexi de l'ajourage à plat était éliminé comme face arrière.
   → `side: DoubleSide`.
2. Émission trop forte = la zone sature à BLANC PUR, ce qui détruit tout
   l'intérêt (voir l'adhésif traversé). Barème abaissé de `0.9 + 1.6*halo` à
   `0.25 + 0.55*halo`.

Mesuré sur un caisson noir 6500x750 avec logo doré en dégradé :
éteint 0 pixel doré | à plat 3073 | relief 3265, bbox centrée, teinte conservée.

## Ajourages — halo : état réel au 06/08/2026
Le halo est GLOBAL (seuil de luminosité sur toute l'image). Mesuré :
- mur crépi BLANC + ajourage  -> 65 % des pixels du mur saturés  (défaut)
- mur crépi GRIS  + ajourage  -> 0 % saturé, grain 161 conservé  (correct)
CORRIGÉ le 06/08 : sur les ajourages, la clarté du MUR et celle du FOND DE
SCÈNE sont plafonnées sous le seuil du halo. Le piège : le fond se déduit de
la couleur du mur mais est calculé à part — assombrir le mur seul ne changeait
rien, c'était le fond qui cramait. Mesuré en crépi BLANC : 0 % de saturation
(contre 63 %), grain 196 conservé, et la diffusion de l'enseigne répond
toujours au curseur (voile 644 -> 1288 entre les intensités 1,0 et 1,6).

HALO SÉLECTIF (`HALO_SELECTIF_PRET = false`) : la vraie solution, laissée en
place mais DÉSACTIVÉE. La chaîne à deux passes est écrite et la passe
d'addition fonctionne (vérifié : une texture grise injectée fait passer l'image
de 50 à 202). Mais la passe de lueur rend NOIR, même affichée seule à l'écran,
alors que les 9 maillages de la découpe sont bien conservés à l'assombrissement.
Bug non identifié — À REPRENDRE À TÊTE REPOSÉE, pas en fin de session.
Corrigés en route et à conserver : les composers doivent être redimensionnés
(sinon cibles à 300x150) et la texture de lueur relue à chaque image
(`setSize` recrée les cibles) ; il faut aussi une `OutputPass` finale, sans
quoi toute l'image sort assombrie (mur à 133 au lieu de 200).

## Onglet « Suivi VT » — Google Sheet intégré (09/09/2026)
Objectif Jordan : consulter et MODIFIER le tableau partagé avec le prestataire
sans quitter GraphiDesk. Doc en « tout le monde avec le lien → Éditeur »,
édition anonyme acceptée (décision Jordan).

Vérifié AVANT de coder, pas supposé :
- Google n'interdit pas l'intégration : l'éditeur Sheets ne renvoie NI
  `X-Frame-Options` NI `frame-ancestors`. Cadre chargé sans erreur de blocage.
- Ce qui bloquait était NOTRE CSP (`default-src 'self'`, pas de `frame-src`).
- LIMITE trouvée à l'essai : Sheets ouvre un sous-cadre `contacts.google.com`
  que Google refuse d'afficher ailleurs que chez lui → le partage et les
  mentions @ ne marcheront pas dans l'app. D'où le bouton « Ouvrir dans le
  navigateur », qui n'est pas décoratif.

Fait :
- `frame-src https://docs.google.com` ajouté à la CSP, rien d'autre.
- Page SuiviVt.tsx, route, entrée dans « Gestion de projet », permission
  `access:suivi_vt` (admin + graphiste).
- URL rangée dans `app_settings.suivi_vt_url` — changer de document ne doit
  pas demander une version.

RESTE — l'inconnue qui décide de tout : dans un cadre, les cookies Google sont
TIERS. L'éditeur peut s'afficher et refuser d'enregistrer. À prouver dans la
vraie webview Tauri : Jordan tape une valeur, et on relit le document côté
Drive pour confirmer l'enregistrement (empreinte avant l'essai : document VIDE).

## Suivi VT — lecture dans GraphiDesk + bouton navigateur (09/09/2026)

Décision : l'édition intégrée est un cul-de-sac (Google bloque les navigateurs
embarqués, politique assumée). Les gestionnaires de pose n'ont pas GraphiDesk :
la saisie DOIT rester dans le Sheet. GraphiDesk affiche donc le tableau en
LECTURE, et un bouton renvoie au navigateur pour modifier.

Mécanismes vérifiés le 09/09 sur un document public réel :
- [x] Noms des onglets : page `/edit` récupérée en anonyme, motif
      `docs-sheet-tab-caption">NOM` (le bandeau d'onglets est dans le HTML servi)
- [x] Données d'un onglet : `gviz/tq?tqx=out:csv&sheet=NOM` → 200 text/csv,
      anonyme, CSV correct (colonnes vides en queue à rogner)
- [x] CORS : impossible depuis le webview → passage par `tauri-plugin-http`,
      limité par capability au seul `https://docs.google.com/*`

Tâches :
- [x] tauri-plugin-http (Cargo + npm + capability scopée)
- [x] Retirer `ouvrir_fenetre_web` (fenêtre dédiée : échec prouvé, code mort)
- [x] Page Suivi VT : onglets, tableau, recherche, rafraîchir, bouton navigateur
- [x] Message clair si le document n'est pas partagé « tout le monde avec le lien »
- [x] Bump 1.9.0 → 1.10.0

Vérifié par harnais jetable (supprimé) sur un document public réel :
analyse CSV correcte sur 31 lignes, 22 colonnes fantômes rognées, guillemets
doublés / virgules et sauts de ligne internes préservés.
RESTE À CONFIRMER sur le vrai document : la liste des onglets (testée sur un
document mono-onglet seulement). Repli déjà en place : onglet actif affiché.

### Suite du 09/09 — chargement sans fin, puis vrai document

`tauri-plugin-http` a d'abord planté (commande absente : versions Rust/JS
désaccordées), puis, une fois accordées, sa promesse de requête ne se terminait
JAMAIS : écran « Lecture du tableau » perpétuel, aucune trace dans le journal.
Plutôt que de continuer à sonder une boîte noire, le plugin a été retiré au
profit d'une commande Rust maison `lire_page_google` :
  - adresse bornée à docs.google.com (pas de passe-plat vers le web) ;
  - délai maximum de 20 s : un blocage devient une erreur affichée ;
  - chaque appel journalisé (`[suivi-vt] url -> statut (type, octets)`), donc
    diagnosticable sans ouvrir les outils de développement du webview.
⚠ La cause du blocage du plugin n'a PAS été identifiée — le composant a été
supprimé, pas réparé.

Durcissement de la page : plus aucun chemin ne laisse l'écran en chargement
(adresse mal formée, onglet indéterminé).

Vérifié sur le VRAI document (1MHnyUgpuOmGOWTaacLz4iH8XE-ohOyK-, un .xlsx
déposé dans Drive et non une feuille native — les points d'accès répondent
malgré tout) :
- 5 onglets détectés : Mode d'emploi, Suivi VT, Anomalies, Tableau de bord, Listes
- les 5 renvoient leurs données en CSV (200), apostrophe comprise
- réglage `suivi_vt_url` basculé sur ce document
- dernier onglet consulté mémorisé, pour ne pas rouvrir sur « Mode d'emploi »

## Export de la maquette au 1:100e (09/09/2026)

Demande de Quentin : les grands bâtiments ne rentrent pas dans le plan de
travail Illustrator au 1:10.

⚠ Piège trouvé AVANT de coder : l'échelle n'est pas une simple option
d'export. `recale_vt.jsx` divise par 10 EN DUR (cible absolue + garde-fou de
dérive). Une maquette exportée au 1:100 serait donc recalée dix fois trop
grande à la suite VT. L'échelle doit voyager de l'export jusqu'au recalage.

- [x] `svgExport.ts` : `SCALE` devient une option (`echelle`, défaut 10) —
      tout passe déjà par `u()`, la propagation est acquise
- [x] Titre du SVG : « échelle 1:N » au lieu du 1:10 écrit en dur
- [x] `MeasureDoc.echelle?: number` — persisté avec le projet, donc disponible
      à la suite VT sans migration (le doc est déjà sérialisé)
- [x] Case « Échelle 1:100e » sous « Générer le PSD photomontage », libellé du
      bouton prémaquette mis à jour
- [~] `recale_vt.jsx` : ÉCARTÉ par Jordan le 09/09 (« on ignore la partie
      importation et rescale après VT, ça reste hyper rare »). À la place, la
      suite VT REFUSE le recalage d'une maquette qui n'est pas au 1:10, avec
      un message explicite : les cotes VT restent enregistrées, le report se
      fait à la main. Mieux vaut un refus lisible qu'un fichier détruit d'un
      facteur 10 en silence.
- [x] Harnais hors-ligne avant de livrer : vérifier les cotes obtenues aux
      deux échelles (cf. [[feedback-preuve-avant-ship]])

Preuve (harnais jetable, supprimé) sur une zone de 4000 × 2000 mm :
| échelle | page | rectangle de la zone |
|---|---|---|
| 1:10 | 460 × 310 mm | 400 × 200 |
| 1:100 | 46 × 31 mm | 40 × 20 |
Rapport exactement décuplé, titre du document conforme à l'échelle.

## Kit du graphiste — nouveaux BAT/VT + livraison à l'unité (09/09/2026)

Vérifications AVANT de coder :
- Nouveau `BAT_.indd` : « Jordan NEAU » ×8 et son mail ×8 → personnalisable
  tel quel. Les repères « xxxx XXXX » que j'avais introduits ne servent plus.
- `VT_.indd` : aucune identité. Le seul « Jordan » est dans les métadonnées
  d'un logo Illustrator importé, hors de portée de la recherche InDesign.
- `BAT_MR.indd` : seulement `florent@mr-enseignes.fr` → à NE PAS personnaliser
  (contact MR ENSEIGNES, même règle que les commerciaux). À confirmer.
- Zip : reconstruit à partir du squelette d'ORIGINE. Comparaison fichier par
  fichier — seuls BAT_ et VT_ diffèrent, `BAT_MAIRIE_.indd` est identique à
  l'octet près et se retrouve intact dans l'archive.

Fait :
- [x] `lister_archive` / `extraire_entree` (Rust) — mêmes normalisation et
      garde-fou « zip slip » que `creer_arborescence`
- [x] Bouton « Contenu » sur le squelette : chaque fichier livrable seul, un
      `.indd` passant par la MÊME personnalisation que le dossier complet
- [x] Bouton « Remplacer le fichier » (admin) : met à jour une ressource sur
      place — rang, description et notification de MAJ préservés
- [x] 3 tests unitaires : liste sans dossier racine (deux styles de zip),
      extraction d'un seul fichier, erreur lisible sur entrée absente — 9/9
- [ ] Téléverser les 2 fichiers dans la librairie : Jordan seul (bucket privé)

## Extensions InDesign : les deux traitées pareil (09/09/2026)

Remarque de Jordan : « pourquoi Cotes BAT n'est pas fait pareil ? c'est pareil
en soi ». Vérifié sur son poste — il avait raison, et le problème était pire
que sa question : le « Rédacteur » est bien une extension UXP
(`com.izy.enseignistes` v6.0.0), alors que le Kit distribuait encore
`BAT_Les_Enseignistes_V5.1.jsx`, l'ANCIEN script d'avant l'extension.

- [x] Aperçu redimensionnable (Enseignistes-UXP) : `resize` CSS n'a AUCUN effet
      sous UXP → poignée dessinée à la main + glisser à la souris. L'ajustement
      automatique reste, et ne cède qu'après un vrai glisser ; « Réinitialiser »
      le rétablit. Version portée à 6.1.0, paquet `BAT-Enseignistes.ccx`.
- [x] Rust généralisé à N extensions : table `PLUGINS_UXP`, statut/installation
      par `id`, et `desinstaller_plugin_indesign` (registre UXP + dossiers,
      InDesign fermé exigé).
- [x] `version.txt` supprimé : la version se lit DANS le `.ccx` (manifest.json).
      Un fichier à tenir synchrone d'un autre finit toujours par diverger.
- [x] Encart unique « Extensions InDesign » : installer / mettre à jour /
      désinstaller, même vocabulaire que le reste du Kit.
- [ ] Retirer `BAT_Les_Enseignistes_V5.1.jsx` de la librairie (suppression pour
      toute l'équipe — geste de Jordan)
- [ ] Décider si `Enseignistes-UXP` rejoint `plugins/` comme `cotes-bat-uxp` :
      aujourd'hui GraphiDesk embarque un paquet dont la source vit hors dépôt.

## Rédacteur BAT (plugin UXP 6.2.0) — refonte de la logique d'écriture (21/09/2026)
Validé par Jordan point par point (1,2,3,4,5,6,7,8,9,11,12a,13,15,16,17 ; 10 et 14 abandonnés).
- [x] UN seul moteur : produits de base = configs (builtins-config) passées au moteur catalog.js ; products.js supprimé
- [x] Moteur : case à cocher, condition multi-valeurs + en chaîne, blocs optionnels `[ … ]`, repli `A|B`, valeurs ignorées (quantité 1), plusieurs parties auto
- [x] Finition collée à l'élément (« Laqué RAL 7016 mat », « Adhésif occultant mat contrecollé »)
- [x] (en attente de dimension) / case « Dimension provisoire »
- [x] Fixations : Vissé panneau ; caisson simple face (Vissé / entretoises / lisses) et double face (potence / monopotence + RAL)
- [x] RAL vide → « (à définir) » ; teinté masse sans réf conservé ; dépoli sans lamination par défaut
- [x] Plusieurs parties : > 3050 ou (> 1500 et > 1500) ; caisson = plaque (L + 2 ép.) × (H + 2 ép.)
- [x] Caisson : face plexi, ajourage relief PMMA 30 mm, « Rétroéclairage LED » ; lettres « Rétroéclairées », tranches laquées RAL, adhésif contrecollé sur la face
- [x] Harmonisation « 3 mm », « 1200 x 300 mm », tiret normal
- [x] Migration : modèles de base déjà rendus modifiables remplacés par la v2 au premier lancement
- [x] Banc de test réparé : spécification (phrases attendues) + balayage de toutes les combinaisons
- [x] Paquet .ccx 6.2.0 embarqué dans GraphiDesk

### Revue (21/09/2026)
- `node plugins/enseignistes-uxp/tests/redaction.test.js` : 82 phrases conformes, 200 312 combinaisons sans phrase cassée, migration conforme.
- Catalogue réel de Jordan : produits sur-mesure (Temporis) → 0 différence sur 100 combinaisons, ancien vs nouveau moteur.
- Panneau chargé hors InDesign (UXP simulé, navigateur de test) : migration v1 → v2 + message, saisies réelles sur les 4 produits, éditeur « Modifier » sans erreur.
- Paquet 6.2.0 dans src-tauri/assets/indesign/. Reste : essai de Jordan dans InDesign (installation via GraphiDesk).

## Lot feedbacks 05/10/2026 (v1.13.0, Rédacteur 6.3.0) — en test chez Jordan
- [x] 3D : zoom +/− (tablette de Carole)
- [x] 3D : platines murales systématiques au pied des tubes, débord réglable (40 mm)
- [x] 3D : cotes largeur × hauteur avec flèches (case), aussi dans le PNG ; dessinées hors chaîne du halo
- [x] Photomontage : reflet de vitrine (image de Carole) en calque Écran 45 % sur les zones vitrage — case décochée par défaut, mémorisée par poste ; prouvé par lecture des octets du PSD
- [x] Rédacteur : caisson rond (« Diamètre 600 mm » en toutes lettres) ; double face adhésivé « x 2 (recto/verso) » (coché d'office, décochable) ; lettres rétroéclairées sur entretoises d'office + choix « Entretoises + lisses » — 95 phrases conformes
- [x] Retours Jordan : molette de zoom continue (curseur) ; cotes réorganisées (une par côté, petites cotes nommées en bas), textes alignés sur leur ligne et pivotant autour d'elle, jamais masqués ; profondeur de potence + épaisseur caisson ; cotes de profondeur des lettres (épaisseur, déport)
- [x] Reflet vitrine : l'image de Carole devient le contenu à 100 % (bleu conservé en calque masqué)
- [x] Rédacteur 6.3.1 : adhésif diffusant (dos blanc) d'office en caisson lumineux — 98 phrases conformes
- [x] FabRik Néon flex : deux couleurs en deux sélections (marquage couleur 1, puis génération) — un seul néon (plaque/échelle/cotes communes), fusion et habillage par couleur ; mini tuto. Syntaxe vérifiée, PAS testé dans Illustrator
- [ ] Plus tard : néon multicolore dans la 3D, bâches (nouveau produit, à spécifier) ; Mesure photo : ne pas toucher pour l'instant (tag `mesure-photo-avant-fiabilisation`)

## Vérif FAB — « mini Claude » de vérification des dossiers (spec du 19/10/2026, À VALIDER)

**Demande** : Jordan, suite au mail de Léa (14/10) sur les erreurs récurrentes en fab. Test de faisabilité réussi
sur `Y:\JORDAN\TEST` (QR code retiré volontairement → détecté ; process CutContour / fonds perdus 20 mm droite+bas appris).

### Principes validés
- Claude (API) est l'interlocuteur unique : il lit, compare BAT / devis / maquette / fab, juge, POSE DES QUESTIONS en cas de doute.
- GraphiDesk MESURE en tâche de fond (lecture seule, jamais Illustrator) et donne des faits ; Claude juge.
- Base de règles évolutive ; une réponse « c'est notre façon de faire » = PROPOSITION de règle ; **seul Jordan valide**.
  Une réponse « spécifique à ce dossier » (refus mairie, demande client) reste dans l'historique du dossier.
- Lecture seule sur le serveur ; aucun module existant modifié en dehors du bouton d'entrée ; module réservé à Jordan d'abord (RBAC).

### Architecture
- **Clé API** : nouvelle clé dédiée (compte API de Jordan, plafond de dépense), stockée en SECRET Supabase
  (`npx supabase secrets set`, tapée par Jordan) — jamais dans l'application ni dans le dépôt.
- **Edge Function `verif-fab`** : relais authentifié (JWT de l'utilisateur) → API Claude en streaming.
  Vérifie le plafond mensuel, enregistre l'usage EXACT de chaque appel (tokens entrée / sortie / cache lu / cache écrit,
  modèle, coût calculé) rattaché à l'utilisateur et à la conversation.
- **Boucle d'outils côté GraphiDesk** : Claude appelle des outils exécutés localement, en lecture seule :
  `lister_dossier`, `analyser_pdf` (boîtes, cotes des tracés, textes, couleurs CMJN, calques, tons directs, images/dpi —
  via pdfjs-dist déjà présent), `voir_page` (rendu image envoyé à Claude), `lire_regles(categorie)`,
  `demander_devis` (ouvre la zone de dépôt), `proposer_regle`, `rendre_rapport` (format fixe).
- **Modèle** : Claude Opus 5.5, réflexion adaptative. Base de règles en cache (≈10× moins chère après le 1er appel).

### Données (Supabase, RLS : chacun voit SES conversations, l'admin voit tout)
- `verif_conversations` : id, user_id, dossier_id (nullable), chemin_dossier, titre, statut (en_cours / terminee), is_archived
  (archiver ne supprime JAMAIS), rapport (JSON), timestamps.
- `verif_messages` : conversation_id, role, contenu (JSON des blocs), fichiers joints, created_at — permet de rouvrir une ancienne conversation.
- `verif_usage` : user_id, conversation_id, modèle, input/output/cache_read/cache_write tokens, cout_usd, created_at.
- `verif_regles` : catégorie (général, adhésif, plaque, bâche, enseigne…), titre, texte, conditions/exceptions, statut
  (proposee / validee / refusee), proposé_par, validé_par, dates, source (conversation). Seules les `validee` partent à Claude.
- `verif_constats` : conversation_id, type (erreur / oubli / question), catégorie, règle liée, libellé — alimente les stats.

### Écrans
1. **Entrée depuis un dossier** : bouton « Passer en vérification » à côté d'Archiver (`DossiersTable.tsx`) → choix du
   dossier serveur (mémorisé) → ouverture de la conversation.
2. **Vérif FAB** (nouvel onglet) : à gauche mes conversations (recherche, archivées repliables) ; au centre la discussion
   façon Claude (streaming, zone de glisser-déposer pour le devis et tout fichier) ; rapport ✓ / ⚠ / ❓ affiché en carte.
   Garde-fou immédiat, SANS appel API : « Pas de devis dans ce dossier — glisse-le ici ».
3. **Admin (Jordan)** : coûts par graphiste / par jour / par conversation (exacts) ; qui a vérifié quel dossier ;
   erreurs et oublis les plus fréquents ; file des règles proposées à valider / refuser ; édition de la base.

### Lot 1 + lot 2 — livrés le 19/10/2026 (v1.14.0, NON poussée — en attente de validation)
- [x] Tables + RLS + permission `access:verif_fab` (admin seul) — appliquées en base par Claude, avec l'accord de Jordan
- [x] Edge Function `verif-fab` déployée : clé en secret, modèle Opus 5.5 effort medium, repli « fallbacks: default », usage exact journalisé
- [x] Onglet Vérif FAB : conversations par utilisateur, flux en direct, glisser-déposer, archivage (rien n'est supprimé), réouverture
- [x] Lecture des PDF sans Illustrator (pdf-lib + pdf.js) — mesures identiques à PyMuPDF sur VLC Conseil
- [x] Bilan structuré (⚠ erreurs + ✓ une ligne) + questions à boutons ; réflexion masquée (sortait en anglais)
- [x] Base de règles : 5 règles de Jordan reprises, proposition par Claude, validation/refus/édition par l'admin seul
- [x] Bouton « Passer en vérification » dans les dossiers (lien dossier ↔ conversation)
- [x] Espace admin : coûts (mois, graphiste, dossier), statistiques (catégories, graphistes, dernières erreurs), règles
- [x] Testé dans la vraie fenêtre de dev sur Y:\JORDAN\TEST : QR manquant trouvé, questions/réponses, règle proposée, rapport, question de suivi
- [ ] Non testé : glisser-déposer d'un vrai devis (pas de devis dans le dossier de test)

### Revue — coûts mesurés (Opus 5.5)
- Vérification complète (analyse + questions + rapport, 6 appels) : 0,165 $ ; question de suivi : quelques centimes
- Poste principal : écriture en cache des images de pages (~0,09 $), puis texte produit (~0,065 $)

### Session 2 (19/10/2026 soir, sans appel API — demandé par Jordan)
- [x] Bible du graphiste (PROCESS-IMPRESSION, 7 p.) → 21 règles validées en base (remplacent 4 règles provisoires ; CutContour en série conservée)
- [x] Devis reconnu sous son vrai nom : bon de commande Dolibarr « CO<numéro>.pdf » (souvent dans MAQUETTE) ; prompt mis à jour
- [x] Recherche du dossier serveur depuis le nom GraphiDesk (<racine>\<initiale>\<CLIENT>\<sous-dossier>, mots collés gérés, racine par poste) — testée sur 9 vrais noms
- [x] Outil comparer_visuels : contours BAT/maquette ↔ FAB recalés (échelle + position), % retrouvé, déformation, image rouge/bleu — prouvé hors ligne (VLC : QR seul en rouge ; City Locker : PVC 19, PVC 10, caisson conformes)
- [ ] Non testé dans l'app : comparer_visuels côté navigateur (même code, rendu pdf.js au lieu de PyMuPDF) et la fenêtre de choix du dossier serveur
- Hors périmètre (Jordan) : devis depuis Dolibarr — le graphiste le donne
- [x] Hauteur de CHAQUE lettre (sous-tracés regroupés, capitale par ligne, lettres rondes tolérées) — Optic Duroc corrigé : 66,6 mm partout
- [x] Surimpression mesurée par ton direct (City Locker : White 100 % en surimpression ; graphisme quadri non — question à Jordan)
- [x] 6 règles tirées des erreurs réelles (Guy Hoquet, Optic Duroc, miroir/pose, surimpression) → 28 règles validées
- [x] Prompt : lecture de la VT et du dossier MAIRIE (« ATTENTION LA MAIRIE REFUSE »), photos brutes limitées à 4

## VérifIzy — retours du test Camif (20/10/2026)
- [x] Recherche dans tous les dossiers GraphiDesk (accueil)
- [x] L'analyse continue hors de VérifIzy (page gardée montée dans MainLayout) + toast à la fin
- [x] Badge du menu : vérifications prêtes (a_voir) + règles proposées (admin)
- [x] Plus d'appel API après rendre_rapport (le résumé en double coûtait ~0,045 $)
- [x] Cache 1 h pour outils + consignes + règles
- [x] Règles : trou de numérotation = alerte, zoom sans numéro, pas de FAB = vérif avant FAB, raccord sur la dimension finale
- [x] Rapport compact (lignes, conformes repliés, discussion plus étroite)
- Constat : le « 1 $ » = deux analyses lancées en parallèle (navigation), pas les réponses aux questions (0,12 $)
- [x] Recherche limitée à « Mes dossiers » (les miens, non archivés), comme la page
- [x] Vérifications de test supprimées (14 + messages + coûts) le 20/10, avant la mise en service
- [x] Relance auto du cache : lun-ven 8h30-18h (Paris), après la 1re vérif du jour, 45 min sans appel, un seul poste (réservation atomique), arrêt du jour si une relance ne relit rien
- [x] Modèle choisi par l'admin (verif_parametres) dans « Coûts » ; liste des modèles via l'API, le plus récent en tête
- [ ] À vérifier : 1re ligne « Entretien du cache (auto) » dans les coûts ≈ 0,002 $ (cache_read ≈ 10 500 tokens)
- [x] Raccord : règle dédiée « dimension FINALE » + renvoi depuis « Limites machines » et « laize par matière » (Camif 2e test : l'IA s'était appuyée sur Limites machines)
- [x] Bandeau : nom du dossier cliquable → Explorateur (commande Rust verif_ouvrir_dossier) ; bouton « Vérifier un autre dossier »
- [x] Constat « Corrigé » / « Rouvrir » sans relancer d'analyse (rapport JSON : corrige, corrige_le) ; verdict « Tout est corrigé » si plus d'erreur ni de question
- [x] Coûts et statistiques remis à zéro le 20/10

## VérifIzy — niveau « Remarque » (en ligne le 20/10, v1.15.0)
- [x] App : niveau remarque (pastille, groupe du rapport, compteurs, stats à part), bouton « Tout valider » par groupe, éditeur de règles agrandi
- [x] Au push : consignes déployées, règles de gravité passées à 4 niveaux, rapport Camif reclassé
      1. déployer verif-fab (consignes 4 niveaux + enum « remarque » déjà modifiés dans index.ts)
      2. appliquer supabase/migrations/20261020023000_verif_fab_niveau_remarque.sql

## v1.16.1 — VérifIzy : PDF lourds (> 60 Mo)
- [x] Banc hors-ligne sur les fichiers réels Bagelstein (120 → 556 Mo) : mesures identiques à la méthode complète (N3C, N2A), et sur 4 PDF vectoriels City Locker / Camif (CMJN, tons directs, boîtes)
- [x] Rust : `verif_lire_plage` (lecture par morceaux) + `verif_squelette_pdf` (PDF sans données d'images ni données privées Illustrator)
- [x] JS : au-delà de 60 Mo, pdf.js lit à la demande, pdf-lib reçoit le squelette ; délai max 5 min
- [x] Test dans l'app (Y:\JORDAN\TEST_LOURD, fichier de 556 Mo) : mesuré (format, résolution, fonds aux 4 bords)
- [x] Bandeau « vérification plus longue » à la préparation + durée estimée selon le poids
- [x] Espace de couleur de chaque image (CMJN / RVB / gris / ton direct) : fausse alerte « RVB » sur un fichier tout en images CMJN ; description d'analyser_pdf précisée (edge function déployée)
- Constat : l'ancienne méthode comptait des « tracés » dans les données privées d'Illustrator (bruit) ; la nouvelle ne les lit plus.

## Rédacteur BAT 6.5.0 (dans la v1.16.1)
- [x] Panneau : adhésif « Dos blanc » → « Adhésif diffusant contrecollé » (Caroline : plexi transparent de caisson)
- [x] Nouveau produit « Bâche » (spec Jordan 21/10) : Bâche PVC occultante - Impression recto|recto/verso - dimensions - bords (ourlet, œillets avec renfort de 44 mm / sans renfort tous les 500 mm maximum, fourreaux haut/bas/côtés/périmétraux) - fixation tendeurs|serflex - quantité
- [x] Banc : 120 phrases conformes, 152 755 combinaisons sans phrase cassée, migration conforme ; BUILTIN_VERSION 6
- [x] Paquet .ccx 6.5.0 dans src-tauri/assets/indesign (14 entrées, sans antislash)
- [ ] Essai de Jordan dans InDesign
