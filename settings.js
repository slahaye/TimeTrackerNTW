const { ipcRenderer, remote } = require('electron');
const app = remote ? remote.app : require('@electron/remote').app;

const backButton = document.getElementById('backButton');
const firstNameInput = document.getElementById('firstName');
const saveButton = document.getElementById('saveSettings');
const checkUpdatesButton = document.getElementById('checkUpdates');
const currentVersionElement = document.getElementById('currentVersion');
const updateStatusElement = document.getElementById('updateStatus');

// Charger les paramètres existants
document.addEventListener('DOMContentLoaded', () => {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    firstNameInput.value = settings.firstName || '';
    
    // Afficher la version actuelle
    try {
        currentVersionElement.textContent = app.getVersion();
    } catch (error) {
        console.error('Erreur lors de la récupération de la version:', error);
        currentVersionElement.textContent = 'Inconnue';
    }
});

// Sauvegarder les paramètres
saveButton.addEventListener('click', () => {
    const firstName = firstNameInput.value.trim();
    if (!firstName) {
        alert('Veuillez entrer votre prénom');
        return;
    }

    const settings = {
        firstName: firstName
    };
    
    localStorage.setItem('settings', JSON.stringify(settings));
    alert('Paramètres sauvegardés');
});

// Retour à la page principale
backButton.addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Vérifier les mises à jour
checkUpdatesButton.addEventListener('click', async () => {
    updateStatusElement.innerHTML = '<p style="color: #666;">Vérification des mises à jour en cours...</p>';
    
    try {
        const result = await ipcRenderer.invoke('check-for-updates');
        
        if (result.success) {
            updateStatusElement.innerHTML = '<p style="color: #28a745;">Vérification terminée. Vous serez notifié si une mise à jour est disponible.</p>';
        } else {
            updateStatusElement.innerHTML = `<p style="color: #dc3545;">Erreur: ${result.message || result.error || 'Une erreur est survenue'}</p>`;
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des mises à jour:', error);
        updateStatusElement.innerHTML = `<p style="color: #dc3545;">Erreur: ${error.message || 'Une erreur est survenue'}</p>`;
    }
});

// Écouter les événements de progression du téléchargement
ipcRenderer.on('update-download-progress', (event, progressObj) => {
    updateStatusElement.innerHTML = `
        <p style="color: #007bff;">Téléchargement en cours: ${Math.round(progressObj.percent)}%</p>
        <div style="background-color: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden;">
            <div style="background-color: #007bff; height: 100%; width: ${progressObj.percent}%;"></div>
        </div>
    `;
});
