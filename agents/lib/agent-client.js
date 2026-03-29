/**
 * Heretek OpenClaw — Agent Client Library
 * ==============================================================================
 * Provides A2A communication and skill execution for OpenClaw agents.
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
 *   // Send message to another agent
 *   await client.sendMessage('alpha', { task: 'Analyze this data' });
 *   
 *   // Execute a skill
 *   const result = await client.executeSkill('curiosity-engine', context);
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
        
        // Ensure directories exist
        [this.stateDir, this.memoryDir, this.collectiveDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Send an A2A message to another agent
     * @param {string} toAgent - Target agent identifier
     * @param {Object|string} content - Message content
     * @param {string} [type='task'] - Message type (task, query, broadcast, response)
     * @returns {Promise<Object>} Response from LiteLLM
     */
    async sendMessage(toAgent, content, type = 'task') {
        const message = {
            from: this.agentId,
            type: type,
            content: typeof content === 'string' ? content : JSON.stringify(content),
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

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
        }

        // Log outgoing message
        this._logMessage({ ...message, to: toAgent, direction: 'outgoing' });
        
        return response.json();
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

// Also support ES modules default export
module.exports.default = AgentClient;
