// scripts/stix-utils.js
const crypto = require("crypto");

class STIXConverter {
    /**
     * Generate RFC 4122 compliant UUID for STIX objects
     */
    static generateUUID() {
        return crypto.randomUUID();
    }

    /**
     * Detect IOC type and generate appropriate STIX pattern
     */
    static detectPattern(ioc) {
        // IP address pattern
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc)) {
            return `[ipv4-addr:value = '${ioc}']`;
        }
        
        // Domain pattern
        if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(ioc)) {
            return `[domain-name:value = '${ioc}']`;
        }
        
        // Hash pattern (MD5, SHA1, SHA256)
        if (/^[a-fA-F0-9]{32}$/.test(ioc)) {
            return `[file:hashes.MD5 = '${ioc}']`;
        }
        if (/^[a-fA-F0-9]{40}$/.test(ioc)) {
            return `[file:hashes.'SHA-1' = '${ioc}']`;
        }
        if (/^[a-fA-F0-9]{64}$/.test(ioc)) {
            return `[file:hashes.'SHA-256' = '${ioc}']`;
        }
        
        // Default to domain
        return `[domain-name:value = '${ioc}']`;
    }

    /**
     * Convert flat IOC array to STIX 2.1 indicator objects
     */
    static convertToSTIX(flatIOCs, metadata = {}) {
        const now = new Date().toISOString();
        
        const stixBundle = {
            type: "bundle",
            id: `bundle--${this.generateUUID()}`,
            objects: flatIOCs.map(ioc => ({
                type: "indicator",
                spec_version: "2.1",
                id: `indicator--${this.generateUUID()}`,
                created: now,
                modified: now,
                name: `Malicious IOC: ${ioc}`,
                description: metadata.description || "Indicator of Compromise from decentralized CTI platform",
                pattern: this.detectPattern(ioc),
                pattern_type: "stix",
                valid_from: now,
                labels: metadata.tags || ["malicious-activity"],
                confidence: this.mapConfidence(metadata.confidence),
                created_by_ref: metadata.source ? `identity--${this.generateUUID()}` : undefined
            }))
        };

        // Add identity object if source provided
        if (metadata.source) {
            stixBundle.objects.unshift({
                type: "identity",
                spec_version: "2.1",
                id: `identity--${this.generateUUID()}`,
                created: now,
                modified: now,
                name: metadata.source,
                identity_class: "organization"
            });
        }

        return stixBundle;
    }

    /**
     * Map confidence levels to STIX numeric values
     */
    static mapConfidence(confidence) {
        const confidenceMap = {
            'low': 30,
            'medium': 50,
            'high': 85,
            'very-high': 95
        };
        return confidenceMap[confidence] || 50;
    }

    /**
     * Extract flat IOCs from STIX bundle - CORRECTED VERSION
     */
    static extractIOCsFromSTIX(stixBundle) {
        const iocs = [];
        
        if (stixBundle.objects) {
            stixBundle.objects.forEach(obj => {
                if (obj.type === 'indicator' && obj.pattern) {
                    // Updated regex to capture the last quoted value in the pattern
                    // This handles both simple and complex patterns like file:hashes.'SHA-256'
                    const matches = obj.pattern.match(/'([^']+)'/g);
                    if (matches && matches.length > 0) {
                        // Get the last match (the actual IOC value)
                        const lastMatch = matches[matches.length - 1];
                        const iocValue = lastMatch.replace(/'/g, '');
                        iocs.push(iocValue);
                    }
                }
            });
        }
        
        return iocs;
    }

    /**
     * Validate STIX 2.1 object structure
     */
    static validateSTIX(stixObj) {
        const requiredFields = ['type', 'spec_version', 'id', 'created', 'modified'];
        
        if (!stixObj || typeof stixObj !== 'object') {
            return { valid: false, error: 'Invalid STIX object' };
        }

        for (const field of requiredFields) {
            if (!stixObj[field]) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }

        // Check spec version
        if (stixObj.spec_version !== '2.1') {
            return { valid: false, error: 'Only STIX 2.1 supported' };
        }

        return { valid: true };
    }
}

module.exports = { STIXConverter };
