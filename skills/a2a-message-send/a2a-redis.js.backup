/**
 * Heretek OpenClaw — A2A Message Send Skill (Redis-based)
 * ==============================================================================
 * Provides agent-to-agent communication via Redis pub/sub messaging.
 * 
 * Features:
 *   - Send messages between agents via Redis lists
 *   - Broadcast to specific agents or all agents
 *   - Message persistence in Redis
 *   - Inbox management (get, count, clear messages)
 *   - Ping/pong health checks
 *   - Message validation
 *   - Priority messaging support
 * 
 * Redis Structure:
 *   - openclaw:a2a:inbox:{agentId} - List of messages for agent
 *   - openclaw:a2a:agents - Set of registered agents
 *   - openclaw:a2a:broadcast - Pub/sub channel for broadcasts
 * 
 * Usage:
 *   const { sendMessage, broadcast, getMessages } = require('./a2a-redis.js');
 *   
 *   // Send message
 *   const result = await sendMessage('steward', 'alpha', 'Hello Alpha!');
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
        // Try REDIS_URL first, then fall back to HOST/PORT
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

        // Test connection
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
// Message Utilities
// ==============================================================================

/**
 * Generate unique message ID
 * @returns {string} Unique message ID
 */
function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate agent ID format
 * @param {string} agentId - Agent ID to validate
 * @returns {boolean} True if valid
 */
function validateAgentId(agentId) {
    if (!agentId || typeof agentId !== 'string') {
        return false;
    }
    // Valid agent IDs: lowercase letters, numbers, hyphens
    return /^[a-z][a-z0-9-]*$/.test(agentId);
}

/**
 * Validate message format
 * @param {Object} message - Message to validate
 * @returns {Object} Validation result with valid flag and errors
 */
function validateMessage(message) {
    const errors = [];
    
    if (!message) {
        errors.push('Message is required');
        return { valid: false, errors };
    }
    
    if (!message.from || !validateAgentId(message.from)) {
        errors.push('Invalid or missing sender (from)');
    }
    
    if (!message.to && !message.broadcast) {
        errors.push('Message must have recipient (to) or be a broadcast');
    }
    
    if (message.to && !validateAgentId(message.to)) {
        errors.push('Invalid recipient (to)');
    }
    
    if (message.content === undefined || message.content === null) {
        errors.push('Message content is required');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Create message object
 * @param {string} from - Sender agent ID
 * @param {string} to - Recipient agent ID
 * @param {string|Object} content - Message content
 * @param {Object} options - Additional options
 * @returns {Object} Message object
 */
function createMessage(from, to, content, options = {}) {
    const messageId = generateMessageId();
    const timestamp = new Date().toISOString();
    
    return {
        messageId,
        from,
        to,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        timestamp,
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
 * Send a message to another agent via Redis
 * @param {string} from - Sender agent ID
 * @param {string} to - Recipient agent ID
 * @param {string|Object} content - Message content
 * @param {Object} options - Additional options (priority, type, etc.)
 * @returns {Promise<Object>} Send result with messageId, success flag
 */
async function sendMessage(from, to, content, options = {}) {
    try {
        const client = await getRedisClient();
        
        // Validate inputs
        if (!validateAgentId(from)) {
            throw new Error(`Invalid sender agent ID: ${from}`);
        }
        if (!validateAgentId(to)) {
            throw new Error(`Invalid recipient agent ID: ${to}`);
        }
        
        // Create message
        const message = createMessage(from, to, content, options);
        
        // Validate message
        const validation = validateMessage(message);
        if (!validation.valid) {
            throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
        }
        
        // Store message in recipient's inbox (Redis list)
        const inboxKey = `${A2A_PREFIX}:inbox:${to}`;
        await client.lpush(inboxKey, JSON.stringify(message));
        
        // Register sender and recipient in agents set
        await client.sadd(`${A2A_PREFIX}:agents`, from, to);
        
        // Publish to broadcast channel for real-time delivery
        await client.publish(`${A2A_PREFIX}:broadcast`, JSON.stringify({
            ...message,
            action: 'message'
        }));
        
        console.log(`[A2A Redis] Message sent from ${from} to ${to}: ${message.messageId}`);
        
        return {
            success: true,
            messageId: message.messageId,
            from: message.from,
            to: message.to,
            timestamp: message.timestamp,
            priority: message.priority
        };
    } catch (error) {
        console.error('[A2A Redis] sendMessage error:', error.message);
        return {
            success: false,
            error: error.message,
            from,
            to
        };
    }
}

/**
 * Get messages from agent's inbox
 * @param {string} agentId - Agent ID to get messages for
 * @param {number} limit - Maximum number of messages to return
 * @returns {Promise<Array>} Array of messages
 */
async function getMessages(agentId, limit = 10) {
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(agentId)) {
            throw new Error(`Invalid agent ID: ${agentId}`);
        }
        
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const messages = await client.lrange(inboxKey, 0, limit - 1);
        
        return messages.map(msg => {
            try {
                return JSON.parse(msg);
            } catch (e) {
                return { raw: msg, parseError: e.message };
            }
        });
    } catch (error) {
        console.error('[A2A Redis] getMessages error:', error.message);
        return [];
    }
}

/**
 * Get unread messages (messages not yet marked as read)
 * @param {string} agentId - Agent ID to get messages for
 * @param {number} limit - Maximum number of messages to return
 * @returns {Promise<Array>} Array of unread messages
 */
async function getUnreadMessages(agentId, limit = 10) {
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(agentId)) {
            throw new Error(`Invalid agent ID: ${agentId}`);
        }
        
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const readSetKey = `${A2A_PREFIX}:read:${agentId}`;
        
        const messages = await client.lrange(inboxKey, 0, limit - 1);
        const readIds = await client.smembers(readSetKey);
        const readSet = new Set(readIds);
        
        return messages
            .map(msg => {
                try {
                    return JSON.parse(msg);
                } catch (e) {
                    return null;
                }
            })
            .filter(msg => msg && !readSet.has(msg.messageId));
    } catch (error) {
        console.error('[A2A Redis] getUnreadMessages error:', error.message);
        return [];
    }
}

/**
 * Mark a message as read
 * @param {string} agentId - Agent ID
 * @param {string} messageId - Message ID to mark as read
 * @returns {Promise<Object>} Result with success flag
 */
async function markAsRead(agentId, messageId) {
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(agentId)) {
            throw new Error(`Invalid agent ID: ${agentId}`);
        }
        
        const readSetKey = `${A2A_PREFIX}:read:${agentId}`;
        await client.sadd(readSetKey, messageId);
        
        return {
            success: true,
            agentId,
            messageId
        };
    } catch (error) {
        console.error('[A2A Redis] markAsRead error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Count messages in agent's inbox
 * @param {string} agentId - Agent ID to count messages for
 * @returns {Promise<Object>} Result with count
 */
async function countMessages(agentId) {
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(agentId)) {
            throw new Error(`Invalid agent ID: ${agentId}`);
        }
        
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const count = await client.llen(inboxKey);
        
        return {
            count,
            agentId
        };
    } catch (error) {
        console.error('[A2A Redis] countMessages error:', error.message);
        return {
            count: 0,
            agentId,
            error: error.message
        };
    }
}

/**
 * Clear all messages from agent's inbox
 * @param {string} agentId - Agent ID to clear inbox for
 * @returns {Promise<Object>} Result with success flag
 */
async function clearMessages(agentId) {
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(agentId)) {
            throw new Error(`Invalid agent ID: ${agentId}`);
        }
        
        const inboxKey = `${A2A_PREFIX}:inbox:${agentId}`;
        const readSetKey = `${A2A_PREFIX}:read:${agentId}`;
        
        await client.del(inboxKey);
        await client.del(readSetKey);
        
        return {
            success: true,
            agentId
        };
    } catch (error) {
        console.error('[A2A Redis] clearMessages error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==============================================================================
// Broadcast Functions
// ==============================================================================

/**
 * Broadcast message to specific agents
 * @param {string} from - Sender agent ID
 * @param {Array<string>} agents - Array of recipient agent IDs
 * @param {string|Object} content - Message content
 * @returns {Promise<Object>} Result with sentTo array
 */
async function broadcastToAgents(from, agents, content) {
    try {
        const results = await Promise.all(
            agents.map(agent => sendMessage(from, agent, content))
        );
        
        const sentTo = results
            .filter(r => r.success)
            .map(r => r.to);
        
        return {
            success: true,
            from,
            sentTo,
            count: sentTo.length,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[A2A Redis] broadcastToAgents error:', error.message);
        return {
            success: false,
            error: error.message,
            from
        };
    }
}

/**
 * Broadcast message to triad members (alpha, beta, charlie)
 * @param {string} from - Sender agent ID
 * @param {string|Object} content - Message content
 * @returns {Promise<Object>} Result with recipients array
 */
async function broadcastToTriad(from, content) {
    return broadcastToAgents(from, TRIAD_AGENTS, content);
}

/**
 * Broadcast message to all known agents
 * @param {string} from - Sender agent ID
 * @param {string|Object} content - Message content
 * @returns {Promise<Object>} Result with count
 */
async function broadcastToAll(from, content) {
    return broadcastToAgents(from, KNOWN_AGENTS, content);
}

/**
 * Broadcast message (alias for broadcastToAll)
 * @param {string} from - Sender agent ID
 * @param {string|Object} content - Message content
 * @returns {Promise<Object>} Result with count
 */
async function broadcast(from, content) {
    return broadcastToAll(from, content);
}

// ==============================================================================
// Ping/Health Check Functions
// ==============================================================================

/**
 * Ping another agent (health check)
 * @param {string} from - Sender agent ID
 * @param {string} to - Target agent ID
 * @returns {Promise<Object>} Ping result with response and latency
 */
async function pingAgent(from, to) {
    const startTime = Date.now();
    
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(from)) {
            throw new Error(`Invalid sender agent ID: ${from}`);
        }
        if (!validateAgentId(to)) {
            throw new Error(`Invalid target agent ID: ${to}`);
        }
        
        // Send ping message
        const pingMessage = {
            type: 'ping',
            content: 'ping',
            timestamp: new Date().toISOString()
        };
        
        const inboxKey = `${A2A_PREFIX}:inbox:${to}`;
        await client.lpush(inboxKey, JSON.stringify({
            messageId: generateMessageId(),
            from,
            to,
            ...pingMessage
        }));
        
        const latency = Date.now() - startTime;
        
        // Check if target agent is registered
        const isRegistered = await client.sismember(`${A2A_PREFIX}:agents`, to);
        
        return {
            success: true,
            response: 'pong',
            latency,
            target: to,
            registered: isRegistered === 1
        };
    } catch (error) {
        const latency = Date.now() - startTime;
        console.error('[A2A Redis] pingAgent error:', error.message);
        return {
            success: false,
            error: error.message,
            latency,
            target: to
        };
    }
}

/**
 * Ping all triad members
 * @param {string} from - Sender agent ID
 * @returns {Promise<Object>} Ping results for each triad member
 */
async function pingTriad(from) {
    const results = await Promise.all(
        TRIAD_AGENTS.map(agent => pingAgent(from, agent))
    );
    
    const responses = {};
    TRIAD_AGENTS.forEach((agent, index) => {
        responses[agent] = results[index];
    });
    
    return {
        success: true,
        from,
        responses,
        timestamp: new Date().toISOString()
    };
}

// ==============================================================================
// Agent Registration
// ==============================================================================

/**
 * Register an agent in the A2A system
 * @param {string} agentId - Agent ID to register
 * @param {Object} metadata - Optional agent metadata
 * @returns {Promise<Object>} Registration result
 */
async function registerAgent(agentId, metadata = {}) {
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(agentId)) {
            throw new Error(`Invalid agent ID: ${agentId}`);
        }
        
        // Add to agents set
        await client.sadd(`${A2A_PREFIX}:agents`, agentId);
        
        // Store agent metadata
        const agentKey = `${A2A_PREFIX}:agent:${agentId}`;
        await client.hset(agentKey, {
            id: agentId,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            status: 'active',
            ...metadata
        });
        
        console.log(`[A2A Redis] Agent registered: ${agentId}`);
        
        return {
            success: true,
            agentId,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[A2A Redis] registerAgent error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get list of registered agents
 * @returns {Promise<Array>} Array of agent IDs
 */
async function getRegisteredAgents() {
    try {
        const client = await getRedisClient();
        const agents = await client.smembers(`${A2A_PREFIX}:agents`);
        return agents;
    } catch (error) {
        console.error('[A2A Redis] getRegisteredAgents error:', error.message);
        return [];
    }
}

/**
 * Unregister an agent
 * @param {string} agentId - Agent ID to unregister
 * @returns {Promise<Object>} Unregistration result
 */
async function unregisterAgent(agentId) {
    try {
        const client = await getRedisClient();
        
        if (!validateAgentId(agentId)) {
            throw new Error(`Invalid agent ID: ${agentId}`);
        }
        
        // Remove from agents set
        await client.srem(`${A2A_PREFIX}:agents`, agentId);
        
        // Remove agent metadata
        const agentKey = `${A2A_PREFIX}:agent:${agentId}`;
        await client.del(agentKey);
        
        console.log(`[A2A Redis] Agent unregistered: ${agentId}`);
        
        return {
            success: true,
            agentId
        };
    } catch (error) {
        console.error('[A2A Redis] unregisterAgent error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
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
    
    // Utilities
    createMessage,
    generateMessageId,
    
    // Connection management
    getRedisClient,
    closeRedisClient,
    
    // Constants
    KNOWN_AGENTS,
    TRIAD_AGENTS,
    A2A_PREFIX
};
