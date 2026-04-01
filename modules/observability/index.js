/**
 * Heretek Observability Core Module - Index
 * ==============================================================================
 * Central export point for all Heretek observability components.
 * 
 * Components:
 *   - LangfuseClient: Langfuse SDK wrapper with triad consciousness metrics
 *   - TraceContext: A2A message trace propagation
 *   - MetricsExporter: Custom metrics for deliberation, consensus, consciousness
 *   - DashboardSync: Control Dashboard integration
 * 
 * Usage:
 *   const {
 *     HeretekLangfuseClient,
 *     TraceContext,
 *     TraceContextManager,
 *     HeretekMetricsExporter,
 *     DashboardSync,
 *     MetricType,
 *     AggregationPeriod,
 *     createObservabilityStack
 *   } = require('./modules/observability');
 *   
 *   // Initialize full observability stack
 *   const observability = createObservabilityStack({
 *     langfuse: {
 *       publicKey: process.env.LANGFUSE_PUBLIC_KEY,
 *       secretKey: process.env.LANGFUSE_SECRET_KEY,
 *       host: process.env.LANGFUSE_HOST
 *     },
 *     metrics: {
 *       redisUrl: process.env.REDIS_URL,
 *       exportInterval: 60000
 *     },
 *     dashboard: {
 *       dashboardUrl: process.env.DASHBOARD_URL,
 *       syncInterval: 5000
 *     }
 *   });
 *   
 *   // Use components
 *   const { langfuse, metrics, dashboard, traceContext } = observability;
 * ==============================================================================
 */

const { HeretekLangfuseClient } = require('./langfuse-client');
const { TraceContext, TraceContextManager, TRACE_CONTEXT_HEADER, TRACE_BAGGAGE_HEADER } = require('./trace-context');
const { HeretekMetricsExporter, MetricType, AggregationPeriod } = require('./metrics-exporter');
const { DashboardSync } = require('./dashboard-sync');

/**
 * Observability Stack Configuration
 * @typedef {Object} ObservabilityStackConfig
 * @property {Object} [langfuse] - Langfuse client configuration
 * @property {Object} [metrics] - Metrics exporter configuration
 * @property {Object} [dashboard] - Dashboard sync configuration
 * @property {boolean} [enabled=true] - Enable/disable all components
 */

/**
 * Observability Stack Instance
 * @typedef {Object} ObservabilityStack
 * @property {HeretekLangfuseClient} langfuse - Langfuse client
 * @property {HeretekMetricsExporter} metrics - Metrics exporter
 * @property {DashboardSync} dashboard - Dashboard sync
 * @property {TraceContextManager} traceContext - Trace context manager
 * @property {Function} shutdown - Shutdown all components
 * @property {Function} getStatus - Get status of all components
 */

/**
 * Create full observability stack
 * @param {ObservabilityStackConfig} config - Configuration
 * @returns {ObservabilityStack} Observability stack instance
 */
function createObservabilityStack(config = {}) {
    const enabled = config.enabled !== undefined ? config.enabled : true;

    console.log('[Observability] Initializing Heretek Observability Stack...');

    // Initialize Langfuse client
    const langfuse = new HeretekLangfuseClient({
        ...config.langfuse,
        enabled: enabled && (config.langfuse?.enabled !== false)
    });

    // Initialize metrics exporter with langfuse client reference
    const metrics = new HeretekMetricsExporter({
        ...config.metrics,
        langfuseClient: langfuse,
        enabled: enabled && (config.metrics?.enabled !== false)
    });

    // Initialize dashboard sync
    const dashboard = new DashboardSync({
        ...config.dashboard,
        enabled: enabled && (config.dashboard?.enabled !== false)
    });

    // Create trace context manager
    const traceContext = TraceContextManager.createInstance();

    // Wire up event emitters for cross-component communication
    _wireEventEmitters(langfuse, metrics, dashboard);

    console.log('[Observability] Heretek Observability Stack initialized');

    return {
        langfuse,
        metrics,
        dashboard,
        traceContext,

        /**
         * Shutdown all components gracefully
         * @returns {Promise<void>}
         */
        async shutdown() {
            console.log('[Observability] Shutting down...');
            await Promise.all([
                langfuse.shutdown(),
                metrics.shutdown(),
                dashboard.shutdown()
            ]);
            console.log('[Observability] Shutdown complete');
        },

        /**
         * Get status of all components
         * @returns {Object} Combined status
         */
        getStatus() {
            return {
                enabled,
                langfuse: langfuse.getStatus(),
                metrics: metrics.getStatus(),
                dashboard: dashboard.getStatus(),
                traceContext: traceContext.getStatus()
            };
        }
    };
}

/**
 * Wire up event emitters for cross-component communication
 * @private
 * @param {HeretekLangfuseClient} langfuse - Langfuse client
 * @param {HeretekMetricsExporter} metrics - Metrics exporter
 * @param {DashboardSync} dashboard - Dashboard sync
 */
function _wireEventEmitters(langfuse, metrics, dashboard) {
    // When metrics are recorded, also sync to dashboard
    metrics.on('triad-metric', (metric) => {
        dashboard.syncTriadState({
            sessionId: metric.sessionId,
            proposalId: metric.proposalId,
            votes: {}, // Would need vote details from metric
            consensus: metric.consensusReached ? 'approved' : 'rejected',
            deliberationTime: metric.deliberationTime
        });
    });

    metrics.on('consciousness-metric', (metric) => {
        dashboard.syncConsciousnessMetrics(metric);
    });

    metrics.on('agent-metric', (metric) => {
        dashboard.syncAgentHealth({
            agentId: metric.agentId,
            status: metric.success !== false ? 'online' : 'degraded',
            lastHeartbeat: metric.timestamp,
            metrics: {
                responseTime: metric.responseTime,
                tokenUsage: metric.tokenUsage,
                cost: metric.cost
            }
        });
    });

    // When dashboard records consensus, also record in metrics
    dashboard.on('consensus-recorded', (consensus) => {
        metrics.recordConsensusMetric({
            sessionId: consensus.sessionId,
            proposalId: consensus.proposalId,
            decision: consensus.decision,
            voteCount: consensus.voteCount,
            stewardOverride: consensus.stewardOverride
        });
    });

    // When langfuse records triad deliberation, sync to metrics and dashboard
    // This would require additional wiring in the langfuse client
}

/**
 * Create a triad-aware observability context
 * @param {Object} options - Options
 * @param {ObservabilityStack} options.observability - Observability stack
 * @param {string} options.sessionId - Session ID
 * @param {string} options.proposalId - Proposal ID
 * @returns {Object} Triad observability context
 */
function createTriadObservabilityContext({ observability, sessionId, proposalId }) {
    const { langfuse, metrics, dashboard, traceContext } = observability;

    return {
        sessionId,
        proposalId,

        /**
         * Start triad deliberation
         * @returns {Promise<Object>} Deliberation context
         */
        async startDeliberation() {
            const { triadContext } = await langfuse.startTriadDeliberation({
                sessionId,
                proposalId,
                agents: ['alpha', 'beta', 'charlie']
            });

            const traceCtx = TraceContext.createTriadContext({
                sessionId,
                proposalId,
                agentId: 'triad',
                voteType: 'pending'
            });

            traceContext.register(`triad:${sessionId}:${proposalId}`, traceCtx);

            return { triadContext, traceCtx };
        },

        /**
         * Record a vote
         * @param {Object} options - Vote options
         * @returns {Promise<void>}
         */
        async recordVote({ agent, vote, reasoning }) {
            const activeContext = traceContext.get(`triad:${sessionId}:${proposalId}`);
            
            await langfuse.recordTriadVote({
                triadContext: activeContext,
                agent,
                vote,
                reasoning
            });

            metrics.recordTriadMetric({
                sessionId,
                proposalId,
                deliberationTime: Date.now() - (activeContext?.startTime || Date.now()),
                consensusReached: false,
                voteCount: { [vote]: 1 }
            });
        },

        /**
         * Finalize deliberation
         * @param {Object} options - Finalization options
         * @returns {Promise<void>}
         */
        async finalize({ consensus, voteCount, stewardOverride, consciousnessMetrics }) {
            const activeContext = traceContext.get(`triad:${sessionId}:${proposalId}`);

            await langfuse.finalizeTriadDeliberation({
                triadContext: activeContext,
                consensus,
                voteCount,
                stewardOverride,
                consciousnessMetrics
            });

            metrics.recordTriadMetric({
                sessionId,
                proposalId,
                deliberationTime: Date.now() - (activeContext?.startTime || Date.now()),
                consensusReached: consensus === 'approved',
                voteCount,
                stewardOverride
            });

            await dashboard.recordConsensusDecision({
                sessionId,
                proposalId,
                decision: consensus,
                voteCount,
                stewardOverride
            });

            traceContext.remove(`triad:${sessionId}:${proposalId}`);
        }
    };
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    // Core classes
    HeretekLangfuseClient,
    TraceContext,
    TraceContextManager,
    HeretekMetricsExporter,
    DashboardSync,

    // Constants
    MetricType,
    AggregationPeriod,
    TRACE_CONTEXT_HEADER,
    TRACE_BAGGAGE_HEADER,

    // Factory functions
    createObservabilityStack,
    createTriadObservabilityContext,

    // Singleton creators
    createLangfuseInstance: HeretekLangfuseClient.createInstance,
    createMetricsInstance: HeretekMetricsExporter.createInstance,
    createDashboardInstance: DashboardSync.createInstance,
    createTraceContextManager: TraceContextManager.createInstance
};
