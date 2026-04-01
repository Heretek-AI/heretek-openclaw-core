/**
 * Heretek Provider Abstraction Layer
 * 
 * Unified interface for 17+ LLM providers with triad-aware routing,
 * consensus-based failover, and cost optimization.
 * 
 * @module @heretek/provider-abstraction
 */

const { HeretekProviderRouter } = require('./provider-router');
const { AnthropicConnector } = require('../connectors/anthropic-connector');
const { OpenAIConnector } = require('../connectors/openai-connector');

// Export main router
module.exports.HeretekProviderRouter = HeretekProviderRouter;

// Export connectors for direct use
module.exports.AnthropicConnector = AnthropicConnector;
module.exports.OpenAIConnector = OpenAIConnector;

/**
 * Create a configured provider router instance
 * @param {Object} options - Configuration options
 * @returns {HeretekProviderRouter} Configured router
 */
function createProviderRouter(options = {}) {
  const router = new HeretekProviderRouter(options);
  
  // Register default connectors
  router.registerConnector('anthropic', (config) => new AnthropicConnector(config));
  router.registerConnector('openai', (config) => new OpenAIConnector(config));
  
  return router;
}

module.exports.createProviderRouter = createProviderRouter;

// Convenience function for quick setup
module.exports.init = (options) => createProviderRouter(options);
