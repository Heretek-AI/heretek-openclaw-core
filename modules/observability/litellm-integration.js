/**
 * Heretek LiteLLM Integration - Observatory Connection
 * ==============================================================================
 * Integration between Heretek Observability Layer and LiteLLM Observatory.
 * 
 * Features:
 *   - Token usage tracking from LiteLLM
 *   - Latency monitoring per model/provider
 *   - Cost tracking with real-time updates
 *   - Model performance metrics
 *   - Error rate tracking per provider
 *   - Request/response tracing
 * 
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │              Heretek LiteLLM Integration                         │
 *   │                                                                  │
 *   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
 *   │  │   Token      │  │   Latency    │  │    Cost      │          │
 *   │  │   Tracker    │  │   Monitor    │  │   Calculator │          │
 *   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
 *   │         │                 │                  │                   │
 *   │         └─────────────────┼──────────────────┘                   │
 *   │                           ▼                                      │
 *   │                  ┌────────────────┐                             │
 *   │                  │  LiteLLM       │                             │
 *   │                  │  Observatory   │                             │
 *   │                  └───────┬────────┘                             │
 *   │                          │                                      │
 *   │         ┌────────────────┼────────────────┐                     │
 *   │         ▼                ▼                ▼                     │
 *   │  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
 *   │  │  Langfuse  │  │  Metrics   │  │  Dashboard │                │
 *   │  │  Export    │  │  Export    │  │  Sync      │                │
 *   │  └────────────┘  └────────────┘  └────────────┘                │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   const { LiteLLMIntegration } = require('./modules/observability/litellm-integration');
 *   
 *   const integration = new LiteLLMIntegration({
 *     litellmEndpoint: 'http://localhost:4000',
 *     langfuseClient: langfuseClient,
 *     metricsExporter: metricsExporter
 *   });
 *   
 *   // Track completion
 *   await integration.trackCompletion({
 *     model: 'claude-opus-4-6',
 *     agentId: 'steward',
 *     sessionId: 'session-123',
 *     promptTokens: 1500,
 *     completionTokens: 500,
 *     latency: 2500,
 *     cost: 0.015
 *   });
 * ==============================================================================
 */

const EventEmitter = require('events');
const http = require('http');

/**
 * LiteLLM Integration Configuration
 * @typedef {Object} LiteLLMIntegrationConfig
 * @property {string} [litellmEndpoint='http://localhost:4000'] - LiteLLM endpoint
 * @property {Object} [langfuseClient] - Langfuse client instance
 * @property {Object} [metricsExporter] - Metrics exporter instance
 * @property {Object} [dashboardSync] - Dashboard sync instance
 * @property {boolean} [enabled=true] - Enable/disable integration
 * @property {boolean} [debug=false] - Debug logging
 */

/**
 * LLM Completion Data
 * @typedef {Object} CompletionData
 * @property {string} model - Model name
 * @property {string} agentId - Agent identifier
 * @property {string} sessionId - Session identifier
 * @property {number} promptTokens - Prompt token count
 * @property {number} completionTokens - Completion token count
 * @property {number} totalTokens - Total token count
 * @property {number} latency - Request latency in ms
 * @property {number} cost - Cost in USD
 * @property {boolean} [success=true] - Whether request succeeded
 * @property {string} [error] - Error message if failed
 */

/**
 * LiteLLM Integration Class
 */
class LiteLLMIntegration extends EventEmitter {
    /**
     * Create LiteLLM integration instance
     * @param {LiteLLMIntegrationConfig} config - Configuration
     */
    constructor(config = {}) {
        super();

        this.config = {
            litellmEndpoint: config.litellmEndpoint || process.env.LITELLM_ENDPOINT || 'http://localhost:4000',
            langfuseClient: config.langfuseClient,
            metricsExporter: config.metricsExporter,
            dashboardSync: config.dashboardSync,
            enabled: config.enabled !== undefined ? config.enabled : true,
            debug: config.debug !== undefined ? config.debug : false
        };

        // Internal state
        this.initialized = false;
        this.modelPricing = new Map();
        this.requestHistory = new Map();
        this.tokenCounters = new Map();
        this.costTrackers = new Map();

        // Initialize pricing data
        this._initializePricing();

        if (this.config.enabled) {
            this._initialize();
        }
    }

    /**
     * Initialize pricing data for common models
     * @private
     */
    _initializePricing() {
        // Pricing per 1M tokens (USD)
        const pricing = {
            // Anthropic
            'claude-opus-4-6': { input: 15.00, output: 75.00 },
            'claude-sonnet-4-0': { input: 3.00, output: 15.00 },
            'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
            'claude-3-opus': { input: 15.00, output: 75.00 },
            
            // OpenAI
            'gpt-4-turbo': { input: 10.00, output: 30.00 },
            'gpt-4': { input: 30.00, output: 60.00 },
            'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
            
            // Google
            'gemini-pro': { input: 0.50, output: 1.50 },
            'gemini-ultra': { input: 7.50, output: 22.50 },
            
            // MiniMax (example pricing)
            'minimax/MiniMax-M2.7': { input: 0.10, output: 0.20 },
            
            // Ollama (local, typically free)
            'ollama/llama2': { input: 0, output: 0 },
            'ollama/mistral': { input: 0, output: 0 },
            
            // Heretek agents (internal)
            'agent/steward': { input: 0, output: 0 },
            'agent/alpha': { input: 0, output: 0 },
            'agent/beta': { input: 0, output: 0 },
            'agent/charlie': { input: 0, output: 0 }
        };

        for (const [model, prices] of Object.entries(pricing)) {
            this.modelPricing.set(model.toLowerCase(), prices);
        }
    }

    /**
     * Initialize integration
     * @private
     */
    async _initialize() {
        try {
            // Fetch additional pricing from LiteLLM if available
            await this._fetchLiteLLMPricing();

            this.initialized = true;
            console.log(`[LiteLLMIntegration] Initialized - Endpoint: ${this.config.litellmEndpoint}`);

        } catch (error) {
            console.error('[LiteLLMIntegration] Initialization failed:', error.message);
            this.initialized = false;
        }
    }

    /**
     * Fetch pricing from LiteLLM endpoint
     * @private
     */
    async _fetchLiteLLMPricing() {
        try {
            const pricing = await this._httpGet('/model/info');
            
            if (pricing?.data) {
                for (const model of pricing.data) {
                    if (model.model_info?.input_cost_per_token && model.model_info?.output_cost_per_token) {
                        this.modelPricing.set(model.model_name.toLowerCase(), {
                            input: model.model_info.input_cost_per_token * 1000000,
                            output: model.model_info.output_cost_per_token * 1000000
                        });
                    }
                }
            }
        } catch (error) {
            if (this.config.debug) {
                console.log('[LiteLLMIntegration] Could not fetch pricing from LiteLLM:', error.message);
            }
        }
    }

    /**
     * HTTP GET request helper
     * @private
     * @param {string} path - API path
     * @returns {Promise<Object>} Response data
     */
    async _httpGet(path) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.config.litellmEndpoint);
            
            const req = http.get(url, (res) => {
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(data);
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Calculate cost for a completion
     * @param {string} model - Model name
     * @param {number} promptTokens - Prompt token count
     * @param {number} completionTokens - Completion token count
     * @returns {Object} Cost breakdown
     */
    calculateCost(model, promptTokens, completionTokens) {
        const pricing = this.modelPricing.get(model.toLowerCase()) || { input: 0, output: 0 };
        
        const inputCost = (promptTokens / 1000000) * pricing.input;
        const outputCost = (completionTokens / 1000000) * pricing.output;
        const totalCost = inputCost + outputCost;

        return {
            model,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            inputCost,
            outputCost,
            totalCost,
            pricing
        };
    }

    /**
     * Track LLM completion
     * @param {CompletionData} data - Completion data
     */
    async trackCompletion(data) {
        if (!this.config.enabled) {
            return;
        }

        const {
            model,
            agentId,
            sessionId,
            promptTokens,
            completionTokens,
            totalTokens = promptTokens + completionTokens,
            latency,
            cost,
            success = true,
            error
        } = data;

        const timestamp = Date.now();
        const trackingId = `llm-${agentId}-${timestamp}`;

        // Calculate cost if not provided
        const costData = cost !== undefined 
            ? { totalCost: cost }
            : this.calculateCost(model, promptTokens, completionTokens);

        // Create completion record
        const completionRecord = {
            trackingId,
            model,
            agentId,
            sessionId,
            promptTokens,
            completionTokens,
            totalTokens,
            latency,
            cost: costData.totalCost || 0,
            success,
            error,
            timestamp
        };

        // Store in history
        if (!this.requestHistory.has(agentId)) {
            this.requestHistory.set(agentId, []);
        }
        this.requestHistory.get(agentId).push(completionRecord);

        // Update token counters
        this._updateTokenCounter(agentId, model, totalTokens);

        // Update cost tracker
        this._updateCostTracker(agentId, costData.totalCost || 0);

        // Track in Langfuse
        if (this.config.langfuseClient) {
            await this._trackInLangfuse(completionRecord, costData);
        }

        // Record metrics
        if (this.config.metricsExporter) {
            this._recordMetrics(completionRecord, costData);
        }

        // Sync to dashboard
        if (this.config.dashboardSync) {
            await this._syncToDashboard(completionRecord, costData);
        }

        // Emit event
        this.emit('completion-tracked', completionRecord);

        if (this.config.debug) {
            console.log(`[LiteLLMIntegration] Tracked completion: ${model} (${totalTokens} tokens, $${(costData.totalCost || 0).toFixed(6)})`);
        }
    }

    /**
     * Update token counter for agent
     * @private
     * @param {string} agentId - Agent ID
     * @param {string} model - Model name
     * @param {number} tokens - Token count
     */
    _updateTokenCounter(agentId, model, tokens) {
        const key = `${agentId}:${model}`;
        const current = this.tokenCounters.get(key) || { total: 0, count: 0 };
        
        this.tokenCounters.set(key, {
            total: current.total + tokens,
            count: current.count + 1,
            lastUpdate: Date.now()
        });
    }

    /**
     * Update cost tracker for agent
     * @private
     * @param {string} agentId - Agent ID
     * @param {number} cost - Cost in USD
     */
    _updateCostTracker(agentId, cost) {
        const current = this.costTrackers.get(agentId) || { total: 0, count: 0 };
        
        this.costTrackers.set(agentId, {
            total: current.total + cost,
            count: current.count + 1,
            lastUpdate: Date.now()
        });
    }

    /**
     * Track completion in Langfuse
     * @private
     * @param {Object} completion - Completion record
     * @param {Object} costData - Cost breakdown
     */
    async _trackInLangfuse(completion, costData) {
        try {
            const trace = this.config.langfuseClient.client?.trace({
                id: completion.trackingId,
                name: 'llm-completion',
                sessionId: completion.sessionId,
                tags: ['llm', 'completion', completion.agentId],
                metadata: {
                    heretek: {
                        type: 'llm-completion',
                        agentId: completion.agentId,
                        model: completion.model
                    }
                },
                input: {
                    model: completion.model,
                    promptTokens: completion.promptTokens
                },
                output: {
                    completionTokens: completion.completionTokens,
                    latency: completion.latency,
                    success: completion.success
                }
            });

            trace.generation({
                name: 'agent-completion',
                model: completion.model,
                usage: {
                    input: completion.promptTokens,
                    output: completion.completionTokens,
                    total: completion.totalTokens
                },
                metadata: {
                    heretek: {
                        agentId: completion.agentId,
                        cost: costData
                    }
                }
            });

            if (completion.error) {
                trace.event({
                    name: 'llm-error',
                    input: { error: completion.error }
                });
            }

        } catch (error) {
            console.error('[LiteLLMIntegration] Langfuse tracking error:', error.message);
        }
    }

    /**
     * Record metrics for completion
     * @private
     * @param {Object} completion - Completion record
     * @param {Object} costData - Cost breakdown
     */
    _recordMetrics(completion, costData) {
        // Record agent performance metric
        this.config.metricsExporter.recordAgentMetric({
            agentId: completion.agentId,
            responseTime: completion.latency,
            tokenUsage: completion.totalTokens,
            cost: completion.cost,
            success: completion.success,
            operation: 'llm-completion',
            model: completion.model
        });

        // Record cost metric
        this.config.metricsExporter.recordCostMetric({
            agentId: completion.agentId,
            cost: completion.cost,
            currency: 'USD',
            model: completion.model,
            tokenUsage: completion.totalTokens,
            sessionId: completion.sessionId
        });

        // Record latency metric
        this.config.metricsExporter.recordLatencyMetric({
            agentId: completion.agentId,
            latency: completion.latency,
            operation: 'llm-completion',
            model: completion.model
        });

        // Record error if failed
        if (!completion.success && completion.error) {
            this.config.metricsExporter.recordErrorMetric({
                agentId: completion.agentId,
                errorCode: 'LLM_ERROR',
                errorMessage: completion.error,
                operation: 'llm-completion',
                model: completion.model
            });
        }
    }

    /**
     * Sync completion to dashboard
     * @private
     * @param {Object} completion - Completion record
     * @param {Object} costData - Cost breakdown
     */
    async _syncToDashboard(completion, costData) {
        // Sync cost data
        this.config.dashboardSync.syncCostData({
            sessionId: completion.sessionId,
            agentId: completion.agentId,
            cost: completion.cost,
            tokenUsage: completion.totalTokens,
            model: completion.model
        });

        // Sync agent health with latest metrics
        this.config.dashboardSync.syncAgentHealth({
            agentId: completion.agentId,
            status: completion.success ? 'online' : 'degraded',
            lastHeartbeat: completion.timestamp,
            metrics: {
                responseTime: completion.latency,
                tokenUsage: completion.totalTokens,
                cost: completion.cost,
                lastModel: completion.model
            }
        });
    }

    /**
     * Get token usage statistics for agent
     * @param {string} agentId - Agent ID
     * @param {string} [timeWindow] - Time window (e.g., '1h', '1d')
     * @returns {Object} Token usage statistics
     */
    getTokenUsage(agentId, timeWindow) {
        const agentRecords = this.requestHistory.get(agentId) || [];
        
        let filteredRecords = agentRecords;
        if (timeWindow) {
            const windowMs = this._parseTimeWindow(timeWindow);
            const cutoff = Date.now() - windowMs;
            filteredRecords = agentRecords.filter(r => r.timestamp >= cutoff);
        }

        const totalTokens = filteredRecords.reduce((sum, r) => sum + r.totalTokens, 0);
        const promptTokens = filteredRecords.reduce((sum, r) => sum + r.promptTokens, 0);
        const completionTokens = filteredRecords.reduce((sum, r) => sum + r.completionTokens, 0);

        // Group by model
        const byModel = new Map();
        for (const record of filteredRecords) {
            if (!byModel.has(record.model)) {
                byModel.set(record.model, { totalTokens: 0, count: 0 });
            }
            const modelStats = byModel.get(record.model);
            modelStats.totalTokens += record.totalTokens;
            modelStats.count++;
        }

        return {
            agentId,
            timeWindow,
            totalTokens,
            promptTokens,
            completionTokens,
            requestCount: filteredRecords.length,
            avgTokensPerRequest: filteredRecords.length > 0 ? totalTokens / filteredRecords.length : 0,
            byModel: Object.fromEntries(byModel)
        };
    }

    /**
     * Get cost statistics for agent
     * @param {string} agentId - Agent ID
     * @param {string} [timeWindow] - Time window
     * @returns {Object} Cost statistics
     */
    getCostStats(agentId, timeWindow) {
        const agentRecords = this.requestHistory.get(agentId) || [];
        
        let filteredRecords = agentRecords;
        if (timeWindow) {
            const windowMs = this._parseTimeWindow(timeWindow);
            const cutoff = Date.now() - windowMs;
            filteredRecords = agentRecords.filter(r => r.timestamp >= cutoff);
        }

        const totalCost = filteredRecords.reduce((sum, r) => sum + r.cost, 0);

        // Group by model
        const byModel = new Map();
        for (const record of filteredRecords) {
            if (!byModel.has(record.model)) {
                byModel.set(record.model, { cost: 0, count: 0 });
            }
            const modelStats = byModel.get(record.model);
            modelStats.cost += record.cost;
            modelStats.count++;
        }

        return {
            agentId,
            timeWindow,
            totalCost,
            requestCount: filteredRecords.length,
            avgCostPerRequest: filteredRecords.length > 0 ? totalCost / filteredRecords.length : 0,
            byModel: Object.fromEntries(byModel)
        };
    }

    /**
     * Parse time window string to milliseconds
     * @private
     * @param {string} timeWindow - Time window string
     * @returns {number} Time window in ms
     */
    _parseTimeWindow(timeWindow) {
        if (!timeWindow) return Infinity;
        
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
     * Get integration status
     * @returns {Object} Status information
     */
    getStatus() {
        const trackerData = {
            agents: {},
            totalCost: 0,
            totalTokens: 0
        };

        for (const [agentId, costData] of this.costTrackers) {
            trackerData.agents[agentId] = {
                cost: costData.total,
                requestCount: costData.count
            };
            trackerData.totalCost += costData.total;
        }

        for (const [key, tokenData] of this.tokenCounters) {
            trackerData.totalTokens += tokenData.total;
        }

        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            litellmEndpoint: this.config.litellmEndpoint,
            langfuseConfigured: !!this.config.langfuseClient,
            metricsConfigured: !!this.config.metricsExporter,
            dashboardConfigured: !!this.config.dashboardSync,
            modelPricingCount: this.modelPricing.size,
            requestHistoryCount: this.requestHistory.size,
            tracker: trackerData
        };
    }
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    LiteLLMIntegration,

    /**
     * Create singleton instance
     * @param {LiteLLMIntegrationConfig} config - Configuration
     * @returns {LiteLLMIntegration} Singleton instance
     */
    createInstance: (config) => {
        if (!global.heretekLiteLLMSingleton) {
            global.heretekLiteLLMSingleton = new LiteLLMIntegration(config);
        }
        return global.heretekLiteLLMSingleton;
    }
};
