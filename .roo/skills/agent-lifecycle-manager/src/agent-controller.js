/**
 * Agent Controller - Process Control for OpenClaw Agents
 * ==============================================================================
 * Manages agent container lifecycle operations: start, stop, restart.
 * Supports dependency-aware ordering and rolling operations.
 */

const { execSync, spawn } = require('child_process');
const EventEmitter = require('events');

class AgentController extends EventEmitter {
    constructor(config = {}) {
        super();
        this.dockerComposeProject = config.project || 'heretek-openclaw-core';
        this.agentsPath = config.agentsPath || '/app/agents';
        this.gatewayUrl = config.gatewayUrl || 'ws://127.0.0.1:18789';
        this.litellmHost = config.litellmHost || 'http://litellm:4000';
        
        // Agent dependency order (must start in this sequence)
        this.startupOrder = [
            'gateway',
            'litellm',
            'steward',
            'alpha',
            'beta',
            'gamma',
            'scout',
            'artisan',
            'guardian',
            'dreamer',
            'knowledge-ingest'
        ];
    }

    /**
     * Get list of running agent containers
     * @returns {Array<string>} List of running agent names
     */
    getRunningAgents() {
        try {
            const output = execSync(
                `docker ps --filter "name=${this.dockerComposeProject}" --format "{{.Names}}"`,
                { encoding: 'utf8' }
            );
            return output.trim().split('\n').filter(line => line.length > 0);
        } catch (error) {
            this.emit('error', { operation: 'getRunningAgents', error: error.message });
            return [];
        }
    }

    /**
     * Get list of all agent containers (running or stopped)
     * @returns {Array<string>} List of all agent names
     */
    getAllAgents() {
        try {
            const output = execSync(
                `docker ps -a --filter "name=${this.dockerComposeProject}-agent" --format "{{.Names}}"`,
                { encoding: 'utf8' }
            );
            return output.trim().split('\n').filter(line => line.length > 0);
        } catch (error) {
            this.emit('error', { operation: 'getAllAgents', error: error.message });
            return [];
        }
    }

    /**
     * Start a single agent
     * @param {string} agentId - Agent identifier
     * @param {Object} options - Start options
     * @returns {Promise<Object>} Start result
     */
    async startAgent(agentId, options = {}) {
        const startTime = Date.now();
        
        try {
            this.emit('agent:start', { agentId, phase: 'starting' });
            
            // Check if already running
            const running = this.getRunningAgents();
            if (running.some(name => name.includes(agentId))) {
                return {
                    success: true,
                    agentId,
                    status: 'already_running',
                    duration: Date.now() - startTime
                };
            }

            // Start the agent
            const command = `docker compose -p ${this.dockerComposeProject} start ${agentId}`;
            execSync(command, { encoding: 'utf8', stdio: 'pipe' });
            
            // Wait for agent to be healthy if requested
            if (options.waitForHealth) {
                await this.waitForHealth(agentId, options.healthTimeout || 30000);
            }

            this.emit('agent:start', { agentId, phase: 'started', duration: Date.now() - startTime });
            
            return {
                success: true,
                agentId,
                status: 'started',
                duration: Date.now() - startTime
            };
        } catch (error) {
            this.emit('agent:error', { agentId, operation: 'start', error: error.message });
            return {
                success: false,
                agentId,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Stop a single agent
     * @param {string} agentId - Agent identifier
     * @param {Object} options - Stop options
     * @returns {Promise<Object>} Stop result
     */
    async stopAgent(agentId, options = {}) {
        const startTime = Date.now();
        
        try {
            this.emit('agent:stop', { agentId, phase: 'stopping' });
            
            // Check if running
            const running = this.getRunningAgents();
            if (!running.some(name => name.includes(agentId))) {
                return {
                    success: true,
                    agentId,
                    status: 'already_stopped',
                    duration: Date.now() - startTime
                };
            }

            // Stop the agent
            const command = options.force 
                ? `docker compose -p ${this.dockerComposeProject} kill ${agentId}`
                : `docker compose -p ${this.dockerComposeProject} stop -t ${options.timeout || 30} ${agentId}`;
            
            execSync(command, { encoding: 'utf8', stdio: 'pipe' });

            this.emit('agent:stop', { agentId, phase: 'stopped', duration: Date.now() - startTime });
            
            return {
                success: true,
                agentId,
                status: 'stopped',
                duration: Date.now() - startTime
            };
        } catch (error) {
            this.emit('agent:error', { agentId, operation: 'stop', error: error.message });
            return {
                success: false,
                agentId,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Restart a single agent
     * @param {string} agentId - Agent identifier
     * @param {Object} options - Restart options
     * @returns {Promise<Object>} Restart result
     */
    async restartAgent(agentId, options = {}) {
        const startTime = Date.now();
        
        try {
            this.emit('agent:restart', { agentId, phase: 'restarting' });
            
            // Stop then start
            await this.stopAgent(agentId, options);
            await this.startAgent(agentId, options);

            this.emit('agent:restart', { agentId, phase: 'restarted', duration: Date.now() - startTime });
            
            return {
                success: true,
                agentId,
                status: 'restarted',
                duration: Date.now() - startTime
            };
        } catch (error) {
            this.emit('agent:error', { agentId, operation: 'restart', error: error.message });
            return {
                success: false,
                agentId,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Start all agents in dependency order
     * @param {Object} options - Start options
     * @returns {Promise<Array<Object>>} Results for each agent
     */
    async startAll(options = {}) {
        const results = [];
        
        for (const agentId of this.startupOrder) {
            // Skip if agent doesn't exist
            const allAgents = this.getAllAgents();
            if (!allAgents.some(name => name.includes(agentId))) {
                continue;
            }
            
            const result = await this.startAgent(agentId, options);
            results.push(result);
            
            if (options.delayBetweenAgents && result.success) {
                await this.sleep(options.delayBetweenAgents);
            }
        }
        
        return results;
    }

    /**
     * Stop all agents in reverse dependency order
     * @param {Object} options - Stop options
     * @returns {Promise<Array<Object>>} Results for each agent
     */
    async stopAll(options = {}) {
        const results = [];
        const reversedOrder = [...this.startupOrder].reverse();
        
        for (const agentId of reversedOrder) {
            const allAgents = this.getAllAgents();
            if (!allAgents.some(name => name.includes(agentId))) {
                continue;
            }
            
            const result = await this.stopAgent(agentId, options);
            results.push(result);
            
            if (options.delayBetweenAgents && result.success) {
                await this.sleep(options.delayBetweenAgents);
            }
        }
        
        return results;
    }

    /**
     * Rolling restart - restart agents one at a time
     * @param {Object} options - Rolling restart options
     * @returns {Promise<Array<Object>>} Results for each agent
     */
    async rollingRestart(options = {}) {
        const results = [];
        const delay = options.delayBetweenAgents || 5000;
        
        for (const agentId of this.startupOrder) {
            const allAgents = this.getAllAgents();
            if (!allAgents.some(name => name.includes(agentId))) {
                continue;
            }
            
            this.emit('rolling:progress', { 
                agentId, 
                phase: 'starting',
                position: results.length + 1,
                total: this.startupOrder.length
            });
            
            const result = await this.restartAgent(agentId, { ...options, waitForHealth: true });
            results.push(result);
            
            if (result.success && delay > 0) {
                await this.sleep(delay);
            }
        }
        
        return results;
    }

    /**
     * Wait for agent to become healthy
     * @param {string} agentId - Agent identifier
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<boolean>} Health status
     */
    async waitForHealth(agentId, timeout = 30000) {
        const startTime = Date.now();
        const healthEndpoint = `http://127.0.0.1:18789/health/${agentId}`;
        
        while (Date.now() - startTime < timeout) {
            try {
                const result = execSync(`curl -s -o /dev/null -w "%{http_code}" ${healthEndpoint}`, {
                    encoding: 'utf8'
                });
                
                if (result.trim() === '200') {
                    return true;
                }
            } catch (error) {
                // Health endpoint not ready yet
            }
            
            await this.sleep(1000);
        }
        
        throw new Error(`Agent ${agentId} health check timeout after ${timeout}ms`);
    }

    /**
     * Get agent status
     * @param {string} agentId - Agent identifier
     * @returns {Object} Agent status
     */
    getAgentStatus(agentId) {
        try {
            const running = this.getRunningAgents();
            const isRunning = running.some(name => name.includes(agentId));
            
            if (!isRunning) {
                return {
                    agentId,
                    status: 'stopped',
                    health: 'unknown'
                };
            }
            
            // Check health endpoint
            let health = 'unknown';
            try {
                const healthResult = execSync(
                    `curl -s http://127.0.0.1:18789/health/${agentId}`,
                    { encoding: 'utf8', timeout: 5000 }
                );
                health = healthResult ? 'healthy' : 'unhealthy';
            } catch (error) {
                health = 'unhealthy';
            }
            
            return {
                agentId,
                status: 'running',
                health,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                agentId,
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AgentController;
