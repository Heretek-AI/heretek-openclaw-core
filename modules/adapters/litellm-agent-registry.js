/**
 * Heretek OpenClaw — LiteLLM Agent Registry Adapter
 * ==============================================================================
 * Adapter for registering agents with the LiteLLM proxy A2A gateway via REST API.
 * 
 * This is separate from the npm OpenClaw gateway (port 18789).
 * LiteLLM proxy typically runs on port 4000.
 *
 * The LiteLLM proxy has its own A2A gateway built in, accessible via:
 *   POST /key/generate  — create agent API key
 *   GET  /agents       — list agents
 *   GET  /key/info     — key metadata
 *
 * Usage:
 *   const registry = new LiteLLMAgentRegistry({
 *     host: 'localhost',
 *     port: 4000,
 *     masterKey: process.env.LITELLM_MASTER_KEY
 *   });
 *
 *   await registry.registerAgent({
 *     agentId: 'alpha',
 *     role: 'triad',
 *     skills: ['deliberate', 'vote']
 *   });
 *
 *   const agents = await registry.listAgents();
 * ==============================================================================
 */

const http = require('http');

class LiteLLMAgentRegistry {
    /**
     * Create LiteLLM agent registry adapter
     * @param {Object} options
     * @param {string} [options.host='localhost'] - LiteLLM host
     * @param {number} [options.port=4000] - LiteLLM port
     * @param {string} [options.masterKey] - LiteLLM master key
     * @param {string} [options.baseUrl] - Override base URL
     */
    constructor(options = {}) {
        this.host = options.host || process.env.LITELLM_HOST || 'localhost';
        this.port = options.port || parseInt(process.env.LITELLM_PORT || '4000', 10);
        this.masterKey = options.masterKey || process.env.LITELLM_MASTER_KEY || '';
        this.baseUrl = options.baseUrl || `http://${this.host}:${this.port}`;
    }

    /**
     * Make HTTP request to LiteLLM proxy
     * @private
     */
    _request(method, path, body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const opts = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method,
                headers: {
                    'Authorization': `Bearer ${this.masterKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            };

            const req = http.request(opts, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        reject(new Error(`LiteLLM ${res.statusCode}: ${data.slice(0, 200)}`));
                    } else {
                        try { resolve(JSON.parse(data)); }
                        catch { resolve(data); }
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error(`Request timeout: ${path}`)); });
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    /**
     * Register an agent with LiteLLM proxy
     * Creates an API key with a2a:send and a2a:receive permissions.
     *
     * @param {Object} agentInfo
     * @param {string} agentInfo.agentId - Agent ID
     * @param {string} [agentInfo.role] - Agent role
     * @param {Array<string>} [agentInfo.skills] - Agent skills
     * @param {Object} [agentInfo.metadata] - Additional metadata
     * @returns {Promise<Object>} Registration result
     */
    async registerAgent(agentInfo) {
        const keyAlias = `a2a-${agentInfo.agentId}`;

        const payload = {
            key_alias: keyAlias,
            duration: '30d',
            agent: agentInfo.agentId,
            agent_permissions: ['a2a:send', 'a2a:receive'],
            metadata: {
                role: agentInfo.role || 'unknown',
                skills: agentInfo.skills || [],
                registered_at: new Date().toISOString(),
                ...agentInfo.metadata
            }
        };

        try {
            const result = await this._request('POST', '/key/generate', payload);
            console.log(`[LiteLLM Registry] Registered agent: ${agentInfo.agentId}`);
            return {
                success: true,
                agentId: agentInfo.agentId,
                keyAlias,
                result
            };
        } catch (error) {
            console.error(`[LiteLLM Registry] Failed to register ${agentInfo.agentId}:`, error.message);
            return { success: false, agentId: agentInfo.agentId, error: error.message };
        }
    }

    /**
     * Register multiple agents
     * @param {Array<Object>} agents - Array of agent info objects
     * @returns {Promise<Array<Object>>} Results
     */
    async registerAgents(agents) {
        return Promise.all(agents.map(agent => this.registerAgent(agent)));
    }

    /**
     * Register all known collective agents
     * @returns {Promise<Array<Object>>} Results
     */
    async registerAllAgents() {
        const { KNOWN_AGENTS } = await import('../skills/a2a-message-send/a2a-redis.js');
        const agents = KNOWN_AGENTS.map(id => ({ agentId: id }));
        return this.registerAgents(agents);
    }

    /**
     * List all agents registered with LiteLLM proxy
     * @returns {Promise<Array>}
     */
    async listAgents() {
        try {
            return await this._request('GET', '/agents');
        } catch (error) {
            console.error('[LiteLLM Registry] listAgents error:', error.message);
            return [];
        }
    }

    /**
     * Get info about a specific key/agent
     * @param {string} keyAlias - Key alias (e.g., 'a2a-alpha')
     * @returns {Promise<Object>}
     */
    async getKeyInfo(keyAlias) {
        try {
            return await this._request('GET', `/key/info?key=${encodeURIComponent(keyAlias)}`);
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Delete an agent's key
     * @param {string} keyAlias - Key alias to delete
     * @returns {Promise<Object>}
     */
    async deleteAgent(keyAlias) {
        try {
            // LiteLLM doesn't expose key deletion via standard API
            // This is a placeholder for documentation
            console.warn(`[LiteLLM Registry] Key deletion not supported via API for: ${keyAlias}`);
            return { success: false, error: 'Key deletion not supported by LiteLLM proxy API' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get registry status
     * @returns {Promise<Object>}
     */
    async getStatus() {
        try {
            await this._request('GET', '/key/info');
            return { reachable: true, host: this.host, port: this.port };
        } catch {
            return { reachable: false, host: this.host, port: this.port, error: 'Health check failed' };
        }
    }
}

module.exports = { LiteLLMAgentRegistry };
