/**
 * EventMesh-ACP Bridge — npm OpenClaw Gateway Integration
 * ==============================================================================
 * Bridges the legacy EventMesh Redis pub/sub layer to the npm OpenClaw gateway
 * via the ACP (Agent Client Protocol) adapter.
 *
 * Architecture:
 *   Heretek Module (event-mesh.js) --> event-mesh-acp.js --> ACP Adapter
 *           |                                        |            |
 *           v                                        v            v
 *      Redis Pub/Sub                          Redis Pub/Sub   npm Gateway
 *      (heretek:event:)                       (heretek:event:)  (openclaw:a2a:)
 *
 * Two-way bridging:
 *   - EventMesh.publish() → also broadcasts via ACP to npm gateway agents
 *   - ACP broadcast/message → also published via EventMesh to local subscribers
 *
 * Prefixes:
 *   - EventMesh:     heretek:event:{topic}    (unchanged, local Redis subscribers)
 *   - npm Gateway:   openclaw:a2a:{channel}  (npm gateway broadcast channel)
 *
 * The namespaces are independent — connecting ACP does NOT make EventMesh
 * subscribers receive npm gateway messages by default; explicit bridging
 * must be enabled via options.acpBridgeTopics.
 *
 * Usage:
 *   const EventMeshACP = require('./event-mesh-acp');
 *
 *   const mesh = new EventMeshACP({ agentId: 'alpha' });
 *   await mesh.connect();
 *   await mesh.connectACP({ token: '...' });  // optional npm gateway bridge
 *
 *   mesh.subscribe('tasks.urgent', (msg) => console.log(msg));
 *   mesh.publish('tasks.urgent', { task: 'Deploy' });
 *
 *   await mesh.close();
 * ==============================================================================
 */

const EventMesh = require('./event-mesh');
const { ACPAdapter } = require('../adapters/acp-adapter');

// ACP broadcast channel topic used by the npm gateway
const ACP_BROADCAST_TOPIC = 'openclaw:a2a:broadcast';

/**
 * Topic map: EventMesh topic → ACP broadcast channel
 * ACP messages are forwarded with metadata identifying the EventMesh source.
 */
class EventMeshACP extends EventMesh {
  /**
   * Create EventMesh-ACP bridge
   * @param {Object} options - EventMesh options + ACP bridge options
   * @param {string} [options.agentId] - Agent identifier
   * @param {string} [options.prefix] - Redis prefix (default: 'heretek:event:')
   * @param {string[]} [options.acpBridgeTopics] - Topics to bridge to ACP (default: all '*')
   * @param {boolean} [options.acpAutoBridge=true] - Auto-bridge all publish() to ACP
   * @param {boolean} [options.acpSubscribeLocal=true] - Forward ACP broadcasts locally
   * @param {string} [options.acpGatewayUrl] - ACP gateway WebSocket URL
   * @param {string} [options.acpToken] - ACP gateway auth token
   * @param {number} [options.acpTimeout=10000] - ACP connect timeout ms
   */
  constructor(options = {}) {
    super(options);

    // ACP bridge state
    this.acpAdapter = null;
    this.acpConnected = false;

    // Topic bridging configuration
    this.acpBridgeTopics = options.acpBridgeTopics || ['*'];   // topics to forward to ACP
    this.acpAutoBridge  = options.acpAutoBridge  !== false;   // auto-bridge publish()
    this.acpSubscribeLocal = options.acpSubscribeLocal !== false; // route ACP → local subscribers

    // ACP-specific options (passed to ACPAdapter.connect)
    this.acpOptions = {
      gatewayUrl: options.acpGatewayUrl || process.env.OPENCLAW_GATEWAY_URL || 'ws://localhost:18789/a2a',
      token:      options.acpToken      || process.env.OPENCLAW_GATEWAY_TOKEN || '',
      agentId:    options.agentId        || 'eventmesh-acp',
      timeout:    options.acpTimeout     || 10000,
      ...options.acpOptions
    };
  }

  // ---------------------------------------------------------------------------
  // ACP Connection
  // ---------------------------------------------------------------------------

  /**
   * Connect to the npm OpenClaw gateway via ACP.
   * Safe to call even if EventMesh is not yet connected — ACP uses a separate
   * Redis connection and independent WebSocket channel.
   *
   * @param {Object} [overrides] - Override ACP options (merged with constructor)
   * @returns {Promise<ACPAdapter>} Connected ACP adapter
   */
  async connectACP(overrides = {}) {
    if (this.acpConnected) {
      console.warn('[EventMesh-ACP] Already connected to ACP gateway');
      return this.acpAdapter;
    }

    const opts = { ...this.acpOptions, ...overrides };

    console.log(`[EventMesh-ACP] Connecting to ACP gateway at ${opts.gatewayUrl} as ${opts.agentId}...`);

    try {
      this.acpAdapter = await ACPAdapter.connect(opts);

      // Forward ACP broadcasts → EventMesh local subscribers
      if (this.acpSubscribeLocal) {
        this.acpAdapter.on('broadcast', (msg) => {
          this._handleACPBroadcast(msg);
        });

        // Also handle direct agent messages forwarded as events
        this.acpAdapter.on('message', (msg) => {
          this._handleACPMessage(msg);
        });
      }

      this.acpConnected = true;
      console.log('[EventMesh-ACP] ACP gateway connected successfully');

      return this.acpAdapter;
    } catch (err) {
      console.error(`[EventMesh-ACP] ACP connection failed: ${err.message}`);
      // ACP failure is non-fatal — EventMesh continues on Redis only
      return null;
    }
  }

  /**
   * Disconnect from the npm OpenClaw ACP gateway.
   * Does NOT disconnect EventMesh from Redis — call super.disconnect() for that.
   * @returns {Promise<void>}
   */
  async disconnectACP() {
    if (!this.acpConnected || !this.acpAdapter) return;

    try {
      await this.acpAdapter.close();
    } catch (err) {
      console.error(`[EventMesh-ACP] Error closing ACP connection: ${err.message}`);
    }

    this.acpAdapter = null;
    this.acpConnected = false;
    console.log('[EventMesh-ACP] ACP gateway disconnected');
  }

  // ---------------------------------------------------------------------------
  // Publish (bridged)
  // ---------------------------------------------------------------------------

  /**
   * Publish an event to the EventMesh Redis topic AND optionally forward to ACP.
   * ACP forwarding is skipped if ACP is not connected.
   *
   * @param {string} topic - Topic name
   * @param {Object} event - Event data
   * @returns {Promise<boolean>} - True if EventMesh publish succeeded
   */
  async publish(topic, event) {
    // Always publish to EventMesh (Redis)
    const result = await super.publish(topic, event);

    // Optionally bridge to ACP gateway
    if (this.acpConnected && this.acpAutoBridge && this._shouldBridgeTopic(topic)) {
      await this._bridgePublish(topic, event);
    }

    return result;
  }

  /**
   * Determine if a topic should be bridged to ACP.
   * Supports '*' wildcard (matches all) and explicit topic lists.
   * @private
   */
  _shouldBridgeTopic(topic) {
    for (const pattern of this.acpBridgeTopics) {
      if (pattern === '*' || pattern === topic) return true;
      // Wildcard prefix match (e.g., 'tasks.*')
      if (pattern.endsWith('.*') && topic.startsWith(pattern.slice(0, -1))) return true;
    }
    return false;
  }

  /**
   * Forward an EventMesh publish to the ACP gateway as a broadcast.
   * @private
   */
  async _bridgePublish(topic, event) {
    if (!this.acpAdapter) return;

    try {
      const envelope = {
        type: 'eventmesh.bridge',
        source: 'eventmesh',
        agentId: this.options.agentId,
        topic,
        event,
        timestamp: Date.now()
      };

      // Forward to ACP gateway via broadcast (or send as typed event message)
      await this.acpAdapter.broadcast({
        type: 'eventmesh.bridge',
        source: 'eventmesh',
        agentId: this.options.agentId,
        topic,
        event,
        timestamp: new Date().toISOString()
      });

      console.log(`[EventMesh-ACP] Bridged event → ACP: topic=${topic}`);
    } catch (err) {
      // ACP bridge failure is non-fatal — event was already published locally
      console.warn(`[EventMesh-ACP] ACP bridge failed for topic ${topic}: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // ACP → EventMesh routing
  // ---------------------------------------------------------------------------

  /**
   * Handle incoming ACP broadcast and forward to EventMesh subscribers.
   * Filters out messages that originated from this agent (no echo).
   * @private
   */
  _handleACPBroadcast(msg) {
    // Skip our own echoes
    if (msg.agentId === this.options.agentId || msg.source === 'eventmesh') {
      return;
    }

    // Check if this is an eventmesh-bridged message
    if (msg.type === 'eventmesh.bridge') {
      const { topic, event } = msg;
      if (!topic || !event) return;

      // Re-publish to EventMesh so local subscribers get it
      const fullTopic = this._fullTopic(topic);
      const payload = JSON.stringify({
        topic,
        event,
        timestamp: Date.now(),
        source: msg.agentId || 'acp-bridge',
        via: 'acp'
      });

      // Publish directly to the Redis subscriber channel using the pub client
      if (this.client && this.connected) {
        this.client.publish(fullTopic, payload).catch((err) => {
          console.warn(`[EventMesh-ACP] Failed to re-publish ACP message: ${err.message}`);
        });
      }

      console.log(`[EventMesh-ACP] Bridged ACP → EventMesh: topic=${topic} from=${msg.agentId}`);
    }
  }

  /**
   * Handle incoming ACP direct messages (agent-to-agent).
   * Forward to EventMesh subscribers if the message has a topic field.
   * @private
   */
  _handleACPMessage(msg) {
    if (msg.agentId === this.options.agentId) return;

    // If the ACP message carries a topic, forward it to EventMesh
    if (msg.topic) {
      const payload = {
        topic: msg.topic,
        event: msg.content || msg.event || msg,
        timestamp: Date.now(),
        source: msg.agentId || msg.from || 'acp-peer',
        via: 'acp-direct'
      };

      if (this.client && this.connected) {
        const fullTopic = this._fullTopic(msg.topic);
        this.client.publish(fullTopic, JSON.stringify(payload)).catch(err => {
          console.error('[EventMesh ACP] Publish failed:', err.message);
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Request/Response (ACP-enhanced)
  // ---------------------------------------------------------------------------

  /**
   * Request with optional ACP fallback: try EventMesh first, then ACP gateway.
   * Useful when target agent may be on either protocol.
   *
   * @param {string} topic - Topic to publish request to
   * @param {Object} requestData - Request payload
   * @param {Object} [options]
   * @param {number} [options.timeout=5000] - EventMesh timeout ms
   * @param {boolean} [options.acpFallback=true] - Fall back to ACP if no local reply
   * @returns {Promise<Object|null>}
   */
  async request(topic, requestData, options = {}) {
    const { acpFallback = true, ...rest } = options;

    // Try EventMesh first
    const result = await super.request(topic, requestData, rest.timeout || 5000);

    // If EventMesh had no response, try ACP discovery
    if (result === null && acpFallback && this.acpConnected) {
      return this._acpRequest(topic, requestData, rest.timeout || 5000);
    }

    return result;
  }

  /**
   * ACP-level request for when EventMesh has no subscriber.
   * Uses ACP discover + send to reach npm gateway agents.
   * @private
   */
  async _acpRequest(topic, requestData, timeout = 5000) {
    try {
      // Discover agents on the npm gateway
      const discovery = await this.acpAdapter.discover();
      const agents = discovery.agents || [];

      if (agents.length === 0) return null;

      // Send to first available agent as a request
      const target = agents[0];
      const response = await this.acpAdapter.sendMessage(target.agentId || target.id, {
        type: 'eventmesh.request',
        topic,
        requestData,
        via: 'acp-fallback'
      }, timeout);

      return response;
    } catch (err) {
      console.warn(`[EventMesh-ACP] ACP request fallback failed: ${err.message}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Override disconnect to clean up ACP first
  // ---------------------------------------------------------------------------

  /**
   * Full shutdown: disconnect ACP first, then EventMesh Redis.
   * @returns {Promise<void>}
   */
  async disconnect() {
    await this.disconnectACP();
    await super.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Status / diagnostics
  // ---------------------------------------------------------------------------

  /**
   * Get combined status of EventMesh and ACP bridge.
   * @returns {Object}
   */
  getStatus() {
    return {
      ...this.getStats(),
      acp: {
        connected: this.acpConnected,
        gatewayUrl: this.acpOptions.gatewayUrl,
        agentId: this.acpOptions.agentId,
        bridgeTopics: this.acpBridgeTopics,
        autoBridge: this.acpAutoBridge,
        subscribeLocal: this.acpSubscribeLocal
      }
    };
  }

  /**
   * Check if ACP bridge is active.
   * @returns {boolean}
   */
  isACPConnected() {
    return this.acpConnected;
  }
}

module.exports = EventMeshACP;
