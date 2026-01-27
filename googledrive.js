/**
 * Google Drive Integration
 * Handles OAuth and file operations for Google Drive
 */

const GoogleDriveManager = {
    // Google API Configuration
    CLIENT_ID: '659407820783-hnlu4hoein0lsa690dp90g1krei76dit.apps.googleusercontent.com',
    API_KEY: 'YOUR_API_KEY',
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',

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

    // Upload or update a file
    async uploadFile(filename, content, type = 'noShow') {
        if (!this.isConnected()) {
            throw new Error('Not connected to Google Drive');
        }

        const folderId = await this.getOrCreateFolder();
        const existingFileId = this.fileIds[type];

        // Check if file exists
        if (existingFileId) {
            try {
                // Update existing file
                await this.updateFileContent(existingFileId, content, filename);
                return { id: existingFileId, updated: true };
            } catch (e) {
                // File might have been deleted, create new
                this.fileIds[type] = null;
            }
        }

        // Search for file by name in folder
        const query = `name='${filename}' and '${folderId}' in parents and trashed=false`;
        const searchResult = await this.apiRequest(
            `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
        );

        if (searchResult.files && searchResult.files.length > 0) {
            // Update existing file
            const fileId = searchResult.files[0].id;
            await this.updateFileContent(fileId, content, filename);
            this.fileIds[type] = fileId;
            this.saveCredentials();
            return { id: fileId, updated: true };
        }

        // Create new file
        const fileId = await this.createFile(filename, content, folderId);
        this.fileIds[type] = fileId;
        this.saveCredentials();
        return { id: fileId, created: true };
    },

    // Create a new file
    async createFile(filename, content, folderId) {
        const metadata = {
            name: filename,
            parents: [folderId],
            mimeType: 'application/vnd.ms-excel'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/vnd.ms-excel' }));

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            },
            body: form
        });

        if (!response.ok) {
            throw new Error('Failed to create file');
        }

        const result = await response.json();
        return result.id;
    },

    // Update file content
    async updateFileContent(fileId, content, filename) {
        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/vnd.ms-excel'
            },
            body: content
        });

        if (!response.ok) {
            throw new Error('Failed to update file');
        }

        return await response.json();
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
