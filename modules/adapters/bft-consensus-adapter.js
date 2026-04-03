/**
 * Heretek OpenClaw — BFT Consensus Adapter
 * ==============================================================================
 * Adapter that wraps the existing BFT consensus implementation and publishes
 * consensus results to the npm OpenClaw gateway via the ACP adapter.
 *
 * **STATUS:** No protocol change needed — BFT uses Redis pub/sub only.
 *             This adapter adds npm gateway notification when consensus is reached.
 *
 * BFT Protocol phases: PRE-PREPARE → PREPARE → COMMIT → REPLY
 * Redis keys used (already in use, no migration needed):
 *   - bft:consensus          (pub/sub channel)
 *   - bft:prepare:{view}:{seq}:{digest}
 *   - bft:commit:{view}:{seq}:{digest}
 *   - bft:view-change:{view}
 *
 * Usage:
 *   const { BFTConsensusAdapter } = require('./bft-consensus-adapter');
 *   const bft = new BFTConsensusAdapter({ nodeId: 'alpha' });
 *   await bft.connect();
 *   await bft.propose({ decision: 'approve_phase_3', reason: '...' });
 *   // When committed, result is published to npm gateway automatically
 * ==============================================================================
 */

const { BFTConsensus } = require('../consensus/bft-consensus');
const { Redis } = require('ioredis');

class BFTConsensusAdapter {
    /**
     * Create BFT consensus adapter
     * @param {Object} options
     * @param {string} options.nodeId - This node's agent ID
     * @param {string} [options.redisUrl] - Redis URL
     * @param {string} [options.gatewayToken] - npm gateway token (for ACP notification)
     * @param {string} [options.gatewayUrl] - npm gateway WS URL
     * @param {number} [options.clusterSize=4] - Cluster size (3f+1, default 4 for f=1)
     */
    constructor(options = {}) {
        this.nodeId = options.nodeId || 'unknown';
        this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
        this.gatewayToken = options.gatewayToken || process.env.OPENCLAW_GATEWAY_TOKEN;
        this.gatewayUrl = options.gatewayUrl || process.env.OPENCLAW_GATEWAY_WS || 'ws://localhost:18789/a2a';
        this.clusterSize = options.clusterSize || 4;

        this.bft = null;
        this.redis = null;
        this.acpAdapter = null;
        this.connected = false;

        // Callbacks for consensus events
        this.onCommitted = options.onCommitted || (() => {});
        this.onViewChange = options.onViewChange || (() => {});
    }

    /**
     * Connect BFT and Redis
     * @returns {Promise<void>}
     */
    async connect() {
        // Connect Redis
        this.redis = new Redis(this.redisUrl, { maxRetriesPerRequest: 3 });
        await this.redis.ping();
        console.log(`[BFT Adapter] Connected to Redis`);

        // Initialize BFT consensus
        this.bft = new BFTConsensus({
            redisUrl: this.redisUrl,
            nodeId: this.nodeId,
            clusterSize: this.clusterSize
        });

        // Subscribe to BFT consensus channel
        await this.bft.subscribe();
        console.log(`[BFT Adapter] Subscribed to bft:consensus channel`);

        // Override consensus handlers to add gateway notification
        this._patchBFTHandlers();

        this.connected = true;
    }

    /**
     * Patch BFT handlers to notify npm gateway on consensus events
     * @private
     */
    _patchBFTHandlers() {
        const originalCommit = this.bft.handleCommit.bind(this.bft);
        const self = this;

        this.bft.handleCommit = async function(msg) {
            const result = await originalCommit(msg);
            if (result && result.committed) {
                await self._notifyGateway('consensus.committed', {
                    view: result.view,
                    sequence: result.sequence,
                    nodeId: self.nodeId,
                    quorum: result.commits
                });
                self.onCommitted(result);
            }
            return result;
        };

        const originalViewChange = this.bft.handleViewChange.bind(this.bft);
        this.bft.handleViewChange = async function(msg) {
            const result = await originalViewChange(msg);
            if (result && result.accepted) {
                await self._notifyGateway('consensus.view_change', {
                    view: result.view,
                    nodeId: self.nodeId
                });
                self.onViewChange(result);
            }
            return result;
        };
    }

    /**
     * Notify npm gateway of BFT event
     * @private
     */
    async _notifyGateway(eventType, payload) {
        if (!this.acpAdapter || !this.acpAdapter.authenticated) {
            // Fall back to Redis broadcast (npm gateway reads this too)
            try {
                await this.redis.publish('openclaw:a2a:broadcast', JSON.stringify({
                    type: 'bft.event',
                    event: eventType,
                    source: this.nodeId,
                    payload,
                    timestamp: new Date().toISOString()
                }));
            } catch (err) {
                console.warn(`[BFT Adapter] Redis broadcast failed:`, err.message);
            }
            return;
        }

        try {
            await this.acpAdapter.broadcast({
                type: 'bft.event',
                event: eventType,
                source: this.nodeId,
                payload
            });
        } catch (err) {
            console.warn(`[BFT Adapter] ACP broadcast failed:`, err.message);
        }
    }

    /**
     * Connect ACP adapter for real-time gateway notification
     * @param {Object} options
     * @param {string} options.agentId - Agent ID to register as
     * @param {string} [options.token] - Gateway token override
     * @returns {Promise<void>}
     */
    async connectACP(options = {}) {
        try {
            const { ACPAdapter } = require('./acp-adapter.js');
            this.acpAdapter = await ACPAdapter.connect({
                agentId: options.agentId || this.nodeId,
                token: options.token || this.gatewayToken,
                gatewayUrl: this.gatewayUrl
            });
            console.log(`[BFT Adapter] ACP connected`);
        } catch (err) {
            console.warn(`[BFT Adapter] ACP connection failed (continuing without):`, err.message);
        }
    }

    /**
     * Propose a decision for BFT consensus
     * @param {Object} decision - Decision object
     * @param {string} decision.action - Action being decided (e.g. 'approve_phase_3')
     * @param {string} decision.reason - Reason for the decision
     * @param {Object} [decision.metadata] - Additional metadata
     * @returns {Promise<Object>} Consensus result
     */
    async propose(decision) {
        if (!this.connected) throw new Error('BFT Adapter not connected');
        console.log(`[BFT Adapter] Proposing: ${decision.action}`);
        return this.bft.propose(decision);
    }

    /**
     * Get BFT status
     * @returns {Object}
     */
    getStatus() {
        return {
            connected: this.connected,
            nodeId: this.nodeId,
            clusterSize: this.clusterSize,
            bft: this.bft ? this.bft.getStatus() : null,
            acpConnected: !!(this.acpAdapter && this.acpAdapter.authenticated)
        };
    }

    /**
     * Disconnect
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this.acpAdapter) {
            await this.acpAdapter.close();
        }
        if (this.redis) {
            await this.redis.quit();
        }
        this.connected = false;
        console.log(`[BFT Adapter] Disconnected`);
    }
}

module.exports = { BFTConsensusAdapter };
