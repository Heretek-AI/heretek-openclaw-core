/**
 * Heretek OpenClaw — Corruption Recovery
 * ==============================================================================
 * Automated corruption detection and recovery for OpenClaw.
 * 
 * Features:
 *   - Integrity scanning
 *   - Automatic backup selection
 *   - Staged recovery procedures
 *   - Post-recovery validation
 *   - Rollback capability
 * 
 * Usage:
 *   const CorruptionRecovery = require('./src/index');
 *   const recovery = new CorruptionRecovery({ backupDir: '/app/backups' });
 *   
 *   // Scan for corruption
 *   const scan = await recovery.scan();
 *   
 *   // Select best backup
 *   const backup = await recovery.selectBackup();
 *   
 *   // Execute recovery
 *   const result = await recovery.recover(backup.id);
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const IntegrityScanner = require('./integrity-scanner');
const BackupSelector = require('./backup-selector');
const RecoveryManager = require('./recovery-manager');

class CorruptionRecovery {
    constructor(config = {}) {
        this.workspaceRoot = config.workspaceRoot || process.env.OPENCLAW_ROOT || '/app';
        this.backupDir = config.backupDir || process.env.BACKUP_DIR || '/app/backups';
        this.stateDir = config.stateDir || path.join(this.workspaceRoot, 'state');
        
        // Initialize sub-modules
        this.scanner = new IntegrityScanner({
            workspaceRoot: this.workspaceRoot,
            backupDir: this.backupDir
        });
        
        this.selector = new BackupSelector({
            backupDir: this.backupDir
        });
        
        this.recoveryManager = new RecoveryManager({
            workspaceRoot: this.workspaceRoot,
            backupDir: this.backupDir,
            stateDir: this.stateDir
        });
        
        // Recovery state
        this.lastRecovery = null;
        this.rollbackAvailable = false;
    }

    /**
     * Scan for corruption
     * @param {Object} options - Scan options
     * @returns {Promise<Object>} Scan result
     */
    async scan(options = {}) {
        const { component = 'all', full = false, detailed = false } = options;
        
        console.log(`Scanning for corruption (${component})...`);
        
        const result = await this.scanner.scan({ component, full, detailed });
        
        if (result.corruptionDetected) {
            console.log(`Corruption detected: ${result.issues.length} issues found`);
        } else {
            console.log('No corruption detected');
        }
        
        return result;
    }

    /**
     * List available backups
     * @param {Object} options - List options
     * @returns {Promise<Array>} Backup list
     */
    async listBackups(options = {}) {
        const { component = null, recent = false, count = 20, validOnly = false } = options;
        
        return this.selector.list({ component, recent, count, validOnly });
    }

    /**
     * Select best backup
     * @param {Object} options - Selection options
     * @returns {Promise<Object>} Selected backup
     */
    async selectBackup(options = {}) {
        const { auto = true, backupId = null, timestamp = null, component = null } = options;
        
        if (auto) {
            return this.selector.selectAuto({ component });
        } else if (backupId) {
            return this.selector.selectById(backupId);
        } else if (timestamp) {
            return this.selector.selectByTimestamp(timestamp);
        }
        
        throw new Error('Must specify auto, backupId, or timestamp');
    }

    /**
     * Preview recovery
     * @param {Object} options - Preview options
     * @returns {Promise<Object>} Preview result
     */
    async preview(options = {}) {
        const { backupId = null, showDiff = false } = options;
        
        if (!backupId) {
            throw new Error('Must specify backupId');
        }
        
        return this.recoveryManager.preview(backupId, { showDiff });
    }

    /**
     * Execute recovery
     * @param {Object} options - Recovery options
     * @returns {Promise<Object>} Recovery result
     */
    async recover(options = {}) {
        const { 
            backupId = null,
            component = 'all',
            auto = false,
            validate = true,
            rollbackEnabled = true
        } = options;
        
        // Select backup if not specified
        let selectedBackup = backupId;
        if (auto || !backupId) {
            const selected = await this.selectBackup({ auto: true, component });
            selectedBackup = selected.id;
        }
        
        if (!selectedBackup) {
            throw new Error('No backup available for recovery');
        }
        
        console.log(`Starting recovery from backup: ${selectedBackup}`);
        
        // Create rollback point
        if (rollbackEnabled) {
            console.log('Creating rollback point...');
            await this.recoveryManager.createRollbackPoint();
            this.rollbackAvailable = true;
        }
        
        // Execute recovery
        const result = await this.recoveryManager.recover(selectedBackup, {
            component,
            validate
        });
        
        // Store recovery state
        this.lastRecovery = {
            id: `recovery_${Date.now()}`,
            backupId: selectedBackup,
            timestamp: new Date().toISOString(),
            component,
            result
        };
        
        if (result.success) {
            console.log('Recovery completed successfully');
        } else {
            console.log(`Recovery failed: ${result.error}`);
            
            if (rollbackEnabled) {
                console.log('Rollback is available');
            }
        }
        
        return result;
    }

    /**
     * Validate recovery
     * @param {Object} options - Validation options
     * @returns {Promise<Object>} Validation result
     */
    async validate(options = {}) {
        const { component = 'all', full = false } = options;
        
        console.log('Validating recovery...');
        
        const result = await this.scanner.validate({ component, full });
        
        if (result.valid) {
            console.log('Validation passed');
        } else {
            console.log(`Validation failed: ${result.issues.length} issues`);
        }
        
        return result;
    }

    /**
     * Rollback last recovery
     * @param {Object} options - Rollback options
     * @returns {Promise<Object>} Rollback result
     */
    async rollback(options = {}) {
        if (!this.rollbackAvailable) {
            throw new Error('No rollback available');
        }
        
        console.log('Rolling back recovery...');
        
        const result = await this.recoveryManager.rollback();
        
        if (result.success) {
            this.lastRecovery = null;
            this.rollbackAvailable = false;
            console.log('Rollback completed successfully');
        }
        
        return result;
    }

    /**
     * Get recovery status
     * @returns {Object} Recovery status
     */
    getStatus() {
        return {
            lastRecovery: this.lastRecovery,
            rollbackAvailable: this.rollbackAvailable,
            backupDir: this.backupDir,
            backupCount: this.selector.getCount()
        };
    }
}

// CLI execution
if (require.main === module) {
    const { program } = require('commander');
    
    program
        .name('corruption-recovery')
        .description('Automated corruption detection and recovery for OpenClaw')
        .version('1.0.0');
    
    program
        .command('scan')
        .description('Scan for corruption')
        .option('--component <name>', 'Component (memory|ledger|workspace|all)')
        .option('--full', 'Full scan')
        .option('--detailed', 'Detailed report')
        .option('--output <file>', 'Output file')
        .action(async (options) => {
            const recovery = new CorruptionRecovery();
            const result = await recovery.scan(options);
            
            if (options.output) {
                fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
                console.log(`Report saved to: ${options.output}`);
            } else {
                console.log(JSON.stringify(result, null, 2));
            }
        });
    
    program
        .command('list')
        .description('List available backups')
        .option('--component <name>', 'Filter by component')
        .option('--recent', 'Show recent backups')
        .option('--count <n>', 'Number of backups', '20')
        .option('--valid-only', 'Show only valid backups')
        .action(async (options) => {
            const recovery = new CorruptionRecovery();
            const backups = await recovery.listBackups(options);
            console.log(JSON.stringify(backups, null, 2));
        });
    
    program
        .command('select')
        .description('Select backup for recovery')
        .option('--auto', 'Auto-select best backup')
        .option('--backup <id>', 'Specific backup ID')
        .option('--timestamp <time>', 'Select by timestamp')
        .action(async (options) => {
            const recovery = new CorruptionRecovery();
            const selected = await recovery.selectBackup(options);
            console.log(JSON.stringify(selected, null, 2));
        });
    
    program
        .command('preview')
        .description('Preview recovery')
        .requiredOption('--backup <id>', 'Backup ID')
        .option('--diff', 'Show diff')
        .action(async (options) => {
            const recovery = new CorruptionRecovery();
            const result = await recovery.preview(options);
            console.log(JSON.stringify(result, null, 2));
        });
    
    program
        .command('recover')
        .description('Execute recovery')
        .option('--backup <id>', 'Backup ID')
        .option('--component <name>', 'Component to recover')
        .option('--auto', 'Auto-select backup')
        .option('--validate', 'Validate after recovery')
        .option('--no-rollback', 'Disable rollback')
        .action(async (options) => {
            const recovery = new CorruptionRecovery();
            const result = await recovery.recover({
                backupId: options.backup,
                component: options.component || 'all',
                auto: options.auto,
                validate: options.validate,
                rollbackEnabled: options.rollback !== false
            });
            console.log(JSON.stringify(result, null, 2));
        });
    
    program
        .command('validate')
        .description('Validate recovery')
        .option('--component <name>', 'Component to validate')
        .option('--full', 'Full validation')
        .action(async (options) => {
            const recovery = new CorruptionRecovery();
            const result = await recovery.validate(options);
            console.log(JSON.stringify(result, null, 2));
        });
    
    program
        .command('rollback')
        .description('Rollback last recovery')
        .action(async () => {
            const recovery = new CorruptionRecovery();
            const result = await recovery.rollback();
            console.log(JSON.stringify(result, null, 2));
        });
    
    program
        .command('status')
        .description('Get recovery status')
        .action(() => {
            const recovery = new CorruptionRecovery();
            console.log(JSON.stringify(recovery.getStatus(), null, 2));
        });
    
    program.parse(process.argv);
}

module.exports = CorruptionRecovery;
