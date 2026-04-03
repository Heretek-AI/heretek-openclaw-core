/**
 * Heretek OpenClaw — A2A Message Send Skill (Redis + ACP Dual-Mode)
 * ==============================================================================
 * Provides agent-to-agent communication via Redis pub/sub (queue-and-deliver)
 * with optional real-time delivery via ACP WebSocket adapter.
 *
 * **MIGRATED from:** `gateway/openclaw-gateway.js` JS protocol
 * **MIGRATION NOTES:**
 *   - Redis key space (`openclaw:a2a:*`) is shared with npm gateway — no migration needed
 *   - Real-time delivery now routes via ACP adapter when agent is WS-connected
 *   - Fallback: Redis queue (works offline, used by npm gateway internally)
 *
 * Features:
 *   - Send messages between agents via Redis lists (compatible with npm gateway)
 *   - Real-time delivery via ACP WebSocket when connected
 *   - Broadcast to specific agents or all agents
 *   - Message persistence in Redis (inbox pattern)
 *   - Inbox management (get, count, clear messages)
 *   - Ping/pong health checks
 *   - Priority messaging support
 *
 * Redis Structure (npm gateway compatible):
 *   - openclaw:a2a:inbox:{agentId} - List of messages for agent
 *   - openclaw:a2a:agents - Set of registered agents
 *   - openclaw:a2a:broadcast - Pub/sub channel for broadcasts
 *   - openclaw:a2a:agent:{agentId} - Agent metadata (hash)
 *
 * ACP Mode:
 *   When an agent is connected via ACP WebSocket (using acp-adapter.js),
 *   messages are delivered in real-time. When offline, messages queue
 *   in Redis and are delivered on next connect.
 *
 * Usage:
 *   const { sendMessage, broadcast, getMessages, connectACP } = require('./a2a-redis.js');
 *
 *   // Basic send (Redis queue, works with npm gateway)
 *   const result = await sendMessage('steward', 'alpha', 'Hello Alpha!');
 *
 *   // Real-time send via ACP WebSocket
 *   await connectACP({ agentId: 'alpha', token: '...' });
 *   const result = await sendMessage('steward', 'alpha', 'Urgent!', { via: 'acp' });
 *
 *   // Broadcast to triad
 *   const result = await broadcastToTriad('steward', 'Triad meeting in 5');
 *
 *   // Get messages
 *   const messages = await getMessages('alpha', 10);
 * ==============================================================================
 */

const Redis = require('ioredis');

// ==============================================================================
// Configuration
// ==============================================================================
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const A2A_PREFIX = 'openclaw:a2a';

// Known agents in the OpenClaw collective
const KNOWN_AGENTS = [
    'steward', 'alpha', 'beta', 'charlie',
    'examiner', 'explorer', 'sentinel', 'coder',
    'dreamer', 'empath', 'historian', 'arbiter',
    'catalyst', 'chronos', 'coordinator', 'echo',
    'habit-forge', 'metis', 'nexus', 'perceiver',
    'prism', 'sentinel-prime'
];

// Triad members for deliberation
const TRIAD_AGENTS = ['alpha', 'beta', 'charlie'];

// Redis client singleton
let redisClient = null;

// ACP adapter singleton (optional — for real-time delivery)
let acpAdapter = null;

// ==============================================================================
// Redis Connection
// ==============================================================================

/**
 * Get or create Redis client
 * @returns {Promise<Redis>} Redis client instance
 */
async function getRedisClient() {
    if (redisClient) {
        return redisClient;
    }

    try {
        const url = process.env.REDIS_URL;
        if (url) {
            redisClient = new Redis(url, {
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100,
                lazyConnect: true
            });
        } else {
            redisClient = new Redis({
                host: REDIS_HOST,
                port: REDIS_PORT,
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100,
                lazyConnect: true
            });
        }

        await redisClient.ping();
        console.log('[A2A Redis] Connected to Redis');
        return redisClient;
    } catch (error) {
        console.error('[A2A Redis] Failed to connect to Redis:', error.message);
        throw new Error(`Redis connection failed: ${error.message}`);
    }
}

/**
 * Close Redis client connection
 */
async function closeRedisClient() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('[A2A Redis] Redis connection closed');
    }
}

// ==============================================================================
// ACP Connection (optional real-time layer)
// ==============================================================================

/**
 * Connect to npm gateway via ACP WebSocket for real-time message delivery.
 * When connected, messages are sent directly via WebSocket instead of Redis queue.
 *
 * @param {Object} options - ACP connection options
 * @param {string} options.agentId - Agent ID to register as
 * @param {string} [options.token] - Gateway auth token (from openclaw.json)
 * @param {string} [options.gatewayUrl] - Gateway WebSocket URL
 * @returns {Promise<ACPAdapter>} ACP adapter instance
 */
async function connectACP(options = {}) {
    // Lazy-load adapter to avoid hard dependency when only Redis needed
    let ACPAdapter;
    try {
        ACPAdapter = require('../modules/adapters/acp-adapter.js').ACPAdapter;
    } catch {
        throw new Error(
            '[A2A Redis] connectACP requires modules/adapters/acp-adapter.js. ' +
            'Run: cp modules/adapters/acp-adapter.js /root/heretek/heretek-openclaw-core/modules/adapters/acp-adapter.js'
        );
    }

    const token = options.token || process.env.OPENCLAW_GATEWAY_TOKEN;
    const gatewayUrl = options.gatewayUrl || process.env.OPENCLAW_GATEWAY_WS || 'ws://localhost:18789/a2a';

    acpAdapter = await ACPAdapter.connect({
        agentId: options.agentId,
        token,
        gatewayUrl
    });

    // Forward ACP messages to Redis inbox for persistence
    acpAdapter.on('message', async (msg) => {
        console.log(`[A2A ACP] Real-time message from ${msg.from}:`, String(msg.content).slice(0, 80));
        // Also store in Redis inbox for durability
        try {
            const client = await getRedisClient();
            const inboxKey = `${A2A_PREFIX}:inbox:${options.agentId}`;
            await client.lpush(inboxKey, JSON.stringify({
                messageId: msg.messageId || `acp_${Date.now()}`,
                from: msg.from,
                to: options.agentId,
                content: msg.content,
                timestamp: msg.timestamp || new Date().toISOString(),
                via: 'acp'
            }));
        } catch (err) {
            console.error('[A2A ACP] Failed to store ACP message in Redis:', err.message);
        }
    });

    console.log(`[A2A ACP] Connected as ${options.agentId}`);
    return acpAdapter;
}

/**
 * Disconnect ACP adapter
 */
async function disconnectACP() {
    if (acpAdapter) {
        await acpAdapter.close();
        acpAdapter = null;
        console.log('[A2A ACP] Disconnected');
    }
}

/**
 * Check if ACP is connected
 * @returns {boolean}
 */
function isACPConnected() {
    return acpAdapter !== null && acpAdapter.connected;
}

// ==============================================================================
// Message Utilities
// ==============================================================================

function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateAgentId(agentId) {
    if (!agentId || typeof agentId !== 'string') return false;
    return /^[a-z][a-z0-9-]*$/.test(agentId);
}

function validateMessage(message) {
    const errors = [];
    if (!message) { errors.push('Message is required'); return { valid: false, errors }; }
    if (!message.from || !validateAgentId(message.from)) errors.push('Invalid or missing sender (from)');
    if (!message.to && !message.broadcast && !message.via) errors.push('Message must have recipient (to) or be a broadcast');
    if (message.to && !validateAgentId(message.to)) errors.push('Invalid recipient (to)');
    if (message.content === undefined || message.content === null) errors.push('Message content is required');
    return { valid: errors.length === 0, errors };
}

function createMessage(from, to, content, options = {}) {
    return {
        messageId: generateMessageId(),
        from,
        to,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        timestamp: new Date().toISOString(),
        priority: options.priority || 'normal',
        type: options.type || 'task',
        inReplyTo: options.inReplyTo,
        metadata: options.metadata || {}
    };
}

// ==============================================================================
// Core Messaging Functions
// ==============================================================================

/**
 * Send a message to another agent
 *
 * Delivery priority:
 *   1. If ACP connected and agent is online → real-time WebSocket
 *   2. If ACP connected but agent is offline → Redis queue
 *   3. Always: Redis queue (for npm gateway compatibility)
 *
 * @param {string} from - Sender agent ID
 * @param {string} to - Recipient agent ID
 * @param {string|Object} content - Message content
 * @param {Object} [options]
 * @param {string} [options.via='redis'] - 'acp' for real-time, 'redis' for queue-only
 * @param {string} [options.priority] - 'high', 'normal', 'low'
 * @returns {Promise<Object>} Send result with messageId, success flag
 */
async function sendMessage(from, to, content, options = {}) {
    try {
        const client = await getRedisClient();

        if (!validateAgentId(from)) throw new Error(`Invalid sender agent ID: ${from}`);
        if (!validateAgentId(to)) throw new Error(`Invalid recipient agent ID: ${to}`);

        const message = createMessage(from, to, content, options);
        const validation = validateMessage(message);
        if (!validation.valid) throw new Error(`Invalid message: ${validation.errors.join(', ')}`);

        // Always store in Redis inbox (npm gateway compatible)
        const inboxKey = `${A2A_PREFIX}:inbox:${to}`;
        await client.lpush(inboxKey, JSON.stringify(message));

        // Register agents in set
        await client.sadd(`${A2A_PREFIX}:agents`, from, to);

        // Publish to broadcast channel
        await client.publish(`${A2A_PREFIX}:broadcast`, JSON.stringify({
            ...message,
            action: 'message'
        }));

        // Try real-time delivery via ACP if connected
        let acpDelivered = false;
        if (acpAdapter && acpAdapter.authenticated) {
            try {
                // Check if recipient is connected via ACP (have pub/sub knowledge)
                // For now, always also send via ACP when connected
                await acpAdapter.sendMessage(to, message.content, {
                    messageId: message.messageId,
                    priority: message.priority,
                    type: message.type
                });
                acpDelivered = true;
            } catch (err) {
                console.warn(`[A2A] ACP real-time delivery to ${to} failed:`, err.message);
            }
        }

        console.log(`[A2A] ${from} → ${to}: ${message.messageId}${acpDelivered ? ' [ACP real-time]' : ' [Redis queued]'}`);

        return {
            success: true,
            messageId: message.messageId,
            from: message.from,
            to: message.to,
            timestamp: message.timestamp,
            priority: message.priority,
            acpDelivered
        };
    } catch (error) {
        console.error('[A2A] sendMessage error:', error.message);
        return { success: false, error: error.message, from, to };
    }
}

/**
 * Get messages from agent's inbox
 * @param {string} agentId - Agent ID
 * @param {number} [limit=10] - Max messages
 * @returns {Promise<Array>}
 */
async function getMessages(agentId, limit = 10) {
    try {
        const client = await getRedisClient();
        if (!validateAgentId(agentId)) throw new Error(`Invalid agent ID: ${agentId}`);
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const messages = await client.lrange(inboxKey, 0, limit - 1);
        return messages.map(msg => {
            try { return JSON.parse(msg); }
            catch { return { raw: msg, parseError: true }; }
        });
    } catch (error) {
        console.error('[A2A] getMessages error:', error.message);
        return [];
    }
}

/**
 * Get unread messages
 * @param {string} agentId - Agent ID
 * @param {number} [limit=10] - Max messages
 * @returns {Promise<Array>}
 */
async function getUnreadMessages(agentId, limit = 10) {
    try {
        const client = await getRedisClient();
        if (!validateAgentId(agentId)) throw new Error(`Invalid agent ID: ${agentId}`);
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const readSetKey = `${A2A_PREFIX}:read:${agentId}`;
        const messages = await client.lrange(inboxKey, 0, limit - 1);
        const readIds = await client.smembers(readSetKey);
        const readSet = new Set(readIds);
        return messages
            .map(msg => { try { return JSON.parse(msg); } catch { return null; } })
            .filter(msg => msg && !readSet.has(msg.messageId));
    } catch (error) {
        console.error('[A2A] getUnreadMessages error:', error.message);
        return [];
    }
}

/**
 * Mark message as read
 * @param {string} agentId - Agent ID
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>}
 */
async function markAsRead(agentId, messageId) {
    try {
        const client = await getRedisClient();
        if (!validateAgentId(agentId)) throw new Error(`Invalid agent ID: ${agentId}`);
        const readSetKey = `${A2A_PREFIX}:read:${agentId}`;
        await client.sadd(readSetKey, messageId);
        return { success: true, agentId, messageId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Count inbox messages
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object>}
 */
async function countMessages(agentId) {
    try {
        const client = await getRedisClient();
        if (!validateAgentId(agentId)) throw new Error(`Invalid agent ID: ${agentId}`);
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const count = await client.llen(inboxKey);
        return { count, agentId };
    } catch (error) {
        return { count: 0, agentId, error: error.message };
    }
}

/**
 * Clear inbox
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object>}
 */
async function clearMessages(agentId) {
    try {
        const client = await getRedisClient();
        if (!validateAgentId(agentId)) throw new Error(`Invalid agent ID: ${agentId}`);
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const readSetKey = `${A2A_PREFIX}:read:${agentId}`;
        await client.del(inboxKey);
        await client.del(readSetKey);
        return { success: true, agentId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==============================================================================
// Broadcast Functions
// ==============================================================================

/**
 * Broadcast to array of agents
 */
async function broadcastToAgents(from, agents, content) {
    const results = await Promise.all(agents.map(agent => sendMessage(from, agent, content)));
    const sentTo = results.filter(r => r.success).map(r => r.to);
    return { success: true, from, sentTo, count: sentTo.length, timestamp: new Date().toISOString() };
}

/**
 * Broadcast to triad (alpha, beta, charlie)
 */
async function broadcastToTriad(from, content) {
    return broadcastToAgents(from, TRIAD_AGENTS, content);
}

/**
 * Broadcast to all known agents
 */
async function broadcastToAll(from, content) {
    return broadcastToAgents(from, KNOWN_AGENTS, content);
}

/**
 * Broadcast (alias for broadcastToAll)
 */
async function broadcast(from, content) {
    return broadcastToAll(from, content);
}

// ==============================================================================
// Health Check Functions
// ==============================================================================

/**
 * Ping an agent (via Redis queue — always works, real-time if ACP connected)
 */
async function pingAgent(from, to) {
    const startTime = Date.now();
    try {
        const client = await getRedisClient();
        if (!validateAgentId(from)) throw new Error(`Invalid sender: ${from}`);
        if (!validateAgentId(to)) throw new Error(`Invalid target: ${to}`);

        const pingMessage = {
            messageId: generateMessageId(),
            from,
            to,
            type: 'ping',
            content: 'ping',
            timestamp: new Date().toISOString()
        };

        const inboxKey = `${A2A_PREFIX}:inbox:${to}`;
        await client.lpush(inboxKey, JSON.stringify(pingMessage));

        const latency = Date.now() - startTime;
        const isRegistered = await client.sismember(`${A2A_PREFIX}:agents`, to);

        // Try ACP ping if connected
        let acpPing = null;
        if (acpAdapter && acpAdapter.authenticated) {
            try {
                const pong = await acpAdapter.ping(to);
                acpPing = { success: true, latency: Date.now() - startTime };
            } catch {
                acpPing = { success: false };
            }
        }

        return {
            success: true,
            response: 'pong',
            latency,
            target: to,
            registered: isRegistered === 1,
            acpPing
        };
    } catch (error) {
        return { success: false, error: error.message, latency: Date.now() - startTime, target: to };
    }
}

/**
 * Ping triad members
 */
async function pingTriad(from) {
    const results = await Promise.all(TRIAD_AGENTS.map(agent => pingAgent(from, agent)));
    const responses = {};
    TRIAD_AGENTS.forEach((agent, i) => { responses[agent] = results[i]; });
    return { success: true, from, responses, timestamp: new Date().toISOString() };
}

// ==============================================================================
// Agent Registration
// ==============================================================================

/**
 * Register agent in A2A system
 */
async function registerAgent(agentId, metadata = {}) {
    try {
        const client = await getRedisClient();
        if (!validateAgentId(agentId)) throw new Error(`Invalid agent ID: ${agentId}`);
        await client.sadd(`${A2A_PREFIX}:agents`, agentId);
        const agentKey = `${A2A_PREFIX}:agent:${agentId}`;
        await client.hset(agentKey, {
            id: agentId,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            status: 'active',
            ...metadata
        });
        console.log(`[A2A] Agent registered: ${agentId}`);
        return { success: true, agentId, timestamp: new Date().toISOString() };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get registered agents
 */
async function getRegisteredAgents() {
    try {
        const client = await getRedisClient();
        return await client.smembers(`${A2A_PREFIX}:agents`);
    } catch (error) {
        console.error('[A2A] getRegisteredAgents error:', error.message);
        return [];
    }
}

/**
 * Unregister agent
 */
async function unregisterAgent(agentId) {
    try {
        const client = await getRedisClient();
        if (!validateAgentId(agentId)) throw new Error(`Invalid agent ID: ${agentId}`);
        await client.srem(`${A2A_PREFIX}:agents`, agentId);
        await client.del(`${A2A_PREFIX}:agent:${agentId}`);
        console.log(`[A2A] Agent unregistered: ${agentId}`);
        return { success: true, agentId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==============================================================================
// ACP Status
// ==============================================================================

/**
 * Get ACP connection status
 */
function getACPStatus() {
    if (!acpAdapter) return { connected: false };
    return {
        connected: acpAdapter.connected,
        authenticated: acpAdapter.authenticated,
        clientId: acpAdapter.clientId
    };
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    // Core messaging
    sendMessage,
    getMessages,
    getUnreadMessages,
    markAsRead,
    countMessages,
    clearMessages,

    // Broadcast
    broadcast,
    broadcastToAll,
    broadcastToAgents,
    broadcastToTriad,

    // Health checks
    pingAgent,
    pingTriad,

    // Validation
    validateMessage,
    validateAgentId,

    // Agent registration
    registerAgent,
    unregisterAgent,
    getRegisteredAgents,

    // ACP real-time layer (optional)
    connectACP,
    disconnectACP,
    isACPConnected,
    getACPStatus,

    // Connection management
    getRedisClient,
    closeRedisClient,

    // Constants
    KNOWN_AGENTS,
    TRIAD_AGENTS,
    A2A_PREFIX
};
