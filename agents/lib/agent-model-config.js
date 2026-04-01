/**
 * Agent Model Configuration Loader and Validator
 * 
 * Loads and validates per-agent model configurations from YAML files.
 * Provides configuration merging, validation, and environment variable resolution.
 * 
 * @module agents/lib/agent-model-config
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Default configuration values for agents without specific configs
 */
const DEFAULT_CONFIG = {
  model_config: {
    primary: {
      model: 'minimax/MiniMax-M2.7',
      max_tokens: 8192,
      temperature: 0.7,
      top_p: 0.9
    },
    fallback: {
      model: 'zai/glm-5-1',
      max_tokens: 4096,
      temperature: 0.7,
      top_p: 0.9
    },
    fallback_chain: []
  },
  rate_limits: {
    requests_per_minute: 60,
    tokens_per_minute: 50000,
    tokens_per_day: 500000,
    burst_limit: 10
  },
  budget: {
    daily_limit_usd: 10.00,
    monthly_limit_usd: 200.00,
    alert_threshold: 0.8,
    hard_stop_threshold: 1.0
  },
  retry: {
    max_retries: 3,
    retry_delay_ms: 1000,
    exponential_backoff: true,
    max_delay_ms: 10000
  },
  logging: {
    log_requests: true,
    log_responses: false,
    log_costs: true,
    log_fallbacks: true,
    trace_id_header: 'x-agent-trace-id'
  }
};

/**
 * Known agents in the OpenClaw collective
 */
const KNOWN_AGENTS = [
  'steward',
  'alpha',
  'beta',
  'charlie',
  'examiner',
  'explorer',
  'sentinel',
  'coder',
  'dreamer',
  'empath',
  'historian',
  'arbiter',
  'coordinator',
  'nexus',
  'catalyst',
  'chronos',
  'metis',
  'perceiver',
  'prism',
  'echo'
];

/**
 * Agent Model Configuration Class
 * 
 * Handles loading, validation, and retrieval of agent model configurations.
 */
class AgentModelConfig {
  /**
   * Create an AgentModelConfig instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.configDir - Directory containing agent config files
   * @param {string} options.litellmConfigPath - Path to litellm_config.yaml
   * @param {boolean} options.validateOnLoad - Validate configs on load
   */
  constructor(options = {}) {
    this.configDir = options.configDir || path.join(__dirname, '../../config/agents');
    this.litellmConfigPath = options.litellmConfigPath || path.join(__dirname, '../../litellm_config.yaml');
    this.validateOnLoad = options.validateOnLoad !== false;
    
    /** @type {Map<string, Object>} */
    this.configs = new Map();
    
    /** @type {Object|null} */
    this.litellmConfig = null;
    
    /** @type {Array<string>} */
    this.validationErrors = [];
    
    /** @type {Array<string>} */
    this.validationWarnings = [];
  }

  /**
   * Load all agent configurations
   * 
   * @returns {Promise<Map<string, Object>>} Map of agent ID to configuration
   */
  async loadAll() {
    this.configs.clear();
    this.validationErrors = [];
    this.validationWarnings = [];

    // Load LiteLLM config for reference
    this.litellmConfig = this._loadLitellmConfig();

    // Load individual agent configs
    const agentFiles = this._findAgentConfigFiles();
    
    for (const agentFile of agentFiles) {
      try {
        const config = this._loadAgentConfig(agentFile);
        const agentId = this._extractAgentId(agentFile);
        
        if (config) {
          this.configs.set(agentId, config);
        }
      } catch (error) {
        this.validationErrors.push(`Failed to load ${agentFile}: ${error.message}`);
      }
    }

    // Apply defaults for known agents without configs
    for (const agent of KNOWN_AGENTS) {
      if (!this.configs.has(agent)) {
        this.configs.set(agent, this._createDefaultConfig(agent));
        this.validationWarnings.push(`No config found for agent '${agent}', using defaults`);
      }
    }

    // Validate all loaded configs
    if (this.validateOnLoad) {
      this._validateAllConfigs();
    }

    return this.configs;
  }

  /**
   * Load configuration for a specific agent
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Promise<Object>} Agent configuration
   */
  async load(agentId) {
    if (this.configs.has(agentId)) {
      return this.configs.get(agentId);
    }

    const configPath = path.join(this.configDir, `${agentId}-models.yaml`);
    
    if (!fs.existsSync(configPath)) {
      const defaultConfig = this._createDefaultConfig(agentId);
      this.configs.set(agentId, defaultConfig);
      return defaultConfig;
    }

    const config = this._loadAgentConfig(configPath);
    this.configs.set(agentId, config);
    
    if (this.validateOnLoad) {
      this._validateConfig(agentId, config);
    }

    return config;
  }

  /**
   * Get configuration for a specific agent
   * 
   * @param {string} agentId - Agent identifier
   * @param {boolean} includeDefaults - Include default values for missing keys
   * @returns {Object} Agent configuration
   */
  getConfig(agentId, includeDefaults = true) {
    const config = this.configs.get(agentId);
    
    if (!config) {
      return includeDefaults ? this._createDefaultConfig(agentId) : null;
    }

    if (includeDefaults) {
      return this._mergeWithDefaults(config);
    }

    return config;
  }

  /**
   * Get all agent configurations
   * 
   * @param {boolean} includeDefaults - Include default values for missing keys
   * @returns {Object} Object mapping agent IDs to configurations
   */
  getAllConfigs(includeDefaults = true) {
    const result = {};
    
    for (const [agentId, config] of this.configs) {
      result[agentId] = includeDefaults 
        ? this._mergeWithDefaults(config)
        : config;
    }

    return result;
  }

  /**
   * Get the primary model for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Object} Primary model configuration
   */
  getPrimaryModel(agentId) {
    const config = this.getConfig(agentId);
    return config?.model_config?.primary || DEFAULT_CONFIG.model_config.primary;
  }

  /**
   * Get the fallback model for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Object|null} Fallback model configuration
   */
  getFallbackModel(agentId) {
    const config = this.getConfig(agentId);
    return config?.model_config?.fallback || null;
  }

  /**
   * Get the fallback chain for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Array<Object>} Array of fallback model configurations
   */
  getFallbackChain(agentId) {
    const config = this.getConfig(agentId);
    return config?.model_config?.fallback_chain || [];
  }

  /**
   * Get all models for an agent (primary + fallbacks)
   * 
   * @param {string} agentId - Agent identifier
   * @returns {Array<Object>} Array of all model configurations
   */
  getAllModels(agentId) {
    const config = this.getConfig(agentId);
    const models = [];

    if (config?.model_config?.primary) {
      models.push({ ...config.model_config.primary, priority: 'primary' });
    }

    if (config?.model_config?.fallback) {
      models.push({ ...config.model_config.fallback, priority: 'fallback' });
    }

    if (config?.model_config?.fallback_chain) {
      config.model_config.fallback_chain.forEach((model, index) => {
        models.push({ ...model, priority: `fallback_chain_${index}` });
      });
    }

    return models;
  }

  /**
   * Validate all loaded configurations
   * 
   * @returns {Object} Validation result with errors and warnings
   */
  validateAll() {
    this.validationErrors = [];
    this.validationWarnings = [];

    for (const [agentId, config] of this.configs) {
      this._validateConfig(agentId, config);
    }

    return {
      valid: this.validationErrors.length === 0,
      errors: this.validationErrors,
      warnings: this.validationWarnings,
      configCount: this.configs.size
    };
  }

  /**
   * Check if an API key is available for a model
   * 
   * @param {string} envVarName - Environment variable name for API key
   * @returns {boolean} Whether the API key is available
   */
  hasApiKey(envVarName) {
    if (!envVarName) return false;
    
    // Handle os.environ/ prefix
    const cleanName = envVarName.replace(/^os\.environ\//, '');
    
    return !!process.env[cleanName];
  }

  /**
   * Get validation errors
   * 
   * @returns {Array<string>} Array of validation error messages
   */
  getErrors() {
    return this.validationErrors;
  }

  /**
   * Get validation warnings
   * 
   * @returns {Array<string>} Array of validation warning messages
   */
  getWarnings() {
    return this.validationWarnings;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Load the LiteLLM configuration file
   * 
   * @private
   * @returns {Object|null} LiteLLM configuration
   */
  _loadLitellmConfig() {
    try {
      if (fs.existsSync(this.litellmConfigPath)) {
        const content = fs.readFileSync(this.litellmConfigPath, 'utf8');
        return yaml.load(content);
      }
    } catch (error) {
      this.validationWarnings.push(`Failed to load LiteLLM config: ${error.message}`);
    }
    return null;
  }

  /**
   * Find all agent configuration files
   * 
   * @private
   * @returns {Array<string>} Array of config file paths
   */
  _findAgentConfigFiles() {
    const files = [];

    if (!fs.existsSync(this.configDir)) {
      return files;
    }

    const entries = fs.readdirSync(this.configDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('-models.yaml')) {
        files.push(path.join(this.configDir, entry.name));
      }
    }

    return files.sort();
  }

  /**
   * Extract agent ID from config file path
   * 
   * @private
   * @param {string} filePath - Path to config file
   * @returns {string} Agent ID
   */
  _extractAgentId(filePath) {
    const basename = path.basename(filePath, '-models.yaml');
    return basename;
  }

  /**
   * Load a single agent configuration file
   * 
   * @private
   * @param {string} configPath - Path to config file
   * @returns {Object|null} Agent configuration
   */
  _loadAgentConfig(configPath) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(content);
      
      // Resolve environment variables
      this._resolveEnvVariables(config);
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Recursively resolve environment variables in config
   * 
   * @private
   * @param {Object} config - Configuration object to resolve
   */
  _resolveEnvVariables(config) {
    if (typeof config === 'string') {
      // Handle os.environ/VAR_NAME format
      if (config.startsWith('os.environ/')) {
        const envVar = config.replace(/^os\.environ\//, '');
        const value = process.env[envVar];
        if (value) {
          return value;
        }
      }
      // Handle ${VAR_NAME} format
      const envMatch = config.match(/^\$\{([^}]+)\}$/);
      if (envMatch) {
        const value = process.env[envMatch[1]];
        if (value) {
          return value;
        }
      }
      return config;
    }

    if (Array.isArray(config)) {
      return config.map(item => this._resolveEnvVariables(item));
    }

    if (config && typeof config === 'object') {
      for (const key of Object.keys(config)) {
        config[key] = this._resolveEnvVariables(config[key]);
      }
    }

    return config;
  }

  /**
   * Create a default configuration for an agent
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @returns {Object} Default configuration
   */
  _createDefaultConfig(agentId) {
    return {
      agent_name: agentId,
      agent_role: 'unknown',
      agent_description: `Default configuration for ${agentId}`,
      model_config: { ...DEFAULT_CONFIG.model_config },
      rate_limits: { ...DEFAULT_CONFIG.rate_limits },
      budget: { ...DEFAULT_CONFIG.budget },
      retry: { ...DEFAULT_CONFIG.retry },
      logging: { ...DEFAULT_CONFIG.logging }
    };
  }

  /**
   * Merge configuration with defaults
   * 
   * @private
   * @param {Object} config - Configuration to merge
   * @returns {Object} Merged configuration
   */
  _mergeWithDefaults(config) {
    const merged = { ...DEFAULT_CONFIG };
    
    for (const key of Object.keys(config)) {
      if (config[key] && typeof config[key] === 'object' && !Array.isArray(config[key])) {
        merged[key] = { ...merged[key], ...config[key] };
      } else {
        merged[key] = config[key];
      }
    }

    return merged;
  }

  /**
   * Validate a single agent configuration
   * 
   * @private
   * @param {string} agentId - Agent identifier
   * @param {Object} config - Configuration to validate
   */
  _validateConfig(agentId, config) {
    // Validate primary model
    if (!config.model_config?.primary?.model) {
      this.validationErrors.push(
        `Agent '${agentId}': Missing primary model configuration`
      );
    } else {
      const primaryModel = config.model_config.primary;
      
      // Check API key availability
      if (primaryModel.api_key_env && !this.hasApiKey(primaryModel.api_key_env)) {
        this.validationWarnings.push(
          `Agent '${agentId}': API key not found for primary model: ${primaryModel.api_key_env}`
        );
      }

      // Validate max_tokens
      if (primaryModel.max_tokens && 
          (typeof primaryModel.max_tokens !== 'number' || primaryModel.max_tokens <= 0)) {
        this.validationErrors.push(
          `Agent '${agentId}': Invalid max_tokens for primary model: ${primaryModel.max_tokens}`
        );
      }

      // Validate temperature
      if (primaryModel.temperature !== undefined && 
          (typeof primaryModel.temperature !== 'number' || 
           primaryModel.temperature < 0 || 
           primaryModel.temperature > 2)) {
        this.validationErrors.push(
          `Agent '${agentId}': Invalid temperature for primary model: ${primaryModel.temperature}`
        );
      }
    }

    // Validate fallback model if specified
    if (config.model_config?.fallback) {
      const fallbackModel = config.model_config.fallback;
      
      if (fallbackModel.api_key_env && !this.hasApiKey(fallbackModel.api_key_env)) {
        this.validationWarnings.push(
          `Agent '${agentId}': API key not found for fallback model: ${fallbackModel.api_key_env}`
        );
      }
    }

    // Validate rate limits
    if (config.rate_limits) {
      const limits = config.rate_limits;
      
      if (limits.requests_per_minute && limits.requests_per_minute <= 0) {
        this.validationErrors.push(
          `Agent '${agentId}': Invalid requests_per_minute: ${limits.requests_per_minute}`
        );
      }

      if (limits.tokens_per_day && limits.tokens_per_day <= 0) {
        this.validationErrors.push(
          `Agent '${agentId}': Invalid tokens_per_day: ${limits.tokens_per_day}`
        );
      }
    }

    // Validate budget
    if (config.budget) {
      const budget = config.budget;
      
      if (budget.daily_limit_usd && budget.daily_limit_usd < 0) {
        this.validationErrors.push(
          `Agent '${agentId}': Invalid daily_limit_usd: ${budget.daily_limit_usd}`
        );
      }

      if (budget.alert_threshold && 
          (budget.alert_threshold < 0 || budget.alert_threshold > 1)) {
        this.validationErrors.push(
          `Agent '${agentId}': Invalid alert_threshold: ${budget.alert_threshold}`
        );
      }

      if (budget.hard_stop_threshold && 
          (budget.hard_stop_threshold < 0 || budget.hard_stop_threshold > 1)) {
        this.validationErrors.push(
          `Agent '${agentId}': Invalid hard_stop_threshold: ${budget.hard_stop_threshold}`
        );
      }
    }
  }

  /**
   * Validate all configurations
   * 
   * @private
   */
  _validateAllConfigs() {
    for (const [agentId, config] of this.configs) {
      this._validateConfig(agentId, config);
    }
  }
}

/**
 * Create a new AgentModelConfig instance
 * 
 * @param {Object} options - Configuration options
 * @returns {AgentModelConfig} New instance
 */
function createAgentModelConfig(options = {}) {
  return new AgentModelConfig(options);
}

module.exports = {
  AgentModelConfig,
  createAgentModelConfig,
  DEFAULT_CONFIG,
  KNOWN_AGENTS
};
