/**
 * Heretek OpenClaw — Agent Client Library
 * ==============================================================================
 * Provides A2A communication and skill execution for OpenClaw agents.
 * 
 * Features:
 *   - A2A Protocol Gateway with Redis fallback
 *   - Auto-discovery of agent capabilities
 *   - 500ms timeout for A2A, automatic fallback to Redis
 * 
 * Usage:
 *   const AgentClient = require('./lib/agent-client');
 *   const client = new AgentClient({
 *     agentId: 'steward',
 *     role: 'orchestrator',
 *     litellmHost: 'http://litellm:4000',
 *     apiKey: process.env.LITELLM_API_KEY
 *   });
 *   
 *   // Send message to another agent (uses A2A with Redis fallback)
 *   await client.sendMessage('alpha', { task: 'Analyze this data' });
 *   
 *   // Execute a skill
 *   const result = await client.executeSkill('curiosity-engine', context);
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Try to load Redis, but make it optional
let Redis;
try {
    Redis = require('ioredis');
} catch (e) {
    console.warn('[agent-client] ioredis not available, Redis fallback disabled');
}

/**
 * A2AClient - A2A Protocol Gateway with Redis Fallback
 * ==============================================================================
 * Implements the gateway pattern for A2A communication:
 *   - Primary: Try LiteLLM A2A endpoints
 *   - Fallback: Use Redis pub/sub for message delivery
 *   - Timeout: 500ms for A2A, then fall back to Redis
 */
class A2AClient {
    /**
     * Create a new A2AClient instance
     * @param {Object} config - Configuration options
     * @param {string} config.agentId - Agent identifier
     * @param {string} config.litellmHost - LiteLLM gateway URL
     * @param {string} config.apiKey - API key for LiteLLM
     * @param {string} config.redisUrl - Redis connection URL
     */
    constructor(config) {
        this.agentId = config.agentId || 'unknown';
        this.litellmHost = config.litellmHost || 'http://litellm:4000';
        this.apiKey = config.apiKey || '';
        this.redisUrl = config.redisUrl || process.env.REDIS_URL || 'redis://redis:6379';
        
        // Configuration
        this.a2aTimeout = 500; // 500ms timeout for A2A
        this.discoveryCacheTTL = 300000; // 5 minutes cache
        
        // Redis clients (lazy initialized)
        this._redis = null;
        this._redisSub = null;
        
        // Agent discovery cache
        this._discoveryCache = null;
        this._discoveryCacheTime = 0;
        
        // Pending message responses (for Redis pub/sub)
        this._pendingMessages = new Map();
    }
    
    /**
     * Get Redis client (lazy initialization)
     * @private
     */
    _getRedis() {
        if (!Redis) return null;
        if (!this._redis) {
            this._redis = new Redis(this.redisUrl, {
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => Math.min(times * 50, 2000)
            });
            this._redis.on('error', (err) => {
                console.error('[A2AClient] Redis error:', err.message);
            });
        }
        return this._redis;
    }
    
    /**
     * Get Redis subscriber client (lazy initialization)
     * @private
     */
    _getRedisSub() {
        if (!Redis) return null;
        if (!this._redisSub) {
            this._redisSub = new Redis(this.redisUrl, {
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => Math.min(times * 50, 2000)
            });
        }
        return this._redisSub;
    }
    
    /**
     * Send message via A2A with timeout and Redis fallback
     * @param {string} toAgent - Target agent identifier
     * @param {Object} message - Message content
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response from A2A or Redis
     */
    async sendMessage(toAgent, message, options = {}) {
        const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const messagePayload = {
            id: msgId,
            from: this.agentId,
            to: toAgent,
            type: options.type || 'task',
            content: typeof message === 'string' ? message : JSON.stringify(message),
            timestamp: new Date().toISOString(),
            replyTo: options.replyTo || null
        };
        
        // Try A2A first with timeout
        const a2aResult = await this._tryA2A(toAgent, messagePayload);
        if (a2aResult.success) {
            return a2aResult.response;
        }
        
        // Fall back to Redis
        console.log(`[A2AClient] A2A failed for ${toAgent}, falling back to Redis`);
        const redisResult = await this._tryRedis(toAgent, messagePayload);
        if (redisResult.success) {
            return redisResult.response;
        }
        
        // Both failed
        throw new Error(`Failed to send message to ${toAgent}: A2A and Redis both failed`);
    }
    
    /**
     * Try sending via A2A protocol with timeout
     * @private
     */
    async _tryA2A(toAgent, message) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.a2aTimeout);
        
        try {
            const response = await fetch(`${this.litellmHost}/v1/agents/${toAgent}/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            return { success: true, response: data };
        } catch (error) {
            clearTimeout(timeoutId);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Try sending via Redis pub/sub
     * @private
     */
    async _tryRedis(toAgent, message) {
        const redis = this._getRedis();
        if (!redis) {
            return { success: false, error: 'Redis not available' };
        }
        
        try {
            // Create a promise that resolves when we get a response
            const responsePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    resolve({ success: true, response: { status: 'queued', messageId: message.id } });
                }, 5000);
                
                this._pendingMessages.set(message.id, { resolve, reject, timeout });
            });
            
            // Publish message to agent's channel
            const channel = `a2a:${toAgent}`;
            await redis.publish(channel, JSON.stringify(message));
            
            // Wait for response (or timeout)
            const result = await responsePromise;
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Discover available agents via A2A endpoint
     * @returns {Promise<Array>} Array of available agents
     */
    async discoverAgents() {
        // Check cache
        if (this._discoveryCache && (Date.now() - this._discoveryCacheTime < this.discoveryCacheTTL)) {
            return this._discoveryCache;
        }
        
        // Try A2A discovery endpoint
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.a2aTimeout);
            
            const response = await fetch(`${this.litellmHost}/v1/agents`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this._discoveryCache = data.agents || [];
                this._discoveryCacheTime = Date.now();
                return this._discoveryCache;
            }
        } catch (error) {
            console.log(`[A2AClient] Discovery failed: ${error.message}`);
        }
        
        // Fall back to local agent registry
        return this._getLocalAgents();
    }
    
    /**
     * Get local agent registry as fallback
     * @private
     */
    _getLocalAgents() {
        // Return known agents from the collective
        return [
            { agentId: 'steward', role: 'orchestrator', capabilities: ['coordinate', 'delegate'] },
            { agentId: 'alpha', role: 'triad', capabilities: ['deliberate', 'vote'] },
            { agentId: 'beta', role: 'triad', capabilities: ['deliberate', 'vote'] },
            { agentId: 'gamma', role: 'triad', capabilities: ['deliberate', 'vote'] },
            { agentId: 'sentinel', role: 'guardian', capabilities: ['protect', 'monitor'] },
            { agentId: 'scout', role: 'scout', capabilities: ['explore', 'discover'] }
        ];
    }
    
    /**
     * Subscribe to messages for this agent
     * @param {Function} handler - Message handler function
     */
    async subscribeToMessages(handler) {
        const redisSub = this._getRedisSub();
        if (!redisSub) {
            console.warn('[A2AClient] Cannot subscribe: Redis not available');
            return;
        }
        
        const channel = `a2a:${this.agentId}`;
        await redisSub.subscribe(channel);
        
        redisSub.on('message', (ch, message) => {
            if (ch === channel) {
                try {
                    const msg = JSON.parse(message);
                    handler(msg);
                } catch (error) {
                    console.error('[A2AClient] Failed to parse message:', error);
                }
            }
        });
    }
    
    /**
     * Clean up resources
     */
    async disconnect() {
        if (this._redis) {
            await this._redis.quit();
            this._redis = null;
        }
        if (this._redisSub) {
            await this._redisSub.quit();
            this._redisSub = null;
        }
    }
}

/**
 * AgentClient - Main Agent Client Class
 * ==============================================================================
 * Provides A2A communication and skill execution for OpenClaw agents.
 * Now uses A2AClient internally for gateway pattern with Redis fallback.
 */
class AgentClient {
    /**
     * Create a new AgentClient instance
     * @param {Object} config - Configuration options
     * @param {string} config.agentId - Agent identifier (steward, alpha, etc.)
     * @param {string} config.role - Agent role (orchestrator, triad, etc.)
     * @param {string} config.litellmHost - LiteLLM gateway URL
     * @param {string} config.apiKey - API key for LiteLLM
     * @param {string} [config.skillsPath] - Path to skills directory
     * @param {string} [config.model] - Model to use (defaults to agent/{agentId})
     */
    constructor(config) {
        this.agentId = config.agentId || process.env.AGENT_NAME || 'unknown';
        this.role = config.role || process.env.AGENT_ROLE || 'general';
        this.litellmHost = config.litellmHost || process.env.LITELLM_HOST || 'http://litellm:4000';
        this.apiKey = config.apiKey || process.env.LITELLM_API_KEY || '';
        this.skillsPath = config.skillsPath || process.env.SKILLS_PATH || '/app/skills';
        this.model = config.model || process.env.AGENT_MODEL || `agent/${this.agentId}`;
        
        // State directories
        this.stateDir = '/app/state';
        this.memoryDir = '/app/memory';
        this.collectiveDir = '/app/collective';
        
        // Initialize A2A Client for gateway pattern with Redis fallback
        this.a2aClient = new A2AClient({
            agentId: this.agentId,
            litellmHost: this.litellmHost,
            apiKey: this.apiKey,
            redisUrl: process.env.REDIS_URL || 'redis://redis:6379'
        });
        
        // Ensure directories exist
        [this.stateDir, this.memoryDir, this.collectiveDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Send an A2A message to another agent (with gateway pattern)
     * Uses A2A protocol first, falls back to Redis on failure
     * @param {string} toAgent - Target agent identifier
     * @param {Object|string} content - Message content
     * @param {string} [type='task'] - Message type (task, query, broadcast, response)
     * @returns {Promise<Object>} Response from A2A or Redis
     */
    async sendMessage(toAgent, content, type = 'task') {
        const message = {
            from: this.agentId,
            type: type,
            content: typeof content === 'string' ? content : JSON.stringify(content),
            timestamp: new Date().toISOString()
        };

        // Try A2A first with timeout, fallback to Redis
        try {
            const response = await this.a2aClient.sendMessage(toAgent, message, { type });
            
            // Log outgoing message
            this._logMessage({ ...message, to: toAgent, direction: 'outgoing' });
            
            return response;
        } catch (error) {
            // A2A and Redis both failed - use legacy direct approach as last resort
            console.warn(`[AgentClient] Gateway failed: ${error.message}, trying direct A2A`);
            
            const response = await fetch(`${this.litellmHost}/v1/agents/${toAgent}/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.statusText}`);
            }

            // Log outgoing message
            this._logMessage({ ...message, to: toAgent, direction: 'outgoing' });
            
            return response.json();
        }
    }

    /**
     * Broadcast a message to all agents
     * @param {Object|string} content - Message content
     * @returns {Promise<Object>} Response from LiteLLM
     */
    async broadcast(content) {
        return this.sendMessage('broadcast', content, 'broadcast');
    }

    /**
     * Send a response to a previous message
     * @param {string} toAgent - Target agent identifier
     * @param {Object|string} content - Response content
     * @param {string} inReplyTo - Original message ID
     * @returns {Promise<Object>} Response from LiteLLM
     */
    async sendResponse(toAgent, content, inReplyTo) {
        const message = {
            from: this.agentId,
            type: 'response',
            content: typeof content === 'string' ? content : JSON.stringify(content),
            in_reply_to: inReplyTo,
            timestamp: new Date().toISOString()
        };

        const response = await fetch(`${this.litellmHost}/v1/agents/${toAgent}/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        return response.json();
    }

    /**
     * Poll for pending messages
     * @returns {Promise<Array>} Array of pending messages
     */
    async pollMessages() {
        const response = await fetch(`${this.litellmHost}/v1/agents/${this.agentId}/messages`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return data.messages || [];
    }

    /**
     * Send a heartbeat signal
     * @param {string} [status='alive'] - Agent status
     * @returns {Promise<Object>} Response from LiteLLM
     */
    async sendHeartbeat(status = 'alive') {
        const response = await fetch(`${this.litellmHost}/v1/agents/${this.agentId}/heartbeat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: status,
                timestamp: new Date().toISOString(),
                agent: this.agentId,
                role: this.role,
                model: this.model
            })
        });

        return response.json();
    }

    /**
     * Register agent with LiteLLM A2A
     * @returns {Promise<Object>} Response from LiteLLM
     */
    async register() {
        const response = await fetch(`${this.litellmHost}/v1/agents/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: this.agentId,
                role: this.role,
                model: this.model,
                capabilities: this._getCapabilities()
            })
        });

        return response.json();
    }

    /**
     * Discover available agents via A2A endpoint with caching
     * Uses auto-discovery with 5-minute cache, falls back to local registry
     * @returns {Promise<Array>} Array of available agents
     */
    async discoverAgents() {
        return this.a2aClient.discoverAgents();
    }

    /**
     * Execute a skill
     * @param {string} skillName - Name of the skill to execute
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Skill execution result
     */
    async executeSkill(skillName, context = {}) {
        const skillDir = path.join(this.skillsPath, skillName);
        
        // Check if skill exists
        if (!fs.existsSync(skillDir)) {
            throw new Error(`Skill not found: ${skillName}`);
        }

        // Find skill executable
        let skillExecutable = null;
        const possibleExecutables = [
            path.join(skillDir, `${skillName}.sh`),
            path.join(skillDir, 'index.js'),
            path.join(skillDir, 'main.sh'),
            path.join(skillDir, 'run.sh')
        ];

        for (const execPath of possibleExecutables) {
            if (fs.existsSync(execPath)) {
                skillExecutable = execPath;
                break;
            }
        }

        if (!skillExecutable) {
            throw new Error(`No executable found for skill: ${skillName}`);
        }

        // Prepare execution environment
        const execEnv = {
            ...process.env,
            AGENT_NAME: this.agentId,
            AGENT_ROLE: this.role,
            LITELLM_HOST: this.litellmHost,
            LITELLM_API_KEY: this.apiKey,
            SKILL_CONTEXT: JSON.stringify(context)
        };

        try {
            // Execute skill
            let result;
            if (skillExecutable.endsWith('.js')) {
                // Execute Node.js skill
                result = await this._executeNodeSkill(skillExecutable, context, execEnv);
            } else {
                // Execute shell skill
                result = await this._executeShellSkill(skillExecutable, context, execEnv);
            }

            // Log skill execution
            this._logSkillExecution(skillName, context, result);

            return {
                success: true,
                skill: skillName,
                result: result,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                skill: skillName,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Execute a Node.js skill
     * @private
     */
    async _executeNodeSkill(skillPath, context, env) {
        // For Node.js skills, we require and execute them
        const skill = require(skillPath);
        
        if (typeof skill.execute === 'function') {
            return await skill.execute(context, this);
        } else if (typeof skill === 'function') {
            return await skill(context, this);
        } else {
            throw new Error('Skill does not export an execute function');
        }
    }

    /**
     * Execute a shell skill
     * @private
     */
    async _executeShellSkill(skillPath, context, env) {
        const contextJson = JSON.stringify(context);
        
        try {
            const result = execSync(`"${skillPath}" --context '${contextJson}'`, {
                env: env,
                encoding: 'utf8',
                timeout: 60000, // 60 second timeout
                cwd: path.dirname(skillPath)
            });
            
            return result.trim();
        } catch (error) {
            throw new Error(`Skill execution failed: ${error.message}`);
        }
    }

    /**
     * Make a chat completion request through LiteLLM
     * @param {string} prompt - User prompt
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Model response
     */
    async chat(prompt, options = {}) {
        const messages = options.messages || [
            { role: 'system', content: this._getSystemPrompt() },
            { role: 'user', content: prompt }
        ];

        const response = await fetch(`${this.litellmHost}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                agent: this.agentId,
                ...options
            })
        });

        if (!response.ok) {
            throw new Error(`Chat request failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    /**
     * Store data in agent memory
     * @param {string} key - Memory key
     * @param {Object} value - Value to store
     */
    storeMemory(key, value) {
        const memoryFile = path.join(this.memoryDir, `${key}.json`);
        fs.writeFileSync(memoryFile, JSON.stringify(value, null, 2));
    }

    /**
     * Retrieve data from agent memory
     * @param {string} key - Memory key
     * @returns {Object|null} Stored value or null
     */
    getMemory(key) {
        const memoryFile = path.join(this.memoryDir, `${key}.json`);
        
        if (fs.existsSync(memoryFile)) {
            return JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
        }
        
        return null;
    }

    /**
     * Store data in collective memory
     * @param {string} key - Memory key
     * @param {Object} value - Value to store
     */
    storeCollectiveMemory(key, value) {
        const memoryFile = path.join(this.collectiveDir, `${key}.json`);
        fs.writeFileSync(memoryFile, JSON.stringify({
            ...value,
            _meta: {
                agent: this.agentId,
                timestamp: new Date().toISOString()
            }
        }, null, 2));
    }

    /**
     * Retrieve data from collective memory
     * @param {string} key - Memory key
     * @returns {Object|null} Stored value or null
     */
    getCollectiveMemory(key) {
        const memoryFile = path.join(this.collectiveDir, `${key}.json`);
        
        if (fs.existsSync(memoryFile)) {
            return JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
        }
        
        return null;
    }

    /**
     * Get agent capabilities based on role
     * @private
     */
    _getCapabilities() {
        const capabilities = {
            orchestrator: ['coordinate', 'delegate', 'monitor', 'report'],
            triad: ['deliberate', 'vote', 'consensus', 'validate'],
            interrogator: ['challenge', 'verify', 'audit', 'question'],
            scout: ['explore', 'discover', 'report', 'scan'],
            guardian: ['protect', 'monitor', 'alert', 'enforce'],
            artisan: ['create', 'modify', 'review', 'implement'],
            general: ['general']
        };

        return capabilities[this.role] || capabilities.general;
    }

    /**
     * Get system prompt for the agent
     * @private
     */
    _getSystemPrompt() {
        return `You are ${this.agentId}, a ${this.role} agent in the Heretek OpenClaw collective.

Your role is: ${this.role}
Your capabilities: ${this._getCapabilities().join(', ')}

You communicate with other agents through the A2A protocol and can execute skills from the skills repository.

Always be helpful, accurate, and collaborative with other agents in the collective.`;
    }

    /**
     * Log a message to the message log
     * @private
     */
    _logMessage(message) {
        const logFile = path.join(this.memoryDir, 'messages.jsonl');
        fs.appendFileSync(logFile, JSON.stringify(message) + '\n');
    }

    /**
     * Log a skill execution
     * @private
     */
    _logSkillExecution(skillName, context, result) {
        const logFile = path.join(this.memoryDir, 'skill_history.jsonl');
        fs.appendFileSync(logFile, JSON.stringify({
            skill: skillName,
            context: context,
            result: typeof result === 'string' ? result : JSON.stringify(result),
            timestamp: new Date().toISOString()
        }) + '\n');
    }
}

// Export for CommonJS
module.exports = AgentClient;
module.exports.A2AClient = A2AClient;

// Also support ES modules default export
module.exports.default = AgentClient;
