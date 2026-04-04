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
    // AUDIT-FIX: A6 — Warn when using default Redis URL
    redisUrl: (() => { const u = process.env.REDIS_URL; if (!u) console.warn('[Gateway] REDIS_URL not set, using default'); return u || 'redis://localhost:6379'; })(),
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    heartbeatInterval: 30000,
    messageTimeout: 30000,
    maxMessageSize: 1024 * 1024, // 1MB
    auth: {
        // AUDIT-FIX: A2 - Default auth enabled in production for zero-trust security
        enabled: process.env.GATEWAY_AUTH_ENABLED !== undefined 
            ? process.env.GATEWAY_AUTH_ENABLED === 'true'
            : process.env.NODE_ENV === 'production',
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

            this.pendingResponses.set(correlationId, { resolve, reject, timeout, targetAgent: toAgent });

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

        // AUDIT-FIX: A10 — Parallelize broadcast with Promise.allSettled
        const agents = Array.from(this.agents.entries()).filter(
            ([_, agent]) => agent.ws && agent.ws.readyState === WebSocket.OPEN
        );

        const settled = await Promise.allSettled(
            agents.map(async ([agentId, agent]) => {
                try {
                    agent.ws.send(JSON.stringify({
                        type: 'broadcast',
                        content: message.content || message,
                        from: message.from || 'gateway',
                        timestamp
                    }));
                    return { agentId, success: true };
                } catch (error) {
                    return { agentId, success: false, error: error.message };
                }
            })
        );

        for (const r of settled) {
            if (r.status === 'fulfilled') results.push(r.value);
            else results.push({ agentId: 'unknown', success: false, error: r.reason?.message });
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
        // AUDIT-FIX: A2 - Enforce token authentication before processing connection
        // SKEP-03 FIX: Use crypto.timingSafeEqual to prevent timing attacks
        if (this.config.auth.enabled) {
            try {
                const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                const token = url.searchParams.get('token');
                
                if (!token) {
                    console.warn('[Gateway] Unauthorized connection attempt - missing token');
                    ws.close(4001, 'Unauthorized');
                    return;
                }
                
                // Use timing-safe comparison to prevent timing attacks
                const tokenBuffer = Buffer.from(token);
                const expectedBuffer = Buffer.from(this.config.auth.token);
                const isValid = tokenBuffer.length === expectedBuffer.length && 
                               crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
                
                if (!isValid) {
                    console.warn('[Gateway] Unauthorized connection attempt - invalid token');
                    ws.close(4001, 'Unauthorized');
                    return;
                }
            } catch (urlError) {
                console.error('[Gateway] Failed to parse connection URL:', urlError.message);
                ws.close(4001, 'Unauthorized');
                return;
            }
        }

        const rawAgentId = this._extractAgentId(req);
        // AUDIT-FIX: A7 — Sanitize agent ID to prevent Redis key injection
        const agentId = rawAgentId ? rawAgentId.replace(/[^a-zA-Z0-9\-_]/g, '') : rawAgentId;
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
        // AUDIT-FIX: A3 - Wrap JSON.parse with proper error handling
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (parseError) {
            // Log malformed message (truncated to 200 chars)
            const rawMsg = data.toString();
            const truncated = rawMsg.length > 200 ? rawMsg.substring(0, 200) + '...' : rawMsg;
            console.error(`[Gateway] Malformed JSON from ${agentId || 'unknown'}:`, truncated);
            
            // Send error response back to client
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Invalid JSON format',
                details: parseError.message,
                timestamp: new Date().toISOString()
            }));
            
            // Return early to prevent further processing
            return;
        }

        try {
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
                    this._handlePing(ws, agentId, message);
                    break;

                case 'pong':
                    this._handlePong(ws, agentId, message);
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
            console.error('[Gateway] Failed to process message:', error.message);
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Message processing failed',
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
     * Handle ping (heartbeat from agent)
     * @private
     * @param {WebSocket} ws - WebSocket client
     * @param {string} agentId - Agent ID
     * @param {Object} message - Ping message with heartbeat data
     */
    _handlePing(ws, agentId, message) {
        // Send pong response
        ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            agentId,
            heartbeat: {
                received: new Date().toISOString(),
                agentHeartbeat: message.heartbeat || {}
            }
        }));

        // Update last seen with heartbeat data
        if (agentId && this.agents.has(agentId)) {
            const agent = this.agents.get(agentId);
            agent.lastSeen = new Date().toISOString();
            
            // Store heartbeat metadata if provided
            if (message.heartbeat) {
                agent.lastHeartbeat = {
                    uptime: message.heartbeat.uptime,
                    memoryUsage: message.heartbeat.memoryUsage,
                    lastHeartbeatSent: message.heartbeat.lastHeartbeatSent,
                    receivedAt: agent.lastSeen
                };
            }
            
            // Update Redis with heartbeat status
            if (this.redisClient) {
                this.redisClient.hset(`${A2A_PREFIX}:agent:${agentId}`, {
                    lastSeen: agent.lastSeen,
                    status: 'active',
                    lastHeartbeatUptime: message.heartbeat?.uptime?.toString() || null
                });
            }
        }
    }

    /**
     * Handle pong (heartbeat acknowledgment from gateway)
     * @private
     * @param {WebSocket} ws - WebSocket client
     * @param {string} agentId - Agent ID
     * @param {Object} message - Pong message
     */
    _handlePong(ws, agentId, message) {
        console.log(`[Gateway] Heartbeat ack from ${agentId || 'unknown'} at ${message.timestamp}`);
        // Pong messages are acknowledgments - the agent handles the response internally
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

            // SKEP-06 FIX: Clean pendingResponses for the disconnected agent
            for (const [correlationId, pending] of this.pendingResponses) {
                // Check if this pending response is waiting for this agent
                // (We need to track which agent each pending response targets)
                if (pending.targetAgent === agentId) {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error(`Agent ${agentId} disconnected`));
                    this.pendingResponses.delete(correlationId);
                }
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

        // SKEP-01 FIX: Add auth check to HTTP endpoints (same as WebSocket)
        if (this.config.auth.enabled) {
            const token = url.searchParams.get('token');
            if (!token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(this.config.auth.token))) {
                console.warn('[Gateway] Unauthorized HTTP request - invalid or missing token');
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized', status: 401 }));
                return;
            }
        }

        // Health check endpoint - basic gateway health
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.getStatus()));
            return;
        }

        // Agents endpoint - list connected agents
        if (url.pathname === '/agents') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                connected: this.getConnectedAgents(),
                count: this.agents.size
            }));
            return;
        }

        // Agent status endpoint - detailed agent online/offline state tracking
        if (url.pathname === '/agent-status' || url.pathname.startsWith('/agent-status/')) {
            this._handleAgentStatusHttp(req, res, url);
            return;
        }

        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }

    /**
     * Handle agent status HTTP requests
     * @private
     * @param {http.IncomingMessage} req - HTTP request
     * @param {http.ServerResponse} res - HTTP response
     * @param {URL} url - Parsed URL
     */
    async _handleAgentStatusHttp(req, res, url) {
        const pathParts = url.pathname.split('/');
        const specificAgentId = pathParts[pathParts.length - 1];
        
        // GET /agent-status - all agents with status
        if (url.pathname === '/agent-status') {
            const agentStatus = [];
            
            for (const [agentId, agent] of this.agents) {
                const now = Date.now();
                const lastSeenTime = new Date(agent.lastSeen).getTime();
                const timeSinceLastSeen = now - lastSeenTime;
                
                // Consider agent offline if no heartbeat for more than 2 heartbeat intervals (60 seconds)
                const isOnline = agent.ws && agent.ws.readyState === WebSocket.OPEN && timeSinceLastSeen < (this.config.heartbeatInterval * 2);
                
                agentStatus.push({
                    agentId,
                    status: isOnline ? 'online' : 'offline',
                    lastSeen: agent.lastSeen,
                    registeredAt: agent.registeredAt,
                    metadata: agent.metadata,
                    websocketReadyState: agent.ws ? agent.ws.readyState : null,
                    timeSinceLastSeenMs: timeSinceLastSeen
                });
            }
            
            // Also include agents registered in Redis but not currently connected
            let redisAgents = [];
            if (this.redisClient) {
                redisAgents = await this.redisClient.smembers(`${A2A_PREFIX}:agents`);
            }
            
            const connectedAgentIds = new Set(this.agents.keys());
            for (const redisAgentId of redisAgents) {
                if (!connectedAgentIds.has(redisAgentId)) {
                    // Agent in Redis but not connected - get last known status
                    let agentData = {};
                    if (this.redisClient) {
                        agentData = await this.redisClient.hgetall(`${A2A_PREFIX}:agent:${redisAgentId}`);
                    }
                    
                    agentStatus.push({
                        agentId: redisAgentId,
                        status: 'offline',
                        lastSeen: agentData.lastSeen || null,
                        registeredAt: agentData.registeredAt || null,
                        metadata: {},
                        websocketReadyState: null,
                        timeSinceLastSeenMs: null
                    });
                }
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                timestamp: new Date().toISOString(),
                totalAgents: agentStatus.length,
                onlineCount: agentStatus.filter(a => a.status === 'online').length,
                offlineCount: agentStatus.filter(a => a.status === 'offline').length,
                agents: agentStatus
            }));
            return;
        }
        
        // GET /agent-status/{agentId} - specific agent status
        if (specificAgentId && specificAgentId !== 'agent-status') {
            const agent = this.agents.get(specificAgentId);
            
            if (!agent) {
                // Check Redis for last known status
                let redisData = {};
                if (this.redisClient) {
                    redisData = await this.redisClient.hgetall(`${A2A_PREFIX}:agent:${specificAgentId}`);
                }
                
                if (Object.keys(redisData).length > 0) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        agentId: specificAgentId,
                        status: 'offline',
                        lastSeen: redisData.lastSeen || null,
                        registeredAt: redisData.registeredAt || null,
                        metadata: redisData,
                        websocketReadyState: null,
                        note: 'Agent not currently connected, showing last known status from Redis'
                    }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Agent ${specificAgentId} not found` }));
                }
                return;
            }
            
            const now = Date.now();
            const lastSeenTime = new Date(agent.lastSeen).getTime();
            const timeSinceLastSeen = now - lastSeenTime;
            const isOnline = agent.ws && agent.ws.readyState === WebSocket.OPEN && timeSinceLastSeen < (this.config.heartbeatInterval * 2);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                agentId: specificAgentId,
                status: isOnline ? 'online' : 'offline',
                lastSeen: agent.lastSeen,
                registeredAt: agent.registeredAt,
                metadata: agent.metadata,
                websocketReadyState: agent.ws ? agent.ws.readyState : null,
                timeSinceLastSeenMs: timeSinceLastSeen
            }));
            return;
        }
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
