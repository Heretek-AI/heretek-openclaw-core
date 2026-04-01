/**
 * Heretek OpenClaw — Ledger Auditor
 * ==============================================================================
 * Audits consensus ledger entries and integrity.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LedgerAuditor {
    constructor(config = {}) {
        this.ledgerDir = config.ledgerDir || '/app/ledger';
    }

    /**
     * Audit ledger
     * @param {Object} options - Audit options
     * @returns {Promise<Object>} Audit result
     */
    async audit(options = {}) {
        const { verify = false, search = null, since = null } = options;
        
        const result = {
            timestamp: new Date().toISOString(),
            summary: await this.getSummary(),
            entries: [],
            integrity: {
                verified: false,
                issues: []
            }
        };

        // Get entries
        result.entries = await this.getEntries({ since, search });

        // Verify integrity if requested
        if (verify) {
            result.integrity = await this.verifyIntegrity();
        }

        return result;
    }

    /**
     * Get ledger summary
     */
    async getSummary() {
        const summary = {
            totalEntries: 0,
            proposals: 0,
            votes: 0,
            decisions: 0,
            lastEntry: null,
            firstEntry: null
        };

        const ledgerFile = path.join(this.ledgerDir, 'ledger.jsonl');
        
        if (!fs.existsSync(ledgerFile)) {
            return summary;
        }

        const content = fs.readFileSync(ledgerFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                summary.totalEntries++;
                
                if (entry.type === 'proposal') summary.proposals++;
                else if (entry.type === 'vote') summary.votes++;
                else if (entry.type === 'decision') summary.decisions++;

                const entryTime = new Date(entry.timestamp);
                
                if (!summary.firstEntry || entryTime < new Date(summary.firstEntry)) {
                    summary.firstEntry = entry.timestamp;
                }
                if (!summary.lastEntry || entryTime > new Date(summary.lastEntry)) {
                    summary.lastEntry = entry.timestamp;
                }
            } catch (error) {
                // Skip invalid entries
            }
        }

        return summary;
    }

    /**
     * Get ledger entries
     */
    async getEntries(options = {}) {
        const { since = null, search = null, limit = 100 } = options;
        const entries = [];

        const ledgerFile = path.join(this.ledgerDir, 'ledger.jsonl');
        
        if (!fs.existsSync(ledgerFile)) {
            return entries;
        }

        const content = fs.readFileSync(ledgerFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        const sinceTime = since ? new Date(since).getTime() : 0;

        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                const entryTime = new Date(entry.timestamp).getTime();

                // Filter by time
                if (entryTime < sinceTime) continue;

                // Filter by search
                if (search && !JSON.stringify(entry).toLowerCase().includes(search.toLowerCase())) {
                    continue;
                }

                entries.push(entry);

                if (entries.length >= limit) break;
            } catch (error) {
                // Skip invalid entries
            }
        }

        return entries.reverse(); // Most recent first
    }

    /**
     * Verify ledger integrity
     */
    async verifyIntegrity() {
        const result = {
            verified: true,
            issues: [],
            checksums: {
                valid: 0,
                invalid: 0
            }
        };

        const ledgerFile = path.join(this.ledgerDir, 'ledger.jsonl');
        const checksumFile = path.join(this.ledgerDir, 'ledger.checksums');

        if (!fs.existsSync(ledgerFile)) {
            result.issues.push({
                severity: 'critical',
                message: 'Ledger file not found'
            });
            result.verified = false;
            return result;
        }

        // Calculate current checksum
        const content = fs.readFileSync(ledgerFile, 'utf8');
        const currentChecksum = this.calculateChecksum(content);

        // Compare with stored checksum if available
        if (fs.existsSync(checksumFile)) {
            const storedChecksum = fs.readFileSync(checksumFile, 'utf8').trim();
            
            if (currentChecksum !== storedChecksum) {
                result.issues.push({
                    severity: 'critical',
                    message: 'Checksum mismatch - ledger may have been tampered with',
                    expected: storedChecksum,
                    actual: currentChecksum
                });
                result.verified = false;
                result.checksums.invalid++;
            } else {
                result.checksums.valid++;
            }
        }

        // Verify entry chain integrity
        const chainResult = await this.verifyChainIntegrity();
        if (!chainResult.valid) {
            result.issues.push(...chainResult.issues);
            result.verified = false;
        }

        return result;
    }

    /**
     * Verify chain integrity (hash chain)
     */
    async verifyChainIntegrity() {
        const result = {
            valid: true,
            issues: []
        };

        const ledgerFile = path.join(this.ledgerDir, 'ledger.jsonl');
        
        if (!fs.existsSync(ledgerFile)) {
            return result;
        }

        const content = fs.readFileSync(ledgerFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        let previousHash = null;

        for (let i = 0; i < lines.length; i++) {
            try {
                const entry = JSON.parse(lines[i]);
                
                // Check previous hash linkage
                if (entry.previousHash && previousHash && entry.previousHash !== previousHash) {
                    result.valid = false;
                    result.issues.push({
                        severity: 'critical',
                        entry: i,
                        message: 'Hash chain broken',
                        expected: previousHash,
                        actual: entry.previousHash
                    });
                }

                // Calculate hash for next iteration
                previousHash = entry.hash || this.calculateChecksum(lines[i]);
                
            } catch (error) {
                result.issues.push({
                    severity: 'error',
                    entry: i,
                    message: `Parse error: ${error.message}`
                });
            }
        }

        return result;
    }

    /**
     * Calculate checksum
     */
    calculateChecksum(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Scan for ledger corruption
     */
    async scanForCorruption() {
        const result = {
            timestamp: new Date().toISOString(),
            corruptionDetected: false,
            issues: []
        };

        const ledgerFile = path.join(this.ledgerDir, 'ledger.jsonl');
        
        if (!fs.existsSync(ledgerFile)) {
            return result;
        }

        const content = fs.readFileSync(ledgerFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        let invalidEntries = 0;

        for (let i = 0; i < lines.length; i++) {
            try {
                JSON.parse(lines[i]);
            } catch (error) {
                invalidEntries++;
                result.corruptionDetected = true;
                result.issues.push({
                    line: i + 1,
                    type: 'invalid_json',
                    description: error.message
                });
            }
        }

        if (invalidEntries > 0) {
            result.issues.push({
                type: 'summary',
                message: `${invalidEntries} invalid entries found out of ${lines.length}`
            });
        }

        return result;
    }

    /**
     * Export ledger
     */
    async export(outputPath) {
        const exportPath = path.join(outputPath, 'ledger');
        
        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath, { recursive: true });
        }

        const result = {
            outputPath: exportPath,
            files: []
        };

        // Copy ledger files
        if (fs.existsSync(this.ledgerDir)) {
            const files = fs.readdirSync(this.ledgerDir);
            
            for (const file of files) {
                const srcPath = path.join(this.ledgerDir, file);
                const dstPath = path.join(exportPath, file);
                
                if (fs.statSync(srcPath).isFile()) {
                    fs.copyFileSync(srcPath, dstPath);
                    result.files.push(file);
                }
            }
        }

        return result;
    }
}

module.exports = LedgerAuditor;
