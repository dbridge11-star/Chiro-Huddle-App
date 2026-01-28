/**
 * Google Drive Integration
 * Handles OAuth and file operations for Google Drive
 * Creates native Google Sheets files
 */

const GoogleDriveManager = {
    // Google API Configuration
    CLIENT_ID: '659407820783-hnlu4hoein0lsa690dp90g1krei76dit.apps.googleusercontent.com',
    API_KEY: 'YOUR_API_KEY',
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    // Updated scopes to include Sheets API
    SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',

    // State
    isInitialized: false,
    isSignedIn: false,
    tokenClient: null,
    accessToken: null,
    tokenExpiry: null,
    folderId: null,
    folderName: 'Chiro Huddle Exports',

    // File IDs for tracking (stored locally) - 7 categories
    fileIds: {
        pmtIssues: null,
        insuranceQuestions: null,
        noAppt: null,
        chargePassdown: null,
        todo24: null,
        chiro180: null,
        insuranceVerify: null
    },

    // Initialize the Google API
    async init() {
        return new Promise((resolve, reject) => {
            // Load the Google Identity Services library
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = async () => {
                this.initTokenClient();
                this.isInitialized = true;
                this.loadStoredCredentials();

                // Try to restore session automatically
                await this.tryRestoreSession();

                resolve(true);
            };
            script.onerror = () => reject(new Error('Failed to load Google API'));
            document.head.appendChild(script);
        });
    },

    // Initialize the token client
    initTokenClient() {
        if (typeof google === 'undefined') return;

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (response) => {
                if (response.error) {
                    console.error('OAuth error:', response);
                    return;
                }
                this.accessToken = response.access_token;
                this.isSignedIn = true;

                // Store token expiry (tokens last ~1 hour, we'll refresh at 50 min)
                this.tokenExpiry = Date.now() + (50 * 60 * 1000);

                this.saveCredentials();
                this.saveSession();
                this.onSignInChange(true);
            },
        });
    },

    // Save session to sessionStorage (persists until browser closes)
    saveSession() {
        try {
            const session = {
                accessToken: this.accessToken,
                tokenExpiry: this.tokenExpiry,
                timestamp: Date.now()
            };
            sessionStorage.setItem('chiro_gdrive_session', JSON.stringify(session));
        } catch (e) {
            console.error('Failed to save session:', e);
        }
    },

    // Try to restore session from sessionStorage
    async tryRestoreSession() {
        try {
            const sessionData = sessionStorage.getItem('chiro_gdrive_session');
            if (!sessionData) return false;

            const session = JSON.parse(sessionData);

            // Check if token is still valid (not expired)
            if (session.tokenExpiry && Date.now() < session.tokenExpiry) {
                this.accessToken = session.accessToken;
                this.tokenExpiry = session.tokenExpiry;

                // Verify the token still works with a test API call
                try {
                    await this.apiRequest('/drive/v3/about?fields=user');
                    this.isSignedIn = true;
                    this.onSignInChange(true);
                    console.log('Google Drive session restored');
                    return true;
                } catch (e) {
                    // Token invalid, clear it
                    this.clearSession();
                    return false;
                }
            } else {
                // Token expired, try silent refresh
                this.clearSession();
                return await this.trySilentRefresh();
            }
        } catch (e) {
            console.error('Failed to restore session:', e);
            return false;
        }
    },

    // Try to silently refresh the token (no popup)
    async trySilentRefresh() {
        if (!this.tokenClient) return false;

        return new Promise((resolve) => {
            try {
                // Use 'none' prompt for silent refresh
                this.tokenClient.requestAccessToken({
                    prompt: '',
                    hint: sessionStorage.getItem('chiro_gdrive_hint') || ''
                });

                // Give it a moment to complete
                setTimeout(() => {
                    resolve(this.isSignedIn);
                }, 1000);
            } catch (e) {
                resolve(false);
            }
        });
    },

    // Clear session data
    clearSession() {
        sessionStorage.removeItem('chiro_gdrive_session');
        this.accessToken = null;
        this.tokenExpiry = null;
        this.isSignedIn = false;
    },

    // Load stored credentials (folder ID, file IDs)
    loadStoredCredentials() {
        try {
            const stored = localStorage.getItem('chiro_gdrive_config');
            if (stored) {
                const config = JSON.parse(stored);
                this.folderId = config.folderId;
                this.fileIds = config.fileIds || {};
            }
        } catch (e) {
            console.error('Failed to load Drive config:', e);
        }
    },

    // Save credentials locally
    saveCredentials() {
        const config = {
            folderId: this.folderId,
            fileIds: this.fileIds
        };
        localStorage.setItem('chiro_gdrive_config', JSON.stringify(config));
    },

    // Sign in callback
    onSignInChange: () => {},

    // Request authorization
    async authorize() {
        if (!this.isInitialized) {
            await this.init();
        }

        if (!this.tokenClient) {
            throw new Error('Google API not initialized. Check your CLIENT_ID.');
        }

        // Request access token with consent prompt
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    // Sign out
    signOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
        }
        this.accessToken = null;
        this.tokenExpiry = null;
        this.isSignedIn = false;
        this.clearSession();
        localStorage.removeItem('chiro_gdrive_config');
        this.onSignInChange(false);
    },

    // Check if connected (has valid token)
    isConnected() {
        // Also check if token is about to expire
        if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
            // Token expired, try to refresh silently
            this.trySilentRefresh();
        }
        return this.isSignedIn && this.accessToken;
    },

    // Create or get the export folder
    async getOrCreateFolder() {
        if (this.folderId) {
            // Verify folder still exists
            try {
                await this.apiRequest(`/drive/v3/files/${this.folderId}?fields=id,name,trashed`);
                return this.folderId;
            } catch (e) {
                // Folder doesn't exist, create new one
                this.folderId = null;
            }
        }

        // Search for existing folder
        const query = `name='${this.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const searchResult = await this.apiRequest(
            `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
        );

        if (searchResult.files && searchResult.files.length > 0) {
            this.folderId = searchResult.files[0].id;
            this.saveCredentials();
            return this.folderId;
        }

        // Create new folder
        const folderMetadata = {
            name: this.folderName,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const folder = await this.apiRequest('/drive/v3/files', {
            method: 'POST',
            body: JSON.stringify(folderMetadata)
        });

        this.folderId = folder.id;
        this.saveCredentials();
        return this.folderId;
    },

    // Upload or update a Google Sheet
    async uploadFile(filename, content, type = 'noShow') {
        if (!this.isConnected()) {
            throw new Error('Not connected to Google Drive');
        }

        const folderId = await this.getOrCreateFolder();
        const existingFileId = this.fileIds[type];

        // Parse the data from content (expecting JSON with headers and rows)
        let sheetData;
        try {
            sheetData = JSON.parse(content);
        } catch (e) {
            console.error('Invalid sheet data format');
            throw new Error('Invalid data format for Google Sheets');
        }

        // Check if file exists
        if (existingFileId) {
            try {
                // Update existing Google Sheet
                await this.updateGoogleSheet(existingFileId, sheetData);
                return { id: existingFileId, updated: true };
            } catch (e) {
                // File might have been deleted, create new
                this.fileIds[type] = null;
            }
        }

        // Search for file by name in folder (without .xlsx extension for Sheets)
        const sheetName = filename.replace('.xlsx', '');
        const query = `name='${sheetName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
        const searchResult = await this.apiRequest(
            `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
        );

        if (searchResult.files && searchResult.files.length > 0) {
            // Update existing Google Sheet
            const fileId = searchResult.files[0].id;
            await this.updateGoogleSheet(fileId, sheetData);
            this.fileIds[type] = fileId;
            this.saveCredentials();
            return { id: fileId, updated: true };
        }

        // Create new Google Sheet
        const fileId = await this.createGoogleSheet(sheetName, sheetData, folderId);
        this.fileIds[type] = fileId;
        this.saveCredentials();
        return { id: fileId, created: true };
    },

    // Create a new Google Sheet
    async createGoogleSheet(title, sheetData, folderId) {
        // First, create an empty spreadsheet
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    title: title
                },
                sheets: [{
                    properties: {
                        title: sheetData.sheetName || 'Data',
                        gridProperties: {
                            frozenRowCount: 1 // Freeze header row
                        }
                    }
                }]
            })
        });

        if (!createResponse.ok) {
            throw new Error('Failed to create Google Sheet');
        }

        const spreadsheet = await createResponse.json();
        const spreadsheetId = spreadsheet.spreadsheetId;

        // Move to the correct folder
        await this.apiRequest(`/drive/v3/files/${spreadsheetId}?addParents=${folderId}&fields=id`, {
            method: 'PATCH'
        });

        // Add data to the sheet
        await this.updateGoogleSheet(spreadsheetId, sheetData);

        // Format the header row
        await this.formatSheetHeader(spreadsheetId, sheetData.headers.length);

        return spreadsheetId;
    },

    // Update a Google Sheet - append new rows instead of replacing
    async updateGoogleSheet(spreadsheetId, sheetData) {
        const { headers, rows, sheetName } = sheetData;
        const sheet = sheetName || 'Data';

        // First, get existing data to check for duplicates
        let existingRows = [];
        try {
            const getResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A:Z`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            if (getResponse.ok) {
                const data = await getResponse.json();
                existingRows = data.values || [];
            }
        } catch (e) {
            console.log('Could not fetch existing data, will write fresh');
        }

        // If sheet is empty, write headers + rows
        if (existingRows.length === 0) {
            const values = [headers, ...rows];
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values })
                }
            );
            if (!response.ok) throw new Error('Failed to write Google Sheet');
            return await response.json();
        }

        // Sheet has data - find new rows to append (avoid duplicates based on timestamp column)
        // Assume last column is timestamp
        const existingTimestamps = new Set(existingRows.slice(1).map(row => row[row.length - 1]));
        const newRows = rows.filter(row => !existingTimestamps.has(row[row.length - 1]));

        if (newRows.length === 0) {
            console.log('No new rows to append');
            return { updatedRows: 0 };
        }

        // Append new rows
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A:Z:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: newRows })
            }
        );

        if (!response.ok) {
            throw new Error('Failed to append to Google Sheet');
        }

        console.log(`Appended ${newRows.length} new rows`);
        return await response.json();
    },

    // Format the header row (bold, colored background)
    async formatSheetHeader(spreadsheetId, columnCount) {
        const requests = [{
            repeatCell: {
                range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: columnCount
                },
                cell: {
                    userEnteredFormat: {
                        backgroundColor: { red: 0.267, green: 0.447, blue: 0.769 }, // Blue header
                        textFormat: {
                            bold: true,
                            foregroundColor: { red: 1, green: 1, blue: 1 } // White text
                        },
                        horizontalAlignment: 'CENTER'
                    }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
        }, {
            updateSheetProperties: {
                properties: {
                    sheetId: 0,
                    gridProperties: {
                        frozenRowCount: 1
                    }
                },
                fields: 'gridProperties.frozenRowCount'
            }
        }, {
            autoResizeDimensions: {
                dimensions: {
                    sheetId: 0,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: columnCount
                }
            }
        }];

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
        });
    },

    // Generic API request
    async apiRequest(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `https://www.googleapis.com${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired, clear session and notify
                this.clearSession();
                this.isSignedIn = false;
                this.onSignInChange(false);
                throw new Error('Session expired. Please reconnect to Google Drive.');
            }
            throw new Error(`API request failed: ${response.status}`);
        }

        return await response.json();
    },

    // Get folder link
    getFolderLink() {
        if (this.folderId) {
            return `https://drive.google.com/drive/folders/${this.folderId}`;
        }
        return null;
    }
};

// Make available globally
window.GoogleDriveManager = GoogleDriveManager;
