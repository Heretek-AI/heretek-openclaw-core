/**
 * Heretek OpenClaw — Memory Inspector
 * ==============================================================================
 * Inspects agent and collective memory state.
 */

const fs = require('fs');
const path = require('path');

class MemoryInspector {
    constructor(config = {}) {
        this.memoryDir = config.memoryDir || '/app/memory';
        this.collectiveDir = config.collectiveDir || '/app/collective';
    }

    /**
     * Inspect agent memory
     * @param {string} agentId - Agent identifier
     * @param {Object} options - Inspection options
     * @returns {Promise<Object>} Inspection result
     */
    async inspect(agentId, options = {}) {
        const { detailed = false } = options;
        
        const result = {
            timestamp: new Date().toISOString(),
            agent: agentId,
            memoryFiles: [],
            summary: {
                totalFiles: 0,
                totalSize: 0,
                oldestEntry: null,
                newestEntry: null
            },
            contents: {}
        };

        // Check agent memory directory
        const agentMemoryDir = path.join(this.memoryDir, agentId);
        
        if (!fs.existsSync(agentMemoryDir)) {
            result.error = `Agent memory directory not found: ${agentMemoryDir}`;
            return result;
        }

        // List memory files
        const files = fs.readdirSync(agentMemoryDir);
        result.summary.totalFiles = files.length;

        for (const file of files) {
            const filePath = path.join(agentMemoryDir, file);
            const stats = fs.statSync(filePath);
            
            result.memoryFiles.push({
                name: file,
                size: stats.size,
                modified: stats.mtime.toISOString()
            });
            
            result.summary.totalSize += stats.size;

            // Update time range
            if (!result.summary.oldestEntry || stats.mtime < new Date(result.summary.oldestEntry)) {
                result.summary.oldestEntry = stats.mtime.toISOString();
            }
            if (!result.summary.newestEntry || stats.mtime > new Date(result.summary.newestEntry)) {
                result.summary.newestEntry = stats.mtime.toISOString();
            }

            // Read contents if detailed
            if (detailed && file.endsWith('.json')) {
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    result.contents[file] = {
                        size: stats.size,
                        keys: Object.keys(content),
                        preview: this.getPreview(content)
                    };
                } catch (error) {
                    result.contents[file] = { error: error.message };
                }
            }
        }

        return result;
    }

    /**
     * Get preview of content
     */
    getPreview(content, maxKeys = 5) {
        const keys = Object.keys(content);
        const preview = {};
        
        for (const key of keys.slice(0, maxKeys)) {
            const value = content[key];
            if (typeof value === 'object' && value !== null) {
                preview[key] = `[Object with ${Object.keys(value).length} keys]`;
            } else if (typeof value === 'string' && value.length > 100) {
                preview[key] = value.substring(0, 100) + '...';
            } else {
                preview[key] = value;
            }
        }
        
        if (keys.length > maxKeys) {
            preview['...'] = `and ${keys.length - maxKeys} more keys`;
        }
        
        return preview;
    }

    /**
     * Get all agents summary
     */
    async getAllAgentsSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            agents: [],
            total: 0,
            active: 0,
            totalSize: 0
        };

        if (!fs.existsSync(this.memoryDir)) {
            return summary;
        }

        const entries = fs.readdirSync(this.memoryDir);
        
        for (const entry of entries) {
            const entryPath = path.join(this.memoryDir, entry);
            if (fs.statSync(entryPath).isDirectory()) {
                const agentSummary = await this.getAgentSummary(entry);
                summary.agents.push({
                    id: entry,
                    ...agentSummary
                });
                summary.total++;
                if (agentSummary.totalFiles > 0) {
                    summary.active++;
                }
                summary.totalSize += agentSummary.totalSize;
            }
        }

        return summary;
    }

    /**
     * Get single agent summary
     */
    async getAgentSummary(agentId) {
        const summary = {
            totalFiles: 0,
            totalSize: 0,
            oldestEntry: null,
            newestEntry: null
        };

        const agentMemoryDir = path.join(this.memoryDir, agentId);
        
        if (!fs.existsSync(agentMemoryDir)) {
            return summary;
        }

        const files = fs.readdirSync(agentMemoryDir);
        summary.totalFiles = files.length;

        for (const file of files) {
            const filePath = path.join(agentMemoryDir, file);
            try {
                const stats = fs.statSync(filePath);
                summary.totalSize += stats.size;
                
                if (!summary.oldestEntry || stats.mtime < new Date(summary.oldestEntry)) {
                    summary.oldestEntry = stats.mtime.toISOString();
                }
                if (!summary.newestEntry || stats.mtime > new Date(summary.newestEntry)) {
                    summary.newestEntry = stats.mtime.toISOString();
                }
            } catch (error) {
                // Skip files we can't stat
            }
        }

        return summary;
    }

    /**
     * Get collective memory summary
     */
    async getCollectiveSummary() {
        const summary = {
            entries: 0,
            size: 0,
            files: []
        };

        if (!fs.existsSync(this.collectiveDir)) {
            return summary;
        }

        const files = fs.readdirSync(this.collectiveDir);
        
        for (const file of files) {
            const filePath = path.join(this.collectiveDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    summary.entries++;
                    summary.size += stats.size;
                    summary.files.push({
                        name: file,
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    });
                }
            } catch (error) {
                // Skip files we can't stat
            }
        }

        return summary;
    }

    /**
     * Get session state
     */
    async getSessionState(options = {}) {
        const { includeHistory = false } = options;
        
        const sessionState = {
            timestamp: new Date().toISOString(),
            activeSessions: [],
            collective: {}
        };

        // Get active session files
        const sessionPattern = /session.*\.json$/;
        
        if (fs.existsSync(this.memoryDir)) {
            const entries = fs.readdirSync(this.memoryDir);
            
            for (const entry of entries) {
                const entryPath = path.join(this.memoryDir, entry);
                if (fs.statSync(entryPath).isDirectory()) {
                    const files = fs.readdirSync(entryPath);
                    const sessionFiles = files.filter(f => sessionPattern.test(f));
                    
                    if (sessionFiles.length > 0) {
                        sessionState.activeSessions.push({
                            agent: entry,
                            sessions: sessionFiles
                        });
                    }
                }
            }
        }

        // Get collective state
        sessionState.collective = await this.getCollectiveSummary();

        // Include history if requested
        if (includeHistory) {
            sessionState.history = await this.getSessionHistory();
        }

        return sessionState;
    }

    /**
     * Get session history
     */
    async getSessionHistory() {
        const history = {
            entries: [],
            total: 0
        };

        // Look for session history files
        const historyPattern = /history.*\.json$/;
        
        if (fs.existsSync(this.memoryDir)) {
            const entries = fs.readdirSync(this.memoryDir);
            
            for (const entry of entries) {
                const entryPath = path.join(this.memoryDir, entry);
                if (fs.statSync(entryPath).isDirectory()) {
                    const files = fs.readdirSync(entryPath);
                    const historyFiles = files.filter(f => historyPattern.test(f));
                    
                    for (const file of historyFiles) {
                        try {
                            const content = JSON.parse(
                                fs.readFileSync(path.join(entryPath, file), 'utf8')
                            );
                            history.entries.push({
                                agent: entry,
                                file: file,
                                timestamp: content.timestamp || 'unknown',
                                entries: content.entries?.length || 0
                            });
                            history.total++;
                        } catch (error) {
                            // Skip invalid files
                        }
                    }
                }
            }
        }

        return history;
    }

    /**
     * Scan for memory corruption
     */
    async scanForCorruption() {
        const result = {
            timestamp: new Date().toISOString(),
            corruptionDetected: false,
            issues: []
        };

        const directories = [this.memoryDir, this.collectiveDir];
        
        for (const dir of directories) {
            if (!fs.existsSync(dir)) continue;
            
            const entries = this.walkDirectory(dir);
            
            for (const entry of entries) {
                if (entry.endsWith('.json')) {
                    const corruptionCheck = await this.checkFileCorruption(entry);
                    if (corruptionCheck.corrupted) {
                        result.corruptionDetected = true;
                        result.issues.push({
                            file: entry,
                            type: corruptionCheck.type,
                            description: corruptionCheck.description
                        });
                    }
                }
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
            try {
                JSON.parse(content);
            } catch (error) {
                result.corrupted = true;
                result.type = 'invalid_json';
                result.description = `JSON parse error: ${error.message}`;
                return result;
            }
            
            // Check for truncation
            if (content.length < 10) {
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
     * Export memory
     */
    async export(outputPath) {
        const exportPath = path.join(outputPath, 'memory');
        
        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath, { recursive: true });
        }

        const result = {
            outputPath: exportPath,
            files: []
        };

        // Copy memory files
        if (fs.existsSync(this.memoryDir)) {
            const entries = fs.readdirSync(this.memoryDir);
            
            for (const entry of entries) {
                const srcPath = path.join(this.memoryDir, entry);
                const dstPath = path.join(exportPath, entry);
                
                if (fs.statSync(srcPath).isDirectory()) {
                    fs.cpSync(srcPath, dstPath, { recursive: true });
                    result.files.push(entry);
                }
            }
        }

        return result;
    }
}

module.exports = MemoryInspector;
