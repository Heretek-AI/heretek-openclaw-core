/**
 * Heretek OpenClaw — Integrity Scanner
 * ==============================================================================
 * Scans for data corruption and validates integrity.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class IntegrityScanner {
    constructor(config = {}) {
        this.workspaceRoot = config.workspaceRoot || '/app';
        this.backupDir = config.backupDir || '/app/backups';
        this.stateDir = config.stateDir || path.join(this.workspaceRoot, 'state');
        this.memoryDir = config.memoryDir || path.join(this.workspaceRoot, 'memory');
        this.ledgerDir = config.ledgerDir || path.join(this.workspaceRoot, 'ledger');
    }

    /**
     * Scan for corruption
     * @param {Object} options - Scan options
     * @returns {Promise<Object>} Scan result
     */
    async scan(options = {}) {
        const { component = 'all', full = false, detailed = false } = options;
        
        const result = {
            timestamp: new Date().toISOString(),
            component: component,
            corruptionDetected: false,
            issues: [],
            summary: {}
        };

        if (component === 'all' || component === 'memory') {
            const memoryScan = await this.scanMemory({ detailed });
            result.summary.memory = memoryScan.summary;
            if (memoryScan.corruptionDetected) {
                result.corruptionDetected = true;
                result.issues.push(...memoryScan.issues);
            }
        }

        if (component === 'all' || component === 'ledger') {
            const ledgerScan = await this.scanLedger({ detailed });
            result.summary.ledger = ledgerScan.summary;
            if (ledgerScan.corruptionDetected) {
                result.corruptionDetected = true;
                result.issues.push(...ledgerScan.issues);
            }
        }

        if (component === 'all' || component === 'workspace') {
            const workspaceScan = await this.scanWorkspace({ detailed });
            result.summary.workspace = workspaceScan.summary;
            if (workspaceScan.corruptionDetected) {
                result.corruptionDetected = true;
                result.issues.push(...workspaceScan.issues);
            }
        }

        if (full) {
            result.fullScan = true;
            result.summary.totalFiles = 
                (result.summary.memory?.files || 0) +
                (result.summary.ledger?.files || 0) +
                (result.summary.workspace?.files || 0);
        }

        return result;
    }

    /**
     * Scan memory for corruption
     */
    async scanMemory(options = {}) {
        const result = {
            corruptionDetected: false,
            issues: [],
            summary: { files: 0, corrupted: 0, valid: 0 }
        };

        if (!fs.existsSync(this.memoryDir)) {
            return result;
        }

        const files = this.walkDirectory(this.memoryDir);
        result.summary.files = files.length;

        for (const file of files) {
            const check = await this.checkFileIntegrity(file);
            result.summary.valid++;
            
            if (check.corrupted) {
                result.corruptionDetected = true;
                result.summary.corrupted++;
                result.issues.push({
                    component: 'memory',
                    file: path.relative(this.workspaceRoot, file),
                    type: check.type,
                    severity: check.severity,
                    description: check.description
                });
            }
        }

        return result;
    }

    /**
     * Scan ledger for corruption
     */
    async scanLedger(options = {}) {
        const result = {
            corruptionDetected: false,
            issues: [],
            summary: { files: 0, entries: 0, corrupted: 0, valid: 0 }
        };

        const ledgerFile = path.join(this.ledgerDir, 'ledger.jsonl');
        
        if (!fs.existsSync(ledgerFile)) {
            return result;
        }

        result.summary.files = 1;
        
        const content = fs.readFileSync(ledgerFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        result.summary.entries = lines.length;

        let previousHash = null;
        for (let i = 0; i < lines.length; i++) {
            try {
                const entry = JSON.parse(lines[i]);
                result.summary.valid++;

                // Check hash chain
                if (entry.previousHash && previousHash && entry.previousHash !== previousHash) {
                    result.corruptionDetected = true;
                    result.issues.push({
                        component: 'ledger',
                        type: 'hash_chain_broken',
                        severity: 'critical',
                        entry: i,
                        description: 'Hash chain integrity broken'
                    });
                }

                previousHash = entry.hash || this.calculateHash(lines[i]);
                
            } catch (error) {
                result.corruptionDetected = true;
                result.summary.corrupted++;
                result.issues.push({
                    component: 'ledger',
                    type: 'invalid_json',
                    severity: 'error',
                    entry: i,
                    description: error.message
                });
            }
        }

        return result;
    }

    /**
     * Scan workspace for corruption
     */
    async scanWorkspace(options = {}) {
        const result = {
            corruptionDetected: false,
            issues: [],
            summary: { files: 0, corrupted: 0, valid: 0 }
        };

        const directories = [
            this.stateDir,
            path.join(this.workspaceRoot, 'config'),
            path.join(this.workspaceRoot, 'collective')
        ];

        for (const dir of directories) {
            if (!fs.existsSync(dir)) continue;
            
            const files = this.walkDirectory(dir);
            result.summary.files += files.length;

            for (const file of files) {
                const check = await this.checkFileIntegrity(file);
                result.summary.valid++;
                
                if (check.corrupted) {
                    result.corruptionDetected = true;
                    result.summary.corrupted++;
                    result.issues.push({
                        component: 'workspace',
                        file: path.relative(this.workspaceRoot, file),
                        type: check.type,
                        severity: check.severity,
                        description: check.description
                    });
                }
            }
        }

        return result;
    }

    /**
     * Check file integrity
     */
    async checkFileIntegrity(filePath) {
        const result = {
            corrupted: false,
            type: null,
            severity: 'info',
            description: null
        };

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const stats = fs.statSync(filePath);

            // Check for empty file
            if (content.length === 0) {
                result.corrupted = true;
                result.type = 'empty_file';
                result.severity = 'warning';
                result.description = 'File is empty';
                return result;
            }

            // Check for truncation
            if (content.length < 10 && filePath.endsWith('.json')) {
                result.corrupted = true;
                result.type = 'truncation';
                result.severity = 'error';
                result.description = 'File appears truncated';
                return result;
            }

            // Check for JSON validity
            if (filePath.endsWith('.json')) {
                try {
                    JSON.parse(content);
                } catch (error) {
                    result.corrupted = true;
                    result.type = 'invalid_json';
                    result.severity = 'error';
                    result.description = `JSON parse error: ${error.message}`;
                    return result;
                }
            }

            // Check for null bytes
            if (content.includes('\0')) {
                result.corrupted = true;
                result.type = 'null_bytes';
                result.severity = 'error';
                result.description = 'File contains null bytes';
                return result;
            }

            // Check for very old modification time (stale data)
            const now = Date.now();
            const fileAge = now - stats.mtimeMs;
            const oneYear = 365 * 24 * 60 * 60 * 1000;
            
            if (fileAge > oneYear) {
                result.type = 'stale_data';
                result.severity = 'warning';
                result.description = 'File has not been modified in over a year';
            }

        } catch (error) {
            result.corrupted = true;
            result.type = 'read_error';
            result.severity = 'error';
            result.description = error.message;
        }

        return result;
    }

    /**
     * Validate data integrity
     */
    async validate(options = {}) {
        const { component = 'all', full = false } = options;
        
        const result = {
            timestamp: new Date().toISOString(),
            valid: true,
            issues: [],
            checks: {}
        };

        // Run scan and check for issues
        const scanResult = await this.scan({ component, full });
        
        if (scanResult.corruptionDetected) {
            result.valid = false;
            result.issues = scanResult.issues;
        }

        // Additional validation checks
        result.checks = {
            jsonValidity: await this.validateJsonFiles(),
            directoryStructure: await this.validateDirectoryStructure(),
            permissions: await this.validatePermissions()
        };

        // Mark invalid if any check fails
        if (!result.checks.jsonValidity.valid ||
            !result.checks.directoryStructure.valid ||
            !result.checks.permissions.valid) {
            result.valid = false;
        }

        return result;
    }

    /**
     * Validate JSON files
     */
    async validateJsonFiles() {
        const result = { valid: true, issues: [] };
        const directories = [this.memoryDir, this.ledgerDir, this.stateDir];

        for (const dir of directories) {
            if (!fs.existsSync(dir)) continue;
            
            const files = this.walkDirectory(dir);
            for (const file of files) {
                if (file.endsWith('.json') || file.endsWith('.jsonl')) {
                    try {
                        const content = fs.readFileSync(file, 'utf8');
                        if (file.endsWith('.jsonl')) {
                            content.split('\n').filter(l => l).forEach(line => JSON.parse(line));
                        } else {
                            JSON.parse(content);
                        }
                    } catch (error) {
                        result.valid = false;
                        result.issues.push({
                            file: path.relative(this.workspaceRoot, file),
                            error: error.message
                        });
                    }
                }
            }
        }

        return result;
    }

    /**
     * Validate directory structure
     */
    async validateDirectoryStructure() {
        const result = { valid: true, issues: [] };
        const requiredDirs = [
            this.stateDir,
            this.memoryDir,
            this.ledgerDir
        ];

        for (const dir of requiredDirs) {
            if (!fs.existsSync(dir)) {
                result.valid = false;
                result.issues.push({
                    type: 'missing_directory',
                    path: dir
                });
            }
        }

        return result;
    }

    /**
     * Validate permissions
     */
    async validatePermissions() {
        const result = { valid: true, issues: [] };
        
        try {
            // Check write access to state directory
            const testFile = path.join(this.stateDir, '.permission_test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
        } catch (error) {
            result.valid = false;
            result.issues.push({
                type: 'permission_error',
                path: this.stateDir,
                error: error.message
            });
        }

        return result;
    }

    /**
     * Walk directory recursively
     */
    walkDirectory(dir) {
        const results = [];
        
        if (!fs.existsSync(dir)) return results;
        
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
            if (entry === 'node_modules' || entry.startsWith('.')) {
                continue;
            }

            const fullPath = path.join(dir, entry);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                results.push(...this.walkDirectory(fullPath));
            } else {
                results.push(fullPath);
            }
        }
        
        return results;
    }

    /**
     * Calculate hash
     */
    calculateHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
}

module.exports = IntegrityScanner;
