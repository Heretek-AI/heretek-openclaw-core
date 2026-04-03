/**
 * Heretek OpenClaw — ACP Adapter
 * ==============================================================================
 * Adapter for connecting to the npm OpenClaw gateway using the ACP (Agent Client
 * Protocol) SDK. Replaces the archived JS gateway's simple JSON protocol.
 *
 * Architecture:
 *   Heretek Module --> ACP Adapter --> npm OpenClaw Gateway (port 18789)
 *                                           |
 *                                           v
 *                                    @agentclientprotocol/sdk
 *                                    (bundled in npm openclaw)
 *
 * Auth:
 *   The npm gateway uses HMAC nonce-challenge auth on WebSocket connect.
 *   Token: from openclaw.json → gateway.auth.token
 *
 * WebSocket:
 *   URL: ws://localhost:18789/a2a
 *   Protocol: ACP over WebSocket (JSON-RPC 2.0)
 *
 * Usage:
 *   const adapter = await ACPAdapter.connect({ agentId: 'alpha', token: '...' });
 *   adapter.send({ type: 'message', to: 'beta', content: 'Hello' });
 *   adapter.on('message', (msg) => console.log(msg));
 *   await adapter.close();
 * ==============================================================================
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const EventEmitter = require('events');

// ACP SDK path (bundled in npm openclaw)
const ACP_SDK_PATH = '/usr/lib/node_modules/openclaw/node_modules/@agentclientprotocol/sdk/dist';
let ACP = null;

// Load ACP SDK dynamically (avoids hard dependency for non-WS usage)
function loadACP() {
  if (ACP === null) {
    try {
      ACP = require(ACP_SDK_PATH);
    } catch (err) {
      console.warn('[ACP Adapter] ACP SDK not available at', ACP_SDK_PATH, err.message);
      ACP = null;
    }
  }
  return ACP;
}

// ==============================================================================
// ACP Adapter Class
// ==============================================================================

class ACPAdapter extends EventEmitter {
  /**
   * Connect to the npm OpenClaw gateway
   * @param {Object} options - Connection options
   * @param {string} options.agentId - Agent ID to register as
   * @param {string} options.token - Gateway auth token (from openclaw.json)
   * @param {string} [options.gatewayUrl='ws://localhost:18789/a2a'] - Gateway WebSocket URL
   * @param {number} [options.timeout=10000] - Connection timeout ms
   * @returns {Promise<ACPAdapter>} Connected adapter instance
   */
  static async connect(options = {}) {
    const adapter = new ACPAdapter(options);
    await adapter._connect();
    return adapter;
  }

  constructor(options = {}) {
    super();
    this.options = {
      gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'ws://localhost:18789/a2a',
      token: options.token || process.env.OPENCLAW_GATEWAY_TOKEN || '',
      agentId: options.agentId || 'unknown',
      timeout: options.timeout || 10000,
      ...options
    };

    this.ws = null;
    this.connected = false;
    this.authenticated = false;
    this.clientId = null;
    this.pendingRequests = new Map(); // correlationId -> { resolve, reject, timeout }
    this.messageCounter = 0;
  }

  /**
   * Internal connect flow
   * @private
   */
  async _connect() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`ACP connect timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      try {
        this.ws = new WebSocket(this.options.gatewayUrl, {
          headers: this.options.token
            ? { 'Authorization': `Bearer ${this.options.token}` }
            : {}
        });

        this.ws.on('open', () => {
          clearTimeout(timer);
          console.log(`[ACP Adapter] Connected to ${this.options.gatewayUrl}`);
        });

        this.ws.on('message', (data) => {
          this._handleMessage(data.toString());
        });

        this.ws.on('error', (err) => {
          clearTimeout(timer);
          console.error('[ACP Adapter] WS error:', err.message);
          reject(err);
        });

        this.ws.on('close', (code, reason) => {
          this.connected = false;
          this.authenticated = false;
          console.log(`[ACP Adapter] Disconnected: code=${code} reason=${reason}`);
          this._rejectAllPending(`Connection closed: ${code}`);
          this.emit('close', { code, reason });
        });

        // Resolve once authenticated
        this.once('authenticated', () => {
          clearTimeout(timer);
          this.connected = true;
          this.authenticated = true;
          resolve(this);
        });

        this.once('auth_failed', (err) => {
          clearTimeout(timer);
          reject(new Error(`ACP auth failed: ${err}`));
        });

      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   * @private
   */
  _handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('[ACP Adapter] Failed to parse message:', raw.slice(0, 100));
      return;
    }

    // ACP uses connect.challenge for auth on the npm gateway
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      this._handleChallenge(msg.payload);
      return;
    }

    // Auth success
    if (msg.type === 'auth.success' || msg.auth === true) {
      this.clientId = msg.clientId || this.options.agentId;
      this.emit('authenticated', msg);
      return;
    }

    // Auth failure
    if (msg.type === 'auth.failed' || msg.type === 'auth_failed' || msg.error?.code === 401) {
      this.emit('auth_failed', msg.error || msg);
      return;
    }

    // Response to our request
    if (msg.correlationId || msg.id) {
      const cid = msg.correlationId || msg.id;
      if (this.pendingRequests.has(cid)) {
        const pending = this.pendingRequests.get(cid);
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(cid);
        if (msg.error) {
          pending.reject(new Error(msg.error.message || msg.error));
        } else {
          pending.resolve(msg);
        }
        return;
      }
    }

    // Inbound message from another agent
    if (msg.type === 'message' || msg.type === 'a2a.message') {
      this.emit('message', msg);
      return;
    }

    // Broadcast
    if (msg.type === 'broadcast') {
      this.emit('broadcast', msg);
      return;
    }

    // Agent event
    if (msg.type === 'agent.registered' || msg.type === 'agent.unregistered') {
      this.emit('agent.event', msg);
      return;
    }

    // Default: forward as raw event
    this.emit('raw', msg);
  }

  /**
   * Handle nonce challenge from gateway
   * @private
   */
  async _handleChallenge(payload) {
    const { nonce, ts } = payload;

    if (!nonce) {
      // Gateway doesn't require auth — skip HMAC
      this._sendRaw({ type: 'auth.skip' });
      return;
    }

    // Sign nonce with HMAC-SHA256 using gateway token
    const token = this.options.token;
    if (!token) {
      this.emit('auth_failed', 'No token available for HMAC signing');
      return;
    }

    const hmac = crypto.createHmac('sha256', token);
    hmac.update(nonce);
    const signature = hmac.digest('base64');

    this._sendRaw({
      type: 'auth.response',
      nonce,
      signature,
      agentId: this.options.agentId,
      ts
    });
  }

  /**
   * Send raw JSON to WebSocket
   * @private
   */
  _sendRaw(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(obj));
  }

  /**
   * Send a message and wait for response
   * @param {Object} message - Message to send
   * @param {number} [timeout=30000] - Response timeout ms
   * @returns {Promise<Object>} Response
   */
  async send(message, timeout = 30000) {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    const correlationId = `acp_${Date.now()}_${++this.messageCounter}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`ACP request timeout: ${correlationId}`));
      }, timeout);

      this.pendingRequests.set(correlationId, { resolve, reject, timeout: timer });

      this._sendRaw({
        ...message,
        correlationId,
        from: this.options.agentId,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Send a message to a specific agent
   * @param {string} to - Target agent ID
   * @param {Object|string} content - Message content
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendMessage(to, content, options = {}) {
    return this.send({
      type: 'message',
      to,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      ...options
    });
  }

  /**
   * Broadcast to all connected agents
   * @param {Object|string} content - Broadcast content
   * @returns {Promise<Object>} Broadcast result
   */
  async broadcast(content) {
    return this.send({
      type: 'broadcast',
      content: typeof content === 'string' ? content : JSON.stringify(content)
    });
  }

  /**
   * Ping an agent
   * @param {string} [agentId] - Target agent (if omitted, ping gateway)
   * @returns {Promise<Object>} Ping result
   */
  async ping(agentId) {
    return this.send({
      type: 'ping',
      to: agentId || undefined,
      timestamp: Date.now()
    });
  }

  /**
   * Request gateway status
   * @returns {Promise<Object>} Gateway status
   */
  async getStatus() {
    return this.send({ type: 'status' });
  }

  /**
   * Discover connected agents
   * @returns {Promise<Object>} Agent list
   */
  async discover() {
    return this.send({ type: 'discover' });
  }

  /**
   * Register this agent with the gateway
   * @param {Object} [metadata] - Agent metadata
   * @returns {Promise<Object>} Registration result
   */
  async register(metadata = {}) {
    return this.send({
      type: 'register',
      agentId: this.options.agentId,
      metadata: {
        role: metadata.role || 'unknown',
        ...metadata
      }
    });
  }

  /**
   * Close the connection
   * @returns {Promise<void>}
   */
  async close() {
    this._rejectAllPending('Connection closed');
    if (this.ws) {
      this.ws.close(1000, 'Normal close');
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Reject all pending requests
   * @private
   */
  _rejectAllPending(reason) {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  // ======================================================================
  // Static helpers (for modules that only need Redis, not WS)
  // ======================================================================

  /**
   * Get Redis client (from a2a-message-send pattern)
   * Returns a connected ioredis client.
   * @param {string} [url] - Redis URL
   * @returns {Promise<Redis>} ioredis client
   */
  static async getRedisClient(url) {
    const Redis = require('ioredis');
    const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    await client.ping();
    return client;
  }
}

// ==============================================================================
// LiteLLM A2A Gateway Adapter (REST-based)
//
// Some Heretek skills target the LiteLLM proxy A2A gateway via REST.
// This adapter provides a typed interface for that.
// ==============================================================================

class LiteLLMGatewayAdapter {
  /**
   * Create LiteLLM gateway adapter
   * @param {Object} options
   * @param {string} [options.host='localhost'] - LiteLLM host
   * @param {string} [options.port='4000'] - LiteLLM port
   * @param {string} [options.masterKey] - LiteLLM master key
   */
  constructor(options = {}) {
    this.host = options.host || process.env.LITELLM_HOST || 'localhost';
    this.port = options.port || process.env.LITELLM_PORT || '4000';
    this.masterKey = options.masterKey || process.env.LITELLM_MASTER_KEY || '';
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  /**
   * Make authenticated request to LiteLLM proxy
   * @private
   */
  async _request(method, path, body) {
    const fetch = require('http').request || require('fetch-cookie')(require('node-fetch'));
    const url = `${this.baseUrl}${path}`;

    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const opts = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname,
          method,
          headers: {
            'Authorization': `Bearer ${this.masterKey}`,
            'Content-Type': 'application/json'
          }
        };

        const req = require('http').request(opts, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 400) {
              reject(new Error(`LiteLLM ${res.statusCode}: ${data}`));
            } else {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(data);
              }
            }
          });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Register an agent with LiteLLM proxy
   * @param {Object} agentInfo
   * @returns {Promise<Object>}
   */
  async registerAgent(agentInfo) {
    return this._request('POST', '/key/generate', {
      key_alias: `a2a-${agentInfo.agentId}`,
      duration: '30d',
      agent: agentInfo.agentId,
      agent_permissions: ['a2a:send', 'a2a:receive'],
      ...agentInfo.metadata
    });
  }

  /**
   * List agents
   * @returns {Promise<Array>}
   */
  async listAgents() {
    return this._request('GET', '/agents');
  }

  /**
   * Get agent info
   * @param {string} agentId
   * @returns {Promise<Object>}
   */
  async getAgent(agentId) {
    return this._request('GET', `/agents/${agentId}`);
  }
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
  ACPAdapter,
  LiteLLMGatewayAdapter
};
