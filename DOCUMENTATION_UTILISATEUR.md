# Documentation Utilisateur - Application de Suivi de Temps

## Description
Cette application vous permet de suivre votre temps passé sur différentes tâches et de synchroniser ces données avec Google Sheets.

## Fonctionnalités Principales

### Chronomètre
- Démarrer/arrêter le chronomètre en cliquant sur le bouton "Démarrer/Pause"
- Ajuster le temps manuellement avec les boutons (+1min, +10min, +1h)
- Le temps est affiché au format HH:MM:SS

### Gestion des Tâches
1. Entrer le nom de la tâche dans le champ de texte
2. Cliquer sur "Sauvegarder" pour enregistrer la tâche
3. La tâche apparaîtra dans la liste des tâches en cours

### Synchronisation avec Google Sheets
- Au clic sur le bouton synchro, les tâches sont synchronisées avec votre feuille Google Sheets
- Une feuille est créée automatiquement avec votre prénom
- Les données sont sauvegardées avec les informations suivantes :
  - ID de la tâche
  - Intervenant (votre prénom)
  - Mois
  - Date
  - Temps passé (arrondi au quart d'heure supérieur)
  - Commentaires (nom de la tâche)

## Paramètres
- Configurez votre prénom dans les paramètres pour la synchronisation
- Les paramètres Google Sheets sont configurés via le fichier .env

## Recherche
- Utilisez la barre de recherche pour filtrer les tâches
- Les tâches peuvent être recherchées dans les tâches en cours et les tâches synchronisées
