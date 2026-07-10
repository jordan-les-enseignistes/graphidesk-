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
