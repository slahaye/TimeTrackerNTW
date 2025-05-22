const { google } = require('googleapis');
const config = require('./config');

class GoogleSheetsSync {
    constructor() {
        if (!config.google.client_email || !config.google.private_key || !config.google.spreadsheet_id) {
            throw new Error('Google configuration is incomplete. Please update config.js with your credentials.');
        }

        this.auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: config.google.client_email,
                private_key: config.google.private_key.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.spreadsheetId = config.google.spreadsheet_id;
    }

    // Convertit les secondes en format HH:MM
    formatDuration(seconds) {
        // Arrondir au quart d'heure supérieur
        const totalMinutes = Math.ceil((seconds / 60) / 15) * 15;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Obtient le nom du mois en français
    getMonthName(date) {
        const months = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        return months[date.getMonth()];
    }

    async initializeSheet(firstName) {
        try {
            // Récupérer les informations sur toutes les feuilles
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            // Vérifier si la feuille avec le prénom existe
            const userSheet = response.data.sheets.find(
                sheet => sheet.properties.title === firstName
            );

            if (!userSheet) {
                // Créer la feuille avec le prénom si elle n'existe pas
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: firstName,
                                    gridProperties: {
                                        rowCount: 1000,
                                        columnCount: 12
                                    }
                                }
                            }
                        }]
                    }
                });

                // Ajouter les en-têtes
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${firstName}!A1:L1`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [[
                            'ID',
                            'INTERVENANT',
                            'MOIS',
                            'DATE',
                            'CLIENT',
                            'MARCHÉ',
                            'EQUIPE',
                            'PRESTATION',
                            'COMMENTAIRES',
                            'PB ou CWJ',
                            'A FACTURER',
                            'Temps passé'
                        ]]
                    }
                });
            }
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la feuille:', error);
            throw error;
        }
    }

    async syncTask(task) {
        try {
            const firstName = task.firstName;
            
            if (!firstName) {
                throw new Error('Veuillez configurer votre prénom dans les paramètres');
            }

            await this.initializeSheet(firstName);

            const now = new Date();
            const formattedDuration = this.formatDuration(task.duration);

            // Vérifier si la tâche existe déjà
            const rows = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${firstName}!A:L`,
            });

            const values = [[
                task.id,
                firstName,
                this.getMonthName(now),
                now.getDate(),
                '', // CLIENT
                '', // MARCHÉ
                '', // EQUIPE
                '', // PRESTATION
                task.taskName, // COMMENTAIRES
                '', // PB ou CWJ
                '', // A FACTURER
                formattedDuration
            ]];

            const existingRow = rows.data.values?.findIndex(row => row[0] === task.id);

            if (existingRow > 0) {
                // Mettre à jour la tâche existante
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${firstName}!A${existingRow + 1}:L${existingRow + 1}`,
                    valueInputOption: 'RAW',
                    resource: { values },
                });
            } else {
                // Ajouter une nouvelle tâche
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: `${firstName}!A:L`,
                    valueInputOption: 'RAW',
                    resource: { values },
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Erreur lors de la synchronisation avec Google Sheets:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = GoogleSheetsSync;
