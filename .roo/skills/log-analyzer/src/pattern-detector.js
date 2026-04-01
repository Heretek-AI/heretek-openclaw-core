/**
 * Heretek OpenClaw — Pattern Detector
 * ==============================================================================
 * Detects error patterns and anomalies in log entries.
 */

class PatternDetector {
    constructor() {
        // Predefined patterns for OpenClaw
        this.patterns = {
            // Connection patterns
            connection: [
                { regex: /WebSocket.*(?:failed|error|closed)/i, description: 'WebSocket connection failure' },
                { regex: /connection.*refused/i, description: 'Connection refused' },
                { regex: /ECONNREFUSED/i, description: 'Connection refused (system)' },
                { regex: /ETIMEDOUT/i, description: 'Connection timeout' },
                { regex: /(?:agent|service).*offline/i, description: 'Agent/service offline' },
                { regex: /lost.*connection/i, description: 'Connection lost' },
                { regex: /network.*unreachable/i, description: 'Network unreachable' }
            ],
            
            // Timeout patterns
            timeout: [
                { regex: /timeout/i, description: 'Timeout occurred' },
                { regex: /timed.*out/i, description: 'Operation timed out' },
                { regex: /deadline.*exceeded/i, description: 'Deadline exceeded' },
                { regex: /response.*slow/i, description: 'Slow response' },
                { regex: /RPC.*timeout/i, description: 'RPC timeout' }
            ],
            
            // Authentication patterns
            authentication: [
                { regex: /(?:auth|authentication).*(?:failed|error)/i, description: 'Authentication failure' },
                { regex: /invalid.*(?:key|token)/i, description: 'Invalid API key or token' },
                { regex: /unauthorized/i, description: 'Unauthorized access' },
                { regex: /403/i, description: 'Forbidden (403)' },
                { regex: /401/i, description: 'Unauthorized (401)' },
                { regex: /permission.*denied/i, description: 'Permission denied' }
            ],
            
            // Resource patterns
            resource: [
                { regex: /out.*of.*memory/i, description: 'Out of memory' },
                { regex: /OOM/i, description: 'OOM killer invoked' },
                { regex: /disk.*(?:full|space)/i, description: 'Disk space issue' },
                { regex: /ENOENT/i, description: 'File not found' },
                { regex: /EMFILE/i, description: 'Too many open files' },
                { regex: /resource.*exhausted/i, description: 'Resource exhausted' }
            ],
            
            // Configuration patterns
            configuration: [
                { regex: /invalid.*config/i, description: 'Invalid configuration' },
                { regex: /missing.*field/i, description: 'Missing required field' },
                { regex: /parse.*error/i, description: 'Parse error' },
                { regex: /JSON.*error/i, description: 'JSON parsing error' },
                { regex: /schema.*validation/i, description: 'Schema validation failed' },
                { regex: /unknown.*option/i, description: 'Unknown option' }
            ],
            
            // Application patterns
            application: [
                { regex: /exception/i, description: 'Exception thrown' },
                { regex: /TypeError/i, description: 'Type error' },
                { regex: /ReferenceError/i, description: 'Reference error' },
                { regex: /null.*pointer/i, description: 'Null pointer' },
                { regex: /undefined/i, description: 'Undefined value' },
                { regex: /skill.*(?:failed|error)/i, description: 'Skill execution failure' }
            ],
            
            // External service patterns
            external: [
                { regex: /provider.*error/i, description: 'Provider error' },
                { regex: /upstream.*error/i, description: 'Upstream service error' },
                { regex: /rate.*limit/i, description: 'Rate limit exceeded' },
                { regex: /429/i, description: 'Too many requests (429)' },
                { regex: /503/i, description: 'Service unavailable (503)' },
                { regex: /502/i, description: 'Bad gateway (502)' }
            ],
            
            // LiteLLM specific patterns
            litellm: [
                { regex: /model.*not.*found/i, description: 'Model not found' },
                { regex: /LiteLLM.*error/i, description: 'LiteLLM error' },
                { regex: /chat.*completion.*error/i, description: 'Chat completion error' },
                { regex: /token.*error/i, description: 'Token error' },
                { regex: /embedding.*error/i, description: 'Embedding error' }
            ],
            
            // Gateway specific patterns
            gateway: [
                { regex: /Gateway.*error/i, description: 'Gateway error' },
                { regex: /RPC.*error/i, description: 'RPC error' },
                { regex: /agent.*not.*registered/i, description: 'Agent not registered' },
                { regex: /message.*queue.*full/i, description: 'Message queue full' },
                { regex: /consensus.*failed/i, description: 'Consensus failed' },
                { regex: /deliberation.*(?:timeout|failed)/i, description: 'Deliberation failure' }
            ]
        };
    }

    /**
     * Detect patterns in log entries
     * @param {Array} logs - Array of log entries
     * @param {Object} options - Detection options
     * @returns {Array} Detected patterns
     */
    detect(logs, options = {}) {
        const { search = null, anomalyDetection = false } = options;
        const detectedPatterns = [];
        const patternCounts = new Map();

        for (const log of logs) {
            const message = log.message || log.raw || '';
            
            // Search filter
            if (search && !message.toLowerCase().includes(search.toLowerCase())) {
                continue;
            }

            // Check against all pattern categories
            for (const [category, patterns] of Object.entries(this.patterns)) {
                for (const pattern of patterns) {
                    if (pattern.regex.test(message)) {
                        const key = `${category}:${pattern.description}`;
                        
                        if (!patternCounts.has(key)) {
                            patternCounts.set(key, {
                                type: category,
                                description: pattern.description,
                                regex: pattern.regex,
                                count: 0,
                                samples: [],
                                firstOccurrence: log.timestamp,
                                lastOccurrence: log.timestamp
                            });
                        }

                        const entry = patternCounts.get(key);
                        entry.count++;
                        if (entry.samples.length < 3) {
                            entry.samples.push({
                                message: log.message,
                                timestamp: log.timestamp,
                                component: log.component
                            });
                        }
                        entry.lastOccurrence = log.timestamp;
                    }
                }
            }
        }

        // Convert to array and add confidence scores
        for (const [key, pattern] of patternCounts) {
            detectedPatterns.push({
                type: pattern.type,
                description: pattern.description,
                count: pattern.count,
                confidence: this.calculateConfidence(pattern.count),
                firstOccurrence: pattern.firstOccurrence,
                lastOccurrence: pattern.lastOccurrence,
                sample: pattern.samples[0]?.message,
                matches: pattern.samples
            });
        }

        // Sort by count and confidence
        detectedPatterns.sort((a, b) => {
            const scoreA = a.count * a.confidence;
            const scoreB = b.count * b.confidence;
            return scoreB - scoreA;
        });

        // Anomaly detection
        if (anomalyDetection) {
            return this.detectAnomalies(detectedPatterns, logs);
        }

        return detectedPatterns;
    }

    /**
     * Calculate confidence score based on count
     */
    calculateConfidence(count) {
        if (count >= 100) return 0.95;
        if (count >= 50) return 0.9;
        if (count >= 20) return 0.8;
        if (count >= 10) return 0.7;
        if (count >= 5) return 0.6;
        return 0.5;
    }

    /**
     * Detect anomalies in patterns
     */
    detectAnomalies(patterns, logs) {
        const anomalies = [];
        
        // Check for sudden spikes in error frequency
        const timeBuckets = this.bucketByTime(logs, '5m');
        
        for (const [bucket, bucketLogs] of timeBuckets) {
            const errorCount = bucketLogs.filter(l => l.level === 'error').length;
            const avgErrorRate = this.calculateAverageErrorRate(timeBuckets);
            
            if (errorCount > avgErrorRate * 3) {
                anomalies.push({
                    type: 'spike',
                    timeWindow: bucket,
                    errorCount: errorCount,
                    averageRate: avgErrorRate,
                    severity: 'high'
                });
            }
        }

        // Check for new error types
        const knownPatterns = patterns.filter(p => p.count > 5);
        const newPatterns = patterns.filter(p => p.count <= 2 && p.type === 'error');
        
        if (newPatterns.length > 0) {
            anomalies.push({
                type: 'new_errors',
                patterns: newPatterns,
                severity: 'medium'
            });
        }

        return { patterns, anomalies };
    }

    /**
     * Bucket logs by time window
     */
    bucketByTime(logs, window = '5m') {
        const buckets = new Map();
        const windowMs = this.parseWindow(window);

        for (const log of logs) {
            const timestamp = new Date(log.timestamp).getTime();
            const bucketStart = Math.floor(timestamp / windowMs) * windowMs;
            const bucketKey = new Date(bucketStart).toISOString();

            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, []);
            }
            buckets.get(bucketKey).push(log);
        }

        return buckets;
    }

    /**
     * Parse time window string to milliseconds
     */
    parseWindow(window) {
        const match = window.match(/(\d+)([mhd])/);
        if (!match) return 300000; // Default 5 minutes

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60000;
            case 'h': return value * 3600000;
            case 'd': return value * 86400000;
            default: return value * 60000;
        }
    }

    /**
     * Calculate average error rate
     */
    calculateAverageErrorRate(timeBuckets) {
        let total = 0;
        let count = 0;

        for (const [, logs] of timeBuckets) {
            total += logs.filter(l => l.level === 'error').length;
            count++;
        }

        return count > 0 ? total / count : 0;
    }

    /**
     * Categorize an error message
     */
    categorizeError(message) {
        for (const [category, patterns] of Object.entries(this.patterns)) {
            for (const pattern of patterns) {
                if (pattern.regex.test(message)) {
                    return category;
                }
            }
        }
        return 'application'; // Default category
    }
}

module.exports = PatternDetector;
