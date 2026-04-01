/**
 * Heretek OpenClaw — Log Analyzer
 * ==============================================================================
 * Intelligent log analysis with pattern detection, correlation, and root cause analysis.
 * 
 * Features:
 *   - Pattern detection for common errors
 *   - Cross-log correlation across agents
 *   - Timeline reconstruction
 *   - Root cause suggestions
 *   - Error categorization
 * 
 * Usage:
 *   const LogAnalyzer = require('./src/index');
 *   const analyzer = new LogAnalyzer({ logDir: '/var/log/openclaw' });
 *   
 *   // Analyze all logs
 *   const results = await analyzer.analyzeAll();
 *   
 *   // Detect patterns
 *   const patterns = await analyzer.detectPatterns();
 *   
 *   // Correlate events
 *   const correlations = await analyzer.correlateEvents();
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const PatternDetector = require('./pattern-detector');
const LogCorrelator = require('./log-correlator');
const TimelineBuilder = require('./timeline-builder');

class LogAnalyzer {
    constructor(config = {}) {
        this.logDir = config.logDir || process.env.OPENCLAW_LOG_DIR || '/var/log/openclaw';
        this.dockerLogs = config.dockerLogs !== false; // Default to using Docker logs
        this.components = config.components || [
            'gateway', 'litellm', 'steward', 'alpha', 'beta', 'gamma',
            'scout', 'artisan', 'guardian', 'dreamer', 'knowledge-ingest'
        ];
        
        // Initialize sub-modules
        this.patternDetector = new PatternDetector();
        this.logCorrelator = new LogCorrelator();
        this.timelineBuilder = new TimelineBuilder();
        
        // Cache for log entries
        this.logCache = new Map();
    }

    /**
     * Analyze all logs
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeAll(options = {}) {
        const { since = '1h', component = null, filter = null } = options;
        
        const results = {
            timestamp: new Date().toISOString(),
            summary: {
                totalEntries: 0,
                errors: 0,
                warnings: 0,
                info: 0
            },
            components: {},
            patterns: [],
            recommendations: []
        };

        const componentsToAnalyze = component ? [component] : this.components;

        for (const comp of componentsToAnalyze) {
            try {
                const logs = await this.getComponentLogs(comp, since);
                const filteredLogs = filter ? this.filterLogs(logs, filter) : logs;
                
                results.components[comp] = {
                    entries: filteredLogs.length,
                    errors: filteredLogs.filter(l => l.level === 'error').length,
                    warnings: filteredLogs.filter(l => l.level === 'warn').length,
                    info: filteredLogs.filter(l => l.level === 'info').length
                };

                results.summary.totalEntries += filteredLogs.length;
                results.summary.errors += results.components[comp].errors;
                results.summary.warnings += results.components[comp].warnings;
                results.summary.info += results.components[comp].info;

            } catch (error) {
                results.components[comp] = {
                    error: error.message
                };
            }
        }

        // Detect patterns
        results.patterns = await this.detectPatterns(options);

        // Generate recommendations
        results.recommendations = this.generateRecommendations(results);

        return results;
    }

    /**
     * Get logs for a component
     */
    async getComponentLogs(component, since = '1h') {
        const cacheKey = `${component}:${since}`;
        
        if (this.logCache.has(cacheKey)) {
            return this.logCache.get(cacheKey);
        }

        let logs = [];

        if (this.dockerLogs) {
            // Get Docker logs
            try {
                const tailCount = this.getTailCount(since);
                const output = execSync(
                    `docker logs heretek-openclaw-core-${component}-1 --tail ${tailCount} 2>&1`,
                    { encoding: 'utf8', timeout: 10000 }
                );
                logs = this.parseDockerLogs(output, component);
            } catch (error) {
                // Container may not exist
                logs = [];
            }
        } else {
            // Get file-based logs
            const logFile = path.join(this.logDir, `${component}.log`);
            if (fs.existsSync(logFile)) {
                logs = this.parseLogFile(logFile, component);
            }
        }

        this.logCache.set(cacheKey, logs);
        return logs;
    }

    /**
     * Parse Docker log output
     */
    parseDockerLogs(output, component) {
        const logs = [];
        const lines = output.split('\n').filter(l => l.trim());

        for (const line of lines) {
            const parsed = this.parseLogLine(line, component);
            if (parsed) {
                logs.push(parsed);
            }
        }

        return logs;
    }

    /**
     * Parse a single log line
     */
    parseLogLine(line, component) {
        // Try to extract timestamp and level
        const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[.\dZ]*)/);
        const levelMatch = line.match(/\b(DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/i);

        return {
            timestamp: timestampMatch ? new Date(timestampMatch[1]) : new Date(),
            level: this.normalizeLevel(levelMatch ? levelMatch[1] : 'info'),
            component: component,
            message: line,
            raw: line
        };
    }

    /**
     * Normalize log level
     */
    normalizeLevel(level) {
        const normalized = level.toLowerCase();
        if (normalized === 'warning') return 'warn';
        if (normalized === 'fatal') return 'error';
        if (normalized === 'debug') return 'info';
        return normalized;
    }

    /**
     * Parse file-based logs
     */
    parseLogFile(filePath, component) {
        const logs = [];
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
            const parsed = this.parseLogLine(line, component);
            if (parsed) {
                logs.push(parsed);
            }
        }

        return logs;
    }

    /**
     * Filter logs by type
     */
    filterLogs(logs, filter) {
        switch (filter) {
            case 'errors':
                return logs.filter(l => l.level === 'error');
            case 'warnings':
                return logs.filter(l => l.level === 'error' || l.level === 'warn');
            case 'info':
                return logs.filter(l => l.level === 'info');
            default:
                return logs;
        }
    }

    /**
     * Get tail count from time specification
     */
    getTailCount(since) {
        if (since.includes('h')) {
            const hours = parseInt(since);
            return Math.min(hours * 1000, 10000);
        } else if (since.includes('m')) {
            const minutes = parseInt(since);
            return Math.min(minutes * 100, 10000);
        }
        return 1000;
    }

    /**
     * Detect patterns in logs
     */
    async detectPatterns(options = {}) {
        const allLogs = [];
        
        for (const [component, logs] of this.logCache) {
            allLogs.push(...logs);
        }

        return this.patternDetector.detect(allLogs, options);
    }

    /**
     * Correlate events across logs
     */
    async correlateEvents(options = {}) {
        const allLogs = [];
        
        for (const [component, logs] of this.logCache) {
            allLogs.push(...logs);
        }

        return this.logCorrelator.correlate(allLogs, options);
    }

    /**
     * Build event timeline
     */
    async buildTimeline(options = {}) {
        const allLogs = [];
        
        for (const [component, logs] of this.logCache) {
            allLogs.push(...logs);
        }

        return this.timelineBuilder.build(allLogs, options);
    }

    /**
     * Analyze root cause
     */
    async analyzeRootCause(options = {}) {
        const patterns = await this.detectPatterns(options);
        const correlations = await this.correlateEvents(options);

        return {
            timestamp: new Date().toISOString(),
            likelyCauses: this.identifyLikelyCauses(patterns, correlations),
            confidence: this.calculateConfidence(patterns, correlations),
            evidence: this.gatherEvidence(patterns, correlations)
        };
    }

    /**
     * Identify likely causes
     */
    identifyLikelyCauses(patterns, correlations) {
        const causes = [];

        // Analyze patterns for common causes
        for (const pattern of patterns) {
            if (pattern.type === 'connection') {
                causes.push({
                    cause: 'Network connectivity issue',
                    confidence: 0.7,
                    evidence: pattern.matches
                });
            } else if (pattern.type === 'timeout') {
                causes.push({
                    cause: 'Service overload or resource exhaustion',
                    confidence: 0.8,
                    evidence: pattern.matches
                });
            } else if (pattern.type === 'authentication') {
                causes.push({
                    cause: 'Authentication/authorization failure',
                    confidence: 0.9,
                    evidence: pattern.matches
                });
            }
        }

        // Analyze correlations
        if (correlations.cascadeFailures) {
            causes.push({
                cause: 'Cascade failure from upstream service',
                confidence: 0.85,
                evidence: correlations.cascadeFailures
            });
        }

        return causes.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(patterns, correlations) {
        const totalSignals = patterns.length + (correlations.events || []).length;
        if (totalSignals === 0) return 0;
        
        const strongSignals = patterns.filter(p => p.confidence > 0.8).length;
        return Math.round((strongSignals / totalSignals) * 100);
    }

    /**
     * Gather evidence
     */
    gatherEvidence(patterns, correlations) {
        const evidence = [];
        
        patterns.forEach(p => {
            evidence.push({
                type: 'pattern',
                description: p.description,
                count: p.count,
                sample: p.sample
            });
        });

        if (correlations.events) {
            correlations.events.slice(0, 5).forEach(e => {
                evidence.push({
                    type: 'correlation',
                    description: e.description,
                    components: e.components
                });
            });
        }

        return evidence;
    }

    /**
     * Categorize errors
     */
    async categorizeErrors() {
        const categories = {
            connection: [],
            authentication: [],
            resource: [],
            configuration: [],
            application: [],
            external: []
        };

        for (const [component, logs] of this.logCache) {
            const errors = logs.filter(l => l.level === 'error');
            
            for (const error of errors) {
                const category = this.patternDetector.categorizeError(error.message);
                categories[category].push({
                    component,
                    message: error.message,
                    timestamp: error.timestamp
                });
            }
        }

        return {
            timestamp: new Date().toISOString(),
            categories,
            summary: {
                connection: categories.connection.length,
                authentication: categories.authentication.length,
                resource: categories.resource.length,
                configuration: categories.configuration.length,
                application: categories.application.length,
                external: categories.external.length
            }
        };
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(results) {
        const recommendations = [];

        if (results.summary.errors > 100) {
            recommendations.push({
                priority: 'high',
                action: 'High error volume detected - investigate immediately',
                command: './scripts/analyze-logs.sh categorize --summary'
            });
        }

        for (const [component, stats] of Object.entries(results.components)) {
            if (stats.errors > 10) {
                recommendations.push({
                    priority: 'medium',
                    action: `Investigate ${component} errors`,
                    command: `./scripts/analyze-logs.sh analyze --component ${component} --filter errors`
                });
            }
        }

        return recommendations;
    }

    /**
     * Clear log cache
     */
    clearCache() {
        this.logCache.clear();
    }
}

// CLI execution
if (require.main === module) {
    const { program } = require('commander');
    
    program
        .name('log-analyzer')
        .description('Intelligent log analysis for OpenClaw')
        .version('1.0.0');
    
    program
        .command('analyze')
        .description('Analyze logs')
        .option('--all', 'Analyze all components')
        .option('--component <name>', 'Specific component')
        .option('--since <time>', 'Time range (e.g., "1h", "30m")')
        .option('--filter <type>', 'Filter (errors|warnings|info)')
        .action(async (options) => {
            const analyzer = new LogAnalyzer();
            const results = await analyzer.analyzeAll(options);
            console.log(JSON.stringify(results, null, 2));
        });
    
    program
        .command('patterns')
        .description('Detect patterns in logs')
        .option('--search <pattern>', 'Search pattern')
        .option('--anomaly-detection', 'Enable anomaly detection')
        .action(async (options) => {
            const analyzer = new LogAnalyzer();
            await analyzer.analyzeAll({ since: options.since || '1h' });
            const patterns = await analyzer.detectPatterns(options);
            console.log(JSON.stringify(patterns, null, 2));
        });
    
    program
        .command('correlate')
        .description('Correlate events across logs')
        .option('--window <duration>', 'Time window')
        .option('--event <type>', 'Event type')
        .action(async (options) => {
            const analyzer = new LogAnalyzer();
            await analyzer.analyzeAll({ since: options.since || '1h' });
            const correlations = await analyzer.correlateEvents(options);
            console.log(JSON.stringify(correlations, null, 2));
        });
    
    program
        .command('timeline')
        .description('Build event timeline')
        .option('--filter <type>', 'Filter events')
        .option('--output <file>', 'Output file')
        .action(async (options) => {
            const analyzer = new LogAnalyzer();
            await analyzer.analyzeAll({ since: options.since || '1h' });
            const timeline = await analyzer.buildTimeline(options);
            
            if (options.output) {
                fs.writeFileSync(options.output, JSON.stringify(timeline, null, 2));
                console.log(`Timeline saved to: ${options.output}`);
            } else {
                console.log(JSON.stringify(timeline, null, 2));
            }
        });
    
    program
        .command('root-cause')
        .description('Analyze root cause')
        .option('--incident <name>', 'Incident name')
        .action(async (options) => {
            const analyzer = new LogAnalyzer();
            await analyzer.analyzeAll({ since: options.since || '2h' });
            const rootCause = await analyzer.analyzeRootCause(options);
            console.log(JSON.stringify(rootCause, null, 2));
        });
    
    program
        .command('categorize')
        .description('Categorize errors')
        .option('--summary', 'Show summary only')
        .option('--report <file>', 'Export report')
        .action(async (options) => {
            const analyzer = new LogAnalyzer();
            await analyzer.analyzeAll({ since: options.since || '1h' });
            const categories = await analyzer.categorizeErrors();
            
            if (options.summary) {
                console.log('Error Summary:');
                Object.entries(categories.summary).forEach(([cat, count]) => {
                    console.log(`  ${cat}: ${count}`);
                });
            } else if (options.report) {
                fs.writeFileSync(options.report, JSON.stringify(categories, null, 2));
                console.log(`Report saved to: ${options.report}`);
            } else {
                console.log(JSON.stringify(categories, null, 2));
            }
        });
    
    program.parse(process.argv);
}

module.exports = LogAnalyzer;
