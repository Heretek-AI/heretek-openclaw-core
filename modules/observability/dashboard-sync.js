/**
 * Heretek Dashboard Sync - Control Dashboard Integration Module
 * ==============================================================================
 * Sync observability data to Heretek Control Dashboard.
 * 
 * Features:
 *   - Real-time triad state synchronization
 *   - Consciousness metrics dashboard updates
 *   - Consensus ledger browser integration
 *   - Agent health status sync
 *   - Cost tracking dashboard updates
 *   - WebSocket push notifications to dashboard
 *   - REST API for dashboard queries
 * 
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                   Heretek Dashboard Sync                         │
 *   │                                                                  │
 *   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
 *   │  │   Triad      │  │  Consciousness│  │    Agent     │          │
 *   │  │   State      │  │   Metrics     │  │   Health     │          │
 *   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
 *   │         │                 │                  │                   │
 *   │         └─────────────────┼──────────────────┘                   │
 *   │                           ▼                                      │
 *   │                  ┌────────────────┐                             │
 *   │                  │  Dashboard     │                             │
 *   │                  │  State Manager │                             │
 *   │                  └───────┬────────┘                             │
 *   │                          │                                      │
 *   │         ┌────────────────┼────────────────┐                     │
 *   │         ▼                ▼                ▼                     │
 *   │  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
 *   │  │ WebSocket  │  │   REST     │  │   Redis    │                │
 *   │  │   Push     │  │   API      │  │   Pub/Sub  │                │
 *   │  └────────────┘  └────────────┘  └────────────┘                │
 *   │                          │                                      │
 *   │                          ▼                                      │
 *   │            ┌─────────────────────────┐                         │
 *   │            │  Heretek Control        │                         │
 *   │            │  Dashboard (Frontend)   │                         │
 *   │            └─────────────────────────┘                         │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   const { DashboardSync } = require('./modules/observability/dashboard-sync');
 *   
 *   const sync = new DashboardSync({
 *     dashboardUrl: 'http://localhost:3001',
 *     redisUrl: 'redis://localhost:6379',
 *     gatewayPort: 18789
 *   });
 *   
 *   // Sync triad state
 *   await sync.syncTriadState({
 *     sessionId: 'session-123',
 *     proposalId: 'proposal-456',
 *     votes: { alpha: 'approve', beta: 'approve', charlie: 'reject' },
 *     consensus: 'approved',
 *     consciousnessMetrics: { gwt: 0.85, iit: 0.72, ast: 0.91 }
 *   });
 *   
 *   // Sync agent health
 *   await sync.syncAgentHealth({
 *     agentId: 'steward',
 *     status: 'online',
 *     lastHeartbeat: Date.now(),
 *     metrics: { responseTime: 250, tokenUsage: 1500 }
 *   });
 * ==============================================================================
 */

const EventEmitter = require('events');
const http = require('http');

/**
 * Dashboard Sync Configuration
 * @typedef {Object} DashboardSyncConfig
 * @property {string} [dashboardUrl] - Dashboard URL for REST API calls
 * @property {string} [redisUrl] - Redis URL for pub/sub
 * @property {number} [gatewayPort=18789] - Gateway port for WebSocket
 * @property {string} [host='localhost'] - Host for REST API
 * @property {number} [syncInterval=5000] - Sync interval in ms
 * @property {boolean} [enabled=true] - Enable/disable sync
 * @property {boolean} [debug=false] - Debug logging
 */

/**
 * Triad State Data
 * @typedef {Object} TriadState
 * @property {string} sessionId - Session identifier
 * @property {string} proposalId - Proposal identifier
 * @property {Object} votes - Vote map {agent: vote}
 * @property {'approved'|'rejected'|'deferred'|'deliberating'} consensus - Current consensus state
 * @property {Object} [consciousnessMetrics] - Consciousness metrics
 * @property {number} [deliberationTime] - Time spent deliberating
 * @property {boolean} [stewardOverride] - Whether steward override was used
 */

/**
 * Agent Health Data
 * @typedef {Object} AgentHealth
 * @property {string} agentId - Agent identifier
 * @property {'online'|'offline'|'degraded'} status - Agent status
 * @property {number} lastHeartbeat - Last heartbeat timestamp
 * @property {Object} [metrics] - Agent metrics
 * @property {number} [metrics.responseTime] - Response time in ms
 * @property {number} [metrics.tokenUsage] - Token count
 * @property {number} [metrics.cost] - Cost in USD
 */

/**
 * Dashboard Sync Class
 */
class DashboardSync extends EventEmitter {
    /**
     * Create dashboard sync instance
     * @param {DashboardSyncConfig} config - Configuration
     */
    constructor(config = {}) {
        super();

        this.config = {
            dashboardUrl: config.dashboardUrl || process.env.DASHBOARD_URL || 'http://localhost:3001',
            redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
            gatewayPort: config.gatewayPort || 18789,
            host: config.host || 'localhost',
            syncInterval: config.syncInterval || 5000,
            enabled: config.enabled !== undefined ? config.enabled : true,
            debug: config.debug !== undefined ? config.debug : false
        };

        // Internal state
        this.initialized = false;
        this.redisClient = null;
        this.wsClients = new Set();
        this.dashboardState = new Map();
        this.syncTimer = null;
        this.pendingUpdates = new Map();

        // State caches
        this.triadStates = new Map();
        this.agentHealth = new Map();
        this.consciousnessMetrics = new Map();
        this.consensusHistory = new Map();

        // Initialize if enabled
        if (this.config.enabled) {
            this._initialize();
        }
    }

    /**
     * Initialize dashboard sync
     * @private
     */
    async _initialize() {
        try {
            // Connect to Redis for pub/sub
            if (this.config.redisUrl) {
                const Redis = require('ioredis');
                this.redisClient = new Redis(this.config.redisUrl, {
                    maxRetriesPerRequest: 3,
                    retryDelayOnFailover: 100
                });

                this.redisClient.on('connect', () => {
                    console.log('[DashboardSync] Connected to Redis');
                });

                this.redisClient.on('error', (error) => {
                    console.error('[DashboardSync] Redis error:', error.message);
                    this.emit('redis-error', error);
                });
            }

            // Start periodic sync
            if (this.config.syncInterval > 0) {
                this.syncTimer = setInterval(() => {
                    this._syncPendingUpdates();
                }, this.config.syncInterval);
            }

            this.initialized = true;
            console.log(`[DashboardSync] Initialized - Dashboard: ${this.config.dashboardUrl}`);
            console.log(`[DashboardSync] Sync interval: ${this.config.syncInterval}ms`);

        } catch (error) {
            console.error('[DashboardSync] Initialization failed:', error.message);
            this.initialized = false;
        }
    }

    /**
     * Shutdown sync gracefully
     * @returns {Promise<void>}
     */
    async shutdown() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        // Final sync before shutdown
        await this._syncPendingUpdates();

        // Close WebSocket clients
        for (const ws of this.wsClients) {
            if (ws.readyState === 1) { // OPEN
                ws.close(1000, 'Dashboard sync shutting down');
            }
        }
        this.wsClients.clear();

        if (this.redisClient) {
            await this.redisClient.quit();
            this.redisClient = null;
        }

        this.initialized = false;
        console.log('[DashboardSync] Shutdown complete');
    }

    /**
     * Queue update for sync
     * @private
     * @param {string} type - Update type
     * @param {Object} data - Update data
     */
    _queueUpdate(type, data) {
        const key = `${type}:${data.sessionId || data.agentId || Date.now()}`;
        
        if (!this.pendingUpdates.has(key)) {
            this.pendingUpdates.set(key, { type, data, timestamp: Date.now() });
        } else {
            // Merge with existing update
            const existing = this.pendingUpdates.get(key);
            existing.data = { ...existing.data, ...data };
            existing.timestamp = Date.now();
        }

        if (this.config.debug) {
            console.log(`[DashboardSync] Queued update: ${key}`);
        }
    }

    /**
     * Sync pending updates to dashboard
     * @private
     */
    async _syncPendingUpdates() {
        if (this.pendingUpdates.size === 0) {
            return;
        }

        const updates = Array.from(this.pendingUpdates.values());
        this.pendingUpdates.clear();

        // Publish to Redis for dashboard subscribers
        if (this.redisClient) {
            const message = JSON.stringify({
                type: 'dashboard-sync',
                timestamp: Date.now(),
                updates
            });

            try {
                await this.redisClient.publish('heretek:dashboard:sync', message);
                if (this.config.debug) {
                    console.log(`[DashboardSync] Published ${updates.length} updates to Redis`);
                }
            } catch (error) {
                console.error('[DashboardSync] Redis publish error:', error.message);
            }
        }

        // Send to WebSocket clients
        for (const ws of this.wsClients) {
            if (ws.readyState === 1) { // OPEN
                try {
                    ws.send(JSON.stringify({
                        type: 'sync-update',
                        timestamp: Date.now(),
                        updates
                    }));
                } catch (error) {
                    console.error('[DashboardSync] WebSocket send error:', error.message);
                    this.wsClients.delete(ws);
                }
            }
        }

        // Also send to dashboard REST API if configured
        if (this.config.dashboardUrl) {
            await this._sendToRestApi(updates);
        }

        this.emit('synced', { updateCount: updates.length });
    }

    /**
     * Send updates to dashboard REST API
     * @private
     * @param {Array<Object>} updates - Updates to send
     */
    async _sendToRestApi(updates) {
        const url = `${this.config.dashboardUrl}/api/observability/sync`;

        try {
            const postData = JSON.stringify({
                timestamp: Date.now(),
                updates
            });

            const options = {
                hostname: new URL(this.config.dashboardUrl).hostname,
                port: new URL(this.config.dashboardUrl).port || 80,
                path: '/api/observability/sync',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                if (res.statusCode === 200) {
                    if (this.config.debug) {
                        console.log('[DashboardSync] REST API sync successful');
                    }
                } else {
                    console.warn(`[DashboardSync] REST API sync returned ${res.statusCode}`);
                }
            });

            req.on('error', (error) => {
                if (this.config.debug) {
                    console.log('[DashboardSync] REST API sync error:', error.message);
                }
            });

            req.write(postData);
            req.end();

        } catch (error) {
            if (this.config.debug) {
                console.log('[DashboardSync] REST API sync failed:', error.message);
            }
        }
    }

    // ==============================================================================
    // Triad State Synchronization
    // ==============================================================================

    /**
     * Sync triad state to dashboard
     * @param {TriadState} state - Triad state
     */
    async syncTriadState(state) {
        if (!this.config.enabled) {
            return;
        }

        const enrichedState = {
            ...state,
            timestamp: Date.now(),
            voteCount: this._calculateVoteCount(state.votes),
            deliberationProgress: this._calculateDeliberationProgress(state)
        };

        // Update local cache
        this.triadStates.set(state.sessionId, enrichedState);
        this.dashboardState.set(`triad:${state.sessionId}`, enrichedState);

        // Queue for sync
        this._queueUpdate('triad-state', enrichedState);

        // Emit event
        this.emit('triad-state-sync', enrichedState);

        if (this.config.debug) {
            console.log(`[DashboardSync] Triad state synced: ${state.sessionId}`);
        }
    }

    /**
     * Calculate vote count from votes map
     * @private
     * @param {Object} votes - Vote map
     * @returns {Object} Vote count
     */
    _calculateVoteCount(votes) {
        const count = { approve: 0, reject: 0, abstain: 0, pending: 0 };
        for (const vote of Object.values(votes)) {
            if (vote === 'approve') count.approve++;
            else if (vote === 'reject') count.reject++;
            else if (vote === 'abstain') count.abstain++;
            else count.pending++;
        }
        return count;
    }

    /**
     * Calculate deliberation progress
     * @private
     * @param {TriadState} state - Triad state
     * @returns {number} Progress percentage (0-100)
     */
    _calculateDeliberationProgress(state) {
        const totalAgents = 3; // Alpha, Beta, Charlie
        const votedAgents = Object.keys(state.votes).length;
        return (votedAgents / totalAgents) * 100;
    }

    /**
     * Get current triad state
     * @param {string} sessionId - Session ID
     * @returns {TriadState|null} Triad state or null
     */
    getTriadState(sessionId) {
        return this.triadStates.get(sessionId) || null;
    }

    /**
     * Get all triad states
     * @returns {Array<TriadState>} All triad states
     */
    getAllTriadStates() {
        return Array.from(this.triadStates.values());
    }

    // ==============================================================================
    // Consciousness Metrics Synchronization
    // ==============================================================================

    /**
     * Sync consciousness metrics to dashboard
     * @param {Object} metrics - Consciousness metrics
     * @param {string} metrics.sessionId - Session ID
     * @param {number} [metrics.gwtScore] - GWT score
     * @param {number} [metrics.iitScore] - IIT score
     * @param {number} [metrics.astScore] - AST score
     * @param {number} [metrics.compositeScore] - Composite score
     * @param {string} [metrics.consciousnessState] - Consciousness state
     * @param {string} [metrics.agentId] - Agent ID (optional)
     */
    async syncConsciousnessMetrics(metrics) {
        if (!this.config.enabled) {
            return;
        }

        const enrichedMetrics = {
            ...metrics,
            timestamp: Date.now(),
            visualization: this._createConsciousnessVisualization(metrics)
        };

        // Update local cache
        const key = metrics.agentId ? `consciousness:${metrics.sessionId}:${metrics.agentId}` : `consciousness:${metrics.sessionId}`;
        this.consciousnessMetrics.set(key, enrichedMetrics);
        this.dashboardState.set(key, enrichedMetrics);

        // Queue for sync
        this._queueUpdate('consciousness-metrics', enrichedMetrics);

        // Emit event
        this.emit('consciousness-metrics-sync', enrichedMetrics);

        if (this.config.debug) {
            console.log(`[DashboardSync] Consciousness metrics synced: ${metrics.sessionId}`);
        }
    }

    /**
     * Create consciousness visualization data
     * @private
     * @param {Object} metrics - Consciousness metrics
     * @returns {Object} Visualization data
     */
    _createConsciousnessVisualization(metrics) {
        return {
            radar: {
                gwt: metrics.gwtScore || 0,
                iit: metrics.iitScore || 0,
                ast: metrics.astScore || 0
            },
            gauge: {
                composite: metrics.compositeScore || 0,
                state: metrics.consciousnessState || 'unknown'
            },
            trend: this._getConsciousnessTrend(metrics.sessionId)
        };
    }

    /**
     * Get consciousness trend for session
     * @private
     * @param {string} sessionId - Session ID
     * @returns {Array<Object>} Trend data
     */
    _getConsciousnessTrend(sessionId) {
        const trends = [];
        for (const [key, value] of this.consciousnessMetrics) {
            if (key.includes(sessionId)) {
                trends.push({
                    timestamp: value.timestamp,
                    composite: value.compositeScore
                });
            }
        }
        return trends.sort((a, b) => a.timestamp - b.timestamp).slice(-10);
    }

    /**
     * Get consciousness metrics
     * @param {string} sessionId - Session ID
     * @param {string} [agentId] - Agent ID (optional)
     * @returns {Object|null} Consciousness metrics or null
     */
    getConsciousnessMetrics(sessionId, agentId) {
        const key = agentId ? `consciousness:${sessionId}:${agentId}` : `consciousness:${sessionId}`;
        return this.consciousnessMetrics.get(key) || null;
    }

    // ==============================================================================
    // Agent Health Synchronization
    // ==============================================================================

    /**
     * Sync agent health to dashboard
     * @param {AgentHealth} health - Agent health data
     */
    async syncAgentHealth(health) {
        if (!this.config.enabled) {
            return;
        }

        const enrichedHealth = {
            ...health,
            timestamp: Date.now(),
            uptime: this._calculateUptime(health),
            healthScore: this._calculateHealthScore(health)
        };

        // Update local cache
        this.agentHealth.set(health.agentId, enrichedHealth);
        this.dashboardState.set(`agent:${health.agentId}`, enrichedHealth);

        // Queue for sync
        this._queueUpdate('agent-health', enrichedHealth);

        // Emit event
        this.emit('agent-health-sync', enrichedHealth);

        if (this.config.debug) {
            console.log(`[DashboardSync] Agent health synced: ${health.agentId}`);
        }
    }

    /**
     * Calculate agent uptime
     * @private
     * @param {AgentHealth} health - Agent health
     * @returns {number} Uptime in seconds
     */
    _calculateUptime(health) {
        // This would need a reference to agent start time
        // For now, return time since last heartbeat as a proxy
        return Math.floor((Date.now() - health.lastHeartbeat) / 1000);
    }

    /**
     * Calculate health score
     * @private
     * @param {AgentHealth} health - Agent health
     * @returns {number} Health score (0-100)
     */
    _calculateHealthScore(health) {
        let score = 100;

        // Status penalty
        if (health.status === 'offline') score -= 100;
        else if (health.status === 'degraded') score -= 50;

        // Heartbeat penalty (if no heartbeat for > 30 seconds)
        const timeSinceHeartbeat = Date.now() - health.lastHeartbeat;
        if (timeSinceHeartbeat > 30000) {
            score -= Math.min(50, (timeSinceHeartbeat - 30000) / 1000);
        }

        return Math.max(0, Math.round(score));
    }

    /**
     * Get agent health
     * @param {string} agentId - Agent ID
     * @returns {AgentHealth|null} Agent health or null
     */
    getAgentHealth(agentId) {
        return this.agentHealth.get(agentId) || null;
    }

    /**
     * Get all agent health statuses
     * @returns {Array<AgentHealth>} All agent health data
     */
    getAllAgentHealth() {
        return Array.from(this.agentHealth.values());
    }

    // ==============================================================================
    // Consensus History Synchronization
    // ==============================================================================

    /**
     * Record consensus decision in history
     * @param {Object} consensus - Consensus data
     * @param {string} consensus.sessionId - Session ID
     * @param {string} consensus.proposalId - Proposal ID
     * @param {'approved'|'rejected'|'deferred'} consensus.decision - Decision
     * @param {Object} [consensus.voteCount] - Vote count
     * @param {boolean} [consensus.stewardOverride] - Steward override
     */
    async recordConsensusDecision(consensus) {
        if (!this.config.enabled) {
            return;
        }

        const record = {
            ...consensus,
            timestamp: Date.now(),
            id: `consensus-${Date.now()}`
        };

        // Add to history
        if (!this.consensusHistory.has(consensus.sessionId)) {
            this.consensusHistory.set(consensus.sessionId, []);
        }
        this.consensusHistory.get(consensus.sessionId).push(record);

        // Queue for sync
        this._queueUpdate('consensus-history', record);

        // Emit event
        this.emit('consensus-recorded', record);

        if (this.config.debug) {
            console.log(`[DashboardSync] Consensus recorded: ${consensus.proposalId}`);
        }
    }

    /**
     * Get consensus history for session
     * @param {string} sessionId - Session ID
     * @returns {Array<Object>} Consensus history
     */
    getConsensusHistory(sessionId) {
        return this.consensusHistory.get(sessionId) || [];
    }

    /**
     * Get all consensus history
     * @returns {Map<string, Array<Object>>} All consensus history
     */
    getAllConsensusHistory() {
        return new Map(this.consensusHistory);
    }

    // ==============================================================================
    // Cost Tracking Synchronization
    // ==============================================================================

    /**
     * Sync cost data to dashboard
     * @param {Object} costData - Cost data
     * @param {string} costData.sessionId - Session ID
     * @param {string} costData.agentId - Agent ID
     * @param {number} costData.cost - Cost in USD
     * @param {number} [costData.tokenUsage] - Token count
     * @param {string} [costData.model] - Model name
     */
    async syncCostData(costData) {
        if (!this.config.enabled) {
            return;
        }

        const enrichedCost = {
            ...costData,
            timestamp: Date.now()
        };

        // Queue for sync
        this._queueUpdate('cost-data', enrichedCost);

        // Emit event
        this.emit('cost-sync', enrichedCost);

        if (this.config.debug) {
            console.log(`[DashboardSync] Cost data synced: ${costData.agentId}`);
        }
    }

    // ==============================================================================
    // WebSocket Client Management
    // ==============================================================================

    /**
     * Add WebSocket client for real-time updates
     * @param {WebSocket} ws - WebSocket client
     */
    addWebSocketClient(ws) {
        this.wsClients.add(ws);

        ws.on('close', () => {
            this.wsClients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('[DashboardSync] WebSocket client error:', error.message);
            this.wsClients.delete(ws);
        });

        // Send initial state snapshot
        this._sendInitialState(ws);

        if (this.config.debug) {
            console.log(`[DashboardSync] WebSocket client added. Total clients: ${this.wsClients.size}`);
        }
    }

    /**
     * Send initial state snapshot to new client
     * @private
     * @param {WebSocket} ws - WebSocket client
     */
    _sendInitialState(ws) {
        if (ws.readyState !== 1) { // Not OPEN
            return;
        }

        const initialState = {
            type: 'initial-state',
            timestamp: Date.now(),
            data: {
                triadStates: this.getAllTriadStates(),
                agentHealth: this.getAllAgentHealth(),
                consensusCount: this.consensusHistory.size
            }
        };

        try {
            ws.send(JSON.stringify(initialState));
        } catch (error) {
            console.error('[DashboardSync] Failed to send initial state:', error.message);
        }
    }

    // ==============================================================================
    // Dashboard State Queries
    // ==============================================================================

    /**
     * Get complete dashboard state
     * @returns {Object} Complete dashboard state
     */
    getDashboardState() {
        return {
            timestamp: Date.now(),
            triad: {
                activeSessions: this.getAllTriadStates(),
                count: this.triadStates.size
            },
            agents: {
                health: this.getAllAgentHealth(),
                count: this.agentHealth.size,
                onlineCount: this.getAllAgentHealth().filter(a => a.status === 'online').length
            },
            consciousness: {
                metrics: Array.from(this.consciousnessMetrics.values()),
                count: this.consciousnessMetrics.size
            },
            consensus: {
                history: this.getAllConsensusHistory(),
                totalDecisions: Array.from(this.consensusHistory.values()).reduce((sum, arr) => sum + arr.length, 0)
            }
        };
    }

    /**
     * Get sync status
     * @returns {Object} Sync status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            redisConnected: !!this.redisClient,
            websocketClients: this.wsClients.size,
            pendingUpdates: this.pendingUpdates.size,
            dashboardStateEntries: this.dashboardState.size,
            triadStates: this.triadStates.size,
            agentHealthEntries: this.agentHealth.size,
            consciousnessMetrics: this.consciousnessMetrics.size,
            consensusHistorySessions: this.consensusHistory.size
        };
    }
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    DashboardSync,

    /**
     * Create singleton instance
     * @param {DashboardSyncConfig} config - Configuration
     * @returns {DashboardSync} Singleton instance
     */
    createInstance: (config) => {
        if (!global.heretekDashboardSyncSingleton) {
            global.heretekDashboardSyncSingleton = new DashboardSync(config);
        }
        return global.heretekDashboardSyncSingleton;
    }
};
