/**
 * Gateway Monitor - Gateway Health Checks for OpenClaw
 * ==============================================================================
 * Monitors OpenClaw Gateway health via HTTP and WebSocket endpoints.
 * Tracks latency, error rates, and WebSocket connection status.
 */

const { execSync } = require('child_process');
const EventEmitter = require('events');
const WebSocket = require('ws');

class GatewayMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.gatewayHost = config.gatewayHost || '127.0.0.1';
        this.gatewayPort = config.gatewayPort || 18789;
        this.gatewayUrl = `http://${this.gatewayHost}:${this.gatewayPort}`;
        this.wsUrl = config.wsUrl || `ws://${this.gatewayHost}:${this.gatewayPort}`;
        this.timeout = config.timeout || 5000;
        this.ws = null;
        this.wsConnected = false;
        this.healthHistory = [];
        this.maxHistoryLength = 100;
    }

    /**
     * Check gateway HTTP health endpoint
     * @returns {Promise<Object>} Health status
     */
    async checkHttpHealth() {
        const startTime = Date.now();
        const result = {
            endpoint: `${this.gatewayUrl}/health`,
            healthy: false,
            latency: null,
            statusCode: null,
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this._httpRequest(`${this.gatewayUrl}/health`, {
                method: 'GET',
                timeout: this.timeout
            });

            result.latency = Date.now() - startTime;
            result.statusCode = response.statusCode;
            result.healthy = response.statusCode === 200;
            result.body = response.body;

        } catch (error) {
            result.error = error.message;
            result.latency = Date.now() - startTime;
        }

        this._recordHealth(result);
        return result;
    }

    /**
     * Check specific agent health via Gateway
     * @param {string} agentId - Agent identifier
     * @returns {Promise<Object>} Agent health status
     */
    async checkAgentHealth(agentId) {
        const startTime = Date.now();
        const result = {
            agentId,
            endpoint: `${this.gatewayUrl}/health/${agentId}`,
            healthy: false,
            latency: null,
            statusCode: null,
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this._httpRequest(`${this.gatewayUrl}/health/${agentId}`, {
                method: 'GET',
                timeout: this.timeout
            });

            result.latency = Date.now() - startTime;
            result.statusCode = response.statusCode;
            result.healthy = response.statusCode === 200;
            result.body = response.body;

        } catch (error) {
            result.error = error.message;
            result.latency = Date.now() - startTime;
        }

        return result;
    }

    /**
     * Check all registered agents
     * @returns {Promise<Array<Object>>} Agent health statuses
     */
    async checkAllAgents() {
        const agents = ['steward', 'alpha', 'beta', 'gamma', 'scout', 'artisan', 'guardian', 'dreamer'];
        const results = [];

        for (const agentId of agents) {
            try {
                const health = await this.checkAgentHealth(agentId);
                results.push(health);
            } catch (error) {
                results.push({
                    agentId,
                    healthy: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Connect to Gateway WebSocket
     * @returns {Promise<boolean>} Connection status
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.wsUrl);

                this.ws.on('open', () => {
                    this.wsConnected = true;
                    this.emit('websocket:connected', { url: this.wsUrl });
                    resolve(true);
                });

                this.ws.on('message', (data) => {
                    this.emit('websocket:message', data.toString());
                });

                this.ws.on('error', (error) => {
                    this.wsConnected = false;
                    this.emit('websocket:error', error);
                    reject(error);
                });

                this.ws.on('close', () => {
                    this.wsConnected = false;
                    this.emit('websocket:disconnected');
                });

                // Connection timeout
                setTimeout(() => {
                    if (!this.wsConnected) {
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, this.timeout);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Check WebSocket connection status
     * @returns {Object} WebSocket status
     */
    getWebSocketStatus() {
        return {
            connected: this.wsConnected,
            url: this.wsUrl,
            readyState: this.ws ? this.ws.readyState : null,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Send message via Gateway WebSocket
     * @param {Object} message - Message to send
     * @returns {Promise<Object>} Response
     */
    async sendWebSocketMessage(message) {
        if (!this.wsConnected) {
            await this.connectWebSocket();
        }

        return new Promise((resolve, reject) => {
            const correlationId = `msg_${Date.now()}`;
            const messageWithCorrelation = {
                ...message,
                correlationId
            };

            const timeout = setTimeout(() => {
                reject(new Error('WebSocket response timeout'));
            }, this.timeout);

            const handler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.correlationId === correlationId) {
                        clearTimeout(timeout);
                        this.ws.removeListener('message', handler);
                        resolve(response);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            this.ws.on('message', handler);
            this.ws.send(JSON.stringify(messageWithCorrelation));
        });
    }

    /**
     * Get gateway metrics
     * @returns {Promise<Object>} Gateway metrics
     */
    async getMetrics() {
        try {
            const response = await this._httpRequest(`${this.gatewayUrl}/metrics`, {
                method: 'GET',
                timeout: this.timeout
            });

            return {
                available: true,
                format: 'prometheus',
                data: response.body
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Get health history
     * @returns {Array<Object>} Health history
     */
    getHealthHistory() {
        return [...this.healthHistory];
    }

    /**
     * Get health summary
     * @returns {Object} Health summary
     */
    getHealthSummary() {
        if (this.healthHistory.length === 0) {
            return {
                checks: 0,
                healthy: 0,
                unhealthy: 0,
                errorRate: 0,
                avgLatency: 0
            };
        }

        const healthy = this.healthHistory.filter(h => h.healthy).length;
        const totalLatency = this.healthHistory.reduce((sum, h) => sum + (h.latency || 0), 0);

        return {
            checks: this.healthHistory.length,
            healthy,
            unhealthy: this.healthHistory.length - healthy,
            errorRate: ((this.healthHistory.length - healthy) / this.healthHistory.length) * 100,
            avgLatency: Math.round(totalLatency / this.healthHistory.length),
            lastCheck: this.healthHistory[this.healthHistory.length - 1]
        };
    }

    /**
     * Record health check result
     * @private
     */
    _recordHealth(result) {
        this.healthHistory.push(result);

        if (this.healthHistory.length > this.maxHistoryLength) {
            this.healthHistory.shift();
        }

        this.emit('health:check', result);
    }

    /**
     * HTTP request helper
     * @private
     */
    async _httpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const { execSync } = require('child_process');

            try {
                const curlCmd = `curl -s -w "\\n%{http_code}" --max-time ${options.timeout / 1000} "${url}"`;
                const output = execSync(curlCmd, { encoding: 'utf8' });
                const lines = output.trim().split('\n');
                const statusCode = parseInt(lines.pop());
                const body = lines.join('\n');

                resolve({ statusCode, body });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.wsConnected = false;
        }
    }
}

module.exports = GatewayMonitor;
