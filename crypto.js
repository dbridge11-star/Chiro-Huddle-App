/**
 * Encryption utilities for HIPAA-compliant local storage
 * Uses Web Crypto API for AES-GCM encryption
 */

const CryptoUtils = {
    // Generate a random encryption key
    async generateKey() {
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        return key;
    },

    // Export key to storable format
    async exportKey(key) {
        const exported = await crypto.subtle.exportKey('raw', key);
        return this.arrayBufferToBase64(exported);
    },

    // Import key from stored format
    async importKey(keyData) {
        const keyBuffer = this.base64ToArrayBuffer(keyData);
        return await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    // Derive a key from passcode using PBKDF2
    async deriveKeyFromPasscode(passcode, salt) {
        const encoder = new TextEncoder();
        const passcodeKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(passcode),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passcodeKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        return derivedKey;
    },

    // Encrypt data
    async encrypt(data, key) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoder.encode(JSON.stringify(data))
        );

        return {
            iv: this.arrayBufferToBase64(iv),
            data: this.arrayBufferToBase64(encrypted)
        };
    },

    // Decrypt data
    async decrypt(encryptedData, key) {
        const decoder = new TextDecoder();
        const iv = this.base64ToArrayBuffer(encryptedData.iv);
        const data = this.base64ToArrayBuffer(encryptedData.data);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        return JSON.parse(decoder.decode(decrypted));
    },

    // Hash passcode for verification
    async hashPasscode(passcode, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(passcode + this.arrayBufferToBase64(salt));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return this.arrayBufferToBase64(hashBuffer);
    },

    // Generate random salt
    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16));
    },

    // Utility: ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    // Utility: Base64 to ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
};

// Make available globally
window.CryptoUtils = CryptoUtils;
