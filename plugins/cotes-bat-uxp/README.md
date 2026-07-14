# Cotes BAT — plugin InDesign UXP

Panneau InDesign de génération de cotes BAT (flèches croix + losanges bleus +
lettres vectorisées), couplé à GraphiDesk : l'outil **Mesure photo** exporte
une fiche VT (`Documents\GraphiDesk\fiches_vt\`), le panneau la détecte
automatiquement et remplit la page 2 du gabarit VT (photo + cotes + tableau).

**Ce dossier est la source de vérité du plugin.** Le `.ccx` compilé embarqué
dans GraphiDesk (`src-tauri/assets/indesign/Cotes-BAT.ccx`) en est dérivé, et
les graphistes l'installent depuis la page Mesure photo (encart « Plugin
InDesign — Cotes BAT »).

## Publier une nouvelle version

1. Modifier le code ici, puis bumper **trois** endroits :
   - `manifest.json` → `version`
   - `index.js` → `PANEL_VERSION` (repli d'affichage)
2. Packager en `.ccx` (zip standard — ⚠️ PAS `Compress-Archive` qui produit
   des `\` invalides ; utiliser le tar de Windows) :
   ```
   C:\Windows\System32\tar.exe -a -c -f Cotes-BAT.ccx manifest.json index.html index.js styles.css lib
   ```
3. Copier dans les assets GraphiDesk + synchroniser la version :
   - `src-tauri/assets/indesign/Cotes-BAT.ccx`
   - `src-tauri/assets/indesign/version.txt`
4. Release GraphiDesk → chaque graphiste voit « Mise à jour disponible » dans
   l'encart et installe en un clic (UPIA + purge des anciennes versions du
   registre UXP — voir `install_indesign_plugin` dans `src-tauri/src/lib.rs`).

## Installation manuelle (debug)

```
& "C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe" /install Cotes-BAT.ccx
```

Si une mise à jour « ne prend pas » : plusieurs versions sont probablement
enregistrées simultanément (bug UPIA) — vérifier
`%APPDATA%\Adobe\UXP\PluginsInfo\v1\ID.json` et les dossiers
`%APPDATA%\Adobe\UXP\Plugins\External\com.izy.cotesbat_*`, supprimer les
anciennes (InDesign fermé). Le panneau affiche sa version en pied : s'y fier.
