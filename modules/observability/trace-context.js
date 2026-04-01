/**
 * Heretek Trace Context - A2A Message Propagation Module
 * ==============================================================================
 * Trace context propagation across Agent-to-Agent (A2A) messages.
 * 
 * Features:
 *   - Distributed trace context extraction/injection
 *   - A2A message header propagation
 *   - WebSocket RPC trace correlation
 *   - Redis pub/sub trace context sharing
 *   - Triad deliberation context tracking
 *   - Session-aware trace propagation
 * 
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                   Trace Context Propagation                      │
 *   │                                                                  │
 *   │  Agent A                    Gateway                    Agent B   │
 *   │  ┌─────────┐              ┌──────────┐              ┌─────────┐ │
 *   │  │ Inject  │───Message───►│ Propagate│───Message───►│ Extract │ │
 *   │  │ Context │              │ Context  │              │ Context │ │
 *   │  └─────────┘              └──────────┘              └─────────┘ │
 *   │       │                        │                        │       │
 *   │       ▼                        ▼                        ▼       │
 *   │  ┌─────────┐              ┌──────────┐              ┌─────────┐ │
 *   │  │ Trace   │              │ Trace    │              │ Trace   │ │
 *   │  │ Span A  │              │ Span GW  │              │ Span B  │ │
 *   │  └─────────┘              └──────────┘              └─────────┘ │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   const { TraceContext } = require('./modules/observability/trace-context');
 *   
 *   // Create new context for outgoing message
 *   const context = TraceContext.create({
 *     sessionId: 'session-123',
 *     agentId: 'alpha',
 *     messageType: 'triad-vote'
 *   });
 *   
 *   // Inject into A2A message
 *   const message = { type: 'vote', content: {...} };
 *   TraceContext.inject(message, context);
 *   
 *   // Extract from incoming message
 *   const incomingMessage = { ...headers: {...} };
 *   const extractedContext = TraceContext.extract(incomingMessage);
 * ==============================================================================
 */

const crypto = require('crypto');

/**
 * Trace context header key for A2A messages
 */
const TRACE_CONTEXT_HEADER = 'x-heretek-trace-context';

/**
 * Trace context baggage header key for additional metadata
 */
const TRACE_BAGGAGE_HEADER = 'x-heretek-trace-baggage';

/**
 * Trace Context Data Structure
 * @typedef {Object} TraceContextData
 * @property {string} traceId - Unique trace identifier
 * @property {string} spanId - Current span identifier
 * @property {string} [parentSpanId] - Parent span identifier (for nested traces)
 * @property {string} sessionId - Session identifier
 * @property {string} agentId - Current agent identifier
 * @property {string} messageType - Type of A2A message
 * @property {number} timestamp - Creation timestamp
 * @property {Object} [baggage] - Additional context baggage
 * @property {Object} [triadContext] - Triad-specific context
 * @property {string} [triadContext.proposalId] - Proposal being deliberated
 * @property {string} [triadContext.voteType] - Vote type (approve/reject/abstain)
 * @property {number} [triadContext.deliberationRound] - Current deliberation round
 */

/**
 * Trace Context Class for A2A Message Propagation
 */
class TraceContext {
    /**
     * Create trace context instance
     * @param {TraceContextData} data - Context data
     */
    constructor(data = {}) {
        this.traceId = data.traceId || this._generateTraceId();
        this.spanId = data.spanId || this._generateSpanId();
        this.parentSpanId = data.parentSpanId || null;
        this.sessionId = data.sessionId || 'unknown-session';
        this.agentId = data.agentId || 'unknown-agent';
        this.messageType = data.messageType || 'unknown';
        this.timestamp = data.timestamp || Date.now();
        this.baggage = data.baggage || {};
        this.triadContext = data.triadContext || null;
        this.propagationHistory = data.propagationHistory || [];
    }

    /**
     * Generate unique trace ID
     * @private
     * @returns {string} Trace ID
     */
    _generateTraceId() {
        return `trace-${crypto.randomBytes(16).toString('hex')}`;
    }

    /**
     * Generate unique span ID
     * @private
     * @returns {string} Span ID
     */
    _generateSpanId() {
        return `span-${crypto.randomBytes(8).toString('hex')}`;
    }

    /**
     * Create new trace context
     * @param {Object} options - Context options
     * @param {string} [options.sessionId] - Session ID
     * @param {string} [options.agentId] - Agent ID
     * @param {string} [options.messageType] - Message type
     * @param {string} [options.traceId] - Existing trace ID (for child spans)
     * @param {string} [options.parentSpanId] - Parent span ID
     * @param {Object} [options.triadContext] - Triad context
     * @param {Object} [options.baggage] - Additional baggage
     * @returns {TraceContext} New trace context
     */
    static create(options = {}) {
        return new TraceContext({
            sessionId: options.sessionId,
            agentId: options.agentId,
            messageType: options.messageType,
            traceId: options.traceId,
            parentSpanId: options.parentSpanId,
            triadContext: options.triadContext,
            baggage: options.baggage
        });
    }

    /**
     * Create child context from parent (for message forwarding)
     * @param {TraceContext} parentContext - Parent context
     * @param {Object} options - Override options
     * @returns {TraceContext} Child context
     */
    static createChild(parentContext, options = {}) {
        return new TraceContext({
            traceId: parentContext.traceId,
            parentSpanId: parentContext.spanId,
            sessionId: parentContext.sessionId,
            agentId: options.agentId || parentContext.agentId,
            messageType: options.messageType || parentContext.messageType,
            triadContext: parentContext.triadContext,
            baggage: { ...parentContext.baggage, ...options.baggage },
            propagationHistory: [
                ...parentContext.propagationHistory,
                { agentId: parentContext.agentId, timestamp: Date.now() }
            ]
        });
    }

    /**
     * Extract trace context from A2A message
     * @param {Object} message - A2A message with headers
     * @returns {TraceContext|null} Extracted context or null
     */
    static extract(message) {
        if (!message || !message.headers) {
            return null;
        }

        const contextHeader = message.headers[TRACE_CONTEXT_HEADER];
        if (!contextHeader) {
            return null;
        }

        try {
            const decoded = JSON.parse(Buffer.from(contextHeader, 'base64').toString('utf-8'));
            return new TraceContext(decoded);
        } catch (error) {
            console.warn('[TraceContext] Failed to extract context:', error.message);
            return null;
        }
    }

    /**
     * Extract trace context from WebSocket message
     * @param {Object} wsMessage - WebSocket message
     * @returns {TraceContext|null} Extracted context or null
     */
    static extractFromWebSocket(wsMessage) {
        if (!wsMessage) {
            return null;
        }

        // Try different message formats
        if (wsMessage.headers) {
            return this.extract(wsMessage);
        }

        if (wsMessage.metadata?.headers) {
            return this.extract({ headers: wsMessage.metadata.headers });
        }

        if (wsMessage.context) {
            // Direct context in message
            try {
                return new TraceContext(wsMessage.context);
            } catch {
                return null;
            }
        }

        return null;
    }

    /**
     * Extract trace context from Redis message
     * @param {Object} redisMessage - Redis pub/sub message
     * @returns {TraceContext|null} Extracted context or null
     */
    static extractFromRedis(redisMessage) {
        if (!redisMessage) {
            return null;
        }

        try {
            const parsed = typeof redisMessage === 'string' ? JSON.parse(redisMessage) : redisMessage;
            
            if (parsed.headers) {
                return this.extract({ headers: parsed.headers });
            }

            if (parsed.context) {
                return new TraceContext(parsed.context);
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Inject trace context into A2A message
     * @param {Object} message - A2A message to inject into
     * @param {TraceContext} context - Context to inject
     * @returns {Object} Message with injected context
     */
    static inject(message, context) {
        if (!message) {
            message = {};
        }

        if (!context) {
            return message;
        }

        // Ensure headers exist
        if (!message.headers) {
            message.headers = {};
        }

        // Encode context as base64
        const contextData = {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            messageType: context.messageType,
            timestamp: context.timestamp,
            baggage: context.baggage,
            triadContext: context.triadContext,
            propagationHistory: context.propagationHistory
        };

        message.headers[TRACE_CONTEXT_HEADER] = Buffer.from(JSON.stringify(contextData)).toString('base64');

        // Add baggage header for quick access
        if (Object.keys(context.baggage).length > 0) {
            message.headers[TRACE_BAGGAGE_HEADER] = Buffer.from(JSON.stringify(context.baggage)).toString('base64');
        }

        // Also include context at message root for easier access
        message.context = contextData;

        return message;
    }

    /**
     * Inject trace context into WebSocket message
     * @param {Object} wsMessage - WebSocket message
     * @param {TraceContext} context - Context to inject
     * @returns {Object} Message with injected context
     */
    static injectWebSocket(wsMessage, context) {
        if (!wsMessage) {
            wsMessage = {};
        }

        // Add to metadata if it exists
        if (wsMessage.metadata) {
            wsMessage.metadata.context = {
                traceId: context.traceId,
                spanId: context.spanId,
                parentSpanId: context.parentSpanId,
                sessionId: context.sessionId,
                agentId: context.agentId,
                messageType: context.messageType,
                timestamp: context.timestamp,
                triadContext: context.triadContext
            };
        }

        // Always add direct context
        wsMessage.context = {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            messageType: context.messageType,
            timestamp: context.timestamp,
            triadContext: context.triadContext,
            baggage: context.baggage
        };

        return wsMessage;
    }

    /**
     * Inject trace context into Redis message
     * @param {Object} redisMessage - Redis message
     * @param {TraceContext} context - Context to inject
     * @returns {Object} Message with injected context
     */
    static injectRedis(redisMessage, context) {
        if (!redisMessage) {
            redisMessage = {};
        }

        // Ensure message has context
        redisMessage.context = {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            sessionId: context.sessionId,
            agentId: context.agentId,
            messageType: context.messageType,
            timestamp: context.timestamp,
            triadContext: context.triadContext,
            baggage: context.baggage,
            propagationHistory: context.propagationHistory
        };

        // Also add to headers for consistency
        if (!redisMessage.headers) {
            redisMessage.headers = {};
        }
        redisMessage.headers[TRACE_CONTEXT_HEADER] = Buffer.from(JSON.stringify(redisMessage.context)).toString('base64');

        return redisMessage;
    }

    /**
     * Create context for triad deliberation message
     * @param {Object} options - Triad options
     * @param {string} options.sessionId - Session ID
     * @param {string} options.proposalId - Proposal ID
     * @param {string} options.agentId - Sending agent ID
     * @param {string} options.voteType - Vote type
     * @param {number} [options.deliberationRound] - Deliberation round
     * @param {string} [options.traceId] - Existing trace ID
     * @returns {TraceContext} Triad context
     */
    static createTriadContext(options) {
        const { sessionId, proposalId, agentId, voteType, deliberationRound = 1, traceId } = options;

        return new TraceContext({
            traceId: traceId || `triad-${sessionId}-${proposalId}`,
            sessionId,
            agentId,
            messageType: 'triad-vote',
            triadContext: {
                proposalId,
                voteType,
                deliberationRound,
                triadPhase: 'voting'
            },
            baggage: {
                triadMember: agentId,
                proposalId,
                governanceType: 'consensus'
            }
        });
    }

    /**
     * Create context for agent decision cycle
     * @param {Object} options - Decision cycle options
     * @param {string} options.sessionId - Session ID
     * @param {string} options.agentId - Agent ID
     * @param {string} options.decisionType - Decision type
     * @param {string} [options.traceId] - Existing trace ID
     * @returns {TraceContext} Decision cycle context
     */
    static createDecisionContext(options) {
        const { sessionId, agentId, decisionType, traceId } = options;

        return new TraceContext({
            traceId: traceId || `decision-${agentId}-${sessionId}`,
            sessionId,
            agentId,
            messageType: 'agent-decision',
            baggage: {
                decisionType,
                agentRole: 'decision-maker'
            }
        });
    }

    /**
     * Create context for A2A message routing
     * @param {Object} options - Routing options
     * @param {string} options.sessionId - Session ID
     * @param {string} options.fromAgent - Source agent ID
     * @param {string} options.toAgent - Target agent ID
     * @param {string} options.messageType - Message type
     * @param {string} [options.traceId] - Existing trace ID
     * @param {string} [options.parentSpanId] - Parent span ID
     * @returns {TraceContext} Routing context
     */
    static createRoutingContext(options) {
        const { sessionId, fromAgent, toAgent, messageType, traceId, parentSpanId } = options;

        return new TraceContext({
            traceId: traceId || `a2a-${sessionId}-${Date.now()}`,
            parentSpanId,
            sessionId,
            agentId: fromAgent,
            messageType,
            baggage: {
                fromAgent,
                toAgent,
                routingType: 'a2a'
            }
        });
    }

    /**
     * Update context with new span (for multi-step operations)
     * @returns {TraceContext} New context with updated span
     */
    nextSpan() {
        return new TraceContext({
            traceId: this.traceId,
            parentSpanId: this.spanId,
            sessionId: this.sessionId,
            agentId: this.agentId,
            messageType: this.messageType,
            triadContext: this.triadContext,
            baggage: this.baggage,
            propagationHistory: [
                ...this.propagationHistory,
                { agentId: this.agentId, spanId: this.spanId, timestamp: Date.now() }
            ]
        });
    }

    /**
     * Add baggage item to context
     * @param {string} key - Baggage key
     * @param {any} value - Baggage value
     * @returns {TraceContext} New context with updated baggage
     */
    withBaggage(key, value) {
        return new TraceContext({
            ...this,
            baggage: {
                ...this.baggage,
                [key]: value
            }
        });
    }

    /**
     * Update triad context
     * @param {Object} triadContext - New triad context values
     * @returns {TraceContext} New context with updated triad context
     */
    withTriadContext(triadContext) {
        return new TraceContext({
            ...this,
            triadContext: {
                ...this.triadContext,
                ...triadContext
            }
        });
    }

    /**
     * Get propagation path (list of agents this context passed through)
     * @returns {Array<Object>} Propagation history
     */
    getPropagationPath() {
        return this.propagationHistory;
    }

    /**
     * Get total hop count
     * @returns {number} Number of hops
     */
    getHopCount() {
        return this.propagationHistory.length;
    }

    /**
     * Serialize context for logging
     * @returns {Object} Serializable context
     */
    toJSON() {
        return {
            traceId: this.traceId,
            spanId: this.spanId,
            parentSpanId: this.parentSpanId,
            sessionId: this.sessionId,
            agentId: this.agentId,
            messageType: this.messageType,
            timestamp: this.timestamp,
            baggage: this.baggage,
            triadContext: this.triadContext,
            hopCount: this.getHopCount()
        };
    }

    /**
     * Get context summary for debugging
     * @returns {string} Context summary
     */
    toString() {
        return `TraceContext(trace=${this.traceId}, span=${this.spanId}, agent=${this.agentId}, type=${this.messageType})`;
    }
}

/**
 * Trace Context Manager for maintaining active contexts
 */
class TraceContextManager {
    constructor() {
        this.activeContexts = new Map();
        this.contextHistory = new Map();
    }

    /**
     * Register active context
     * @param {string} key - Context key
     * @param {TraceContext} context - Context to register
     */
    register(key, context) {
        this.activeContexts.set(key, context);
        
        // Also add to history
        if (!this.contextHistory.has(key)) {
            this.contextHistory.set(key, []);
        }
        this.contextHistory.get(key).push({
            context: context.toJSON(),
            timestamp: Date.now()
        });
    }

    /**
     * Get active context
     * @param {string} key - Context key
     * @returns {TraceContext|null} Active context or null
     */
    get(key) {
        return this.activeContexts.get(key) || null;
    }

    /**
     * Remove active context
     * @param {string} key - Context key
     * @returns {TraceContext|null} Removed context or null
     */
    remove(key) {
        const context = this.activeContexts.get(key);
        this.activeContexts.delete(key);
        return context;
    }

    /**
     * Get context history
     * @param {string} key - Context key
     * @returns {Array<Object>} Context history
     */
    getHistory(key) {
        return this.contextHistory.get(key) || [];
    }

    /**
     * Clear all contexts
     */
    clear() {
        this.activeContexts.clear();
    }

    /**
     * Get manager status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            activeContexts: this.activeContexts.size,
            historyEntries: this.contextHistory.size
        };
    }
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    TraceContext,
    TraceContextManager,
    TRACE_CONTEXT_HEADER,
    TRACE_BAGGAGE_HEADER,

    /**
     * Create singleton context manager
     */
    createManager: () => {
        if (!global.heretekTraceContextManager) {
            global.heretekTraceContextManager = new TraceContextManager();
        }
        return global.heretekTraceContextManager;
    }
};
