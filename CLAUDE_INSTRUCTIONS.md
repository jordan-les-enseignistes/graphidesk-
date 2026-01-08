# CLAUDE_INSTRUCTIONS.md - GraphiDesk

> **IMPORTANT** : Ce fichier est la documentation de référence pour Claude Code. Au début de chaque nouvelle conversation, dis simplement "Lis CLAUDE_INSTRUCTIONS.md" pour que je comprenne le projet.

---

## 1. INFORMATIONS GENERALES

### 1.1 Description du projet
**GraphiDesk** est une application de bureau Windows pour **Les Enseignistes** (entreprise de signalétique). Elle permet aux graphistes de gérer leurs dossiers clients, suivre leurs heures, planifier les congés, et accéder à divers outils métier.

### 1.2 Stack technique
| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + TailwindCSS 4 |
| Backend Desktop | Tauri 2.0 (Rust) |
| Base de données | Supabase (PostgreSQL + RLS) |
| State Management | Zustand + React Query |
| Build/Deploy | GitHub Actions + NSIS (Windows) |

### 1.3 Chemins importants
```
C:\Users\neauj\Desktop\EN COURS DE DEV\graphidesk\  <- REPERTOIRE PRINCIPAL
├── src/                      # Code React/TypeScript
│   ├── components/           # Composants réutilisables
│   ├── pages/                # Pages de l'application
│   ├── hooks/                # Hooks personnalisés (API Supabase)
│   ├── stores/               # Stores Zustand
│   ├── lib/                  # Utilitaires (supabase.ts, constants.ts)
│   ├── types/                # Types TypeScript
│   └── data/                 # Données statiques (couleurs RAL, Pantone)
├── src-tauri/                # Code Rust Tauri
│   ├── src/lib.rs            # Point d'entrée Rust + commandes
│   ├── Cargo.toml            # Dépendances Rust
│   ├── tauri.conf.json       # Configuration Tauri
│   ├── capabilities/         # Permissions Tauri
│   └── assets/fabrik/        # Scripts Illustrator
├── supabase/migrations/      # Migrations SQL
├── .github/workflows/        # CI/CD GitHub Actions
└── package.json              # Dépendances npm
```

---

## 2. ROLES ET PERMISSIONS

### 2.1 Les deux rôles
| Rôle | Description |
|------|-------------|
| **admin** | Accès complet : tous les dossiers, gestion utilisateurs, import, paramètres |
| **graphiste** | Accès limité : ses propres dossiers, ses heures, outils partagés |

### 2.2 Permissions détaillées (RLS Supabase)

#### DOSSIERS (`dossiers`)
| Action | Graphiste | Admin |
|--------|-----------|-------|
| SELECT | Ses dossiers + archives | Tous |
| INSERT | Pour lui-même | Pour tous |
| UPDATE | Ses dossiers | Tous |
| DELETE | Ses dossiers | Tous |

#### PROFILES (`profiles`)
| Action | Graphiste | Admin |
|--------|-----------|-------|
| SELECT | Tous (lecture) | Tous |
| UPDATE | Son profil | Tous |
| INSERT | Non | Oui |

#### FRANCHISES / PARAMETRES / UTILISATEURS
- **Lecture** : Tout le monde
- **Modification** : Admin uniquement

### 2.3 Mode "Voir en tant que" (Admin)
L'admin peut simuler la vue d'un graphiste via `useViewAsStore`. En mode "view as" :
- `useEffectiveRole()` retourne `isAdmin: false`
- Les données affichées sont celles du graphiste simulé
- Pratique pour debug/support

---

## 3. STRUCTURE DE LA BASE DE DONNEES

### 3.1 Tables principales

```sql
-- PROFILES : Extension de auth.users
profiles (
  id UUID PRIMARY KEY,          -- = auth.users.id
  email TEXT UNIQUE,
  full_name TEXT,
  initials TEXT,                -- Ex: "J", "JU", "C"
  role TEXT CHECK (admin|graphiste),
  is_active BOOLEAN,
  horaires_base JSONB,          -- Horaires hebdomadaires par défaut
  preferences JSONB,            -- { minimize_on_close: boolean }
  badge_color TEXT              -- Couleur du badge (blue, green, etc.)
)

-- DOSSIERS : Projets clients
dossiers (
  id UUID PRIMARY KEY,
  graphiste_id UUID REFERENCES profiles(id),
  nom TEXT,
  date_creation TIMESTAMPTZ,
  deadline_premiere_reponse DATE,
  statut TEXT,                  -- "A faire", "En cours", "Attente R.", etc.
  is_archived BOOLEAN,
  date_archivage TIMESTAMPTZ,
  commentaires TEXT,
  bat_count INTEGER,            -- Compteur de BATs (calculé par trigger)
  dernier_bat TIMESTAMPTZ
)

-- DOSSIER_BATS : Historique des BATs envoyés
dossier_bats (
  id UUID PRIMARY KEY,
  dossier_id UUID REFERENCES dossiers(id),
  date_envoi TIMESTAMPTZ
)

-- FEUILLES_TEMPS : Une par mois par utilisateur
feuilles_temps (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  annee INTEGER,
  mois INTEGER,
  total_heures_sup INTERVAL,
  is_validated BOOLEAN
)

-- HEURES_JOURNALIERES : Détail jour par jour
heures_journalieres (
  feuille_id UUID REFERENCES feuilles_temps(id),
  date DATE,
  jour_semaine TEXT,
  matin_debut TIME,
  matin_fin TIME,
  aprem_debut TIME,
  aprem_fin TIME,
  type_absence TEXT              -- conge, conge_matin, conge_aprem, ferie, maladie
)
```

### 3.2 Triggers automatiques
- `update_updated_at()` : Met à jour `updated_at` à chaque modification
- `update_has_commentaires()` : Calcule `has_commentaires` selon le contenu
- `update_date_archivage()` : Renseigne automatiquement la date d'archivage

### 3.3 Modifier le schéma BDD
1. Créer un nouveau fichier dans `supabase/migrations/`
2. Nommage : `XXX_description.sql` (XXX = numéro séquentiel)
3. Exécuter dans Supabase Dashboard > SQL Editor
4. **Ne jamais modifier** les migrations existantes déjà appliquées

---

## 4. LES OUTILS / PAGES DE L'APPLICATION

### 4.1 Gestion de projet
| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Vue d'ensemble : stats, dossiers à traiter, heures sup |
| Mes Dossiers | `/mes-dossiers` | Liste des dossiers du graphiste connecté |
| Tous les Dossiers | `/tous-les-dossiers` | (Admin) Vue de tous les dossiers |
| Archives | `/archives` | Dossiers archivés (terminés) |
| Projets Internes | `/projets-internes` | Tâches internes (hors client) |
| Franchises | `/franchises` | Liste des franchises + procédures |

### 4.2 Outils métier
| Page | Route | Description |
|------|-------|-------------|
| Nuancier | `/ral-converter` | Convertisseur CMJN ↔ RAL ↔ Pantone + catalogues |
| Calculatrice | `/calculatrice` | Calculs de surfaces m² et vérification façade mairie (voir 4.2.1) |
| FabRik | `/fabrik` | Automatisation Illustrator pour fichiers de fabrication (voir 4.2.2) |
| Sites Internet | `/sites-internet` | Annuaire des accès web |
| Process | `/process` | Fiches procédures (texte ou PDF) |

#### 4.2.1 Calculatrice - Détail
Deux outils de calcul :
1. **Calcul de surface (m²)** : Calcule la surface d'une enseigne (largeur × hauteur) avec choix d'unité (mm/cm/m) et vérifie si elle dépasse une limite mairie optionnelle
2. **Calcul façade mairie** : Vérifie si plusieurs enseignes respectent le % autorisé sur une façade. Permet d'ajouter plusieurs enseignes et calcule le total vs la surface autorisée

#### 4.2.2 FabRik - Détail
Outil de génération automatique de fichiers de fabrication via scripts Illustrator (JSX).
Trois modes de génération :
1. **Adhésif** : Automatisation pour découpe vinyle (vectorisation, contours de découpe, etc.)
2. **Caisson** : Génération de caissons aluminium avec 3 sous-types :
   - Simple : Caisson rectangulaire standard
   - Multi-parties : Caisson en 2 à 5 parties
   - Double face : Enseigne drapeau (visible des deux côtés)
3. **Lettres Boîtiers** : Génère les fichiers de fabrication pour lettres (tranches, semelles, plexi)

**Configuration** : Le chemin d'Illustrator est configurable et sauvegardé en localStorage.
**Fichiers** : Scripts JSX dans `src-tauri/assets/fabrik/scripts/`, Actions Illustrator (.aia) dans `src-tauri/assets/fabrik/actions/`

### 4.3 RH / Planning
| Page | Route | Description |
|------|-------|-------------|
| Heures Sup | `/heures-supplementaires` | Saisie des heures journalières |
| Planning Vacances | `/planning-vacances` | Calendrier des congés équipe |
| Réunions | `/reunions` | Sujets à aborder en réunion |

### 4.4 Administration (Admin uniquement)
| Page | Route | Description |
|------|-------|-------------|
| Utilisateurs | `/utilisateurs` | Gestion des comptes |
| Paramètres | `/parametres` | Config globale (statuts, etc.) |

---

## 5. STATUTS DES DOSSIERS

**Les statuts sont dynamiques et stockés en BDD** dans la table `app_settings` (clé `statuts`).
L'admin peut ajouter/modifier/supprimer des statuts directement depuis l'interface (page Paramètres).

```typescript
// Exemples de statuts par défaut (modifiables à la volée)
const STATUTS = [
  "! Urgent !",   // Rouge - Priorité max
  "A faire",      // Bleu - À traiter
  "En cours",     // Jaune - En cours de réalisation
  "Attente R.",   // Violet - Attente réponse client
  "À relancer",   // Orange - Client à relancer
  "Mairie",       // Rose - En attente mairie
  "Stand-by",     // Gris - Projet en pause
  // ... l'admin peut en ajouter d'autres
];
```

**Récupération des statuts** : Utiliser le hook `useStatuts()` qui lit depuis `app_settings`.

**Règles automatiques** :
- "Attente R." depuis > 7 jours → affiché dans "À relancer" sur le Dashboard
- Archivage → `date_archivage` renseignée automatiquement par trigger

---

## 6. PROCEDURE DE MODIFICATION DU CODE

### 6.1 IMPORTANT : Ne JAMAIS utiliser les worktrees
```
❌ NE PAS travailler dans : C:\Users\neauj\.claude-worktrees\
✅ TOUJOURS travailler dans : C:\Users\neauj\Desktop\EN COURS DE DEV\graphidesk\
```

### 6.2 Workflow de modification
1. Lire les fichiers concernés avant toute modification
2. Effectuer les changements dans le répertoire principal
3. Tester si possible avec `npm run dev` ou `npm run tauri dev`
4. Commiter avec un message descriptif

---

## 7. PROCEDURE DE RELEASE (PUSH GITHUB + BUILD)

### 7.1 Fichiers de version à modifier (TOUS les 3)
```
1. package.json                    → "version": "X.Y.Z"
2. src-tauri/tauri.conf.json       → "version": "X.Y.Z"
3. src-tauri/Cargo.toml            → version = "X.Y.Z"
```

### 7.2 Étapes complètes
```bash
# 1. Modifier les 3 fichiers de version

# 2. Commit avec message descriptif
cd "C:\Users\neauj\Desktop\EN COURS DE DEV\graphidesk"
git add .
git commit -m "v1.X.X - Description des changements"

# 3. Push le commit
git push origin main

# 4. Créer et pusher le TAG (déclenche le build automatique)
git tag -a v1.X.X -m "v1.X.X - Description"
git push origin v1.X.X
```

### 7.3 Ce qui se passe ensuite
1. GitHub Actions détecte le tag `v*`
2. Le workflow `.github/workflows/release.yml` se lance
3. Build Windows via Tauri Action (~5-10 min)
4. Release créée automatiquement sur GitHub
5. Les utilisateurs reçoivent une notification de mise à jour au prochain lancement

### 7.4 Exemple de message de commit
```
v1.X.X - Titre descriptif des changements

- Modification 1
- Modification 2
- Modification 3
```

**Note** : Toujours me faire valider le message de commit avant de l'exécuter.

---

## 8. PLUGINS TAURI ACTIFS

```rust
// Dans src-tauri/src/lib.rs
tauri_plugin_shell          // Ouvrir des liens externes
tauri_plugin_process        // Gestion processus
tauri_plugin_notification   // Notifications système
tauri_plugin_updater        // Mise à jour automatique
tauri_plugin_dialog         // Dialogues fichiers
tauri_plugin_window_state   // Sauvegarde position/taille fenêtre
tauri_plugin_single_instance // Une seule instance de l'app
```

Pour ajouter un plugin :
1. Ajouter dans `src-tauri/Cargo.toml`
2. Initialiser dans `src-tauri/src/lib.rs` (.plugin())
3. Ajouter les permissions dans `src-tauri/capabilities/default.json`
4. (Optionnel) Ajouter le package JS dans `package.json`

---

## 9. SUPABASE - INFORMATIONS

### 9.1 Connexion
```typescript
// src/lib/supabase.ts
const supabaseUrl = "https://wkdubjbozmdohzezhmsp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIs..."; // Clé publique
```

### 9.2 Dashboard Supabase
- URL : https://supabase.com/dashboard/project/wkdubjbozmdohzezhmsp
- Utiliser le SQL Editor pour exécuter les migrations

### 9.3 RLS (Row Level Security)
Toutes les tables ont RLS activé. Les règles sont définies dans `002_rls_policies.sql`.
**Ne jamais désactiver RLS** - c'est la sécurité de l'application.

---

## 10. HOOKS PRINCIPAUX (API)

| Hook | Description |
|------|-------------|
| `useMyDossiers()` | Dossiers du graphiste connecté |
| `useAllDossiers()` | Tous les dossiers (admin) |
| `useCreateDossier()` | Créer un dossier |
| `useUpdateDossier()` | Modifier un dossier |
| `useArchiveDossier()` | Archiver un dossier |
| `useDeleteDossier()` | Supprimer un dossier |
| `useTransferDossier()` | Transférer à un autre graphiste |
| `useFeuilleTemps()` | Feuille d'heures du mois |
| `useProfiles()` | Liste des utilisateurs actifs |
| `useEffectiveRole()` | Rôle effectif (gère le mode "view as") |
| `useStatsGlobal()` | Stats globales (total en cours, total archives) |
| `useStatsParStatut()` | Compteurs par statut |
| `useStatsParGraphiste()` | Compteurs par graphiste |
| `useStatsArchivesParAnnee()` | Archives groupées par année |

---

## 11. STORES ZUSTAND

| Store | Description |
|-------|-------------|
| `useAuthStore` | Utilisateur connecté, session, profil |
| `useViewAsStore` | Mode "Voir en tant que" (admin) |
| `useImportStore` | Progression de l'import Excel |
| `useUserPreferencesStore` | Préférences locales (intensité surlignage) |
| `useUnauthorizedStore` | Affichage du dialog "non autorisé" |

---

## 12. POINTS D'ATTENTION / PIEGES COURANTS

### 12.1 Dates et Timezone
```typescript
// Toujours utiliser des fonctions locales pour éviter les décalages UTC
function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

### 12.2 Import Excel (admin)
L'import utilise `useImportStore` pour afficher la progression en temps réel.
Le fichier attendu est le classeur Excel "Suivi des dossiers" avec des onglets par graphiste.

### 12.3 Heures supplémentaires
- Base légale : 35h/semaine = 7h/jour ouvré
- Les congés payés comptent comme heures travaillées (selon horaires prévus)
- Les jours fériés ne comptent pas dans la base

### 12.4 FabRik (scripts Illustrator)
- Nécessite Adobe Illustrator installé
- Scripts JSX dans `src-tauri/assets/fabrik/scripts/`
- Actions Illustrator (.aia) dans `src-tauri/assets/fabrik/actions/`
- Le chemin Illustrator est configurable par l'utilisateur

---

## 13. COMMANDES UTILES

```bash
# Développement
npm run dev              # Serveur Vite (frontend uniquement)
npm run tauri dev        # App Tauri complète (frontend + backend)

# Build
npm run build            # Build frontend
npm run tauri build      # Build app Windows (.exe + installateur)

# Git
git status
git log --oneline -10
git tag                  # Voir les tags existants
```

---

## 14. CONTACTS / RESSOURCES

- **Repo GitHub** : https://github.com/jordan-les-enseignistes/graphidesk-
- **Actions (builds)** : https://github.com/jordan-les-enseignistes/graphidesk-/actions
- **Releases** : https://github.com/jordan-les-enseignistes/graphidesk-/releases
- **Supabase Dashboard** : https://supabase.com/dashboard/project/wkdubjbozmdohzezhmsp

---

## 15. RESUME RAPIDE

```
GraphiDesk = App desktop Windows (Tauri/React) pour graphistes
├── BDD Supabase avec RLS (admin vs graphiste)
├── Gestion dossiers clients + heures sup + congés
├── Outils métier (nuancier, calculatrice, scripts Illustrator)
└── Auto-update via GitHub Releases

Pour modifier :
1. Toujours dans C:\Users\neauj\Desktop\EN COURS DE DEV\graphidesk\
2. Jamais dans les worktrees
3. Pour release : modifier 3 fichiers version + commit + tag + push
```
