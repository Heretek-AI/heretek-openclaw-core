/**
 * Heretek Gateway Instrumentation - WebSocket RPC and A2A Tracing
 * ==============================================================================
 * Instrumentation for the OpenClaw Gateway to add Langfuse tracing to:
 *   - WebSocket RPC calls
 *   - Agent registration/heartbeat events
 *   - A2A message routing
 *   - Broadcast operations
 *   - Health checks
 * 
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │              Gateway Instrumentation Layer                       │
 *   │                                                                  │
 *   │  WebSocket RPC               A2A Routing                        │
 *   │  ┌──────────────┐           ┌──────────────┐                   │
 *   │  │   Request    │──────────►│   Route      │                   │
 *   │  │   Trace      │           │   Trace      │                   │
 *   │  └──────────────┘           └──────────────┘                   │
 *   │         │                         │                             │
 *   │         ▼                         ▼                             │
 *   │  ┌──────────────┐           ┌──────────────┐                   │
 *   │  │   Response   │           │   Delivery   │                   │
 *   │  │   Trace      │           │   Trace      │                   │
 *   │  └──────────────┘           └──────────────┘                   │
 *   └─────────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    Langfuse Platform                             │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   const { instrumentGateway } = require('./modules/observability/gateway-instrumentation');
 *   
 *   const gateway = new OpenClawGateway();
 *   
 *   // Instrument gateway with observability
 *   const instrumentedGateway = instrumentGateway(gateway, {
 *     langfuseClient: langfuseClient,
 *     metricsExporter: metricsExporter,
 *     dashboardSync: dashboardSync,
 *     traceContextManager: traceContextManager
 *   });
 *   
 *   await instrumentedGateway.start();
 * ==============================================================================
 */

const { TraceContext } = require('./trace-context');

/**
 * Gateway Instrumentation Configuration
 * @typedef {Object} GatewayInstrumentationConfig
 * @property {Object} langfuseClient - Langfuse client instance
 * @property {Object} [metricsExporter] - Metrics exporter instance
 * @property {Object} [dashboardSync] - Dashboard sync instance
 * @property {Object} [traceContextManager] - Trace context manager
 * @property {boolean} [traceRpcCalls=true] - Enable RPC call tracing
 * @property {boolean} [traceA2AMessages=true] - Enable A2A message tracing
 * @property {boolean} [traceAgentLifecycle=true] - Enable agent lifecycle tracing
 * @property {boolean} [traceBroadcasts=true] - Enable broadcast tracing
 * @property {boolean} [debug=false] - Debug logging
 */

/**
 * Instrument gateway with observability
 * @param {Object} gateway - OpenClawGateway instance
 * @param {GatewayInstrumentationConfig} config - Configuration
 * @returns {Object} Instrumented gateway
 */
function instrumentGateway(gateway, config) {
    const {
        langfuseClient,
        metricsExporter,
        dashboardSync,
        traceContextManager,
        traceRpcCalls = true,
        traceA2AMessages = true,
        traceAgentLifecycle = true,
        traceBroadcasts = true,
        debug = false
    } = config;

    if (debug) {
        console.log('[GatewayInstrumentation] Starting gateway instrumentation...');
    }

    // Store original methods
    const originalSendMessage = gateway.sendMessage.bind(gateway);
    const originalBroadcast = gateway.broadcast.bind(gateway);
    const originalStart = gateway.start.bind(gateway);
    const originalStop = gateway.stop.bind(gateway);

    // Instrument start method
    gateway.start = async function() {
        const result = await originalStart();
        
        if (traceAgentLifecycle) {
            // Record gateway start event
            if (langfuseClient) {
                langfuseClient.client?.trace({
                    id: `gateway-start-${Date.now()}`,
                    name: 'gateway-lifecycle',
                    tags: ['gateway', 'lifecycle', 'start'],
                    metadata: {
                        heretek: {
                            component: 'gateway',
                            event: 'start',
                            port: gateway.config?.port
                        }
                    }
                });
            }
            
            if (dashboardSync) {
                dashboardSync.syncAgentHealth({
                    agentId: 'gateway',
                    status: 'online',
                    lastHeartbeat: Date.now(),
                    metrics: { port: gateway.config?.port }
                });
            }
        }

        if (debug) {
            console.log('[GatewayInstrumentation] Gateway started');
        }

        return result;
    };

    // Instrument stop method
    gateway.stop = async function() {
        if (traceAgentLifecycle) {
            // Record gateway stop event
            if (langfuseClient) {
                langfuseClient.client?.trace({
                    id: `gateway-stop-${Date.now()}`,
                    name: 'gateway-lifecycle',
                    tags: ['gateway', 'lifecycle', 'stop'],
                    metadata: {
                        heretek: {
                            component: 'gateway',
                            event: 'stop'
                        }
                    }
                });
            }
            
            if (dashboardSync) {
                dashboardSync.syncAgentHealth({
                    agentId: 'gateway',
                    status: 'offline',
                    lastHeartbeat: Date.now()
                });
            }
        }

        const result = await originalStop();

        if (debug) {
            console.log('[GatewayInstrumentation] Gateway stopped');
        }

        return result;
    };

    // Instrument sendMessage for RPC tracing
    if (traceRpcCalls) {
        gateway.sendMessage = async function(toAgent, message, options = {}) {
            const startTime = Date.now();
            const correlationId = `rpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Create trace context
            const traceContext = TraceContext.createRoutingContext({
                sessionId: options.sessionId || `rpc-${toAgent}`,
                fromAgent: 'gateway',
                toAgent: toAgent,
                messageType: 'rpc-call'
            });

            // Start Langfuse trace
            let trace = null;
            let span = null;
            
            if (langfuseClient) {
                trace = langfuseClient.client?.trace({
                    id: correlationId,
                    name: 'gateway-rpc-call',
                    sessionId: options.sessionId,
                    tags: ['rpc', 'gateway', toAgent],
                    metadata: {
                        heretek: {
                            rpcType: 'agent-call',
                            targetAgent: toAgent,
                            source: 'gateway'
                        }
                    },
                    input: { message, options }
                });

                span = trace?.span({
                    name: 'message-dispatch',
                    metadata: {
                        toAgent,
                        messageType: message.type || 'unknown'
                    }
                });
            }

            try {
                // Inject trace context into message
                const messageWithContext = TraceContext.inject(message, traceContext);
                
                // Call original method
                const result = await originalSendMessage(toAgent, messageWithContext, options);
                
                const latency = Date.now() - startTime;

                // Record success
                if (span) {
                    span.generation({
                        name: 'message-response',
                        output: result,
                        metadata: {
                            latency,
                            success: true
                        }
                    });
                }

                // Record metrics
                if (metricsExporter) {
                    metricsExporter.recordLatencyMetric({
                        agentId: 'gateway',
                        latency,
                        operation: 'rpc-call',
                        targetAgent: toAgent,
                        sessionId: options.sessionId
                    });

                    metricsExporter.recordAgentMetric({
                        agentId: toAgent,
                        responseTime: latency,
                        success: true,
                        operation: 'rpc-response'
                    });
                }

                return result;

            } catch (error) {
                const latency = Date.now() - startTime;

                // Record error
                if (span) {
                    span.generation({
                        name: 'message-error',
                        output: { error: error.message },
                        metadata: {
                            latency,
                            success: false
                        }
                    });
                }

                // Record error metrics
                if (metricsExporter) {
                    metricsExporter.recordLatencyMetric({
                        agentId: 'gateway',
                        latency,
                        operation: 'rpc-call',
                        targetAgent: toAgent,
                        error: true
                    });

                    metricsExporter.recordErrorMetric({
                        agentId: 'gateway',
                        errorCode: 'RPC_ERROR',
                        errorMessage: error.message,
                        operation: 'rpc-call',
                        targetAgent: toAgent
                    });
                }

                throw error;

            } finally {
                // Finalize trace
                if (trace) {
                    trace.update({
                        output: {
                            latency: Date.now() - startTime,
                            targetAgent: toAgent
                        }
                    });
                }
            }
        };
    }

    // Instrument broadcast for tracing
    if (traceBroadcasts) {
        gateway.broadcast = async function(message) {
            const startTime = Date.now();
            const broadcastId = `broadcast-${Date.now()}`;
            
            // Create trace context
            const traceContext = TraceContext.create({
                sessionId: `broadcast-${startTime}`,
                agentId: 'gateway',
                messageType: 'broadcast'
            });

            // Start Langfuse trace
            let trace = null;
            
            if (langfuseClient) {
                trace = langfuseClient.client?.trace({
                    id: broadcastId,
                    name: 'gateway-broadcast',
                    sessionId: `broadcast-${startTime}`,
                    tags: ['broadcast', 'gateway', 'a2a'],
                    metadata: {
                        heretek: {
                            broadcastType: 'agent-broadcast',
                            source: 'gateway'
                        }
                    },
                    input: { message }
                });
            }

            try {
                // Inject trace context into message
                const messageWithContext = TraceContext.inject(message, traceContext);
                
                // Call original method
                const result = await originalBroadcast(messageWithContext);
                
                const latency = Date.now() - startTime;

                // Record metrics
                if (metricsExporter) {
                    metricsExporter.recordLatencyMetric({
                        agentId: 'gateway',
                        latency,
                        operation: 'broadcast',
                        recipientCount: result?.totalSent || 0
                    });
                }

                // Sync to dashboard
                if (dashboardSync) {
                    dashboardSync._queueUpdate('broadcast', {
                        broadcastId,
                        timestamp: startTime,
                        latency,
                        recipientCount: result?.totalSent || 0
                    });
                }

                return result;

            } catch (error) {
                // Record error
                if (metricsExporter) {
                    metricsExporter.recordErrorMetric({
                        agentId: 'gateway',
                        errorCode: 'BROADCAST_ERROR',
                        errorMessage: error.message,
                        operation: 'broadcast'
                    });
                }

                throw error;

            } finally {
                // Finalize trace
                if (trace) {
                    trace.update({
                        output: {
                            latency: Date.now() - startTime,
                            broadcastId
                        }
                    });
                }
            }
        };
    }

    // Instrument agent registration
    if (traceAgentLifecycle && gateway._handleRegister) {
        const originalHandleRegister = gateway._handleRegister.bind(gateway);
        
        gateway._handleRegister = async function(ws, agentId, message) {
            const registrationId = `register-${agentId}-${Date.now()}`;
            
            // Start trace
            let trace = null;
            
            if (langfuseClient) {
                trace = langfuseClient.client?.trace({
                    id: registrationId,
                    name: 'agent-registration',
                    sessionId: `agent-${agentId}`,
                    tags: ['agent', 'registration', 'lifecycle'],
                    metadata: {
                        heretek: {
                            agentId,
                            eventType: 'registration'
                        }
                    },
                    input: { agentId, metadata: message.metadata }
                });
            }

            try {
                const result = await originalHandleRegister(ws, agentId, message);

                // Record metrics
                if (metricsExporter) {
                    metricsExporter.recordAgentMetric({
                        agentId,
                        responseTime: 0, // Registration is instant
                        success: true,
                        operation: 'registration'
                    });
                }

                // Sync to dashboard
                if (dashboardSync) {
                    dashboardSync.syncAgentHealth({
                        agentId,
                        status: 'online',
                        lastHeartbeat: Date.now(),
                        metadata: message.metadata
                    });
                }

                return result;

            } catch (error) {
                // Record error
                if (metricsExporter) {
                    metricsExporter.recordErrorMetric({
                        agentId,
                        errorCode: 'REGISTRATION_ERROR',
                        errorMessage: error.message,
                        operation: 'registration'
                    });
                }

                throw error;

            } finally {
                // Finalize trace
                if (trace) {
                    trace.event({
                        name: 'registration-complete',
                        output: { agentId }
                    });
                }
            }
        };
    }

    // Instrument agent disconnection
    if (traceAgentLifecycle && gateway._handleDisconnect) {
        const originalHandleDisconnect = gateway._handleDisconnect.bind(gateway);
        
        gateway._handleDisconnect = async function(ws, agentId) {
            // Start trace
            let trace = null;
            
            if (langfuseClient && agentId) {
                trace = langfuseClient.client?.trace({
                    id: `disconnect-${agentId}-${Date.now()}`,
                    name: 'agent-disconnection',
                    sessionId: `agent-${agentId}`,
                    tags: ['agent', 'disconnection', 'lifecycle'],
                    metadata: {
                        heretek: {
                            agentId,
                            eventType: 'disconnection'
                        }
                    }
                });
            }

            try {
                const result = await originalHandleDisconnect(ws, agentId);

                // Sync to dashboard
                if (dashboardSync && agentId) {
                    dashboardSync.syncAgentHealth({
                        agentId,
                        status: 'offline',
                        lastHeartbeat: Date.now()
                    });
                }

                return result;

            } finally {
                // Finalize trace
                if (trace) {
                    trace.event({
                        name: 'disconnection-complete',
                        output: { agentId }
                    });
                }
            }
        };
    }

    // Instrument message routing
    if (traceA2AMessages && gateway._handleMessageRouting) {
        const originalHandleMessageRouting = gateway._handleMessageRouting.bind(gateway);
        
        gateway._handleMessageRouting = async function(ws, fromAgent, message) {
            const toAgent = message.agent || message.to;
            const routingId = `route-${fromAgent}-${toAgent}-${Date.now()}`;
            
            // Extract or create trace context
            let traceContext = TraceContext.extractFromWebSocket(message);
            
            if (!traceContext) {
                traceContext = TraceContext.createRoutingContext({
                    sessionId: message.sessionId || `a2a-${Date.now()}`,
                    fromAgent,
                    toAgent,
                    messageType: message.type || 'a2a-message'
                });
            }

            // Start Langfuse trace
            let trace = null;
            
            if (langfuseClient) {
                trace = langfuseClient.client?.trace({
                    id: routingId,
                    name: 'a2a-message-routing',
                    sessionId: message.sessionId,
                    tags: ['a2a', 'routing', 'gateway'],
                    metadata: {
                        heretek: {
                            fromAgent,
                            toAgent,
                            messageType: message.type || 'unknown',
                            routingType: 'gateway-forward'
                        }
                    },
                    input: { message, fromAgent, toAgent }
                });
            }

            try {
                // Inject trace context for propagation
                const messageWithContext = TraceContext.injectWebSocket(message, traceContext);
                
                const result = await originalHandleMessageRouting(ws, fromAgent, messageWithContext);

                // Record metrics
                if (metricsExporter) {
                    metricsExporter.recordLatencyMetric({
                        agentId: 'gateway',
                        latency: 0, // Routing is instant
                        operation: 'a2a-routing',
                        fromAgent,
                        toAgent
                    });
                }

                return result;

            } catch (error) {
                // Record error
                if (metricsExporter) {
                    metricsExporter.recordErrorMetric({
                        agentId: 'gateway',
                        errorCode: 'ROUTING_ERROR',
                        errorMessage: error.message,
                        operation: 'a2a-routing',
                        fromAgent,
                        toAgent
                    });
                }

                throw error;

            } finally {
                // Finalize trace
                if (trace) {
                    trace.update({
                        output: {
                            fromAgent,
                            toAgent,
                            routed: true
                        }
                    });
                }
            }
        };
    }

    // Instrument heartbeat handling
    if (traceAgentLifecycle && gateway._handlePing) {
        const originalHandlePing = gateway._handlePing.bind(gateway);
        
        gateway._handlePing = function(ws, agentId, message) {
            const result = originalHandlePing(ws, agentId, message);

            // Record heartbeat metrics periodically (every 10th heartbeat)
            if (metricsExporter && agentId) {
                const agent = gateway.agents?.get(agentId);
                if (agent) {
                    agent.heartbeatCount = (agent.heartbeatCount || 0) + 1;
                    
                    if (agent.heartbeatCount % 10 === 0) {
                        metricsExporter.recordAgentMetric({
                            agentId,
                            responseTime: 0,
                            success: true,
                            operation: 'heartbeat',
                            uptime: message.heartbeat?.uptime
                        });
                    }
                }
            }

            return result;
        };
    }

    if (debug) {
        console.log('[GatewayInstrumentation] Gateway instrumentation complete');
    }

    return gateway;
}

/**
 * Create A2A message trace middleware
 * @param {Object} config - Middleware configuration
 * @returns {Function} Middleware function
 */
function createA2ATraceMiddleware(config) {
    const { langfuseClient, metricsExporter, debug = false } = config;

    return async function a2aTraceMiddleware(message, context, next) {
        const startTime = Date.now();
        const messageId = message.id || `a2a-${Date.now()}`;
        
        // Extract trace context
        const traceContext = TraceContext.extract(message) || TraceContext.create({
            sessionId: context.sessionId,
            agentId: context.agentId,
            messageType: message.type
        });

        // Start trace
        let trace = null;
        if (langfuseClient) {
            trace = langfuseClient.client?.trace({
                id: messageId,
                name: `a2a-${message.type || 'message'}`,
                sessionId: traceContext.sessionId,
                tags: ['a2a', message.type || 'message'],
                metadata: {
                    heretek: {
                        fromAgent: traceContext.agentId,
                        messageType: message.type
                    }
                },
                input: message
            });
        }

        try {
            // Continue to next middleware/handler
            const result = await next(message, context);
            
            const latency = Date.now() - startTime;

            // Record metrics
            if (metricsExporter) {
                metricsExporter.recordLatencyMetric({
                    agentId: context.agentId,
                    latency,
                    operation: `a2a-${message.type || 'message'}`
                });
            }

            return result;

        } catch (error) {
            // Record error
            if (metricsExporter) {
                metricsExporter.recordErrorMetric({
                    agentId: context.agentId,
                    errorCode: 'A2A_ERROR',
                    errorMessage: error.message,
                    operation: `a2a-${message.type || 'message'}`
                });
            }

            throw error;

        } finally {
            // Finalize trace
            if (trace) {
                trace.update({
                    output: {
                        latency: Date.now() - startTime,
                        messageId
                    }
                });
            }
        }
    };
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    instrumentGateway,
    createA2ATraceMiddleware,

    /**
     * Gateway instrumentation events
     */
    GatewayEvents: {
        RPC_CALL_START: 'gateway:rpc:start',
        RPC_CALL_END: 'gateway:rpc:end',
        RPC_CALL_ERROR: 'gateway:rpc:error',
        BROADCAST_START: 'gateway:broadcast:start',
        BROADCAST_END: 'gateway:broadcast:end',
        AGENT_REGISTERED: 'gateway:agent:registered',
        AGENT_DISCONNECTED: 'gateway:agent:disconnected',
        HEARTBEAT_RECEIVED: 'gateway:heartbeat:received',
        MESSAGE_ROUTING: 'gateway:message:route'
    }
};
