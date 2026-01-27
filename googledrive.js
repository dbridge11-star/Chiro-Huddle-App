/**
 * Google Drive Integration
 * Handles OAuth and file operations for Google Drive
 */

const GoogleDriveManager = {
    // Google API Configuration
    // NOTE: You'll need to create a Google Cloud project and get these credentials
    // 1. Go to https://console.cloud.google.com/
    // 2. Create a new project
    // 3. Enable the Google Drive API
    // 4. Create OAuth 2.0 credentials (Web application)
    // 5. Add your domain to authorized JavaScript origins
    // 6. Replace CLIENT_ID below with your client ID
    CLIENT_ID: '659407820783-hnlu4hoein0lsa690dp90g1krei76dit.apps.googleusercontent.com',
',
    API_KEY: 'YOUR_API_KEY', // Optional, for public API calls
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',

    // State
    isInitialized: false,
    isSignedIn: false,
    tokenClient: null,
    accessToken: null,
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
            script.onload = () => {
                this.initTokenClient();
                this.isInitialized = true;
                this.loadStoredCredentials();
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
                this.saveCredentials();
                this.onSignInChange(true);
            },
        });
    },

    // Load stored credentials
    loadStoredCredentials() {
        try {
            const stored = localStorage.getItem('chiro_gdrive_config');
            if (stored) {
                const config = JSON.parse(stored);
                this.folderId = config.folderId;
                this.fileIds = config.fileIds || {};
                // Note: Access token is not stored for security
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

        // Request access token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    // Sign out
    signOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
        }
        this.accessToken = null;
        this.isSignedIn = false;
        localStorage.removeItem('chiro_gdrive_config');
        this.onSignInChange(false);
    },

    // Check if connected (has valid token)
    isConnected() {
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
                // Token expired, need to re-authorize
                this.isSignedIn = false;
                this.accessToken = null;
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
