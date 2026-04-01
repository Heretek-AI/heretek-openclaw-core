/**
 * LiteLLM Monitor - LiteLLM Health Checks
 * ==============================================================================
 * Monitors LiteLLM gateway health, model availability, and API endpoints.
 * Tracks latency, error rates, and token usage metrics.
 */

const { execSync } = require('child_process');
const EventEmitter = require('events');

class LiteLLMMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.litellmHost = config.litellmHost || 'litellm';
        this.litellmPort = config.litellmPort || 4000;
        this.litellmUrl = `http://${this.litellmHost}:${this.litellmPort}`;
        this.apiKey = config.apiKey || process.env.LITELLM_API_KEY || '';
        this.timeout = config.timeout || 5000;
        this.healthHistory = [];
        this.maxHistoryLength = 100;
    }

    /**
     * Check LiteLLM health endpoint
     * @returns {Promise<Object>} Health status
     */
    async checkHealth() {
        const startTime = Date.now();
        const result = {
            endpoint: `${this.litellmUrl}/health`,
            healthy: false,
            latency: null,
            statusCode: null,
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this._httpRequest(`${this.litellmUrl}/health`, {
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
     * Check LiteLLM model endpoints
     * @returns {Promise<Object>} Model endpoint status
     */
    async checkModels() {
        const result = {
            endpoint: `${this.litellmUrl}/v1/models`,
            healthy: false,
            models: [],
            modelCount: 0,
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this._httpRequest(`${this.litellmUrl}/v1/models`, {
                method: 'GET',
                timeout: this.timeout,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                result.healthy = true;
                result.models = data.data || [];
                result.modelCount = result.models.length;
            }

        } catch (error) {
            result.error = error.message;
        }

        return result;
    }

    /**
     * Test chat completion endpoint
     * @param {string} model - Model to test
     * @returns {Promise<Object>} Completion test result
     */
    async testCompletion(model = 'agent/steward') {
        const startTime = Date.now();
        const result = {
            endpoint: `${this.litellmUrl}/v1/chat/completions`,
            model,
            healthy: false,
            latency: null,
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this._httpRequest(`${this.litellmUrl}/v1/chat/completions`, {
                method: 'POST',
                timeout: this.timeout,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });

            result.latency = Date.now() - startTime;

            if (response.statusCode === 200) {
                result.healthy = true;
                const data = JSON.parse(response.body);
                result.usage = data.usage;
            } else {
                result.error = `HTTP ${response.statusCode}`;
            }

        } catch (error) {
            result.error = error.message;
            result.latency = Date.now() - startTime;
        }

        return result;
    }

    /**
     * Get LiteLLM metrics
     * @returns {Promise<Object>} Metrics
     */
    async getMetrics() {
        try {
            const response = await this._httpRequest(`${this.litellmUrl}/metrics`, {
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
     * Get token usage summary
     * @returns {Promise<Object>} Token usage
     */
    async getTokenUsage() {
        try {
            // Try to get metrics and parse token usage
            const metrics = await this.getMetrics();

            if (!metrics.available) {
                return { available: false };
            }

            // Parse Prometheus format metrics
            const lines = metrics.data.split('\n');
            const usage = {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            };

            for (const line of lines) {
                if (line.startsWith('litellm_prompt_tokens_total')) {
                    const match = line.match(/(\d+)$/);
                    if (match) usage.promptTokens = parseInt(match[1]);
                } else if (line.startsWith('litellm_completion_tokens_total')) {
                    const match = line.match(/(\d+)$/);
                    if (match) usage.completionTokens = parseInt(match[1]);
                } else if (line.startsWith('litellm_tokens_total')) {
                    const match = line.match(/(\d+)$/);
                    if (match) usage.totalTokens = parseInt(match[1]);
                }
            }

            return {
                available: true,
                ...usage,
                timestamp: new Date().toISOString()
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
            try {
                let curlCmd = `curl -s -w "\\n%{http_code}" --max-time ${options.timeout / 1000}`;

                if (options.method === 'POST') {
                    curlCmd += ` -X POST`;
                }

                if (options.headers) {
                    for (const [key, value] of Object.entries(options.headers)) {
                        curlCmd += ` -H "${key}: ${value}"`;
                    }
                }

                if (options.body) {
                    curlCmd += ` -d '${options.body}'`;
                }

                curlCmd += ` "${url}"`;

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
}

module.exports = LiteLLMMonitor;
