# Plan — Système de rôles granulaires (RBAC type Discord)

**Demandeur** : Jordan (ticket "Avoir plus de rôle possible" du 27/05/2026)
**Précision admin** : si rôle ≠ "Graphiste", l'utilisateur ne doit PAS apparaître dans la partie "Gestion de projet" (stats, switch de dossier, Franchises, etc.)
**Version cible (full)** : 1.2.0 (changement majeur — breaking au niveau du modèle de rôle)

## ⚠️ Réalité du chantier (issue de l'audit)

| Élément | Volume |
|---------|--------|
| Checks `isAdmin` dans le code | ~70 occurrences, 12+ pages |
| Policies RLS dépendantes du rôle | ~35-40 |
| Pages impactées | 12+ |
| Hooks à refactorer | 3+ (useProfiles, useGraphistes, useStatistiques) |
| RPC à adapter | 4+ (stats par graphiste) |

**Estimation brute :** 11-16 jours dev. Donc **on découpe en phases livrables indépendamment**.

## 🎯 Découpage en 4 phases

### **Phase 1 — Foundation + fix du besoin immédiat de Quentin** ⭐ (ciblée pour cette session)
**Valeur livrée :** Quentin ne voit plus les non-graphistes dans les listes/stats. Foundation prête pour les phases suivantes.

**Pas de breaking change** sur les rôles existants (`admin` / `graphiste` continuent de marcher exactement comme avant via la colonne `profiles.role`).

#### Schéma DB (nouvelle migration `027_rbac_foundation.sql`)
- Nouvelle table `roles` :
  - `id UUID PK`
  - `slug TEXT UNIQUE` (ex: `admin`, `graphiste`, `gestionnaire-dossier-mairie`)
  - `label TEXT` (ex: "Admin", "Graphiste", "Gestionnaire dossier mairie")
  - `is_system BOOLEAN` (true pour admin/graphiste, non-supprimables)
  - `is_graphiste BOOLEAN` (★ flag clé : ce rôle apparaît-il dans les listes de graphistes ?)
  - `couleur TEXT` (pour le badge UI, ex: `#3b82f6`)
  - `created_at`, `updated_at`
- Nouvelle table `role_permissions` :
  - `id UUID PK`
  - `role_id UUID FK roles`
  - `permission_key TEXT` (ex: `can_view_all_dossiers`)
  - `UNIQUE(role_id, permission_key)`
- Ajout colonne `profiles.role_id UUID FK roles NULLABLE`
- **Seed** : créer les 2 rôles système `admin` et `graphiste` avec `is_graphiste = true` pour graphiste et `false` pour admin
- **Backfill** : `UPDATE profiles SET role_id = (SELECT id FROM roles WHERE slug = profiles.role)`
- RLS sur `roles` et `role_permissions` : lecture pour tous authenticated, écriture admin-only
- Garder `profiles.role` en place (compat) — sera dépréciée en Phase 4

#### Fix des bugs latents (les vrais besoins de Quentin)
- **`useGraphistes()`** : actuellement ne filtre RIEN. Le fixer pour ne renvoyer que les profils dont `roles.is_graphiste = true` (via JOIN ou via la nouvelle colonne).
- **RPC `get_stats_par_graphiste()` et autres** : ajouter `WHERE EXISTS (SELECT 1 FROM roles r WHERE r.id = p.role_id AND r.is_graphiste = true)`.
- **`DossierForm` dropdown / `TransferModal` / `Franchises` assignation** : tous utilisent `useProfiles()` ou `useGraphistes()` → bénéficient automatiquement du fix.

#### Pas encore dans cette phase (volontairement)
- Pas d'UI admin pour créer des rôles custom
- Pas de touch aux 70 checks `isAdmin` (continuent de marcher via la colonne `role`)
- Pas de modif des RLS policies (continuent sur `role = 'admin'`)

**Estimation Phase 1 :** ~2-3h de dev. **Tests à faire en local + sur prod Supabase.**

---

### **Phase 2 — UI d'admin pour gérer les rôles**
- Page dédiée (probablement onglet dans `/parametres`) : liste des rôles, créer/modifier/supprimer (sauf system roles)
- Modal d'édition avec :
  - Slug, label, couleur, flag `is_graphiste`
  - Liste de permissions cochables (UI type Discord)
- Sur `/utilisateurs` : remplacer le select binaire admin/graphiste par un select du rôle complet
- Affichage du badge rôle avec sa couleur dans le header, le tableau utilisateurs, etc.

**Estimation Phase 2 :** ~3-4h.

---

### **Phase 3 — Migration progressive des permissions**
- Définir la liste exhaustive des `permission_key` (audit a déjà identifié les zones)
- Hook frontend `useHasPermission(key: string)` qui check le `role_id` du profil contre `role_permissions`
- Pré-seed des permissions sur les 2 rôles système :
  - `admin` → toutes les permissions
  - `graphiste` → permissions de base (voir/modifier ses dossiers, etc.)
- Fonction SQL helper `user_has_permission(key)` SECURITY DEFINER pour les RLS
- Refacto progressif page par page : remplacer `isAdmin` par `useHasPermission('can_xxx')`
- RLS : migrer les policies critiques (dossiers, franchises, app_settings) vers `user_has_permission()` avec fallback sur `role = 'admin'` pour rétro-compat

**Estimation Phase 3 :** ~4-5h.

---

### **Phase 4 — Nettoyage final**
- Supprimer la colonne `profiles.role` (devenue redondante)
- Supprimer le CHECK constraint `role IN ('admin', 'graphiste')` (déjà supprimé en pratique mais à formaliser)
- Supprimer le `selectIsAdmin` de l'authStore (remplacé par `useHasPermission('admin_panel')` ou similaire)
- Bump `1.2.0` au moment du cleanup final
- Update du CLAUDE_INSTRUCTIONS.md du projet

**Estimation Phase 4 :** ~2h + tests poussés.

---

## 🚀 Proposition pour CETTE session : Phase 1 uniquement

### Pourquoi ne pas tout faire d'un coup
1. **Risque** : toucher aux 35 RLS d'un coup, c'est s'exposer à des cascades de bugs en prod
2. **Valeur immédiate** : Phase 1 répond déjà au besoin direct (Quentin ne voit plus les non-graphistes)
3. **Réversibilité** : Phase 1 n'introduit aucun breaking change, on peut rollback facile
4. **Contexte limité** : faire les 4 phases en une session = 12-15h de dev, contexte saturé, qualité dégradée

### Checklist Phase 1 (si tu valides)

- [ ] Créer migration `027_rbac_foundation.sql` (tables roles + role_permissions + seed + backfill + RLS)
- [ ] Appliquer la migration sur Supabase (via dashboard, comme la dernière fois)
- [ ] Régénérer les types TypeScript pour avoir les nouvelles tables (`mcp__supabase__generate_typescript_types` ou manuellement)
- [ ] Modifier `useGraphistes()` dans `src/hooks/useProfiles.ts` → filtrer sur `is_graphiste`
- [ ] Modifier les RPC `get_stats_par_graphiste`, `get_stats_graphiste_par_statut`, `get_stats_archives_par_graphiste`, `get_stats_bat_par_graphiste` → ajouter le filtre `is_graphiste`
- [ ] Vérifier que `DossierForm.tsx`, `TransferModal.tsx`, `Franchises.tsx`, `Dashboard.tsx`, `Statistiques.tsx` utilisent bien le hook fixé (ou faire les ajustements ponctuels)
- [ ] Tests en dev (`npm run tauri dev`) :
  - [ ] Login admin → menu et listes inchangés
  - [ ] Login graphiste (Quentin) → ne voit pas les admins dans le dropdown de transfert, dans les stats par graphiste, etc.
- [ ] **Pas de bump version** pour la Phase 1 (juste migration + frontend, le Tauri binaire change peu)
  - OU bump 1.1.16 si tu préfères tracer ce milestone

### À garder pour les prochaines sessions
- Phases 2, 3, 4 du plan ci-dessus
- Demander à Quentin lesquels de ses collègues sont à passer comme "Gestionnaire dossier mairie" (besoin de rôles concrets pour la Phase 2)

## ❓ Questions de cadrage (avant de coder)

1. **Tu valides l'approche en 4 phases** ou tu veux qu'on fasse TOUT (multi-sessions) avec un plan plus détaillé ?
2. **Pour la Phase 1, on bump (1.1.16) ou pas** ? (Argument bump = tracer un milestone clair même si c'est mineur sur le binaire.)
3. **Liste des rôles initiaux** : pour l'instant on garde juste `admin` + `graphiste`. Veux-tu que je seed aussi `gestionnaire-dossier-mairie` (vide en termes de permissions) ou tu préfères le créer toi-même via l'UI en Phase 2 ?
4. **MCP Supabase** : j'ai vu dans les outils disponibles `apply_migration`, `execute_sql`, `generate_typescript_types`. Tu m'autorises à les utiliser pour appliquer la migration et régénérer les types **directement** ? Ça nous évite l'aller-retour par le dashboard.

## Review post-implémentation

### Ce qui a été livré (Phase 1 + 2 du plan initial)

**Backend Supabase :**
- ✅ Migration `027_rbac_foundation.sql` — tables `roles`, `role_permissions`, colonne `profiles.role_id`, seed admin + graphiste avec leurs permissions, fonction `user_has_permission()`, RLS, trigger anti-suppression rôles système
- ✅ Migration `028_rbac_dashboard_perms.sql` — ajout permissions `access:dashboard`, `access:mes_dossiers`, `access:archives`
- ✅ RPC `get_stats_bat_par_graphiste` filtre désormais sur `is_graphiste`

**Frontend :**
- ✅ Types `Role`, `RolePermission`, `ProfileWithRole`
- ✅ Catalogue centralisé `src/lib/permissions.ts` (27 permissions catégorisées)
- ✅ Hooks `useRoles`, `useRolePermissions`, `useCurrentUserPermissions`, `useCreateRole`, `useUpdateRole`, `useDeleteRole`, `useTogglePermission`
- ✅ Hook `useHasPermission` + `useHasAnyPermission` (pattern super-admin pour les admins legacy)
- ✅ `useGraphistes()` filtré sur `is_graphiste`
- ✅ Sidebar dynamique selon permissions
- ✅ Header : badge du rôle granulaire avec couleur + contraste auto
- ✅ Page Paramètres : nouvelle section "Gestion des rôles" (CRUD complet + UI permissions cochables)
- ✅ Page Utilisateurs : dropdown unique de rôle granulaire (legacy/granulaire fusionnés)
- ✅ Dashboard adaptatif : launcher de modules pour les users sans accès dossiers

### Bonus non prévus
- Fonction `getContrastTextColor()` dans utils.ts (réutilisable)
- Revert auto port Vite (1421 → 1420 standard Tauri)

### Limites connues (Phase 3 non faite)
- Les permissions `manage:*` ne sont pas encore connectées aux boutons d'action dans les pages (ils utilisent encore le check `isAdmin` legacy)
- Les RLS Supabase utilisent encore `role = 'admin'` (sécurité ceinture+bretelles)
- À traiter dans une future session quand un rôle nécessitera des `manage:*`
