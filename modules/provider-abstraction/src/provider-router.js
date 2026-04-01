/**
 * Heretek Provider Router
 * 
 * Triad-aware provider selection with consensus-based routing and automatic failover.
 * Implements Heretek differentiators from HERETEK_ARCHITECTURE_STRATEGY.md section 4.1.3
 */

const { Redis } = require('ioredis');
const axios = require('axios');

class HeretekProviderRouter {
  constructor(options = {}) {
    this.redis = new Redis(options.redisUrl || 'redis://localhost:6379');
    this.providers = new Map();
    this.triadPreferences = new Map();
    this.consensusThreshold = 2 / 3; // 2/3 consensus required
    
    // Initialize default providers
    this.registerDefaultProviders();
  }

  /**
   * Register default LLM providers
   */
  registerDefaultProviders() {
    const defaultProviders = [
      { id: 'ollama', baseUrl: 'http://localhost:11434', type: 'local' },
      { id: 'anthropic', baseUrl: 'https://api.anthropic.com', type: 'cloud' },
      { id: 'openai', baseUrl: 'https://api.openai.com/v1', type: 'cloud' },
      { id: 'google', baseUrl: 'https://generativelanguage.googleapis.com', type: 'cloud' },
      { id: 'groq', baseUrl: 'https://api.groq.com/openai/v1', type: 'cloud' },
    ];

    defaultProviders.forEach(provider => {
      this.providers.set(provider.id, {
        ...provider,
        status: 'available',
        lastChecked: Date.now(),
        latency: null,
        cost: null
      });
    });
  }

  /**
   * Route a request to appropriate provider with triad awareness
   * @param {Object} request - The LLM request
   * @param {Object} triadContext - Current triad session context
   */
  async route(request, triadContext = {}) {
    const sessionId = triadContext.sessionId || 'default';
    
    // Check for triad-specified provider preference
    const preferredProvider = await this.getTriadPreference(sessionId);
    
    if (preferredProvider) {
      const available = await this.isProviderAvailable(preferredProvider);
      if (available) {
        return this.dispatch(preferredProvider, request);
      }
      
      // Preferred provider unavailable - notify triad and failover
      await this.notifyTriadFailover(sessionId, preferredProvider);
    }
    
    // Auto-select best available provider
    const bestProvider = await this.selectBestProvider(request);
    return this.dispatch(bestProvider, request);
  }

  /**
   * Dispatch request to specific provider
   */
  async dispatch(providerId, request) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not registered`);
    }

    const startTime = Date.now();
    try {
      const response = await axios.post(`${provider.baseUrl}/chat/completions`, request, {
        headers: {
          'Authorization': `Bearer ${process.env[`${providerId.toUpperCase()}_API_KEY`]}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // Record latency
      const latency = Date.now() - startTime;
      await this.recordProviderMetrics(providerId, { latency, success: true });

      return response.data;
    } catch (error) {
      await this.recordProviderMetrics(providerId, { error: error.message, success: false });
      throw error;
    }
  }

  /**
   * Get triad's preferred provider for a session
   */
  async getTriadPreference(sessionId) {
    const key = `triad:provider:${sessionId}`;
    return this.redis.get(key);
  }

  /**
   * Set triad's provider preference (requires consensus)
   */
  async setTriadPreference(sessionId, providerId, consensus) {
    if (!consensus || consensus.approved !== true) {
      throw new Error('Triad consensus required for provider preference change');
    }

    const key = `triad:provider:${sessionId}`;
    await this.redis.setex(key, 86400, providerId); // 24h TTL
    await this.logConsensusDecision(sessionId, providerId, consensus);
  }

  /**
   * Check if provider is available
   */
  async isProviderAvailable(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    // Quick health check
    try {
      await axios.get(`${provider.baseUrl}/health`, { timeout: 5000 });
      provider.status = 'available';
      return true;
    } catch {
      provider.status = 'unavailable';
      return false;
    }
  }

  /**
   * Select best provider based on cost, latency, availability
   */
  async selectBestProvider(request) {
    const available = [];
    
    for (const [id, provider] of this.providers) {
      if (await this.isProviderAvailable(id)) {
        available.push({ id, ...provider });
      }
    }

    if (available.length === 0) {
      throw new Error('No providers available');
    }

    // Simple selection: prefer local, then lowest latency
    const local = available.find(p => p.type === 'local');
    if (local) return local.id;

    available.sort((a, b) => (a.latency || Infinity) - (b.latency || Infinity));
    return available[0].id;
  }

  /**
   * Notify triad of provider failover
   */
  async notifyTriadFailover(sessionId, originalProvider) {
    const message = {
      type: 'provider_failover',
      sessionId,
      originalProvider,
      timestamp: Date.now()
    };

    await this.redis.publish('triad:notifications', JSON.stringify(message));
  }

  /**
   * Record provider metrics for cost optimization
   */
  async recordProviderMetrics(providerId, metrics) {
    const key = `metrics:provider:${providerId}:${new Date().toISOString().split('T')[0]}`;
    await this.redis.hincrby(key, metrics.success ? 'successes' : 'failures', 1);
    if (metrics.latency) {
      await this.redis.hincrby(key, 'total_latency', metrics.latency);
    }
  }

  /**
   * Log consensus decision for audit trail
   */
  async logConsensusDecision(sessionId, providerId, consensus) {
    const ledgerKey = `consensus-ledger:provider:${sessionId}`;
    await this.redis.lpush(ledgerKey, JSON.stringify({
      timestamp: Date.now(),
      action: 'provider_preference',
      providerId,
      consensus: {
        approved: consensus.approved,
        votes: consensus.votes,
        triad: consensus.triad
      }
    }));
  }
}

module.exports = { HeretekProviderRouter };
