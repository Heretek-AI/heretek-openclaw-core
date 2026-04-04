/**
 * Event Mesh Module - Solace-inspired Redis Pub/Sub for Agent Communication
 * 
 * Provides a simple, lightweight event mesh for agent-to-agent (A2A) communication
 * using Redis pub/sub. Inspired by Solace's event mesh architecture.
 */

const redis = require('redis');

class EventMesh {
  constructor(options = {}) {
    this.options = {
      host: options.host || 'localhost',
      port: options.port || 6379,
      password: options.password || null,
      db: options.db || 0,
      prefix: options.prefix || 'heretek:event:',
      agentId: options.agentId || 'default-agent',
      ...options
    };
    
    this.client = null;
    this.subscriber = null;
    this.subscriptions = new Map(); // topic -> Set of callbacks
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
  }

  /**
   * Connect to Redis and establish pub/sub channels
   * 
   * // AUDIT-FIX: A1
   * Previous bug: this.subscriber.duplicate() was called before this.subscriber existed.
   * Fix: Create main client first, connect it, then duplicate for subscriber.
   */
  async connect() {
    try {
      // Step 1: Create main Redis client for publishing
      this.client = redis.createClient({
        socket: {
          host: this.options.host,
          port: this.options.port
        },
        password: this.options.password,
        database: this.options.db
      });

      this.client.on('error', (err) => {
        console.error('[EventMesh] Client error:', err.message);
      });

      // Step 2: Connect the main client first
      await this.client.connect();

      // Step 3: Create subscriber by duplicating the connected client
      this.subscriber = this.client.duplicate();

      this.subscriber.on('error', (err) => {
        console.error('[EventMesh] Subscriber error:', err.message);
      });

      // Set up subscriber message handler
      this.subscriber.on('message', (channel, message) => {
        this._handleMessage(channel, message);
      });

      // Step 4: Connect the subscriber
      await this.subscriber.connect();

      this.connected = true;
      this.reconnectAttempts = 0;
      
    } catch (err) {
      // Cleanup on failure
      this.connected = false;
      if (this.client) {
        try { await this.client.quit(); } catch (e) { /* ignore */ }
      }
      if (this.subscriber) {
        try { await this.subscriber.quit(); } catch (e) { /* ignore */ }
      }
      this.client = null;
      this.subscriber = null;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${err.message}`);
      }
      
      this.reconnectAttempts++;
      console.error(`[EventMesh] Connection attempt ${this.reconnectAttempts} failed:`, err.message);
      throw err;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    this.connected = false;
    
    // Unsubscribe from all topics
    for (const [topic, callbacks] of this.subscriptions) {
      await this.subscriber.unsubscribe(this._fullTopic(topic));
    }
    
    this.subscriptions.clear();
    
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }

  /**
   * Subscribe to a topic
   * @param {string} topic - Topic name (supports wildcards: *, >)
   * @param {Function} callback - Function to call when message received
   */
  async subscribe(topic, callback) {
    // SKEP-05 FIX: Add connected guard to prevent crash on null this.subscriber
    if (!this.connected) {
      throw new Error('EventMesh not connected. Call connect() before subscribe()');
    }
    
    const fullTopic = this._fullTopic(topic);
    
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      await this.subscriber.subscribe(fullTopic);
    }
    
    this.subscriptions.get(topic).add(callback);
  }

  /**
   * Unsubscribe from a topic
   * @param {string} topic - Topic name
   * @param {Function} callback - Specific callback to remove (optional)
   */
  async unsubscribe(topic, callback) {
    const fullTopic = this._fullTopic(topic);
    
    if (this.subscriptions.has(topic)) {
      const callbacks = this.subscriptions.get(topic);
      
      if (callback) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(topic);
          await this.subscriber.unsubscribe(fullTopic);
        }
      } else {
        this.subscriptions.delete(topic);
        await this.subscriber.unsubscribe(fullTopic);
      }
    }
  }

  /**
   * Publish an event to a topic
   * @param {string} topic - Topic name
   * @param {Object} event - Event data
   * @returns {Promise<boolean>} - Success status
   */
  async publish(topic, event) {
    if (!this.connected) {
      throw new Error('EventMesh not connected');
    }

    const fullTopic = this._fullTopic(topic);
    const message = JSON.stringify({
      topic,
      event,
      timestamp: Date.now(),
      source: this.options.agentId
    });

    try {
      await this.client.publish(fullTopic, message);
      return true;
    } catch (err) {
      console.error(`[EventMesh] Publish failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Request-Response pattern: send a request and wait for response
   * @param {string} topic - Topic to publish request to
   * @param {Object} requestData - Request data
   * @param {number} timeout - Timeout in ms (default: 5000)
   * @returns {Promise<Object|null>} - Response or null on timeout
   */
  async request(topic, requestData, timeout = 5000) {
    const requestId = `${this.options.agentId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const responseTopic = `response:${requestId}`;
    
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.unsubscribe(responseTopic);
          resolve(null);
        }
      }, timeout);

      this.subscribe(responseTopic, (response) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          this.unsubscribe(responseTopic);
          resolve(response.data);
        }
      });

      this.publish(topic, {
        ...requestData,
        _requestId: requestId,
        _replyTo: responseTopic
      }).catch(reject);
    });
  }

  /**
   * Respond to a request
   * @param {Object} request - Original request object
   * @param {Object} responseData - Response data
   */
  async respond(request, responseData) {
    if (request._replyTo) {
      await this.publish(request._replyTo, {
        _requestId: request._requestId,
        data: responseData
      });
    }
  }

  /**
   * Handle incoming messages
   * @private
   */
  _handleMessage(channel, message) {
    try {
      const parsed = JSON.parse(message);
      const topic = parsed.topic;
      
      // Find matching subscriptions (support wildcard matching)
      for (const [subscribedTopic, callbacks] of this.subscriptions) {
        if (this._matchesPattern(subscribedTopic, channel)) {
          for (const callback of callbacks) {
            try {
              callback(parsed);
            } catch (err) {
              console.error(`[EventMesh] Callback error for topic ${topic}: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[EventMesh] Message parse error: ${err.message}`);
    }
  }

  /**
   * Check if a channel matches a subscription pattern
   * @private
   */
  _matchesPattern(pattern, channel) {
    // Exact match
    if (pattern === channel) return true;
    
    // Single-level wildcard (*)
    if (pattern.includes('*')) {
      const patternParts = pattern.split('.');
      const channelParts = channel.split('.');
      
      if (patternParts.length !== channelParts.length) return false;
      
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i] !== '*' && patternParts[i] !== channelParts[i]) {
          return false;
        }
      }
      return true;
    }
    
    // Multi-level wildcard (>)
    if (pattern.endsWith('>')) {
      const prefix = pattern.slice(0, -1);
      return channel.startsWith(prefix);
    }
    
    return false;
  }

  /**
   * Get full topic name with prefix
   * @private
   */
  _fullTopic(topic) {
    return `${this.options.prefix}${topic}`;
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      connected: this.connected,
      subscriptionCount: this.subscriptions.size,
      totalCallbacks: Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0),
      agentId: this.options.agentId
    };
  }
}

module.exports = EventMesh;
