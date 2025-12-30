# Cahier des Charges - GraphiDesk

**Application de gestion de dossiers graphiques pour Les Enseignistes**
Version actuelle : v1.1.3

---

## Table des matières

1. [Présentation générale](#1-présentation-générale)
2. [Authentification et rôles](#2-authentification-et-rôles)
3. [Modules fonctionnels](#3-modules-fonctionnels)
4. [Synchronisation des données](#4-synchronisation-des-données)
5. [Préférences utilisateur](#5-préférences-utilisateur)
6. [Résumé par fonctionnalité](#6-résumé-par-fonctionnalité)

---

## 1. Présentation générale

GraphiDesk est une application de bureau (Windows) développée pour l'équipe graphique de **Les Enseignistes**. Elle permet de gérer les dossiers clients, suivre les heures supplémentaires, organiser les réunions, et automatiser certaines tâches de fabrication.

**Technologies :**
- Application de bureau : Tauri (Rust + Web)
- Base de données : Supabase (PostgreSQL cloud)
- Temps réel : Supabase Realtime (synchronisation instantanée)

---

## 2. Authentification et rôles

### 2.1 Connexion

- **Email + Mot de passe** requis
- Comptes créés par les administrateurs uniquement
- Possibilité de changer son mot de passe depuis "Mon Profil"
- Compte désactivable par l'admin (empêche la connexion)

### 2.2 Rôles disponibles

| Rôle | Description |
|------|-------------|
| **Admin** | Accès complet à toutes les fonctionnalités |
| **Graphiste** | Accès limité à ses propres données + fonctions partagées |

### 2.3 Différences Admin vs Graphiste

| Fonctionnalité | Admin | Graphiste |
|----------------|-------|-----------|
| Voir tous les dossiers | Oui | Non (seulement les siens) |
| Transférer un dossier | Oui | Oui (seulement les siens) |
| Archiver un dossier | Oui | Non |
| Désarchiver un dossier | Oui | Non |
| Supprimer un dossier | Oui | Non |
| Créer un utilisateur | Oui | Non |
| Désactiver un utilisateur | Oui | Non |
| Gérer les statuts | Oui | Non |
| Paramètres de réunion | Oui | Non |
| Gérer feedbacks (statut) | Oui | Non |
| Supprimer franchises | Oui | Non |
| Zone dangereuse (nettoyage BDD) | Oui | Non |
| Mode "Voir en tant que" | Oui | Non |

---

## 3. Modules fonctionnels

### 3.1 Dashboard (Tableau de bord)

**Accès :** Tous les utilisateurs

**Description :**
Page d'accueil affichant un résumé de l'activité :
- Compteur de dossiers en cours (personnel pour graphiste, global pour admin)
- Dossiers urgents
- Dossiers en attente de retour
- Dernière activité

**Données affichées :**
- Statistiques personnelles ou globales selon le rôle
- Accès rapide aux actions fréquentes

---

### 3.2 Mes Dossiers

**Accès :** Graphistes (leurs dossiers) | Admin (tous via "Voir en tant que")

**Description :**
Vue personnelle des dossiers assignés au graphiste connecté.

**Fonctionnalités :**
- Liste des dossiers actifs (non archivés)
- Tri par date de création (décroissant par défaut)
- Filtres par statut
- Recherche par nom
- **Surlignage coloré** selon le statut (intensité réglable)
- **Actions sur un dossier :**
  - Modifier le statut (dropdown)
  - Ajouter/modifier un commentaire
  - Enregistrer un BAT (Bon à Tirer)
  - Transférer à un autre graphiste
  - Voir l'historique des BAT

**Particularités :**
- Les dossiers sont triés automatiquement par date de création
- Les couleurs de fond des lignes varient selon le statut (personnalisable)
- L'intensité du surlignage est configurable dans "Mon Profil"

---

### 3.3 Tous les Dossiers

**Accès :** Admin uniquement

**Description :**
Vue globale de tous les dossiers actifs de l'équipe avec pagination.

**Fonctionnalités :**
- Pagination (100 dossiers par page)
- Filtres : statut, graphiste, recherche
- **Actions admin :**
  - Modifier statut
  - Transférer à un graphiste
  - Archiver
  - Actions en masse (sélection multiple)

**Actions en masse :**
- Archiver plusieurs dossiers
- Changer le statut de plusieurs dossiers

---

### 3.4 Archives

**Accès :** Tous (lecture) | Admin (restauration/suppression)

**Description :**
Historique des dossiers terminés et archivés.

**Fonctionnalités :**
- Pagination (100 par page)
- Recherche dans toutes les archives
- Voir les détails d'un dossier archivé
- Historique des BAT
- Export CSV
- **Admin uniquement :**
  - Restaurer un dossier (le remettre en actif)
  - Supprimer définitivement

**Données affichées :**
- Nom du dossier
- Graphiste assigné
- Date de création
- Date d'archivage
- Nombre de BAT
- Statut final

---

### 3.5 Heures Supplémentaires

**Accès :** Tous les utilisateurs

**Description :**
Système de suivi des heures de travail mensuelles.

**Fonctionnalités :**
- **Feuille de temps mensuelle** pré-remplie avec les horaires par défaut
- Saisie jour par jour : matin (début/fin) + après-midi (début/fin)
- Calcul automatique des heures :
  - Heures travaillées
  - Heures dues (base)
  - Heures supplémentaires ou manquantes
- Validation du mois par l'admin
- Export des données

**Horaires de base :**
- Configurables par utilisateur dans "Mon Profil"
- Par défaut : Lundi-Vendredi, 8h30-12h00 et 13h30-17h30

**États d'un mois :**
- Brouillon (en cours de saisie)
- Validé (verrouillé, non modifiable)

---

### 3.6 Rapport Heures Sup (Admin)

**Accès :** Admin uniquement

**Description :**
Vue consolidée des heures supplémentaires de toute l'équipe.

**Fonctionnalités :**
- Filtrer par mois/année
- Voir le récapitulatif par graphiste
- Valider les mois de tous les utilisateurs
- Générer des rapports

---

### 3.7 Planning Vacances

**Accès :** Tous les utilisateurs

**Description :**
Calendrier partagé pour visualiser les absences de l'équipe.

**Fonctionnalités :**
- Vue calendrier mensuel
- Ajouter une absence (date début/fin)
- Types d'absence : Congés, RTT, Maladie, Autre
- Visualisation de toutes les absences de l'équipe
- Un utilisateur ne peut modifier que ses propres absences

**Synchronisation :** Globale (visible par tous en temps réel)

---

### 3.8 Franchises

**Accès :** Tous les utilisateurs

**Description :**
Gestion des franchises clients récurrentes.

**Fonctionnalités :**
- Liste des franchises avec logo
- Assignation d'un ou plusieurs graphistes à une franchise
- Consultation des graphistes assignés
- **Admin :**
  - Créer/modifier/supprimer des franchises
  - Gérer les assignations

**Synchronisation :** Globale

---

### 3.9 Projets Internes

**Accès :** Tous les utilisateurs

**Description :**
Suivi des projets internes à l'entreprise (non liés à des clients).

**Fonctionnalités :**
- Créer un projet avec nom et description
- Statuts : À faire, En cours, Terminé
- Assigner à un ou plusieurs graphistes
- Commentaires sur le projet
- Historique des modifications

**Synchronisation :** Globale

---

### 3.10 Sites Internet

**Accès :** Tous les utilisateurs

**Description :**
Liste des sites web clients à maintenir ou suivre.

**Fonctionnalités :**
- Ajouter un site avec :
  - Nom du client
  - URL du site
  - URL d'administration
  - Identifiants (stockés de manière sécurisée)
  - Notes
  - Graphiste assigné
- Filtrer par graphiste

**Synchronisation :** Globale

---

### 3.11 Process

**Accès :** Tous les utilisateurs

**Description :**
Documentation interne des processus et procédures.

**Fonctionnalités :**
- Liste des process par catégorie
- Affichage du contenu (Markdown)
- **Admin :**
  - Créer/modifier/supprimer des process
  - Organiser par catégories

**Catégories :**
- Configurable (ex: Impression, Pose, Administratif...)

**Synchronisation :** Globale

---

### 3.12 Réunions

**Accès :** Tous les utilisateurs

**Description :**
Gestion des sujets à aborder en réunion d'équipe.

**Fonctionnalités :**
- Ajouter un sujet avec :
  - Titre
  - Description
  - Priorité (Basse, Normale, Haute, Urgente)
- Sujets triés par priorité
- Marquer comme "Traité" (archivage)
- Restaurer un sujet archivé
- **Notifications automatiques** : rappel le jour de la réunion

**Paramètres (Admin) :**
- Jour de la réunion hebdomadaire
- Heure de la réunion
- Message de notification personnalisé
- Test de notification

**Synchronisation :** Globale (tous voient les mêmes sujets)

---

### 3.13 Annuaire

**Accès :** Tous les utilisateurs

**Description :**
Répertoire des contacts professionnels.

**Types de contacts :**
- **Internes** : Collaborateurs de l'entreprise
- **Externes** : Clients, fournisseurs, partenaires

**Informations par contact :**
- Nom / Prénom
- Fonction
- Entreprise (externes)
- Téléphone
- Email
- Notes

**Fonctionnalités :**
- Recherche par nom, fonction, entreprise
- Filtre par type (interne/externe)
- Appel téléphonique direct (lien tel:)
- Envoi d'email direct (lien mailto:)

**Synchronisation :** Globale

---

### 3.14 Statistiques

**Accès :** Tous les utilisateurs

**Description :**
Tableaux de bord et graphiques sur l'activité.

**Données affichées :**
- Dossiers en cours (total)
- Dossiers archivés
- Total traité
- Répartition par graphiste (barre colorée par type de statut)
- Répartition par statut
- Filtre par année

**Catégories de statuts affichées :**
- Urgent (rouge)
- À faire / En cours (bleu)
- En attente (violet)
- Mairie (rose)

---

### 3.15 Feedbacks

**Accès :** Tous les utilisateurs

**Description :**
Système de remontée de bugs, suggestions et demandes d'amélioration.

**Types de feedback :**
- Bug
- Amélioration
- Nouvelle fonctionnalité

**Priorités :**
- Basse, Normale, Haute, Urgente

**Statuts :**
- En attente
- Accepté
- Refusé
- En cours
- Terminé

**Fonctionnalités :**
- Créer un feedback
- Voir ses feedbacks et ceux des autres
- **Admin :**
  - Changer le statut
  - Ajouter un commentaire/réponse
  - Supprimer un feedback

**Synchronisation :** Globale

---

### 3.16 Nuancier (RAL Converter)

**Accès :** Tous les utilisateurs

**Description :**
Outil de conversion de couleurs pour les travaux d'impression et signalétique.

**Modes :**
1. **CMJN vers RAL** : Entrer des valeurs CMJN, obtenir les couleurs RAL les plus proches
2. **CMJN vers Pantone** : Entrer des valeurs CMJN, obtenir les couleurs Pantone les plus proches
3. **Catalogue RAL** : Parcourir toutes les couleurs RAL par catégorie

**Fonctionnalités :**
- Calcul du Delta E (différence colorimétrique perceptuelle)
- Affichage côte à côte (couleur source vs couleur cible)
- Copie rapide des valeurs (HEX, RGB, CMJN)
- Recherche par code ou nom

**Base de données :**
- 213 couleurs RAL Classic
- Base Pantone complète

**Synchronisation :** Aucune (outil local)

---

### 3.17 FabRik

**Accès :** Tous les utilisateurs

**Description :**
Générateur automatique de fichiers de fabrication pour Adobe Illustrator.

**Types de fichiers :**

#### A. Adhésif
- Automatisation pour découpe vinyle
- Lance un script Illustrator qui traite le fichier ouvert

#### B. Caisson (3 sous-types)

**Caisson Simple :**
- Génère un gabarit pour caisson rectangulaire
- Paramètres : Largeur, Hauteur, Profondeur, Retours

**Caisson Multi-parties :**
- Pour caissons de 2 à 5 parties
- Dimensions configurables par partie

**Caisson Double Face :**
- Pour enseignes drapeau (visibles des 2 côtés)
- Génère les 2 faces + structure

**Configuration :**
- Chemin vers Adobe Illustrator personnalisable
- Vérification de l'existence d'Illustrator

**Synchronisation :** Préférences locales (chemin Illustrator)

---

### 3.18 Recherche Globale

**Accès :** Tous les utilisateurs

**Description :**
Recherche unifiée dans toute l'application.

**Recherche dans :**
- Dossiers actifs
- Archives
- Franchises
- Projets internes
- Contacts

**Fonctionnalités :**
- Raccourci clavier : `Ctrl+K`
- Résultats groupés par type
- Navigation directe vers l'élément trouvé

---

### 3.19 Mon Profil

**Accès :** Tous les utilisateurs (son propre profil)

**Description :**
Gestion des informations personnelles et préférences.

**Sections :**

#### Informations (lecture seule)
- Nom complet
- Email
- Initiales
- Rôle

#### Changement de mot de passe
- Ancien mot de passe
- Nouveau mot de passe (min. 6 caractères)
- Confirmation

#### Couleur du badge
- Choix parmi 8 couleurs pour ses initiales
- Aperçu en temps réel
- Visible partout dans l'application

#### Préférences
- **Intensité du surlignage** : Slider 0-100%
  - Ajuste l'opacité des couleurs de fond dans "Mes Dossiers"
  - Aperçu en direct
- **Minimiser au lieu de fermer** : Toggle
  - Si activé, la croix minimise l'app dans la barre des tâches

#### Horaires de travail par défaut
- Configuration jour par jour
- Matin : Début / Fin
- Après-midi : Début / Fin
- Toggle "Travaillé" pour chaque jour
- Utilisé pour pré-remplir les feuilles d'heures

**Synchronisation :**
- Couleur du badge : Globale
- Horaires : Globale (stockés dans Supabase)
- Intensité surlignage : Locale (stockée dans le navigateur/localStorage)
- Minimiser à la fermeture : Locale + Globale

---

### 3.20 Utilisateurs (Admin)

**Accès :** Admin uniquement

**Description :**
Gestion des comptes utilisateurs.

**Fonctionnalités :**
- Créer un nouvel utilisateur
  - Email
  - Mot de passe initial
  - Nom complet
  - Initiales
  - Rôle (Admin / Graphiste)
- Modifier un utilisateur
  - Nom, initiales, rôle
- Activer / Désactiver un compte
  - Un compte désactivé ne peut plus se connecter

---

### 3.21 Paramètres (Admin)

**Accès :** Admin uniquement

**Description :**
Configuration système et maintenance.

**Sections :**

#### Informations système
- Nom de l'application
- Version actuelle
- Société
- État de la connexion BDD

#### Statuts disponibles
- Liste des statuts de dossiers
- Créer / Modifier / Supprimer un statut
- Réordonner les statuts (haut/bas)
- Chaque statut a :
  - Identifiant technique
  - Label affiché
  - Couleur (badge + fond de ligne)
  - Icône

#### Mises à jour
- Version installée
- Lien vers les releases GitHub
- Mises à jour automatiques au démarrage

#### Zone dangereuse
- Suppression de données en masse
- Options :
  - Tous les dossiers
  - Les archives seulement
  - Les dossiers sans graphiste (anciens)
  - Par graphiste
  - Les franchises
  - Les projets internes
- Confirmation obligatoire avec compteur

---

## 4. Synchronisation des données

### 4.1 Données synchronisées globalement (tous les utilisateurs)

| Donnée | Temps réel | Description |
|--------|------------|-------------|
| Dossiers | Oui | Création, modification, archivage |
| Statuts | Oui | Liste des statuts disponibles |
| Franchises | Oui | Créations et modifications |
| Projets internes | Oui | État des projets |
| Sites internet | Oui | Liste des sites |
| Contacts (Annuaire) | Oui | Ajouts et modifications |
| Process | Oui | Documentation |
| Sujets de réunion | Oui | Nouveaux sujets, archivage |
| Feedbacks | Oui | Créations et réponses |
| Planning vacances | Oui | Absences de tous |
| Heures supplémentaires | Non | Chaque utilisateur voit les siennes |
| Profils utilisateurs | Oui | Changements de couleur de badge, etc. |

### 4.2 Données par utilisateur

| Donnée | Stockage | Description |
|--------|----------|-------------|
| Horaires de base | Supabase | Horaires de travail par défaut |
| Préférences (minimize) | Supabase | Comportement de fermeture |
| Couleur de badge | Supabase | Couleur des initiales |
| Intensité surlignage | localStorage | Opacité des couleurs |
| Chemin Illustrator | localStorage | Chemin vers Adobe Illustrator |

### 4.3 Données locales uniquement

| Donnée | Description |
|--------|-------------|
| Session d'authentification | Token de connexion |
| Cache des requêtes | Optimisation de performance |
| Préférences d'affichage | Tri, filtres sélectionnés |

---

## 5. Préférences utilisateur

### 5.1 Stockées dans Supabase (synchronisées)

- **Horaires de travail** : Configuration des jours/heures
- **Couleur de badge** : Parmi 8 couleurs disponibles
- **Minimiser à la fermeture** : Oui/Non

### 5.2 Stockées localement (par machine)

- **Intensité du surlignage** : 0-100%
- **Chemin Adobe Illustrator** : Pour FabRik
- **Filtres et tri** : Dernière configuration utilisée

---

## 6. Résumé par fonctionnalité

### Légende

- **G** = Accessible aux Graphistes
- **A** = Accessible aux Admins uniquement
- **Sync** = Synchronisé en temps réel
- **Local** = Données locales

| Module | Accès | Sync | Description courte |
|--------|-------|------|-------------------|
| Dashboard | G + A | Sync | Vue d'ensemble personnalisée |
| Mes Dossiers | G + A | Sync | Gestion des dossiers assignés |
| Tous les Dossiers | A | Sync | Vue globale + actions en masse |
| Archives | G + A | Sync | Historique des dossiers terminés |
| Heures Sup | G + A | Sync | Suivi du temps de travail |
| Rapport Heures | A | Sync | Consolidation des heures équipe |
| Planning Vacances | G + A | Sync | Calendrier des absences |
| Franchises | G + A | Sync | Gestion des clients récurrents |
| Projets Internes | G + A | Sync | Suivi des projets internes |
| Sites Internet | G + A | Sync | Annuaire des sites clients |
| Process | G + A | Sync | Documentation procédures |
| Réunions | G + A | Sync | Sujets à aborder en réunion |
| Annuaire | G + A | Sync | Contacts internes/externes |
| Statistiques | G + A | Sync | Tableaux de bord |
| Feedbacks | G + A | Sync | Bugs et suggestions |
| Nuancier | G + A | Local | Conversion couleurs CMJN/RAL/Pantone |
| FabRik | G + A | Local | Génération fichiers Illustrator |
| Recherche | G + A | Sync | Recherche globale (Ctrl+K) |
| Mon Profil | G + A | Mixte | Préférences personnelles |
| Utilisateurs | A | Sync | Gestion des comptes |
| Paramètres | A | Sync | Configuration système |

---

## Notes techniques

### Notifications

- **Notifications navigateur** pour les rappels de réunion
- Demande de permission au premier accès à la page Réunions

### Mises à jour

- Vérification automatique au démarrage
- Notification si nouvelle version disponible
- Téléchargement depuis GitHub Releases

### Sécurité

- Authentification via Supabase Auth (JWT)
- Row Level Security (RLS) sur toutes les tables
- Les graphistes ne peuvent voir/modifier que leurs propres dossiers
- Les admins ont accès complet

### Performance

- Pagination côté serveur (archives, tous les dossiers)
- Cache des requêtes avec React Query
- Optimisation des re-rendus

---

*Document généré automatiquement à partir de l'analyse du code source de GraphiDesk.*
