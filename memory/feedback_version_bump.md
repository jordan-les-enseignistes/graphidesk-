---
name: Toujours bumper la version sur GraphiDesk
description: Sur le projet GraphiDesk, toute modification de code applicatif doit s'accompagner d'un bump de version dans les 3 fichiers de version
type: feedback
---

Sur GraphiDesk, dès qu'une modification touche au code applicatif (même un changement minime comme une couleur), il faut **bumper la version patch** dans **3 fichiers** :
- `package.json` (champ `version`)
- `src-tauri/Cargo.toml` (champ `version`)
- `src-tauri/tauri.conf.json` (champ `version`)

Les 3 doivent toujours rester synchronisés.

**Why:** Le CLAUDE.md du projet l'exige, et c'est la convention visible dans l'historique git (chaque commit utilisateur est tagué `vX.Y.Z - description`). Le user m'a explicitement repris le 2026-04-09 quand j'ai fait un fix CutContour sans bumper. C'est aussi cohérent avec un workflow Tauri où la version embarquée dans le binaire doit refléter chaque release.

**How to apply:** Avant de signaler qu'un changement est terminé sur GraphiDesk, vérifier la version actuelle dans les 3 fichiers et incrémenter le patch (`1.1.13` → `1.1.14`). À inclure dans le même commit que le changement de code. Le message de commit suit le format `vX.Y.Z - description courte`.
