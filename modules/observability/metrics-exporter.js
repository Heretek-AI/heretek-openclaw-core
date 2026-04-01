/**
 * Heretek Metrics Exporter - Custom Metrics Module
 * ==============================================================================
 * Custom metrics for agent deliberation, consensus, and consciousness states.
 * 
 * Features:
 *   - Triad deliberation metrics (vote times, consensus rates)
 *   - Consensus ledger metrics (approval rates, steward overrides)
 *   - Consciousness architecture metrics (GWT, IIT, AST aggregation)
 *   - Agent performance metrics (latency, throughput, error rates)
 *   - Cost metrics (per-agent, per-model, per-session)
 *   - Export to Langfuse, Prometheus, or custom endpoints
 * 
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                   Heretek Metrics Exporter                       │
 *   │                                                                  │
 *   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
 *   │  │   Triad      │  │  Consciousness│  │    Agent     │          │
 *   │  │   Metrics    │  │   Metrics     │  │   Metrics    │          │
 *   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
 *   │         │                 │                  │                   │
 *   │         └─────────────────┼──────────────────┘                   │
 *   │                           ▼                                      │
 *   │                  ┌────────────────┐                             │
 *   │                  │  Metrics Store │                             │
 *   │                  │  (Redis/JSON)  │                             │
 *   │                  └───────┬────────┘                             │
 *   │                          │                                      │
 *   │         ┌────────────────┼────────────────┐                     │
 *   │         ▼                ▼                ▼                     │
 *   │  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
 *   │  │  Langfuse  │  │ Prometheus │  │  Dashboard │                │
 *   │  │  Export    │  │  Export    │  │  Sync      │                │
 *   │  └────────────┘  └────────────┘  └────────────┘                │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   const { HeretekMetricsExporter } = require('./modules/observability/metrics-exporter');
 *   
 *   const exporter = new HeretekMetricsExporter({
 *     exportInterval: 60000, // Export every 60 seconds
 *     redisUrl: 'redis://localhost:6379',
 *     langfuseClient: langfuseClient
 *   });
 *   
 *   // Record triad metric
 *   exporter.recordTriadMetric({
 *     sessionId: 'session-123',
 *     proposalId: 'proposal-456',
 *     deliberationTime: 2500,
 *     consensusReached: true,
 *     voteCount: { approve: 2, reject: 1 }
 *   });
 *   
 *   // Record consciousness metric
 *   exporter.recordConsciousnessMetric({
 *     sessionId: 'session-123',
 *     gwtScore: 0.85,
 *     iitScore: 0.72,
 *     astScore: 0.91
 *   });
 *   
 *   // Get aggregated metrics
 *   const metrics = await exporter.getAggregatedMetrics('triad', '1h');
 * ==============================================================================
 */

const EventEmitter = require('events');

/**
 * Metric Types supported by the exporter
 * @enum {string}
 */
const MetricType = {
    TRIAD_DELIBERATION: 'triad-deliberation',
    CONSENSUS_LEDGER: 'consensus-ledger',
    CONSCIOUSNESS: 'consciousness',
    AGENT_PERFORMANCE: 'agent-performance',
    COST: 'cost',
    LATENCY: 'latency',
    THROUGHPUT: 'throughput',
    ERROR: 'error'
};

/**
 * Aggregation Periods
 * @enum {string}
 */
const AggregationPeriod = {
    REALTIME: 'realtime',
    MINUTE: '1m',
    HOUR: '1h',
    DAY: '1d',
    WEEK: '1w',
    MONTH: '1M'
};

/**
 * Heretek Metrics Exporter Configuration
 * @typedef {Object} MetricsExporterConfig
 * @property {string} [redisUrl] - Redis URL for metrics storage
 * @property {Object} [langfuseClient] - Langfuse client for export
 * @property {number} [exportInterval=60000] - Export interval in ms
 * @property {boolean} [enabled=true] - Enable/disable metrics
 * @property {string} [mode='production'] - Mode: production, staging, development
 * @property {boolean} [debug=false] - Debug logging
 */

/**
 * Triad Deliberation Metric
 * @typedef {Object} TriadMetric
 * @property {string} sessionId - Session identifier
 * @property {string} proposalId - Proposal identifier
 * @property {number} deliberationTime - Time to reach consensus (ms)
 * @property {boolean} consensusReached - Whether consensus was reached
 * @property {Object} voteCount - Vote counts {approve, reject, abstain}
 * @property {boolean} [stewardOverride] - Whether steward override was used
 * @property {number} [timestamp] - Metric timestamp
 */

/**
 * Consciousness Metric
 * @typedef {Object} ConsciousnessMetric
 * @property {string} sessionId - Session identifier
 * @property {number} [gwtScore] - Global Workspace Theory score
 * @property {number} [iitScore] - Integrated Information Theory score
 * @property {number} [astScore] - Attention Schema Theory score
 * @property {number} [compositeScore] - Composite consciousness score
 * @property {string} [consciousnessState] - Consciousness state
 * @property {number} [timestamp] - Metric timestamp
 */

/**
 * Agent Performance Metric
 * @typedef {Object} AgentPerformanceMetric
 * @property {string} agentId - Agent identifier
 * @property {number} responseTime - Response time (ms)
 * @property {number} tokenUsage - Token count
 * @property {number} [cost] - Cost in USD
 * @property {boolean} [success] - Whether operation succeeded
 * @property {string} [operation] - Operation type
 * @property {number} [timestamp] - Metric timestamp
 */

/**
 * Heretek Metrics Exporter Class
 */
class HeretekMetricsExporter extends EventEmitter {
    /**
     * Create metrics exporter instance
     * @param {MetricsExporterConfig} config - Configuration
     */
    constructor(config = {}) {
        super();

        this.config = {
            redisUrl: config.redisUrl || process.env.REDIS_URL,
            langfuseClient: config.langfuseClient,
            exportInterval: config.exportInterval || 60000,
            enabled: config.enabled !== undefined ? config.enabled : true,
            mode: config.mode || 'production',
            debug: config.debug !== undefined ? config.debug : false
        };

        // Internal state
        this.initialized = false;
        this.redisClient = null;
        this.metricsBuffer = new Map();
        this.exportTimer = null;
        this.metricCounters = new Map();

        // Metric schemas for validation
        this.metricSchemas = this._initializeMetricSchemas();

        // Initialize if enabled
        if (this.config.enabled) {
            this._initialize();
        }
    }

    /**
     * Initialize metric schemas for validation
     * @private
     * @returns {Object} Metric schemas
     */
    _initializeMetricSchemas() {
        return {
            [MetricType.TRIAD_DELIBERATION]: {
                required: ['sessionId', 'proposalId', 'deliberationTime', 'consensusReached', 'voteCount'],
                optional: ['stewardOverride', 'timestamp', 'agents', 'topic']
            },
            [MetricType.CONSENSUS_LEDGER]: {
                required: ['sessionId', 'proposalId', 'decision', 'timestamp'],
                optional: ['voteCount', 'stewardOverride', 'ledgerHash']
            },
            [MetricType.CONSCIOUSNESS]: {
                required: ['sessionId'],
                optional: ['gwtScore', 'iitScore', 'astScore', 'compositeScore', 'consciousnessState', 'agentId', 'timestamp']
            },
            [MetricType.AGENT_PERFORMANCE]: {
                required: ['agentId', 'responseTime'],
                optional: ['tokenUsage', 'cost', 'success', 'operation', 'timestamp', 'model']
            },
            [MetricType.COST]: {
                required: ['agentId', 'cost', 'currency'],
                optional: ['model', 'tokenUsage', 'sessionId', 'timestamp']
            },
            [MetricType.LATENCY]: {
                required: ['agentId', 'latency', 'operation'],
                optional: ['sessionId', 'percentile', 'timestamp']
            },
            [MetricType.THROUGHPUT]: {
                required: ['agentId', 'messagesPerSecond'],
                optional: ['sessionId', 'timeWindow', 'timestamp']
            },
            [MetricType.ERROR]: {
                required: ['agentId', 'errorCode', 'errorMessage'],
                optional: ['sessionId', 'operation', 'stackTrace', 'timestamp']
            }
        };
    }

    /**
     * Initialize the metrics exporter
     * @private
     */
    async _initialize() {
        try {
            // Connect to Redis if configured
            if (this.config.redisUrl) {
                const Redis = require('ioredis');
                this.redisClient = new Redis(this.config.redisUrl, {
                    maxRetriesPerRequest: 3,
                    retryDelayOnFailover: 100
                });

                this.redisClient.on('connect', () => {
                    console.log('[HeretekMetrics] Connected to Redis');
                });

                this.redisClient.on('error', (error) => {
                    console.error('[HeretekMetrics] Redis error:', error.message);
                    this.emit('redis-error', error);
                });
            }

            // Start periodic export timer
            if (this.config.exportInterval > 0) {
                this.exportTimer = setInterval(() => {
                    this._exportMetrics();
                }, this.config.exportInterval);
            }

            this.initialized = true;
            console.log(`[HeretekMetrics] Initialized in ${this.config.mode} mode`);
            console.log(`[HeretekMetrics] Export interval: ${this.config.exportInterval}ms`);

        } catch (error) {
            console.error('[HeretekMetrics] Initialization failed:', error.message);
            this.initialized = false;
        }
    }

    /**
     * Shutdown the exporter gracefully
     * @returns {Promise<void>}
     */
    async shutdown() {
        if (this.exportTimer) {
            clearInterval(this.exportTimer);
            this.exportTimer = null;
        }

        // Final export before shutdown
        await this._exportMetrics();

        if (this.redisClient) {
            await this.redisClient.quit();
            this.redisClient = null;
        }

        this.initialized = false;
        console.log('[HeretekMetrics] Shutdown complete');
    }

    /**
     * Validate metric against schema
     * @private
     * @param {string} type - Metric type
     * @param {Object} metric - Metric data
     * @returns {boolean} Is valid
     */
    _validateMetric(type, metric) {
        const schema = this.metricSchemas[type];
        if (!schema) {
            console.warn(`[HeretekMetrics] Unknown metric type: ${type}`);
            return false;
        }

        for (const field of schema.required) {
            if (metric[field] === undefined || metric[field] === null) {
                console.warn(`[HeretekMetrics] Missing required field: ${field}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Store metric in buffer and Redis
     * @private
     * @param {string} type - Metric type
     * @param {Object} metric - Metric data
     */
    _storeMetric(type, metric) {
        const timestamp = metric.timestamp || Date.now();
        const metricKey = `${type}:${timestamp}`;

        // Add to buffer
        if (!this.metricsBuffer.has(type)) {
            this.metricsBuffer.set(type, []);
        }
        this.metricsBuffer.get(type).push({ ...metric, timestamp, _type: type });

        // Store in Redis
        if (this.redisClient) {
            const redisKey = `heretek:metrics:${type}`;
            const redisData = JSON.stringify({ ...metric, timestamp, _type: type });

            // Add to sorted set with timestamp as score
            this.redisClient.zadd(redisKey, timestamp, redisData).catch(err => {
                console.error('[HeretekMetrics] Redis zadd error:', err.message);
            });

            // Keep only last hour of data in Redis
            const oneHourAgo = Date.now() - 3600000;
            this.redisClient.zremrangebyscore(redisKey, 0, oneHourAgo).catch(err => {
                console.error('[HeretekMetrics] Redis cleanup error:', err.message);
            });
        }

        // Update counters
        this._updateCounter(type);

        if (this.config.debug) {
            console.log(`[HeretekMetrics] Stored metric: ${type}`);
        }
    }

    /**
     * Update metric counter
     * @private
     * @param {string} type - Metric type
     */
    _updateCounter(type) {
        const current = this.metricCounters.get(type) || 0;
        this.metricCounters.set(type, current + 1);
    }

    /**
     * Export buffered metrics
     * @private
     */
    async _exportMetrics() {
        if (this.metricsBuffer.size === 0) {
            return;
        }

        const exported = new Map();

        for (const [type, metrics] of this.metricsBuffer) {
            if (metrics.length === 0) continue;

            // Export to Langfuse if configured
            if (this.config.langfuseClient) {
                try {
                    await this._exportToLangfuse(type, metrics);
                    exported.set(type, metrics.length);
                } catch (error) {
                    console.error(`[HeretekMetrics] Langfuse export error for ${type}:`, error.message);
                }
            }

            // Emit export event
            this.emit('export', { type, count: metrics.length });
        }

        // Clear exported buffers
        for (const [type] of exported) {
            this.metricsBuffer.set(type, []);
        }

        if (this.config.debug) {
            console.log('[HeretekMetrics] Exported metrics:', Object.fromEntries(exported));
        }
    }

    /**
     * Export metrics to Langfuse
     * @private
     * @param {string} type - Metric type
     * @param {Array<Object>} metrics - Metrics to export
     */
    async _exportToLangfuse(type, metrics) {
        if (!this.config.langfuseClient) {
            return;
        }

        // Create aggregated trace for this metric type
        const trace = this.config.langfuse.client.trace({
            id: `metrics-${type}-${Date.now()}`,
            name: `metrics-export-${type}`,
            tags: ['metrics', 'export', type],
            metadata: {
                heretek: {
                    metricType: type,
                    exportTime: Date.now(),
                    metricCount: metrics.length
                }
            }
        });

        // Record each metric as an event
        for (const metric of metrics) {
            trace.event({
                name: `metric-${type}`,
                input: metric,
                metadata: {
                    heretek: {
                        exportBatch: true
                    }
                }
            });
        }

        // Add aggregated summary
        const aggregated = this._aggregateMetrics(type, metrics);
        trace.update({
            output: {
                aggregated,
                totalMetrics: metrics.length
            }
        });
    }

    /**
     * Aggregate metrics of a specific type
     * @private
     * @param {string} type - Metric type
     * @param {Array<Object>} metrics - Metrics to aggregate
     * @returns {Object} Aggregated metrics
     */
    _aggregateMetrics(type, metrics) {
        if (metrics.length === 0) {
            return {};
        }

        switch (type) {
            case MetricType.TRIAD_DELIBERATION:
                return this._aggregateTriadMetrics(metrics);
            case MetricType.CONSCIOUSNESS:
                return this._aggregateConsciousnessMetrics(metrics);
            case MetricType.AGENT_PERFORMANCE:
                return this._aggregateAgentMetrics(metrics);
            default:
                return this._aggregateGenericMetrics(metrics);
        }
    }

    /**
     * Aggregate triad metrics
     * @private
     * @param {Array<Object>} metrics - Triad metrics
     * @returns {Object} Aggregated triad metrics
     */
    _aggregateTriadMetrics(metrics) {
        const total = metrics.length;
        const consensusReached = metrics.filter(m => m.consensusReached).length;
        const stewardOverrides = metrics.filter(m => m.stewardOverride).length;
        const avgDeliberationTime = metrics.reduce((sum, m) => sum + m.deliberationTime, 0) / total;

        // Aggregate vote counts
        const totalVotes = { approve: 0, reject: 0, abstain: 0 };
        for (const m of metrics) {
            if (m.voteCount) {
                totalVotes.approve += m.voteCount.approve || 0;
                totalVotes.reject += m.voteCount.reject || 0;
                totalVotes.abstain += m.voteCount.abstain || 0;
            }
        }

        return {
            total,
            consensusRate: consensusReached / total,
            stewardOverrideRate: stewardOverrides / total,
            avgDeliberationTime,
            minDeliberationTime: Math.min(...metrics.map(m => m.deliberationTime)),
            maxDeliberationTime: Math.max(...metrics.map(m => m.deliberationTime)),
            totalVotes,
            approvalRate: totalVotes.approve / (totalVotes.approve + totalVotes.reject + totalVotes.abstain)
        };
    }

    /**
     * Aggregate consciousness metrics
     * @private
     * @param {Array<Object>} metrics - Consciousness metrics
     * @returns {Object} Aggregated consciousness metrics
     */
    _aggregateConsciousnessMetrics(metrics) {
        const validGwt = metrics.filter(m => m.gwtScore !== undefined);
        const validIit = metrics.filter(m => m.iitScore !== undefined);
        const validAst = metrics.filter(m => m.astScore !== undefined);
        const validComposite = metrics.filter(m => m.compositeScore !== undefined);

        return {
            gwt: {
                avg: validGwt.length > 0 ? validGwt.reduce((s, m) => s + m.gwtScore, 0) / validGwt.length : null,
                min: validGwt.length > 0 ? Math.min(...validGwt.map(m => m.gwtScore)) : null,
                max: validGwt.length > 0 ? Math.max(...validGwt.map(m => m.gwtScore)) : null
            },
            iit: {
                avg: validIit.length > 0 ? validIit.reduce((s, m) => s + m.iitScore, 0) / validIit.length : null,
                min: validIit.length > 0 ? Math.min(...validIit.map(m => m.iitScore)) : null,
                max: validIit.length > 0 ? Math.max(...validIit.map(m => m.iitScore)) : null
            },
            ast: {
                avg: validAst.length > 0 ? validAst.reduce((s, m) => s + m.astScore, 0) / validAst.length : null,
                min: validAst.length > 0 ? Math.min(...validAst.map(m => m.astScore)) : null,
                max: validAst.length > 0 ? Math.max(...validAst.map(m => m.astScore)) : null
            },
            composite: {
                avg: validComposite.length > 0 ? validComposite.reduce((s, m) => s + m.compositeScore, 0) / validComposite.length : null,
                min: validComposite.length > 0 ? Math.min(...validComposite.map(m => m.compositeScore)) : null,
                max: validComposite.length > 0 ? Math.max(...validComposite.map(m => m.compositeScore)) : null
            },
            consciousnessStateDistribution: this._calculateStateDistribution(metrics)
        };
    }

    /**
     * Calculate consciousness state distribution
     * @private
     * @param {Array<Object>} metrics - Consciousness metrics
     * @returns {Object} State distribution
     */
    _calculateStateDistribution(metrics) {
        const distribution = {
            'highly-conscious': 0,
            'conscious': 0,
            'semi-conscious': 0,
            'minimal-consciousness': 0,
            'unconscious': 0,
            'unknown': 0
        };

        for (const m of metrics) {
            const state = m.consciousnessState || 'unknown';
            if (distribution[state] !== undefined) {
                distribution[state]++;
            }
        }

        return distribution;
    }

    /**
     * Aggregate agent performance metrics
     * @private
     * @param {Array<Object>} metrics - Agent metrics
     * @returns {Object} Aggregated agent metrics
     */
    _aggregateAgentMetrics(metrics) {
        const byAgent = new Map();

        for (const metric of metrics) {
            if (!byAgent.has(metric.agentId)) {
                byAgent.set(metric.agentId, []);
            }
            byAgent.get(metric.agentId).push(metric);
        }

        const aggregated = {};
        for (const [agentId, agentMetrics] of byAgent) {
            const responseTimes = agentMetrics.map(m => m.responseTime);
            const costs = agentMetrics.filter(m => m.cost !== undefined).map(m => m.cost);
            const successes = agentMetrics.filter(m => m.success !== undefined);

            aggregated[agentId] = {
                totalOperations: agentMetrics.length,
                avgResponseTime: responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length,
                minResponseTime: Math.min(...responseTimes),
                maxResponseTime: Math.max(...responseTimes),
                p95ResponseTime: this._calculatePercentile(responseTimes, 95),
                totalCost: costs.reduce((s, c) => s + c, 0),
                successRate: successes.length > 0 ? successes.filter(s => s.success).length / successes.length : null,
                errorRate: successes.length > 0 ? successes.filter(s => !s.success).length / successes.length : null
            };
        }

        return { byAgent: aggregated, totalAgents: byAgent.size };
    }

    /**
     * Calculate percentile
     * @private
     * @param {Array<number>} values - Values
     * @param {number} percentile - Percentile to calculate
     * @returns {number} Percentile value
     */
    _calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index] || 0;
    }

    /**
     * Aggregate generic metrics
     * @private
     * @param {Array<Object>} metrics - Generic metrics
     * @returns {Object} Aggregated metrics
     */
    _aggregateGenericMetrics(metrics) {
        return {
            count: metrics.length,
            firstTimestamp: Math.min(...metrics.map(m => m.timestamp)),
            lastTimestamp: Math.max(...metrics.map(m => m.timestamp))
        };
    }

    // ==============================================================================
    // Public Metric Recording Methods
    // ==============================================================================

    /**
     * Record triad deliberation metric
     * @param {TriadMetric} metric - Triad metric
     */
    recordTriadMetric(metric) {
        if (!this.config.enabled) {
            return;
        }

        const validatedMetric = {
            ...metric,
            timestamp: metric.timestamp || Date.now()
        };

        if (!this._validateMetric(MetricType.TRIAD_DELIBERATION, validatedMetric)) {
            return;
        }

        this._storeMetric(MetricType.TRIAD_DELIBERATION, validatedMetric);
        this.emit('triad-metric', validatedMetric);
    }

    /**
     * Record consensus ledger metric
     * @param {Object} metric - Consensus metric
     */
    recordConsensusMetric(metric) {
        if (!this.config.enabled) {
            return;
        }

        const validatedMetric = {
            ...metric,
            timestamp: metric.timestamp || Date.now()
        };

        if (!this._validateMetric(MetricType.CONSENSUS_LEDGER, validatedMetric)) {
            return;
        }

        this._storeMetric(MetricType.CONSENSUS_LEDGER, validatedMetric);
        this.emit('consensus-metric', validatedMetric);
    }

    /**
     * Record consciousness metric
     * @param {ConsciousnessMetric} metric - Consciousness metric
     */
    recordConsciousnessMetric(metric) {
        if (!this.config.enabled) {
            return;
        }

        const validatedMetric = {
            ...metric,
            timestamp: metric.timestamp || Date.now()
        };

        if (!this._validateMetric(MetricType.CONSCIOUSNESS, validatedMetric)) {
            return;
        }

        // Calculate composite score if not provided
        if (validatedMetric.compositeScore === undefined) {
            const scores = [validatedMetric.gwtScore, validatedMetric.iitScore, validatedMetric.astScore].filter(s => s !== undefined);
            if (scores.length > 0) {
                validatedMetric.compositeScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            }
        }

        // Determine consciousness state if not provided
        if (validatedMetric.consciousnessState === undefined && validatedMetric.compositeScore !== undefined) {
            validatedMetric.consciousnessState = this._determineConsciousnessState(validatedMetric.compositeScore);
        }

        this._storeMetric(MetricType.CONSCIOUSNESS, validatedMetric);
        this.emit('consciousness-metric', validatedMetric);
    }

    /**
     * Determine consciousness state from composite score
     * @private
     * @param {number} compositeScore - Composite score
     * @returns {string} Consciousness state
     */
    _determineConsciousnessState(compositeScore) {
        if (compositeScore >= 0.8) return 'highly-conscious';
        if (compositeScore >= 0.6) return 'conscious';
        if (compositeScore >= 0.4) return 'semi-conscious';
        if (compositeScore >= 0.2) return 'minimal-consciousness';
        return 'unconscious';
    }

    /**
     * Record agent performance metric
     * @param {AgentPerformanceMetric} metric - Agent performance metric
     */
    recordAgentMetric(metric) {
        if (!this.config.enabled) {
            return;
        }

        const validatedMetric = {
            ...metric,
            timestamp: metric.timestamp || Date.now()
        };

        if (!this._validateMetric(MetricType.AGENT_PERFORMANCE, validatedMetric)) {
            return;
        }

        this._storeMetric(MetricType.AGENT_PERFORMANCE, validatedMetric);
        this.emit('agent-metric', validatedMetric);
    }

    /**
     * Record cost metric
     * @param {Object} metric - Cost metric
     */
    recordCostMetric(metric) {
        if (!this.config.enabled) {
            return;
        }

        const validatedMetric = {
            ...metric,
            timestamp: metric.timestamp || Date.now()
        };

        if (!this._validateMetric(MetricType.COST, validatedMetric)) {
            return;
        }

        this._storeMetric(MetricType.COST, validatedMetric);
        this.emit('cost-metric', validatedMetric);
    }

    /**
     * Record latency metric
     * @param {Object} metric - Latency metric
     */
    recordLatencyMetric(metric) {
        if (!this.config.enabled) {
            return;
        }

        const validatedMetric = {
            ...metric,
            timestamp: metric.timestamp || Date.now()
        };

        if (!this._validateMetric(MetricType.LATENCY, validatedMetric)) {
            return;
        }

        this._storeMetric(MetricType.LATENCY, validatedMetric);
        this.emit('latency-metric', validatedMetric);
    }

    /**
     * Record error metric
     * @param {Object} metric - Error metric
     */
    recordErrorMetric(metric) {
        if (!this.config.enabled) {
            return;
        }

        const validatedMetric = {
            ...metric,
            timestamp: metric.timestamp || Date.now()
        };

        if (!this._validateMetric(MetricType.ERROR, validatedMetric)) {
            return;
        }

        this._storeMetric(MetricType.ERROR, validatedMetric);
        this.emit('error-metric', validatedMetric);
    }

    // ==============================================================================
    // Query Methods
    // ==============================================================================

    /**
     * Get aggregated metrics for a type and time window
     * @param {string} type - Metric type
     * @param {string} timeWindow - Time window (e.g., '1h', '1d')
     * @returns {Promise<Object>} Aggregated metrics
     */
    async getAggregatedMetrics(type, timeWindow = '1h') {
        if (!this.redisClient) {
            // Return from buffer if Redis not available
            const bufferMetrics = this.metricsBuffer.get(type) || [];
            return this._aggregateMetrics(type, bufferMetrics);
        }

        const redisKey = `heretek:metrics:${type}`;
        const now = Date.now();
        const windowMs = this._parseTimeWindow(timeWindow);
        const startTime = now - windowMs;

        try {
            const results = await this.redisClient.zrangebyscore(redisKey, startTime, now);
            const metrics = results.map(r => JSON.parse(r));
            return this._aggregateMetrics(type, metrics);
        } catch (error) {
            console.error('[HeretekMetrics] Query error:', error.message);
            return {};
        }
    }

    /**
     * Parse time window string to milliseconds
     * @private
     * @param {string} timeWindow - Time window string
     * @returns {number} Time window in ms
     */
    _parseTimeWindow(timeWindow) {
        const match = timeWindow.match(/^(\d+)([mhdwM])$/);
        if (!match) {
            return 3600000; // Default 1 hour
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 'm': return value * 60000;
            case 'h': return value * 3600000;
            case 'd': return value * 86400000;
            case 'w': return value * 604800000;
            case 'M': return value * 2592000000;
            default: return 3600000;
        }
    }

    /**
     * Get metric counters
     * @returns {Object} Metric counters
     */
    getCounters() {
        return Object.fromEntries(this.metricCounters);
    }

    /**
     * Get exporter status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            mode: this.config.mode,
            redisConnected: !!this.redisClient,
            langfuseConfigured: !!this.config.langfuseClient,
            exportInterval: this.config.exportInterval,
            bufferedMetrics: Array.from(this.metricsBuffer.entries()).reduce((sum, [, arr]) => sum + arr.length, 0),
            counters: this.getCounters()
        };
    }
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    HeretekMetricsExporter,
    MetricType,
    AggregationPeriod,

    /**
     * Create singleton instance
     * @param {MetricsExporterConfig} config - Configuration
     * @returns {HeretekMetricsExporter} Singleton instance
     */
    createInstance: (config) => {
        if (!global.heretekMetricsSingleton) {
            global.heretekMetricsSingleton = new HeretekMetricsExporter(config);
        }
        return global.heretekMetricsSingleton;
    }
};
