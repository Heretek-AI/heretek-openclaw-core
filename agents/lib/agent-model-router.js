/**
 * Agent Model Router
 * 
 * Routes agent LLM requests to configured models with automatic fallback handling.
 * Intercepts requests and directs them to the appropriate model based on agent configuration.
 * 
 * @module agents/lib/agent-model-router
 */

const { AgentModelConfig, createAgentModelConfig } = require('./agent-model-config');

/**
 * Model request status codes
 */
const RequestStatus = {
  SUCCESS: 'success',
  FALLBACK_TRIGGERED: 'fallback_triggered',
  ALL_MODELS_FAILED: 'all_models_failed',
  RATE_LIMITED: 'rate_limited',
  BUDGET_EXCEEDED: 'budget_exceeded',
  CONFIG_ERROR: 'config_error'
};

/**
 * Agent Model Router Class
 * 
 * Handles routing of LLM requests to configured models per agent.
 * Implements fallback logic, rate limiting, and cost tracking.
 */
class AgentModelRouter {
  /**
   * Create an AgentModelRouter instance
   * 
   * @param {Object} options - Router options
   * @param {AgentModelConfig} options.config - Agent model configuration instance
   * @param {Object} options.litellmClient - LiteLLM client for making requests
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.config = options.config || createAgentModelConfig();
    this.litellmClient = options.litellmClient || null;
    this.logger = options.logger || console;
    
    /** @type {Map<string, Object>} Agent runtime state */
    this.agentState = new Map();
    
    /** @type {Map<string, Array<Object>>} Request history per agent */
    this.requestHistory = new Map();
    
    /** @type {Map<string, number>} Token usage tracking per agent */
    this.tokenUsage = new Map();
    
    /** @type {Map<string, number>} Cost tracking per agent */
    this.costTracking = new Map();
    
    /** @type {boolean} Whether router is initialized */
    this.initialized = false;
  }

  /**
   * Initialize the router and load configurations
   * 
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      await this.config.loadAll();
      
      // Initialize state for all agents
      for (const [agentId] of this.config.getAllConfigs()) {
        this.agentState.set(agentId, {
          currentModelIndex: 0,
          consecutiveFailures: 0,
          lastFailureTime: null,
          isHealthy: true,
          availableModels: []
        });
        
        this.requestHistory.set(agentId, []);
        this.tokenUsage.set(agentId, 0);
        this.costTracking.set(agentId, 0);
      }
      
      this.initialized = true;
      
      const validation = this.config.validateAll();
      
      this.logger.log('[AgentModelRouter] Initialized successfully', {
        agentCount: this.config.configs.size,
        validationErrors: validation.errors.length,
        validationWarnings: validation.warnings.length
      });
      
      return {
        success: true,
        agentCount: this.config.configs.size,
        validation
      };
    } catch (error) {
      this.logger.error('[AgentModelRouter] Initialization failed', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Route a completion request for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @param {Object} request - Completion request parameters
   * @param {string} request.messages - Messages array for completion
   * @param {number} [request.max_tokens] - Maximum tokens to generate
   * @param {number} [request.temperature] - Temperature for generation
   * @param {Object} [options] - Additional routing options
   * @param {boolean} [options.useFallback=true] - Whether to use fallback on failure
   * @param {string} [options.requestType] - Type of request (e.g., 'code_review', 'chat')
   * 
   * @returns {Promise<Object>} Completion result with metadata
   */
  async routeCompletion(agentId, request, options = {}) {
    const { useFallback = true, requestType = null } = options;
    
    // Ensure agent is loaded
    await this.config.load(agentId);
    
    // Get model list for this agent
    const models = this.config.getAllModels(agentId);
    
    if (models.length === 0) {
      return this._createErrorResponse(
        agentId,
        RequestStatus.CONFIG_ERROR,
        `No models configured for agent '${agentId}'`
      );
    }

    // Check for model override based on request type
    const config = this.config.getConfig(agentId);
    let effectiveModels = [...models];
    
    if (requestType && config.model_overrides?.[requestType]) {
      const override = config.model_overrides[requestType];
      if (override.model) {
        effectiveModels = [{
          ...override,
          model: override.model,
          priority: 'override'
        }];
      } else {
        // Apply overrides to primary model
        effectiveModels[0] = { ...effectiveModels[0], ...override };
      }
    }

    // Check rate limits
    const rateLimitResult = this._checkRateLimit(agentId, config);
    if (!rateLimitResult.allowed) {
      return this._createErrorResponse(
        agentId,
        RequestStatus.RATE_LIMITED,
        rateLimitResult.reason,
        { retryAfter: rateLimitResult.retryAfter }
      );
    }

    // Check budget
    const budgetResult = this._checkBudget(agentId, config);
    if (!budgetResult.allowed) {
      return this._createErrorResponse(
        agentId,
        RequestStatus.BUDGET_EXCEEDED,
        budgetResult.reason
      );
    }

    // Attempt completion with model chain
    let lastError = null;
    let fallbackCount = 0;
    
    for (let i = 0; i < effectiveModels.length; i++) {
      const modelConfig = effectiveModels[i];
      const isPrimary = i === 0;
      
      try {
        const result = await this._attemptCompletion(
          agentId,
          modelConfig,
          request
        );
        
        // Update success metrics
        this._updateAgentState(agentId, {
          currentModelIndex: i,
          consecutiveFailures: 0,
          isHealthy: true
        });
        
        // Track usage
        this._trackUsage(agentId, result, modelConfig);
        
        return {
          ...result,
          model_used: modelConfig.model,
          model_priority: modelConfig.priority,
          fallback_count: fallbackCount,
          status: fallbackCount > 0 ? RequestStatus.FALLBACK_TRIGGERED : RequestStatus.SUCCESS
        };
        
      } catch (error) {
        lastError = error;
        
        this.logger.warn(
          `[AgentModelRouter] Model ${modelConfig.model} failed for agent ${agentId}:`,
          error.message
        );
        
        // Update failure metrics
        this._updateAgentState(agentId, {
          consecutiveFailures: (this.agentState.get(agentId)?.consecutiveFailures || 0) + 1,
          lastFailureTime: Date.now()
        });
        
        // Try fallback if available and enabled
        if (!useFallback || i >= effectiveModels.length - 1) {
          break;
        }
        
        fallbackCount++;
      }
    }

    // All models failed
    this._updateAgentState(agentId, { isHealthy: false });
    
    return this._createErrorResponse(
      agentId,
      RequestStatus.ALL_MODELS_FAILED,
      `All ${effectiveModels.length} models failed. Last error: ${lastError?.message}`,
      {
        attempted_models: effectiveModels.map(m => m.model),
        last_error: lastError?.message,
        fallback_attempts: fallbackCount
      }
    );
  }

  /**
   * Get the current model for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Object} Current model configuration
   */
  getCurrentModel(agentId) {
    const state = this.agentState.get(agentId);
    const models = this.config.getAllModels(agentId);
    
    if (!state || !models.length) {
      return null;
    }
    
    const index = Math.min(state.currentModelIndex, models.length - 1);
    return models[index];
  }

  /**
   * Get usage statistics for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Object} Usage statistics
   */
  getUsageStats(agentId) {
    const config = this.config.getConfig(agentId);
    const tokensUsed = this.tokenUsage.get(agentId) || 0;
    const costUsed = this.costTracking.get(agentId) || 0;
    
    return {
      tokens: {
        used: tokensUsed,
        daily_limit: config.rate_limits?.tokens_per_day || Infinity,
        remaining: (config.rate_limits?.tokens_per_day || Infinity) - tokensUsed,
        percentage_used: config.rate_limits?.tokens_per_day 
          ? (tokensUsed / config.rate_limits.tokens_per_day) * 100 
          : 0
      },
      cost: {
        used: costUsed,
        daily_limit: config.budget?.daily_limit_usd || Infinity,
        remaining: (config.budget?.daily_limit_usd || Infinity) - costUsed,
        percentage_used: config.budget?.daily_limit_usd
          ? (costUsed / config.budget.daily_limit_usd) * 100
          : 0
      },
      budget_alert: config.budget?.daily_limit_usd && 
        costUsed >= config.budget.daily_limit_usd * config.budget.alert_threshold
    };
  }

  /**
   * Reset usage tracking for an agent
   * 
   * @param {string} agentId - Agent identifier
   */
  resetUsage(agentId) {
    this.tokenUsage.set(agentId, 0);
    this.costTracking.set(agentId, 0);
    this.requestHistory.set(agentId, []);
    
    const state = this.agentState.get(agentId);
    if (state) {
      state.consecutiveFailures = 0;
      state.isHealthy = true;
    }
  }

  /**
   * Manually set the model for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @param {string} modelName - Model name to use
   * @returns {boolean} Whether the model was set successfully
   */
  setModel(agentId, modelName) {
    const models = this.config.getAllModels(agentId);
    const modelIndex = models.findIndex(m => m.model === modelName);
    
    if (modelIndex === -1) {
      this.logger.warn(`[AgentModelRouter] Model ${modelName} not found for agent ${agentId}`);
      return false;
    }
    
    this._updateAgentState(agentId, {
      currentModelIndex: modelIndex,
      consecutiveFailures: 0,
      isHealthy: true
    });
    
    this.logger.log(`[AgentModelRouter] Set model ${modelName} for agent ${agentId}`);
    return true;
  }

  /**
   * Get all available models for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Array<Object>} Array of model configurations
   */
  getAvailableModels(agentId) {
    return this.config.getAllModels(agentId);
  }

  /**
   * Get health status for all agents
   * 
   * @returns {Object} Health status per agent
   */
  getHealthStatus() {
    const status = {};
    
    for (const [agentId, state] of this.agentState) {
      const usage = this.getUsageStats(agentId);
      
      status[agentId] = {
        is_healthy: state.isHealthy,
        current_model: this.getCurrentModel(agentId)?.model || null,
        consecutive_failures: state.consecutiveFailures,
        last_failure_time: state.lastFailureTime,
        usage
      };
    }
    
    return status;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Attempt completion with a specific model
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @param {Object} modelConfig - Model configuration
   * @param {Object} request - Request parameters
   * @returns {Promise<Object>} Completion result
   */
  async _attemptCompletion(agentId, modelConfig, request) {
    const startTime = Date.now();
    
    // Build request parameters
    const params = {
      model: modelConfig.model,
      messages: request.messages,
      max_tokens: request.max_tokens || modelConfig.max_tokens,
      temperature: request.temperature !== undefined ? request.temperature : modelConfig.temperature,
      top_p: request.top_p !== undefined ? request.top_p : modelConfig.top_p,
      stream: request.stream || false
    };

    // Add API key if specified
    if (modelConfig.api_key_env) {
      const apiKey = process.env[modelConfig.api_key_env.replace(/^os\.environ\//, '')];
      if (apiKey) {
        params.api_key = apiKey;
      }
    }

    // Add API base if specified
    if (modelConfig.api_base) {
      params.api_base = modelConfig.api_base;
    }

    // Make the actual request
    if (this.litellmClient) {
      const response = await this.litellmClient.completion(params);
      
      return {
        content: response.choices?.[0]?.message?.content || '',
        usage: response.usage || {},
        model: response.model || modelConfig.model,
        latency_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }

    // Fallback: Use fetch directly if no client
    const response = await this._fetchCompletion(params);
    
    return {
      content: response.choices?.[0]?.message?.content || '',
      usage: response.usage || {},
      model: response.model || modelConfig.model,
      latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Fetch completion using direct API call
   * 
   * @private
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} API response
   */
  async _fetchCompletion(params) {
    // This would typically call the LiteLLM proxy or API
    // For now, throw an error indicating the client is needed
    throw new Error('LiteLLM client not configured. Please provide a litellmClient option.');
  }

  /**
   * Check rate limits for an agent
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @param {Object} config - Agent configuration
   * @returns {Object} Rate limit check result
   */
  _checkRateLimit(agentId, config) {
    const limits = config.rate_limits || {};
    const history = this.requestHistory.get(agentId) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Count requests in the last minute
    const recentRequests = history.filter(h => h.timestamp > oneMinuteAgo);
    
    if (limits.requests_per_minute && recentRequests.length >= limits.requests_per_minute) {
      const oldestRequest = recentRequests[0];
      const retryAfter = Math.ceil((oldestRequest.timestamp + 60000 - now) / 1000);
      
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${limits.requests_per_minute} requests per minute`,
        retryAfter
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check budget for an agent
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @param {Object} config - Agent configuration
   * @returns {Object} Budget check result
   */
  _checkBudget(agentId, config) {
    const budget = config.budget || {};
    const costUsed = this.costTracking.get(agentId) || 0;
    
    if (budget.daily_limit_usd && costUsed >= budget.daily_limit_usd * budget.hard_stop_threshold) {
      return {
        allowed: false,
        reason: `Budget exceeded: $${costUsed.toFixed(2)} / $${budget.daily_limit_usd}`
      };
    }
    
    return { allowed: true };
  }

  /**
   * Track usage for billing and rate limiting
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @param {Object} result - Completion result
   * @param {Object} modelConfig - Model configuration used
   */
  _trackUsage(agentId, result, modelConfig) {
    const history = this.requestHistory.get(agentId) || [];
    history.push({
      timestamp: Date.now(),
      model: modelConfig.model,
      tokens: result.usage?.total_tokens || 0,
      latency_ms: result.latency_ms
    });
    
    // Keep only last 1000 requests
    if (history.length > 1000) {
      history.shift();
    }
    this.requestHistory.set(agentId, history);
    
    // Update token usage
    const currentTokens = this.tokenUsage.get(agentId) || 0;
    this.tokenUsage.set(agentId, currentTokens + (result.usage?.total_tokens || 0));
    
    // Estimate cost (simplified)
    const inputCost = (result.usage?.prompt_tokens || 0) * (modelConfig.input_cost_per_token || 0.000001);
    const outputCost = (result.usage?.completion_tokens || 0) * (modelConfig.output_cost_per_token || 0.000003);
    const totalCost = inputCost + outputCost;
    
    const currentCost = this.costTracking.get(agentId) || 0;
    this.costTracking.set(agentId, currentCost + totalCost);
  }

  /**
   * Update agent state
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @param {Object} updates - State updates
   */
  _updateAgentState(agentId, updates) {
    const state = this.agentState.get(agentId) || {};
    this.agentState.set(agentId, { ...state, ...updates });
  }

  /**
   * Create an error response
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @param {string} status - Error status
   * @param {string} message - Error message
   * @param {Object} [metadata] - Additional metadata
   * @returns {Object} Error response
   */
  _createErrorResponse(agentId, status, message, metadata = {}) {
    return {
      success: false,
      status,
      message,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }
}

/**
 * Create a new AgentModelRouter instance
 * 
 * @param {Object} options - Router options
 * @returns {AgentModelRouter} New instance
 */
function createAgentModelRouter(options = {}) {
  return new AgentModelRouter(options);
}

module.exports = {
  AgentModelRouter,
  createAgentModelRouter,
  RequestStatus
};
