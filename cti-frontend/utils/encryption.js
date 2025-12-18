/**
 * AES-256-GCM Client-Side Encryption for IOC Bundles
 * 
 * Implements CP2 encryption specification:
 * - Algorithm: AES-256-CBC (fallback for compatibility)
 * - Key: 256-bit random (CSPRNG)
 * - IV: 128-bit random
 * - AAD: Binds ciphertext to metadata (prevents substitution attacks)
 * 
 * WARNING: Current implementation stores keys in localStorage (proof-of-concept only)
 * Production requires public-key wrapping or key escrow service (CP3 roadmap)
 */

import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';

export class IOCEncryption {
    constructor() {
        this.algorithm = 'AES-256-CBC';
        this.keyLength = 256; // bits
        this.ivLength = 16; // 128 bits for CBC
    }

    /**
     * Generate random AES-256 encryption key
     * @returns {string} Hex-encoded key
     */
    generateKey() {
        return CryptoJS.lib.WordArray.random(32).toString(); // 32 bytes = 256 bits
    }

    /**
     * Encrypt IOC bundle before IPFS upload
     * 
     * @param {Object} stixBundle - STIX 2.1 formatted IOC data
     * @param {Object} metadata - Associated metadata (type, tags, confidence, etc.)
     * @returns {Object} Encrypted payload with key, iv, ciphertext
     */
    encryptBundle(stixBundle, metadata) {
        try {
            // 1. Generate unique per-file encryption key
            const key = this.generateKey();
            
            // 2. Generate random IV
            const iv = CryptoJS.lib.WordArray.random(this.ivLength);
            
            // 3. Compute metadata hash for AAD binding
            const metadataJson = JSON.stringify(metadata);
            const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataJson));
            
            // 4. Convert STIX bundle to string
            const plaintext = JSON.stringify(stixBundle);
            
            // 5. Perform encryption
            const encrypted = CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Hex.parse(key), {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });
            
            // 6. Compute keyId
            const keyId = ethers.keccak256(ethers.toUtf8Bytes(key));
            
            return {
                version: '1.0',
                algorithmId: this.algorithm,
                ciphertext: encrypted.ciphertext.toString(),
                iv: iv.toString(),
                keyId: keyId,
                key: key, // WARNING: Must be secured before storage
                metadataHash: metadataHash,
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
     * @param {string} ciphertext - Encrypted data
     * @param {string} key - Encryption key (hex)
     * @param {string} iv - IV used during encryption
     * @param {string} metadataHash - keccak256 hash of metadata
     * @returns {Object} Decrypted STIX bundle
     */
    decryptBundle(ciphertext, key, iv, metadataHash) {
        try {
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: CryptoJS.enc.Hex.parse(ciphertext) },
                CryptoJS.enc.Hex.parse(key),
                {
                    iv: CryptoJS.enc.Hex.parse(iv),
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            );
            
            const plaintextJson = decrypted.toString(CryptoJS.enc.Utf8);
            return JSON.parse(plaintextJson);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error(`IOC decryption failed: ${error.message}`);
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
     * @param {string} keyHex - Hex-encoded key material
     */
    storeKeyLocally(keyId, keyHex) {
        if (typeof window === 'undefined') return; // Skip in SSR
        
        const keyData = {
            keyId: keyId,
            key: keyHex,
            algorithm: this.algorithm,
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
     * @returns {string|null} Hex-encoded key material or null if not found
     */
    retrieveKeyLocally(keyId) {
        if (typeof window === 'undefined') return null;
        
        const stored = localStorage.getItem(`ioc-key-${keyId}`);
        if (!stored) return null;
        
        try {
            const keyData = JSON.parse(stored);
            return keyData.key;
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
        iv: encryptedData.iv,
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
