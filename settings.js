const { ipcRenderer } = require('electron');

const backButton = document.getElementById('backButton');
const firstNameInput = document.getElementById('firstName');
const saveButton = document.getElementById('saveSettings');

// Charger les paramètres existants
document.addEventListener('DOMContentLoaded', () => {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    firstNameInput.value = settings.firstName || '';
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
