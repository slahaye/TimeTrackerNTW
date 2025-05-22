const { ipcRenderer } = require('electron');

let startTime;
let timerInterval;
let isRunning = false;
let elapsedTime = 0;
let currentTaskId = null; // Pour garder une trace de la tâche en cours

const timerDisplay = document.getElementById('timer');
const startStopButton = document.getElementById('startStop');
const saveButton = document.getElementById('save');
const taskNameInput = document.getElementById('taskName');
const timeEntriesDiv = document.getElementById('timeEntries');
const timeAdjustButtons = document.getElementById('timeAdjustButtons');
const syncedTasksContainer = document.getElementById('syncedTasks');
const currentTasksSearch = document.getElementById('currentTasksSearch');
const syncedTasksSearch = document.getElementById('syncedTasksSearch');

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseTime(timeString) {
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

function updateTimer() {
    const currentTime = Date.now();
    elapsedTime = Math.floor((currentTime - startTime) / 1000);
    timerDisplay.textContent = formatTime(elapsedTime);
}

function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(elapsedTime);
}

function adjustTime(seconds) {
    if (isRunning) {
        elapsedTime += seconds;
        updateTimerDisplay();
        // Ajuster le startTime pour maintenir la synchronisation
        startTime = Date.now() - (elapsedTime * 1000);
    }
}

// Boutons d'ajout de temps
document.getElementById('addOneMin').addEventListener('click', () => adjustTime(60));
document.getElementById('addTenMin').addEventListener('click', () => adjustTime(600));

// Boutons de soustraction de temps
document.getElementById('subtractOneMin').addEventListener('click', () => adjustTime(-60));
document.getElementById('subtractTenMin').addEventListener('click', () => adjustTime(-600));

// Initialiser le système de sélection
let selectedTasks = new Set();

function updateSelectionUI() {
    const selectionBar = document.getElementById('selectionBar');
    const selectionCount = document.querySelector('.selection-count');
    const container = document.querySelector('.container');
    
    selectionCount.textContent = `${selectedTasks.size} tâche(s) sélectionnée(s)`;
    
    if (selectedTasks.size > 0) {
        selectionBar.classList.add('active');
        container.classList.add('with-selection-bar');
    } else {
        selectionBar.classList.remove('active');
        container.classList.remove('with-selection-bar');
    }
}

function deleteSelectedTasks() {
    if (confirm('Voulez-vous vraiment supprimer les tâches sélectionnées ?')) {
        const timeEntries = getTimeEntries();
        const newEntries = timeEntries.filter(entry => !selectedTasks.has(entry.id));
        saveTimeEntries(newEntries);
        selectedTasks.clear();
        
        // Mettre à jour l'interface utilisateur
        timeEntriesDiv.innerHTML = '';
        loadTimeEntries();
        updateSelectionUI();
    }
}

function deselectAll() {
    selectedTasks.clear();
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.querySelectorAll('.task-entry').forEach(entry => {
        entry.classList.remove('selected');
    });
    updateSelectionUI();
}

// Initialiser le système de sélection
if (typeof window.selectionHandler !== 'undefined') {
    window.selectionHandler.initializeSelectionSystem();
}

// Ajouter les écouteurs d'événements pour les boutons d'action groupée
document.querySelector('.delete-selected').addEventListener('click', deleteSelectedTasks);
document.querySelector('.deselect-all').addEventListener('click', deselectAll);

document.querySelector('.sync-selected').addEventListener('click', async () => {
    if (selectedTasks.size === 0) {
        alert('Veuillez sélectionner des tâches à synchroniser');
        return;
    }

    const settings = getSettings();
    if (!settings.firstName) {
        alert('Veuillez configurer votre prénom dans les paramètres');
        window.location.href = 'settings.html';
        return;
    }

    try {
        const timeEntries = getTimeEntries();
        const selectedEntries = timeEntries.filter(entry => selectedTasks.has(entry.id));
        
        // Désélectionner toutes les tâches avant de commencer la synchronisation
        deselectAll();
        
        // Créer un tableau pour stocker les résultats de synchronisation
        const syncResults = [];
        
        // Créer un tableau pour stocker les mises à jour à faire
        const updates = [];
        
        // D'abord, synchroniser toutes les tâches et collecter les résultats
        for (const entry of selectedEntries) {
            try {
                // Récupérer l'élément du bouton de synchronisation
                const taskElement = document.querySelector(`[data-id="${entry.id}"]`);
                const syncButton = taskElement?.querySelector('.sync');
                
                if (syncButton) {
                    // Ajouter l'animation de rotation
                    syncButton.classList.add('syncing');
                    // Désactiver le bouton pendant la synchronisation
                    syncButton.disabled = true;
                }
                
                const result = await ipcRenderer.invoke('sync-to-sheets', {
                    id: entry.id,
                    taskName: entry.taskName,
                    duration: entry.duration,
                    firstName: settings.firstName
                });
                
                if (syncButton) {
                    // Supprimer l'animation de rotation
                    syncButton.classList.remove('syncing');
                    // Réactiver le bouton
                    syncButton.disabled = false;
                    
                    if (result.success) {
                        // Mettre à jour l'état visuel
                        syncButton.classList.add('synced');
                        syncButton.style.display = 'none';
                    }
                }
                
                if (result.success) {
                    updates.push({
                        id: entry.id,
                        synced: true
                    });
                    syncResults.push({
                        taskName: entry.taskName,
                        status: 'success'
                    });
                } else {
                    syncResults.push({
                        taskName: entry.taskName,
                        status: 'error',
                        message: result.error
                    });
                }
            } catch (error) {
                syncResults.push({
                    taskName: entry.taskName,
                    status: 'error',
                    message: error.message
                });
            }
        }
        
        // Ensuite, mettre à jour toutes les tâches en une seule fois
        if (updates.length > 0) {
            const updatedEntries = timeEntries.map(t => {
                const update = updates.find(u => u.id === t.id);
                if (update) {
                    return { ...t, ...update };
                }
                return t;
            });
            saveTimeEntries(updatedEntries);
            
            // Mettre à jour l'interface
            loadTimeEntries();
        }
        
        // Afficher un résumé de la synchronisation
        if (syncResults.length > 0) {
            const successCount = syncResults.filter(r => r.status === 'success').length;
            const errorCount = syncResults.length - successCount;
            
            let message = `${successCount} tâche(s) synchronisée(s)`;
            if (errorCount > 0) {
                message += `, ${errorCount} erreur(s)`;
            }
            alert(message);
            
            // Pour les tâches qui ont échoué, afficher les détails
            const failedTasks = syncResults.filter(r => r.status === 'error');
            if (failedTasks.length > 0) {
                const details = failedTasks.map(task => `
- ${task.taskName}: ${task.message}`).join('');
                alert(`Détails des erreurs:${details}`);
            }
        }
        
    } catch (error) {
        alert('Erreur lors de la synchronisation des tâches : ' + error.message);
    }
});

// Initialiser la liste au chargement
document.addEventListener('DOMContentLoaded', () => {
    loadTimeEntries();
});
document.getElementById('addOneHour').addEventListener('click', () => adjustTime(3600));
document.getElementById('subtractOneHour').addEventListener('click', () => adjustTime(-3600));

startStopButton.addEventListener('click', () => {
    if (!isRunning) {
        startTime = Date.now() - (elapsedTime * 1000);
        timerInterval = setInterval(updateTimer, 1000);
        startStopButton.textContent = 'Pause';
        timeAdjustButtons.style.display = 'flex';
    } else {
        clearInterval(timerInterval);
        startStopButton.textContent = 'Démarrer';
        timeAdjustButtons.style.display = 'none';
    }
    isRunning = !isRunning;
});

function saveTimeEntries(entries) {
    localStorage.setItem('timeEntries', JSON.stringify(entries));
}

function getTimeEntries() {
    return JSON.parse(localStorage.getItem('timeEntries') || '[]');
}

saveButton.addEventListener('click', () => {
    const taskName = taskNameInput.value.trim();
    if (!taskName) {
        alert('Veuillez entrer un nom de tâche');
        return;
    }

    const newEntry = {
        id: currentTaskId || Date.now().toString(),
        taskName: taskName,
        duration: elapsedTime,
        synced: false
    };

    const timeEntries = getTimeEntries();
    
    if (currentTaskId) {
        // Mise à jour d'une tâche existante
        const index = timeEntries.findIndex(entry => entry.id === currentTaskId);
        if (index !== -1) {
            timeEntries[index] = newEntry;
        } else {
            timeEntries.unshift(newEntry);
        }
    } else {
        // Nouvelle tâche
        timeEntries.unshift(newEntry);
    }
    
    saveTimeEntries(timeEntries);
    
    // Réinitialiser
    elapsedTime = 0;
    timerDisplay.textContent = formatTime(0);
    taskNameInput.value = '';
    currentTaskId = null;
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        startStopButton.textContent = 'Démarrer';
        timeAdjustButtons.classList.remove('active');
    }
    loadTimeEntries();
});

async function loadTimeEntries() {
    const entries = getTimeEntries();
    
    // Nettoyer les conteneurs
    timeEntriesDiv.innerHTML = '';
    syncedTasksContainer.innerHTML = '';

    // Réinitialiser les champs de recherche
    currentTasksSearch.value = '';
    syncedTasksSearch.value = '';

    // Nettoyer les tâches sélectionnées
    selectedTasks.clear();
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.querySelectorAll('.task-entry').forEach(entry => {
        entry.classList.remove('selected');
    });
    updateSelectionUI();

    // Charger les tâches
    entries.forEach(entry => {
        const taskElement = createTimeEntryElement(entry);
        if (entry.synced) {
            syncedTasksContainer.appendChild(taskElement);
        } else {
            timeEntriesDiv.appendChild(taskElement);
        }
    });

    // Mettre à jour l'interface après le chargement
    updateSelectionUI();
}

function createTimeEntryElement(entry) {
    const entryElement = document.createElement('div');
    entryElement.className = 'task-entry';
    entryElement.draggable = true;
    entryElement.dataset.id = entry.id;

    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';

    // Ajouter la checkbox de sélection
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'select-checkbox';
    checkboxContainer.innerHTML = `
        <input type="checkbox" id="select-${entry.id}" class="task-checkbox">
        <label for="select-${entry.id}"></label>
    `;
    
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '☰';
    dragHandle.draggable = true;

    const taskNameSpan = document.createElement('span');
    taskNameSpan.className = 'task-name';
    taskNameSpan.textContent = entry.taskName;

    const durationSpan = document.createElement('span');
    durationSpan.className = 'duration';
    durationSpan.textContent = formatTime(entry.duration);

    mainContent.appendChild(checkboxContainer);
    mainContent.appendChild(dragHandle);
    mainContent.appendChild(taskNameSpan);
    mainContent.appendChild(durationSpan);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'buttons-container';

    const continueButton = document.createElement('button');
    continueButton.className = 'material-icons play';
    continueButton.textContent = 'play_circle_filled';

    const editButton = document.createElement('button');
    editButton.className = 'material-icons edit';
    editButton.textContent = 'edit';

    const deleteButton = document.createElement('button');
    deleteButton.className = 'material-icons delete';
    deleteButton.textContent = 'delete';

    const syncButton = document.createElement('button');
    syncButton.className = 'material-icons sync';
    syncButton.textContent = 'sync';
    if (entry.synced) {
        syncButton.style.display = 'none';
    }

    // Ajouter l'écouteur d'événement pour la checkbox
    const checkbox = checkboxContainer.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            selectedTasks.add(entry.id);
            entryElement.classList.add('selected');
        } else {
            selectedTasks.delete(entry.id);
            entryElement.classList.remove('selected');
        }
        updateSelectionUI();
    });

    const editForm = document.createElement('div');
    editForm.className = 'edit-form';
    editForm.innerHTML = `
        <input type="text" class="task-name-edit" value="${entry.taskName}">
        <input type="text" class="time-edit" value="${formatTime(entry.duration)}" placeholder="HH:MM:SS">
        <button class="save-edit">Enregistrer</button>
        <button class="cancel-edit">Annuler</button>
    `;

    // Ajouter les gestionnaires d'événements de drag and drop
    entryElement.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', entry.id);
        entryElement.classList.add('dragging');
        entryElement.style.opacity = '0.7';
    });

    entryElement.addEventListener('dragend', () => {
        entryElement.classList.remove('dragging');
        entryElement.style.opacity = '1';
    });

    entryElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        entryElement.classList.add('dragover');
        const draggingElement = document.querySelector('.dragging');
        if (draggingElement && draggingElement !== entryElement) {
            const rect = entryElement.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                entryElement.parentNode.insertBefore(draggingElement, entryElement);
            } else {
                entryElement.parentNode.insertBefore(draggingElement, entryElement.nextSibling);
            }
        }
    });

    entryElement.addEventListener('dragleave', () => {
        entryElement.classList.remove('dragover');
    });

    // Gestionnaire pour sauvegarder le nouvel ordre
    entryElement.addEventListener('drop', (e) => {
        e.preventDefault();
        entryElement.classList.remove('dragover');
        entryElement.classList.remove('dragging');
        entryElement.style.opacity = '1';
        const timeEntries = Array.from(timeEntriesDiv.children).map(item => {
            const id = item.dataset.id;
            return getTimeEntries().find(e => e.id === id);
        }).filter(Boolean);
        
        saveTimeEntries(timeEntries);
    });

    continueButton.addEventListener('click', () => {
        // Si un chrono est déjà en cours, on le sauvegarde
        if (isRunning) {
            saveButton.click(); // Sauvegarde le chrono en cours
        }
        
        // On sélectionne la tâche actuelle
        currentTaskId = entry.id;
        taskNameInput.value = entry.taskName;
        elapsedTime = entry.duration;
        updateTimerDisplay();
        
        // Démarrer le chrono
        startTime = Date.now() - (elapsedTime * 1000);
        timerInterval = setInterval(updateTimer, 1000);
        isRunning = true;
        startStopButton.textContent = 'Pause';
        timeAdjustButtons.style.display = 'flex';
    });

    editButton.addEventListener('click', () => {
        if (entry.synced) {
            moveToCurrentTasks(entryElement, entry.id);
        }
        
        editForm.classList.add('active');
        mainContent.style.display = 'none';
        editButton.style.display = 'none';
        deleteButton.style.display = 'none';
        continueButton.style.display = 'none';
        syncButton.style.display = 'none';
    });

    editForm.querySelector('.cancel-edit').addEventListener('click', () => {
        editForm.classList.remove('active');
        mainContent.style.display = 'flex';
        editButton.style.display = 'inline';
        deleteButton.style.display = 'inline';
        continueButton.style.display = 'inline';
        syncButton.style.display = 'inline';
    });

    editForm.querySelector('.save-edit').addEventListener('click', () => {
        const newTaskName = editForm.querySelector('.task-name-edit').value.trim();
        const newTimeStr = editForm.querySelector('.time-edit').value.trim();
        
        if (!newTaskName || !newTimeStr) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        const newDuration = parseTime(newTimeStr);
        
        // Mettre à jour la tâche dans le localStorage
        const timeEntries = getTimeEntries();
        const updatedEntries = timeEntries.map(t => {
            if (t.id === entry.id) {
                return {
                    ...t,
                    taskName: newTaskName,
                    duration: newDuration
                };
            }
            return t;
        });
        
        saveTimeEntries(updatedEntries);
        
        // Recharger l'affichage complet pour éviter les doublons
        loadTimeEntries();
        
        // Cacher le formulaire et réafficher le contenu principal
        editForm.classList.remove('active');
        mainContent.style.display = 'flex';
        editButton.style.display = 'inline';
        deleteButton.style.display = 'inline';
        continueButton.style.display = 'inline';
        syncButton.style.display = 'inline';
    });

    deleteButton.addEventListener('click', () => {
        if (confirm('Voulez-vous vraiment supprimer cette tâche ?')) {
            const timeEntries = getTimeEntries();
            const updatedEntries = timeEntries.filter(t => t.id !== entry.id);
            saveTimeEntries(updatedEntries);
            entryElement.remove();
        }
    });

    syncButton.addEventListener('click', async () => {
        try {
            // Ajouter l'animation de rotation
            syncButton.classList.add('syncing');
            syncButton.disabled = true;

            const settings = getSettings();
            if (!settings.firstName) {
                alert('Veuillez configurer votre prénom dans les paramètres');
                window.location.href = 'settings.html';
                return;
            }

            const result = await ipcRenderer.invoke('sync-to-sheets', {
                id: entry.id,
                taskName: entry.taskName,
                duration: entry.duration,
                firstName: settings.firstName
            });
            
            // Supprimer l'animation de rotation
            syncButton.classList.remove('syncing');
            syncButton.disabled = false;
            
            if (result.success) {
                //syncButton.textContent = '✓ Synced';
                syncButton.classList.add('synced');
                syncButton.style.display = 'none';

                // Déplacer la tâche vers la section des tâches synchronisées
                moveToSyncedTasks(entryElement, entry.id);
                
                // Sauvegarder l'état de synchronisation
                const timeEntries = getTimeEntries();
                const updatedEntries = timeEntries.map(t => {
                    if (t.id === entry.id) {
                        return { ...t, synced: true };
                    }
                    return t;
                });
                saveTimeEntries(updatedEntries);
            } else {
                alert('Erreur de synchronisation : ' + result.error);
            }
        } catch (error) {
            alert('Erreur de synchronisation : ' + error.message);
        }
    });

    buttonsContainer.appendChild(continueButton);
    buttonsContainer.appendChild(editButton);
    buttonsContainer.appendChild(deleteButton);
    buttonsContainer.appendChild(syncButton);

    entryElement.appendChild(mainContent);
    entryElement.appendChild(buttonsContainer);
    entryElement.appendChild(editForm);

    return entryElement;
}

function moveToSyncedTasks(taskElement, taskId) {
    const timeEntriesContainer = document.getElementById('timeEntries');
    
    // Supprimer la tâche de la section des tâches en cours
    timeEntriesContainer.removeChild(taskElement);
    
    // Ajouter la tâche à la section des tâches synchronisées
    syncedTasksContainer.insertBefore(taskElement, syncedTasksContainer.firstChild);
    
    // Mettre à jour l'état visuel de la tâche synchronisée
    const syncButton = taskElement.querySelector('.sync');
    if (syncButton) {
        syncButton.classList.add('synced');
        syncButton.style.display = 'none';
    }
}

// ...

// Gestionnaires de recherche
function filterTasks(searchInput, container) {
    const searchTerm = searchInput.value.toLowerCase();
    const taskElements = container.getElementsByClassName('task-entry');
    
    Array.from(taskElements).forEach(taskElement => {
        const taskName = taskElement.querySelector('.task-name').textContent.toLowerCase();
        if (taskName.includes(searchTerm)) {
            taskElement.style.display = '';
        } else {
            taskElement.style.display = 'none';
        }
    });
}

currentTasksSearch.addEventListener('input', () => {
    filterTasks(currentTasksSearch, timeEntriesDiv);
});

syncedTasksSearch.addEventListener('input', () => {
    filterTasks(syncedTasksSearch, syncedTasksContainer);
});

// Fonction pour supprimer toutes les tâches synchronisées
function deleteAllSyncedTasks() {
    if (confirm('Voulez-vous vraiment supprimer toutes les tâches synchronisées ?')) {
        const timeEntries = getTimeEntries();
        const newEntries = timeEntries.filter(entry => !entry.synced);
        saveTimeEntries(newEntries);
        
        // Mettre à jour l'interface utilisateur
        syncedTasksContainer.innerHTML = '';
        loadTimeEntries();
    }
}

// Ajouter l'écouteur d'événement pour le bouton de suppression des tâches synchronisées
const deleteAllSyncedTasksButton = document.getElementById('deleteAllSyncedTasks');
if (deleteAllSyncedTasksButton) {
    deleteAllSyncedTasksButton.addEventListener('click', (e) => {
        e.preventDefault();
        deleteAllSyncedTasks();
    });
}

// Charger l'historique au démarrage
loadTimeEntries();

// Gestionnaire du bouton des paramètres
const settingsButton = document.getElementById('settingsButton');
settingsButton.addEventListener('click', () => {
    window.location.href = 'settings.html';
});

// Fonction pour obtenir les paramètres
function getSettings() {
    return JSON.parse(localStorage.getItem('settings') || '{}');
}
