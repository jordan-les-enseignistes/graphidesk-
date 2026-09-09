# BAT Les Enseignistes — Plan (plugin UXP V6)

## Décisions verrouillées
- 4 produits intégrés (Panneau, Adhésif, Caisson, Lettres reliefs) : verrouillés, non éditables.
- Modèle : **Produit → Sous-produit** (2 menus déroulants à la génération). Pas de catégories/tuiles (testé puis abandonné).
- Stockage local par défaut, sans serveur. Échange via export/import.

## FAIT ✅
- [x] **Correctif bug V5.1 (.jsx)** — navigation en boucle + DOM après fermeture (le problème d'origine).
- [x] Portage UXP des 4 produits intégrés (aperçu live éditable, Générer / +1, Réinitialiser).
- [x] Thème adaptatif, scroll, repli des champs (chevron).
- [x] Lamination déplacée après l'option (Panneau & Caisson) ; épaisseur Caisson = 70 lumineux / 45 non lumineux.
- [x] **Moteur de produits sur-mesure** : Produit → Sous-produits ; champs Texte/Liste ; **sortie personnalisée par choix** (400 → 400x1870) ; **texte en blocs auto-séparés par « - »** ; champ **Optionnel/Obligatoire** (bloc vide disparaît + avertissement) ; **dupliquer** un sous-produit.
- [x] Stockage local `catalog.json` (getDataFolder) + migration anciens formats.
- [x] **Export/Import** : sélectif (cocher), **non destructif** (n'écrase jamais), fichier nommé d'après les produits. (`requiredPermissions.localFileSystem: "fullAccess"`.)
- [x] Menu volant (≡) pour Export/Import.
- [x] `.ccx` packagé + voie de distribution privée connue (double-clic).

## FAIT (suite) ✅
- [x] **Correctif .jsx V5.1 validé** — plus aucun blocage après de nombreux redémarrages (sujet d'origine clos).
- [x] **Adhésif découpé à la forme** : choix Dimension Vitrine / Adhésif.
- [x] **Logique conditionnelle** : champ « N'afficher que si [champ] = [valeur] » (bloc auto-masqué).
- [x] **Listes de choix dynamiques** : choix d'un champ selon la valeur d'un autre (ex. épaisseur selon matière), avec sortie perso par choix.
- [x] **Champ Obligatoire / Optionnel** + avertissement.
- [x] **Mode « Options avancées »** : masque obligatoire/conditions/choix liés par défaut (éditeur épuré).
- [x] Export/Import sélectif non destructif, fichiers nommés.

## FAIT (suite) ✅
- [x] **Logique conditionnelle, listes dynamiques, valeur auto (modifiable), mode avancé.**
- [x] **4 produits de base éditables EN PLACE + réinitialisables** (surcharge ; pas de copie). Originaux verrouillés intacts.
- [x] **Vérification automatique** : banc de test `tests/verify-builtins.js` → 0 écart sur 7 488 combinaisons (texte config == texte hardcodé).

## RESTE À FAIRE
- [ ] **Distribution finale** : re-packager le `.ccx` à jour et le donner aux graphistes.
- [ ] (Optionnel) Synchro / dossier partagé — pas nécessaire pour l'instant.
- [ ] (En attente) Test icône via `.ccx` re-packagé (species `chrome`).

## Différence mineure connue (acceptée)
- Adhésif matière « Dépoli… » : l'original force la lamination à « Sans » automatiquement ; dans la version éditable il faut la choisir à la main (l'auto-remplissage actuel ne gère pas « forcer pour certaines valeurs, laisser pour les autres »).

## PARKÉ / OPTIONNEL
- Icône du dock : config correcte mais **bug InDesign Adobe** (cosmétique) — ne pas re-creuser.
- Types de champ supplémentaires (nombre, case à cocher) et logique conditionnelle (« afficher RAL si Laqué ») : seulement si besoin réel.
