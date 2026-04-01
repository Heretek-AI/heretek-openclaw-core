/**
 * Health Monitor - Agent Health Checking and Auto-Restart
 * ==============================================================================
 * Monitors agent health via Gateway WebSocket RPC and LiteLLM endpoints.
 * Supports auto-restart for failed agents and health history tracking.
 */

const { execSync } = require('child_process');
const EventEmitter = require('events');
const WebSocket = require('ws');

class HealthMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.gatewayUrl = config.gatewayUrl || 'ws://127.0.0.1:18789';
        this.litellmHost = config.litellmHost || 'http://litellm:4000';
        this.checkInterval = config.checkInterval || 30000; // 30 seconds
        this.autoRestart = config.autoRestart || false;
        this.maxRestarts = config.maxRestarts || 3;
        this.restartWindow = config.restartWindow || 300000; // 5 minutes
        
        this.monitoring = false;
        this.monitorInterval = null;
        this.healthHistory = new Map();
        this.restartCounts = new Map();
        this.ws = null;
    }

    /**
     * Connect to Gateway WebSocket for health updates
     * @returns {Promise<boolean>} Connection status
     */
    async connectToGateway() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.gatewayUrl);
                
                this.ws.on('open', () => {
                    this.emit('gateway:connected');
                    resolve(true);
                });
                
                this.ws.on('message', (data) => {
                    this._handleGatewayMessage(data);
                });
                
                this.ws.on('error', (error) => {
                    this.emit('gateway:error', error);
                    reject(error);
                });
                
                this.ws.on('close', () => {
                    this.emit('gateway:disconnected');
                });
                
                // Connection timeout
                setTimeout(() => {
                    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                        reject(new Error('Gateway connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle Gateway WebSocket messages
     * @private
     */
    _handleGatewayMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'health_update') {
                this._updateHealthStatus(message.agent, message.status);
            }
        } catch (error) {
            this.emit('error', { operation: 'handleGatewayMessage', error: error.message });
        }
    }

    /**
     * Update health status for an agent
     * @private
     */
    _updateHealthStatus(agentId, status) {
        const history = this.healthHistory.get(agentId) || [];
        history.push({
            status,
            timestamp: new Date().toISOString()
        });
        
        // Keep last 100 entries
        if (history.length > 100) {
            history.shift();
        }
        
        this.healthHistory.set(agentId, history);
        this.emit('health:update', { agentId, status });
    }

    /**
     * Check health of a single agent
     * @param {string} agentId - Agent identifier
     * @returns {Promise<Object>} Health status
     */
    async checkAgentHealth(agentId) {
        const result = {
            agentId,
            gateway: { healthy: false, latency: null },
            litellm: { healthy: false, latency: null },
            overall: 'unhealthy',
            timestamp: new Date().toISOString()
        };
        
        // Check Gateway health
        const gatewayStart = Date.now();
        try {
            const gatewayHealth = execSync(
                `curl -s -w "\\n%{http_code} %{time_total}" http://127.0.0.1:18789/health/${agentId}`,
                { encoding: 'utf8', timeout: 5000 }
            );
            const lines = gatewayHealth.trim().split('\n');
            const statusCode = lines[lines.length - 2];
            const latency = parseFloat(lines[lines.length - 1]) * 1000;
            
            if (statusCode === '200') {
                result.gateway.healthy = true;
                result.gateway.latency = Math.round(latency);
            }
        } catch (error) {
            result.gateway.error = error.message;
        }
        
        // Check LiteLLM health
        const litellmStart = Date.now();
        try {
            const litellmHealth = execSync(
                `curl -s -w "\\n%{http_code} %{time_total}" ${this.litellmHost}/health`,
                { encoding: 'utf8', timeout: 5000 }
            );
            const lines = litellmHealth.trim().split('\n');
            const statusCode = lines[lines.length - 2];
            const latency = parseFloat(lines[lines.length - 1]) * 1000;
            
            if (statusCode === '200') {
                result.litellm.healthy = true;
                result.litellm.latency = Math.round(latency);
            }
        } catch (error) {
            result.litellm.error = error.message;
        }
        
        // Determine overall health
        if (result.gateway.healthy && result.litellm.healthy) {
            result.overall = 'healthy';
        } else if (result.gateway.healthy || result.litellm.healthy) {
            result.overall = 'degraded';
        }
        
        // Update history
        this._updateHealthStatus(agentId, result.overall);
        
        return result;
    }

    /**
     * Check health of all agents
     * @returns {Promise<Array<Object>>} Health status for all agents
     */
    async checkAllHealth() {
        const agents = [
            'steward', 'alpha', 'beta', 'gamma',
            'scout', 'artisan', 'guardian',
            'dreamer', 'knowledge-ingest'
        ];
        
        const results = [];
        for (const agentId of agents) {
            try {
                const health = await this.checkAgentHealth(agentId);
                results.push(health);
            } catch (error) {
                results.push({
                    agentId,
                    overall: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        return results;
    }

    /**
     * Start health monitoring
     * @param {Object} options - Monitor options
     */
    startMonitoring(options = {}) {
        if (this.monitoring) {
            this.emit('monitor:already-running');
            return;
        }
        
        this.monitoring = true;
        this.checkInterval = options.interval || this.checkInterval;
        this.autoRestart = options.autoRestart || this.autoRestart;
        
        this.emit('monitor:started', {
            interval: this.checkInterval,
            autoRestart: this.autoRestart
        });
        
        // Initial check
        this._performHealthCheck();
        
        // Schedule periodic checks
        this.monitorInterval = setInterval(() => {
            this._performHealthCheck();
        }, this.checkInterval);
    }

    /**
     * Stop health monitoring
     */
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.monitoring = false;
        this.emit('monitor:stopped');
    }

    /**
     * Perform health check and handle auto-restart
     * @private
     */
    async _performHealthCheck() {
        try {
            const healthResults = await this.checkAllHealth();
            
            for (const result of healthResults) {
                if (result.overall === 'unhealthy' || result.overall === 'error') {
                    this.emit('agent:unhealthy', result);
                    
                    if (this.autoRestart) {
                        await this._handleAutoRestart(result.agentId);
                    }
                } else if (result.overall === 'healthy') {
                    // Reset restart count on healthy check
                    this.restartCounts.set(result.agentId, 0);
                }
            }
        } catch (error) {
            this.emit('error', { operation: 'performHealthCheck', error: error.message });
        }
    }

    /**
     * Handle auto-restart for unhealthy agent
     * @private
     */
    async _handleAutoRestart(agentId) {
        const now = Date.now();
        const restartInfo = this.restartCounts.get(agentId) || { count: 0, windowStart: now };
        
        // Reset count if outside window
        if (now - restartInfo.windowStart > this.restartWindow) {
            restartInfo.count = 0;
            restartInfo.windowStart = now;
        }
        
        // Check max restarts
        if (restartInfo.count >= this.maxRestarts) {
            this.emit('agent:max-restarts', {
                agentId,
                count: restartInfo.count,
                window: this.restartWindow
            });
            return;
        }
        
        restartInfo.count++;
        this.restartCounts.set(agentId, restartInfo);
        
        this.emit('agent:auto-restarting', { agentId, attempt: restartInfo.count });
        
        // Perform restart
        try {
            execSync(`docker compose -p heretek-openclaw-core restart ${agentId}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.emit('agent:restarted', { agentId, attempt: restartInfo.count });
        } catch (error) {
            this.emit('agent:restart-failed', { agentId, error: error.message });
        }
    }

    /**
     * Get health history for an agent
     * @param {string} agentId - Agent identifier
     * @returns {Array<Object>} Health history entries
     */
    getHealthHistory(agentId) {
        return this.healthHistory.get(agentId) || [];
    }

    /**
     * Get monitoring status
     * @returns {Object} Monitoring status
     */
    getStatus() {
        return {
            monitoring: this.monitoring,
            interval: this.checkInterval,
            autoRestart: this.autoRestart,
            maxRestarts: this.maxRestarts,
            restartWindow: this.restartWindow,
            gatewayConnected: this.ws && this.ws.readyState === WebSocket.OPEN
        };
    }

    /**
     * Disconnect from Gateway
     */
    async disconnect() {
        this.stopMonitoring();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = HealthMonitor;
