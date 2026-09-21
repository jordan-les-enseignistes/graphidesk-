# BAT Les Enseignistes — Plugin UXP (V6)

Portage du script InDesign `BAT_Les_Enseignistes_V5.x.jsx` en **plugin UXP** :
un vrai panneau ancré, qui remplace les fenêtres modales (à l'origine du bug de blocage).

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Déclaration du plugin (panneau, version hôte InDesign 21+) |
| `index.html` | Structure du panneau |
| `index.js` | Moteur d'interface (champs dynamiques, aperçu, boutons) |
| `builtins-config.js` | Les 4 produits de base (modèles de texte) — **source unique** |
| `catalog.js` | Moteur de rédaction (modèles, conditions, automatismes) + stockage |
| `editor.js` | Éditeur des produits sur-mesure et des modèles rendus modifiables |
| `indesign.js` | Opérations sur le document (écriture, ajustement, duplication) |
| `styles.css` | Mise en forme |

## 1. Charger le plugin pour tester (mode développeur)

1. Lance **InDesign 2026**.
2. Installe **UXP Developer Tool (UDT)** depuis l'app **Creative Cloud Desktop**
   (onglet *Stock & Marketplace > Plugins*, ou recherche « UXP Developer Tool »).
3. Ouvre **UDT** → InDesign doit apparaître dans la liste des apps connectées.
4. Clique **Add Plugin…** et sélectionne ce dossier (`manifest.json`).
5. Sur la ligne du plugin : menu **•••  → Load**.
6. Dans InDesign : menu **Fenêtre > Extensions (ou Modules externes) > BAT Les Enseignistes**.

> Après modif d'un fichier de code : **••• → Reload**.
> Après modif de `manifest.json` : **••• → Unload** puis **Load**.

## 2. Tester

1. Sélectionne un **bloc texte** dans le document.
2. Dans le panneau, choisis un produit, remplis les champs → l'**aperçu** se met à jour en direct.
3. **Générer** : écrit le texte dans le bloc sélectionné (et agrandit la hauteur si débordement).
4. **+1** : écrit le texte puis duplique le bloc + sa numérotation, comme la V5.

## 3. Distribuer à l'équipe (fichier .ccx)

1. Dans **UDT**, ligne du plugin : **••• → Package** → choisis un dossier.
2. UDT génère un fichier **`.ccx`**.
3. Dépose ce `.ccx` à un seul endroit (page de téléchargement, dossier cloud partagé…).
4. Chaque graphiste **double-clique le `.ccx`** → Creative Cloud l'installe.
   (Un avertissement « plugin non vérifié » apparaît : c'est normal pour une distribution privée,
   il suffit de confirmer l'installation locale. Aucune signature requise.)

## Notes de portage

- Logique de génération de texte **identique** à la V5.
- **Correction** : dans « Lettres reliefs », l'option de fixation « Tige filetée » de la V5 avait
  un espace parasite qui la rendait inactive — corrigée ici (génère « Sur tiges filetées »).
- La section « Potences » du Caisson, jamais affichée en V5 (donc sans effet), n'a pas été reportée.
- Depuis la 6.2.0, **un seul moteur de rédaction** : les produits de base sont des modèles
  (`builtins-config.js`) passés au même moteur que les produits sur-mesure (`catalog.js`).
  L'ancienne version codée en dur (`products.js`) divergeait de sa copie modifiable sans
  que rien ne le signale. Toute modification des modèles : incrémenter `BUILTIN_VERSION`
  (les copies « rendues modifiables » des postes sont alors remplacées au lancement).
- Vérifier la rédaction : `node plugins/enseignistes-uxp/tests/redaction.test.js`
  (phrases attendues validées avec Jordan + balayage de toutes les combinaisons).

## Publier une nouvelle version (depuis GraphiDesk)

**Ce dossier est la source de vérité du plugin** depuis le 09/09/2026 : il
vivait auparavant hors du dépôt (`Desktop\DEVELOPPEMENT\ACTIF\Enseignistes-UXP`),
donc sans historique, alors que GraphiDesk en embarquait le paquet.

1. Modifier le code ici, puis bumper `manifest.json` → `version`.
2. Packager en `.ccx` (zip standard — ⚠ PAS `Compress-Archive`, qui produit des
   `\` invalides ; utiliser le tar de Windows) :
   ```
   C:\Windows\System32\tar.exe -a -c -f plugin.zip manifest.json index.html index.js styles.css catalog.js editor.js indesign.js builtins-config.js icons
   ren plugin.zip BAT-Enseignistes.ccx
   ```
   ⚠ Passer par un nom **.zip** PUIS renommer : avec `-f xxx.ccx`, `tar -a` ne
   reconnaît pas l'extension et produit un **TAR** (UPIA échoue en -204).
   `tasks/`, `tests/` et `package.json` restent dehors : rien n'en dépend à l'exécution
   (`package.json` sert seulement à lancer les tests avec Node).
3. Copier le `.ccx` dans `src-tauri/assets/indesign/`. Rien d'autre à
   synchroniser : GraphiDesk lit la version DANS le paquet.
4. Release GraphiDesk → chaque graphiste voit « Mettre à jour » dans l'encart
   « Extensions InDesign » du Kit.
