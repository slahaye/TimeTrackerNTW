# Documentation Technique - Application de Suivi de Temps

## Architecture

### Composants Principaux

1. **Frontend** (renderer.js)
   - Interface utilisateur Electron
   - Gestion du chronomètre
   - Gestion des tâches
   - Système de recherche
   - Stockage local avec localStorage

2. **Backend** (googleSheets.js)
   - Intégration avec l'API Google Sheets
   - Synchronisation des données
   - Gestion des feuilles utilisateur

### Structure des Fichiers

- `index.html`: Interface utilisateur principale
- `renderer.js`: Logique de l'interface utilisateur
- `googleSheets.js`: Logique de synchronisation avec Google Sheets
- `.env`: Configuration des variables d'environnement
- `settings.html`: Interface de configuration

## Architecture Technique

### Gestion du Temps
- Utilisation de setInterval pour le chronomètre
- Stockage du temps en secondes
- Formatage du temps au format HH:MM:SS
- Arrondi au quart d'heure supérieur pour la synchronisation

### Synchronisation Google Sheets
- Utilisation de la bibliothèque googleapis
- Authentification avec Google OAuth
- Création automatique des feuilles utilisateur
- Formatage des données selon le modèle défini

### Structure des Données

#### Format des Tâches
```javascript
{
    id: string,          // Identifiant unique de la tâche
    taskName: string,    // Nom de la tâche
    duration: number,    // Durée en secondes
    synced: boolean      // Statut de synchronisation
}
```

#### Structure de la Feuille Google
- Colonne A: ID
- Colonne B: INTERVENANT
- Colonne C: MOIS
- Colonne D: DATE
- Colonne E: CLIENT
- Colonne F: MARCHÉ
- Colonne G: EQUIPE
- Colonne H: PRESTATION
- Colonne I: COMMENTAIRES
- Colonne J: PB ou CWJ
- Colonne K: A FACTURER
- Colonne L: Temps passé

## Variables d'Environnement (.env)

- GOOGLE_CLIENT_EMAIL: Email du compte service Google
- GOOGLE_PRIVATE_KEY: Clé privée du compte service
- GOOGLE_SPREADSHEET_ID: ID de la feuille Google Sheets

## Dépendances Principales

- electron: Framework pour l'application desktop
- googleapis: Intégration avec Google Sheets
- dotenv: Gestion des variables d'environnement
