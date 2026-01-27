/**
 * Secure Storage Manager
 * Handles encrypted local storage for HIPAA compliance
 */

const StorageManager = {
    encryptionKey: null,
    isInitialized: false,

    // Storage keys
    KEYS: {
        SALT: 'chiro_salt',
        PASSCODE_HASH: 'chiro_passcode_hash',
        ENCRYPTION_KEY: 'chiro_encryption_key',
        HUDDLE_DATA: 'chiro_huddle_data',
        PATIENTS: 'chiro_patients',
        SETTINGS: 'chiro_settings',
        EXPORT_HISTORY: 'chiro_export_history'
    },

    // Check if app is set up (has passcode)
    isSetUp() {
        return localStorage.getItem(this.KEYS.PASSCODE_HASH) !== null;
    },

    // Set up new passcode
    async setupPasscode(passcode) {
        const salt = CryptoUtils.generateSalt();
        const saltBase64 = CryptoUtils.arrayBufferToBase64(salt);

        // Hash the passcode for verification
        const hash = await CryptoUtils.hashPasscode(passcode, salt);

        // Generate encryption key from passcode
        const encryptionKey = await CryptoUtils.deriveKeyFromPasscode(passcode, salt);

        // Store salt and hash
        localStorage.setItem(this.KEYS.SALT, saltBase64);
        localStorage.setItem(this.KEYS.PASSCODE_HASH, hash);

        // Initialize with empty data
        this.encryptionKey = encryptionKey;
        this.isInitialized = true;

        await this.saveData(this.KEYS.HUDDLE_DATA, this.getEmptyHuddleData());
        await this.saveData(this.KEYS.PATIENTS, []);
        await this.saveData(this.KEYS.SETTINGS, this.getDefaultSettings());
        await this.saveData(this.KEYS.EXPORT_HISTORY, []);

        return true;
    },

    // Verify passcode
    async verifyPasscode(passcode) {
        const saltBase64 = localStorage.getItem(this.KEYS.SALT);
        const storedHash = localStorage.getItem(this.KEYS.PASSCODE_HASH);

        if (!saltBase64 || !storedHash) {
            return false;
        }

        const salt = CryptoUtils.base64ToArrayBuffer(saltBase64);
        const hash = await CryptoUtils.hashPasscode(passcode, new Uint8Array(salt));

        if (hash === storedHash) {
            // Derive encryption key
            this.encryptionKey = await CryptoUtils.deriveKeyFromPasscode(passcode, new Uint8Array(salt));
            this.isInitialized = true;
            return true;
        }

        return false;
    },

    // Change passcode
    async changePasscode(oldPasscode, newPasscode) {
        // Verify old passcode first
        if (!await this.verifyPasscode(oldPasscode)) {
            return false;
        }

        // Load all data with old key
        const huddleData = await this.loadData(this.KEYS.HUDDLE_DATA);
        const patients = await this.loadData(this.KEYS.PATIENTS);
        const settings = await this.loadData(this.KEYS.SETTINGS);
        const exportHistory = await this.loadData(this.KEYS.EXPORT_HISTORY);

        // Create new salt and hash
        const salt = CryptoUtils.generateSalt();
        const saltBase64 = CryptoUtils.arrayBufferToBase64(salt);
        const hash = await CryptoUtils.hashPasscode(newPasscode, salt);

        // Generate new encryption key
        const newKey = await CryptoUtils.deriveKeyFromPasscode(newPasscode, salt);

        // Update salt and hash
        localStorage.setItem(this.KEYS.SALT, saltBase64);
        localStorage.setItem(this.KEYS.PASSCODE_HASH, hash);

        // Re-encrypt all data with new key
        this.encryptionKey = newKey;
        await this.saveData(this.KEYS.HUDDLE_DATA, huddleData);
        await this.saveData(this.KEYS.PATIENTS, patients);
        await this.saveData(this.KEYS.SETTINGS, settings);
        await this.saveData(this.KEYS.EXPORT_HISTORY, exportHistory);

        return true;
    },

    // Save encrypted data
    async saveData(key, data) {
        if (!this.encryptionKey) {
            throw new Error('Storage not initialized');
        }

        const encrypted = await CryptoUtils.encrypt(data, this.encryptionKey);
        localStorage.setItem(key, JSON.stringify(encrypted));
    },

    // Load and decrypt data
    async loadData(key) {
        if (!this.encryptionKey) {
            throw new Error('Storage not initialized');
        }

        const stored = localStorage.getItem(key);
        if (!stored) {
            return null;
        }

        try {
            const encrypted = JSON.parse(stored);
            return await CryptoUtils.decrypt(encrypted, this.encryptionKey);
        } catch (e) {
            console.error('Failed to decrypt data:', e);
            return null;
        }
    },

    // Get empty huddle data structure (7 categories for Evening Huddle)
    getEmptyHuddleData() {
        return {
            date: this.getTodayString(),
            // 7 Categories for Evening Huddle
            pmtIssues: [],
            insuranceQuestions: [],
            noAppt: [],
            chargePassdown: [],
            todo24: [],
            chiro180: {},
            insuranceVerify: {}
        };
    },

    // Get default settings
    getDefaultSettings() {
        return {
            lockTimeout: 5, // minutes
            emailRecipient: ''
        };
    },

    // Get today's date string
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    },

    // Lock the app (clear encryption key from memory)
    lock() {
        this.encryptionKey = null;
        this.isInitialized = false;
    },

    // Clear all data
    async clearAllData() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.lock();
    },

    // Export all data (for backup)
    async exportAllData() {
        if (!this.isInitialized) {
            throw new Error('Storage not initialized');
        }

        return {
            huddleData: await this.loadData(this.KEYS.HUDDLE_DATA),
            patients: await this.loadData(this.KEYS.PATIENTS),
            settings: await this.loadData(this.KEYS.SETTINGS),
            exportHistory: await this.loadData(this.KEYS.EXPORT_HISTORY),
            exportDate: new Date().toISOString()
        };
    },

    // ==================== TRACKER HISTORY ====================

    // Get tracker history for a specific type
    async getTrackerHistory(type) {
        const history = await this.loadData(this.KEYS.EXPORT_HISTORY) || {};
        return history[type] || [];
    },

    // Add items to tracker history
    async addToTrackerHistory(type, items) {
        const history = await this.loadData(this.KEYS.EXPORT_HISTORY) || {};

        if (!history[type]) {
            history[type] = [];
        }

        // Add new items with unique IDs to prevent duplicates
        const existingIds = new Set(history[type].map(i => i.id));
        const newItems = items.filter(i => !existingIds.has(i.id));

        history[type] = [...history[type], ...newItems];

        await this.saveData(this.KEYS.EXPORT_HISTORY, history);
        return history[type].length;
    },

    // Get all tracker history
    async getAllTrackerHistory() {
        return await this.loadData(this.KEYS.EXPORT_HISTORY) || {};
    },

    // Clear tracker history for a type (if needed)
    async clearTrackerHistory(type) {
        const history = await this.loadData(this.KEYS.EXPORT_HISTORY) || {};
        if (type) {
            history[type] = [];
        } else {
            // Clear all 7 categories
            history.pmtIssues = [];
            history.insuranceQuestions = [];
            history.noAppt = [];
            history.chargePassdown = [];
            history.todo24 = [];
            history.chiro180 = [];
            history.insuranceVerify = [];
        }
        await this.saveData(this.KEYS.EXPORT_HISTORY, history);
    }
};

// Make available globally
window.StorageManager = StorageManager;
