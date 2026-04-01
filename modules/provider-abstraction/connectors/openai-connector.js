/**
 * OpenAI Provider Connector
 * 
 * Implements Heretek provider abstraction for OpenAI models.
 * Supports triad-aware request routing and cost tracking.
 */

const axios = require('axios');

class OpenAIConnector {
  constructor(options = {}) {
    this.baseUrl = 'https://api.openai.com/v1';
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.defaultModel = options.defaultModel || 'gpt-4o';
    
    if (!this.apiKey) {
      console.warn('⚠️  OpenAI API key not configured');
    }
  }

  /**
   * Send chat completion request to OpenAI
   */
  async chatComplete(request, triadContext = {}) {
    const { messages, model = this.defaultModel, max_tokens, temperature, tools } = request;
    
    const openaiRequest = {
      model,
      messages,
      ...(max_tokens && { max_tokens }),
      ...(temperature && { temperature }),
      ...(tools && { tools })
    };

    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, openaiRequest, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      return {
        id: response.data.id,
        choices: response.data.choices,
        usage: response.data.usage,
        provider: 'openai',
        triadContext
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle OpenAI-specific errors
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          return new Error('OpenAI API: Invalid API key');
        case 429:
          return new Error('OpenAI API: Rate limit exceeded or quota exhausted');
        case 500:
          return new Error('OpenAI API: Internal server error');
        default:
          return new Error(`OpenAI API: ${status} - ${JSON.stringify(data)}`);
      }
    }
    return error;
  }

  /**
   * Get available models
   */
  async getModels() {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
      { id: 'o1-preview', name: 'o1 Preview', contextWindow: 128000, reasoning: true },
    ];
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(inputTokens, outputTokens, model = this.defaultModel) {
    const pricing = {
      'gpt-4o': { input: 5.0, output: 15.0 }, // per 1M tokens
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'o1-preview': { input: 15.0, output: 60.0 },
    };

    const rates = pricing[model] || pricing['gpt-4o'];
    return {
      input: (inputTokens / 1000000) * rates.input,
      output: (outputTokens / 1000000) * rates.output,
      total: ((inputTokens * rates.input) + (outputTokens * rates.output)) / 1000000
    };
  }
}

module.exports = { OpenAIConnector };
