/**
 * Anthropic Provider Connector
 * 
 * Implements Heretek provider abstraction for Claude models.
 * Supports triad-aware request routing and cost tracking.
 */

const axios = require('axios');

class AnthropicConnector {
  constructor(options = {}) {
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.defaultModel = options.defaultModel || 'claude-3-5-sonnet-20241022';
    
    if (!this.apiKey) {
      console.warn('⚠️  Anthropic API key not configured');
    }
  }

  /**
   * Send chat completion request to Anthropic
   */
  async chatComplete(request, triadContext = {}) {
    const { messages, model = this.defaultModel, max_tokens = 1024, system } = request;
    
    // Convert OpenAI format to Anthropic format
    const anthropicRequest = {
      model,
      max_tokens,
      messages: this.convertMessages(messages),
      ...(system && { system })
    };

    try {
      const response = await axios.post(`${this.baseUrl}/messages`, anthropicRequest, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 60000
      });

      return {
        id: response.data.id,
        choices: [{
          message: {
            role: 'assistant',
            content: response.data.content[0].text
          },
          finish_reason: response.data.stop_reason
        }],
        usage: {
          prompt_tokens: response.data.usage.input_tokens,
          completion_tokens: response.data.usage.output_tokens,
          total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens
        },
        provider: 'anthropic',
        triadContext
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Convert OpenAI message format to Anthropic format
   */
  convertMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  /**
   * Handle Anthropic-specific errors
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          return new Error('Anthropic API: Invalid API key');
        case 429:
          return new Error('Anthropic API: Rate limit exceeded');
        case 500:
          return new Error('Anthropic API: Internal server error');
        default:
          return new Error(`Anthropic API: ${status} - ${JSON.stringify(data)}`);
      }
    }
    return error;
  }

  /**
   * Get available models
   */
  async getModels() {
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000 },
    ];
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(inputTokens, outputTokens, model = this.defaultModel) {
    const pricing = {
      'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 }, // per 1M tokens
      'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    };

    const rates = pricing[model] || pricing['claude-3-5-sonnet-20241022'];
    return {
      input: (inputTokens / 1000000) * rates.input,
      output: (outputTokens / 1000000) * rates.output,
      total: ((inputTokens * rates.input) + (outputTokens * rates.output)) / 1000000
    };
  }
}

module.exports = { AnthropicConnector };
