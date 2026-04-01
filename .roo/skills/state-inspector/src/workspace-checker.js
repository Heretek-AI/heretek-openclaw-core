/**
 * Heretek OpenClaw — Workspace Checker
 * ==============================================================================
 * Checks workspace integrity and file consistency.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WorkspaceChecker {
    constructor(config = {}) {
        this.workspaceRoot = config.workspaceRoot || process.cwd();
        this.stateDir = config.stateDir || path.join(this.workspaceRoot, 'state');
        this.checksumFile = config.checksumFile || path.join(this.stateDir, 'workspace.checksums');
    }

    /**
     * Check workspace integrity
     * @param {Object} options - Check options
     * @returns {Promise<Object>} Integrity check result
     */
    async check(options = {}) {
        const { detailed = false } = options;
        
        const result = {
            timestamp: new Date().toISOString(),
            integrity: 'unknown',
            issues: [],
            summary: {
                totalFiles: 0,
                checkedFiles: 0,
                modifiedFiles: 0,
                missingFiles: 0,
                newFiles: 0
            }
        };

        // Get baseline checksums
        const baseline = await this.loadBaseline();
        
        // Get current state
        const current = await this.getCurrentState();
        
        result.summary.totalFiles = current.length;
        result.summary.checkedFiles = baseline ? baseline.length : 0;

        // Compare with baseline
        if (baseline) {
            const comparison = this.compareStates(baseline, current);
            result.summary.modifiedFiles = comparison.modified.length;
            result.summary.missingFiles = comparison.missing.length;
            result.summary.newFiles = comparison.new.length;

            if (detailed) {
                result.issues.push(...comparison.modified.map(f => ({
                    type: 'modified',
                    file: f.path,
                    expected: f.expectedChecksum,
                    actual: f.actualChecksum
                })));

                result.issues.push(...comparison.missing.map(f => ({
                    type: 'missing',
                    file: f.path
                })));

                result.issues.push(...comparison.new.map(f => ({
                    type: 'new',
                    file: f.path
                })));
            }
        }

        // Determine overall integrity
        if (result.summary.modifiedFiles === 0 && 
            result.summary.missingFiles === 0 &&
            result.summary.newFiles === 0) {
            result.integrity = 'valid';
        } else if (result.summary.modifiedFiles > 10 || result.summary.missingFiles > 5) {
            result.integrity = 'compromised';
        } else {
            result.integrity = 'degraded';
        }

        return result;
    }

    /**
     * Load baseline checksums
     */
    async loadBaseline() {
        if (!fs.existsSync(this.checksumFile)) {
            return null;
        }

        try {
            const content = fs.readFileSync(this.checksumFile, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get current workspace state
     */
    async getCurrentState() {
        const state = [];
        const directories = [
            this.stateDir,
            this.workspaceRoot + '/config',
            this.workspaceRoot + '/memory',
            this.workspaceRoot + '/collective'
        ];

        for (const dir of directories) {
            if (fs.existsSync(dir)) {
                const files = this.walkDirectory(dir);
                for (const file of files) {
                    try {
                        const content = fs.readFileSync(file, 'utf8');
                        state.push({
                            path: path.relative(this.workspaceRoot, file),
                            checksum: this.calculateChecksum(content),
                            size: content.length,
                            modified: fs.statSync(file).mtime.toISOString()
                        });
                    } catch (error) {
                        // Skip unreadable files
                    }
                }
            }
        }

        return state;
    }

    /**
     * Compare two states
     */
    compareStates(baseline, current) {
        const result = {
            modified: [],
            missing: [],
            new: []
        };

        const baselineMap = new Map();
        for (const item of baseline) {
            baselineMap.set(item.path, item);
        }

        const currentMap = new Map();
        for (const item of current) {
            currentMap.set(item.path, item);
        }

        // Check for modified and missing
        for (const [path, baselineItem] of baselineMap) {
            const currentItem = currentMap.get(path);
            
            if (!currentItem) {
                result.missing.push(baselineItem);
            } else if (baselineItem.checksum !== currentItem.checksum) {
                result.modified.push({
                    path: path,
                    expectedChecksum: baselineItem.checksum,
                    actualChecksum: currentItem.checksum
                });
            }
        }

        // Check for new files
        for (const [path, currentItem] of currentMap) {
            if (!baselineMap.has(path)) {
                result.new.push(currentItem);
            }
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
            // Skip node_modules and hidden files
            if (entry === 'node_modules' || entry.startsWith('.')) {
                continue;
            }

            const fullPath = path.join(dir, entry);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                results.push(...this.walkDirectory(fullPath));
            } else if (stats.isFile() && entry.endsWith('.json')) {
                results.push(fullPath);
            }
        }
        
        return results;
    }

    /**
     * Calculate checksum
     */
    calculateChecksum(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Scan for workspace corruption
     */
    async scanForCorruption() {
        const result = {
            timestamp: new Date().toISOString(),
            corruptionDetected: false,
            issues: []
        };

        const directories = [
            this.stateDir,
            path.join(this.workspaceRoot, 'config'),
            path.join(this.workspaceRoot, 'memory'),
            path.join(this.workspaceRoot, 'collective')
        ];

        for (const dir of directories) {
            if (!fs.existsSync(dir)) continue;
            
            const files = this.walkDirectory(dir);
            
            for (const file of files) {
                const corruptionCheck = await this.checkFileCorruption(file);
                if (corruptionCheck.corrupted) {
                    result.corruptionDetected = true;
                    result.issues.push({
                        file: path.relative(this.workspaceRoot, file),
                        type: corruptionCheck.type,
                        description: corruptionCheck.description
                    });
                }
            }
        }

        return result;
    }

    /**
     * Check file for corruption
     */
    async checkFileCorruption(filePath) {
        const result = {
            corrupted: false,
            type: null,
            description: null
        };

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for JSON validity
            if (filePath.endsWith('.json')) {
                try {
                    JSON.parse(content);
                } catch (error) {
                    result.corrupted = true;
                    result.type = 'invalid_json';
                    result.description = `JSON parse error: ${error.message}`;
                    return result;
                }
            }
            
            // Check for truncation
            if (content.length < 2) {
                result.corrupted = true;
                result.type = 'truncation';
                result.description = 'File appears truncated';
            }
            
            // Check for null bytes
            if (content.includes('\0')) {
                result.corrupted = true;
                result.type = 'null_bytes';
                result.description = 'File contains null bytes';
            }
            
        } catch (error) {
            result.corrupted = true;
            result.type = 'read_error';
            result.description = error.message;
        }

        return result;
    }

    /**
     * Save baseline checksums
     */
    async saveBaseline() {
        const current = await this.getCurrentState();
        
        // Ensure state directory exists
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }
        
        fs.writeFileSync(this.checksumFile, JSON.stringify(current, null, 2));
        
        return {
            timestamp: new Date().toISOString(),
            files: current.length,
            checksumFile: this.checksumFile
        };
    }

    /**
     * Export workspace state
     */
    async export(outputPath) {
        const exportPath = path.join(outputPath, 'workspace');
        
        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath, { recursive: true });
        }

        const result = {
            outputPath: exportPath,
            files: []
        };

        // Copy state files
        if (fs.existsSync(this.stateDir)) {
            const files = fs.readdirSync(this.stateDir);
            
            for (const file of files) {
                const srcPath = path.join(this.stateDir, file);
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

module.exports = WorkspaceChecker;
