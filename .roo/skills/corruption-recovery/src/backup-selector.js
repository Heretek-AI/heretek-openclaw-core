/**
 * Heretek OpenClaw — Backup Selector
 * ==============================================================================
 * Selects appropriate backups for recovery.
 */

const fs = require('fs');
const path = require('path');

class BackupSelector {
    constructor(config = {}) {
        this.backupDir = config.backupDir || '/app/backups';
        
        // Selection weights
        this.weights = {
            recency: 0.30,
            completeness: 0.25,
            integrity: 0.25,
            size: 0.10,
            age: 0.10
        };
    }

    /**
     * List available backups
     * @param {Object} options - List options
     * @returns {Promise<Array>} Backup list
     */
    async list(options = {}) {
        const { component = null, recent = false, count = 20, validOnly = false } = options;
        
        const backups = [];
        
        if (!fs.existsSync(this.backupDir)) {
            return backups;
        }

        const entries = fs.readdirSync(this.backupDir);
        
        for (const entry of entries) {
            const backupPath = path.join(this.backupDir, entry);
            
            if (!fs.statSync(backupPath).isDirectory()) {
                continue;
            }

            const backup = await this.getBackupInfo(backupPath);
            
            // Filter by component
            if (component && !backup.components.includes(component)) {
                continue;
            }
            
            // Filter by validity
            if (validOnly && !backup.valid) {
                continue;
            }
            
            backups.push(backup);
        }

        // Sort by timestamp (newest first)
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Filter recent
        if (recent) {
            return backups.slice(0, count);
        }

        return backups;
    }

    /**
     * Get backup info
     */
    async getBackupInfo(backupPath) {
        const manifestPath = path.join(backupPath, 'manifest.json');
        const info = {
            id: path.basename(backupPath),
            path: backupPath,
            timestamp: null,
            components: [],
            valid: false,
            size: 0,
            checksum: null,
            score: 0
        };

        // Read manifest if available
        if (fs.existsSync(manifestPath)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                info.timestamp = manifest.timestamp;
                info.components = manifest.components || [];
                info.checksum = manifest.checksum;
                info.size = manifest.size;
                info.valid = manifest.valid !== false;
            } catch (error) {
                info.valid = false;
            }
        } else {
            // Infer from directory structure
            const subdirs = fs.readdirSync(backupPath);
            info.components = subdirs.filter(d => 
                fs.statSync(path.join(backupPath, d)).isDirectory()
            );
            
            // Get timestamp from directory name or mtime
            const stats = fs.statSync(backupPath);
            info.timestamp = stats.mtime.toISOString();
            info.size = this.getDirectorySize(backupPath);
        }

        // Calculate score
        info.score = this.calculateScore(info);

        return info;
    }

    /**
     * Select best backup automatically
     */
    async selectAuto(options = {}) {
        const { component = null } = options;
        
        const backups = await this.list({ validOnly: true });
        
        if (backups.length === 0) {
            throw new Error('No valid backups available');
        }

        // Filter by component if specified
        let candidates = backups;
        if (component) {
            candidates = backups.filter(b => b.components.includes(component));
            if (candidates.length === 0) {
                throw new Error(`No backups available for component: ${component}`);
            }
        }

        // Select highest scored backup
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0];
    }

    /**
     * Select backup by ID
     */
    async selectById(backupId) {
        const backups = await this.list();
        const backup = backups.find(b => b.id === backupId);
        
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }
        
        return backup;
    }

    /**
     * Select backup by timestamp
     */
    async selectByTimestamp(timestamp) {
        const backups = await this.list();
        const targetTime = new Date(timestamp).getTime();
        
        // Find closest backup before or at timestamp
        let closest = null;
        let closestDiff = Infinity;

        for (const backup of backups) {
            const backupTime = new Date(backup.timestamp).getTime();
            const diff = targetTime - backupTime;
            
            // Prefer backups before target time
            if (diff >= 0 && diff < closestDiff) {
                closest = backup;
                closestDiff = diff;
            }
        }

        if (!closest) {
            throw new Error(`No backup found before or at: ${timestamp}`);
        }

        return closest;
    }

    /**
     * Calculate backup score
     */
    calculateScore(backup) {
        let score = 0;

        // Recency score (0-100)
        const now = Date.now();
        const backupTime = new Date(backup.timestamp).getTime();
        const ageHours = (now - backupTime) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 100 - ageHours); // Lose 1 point per hour
        score += recencyScore * this.weights.recency;

        // Completeness score (0-100)
        const expectedComponents = ['memory', 'ledger', 'workspace', 'state'];
        const presentComponents = backup.components.filter(c => expectedComponents.includes(c));
        const completenessScore = (presentComponents.length / expectedComponents.length) * 100;
        score += completenessScore * this.weights.completeness;

        // Integrity score (0-100)
        const integrityScore = backup.valid ? 100 : 0;
        score += integrityScore * this.weights.integrity;

        // Size score (0-100) - prefer reasonable sizes
        const sizeMB = (backup.size || 0) / (1024 * 1024);
        let sizeScore = 50; // Default
        if (sizeMB > 0 && sizeMB < 10000) {
            sizeScore = 100; // Reasonable size
        } else if (sizeMB === 0) {
            sizeScore = 0; // Empty
        } else if (sizeMB > 10000) {
            sizeScore = 50; // Very large, suspicious
        }
        score += sizeScore * this.weights.size;

        // Age score (0-100) - penalize very old backups
        const ageDays = ageHours / 24;
        let ageScore = Math.max(0, 100 - ageDays * 5); // Lose 5 points per day
        score += ageScore * this.weights.age;

        return Math.round(score);
    }

    /**
     * Get directory size
     */
    getDirectorySize(dirPath) {
        let totalSize = 0;
        
        const walk = (dir) => {
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    walk(fullPath);
                } else {
                    totalSize += stats.size;
                }
            }
        };
        
        try {
            walk(dirPath);
        } catch (error) {
            // Ignore errors
        }
        
        return totalSize;
    }

    /**
     * Get backup count
     */
    getCount() {
        if (!fs.existsSync(this.backupDir)) {
            return 0;
        }
        
        return fs.readdirSync(this.backupDir).filter(entry => {
            const fullPath = path.join(this.backupDir, entry);
            return fs.statSync(fullPath).isDirectory();
        }).length;
    }
}

module.exports = BackupSelector;
