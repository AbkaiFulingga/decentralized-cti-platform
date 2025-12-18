/**
 * AES-256-GCM Client-Side Encryption for IOC Bundles
 * 
 * Implements CP2 encryption specification:
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key: 256-bit random (CSPRNG)
 * - Nonce: 96-bit random (recommended for GCM)
 * - AAD: Binds ciphertext to metadata (prevents substitution attacks)
 * 
 * WARNING: Current implementation stores keys in localStorage (proof-of-concept only)
 * Production requires public-key wrapping or key escrow service (CP3 roadmap)
 */

import { ethers } from 'ethers';

export class IOCEncryption {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256; // bits
        this.nonceLength = 12; // 96 bits (recommended for GCM)
        this.tagLength = 128; // bits (authentication tag)
    }

    /**
     * Generate random AES-256 encryption key
     * @returns {Promise<CryptoKey>} Web Crypto API key object
     */
    async generateKey() {
        // Check if running in browser (not SSR)
        if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
            throw new Error('Web Crypto API not available. This function must run in a browser environment.');
        }
        
        return await window.crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true, // extractable (needed for export/storage)
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt IOC bundle before IPFS upload
     * 
     * @param {Object} stixBundle - STIX 2.1 formatted IOC data
     * @param {Object} metadata - Associated metadata (type, tags, confidence, etc.)
     * @returns {Promise<Object>} Encrypted payload with key, nonce, ciphertext, authTag
     */
    async encryptBundle(stixBundle, metadata) {
        try {
            // Check browser environment first
            if (typeof window === 'undefined') {
                throw new Error('Encryption must run in browser (not SSR)');
            }
            
            if (!window.crypto || !window.crypto.subtle) {
                throw new Error('Web Crypto API not available in this browser');
            }
            
            // 1. Generate unique per-file encryption key
            const key = await this.generateKey();
            
            // 2. Generate random nonce (must be unique for each encryption with same key)
            const nonce = window.crypto.getRandomValues(new Uint8Array(this.nonceLength));
            
            // 3. Compute AAD (Additional Authenticated Data) from metadata
            // This binds ciphertext to metadata, preventing substitution attacks
            const metadataJson = JSON.stringify(metadata);
            const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            const aad = ethers.getBytes(metadataHash);
            
            // 4. Convert STIX bundle to bytes
            const encoder = new TextEncoder();
            const plaintext = encoder.encode(JSON.stringify(stixBundle));
            
            // 5. Perform authenticated encryption
            const ciphertext = await window.crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: nonce,
                    additionalData: aad,
                    tagLength: this.tagLength
                },
                key,
                plaintext
            );
            
            // 6. Export key for storage/transmission
            const exportedKey = await window.crypto.subtle.exportKey('raw', key);
            const keyBytes = new Uint8Array(exportedKey);
            
            // 7. Compute keyId (hash of key, safe to store publicly)
            const keyId = ethers.keccak256(keyBytes);
            
            // 8. Extract authentication tag (last 16 bytes of GCM output)
            const ciphertextArray = new Uint8Array(ciphertext);
            const authTag = ciphertextArray.slice(-16); // GCM tag is last 128 bits
            const ciphertextOnly = ciphertextArray.slice(0, -16);
            
            return {
                version: '1.0',
                algorithmId: 'AES-256-GCM',
                ciphertext: Array.from(ciphertextOnly),
                nonce: Array.from(nonce),
                authTag: Array.from(authTag),
                keyId: keyId,
                key: Array.from(keyBytes), // WARNING: Must be wrapped/secured before storage
                metadataHash: metadataHash, // For AAD verification during decryption
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error(`IOC encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt retrieved IOC bundle from IPFS
     * 
     * @param {Uint8Array|Array} ciphertext - Encrypted data
     * @param {Uint8Array|Array} key - Encryption key (256 bits)
     * @param {Uint8Array|Array} nonce - Nonce used during encryption (96 bits)
     * @param {Uint8Array|Array} authTag - Authentication tag (128 bits)
     * @param {string} metadataHash - keccak256 hash of metadata (for AAD)
     * @returns {Promise<Object>} Decrypted STIX bundle
     */
    async decryptBundle(ciphertext, key, nonce, authTag, metadataHash) {
        try {
            // Check browser environment
            if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
                throw new Error('Web Crypto API not available');
            }
            
            // 1. Convert arrays to Uint8Array if needed
            const ciphertextArray = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext);
            const keyArray = key instanceof Uint8Array ? key : new Uint8Array(key);
            const nonceArray = nonce instanceof Uint8Array ? nonce : new Uint8Array(nonce);
            const authTagArray = authTag instanceof Uint8Array ? authTag : new Uint8Array(authTag);
            
            // 2. Reconstruct full ciphertext (data + tag)
            const fullCiphertext = new Uint8Array(ciphertextArray.length + authTagArray.length);
            fullCiphertext.set(ciphertextArray);
            fullCiphertext.set(authTagArray, ciphertextArray.length);
            
            // 3. Import key
            const importedKey = await window.crypto.subtle.importKey(
                'raw',
                keyArray,
                {
                    name: this.algorithm,
                    length: this.keyLength
                },
                false, // not extractable (for decryption only)
                ['decrypt']
            );
            
            // 4. Reconstruct AAD from metadata hash
            const aad = ethers.getBytes(metadataHash);
            
            // 5. Perform authenticated decryption
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: nonceArray,
                    additionalData: aad,
                    tagLength: this.tagLength
                },
                importedKey,
                fullCiphertext
            );
            
            // 6. Convert bytes back to JSON
            const decoder = new TextDecoder();
            const plaintextJson = decoder.decode(decrypted);
            
            return JSON.parse(plaintextJson);
        } catch (error) {
            console.error('Decryption failed:', error);
            // Common causes: wrong key, tampered ciphertext, wrong AAD, expired tag
            throw new Error(`IOC decryption failed: ${error.message}. Possible causes: invalid key, tampered data, or metadata mismatch.`);
        }
    }

    /**
     * Store encryption key in browser localStorage (DEMO ONLY - NOT PRODUCTION SAFE)
     * 
     * WARNING: This is vulnerable to XSS attacks. Production must use:
     * - Option A: Public-key wrapping (encrypt K_ioc with recipient's public key)
     * - Option B: Key escrow service (server-side key storage with auth)
     * - Option C: Hardware wallet encryption (use MetaMask to derive keys)
     * 
     * @param {string} keyId - Hash of encryption key (identifier)
     * @param {Uint8Array|Array} keyBytes - Raw key material
     */
    storeKeyLocally(keyId, keyBytes) {
        if (typeof window === 'undefined') return; // Skip in SSR
        
        const keyArray = keyBytes instanceof Uint8Array ? Array.from(keyBytes) : keyBytes;
        const keyData = {
            keyId: keyId,
            key: keyArray,
            algorithm: this.algorithmId,
            timestamp: Date.now()
        };
        
        // WARNING: localStorage is vulnerable to XSS
        localStorage.setItem(`ioc-key-${keyId}`, JSON.stringify(keyData));
        
        console.warn('⚠️ Encryption key stored in localStorage (DEMO ONLY). Production requires secure key management.');
    }

    /**
     * Retrieve encryption key from localStorage
     * 
     * @param {string} keyId - Hash of encryption key
     * @returns {Uint8Array|null} Raw key material or null if not found
     */
    retrieveKeyLocally(keyId) {
        if (typeof window === 'undefined') return null;
        
        const stored = localStorage.getItem(`ioc-key-${keyId}`);
        if (!stored) return null;
        
        try {
            const keyData = JSON.parse(stored);
            return new Uint8Array(keyData.key);
        } catch (error) {
            console.error('Failed to retrieve key:', error);
            return null;
        }
    }

    /**
     * List all stored encryption keys (for user key management UI)
     * 
     * @returns {Array<Object>} Array of key metadata
     */
    listStoredKeys() {
        if (typeof window === 'undefined') return [];
        
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ioc-key-')) {
                try {
                    const keyData = JSON.parse(localStorage.getItem(key));
                    keys.push({
                        keyId: keyData.keyId,
                        algorithm: keyData.algorithm,
                        timestamp: keyData.timestamp,
                        age: Date.now() - keyData.timestamp
                    });
                } catch (error) {
                    console.error(`Failed to parse key ${key}:`, error);
                }
            }
        }
        return keys;
    }

    /**
     * Delete encryption key from localStorage
     * 
     * @param {string} keyId - Hash of encryption key
     * @returns {boolean} True if key was deleted
     */
    deleteKeyLocally(keyId) {
        if (typeof window === 'undefined') return false;
        
        const key = `ioc-key-${keyId}`;
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            return true;
        }
        return false;
    }
}

/**
 * Utility function: Format encrypted payload for IPFS upload
 * 
 * @param {Object} encryptedData - Output from encryptBundle()
 * @returns {Object} IPFS-ready JSON structure
 */
export function formatForIPFS(encryptedData) {
    return {
        version: encryptedData.version,
        type: 'encrypted-ioc-bundle',
        algorithm: encryptedData.algorithmId,
        ciphertext: encryptedData.ciphertext,
        nonce: encryptedData.nonce,
        authTag: encryptedData.authTag,
        keyId: encryptedData.keyId,
        metadataHash: encryptedData.metadataHash,
        timestamp: encryptedData.timestamp,
        // WARNING: Do NOT include 'key' field in IPFS upload
        // Key must be distributed separately via secure channel
    };
}

/**
 * Utility function: Compute CID commitment for on-chain storage
 * 
 * @param {string} ipfsCid - IPFS Content Identifier (e.g., "QmXyz...")
 * @returns {string} keccak256 hash of CID (bytes32)
 */
export function computeCIDCommitment(ipfsCid) {
    return ethers.keccak256(ethers.toUtf8Bytes(ipfsCid));
}
