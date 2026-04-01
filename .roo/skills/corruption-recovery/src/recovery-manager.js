/**
 * Heretek OpenClaw — Recovery Manager
 * ==============================================================================
 * Orchestrates recovery operations with rollback support.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class RecoveryManager {
    constructor(config = {}) {
        this.workspaceRoot = config.workspaceRoot || '/app';
        this.backupDir = config.backupDir || '/app/backups';
        this.stateDir = config.stateDir || path.join(this.workspaceRoot, 'state');
        this.rollbackDir = config.rollbackDir || path.join(this.stateDir, 'rollback');
    }

    /**
     * Preview recovery
     * @param {string} backupId - Backup ID
     * @param {Object} options - Preview options
     * @returns {Promise<Object>} Preview result
     */
    async preview(backupId, options = {}) {
        const { showDiff = false } = options;
        
        const backupPath = path.join(this.backupDir, backupId);
        
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup not found: ${backupId}`);
        }

        const result = {
            backupId: backupId,
            backupPath: backupPath,
            timestamp: new Date().toISOString(),
            changes: {
                toRestore: [],
                toModify: [],
                toRemove: []
            },
            risk: 'low'
        };

        // Read manifest
        const manifestPath = path.join(backupPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            result.manifest = manifest;
        }

        // Analyze changes
        const components = fs.readdirSync(backupPath).filter(d => 
            fs.statSync(path.join(backupPath, d)).isDirectory()
        );

        for (const component of components) {
            const backupComponentPath = path.join(backupPath, component);
            const targetPath = this.getTargetPath(component);
            
            if (!fs.existsSync(targetPath)) {
                result.changes.toRestore.push({
                    component: component,
                    reason: 'Target does not exist'
                });
            } else {
                // Compare checksums
                const diff = await this.compareDirectories(backupComponentPath, targetPath);
                if (diff.modified.length > 0 || diff.added.length > 0) {
                    result.changes.toModify.push({
                        component: component,
                        modified: diff.modified.length,
                        added: diff.added.length
                    });
                }
            }
        }

        // Calculate risk
        const totalChanges = 
            result.changes.toRestore.length +
            result.changes.toModify.length +
            result.changes.toRemove.length;
        
        if (totalChanges > 100) {
            result.risk = 'high';
        } else if (totalChanges > 20) {
            result.risk = 'medium';
        }

        return result;
    }

    /**
     * Get target path for component
     */
    getTargetPath(component) {
        const paths = {
            memory: path.join(this.workspaceRoot, 'memory'),
            ledger: path.join(this.workspaceRoot, 'ledger'),
            workspace: this.workspaceRoot,
            state: this.stateDir,
            collective: path.join(this.workspaceRoot, 'collective')
        };
        return paths[component] || path.join(this.workspaceRoot, component);
    }

    /**
     * Compare directories
     */
    async compareDirectories(source, target) {
        const result = {
            modified: [],
            added: [],
            removed: [],
            identical: []
        };

        const sourceFiles = this.walkDirectory(source);
        const targetFiles = this.walkDirectory(target);

        const sourceMap = new Map();
        for (const file of sourceFiles) {
            const relPath = path.relative(source, file);
            sourceMap.set(relPath, file);
        }

        const targetMap = new Map();
        for (const file of targetFiles) {
            const relPath = path.relative(target, file);
            targetMap.set(relPath, file);
        }

        // Check for modified and identical
        for (const [relPath, sourceFile] of sourceMap) {
            const targetFile = targetMap.get(relPath);
            
            if (!targetFile) {
                result.added.push(relPath);
            } else {
                const sourceHash = this.calculateFileHash(sourceFile);
                const targetHash = this.calculateFileHash(targetFile);
                
                if (sourceHash === targetHash) {
                    result.identical.push(relPath);
                } else {
                    result.modified.push(relPath);
                }
            }
        }

        // Check for removed
        for (const [relPath, targetFile] of targetMap) {
            if (!sourceMap.has(relPath)) {
                result.removed.push(relPath);
            }
        }

        return result;
    }

    /**
     * Create rollback point
     */
    async createRollbackPoint() {
        const rollbackId = `rollback_${Date.now()}`;
        const rollbackPath = path.join(this.rollbackDir, rollbackId);
        
        fs.mkdirSync(rollbackPath, { recursive: true });

        const manifest = {
            id: rollbackId,
            timestamp: new Date().toISOString(),
            components: []
        };

        // Backup current state
        const components = ['memory', 'ledger', 'state', 'collective'];
        
        for (const component of components) {
            const sourcePath = this.getTargetPath(component);
            const targetPath = path.join(rollbackPath, component);
            
            if (fs.existsSync(sourcePath)) {
                fs.cpSync(sourcePath, targetPath, { recursive: true });
                manifest.components.push(component);
            }
        }

        // Write manifest
        fs.writeFileSync(
            path.join(rollbackPath, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        return {
            id: rollbackId,
            path: rollbackPath,
            components: manifest.components
        };
    }

    /**
     * Execute recovery
     * @param {string} backupId - Backup ID
     * @param {Object} options - Recovery options
     * @returns {Promise<Object>} Recovery result
     */
    async recover(backupId, options = {}) {
        const { component = 'all', validate = true } = options;
        
        const backupPath = path.join(this.backupDir, backupId);
        
        if (!fs.existsSync(backupPath)) {
            return {
                success: false,
                error: `Backup not found: ${backupId}`
            };
        }

        const result = {
            backupId: backupId,
            timestamp: new Date().toISOString(),
            component: component,
            restored: [],
            failed: [],
            success: true
        };

        // Determine components to restore
        const componentsToRestore = component === 'all' 
            ? ['memory', 'ledger', 'state', 'collective']
            : [component];

        // Execute recovery for each component
        for (const comp of componentsToRestore) {
            const sourcePath = path.join(backupPath, comp);
            const targetPath = this.getTargetPath(comp);
            
            if (!fs.existsSync(sourcePath)) {
                result.failed.push({
                    component: comp,
                    reason: 'Component not in backup'
                });
                continue;
            }

            try {
                // Stop services if needed
                await this.stopServices(comp);

                // Restore component
                await this.restoreComponent(sourcePath, targetPath);
                
                result.restored.push(comp);

                // Start services
                await this.startServices(comp);
                
            } catch (error) {
                result.failed.push({
                    component: comp,
                    reason: error.message
                });
                result.success = false;
            }
        }

        // Validate if requested
        if (validate && result.success) {
            const { execSync } = require('child_process');
            try {
                execSync(`node ${__dirname}/index.js validate --component ${component}`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                result.validated = true;
            } catch (error) {
                result.validated = false;
                result.validationError = error.message;
            }
        }

        return result;
    }

    /**
     * Restore component
     */
    async restoreComponent(sourcePath, targetPath) {
        // Ensure target exists
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        // Copy files
        fs.cpSync(sourcePath, targetPath, {
            recursive: true,
            force: true
        });
    }

    /**
     * Stop services for component
     */
    async stopServices(component) {
        // This is a placeholder - actual implementation would depend on deployment
        try {
            // Try to signal services gracefully
            execSync(`pkill -f ".*${component}.*" || true`, { stdio: 'pipe' });
        } catch (error) {
            // Ignore errors - services may not be running
        }
    }

    /**
     * Start services for component
     */
    async startServices(component) {
        // This is a placeholder - actual implementation would depend on deployment
        // Services typically auto-restart or are managed by docker/systemd
    }

    /**
     * Rollback to previous state
     */
    async rollback() {
        // Find latest rollback point
        if (!fs.existsSync(this.rollbackDir)) {
            return {
                success: false,
                error: 'No rollback points available'
            };
        }

        const rollbacks = fs.readdirSync(this.rollbackDir)
            .filter(d => d.startsWith('rollback_'))
            .sort()
            .reverse();

        if (rollbacks.length === 0) {
            return {
                success: false,
                error: 'No rollback points available'
            };
        }

        const latestRollback = rollbacks[0];
        const rollbackPath = path.join(this.rollbackDir, latestRollback);

        // Execute rollback
        const result = await this.recover(latestRollback, {
            component: 'all',
            validate: true
        });

        if (result.success) {
            // Clean up rollback after successful rollback
            fs.rmSync(rollbackPath, { recursive: true, force: true });
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
     * Calculate file hash
     */
    calculateFileHash(filePath) {
        try {
            const content = fs.readFileSync(filePath);
            return crypto.createHash('sha256').update(content).digest('hex');
        } catch (error) {
            return null;
        }
    }
}

module.exports = RecoveryManager;
