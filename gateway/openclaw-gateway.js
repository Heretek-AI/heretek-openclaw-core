/**
 * Heretek OpenClaw — Gateway Server v1.0
 * ==============================================================================
 * Central WebSocket RPC gateway for agent-to-agent (A2A) communication.
 * 
 * Architecture:
 *   ┌─────────────┐     WebSocket      ┌──────────────────────────────┐
 *   │ Agent A     │ ◄────────────────► │     OpenClaw Gateway         │
 *   │ (port 8001) │     RPC on 18789   │     - Message routing        │
 *   ├─────────────┤                    │     - Agent discovery        │
 *   │ Agent B     │ ◄────────────────► │     - Redis integration      │
 *   │ (port 8002) │                    │     - Session management     │
 *   └─────────────┘                    └──────────────────────────────┘
 *                                              │
 *                                              ▼
 *                                       ┌─────────────┐
 *                                       │    Redis    │
 *                                       │  :6379      │
 *                                       └─────────────┘
 * 
 * Features:
 *   - WebSocket RPC for agent communication
 *   - Message routing between agents
 *   - Agent registration and discovery
 *   - Broadcast support
 *   - Redis message persistence
 *   - Health check endpoints
 * 
 * Usage:
 *   node openclaw-gateway.js
 *   
 *   # Or with environment variables:
 *   GATEWAY_PORT=18789 REDIS_URL=redis://localhost:6379 node openclaw-gateway.js
 * ==============================================================================
 */

const WebSocket = require('ws');
const http = require('http');
const Redis = require('ioredis');
const EventEmitter = require('events');
const crypto = require('crypto');

// ==============================================================================
// Configuration
// ==============================================================================
const CONFIG = {
    port: parseInt(process.env.GATEWAY_PORT || process.env.PORT || '18789', 10),
    host: process.env.GATEWAY_HOST || process.env.HOST || '0.0.0.0',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    heartbeatInterval: 30000,
    messageTimeout: 30000,
    maxMessageSize: 1024 * 1024, // 1MB
    auth: {
        enabled: process.env.GATEWAY_AUTH_ENABLED === 'true',
        token: process.env.GATEWAY_AUTH_TOKEN || null
    }
};

// A2A message prefix for Redis
const A2A_PREFIX = 'openclaw:a2a';

// ==============================================================================
// Gateway Server Class
// ==============================================================================
class OpenClawGateway extends EventEmitter {
    /**
     * Create gateway server instance
     */
    constructor(config = {}) {
        super();
        this.config = { ...CONFIG, ...config };
        this.isRunning = false;
        this.httpServer = null;
        this.wsServer = null;
        this.redisClient = null;
        this.agents = new Map(); // agentId -> { ws, registeredAt, lastSeen, metadata }
        this.pendingResponses = new Map(); // correlationId -> { resolve, reject, timeout }
        this.messageCounter = 0;
    }

    /**
     * Start the gateway server
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isRunning) {
            console.log('[Gateway] Already running');
            return;
        }

        try {
            // Create HTTP server
            this.httpServer = http.createServer(this._handleHttpRequest.bind(this));
            
            // Create WebSocket server
            this.wsServer = new WebSocket.Server({
                server: this.httpServer,
                path: '/a2a',
                maxPayload: this.config.maxMessageSize
            });

            // Connect to Redis
            await this._connectRedis();

            // Setup WebSocket handlers
            this._setupWebSocketHandlers();

            // Start HTTP server
            await this._startHttpServer();

            // Start heartbeat
            this._startHeartbeat();

            this.isRunning = true;
            console.log(`[Gateway] OpenClaw Gateway running on ws://${this.config.host}:${this.config.port}/a2a`);
            this.emit('started');

        } catch (error) {
            console.error('[Gateway] Failed to start:', error.message);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop the gateway server
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('[Gateway] Stopping...');

        // Stop heartbeat
        this._stopHeartbeat();

        // Close all agent connections
        for (const [agentId, agent] of this.agents) {
            if (agent.ws && agent.ws.readyState === WebSocket.OPEN) {
                agent.ws.close(1000, 'Gateway shutting down');
            }
        }
        this.agents.clear();

        // Reject pending responses
        for (const [correlationId, pending] of this.pendingResponses) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Gateway shutting down'));
        }
        this.pendingResponses.clear();

        // Close WebSocket server
        if (this.wsServer) {
            await this._closeWebSocketServer();
        }

        // Close HTTP server
        if (this.httpServer) {
            await this._closeHttpServer();
        }

        // Close Redis
        if (this.redisClient) {
            await this.redisClient.quit();
            this.redisClient = null;
        }

        this.isRunning = false;
        console.log('[Gateway] Stopped');
        this.emit('stopped');
    }

    /**
     * Send message to an agent
     * @param {string} toAgent - Target agent ID
     * @param {Object} message - Message content
     * @param {Object} options - Send options
     * @returns {Promise<Object>} Response from agent
     */
    async sendMessage(toAgent, message, options = {}) {
        return new Promise((resolve, reject) => {
            const agent = this.agents.get(toAgent);
            
            if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
                reject(new Error(`Agent ${toAgent} is not connected`));
                return;
            }

            const correlationId = `gw_${Date.now()}_${++this.messageCounter}`;
            
            const messagePayload = {
                type: 'message',
                agent: toAgent,
                correlationId,
                content: message.content || message,
                from: message.from || 'gateway',
                timestamp: new Date().toISOString(),
                ...message
            };

            const timeout = setTimeout(() => {
                this.pendingResponses.delete(correlationId);
                reject(new Error(`Message timeout for agent ${toAgent}`));
            }, options.timeout || this.config.messageTimeout);

            this.pendingResponses.set(correlationId, { resolve, reject, timeout });

            agent.ws.send(JSON.stringify(messagePayload));
        });
    }

    /**
     * Broadcast message to all agents
     * @param {Object} message - Message content
     * @returns {Promise<Object>} Broadcast result
     */
    async broadcast(message) {
        const results = [];
        const timestamp = new Date().toISOString();

        for (const [agentId, agent] of this.agents) {
            if (agent.ws && agent.ws.readyState === WebSocket.OPEN) {
                try {
                    agent.ws.send(JSON.stringify({
                        type: 'broadcast',
                        content: message.content || message,
                        from: message.from || 'gateway',
                        timestamp
                    }));
                    results.push({ agentId, success: true });
                } catch (error) {
                    results.push({ agentId, success: false, error: error.message });
                }
            }
        }

        // Also publish to Redis for external subscribers
        if (this.redisClient) {
            await this.redisClient.publish(`${A2A_PREFIX}:broadcast`, JSON.stringify({
                type: 'broadcast',
                content: message.content || message,
                from: message.from || 'gateway',
                timestamp,
                recipients: results.filter(r => r.success).map(r => r.agentId)
            }));
        }

        return {
            success: true,
            results,
            totalSent: results.filter(r => r.success).length,
            timestamp
        };
    }

    /**
     * Get list of connected agents
     * @returns {Array<string>} Agent IDs
     */
    getConnectedAgents() {
        return Array.from(this.agents.keys());
    }

    /**
     * Get gateway status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            running: this.isRunning,
            port: this.config.port,
            host: this.config.host,
            connectedAgents: this.agents.size,
            agents: this.getConnectedAgents(),
            redisConnected: !!this.redisClient,
            pendingResponses: this.pendingResponses.size,
            uptime: process.uptime()
        };
    }

    /**
     * Connect to Redis
     * @private
     */
    async _connectRedis() {
        return new Promise((resolve, reject) => {
            try {
                if (this.config.redisUrl) {
                    this.redisClient = new Redis(this.config.redisUrl, {
                        maxRetriesPerRequest: 3,
                        retryDelayOnFailover: 100
                    });
                } else {
                    this.redisClient = new Redis({
                        host: this.config.redisHost,
                        port: this.config.redisPort,
                        maxRetriesPerRequest: 3,
                        retryDelayOnFailover: 100
                    });
                }

                this.redisClient.on('connect', () => {
                    console.log('[Gateway] Connected to Redis');
                    resolve();
                });

                this.redisClient.on('error', (error) => {
                    console.error('[Gateway] Redis error:', error.message);
                    this.emit('redis-error', error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Setup WebSocket event handlers
     * @private
     */
    _setupWebSocketHandlers() {
        this.wsServer.on('connection', (ws, req) => {
            this._handleConnection(ws, req);
        });

        this.wsServer.on('error', (error) => {
            console.error('[Gateway] WebSocket server error:', error.message);
            this.emit('ws-error', error);
        });
    }

    /**
     * Handle new WebSocket connection
     * @private
     * @param {WebSocket} ws - WebSocket client
     * @param {http.IncomingMessage} req - HTTP request
     */
    _handleConnection(ws, req) {
        const agentId = this._extractAgentId(req);
        const clientId = this._generateClientId();

        console.log(`[Gateway] Connection from ${agentId || 'unknown'} (${clientId})`);

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'welcome',
            clientId,
            timestamp: new Date().toISOString(),
            gateway: {
                version: '1.0.0',
                port: this.config.port
            }
        }));

        // Handle incoming messages
        ws.on('message', (data) => {
            this._handleMessage(ws, agentId, data);
        });

        ws.on('close', () => {
            this._handleDisconnect(ws, agentId);
        });

        ws.on('error', (error) => {
            console.error(`[Gateway] Error for ${agentId || clientId}:`, error.message);
        });

        // Setup ping/pong
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });
    }

    /**
     * Handle WebSocket message
     * @private
     * @param {WebSocket} ws - WebSocket client
     * @param {string} agentId - Agent ID
     * @param {Buffer} data - Message data
     */
    async _handleMessage(ws, agentId, data) {
        try {
            const message = JSON.parse(data.toString());

            console.log(`[Gateway] Message from ${agentId || 'unknown'}:`, message.type);

            switch (message.type) {
                case 'register':
                    await this._handleRegister(ws, agentId, message);
                    break;

                case 'message':
                    await this._handleMessageRouting(ws, agentId, message);
                    break;

                case 'response':
                    await this._handleResponse(ws, agentId, message);
                    break;

                case 'broadcast':
                    await this._handleBroadcast(ws, agentId, message);
                    break;

                case 'ping':
                    this._handlePing(ws, agentId);
                    break;

                case 'discover':
                    await this._handleDiscover(ws, agentId);
                    break;

                case 'health':
                    await this._handleHealthCheck(ws, agentId);
                    break;

                default:
                    console.warn(`[Gateway] Unknown message type: ${message.type}`);
            }

        } catch (error) {
            console.error('[Gateway] Failed to parse message:', error.message);
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Invalid message format',
                timestamp: new Date().toISOString()
            }));
        }
    }

    /**
     * Handle agent registration
     * @private
     */
    async _handleRegister(ws, agentId, message) {
        const id = agentId || message.agentId;
        
        if (!id) {
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Agent ID required for registration'
            }));
            return;
        }

        // Register agent
        this.agents.set(id, {
            ws,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            metadata: message.metadata || {}
        });

        console.log(`[Gateway] Agent registered: ${id}`);

        // Store in Redis
        if (this.redisClient) {
            await this.redisClient.sadd(`${A2A_PREFIX}:agents`, id);
            await this.redisClient.hset(`${A2A_PREFIX}:agent:${id}`, {
                registeredAt: new Date().toISOString(),
                status: 'active',
                ...message.metadata
            });
        }

        ws.send(JSON.stringify({
            type: 'registered',
            agentId: id,
            timestamp: new Date().toISOString(),
            connectedAgents: this.getConnectedAgents()
        }));

        this.emit('agent-registered', { agentId: id });
    }

    /**
     * Handle message routing
     * @private
     */
    async _handleMessageRouting(ws, fromAgent, message) {
        const toAgent = message.agent || message.to;
        
        if (!toAgent) {
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Target agent required',
                correlationId: message.correlationId
            }));
            return;
        }

        const targetAgent = this.agents.get(toAgent);
        
        if (!targetAgent || targetAgent.ws.readyState !== WebSocket.OPEN) {
            // Agent not connected - store in Redis for later delivery
            if (this.redisClient) {
                const inboxKey = `${A2A_PREFIX}:inbox:${toAgent}`;
                await this.redisClient.lpush(inboxKey, JSON.stringify({
                    ...message,
                    from: fromAgent,
                    queuedAt: new Date().toISOString()
                }));
            }

            ws.send(JSON.stringify({
                type: 'error',
                error: `Agent ${toAgent} is not connected`,
                correlationId: message.correlationId,
                queued: true
            }));
            return;
        }

        // Forward message to target agent
        targetAgent.ws.send(JSON.stringify({
            ...message,
            from: fromAgent,
            timestamp: new Date().toISOString()
        }));

        // Update last seen
        if (fromAgent && this.agents.has(fromAgent)) {
            this.agents.get(fromAgent).lastSeen = new Date().toISOString();
        }
    }

    /**
     * Handle response message
     * @private
     */
    async _handleResponse(ws, agentId, message) {
        const correlationId = message.correlationId || message.inReplyTo;
        
        if (correlationId && this.pendingResponses.has(correlationId)) {
            const pending = this.pendingResponses.get(correlationId);
            clearTimeout(pending.timeout);
            this.pendingResponses.delete(correlationId);
            
            if (message.error) {
                pending.reject(new Error(message.error));
            } else {
                pending.resolve(message);
            }
        }
    }

    /**
     * Handle broadcast
     * @private
     */
    async _handleBroadcast(ws, fromAgent, message) {
        const result = await this.broadcast({
            from: fromAgent,
            content: message.content
        });

        ws.send(JSON.stringify({
            type: 'broadcast-result',
            ...result,
            correlationId: message.correlationId
        }));
    }

    /**
     * Handle ping
     * @private
     */
    _handlePing(ws, agentId) {
        ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            agentId
        }));

        // Update last seen
        if (agentId && this.agents.has(agentId)) {
            this.agents.get(agentId).lastSeen = new Date().toISOString();
        }
    }

    /**
     * Handle discover request
     * @private
     */
    async _handleDiscover(ws, agentId) {
        const agents = this.getConnectedAgents();
        const registeredAgents = this.redisClient 
            ? await this.redisClient.smembers(`${A2A_PREFIX}:agents`)
            : agents;

        ws.send(JSON.stringify({
            type: 'discover',
            connectedAgents: agents,
            registeredAgents,
            timestamp: new Date().toISOString()
        }));
    }

    /**
     * Handle health check
     * @private
     */
    async _handleHealthCheck(ws, agentId) {
        ws.send(JSON.stringify({
            type: 'health',
            status: this.getStatus(),
            timestamp: new Date().toISOString()
        }));
    }

    /**
     * Handle disconnection
     * @private
     */
    async _handleDisconnect(ws, agentId) {
        if (agentId && this.agents.has(agentId)) {
            this.agents.delete(agentId);
            console.log(`[Gateway] Agent disconnected: ${agentId}`);

            // Update Redis
            if (this.redisClient) {
                await this.redisClient.hset(`${A2A_PREFIX}:agent:${agentId}`, {
                    status: 'disconnected',
                    disconnectedAt: new Date().toISOString()
                });
            }

            this.emit('agent-disconnected', { agentId });
        }
    }

    /**
     * Handle HTTP requests
     * @private
     */
    _handleHttpRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);

        // Health check endpoint
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.getStatus()));
            return;
        }

        // Agents endpoint
        if (url.pathname === '/agents') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                connected: this.getConnectedAgents(),
                count: this.agents.size
            }));
            return;
        }

        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }

    /**
     * Start HTTP server
     * @private
     */
    async _startHttpServer() {
        return new Promise((resolve, reject) => {
            this.httpServer.listen(this.config.port, this.config.host, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Close HTTP server
     * @private
     */
    async _closeHttpServer() {
        return new Promise((resolve) => {
            if (this.httpServer) {
                this.httpServer.close(() => {
                    this.httpServer = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Close WebSocket server
     * @private
     */
    async _closeWebSocketServer() {
        return new Promise((resolve) => {
            if (this.wsServer) {
                this.wsServer.close(() => {
                    this.wsServer = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Start heartbeat interval
     * @private
     */
    _startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.wsServer.clients.forEach(ws => {
                if (!ws.isAlive) {
                    ws.terminate();
                    return;
                }
                ws.isAlive = false;
                ws.ping();
            });

            // Update agent status in Redis
            if (this.redisClient) {
                for (const [agentId, agent] of this.agents) {
                    this.redisClient.hset(`${A2A_PREFIX}:agent:${agentId}`, {
                        lastSeen: agent.lastSeen,
                        status: 'active'
                    });
                }
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat interval
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Extract agent ID from request
     * @private
     */
    _extractAgentId(req) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            return url.searchParams.get('agentId') || 
                   req.headers['x-agent-id'] ||
                   null;
        } catch {
            return null;
        }
    }

    /**
     * Generate unique client ID
     * @private
     */
    _generateClientId() {
        return `gw-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
}

// ==============================================================================
// Standalone Execution
// ==============================================================================
if (require.main === module) {
    const gateway = new OpenClawGateway();

    gateway.on('started', () => {
        console.log('[Gateway] Press Ctrl+C to stop');
    });

    gateway.on('error', (error) => {
        console.error('[Gateway] Error:', error.message);
    });

    gateway.on('stopped', () => {
        console.log('[Gateway] Gateway stopped');
        process.exit(0);
    });

    // Handle shutdown signals
    process.on('SIGINT', () => {
        console.log('[Gateway] Received SIGINT');
        gateway.stop();
    });

    process.on('SIGTERM', () => {
        console.log('[Gateway] Received SIGTERM');
        gateway.stop();
    });

    // Start gateway
    gateway.start().catch((error) => {
        console.error('[Gateway] Failed to start:', error.message);
        process.exit(1);
    });
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    OpenClawGateway,
    CONFIG,
    A2A_PREFIX
};
