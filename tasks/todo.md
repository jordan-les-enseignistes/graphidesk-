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
