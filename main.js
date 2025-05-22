const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const GoogleSheetsSync = require('./googleSheets');
const { autoUpdater } = require('electron-updater');
const remoteMain = require('@electron/remote/main');

// Vérifier que l'application est correctement chargée
if (!app) {
  console.error('Erreur: Impossible de charger le module electron.app');
  process.exit(1);
}

const store = new Store();
let mainWindow;
let googleSheets;

// Configuration de l'auto-updater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Configurer le fournisseur de mise à jour
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'slahaye',
  repo: 'TimeTrackerNTW',
  releaseType: 'release'
});

// Initialiser le module remote
remoteMain.initialize();

// Configurer la CSP avant que l'application ne soit prête
app.whenReady().then(() => {
  googleSheets = new GoogleSheetsSync();
  
  // Configurer la session
  const { session } = require('electron');
  const ses = session.defaultSession;
  // Configurer les en-têtes de sécurité pour toutes les requêtes
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
          "style-src 'self' https://fonts.googleapis.com 'unsafe-inline';",
          "font-src 'self' https://fonts.gstatic.com;",
          "img-src 'self' data:;"
        ].join(' ')
      }
    });
  });

  createWindow();
  
  // Vérifier les mises à jour
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 600,
      height: 800,
      minWidth: 600,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: true,
        sandbox: false,
        devTools: true,
        enableRemoteModule: true
      },
      show: false // Ne pas montrer la fenêtre immédiatement
    });
    
    // Activer le module remote pour cette fenêtre
    remoteMain.enable(mainWindow.webContents);

    // Charger l'index.html
    mainWindow.loadFile('index.html')
      .then(() => {
        // Une fois la page chargée, afficher la fenêtre
        mainWindow.show();
        
        // Ouvrir les outils de développement en mode développement
        if (process.env.NODE_ENV === 'development') {
          mainWindow.webContents.openDevTools();
        }
      })
      .catch(err => {
        console.error('Erreur lors du chargement de index.html:', err);
      });

    // Gérer les erreurs de chargement de page
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Erreur de chargement de la page:', errorDescription);
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body>
            <h1>Erreur de chargement</h1>
            <p>Une erreur est survenue lors du chargement de l'application.</p>
            <p>${errorDescription} (${errorCode})</p>
            <button onclick="window.location.reload()">Réessayer</button>
          </body>
        </html>`);
    });

  } catch (error) {
    console.error('Erreur lors de la création de la fenêtre:', error);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Gestionnaire pour sauvegarder les données
ipcMain.on('save-time-entry', (event, timeEntry) => {
  const timeEntries = store.get('timeEntries', []);
  timeEntries.push({
    ...timeEntry,
    id: Date.now().toString() // Ajouter un ID unique
  });
  store.set('timeEntries', timeEntries);
});

// Gestionnaire pour récupérer les données
ipcMain.handle('get-time-entries', () => {
  return store.get('timeEntries', []);
});

// Gestionnaire pour mettre à jour une entrée
ipcMain.on('update-time-entry', (event, { id, taskName, duration }) => {
  const timeEntries = store.get('timeEntries', []);
  const updatedEntries = timeEntries.map(entry => 
    entry.id === id ? { ...entry, taskName, duration } : entry
  );
  store.set('timeEntries', updatedEntries);
});

// Gestionnaire pour supprimer une entrée
ipcMain.on('delete-time-entry', (event, id) => {
  const timeEntries = store.get('timeEntries', []);
  const filteredEntries = timeEntries.filter(entry => entry.id !== id);
  store.set('timeEntries', filteredEntries);
});

// Gestionnaire pour supprimer plusieurs entrées
ipcMain.handle('delete-multiple-time-entries', async (event, ids) => {
  try {
    const timeEntries = store.get('timeEntries', []);
    const filteredEntries = timeEntries.filter(entry => !ids.includes(entry.id));
    store.set('timeEntries', filteredEntries);
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression multiple:', error);
    throw error;
  }
});

// Gestionnaire pour mettre à jour l'ordre des entrées
ipcMain.on('reorder-time-entries', (event, timeEntries) => {
  store.set('timeEntries', timeEntries);
});

// Gérer la synchronisation avec Google Sheets
ipcMain.handle('sync-to-sheets', async (event, task) => {
  try {
    return await googleSheets.syncTask(task);
  } catch (error) {
    console.error('Erreur lors de la synchronisation avec Google Sheets:', error);
    return { success: false, error: error.message };
  }
});

// Gestionnaires d'événements pour l'auto-updater
autoUpdater.on('checking-for-update', () => {
  console.log('Vérification des mises à jour...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Mise à jour disponible:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Mise à jour disponible',
    message: `Une nouvelle version (${info.version}) est disponible et sera téléchargée automatiquement.`,
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Aucune mise à jour disponible:', info);
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Vitesse de téléchargement: ${progressObj.bytesPerSecond} - Téléchargé ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
  console.log(logMessage);
  mainWindow.webContents.send('update-download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Mise à jour téléchargée:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Mise à jour prête',
    message: 'Une mise à jour a été téléchargée. Elle sera installée au prochain redémarrage de l\'application.',
    buttons: ['Redémarrer maintenant', 'Plus tard']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Erreur lors de la mise à jour:', err);
  dialog.showErrorBox('Erreur de mise à jour', `Une erreur est survenue lors de la mise à jour: ${err.message}`);
});

// Gestionnaire pour vérifier manuellement les mises à jour
ipcMain.handle('check-for-updates', async () => {
  if (process.env.NODE_ENV === 'development') {
    return { success: false, message: 'Les mises à jour sont désactivées en mode développement' };
  }
  
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la vérification des mises à jour:', error);
    return { success: false, error: error.message };
  }
});
