/**
 * Heretek OpenClaw — Redis to WebSocket Bridge
 * ==============================================================================
 * Bridges Redis pub/sub messages to WebSocket clients for real-time A2A updates.
 * 
 * Architecture:
 *   Redis Pub/Sub --> Bridge --> WebSocket Clients
 *   
 *   - Subscribes to Redis A2A channels
 *   - Broadcasts messages to connected WebSocket clients
 *   - Manages client connections and disconnections
 * 
 * Usage:
 *   const { startBridge, stopBridge, getBridge } = require('./redis-websocket-bridge');
 *   
 *   // Start the bridge
 *   await startBridge({ wsPort: 3002, redisUrl: 'redis://localhost:6379' });
 *   
 *   // Get bridge instance
 *   const bridge = getBridge();
 *   bridge.broadcast({ type: 'a2a', data: 'Hello all clients!' });
 *   
 *   // Stop the bridge
 *   await stopBridge();
 * ==============================================================================
 */

const WebSocket = require('ws');
const Redis = require('ioredis');
const EventEmitter = require('events');

// ==============================================================================
// Configuration
// ==============================================================================
const DEFAULT_CONFIG = {
    wsPort: 3002,
    wsHost: '0.0.0.0',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: process.env.REDIS_PORT || 6379,
    a2aChannel: 'openclaw:a2a:broadcast',
    heartbeatChannel: 'openclaw:a2a:heartbeat',
    reconnectDelay: 3000,
    maxReconnectAttempts: 10
};

// ==============================================================================
// Redis to WebSocket Bridge Class
// ==============================================================================
class RedisToWebSocketBridge extends EventEmitter {
    /**
     * Create a new bridge instance
     * @param {Object} config - Bridge configuration
     */
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.isRunning = false;
        this.clients = new Set();
        this.wsServer = null;
        this.redisClient = null;
        this.pubSubClient = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
    }

    /**
     * Start the bridge
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isRunning) {
            console.log('[Redis-WS Bridge] Bridge already running');
            return;
        }

        try {
            // Create Redis client for pub/sub
            await this._createRedisClient();
            
            // Create WebSocket server
            await this._createWebSocketServer();
            
            // Subscribe to Redis channels
            await this._subscribeToChannels();
            
            this.isRunning = true;
            this.reconnectAttempts = 0;
            
            console.log(`[Redis-WS Bridge] Started on ws://${this.config.wsHost}:${this.config.wsPort}`);
            this.emit('started');
            
        } catch (error) {
            console.error('[Redis-WS Bridge] Failed to start:', error.message);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop the bridge
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('[Redis-WS Bridge] Stopping...');
        
        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Close WebSocket server
        if (this.wsServer) {
            await this._closeWebSocketServer();
        }

        // Close Redis connections
        if (this.redisClient) {
            await this.redisClient.quit();
            this.redisClient = null;
        }
        if (this.pubSubClient) {
            await this.pubSubClient.quit();
            this.pubSubClient = null;
        }

        // Clear clients
        this.clients.clear();
        this.isRunning = false;

        console.log('[Redis-WS Bridge] Stopped');
        this.emit('stopped');
    }

    /**
     * Broadcast message to all connected WebSocket clients
     * @param {Object} message - Message to broadcast
     */
    broadcast(message) {
        const payload = JSON.stringify({
            ...message,
            timestamp: message.timestamp || new Date().toISOString()
        });

        const failedClients = [];

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(payload);
                } catch (error) {
                    console.error('[Redis-WS Bridge] Failed to send to client:', error.message);
                    failedClients.push(client);
                }
            } else {
                failedClients.push(client);
            }
        });

        // Remove failed clients
        failedClients.forEach(client => {
            this.clients.delete(client);
            try {
                client.terminate();
            } catch (e) {
                // Ignore
            }
        });

        if (failedClients.length > 0) {
            console.log(`[Redis-WS Bridge] Removed ${failedClients.length} failed clients`);
        }
    }

    /**
     * Get bridge status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            running: this.isRunning,
            clients: this.clients.size,
            port: this.config.wsPort,
            host: this.config.wsHost,
            redisConnected: !!this.redisClient,
            pubSubConnected: !!this.pubSubClient,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Create Redis client
     * @private
     */
    async _createRedisClient() {
        return new Promise((resolve, reject) => {
            try {
                // Use URL if available, otherwise use host/port
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
                    console.log('[Redis-WS Bridge] Connected to Redis');
                    resolve();
                });

                this.redisClient.on('error', (error) => {
                    console.error('[Redis-WS Bridge] Redis error:', error.message);
                    this.emit('redis-error', error);
                    this._handleRedisReconnect();
                });

                this.redisClient.on('close', () => {
                    console.log('[Redis-WS Bridge] Redis connection closed');
                    this.emit('redis-close');
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Create pub/sub Redis client
     * @private
     */
    async _createPubSubClient() {
        return new Promise((resolve, reject) => {
            try {
                if (this.config.redisUrl) {
                    this.pubSubClient = new Redis(this.config.redisUrl, {
                        maxRetriesPerRequest: 3
                    });
                } else {
                    this.pubSubClient = new Redis({
                        host: this.config.redisHost,
                        port: this.config.redisPort,
                        maxRetriesPerRequest: 3
                    });
                }

                this.pubSubClient.on('connect', () => {
                    console.log('[Redis-WS Bridge] Pub/Sub client connected');
                    resolve();
                });

                this.pubSubClient.on('error', (error) => {
                    console.error('[Redis-WS Bridge] Pub/Sub error:', error.message);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Subscribe to Redis channels
     * @private
     */
    async _subscribeToChannels() {
        if (!this.pubSubClient) {
            await this._createPubSubClient();
        }

        try {
            await this.pubSubClient.subscribe(this.config.a2aChannel);
            console.log(`[Redis-WS Bridge] Subscribed to ${this.config.a2aChannel}`);

            this.pubSubClient.on('message', (channel, message) => {
                this._handleRedisMessage(channel, message);
            });

        } catch (error) {
            console.error('[Redis-WS Bridge] Failed to subscribe:', error.message);
            throw error;
        }
    }

    /**
     * Handle Redis message
     * @private
     * @param {string} channel - Redis channel
     * @param {string} message - Message content
     */
    _handleRedisMessage(channel, message) {
        try {
            const data = JSON.parse(message);
            
            console.log(`[Redis-WS Bridge] Message from ${channel}:`, data.type);
            
            // Forward to WebSocket clients
            this.broadcast({
                channel,
                ...data
            });

            this.emit('message', { channel, data });

        } catch (error) {
            console.error('[Redis-WS Bridge] Failed to parse Redis message:', error.message);
        }
    }

    /**
     * Create WebSocket server
     * @private
     */
    async _createWebSocketServer() {
        return new Promise((resolve, reject) => {
            try {
                this.wsServer = new WebSocket.Server({
                    port: this.config.wsPort,
                    host: this.config.wsHost,
                    path: '/a2a'
                });

                this.wsServer.on('listening', () => {
                    resolve();
                });

                this.wsServer.on('error', (error) => {
                    console.error('[Redis-WS Bridge] WebSocket server error:', error.message);
                    this.emit('ws-error', error);
                    reject(error);
                });

                this.wsServer.on('connection', (ws, req) => {
                    this._handleWebSocketConnection(ws, req);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle WebSocket connection
     * @private
     * @param {WebSocket} ws - WebSocket client
     * @param {http.IncomingMessage} req - HTTP request
     */
    _handleWebSocketConnection(ws, req) {
        const clientId = this._generateClientId();
        ws.id = clientId;
        ws.isAlive = true;

        console.log(`[Redis-WS Bridge] Client ${clientId} connected from ${req.socket.remoteAddress}`);

        this.clients.add(ws);
        this.emit('client-connected', { clientId, address: req.socket.remoteAddress });

        // Send welcome message
        this._sendToClient(ws, {
            type: 'welcome',
            clientId,
            timestamp: new Date().toISOString(),
            channels: [this.config.a2aChannel, this.config.heartbeatChannel]
        });

        // Handle ping/pong
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Handle messages from client
        ws.on('message', (message) => {
            this._handleClientMessage(ws, message);
        });

        // Handle disconnection
        ws.on('close', () => {
            this.clients.delete(ws);
            this.emit('client-disconnected', { clientId });
            console.log(`[Redis-WS Bridge] Client ${clientId} disconnected`);
        });

        ws.on('error', (error) => {
            console.error(`[Redis-WS Bridge] Error for client ${clientId}:`, error.message);
            this.clients.delete(ws);
        });
    }

    /**
     * Handle message from WebSocket client
     * @private
     * @param {WebSocket} ws - WebSocket client
     * @param {string} message - Message content
     */
    _handleClientMessage(ws, message) {
        try {
            const data = JSON.parse(message.toString());

            switch (data.type) {
                case 'ping':
                    this._sendToClient(ws, {
                        type: 'pong',
                        timestamp: Date.now()
                    });
                    break;

                case 'subscribe':
                    this.emit('client-subscribed', {
                        clientId: ws.id,
                        channels: data.channels
                    });
                    break;

                case 'unsubscribe':
                    this.emit('client-unsubscribed', {
                        clientId: ws.id
                    });
                    break;

                case 'publish':
                    // Publish message to Redis
                    if (this.pubSubClient && data.channel && data.message) {
                        this.pubSubClient.publish(data.channel, JSON.stringify(data.message));
                    }
                    break;

                default:
                    console.warn(`[Redis-WS Bridge] Unknown message type from ${ws.id}:`, data.type);
            }

        } catch (error) {
            console.error('[Redis-WS Bridge] Failed to parse client message:', error.message);
        }
    }

    /**
     * Send message to specific client
     * @private
     * @param {WebSocket} ws - WebSocket client
     * @param {Object} message - Message to send
     */
    _sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Close WebSocket server
     * @private
     */
    async _closeWebSocketServer() {
        return new Promise((resolve) => {
            if (!this.wsServer) {
                resolve();
                return;
            }

            // Close all clients
            this.clients.forEach(client => {
                client.close();
            });
            this.clients.clear();

            this.wsServer.close(() => {
                console.log('[Redis-WS Bridge] WebSocket server closed');
                this.wsServer = null;
                resolve();
            });
        });
    }

    /**
     * Handle Redis reconnection
     * @private
     */
    _handleRedisReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('[Redis-WS Bridge] Max reconnect attempts reached');
            this.emit('max-reconnect-attempts');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectDelay * this.reconnectAttempts;

        console.log(`[Redis-WS Bridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this._createRedisClient();
                await this._createPubSubClient();
                await this._subscribeToChannels();
                console.log('[Redis-WS Bridge] Reconnected to Redis');
            } catch (error) {
                this._handleRedisReconnect();
            }
        }, delay);
    }

    /**
     * Generate unique client ID
     * @private
     * @returns {string} Client ID
     */
    _generateClientId() {
        return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ==============================================================================
// Singleton Instance
// ==============================================================================
let bridgeInstance = null;

/**
 * Get or create bridge singleton instance
 * @param {Object} config - Bridge configuration
 * @returns {RedisToWebSocketBridge} Bridge instance
 */
function getBridge(config = {}) {
    if (!bridgeInstance) {
        bridgeInstance = new RedisToWebSocketBridge(config);
    }
    return bridgeInstance;
}

/**
 * Start the bridge singleton
 * @param {Object} config - Bridge configuration
 * @returns {Promise<RedisToWebSocketBridge>} Bridge instance
 */
async function startBridge(config = {}) {
    if (!bridgeInstance) {
        bridgeInstance = new RedisToWebSocketBridge(config);
    }
    await bridgeInstance.start();
    return bridgeInstance;
}

/**
 * Stop the bridge singleton
 * @returns {Promise<void>}
 */
async function stopBridge() {
    if (bridgeInstance) {
        await bridgeInstance.stop();
        bridgeInstance = null;
    }
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    RedisToWebSocketBridge,
    getBridge,
    startBridge,
    stopBridge,
    
    // Channel constants
    CHANNELS: {
        A2A: 'openclaw:a2a:broadcast',
        HEARTBEAT: 'openclaw:a2a:heartbeat'
    }
};
