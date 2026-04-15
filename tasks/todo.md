# Plan — Ajout bouton "+" pour notes libres datées

**Demandeur** : Quentin (ticket du 14/04/2026 10:37)
**Version cible** : 1.1.15
**Estimation** : ~30-45 min

## Contexte du besoin

Actuellement, dans le tableau des dossiers, colonne **Commentaires** :
- L'utilisateur peut cliquer sur le champ pour éditer le commentaire complet en textarea
- Un bouton `+` vert dans la colonne BAT ajoute automatiquement une ligne `[JJ/MM/AAAA] BAT VX envoyé`

**Demande :** ajouter un petit `+` **directement dans la colonne Commentaires**, placé **juste avant le texte "Ajouter un commentaire"** (ou avant les commentaires existants), qui ouvre une modale pour saisir une note libre. Au submit, la note est ajoutée sous la forme `[JJ/MM/AAAA] Note: {texte utilisateur}` à la suite des commentaires existants (append avec `\n`).

## Décisions prises (cadrées avec le user)

| Question | Décision |
|----------|----------|
| Stockage | Même champ `dossiers.commentaires` (flux unique) |
| Position du "+" | Dans la colonne **Commentaires**, AVANT le placeholder/contenu (pas dans la colonne BAT) |
| Édition ultérieure | Oui, le clic sur le bloc commentaire ouvre le textarea d'édition inline comme aujourd'hui (pas de logique spécifique aux notes) |
| Format | Texte libre multi-lignes, préfixé `[JJ/MM/AAAA] Note: ` |
| Couleur du "+" | Bleu (vert déjà pris par BAT, orange par Relance) — à confirmer avec user |

## Fichiers à modifier / créer

### 1. Nouveau composant `NoteAddButton.tsx`
**Chemin :** `src/components/dossiers/NoteAddButton.tsx` (nouveau)

Responsabilités :
- Afficher un bouton `+` bleu (style cohérent avec le `+` vert de BatCell)
- Au clic → ouvrir un `Dialog` avec un `Textarea` pour saisir la note
- Au submit :
  1. Récupérer `commentaires` actuels depuis Supabase (fresh fetch pour éviter race condition, comme fait BatCell L61-65)
  2. Construire la ligne : `[${new Date().toLocaleDateString("fr-FR")}] Note: ${texteSaisi}`
  3. Append avec `\n` si `commentaires` existe, sinon juste la ligne
  4. Appeler `useUpdateDossier().mutateAsync({ id, data: { commentaires, has_commentaires: true } })`
  5. Fermer la modale, toast de succès (géré par le hook)

Props : `{ dossierId: string }`

Pattern à copier quasi à l'identique : `src/components/dossiers/BatCell.tsx:46-97` (handleAddBat) + dialog L262-339

### 2. Modifier `DossiersTable.tsx`
**Chemin :** `src/components/dossiers/DossiersTable.tsx`
**Lignes :** 734-748 (TableCell de la colonne Commentaires)

Changement :
- Wrapper le `<InlineEdit>` dans un `<div className="flex items-start gap-1">`
- Insérer `<NoteAddButton dossierId={dossier.id} />` AVANT le `<InlineEdit>`
- Vérifier que l'alignement vertical reste propre (le bouton est `h-7`, le textarea placeholder peut être aligné avec `items-start` ou `items-center` selon rendu)

### 3. Bump de version
- `package.json` : 1.1.14 → 1.1.15
- `src-tauri/Cargo.toml` : 1.1.14 → 1.1.15
- `src-tauri/tauri.conf.json` : 1.1.14 → 1.1.15

## Checklist d'implémentation

- [ ] Créer `src/components/dossiers/NoteAddButton.tsx` avec Dialog + Textarea
- [ ] Importer et placer `<NoteAddButton>` dans `DossiersTable.tsx` colonne Commentaires
- [ ] Ajuster le layout flex pour que bouton + textarea s'alignent bien
- [ ] Vérifier le rendu en mode dark (classes `dark:` cohérentes)
- [ ] Bump version 1.1.14 → 1.1.15 (3 fichiers)
- [ ] Test manuel `npm run dev` :
  - [ ] Clic sur le "+" bleu → modale s'ouvre
  - [ ] Saisie + submit → note apparaît avec date en préfixe
  - [ ] Le flux est conservé (BAT envoyé + Note mélangés chronologiquement si créés dans l'ordre)
  - [ ] Ré-édition possible en cliquant sur le bloc commentaire
  - [ ] Cas edge : commentaire vide avant ajout → pas de `\n` en tête
  - [ ] Cas edge : submit avec textarea vide → bouton "Ajouter" disabled OU message d'erreur
- [ ] `npm run type-check` doit passer
- [ ] Commit avec message `v1.1.15 - FabRik/Dossiers : ajout bouton + pour notes libres datées`

## Points d'attention / questions ouvertes

1. **Couleur du bouton** : je pars sur bleu (`text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30`), mais si tu préfères gris ou une autre couleur, dis-moi.

2. **Icône** : je pars sur `Plus` (lucide-react) pour rester cohérent avec le `+` de BAT. Alternative possible : `MessageSquarePlus` pour distinguer visuellement. **Recommandation :** rester sur `Plus` pour la cohérence UI, la couleur bleue suffira à différencier.

3. **Préfixe "Note:"** : j'ai choisi `[JJ/MM/AAAA] Note: {texte}` pour garder un pattern clair. L'exemple de Quentin dans le ticket est `[JJ/MM/AAAA] En attente des côtes clients` (sans "Note:"). À toi de trancher :
   - **Option A** : `[JJ/MM/AAAA] Note: En attente des côtes clients` (verbeux mais clair)
   - **Option B** : `[JJ/MM/AAAA] En attente des côtes clients` (calque l'exemple exact)
   - **Recommandation :** Option B, plus concis, et la distinction avec "BAT VX envoyé" est déjà claire par le contenu.

4. **Modale ou input inline ?** Vu qu'on a déjà l'édition inline sur le bloc commentaire, on pourrait se dire "pourquoi une modale de plus ?" → la différence c'est que la modale **préfixe automatiquement la date**, alors que l'édition inline laisse l'utilisateur écrire librement sans préfixage auto. C'est bien le besoin exprimé par Quentin.

## Review (post-implémentation)

### Ce qui a été fait
- ✅ Composant `NoteAddButton.tsx` créé avec Dialog + Textarea auto-grow
- ✅ Intégration dans `DossiersTable.tsx` colonne Commentaires (wrapper `flex items-start gap-1`)
- ✅ Bump version 1.1.14 → 1.1.15 (3 fichiers)
- ✅ Validé visuellement par le user dans l'app Tauri en dev
- ✅ `npx tsc --noEmit` passe sans erreur

### Bonus non prévus au plan
- **Auto-resize du textarea dans `InlineEdit.tsx`** : la mise en évidence du bouton `+` a révélé que le textarea inline de la colonne Commentaires ne s'adaptait pas à la hauteur du contenu. Fix ajouté dans le composant partagé → bénéficie à TOUS les textareas InlineEdit de l'app.
- **`.gitignore`** : ajout de `.claude/*.lock` pour éviter que les fichiers lock du runtime Claude Code polluent le repo.

### Décisions finales
- Couleur du bouton : **bleu** (`text-blue-600`)
- Préfixe : **`[JJ/MM/AAAA] Note: {texte}`** (option A du plan initial, finalement retenue)
- Icône : **`Plus`** de lucide-react (cohérent avec le `+` de BAT)

### Fichiers impactés
- `src/components/dossiers/NoteAddButton.tsx` (nouveau)
- `src/components/dossiers/DossiersTable.tsx` (modifié)
- `src/components/shared/InlineEdit.tsx` (modifié — auto-resize bonus)
- `.gitignore` (modifié)
- `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (version bump)
- `src-tauri/Cargo.lock` (auto-régénéré par cargo)
