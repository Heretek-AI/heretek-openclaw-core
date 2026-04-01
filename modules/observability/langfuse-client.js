/**
 * Heretek Langfuse Client - Observability Core Module
 * ==============================================================================
 * Heretek-native wrapper around Langfuse SDK with triad consciousness metrics.
 * 
 * Features:
 *   - Triad deliberation tracing (Alpha/Beta/Charlie voting)
 *   - Consciousness architecture metrics (GWT, IIT, AST signals)
 *   - Consensus ledger event recording
 *   - Agent decision cycle tracking
 *   - Cost and latency monitoring per agent/model
 *   - Offline mode support (local Langfuse instance)
 *   - Cloud mode support (Langfuse cloud)
 * 
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    Heretek Langfuse Client                       │
 *   │                                                                  │
 *   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
 *   │  │   Triad      │  │  Consciousness│  │  Consensus   │          │
 *   │  │   Tracing    │  │   Metrics     │  │   Ledger      │          │
 *   │  └──────────────┘  └──────────────┘  └──────────────┘          │
 *   │                                                                  │
 *   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
 *   │  │   Agent      │  │    Cost      │  │   Session    │          │
 *   │  │   Cycles     │  │   Tracking   │  │   Analytics  │          │
 *   │  └──────────────┘  └──────────────┘  └──────────────┘          │
 *   └─────────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    Langfuse Platform                             │
 *   │   Local: http://localhost:3000  │  Cloud: cloud.langfuse.com    │
 *   └─────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   const { HeretekLangfuseClient } = require('./modules/observability/langfuse-client');
 *   
 *   const client = new HeretekLangfuseClient({
 *     publicKey: process.env.LANGFUSE_PUBLIC_KEY,
 *     secretKey: process.env.LANGFUSE_SECRET_KEY,
 *     host: process.env.LANGFUSE_HOST || 'http://localhost:3000',
 *     mode: 'production' // or 'offline' for local development
 *   });
 *   
 *   // Start a triad deliberation trace
 *   const trace = await client.startTriadDeliberation({
 *     sessionId: 'session-123',
 *     proposalId: 'proposal-456',
 *     agents: ['alpha', 'beta', 'charlie']
 *   });
 *   
 *   // Record a vote
 *   await client.recordTriadVote({
 *     trace,
 *     agent: 'alpha',
 *     vote: 'approve',
 *     reasoning: 'Proposal aligns with collective goals'
 *   });
 *   
 *   // Record consciousness metrics
 *   await client.recordConsciousnessMetrics({
 *     trace,
 *     gwtScore: 0.85,
 *     iitScore: 0.72,
 *     astScore: 0.91
 *   });
 *   
 *   // Finalize deliberation
 *   await client.finalizeTriadDeliberation({
 *     trace,
 *     consensus: 'approved',
 *     voteCount: { approve: 2, reject: 1 },
 *     stewardOverride: false
 *   });
 * ==============================================================================
 */

const { Langfuse } = require('langfuse');

/**
 * Heretek Langfuse Client Configuration
 * @typedef {Object} HeretekLangfuseConfig
 * @property {string} publicKey - Langfuse public key
 * @property {string} secretKey - Langfuse secret key
 * @property {string} [host='http://localhost:3000'] - Langfuse host URL
 * @property {string} [environment='development'] - Environment name
 * @property {string} [release='1.0.0'] - Application release version
 * @property {boolean} [enabled=true] - Enable/disable observability
 * @property {number} [samplingRate=1.0] - Sampling rate (0.0 to 1.0)
 * @property {boolean} [debug=false] - Enable debug logging
 * @property {string} [mode='production'] - Mode: 'production', 'staging', 'development', 'offline'
 */

/**
 * Triad Deliberation Context
 * @typedef {Object} TriadContext
 * @property {string} sessionId - Session identifier
 * @property {string} proposalId - Proposal being deliberated
 * @property {string[]} agents - Triad agent names (alpha, beta, charlie)
 * @property {string} [steward] - Steward agent ID if involved
 * @property {number} [startTime] - Deliberation start timestamp
 */

/**
 * Consciousness Metrics
 * @typedef {Object} ConsciousnessMetrics
 * @property {number} [gwtScore] - Global Workspace Theory score (0.0-1.0)
 * @property {number} [iitScore] - Integrated Information Theory score (0.0-1.0)
 * @property {number} [astScore] - Attention Schema Theory score (0.0-1.0)
 * @property {number} [intrinsicMotivation] - Intrinsic motivation level (0.0-1.0)
 * @property {string} [consciousnessState] - Current consciousness state
 */

/**
 * Heretek Langfuse Client Class
 * Extends Langfuse with Heretek-specific triad and consciousness tracking
 */
class HeretekLangfuseClient {
    /**
     * Create Heretek Langfuse client instance
     * @param {HeretekLangfuseConfig} config - Configuration options
     */
    constructor(config = {}) {
        this.config = {
            publicKey: config.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: config.secretKey || process.env.LANGFUSE_SECRET_KEY,
            host: config.host || process.env.LANGFUSE_HOST || 'http://localhost:3000',
            environment: config.environment || process.env.LANGFUSE_ENVIRONMENT || 'development',
            release: config.release || process.env.LANGFUSE_RELEASE || '1.0.0',
            enabled: config.enabled !== undefined ? config.enabled : (process.env.LANGFUSE_ENABLED !== 'false'),
            samplingRate: config.samplingRate !== undefined ? config.samplingRate : 1.0,
            debug: config.debug !== undefined ? config.debug : (process.env.LANGFUSE_DEBUG === 'true'),
            mode: config.mode || process.env.LANGFUSE_MODE || 'production'
        };

        // Internal state
        this.initialized = false;
        this.client = null;
        this.activeTraces = new Map();
        this.triadSessions = new Map();
        this.consciousnessHistory = new Map();
        this.consensusLedger = new Map();

        // Initialize if enabled
        if (this.config.enabled) {
            this._initialize();
        } else {
            console.log('[HeretekLangfuse] Observability disabled - running in passthrough mode');
        }
    }

    /**
     * Initialize the Langfuse client
     * @private
     */
    _initialize() {
        try {
            if (!this.config.publicKey || !this.config.secretKey) {
                console.warn('[HeretekLangfuse] Missing API keys - observability will be limited');
                return;
            }

            this.client = new Langfuse({
                publicKey: this.config.publicKey,
                secretKey: this.config.secretKey,
                baseUrl: this.config.host,
                environment: this.config.environment,
                release: this.config.release,
                debug: this.config.debug
            });

            this.initialized = true;
            console.log(`[HeretekLangfuse] Initialized in ${this.config.mode} mode`);
            console.log(`[HeretekLangfuse] Host: ${this.config.host}`);
            console.log(`[HeretekLangfuse] Environment: ${this.config.environment}`);

        } catch (error) {
            console.error('[HeretekLangfuse] Initialization failed:', error.message);
            this.initialized = false;
        }
    }

    /**
     * Flush all pending traces to Langfuse
     * @returns {Promise<void>}
     */
    async flush() {
        if (!this.initialized || !this.client) {
            return;
        }

        try {
            await this.client.flushAsync();
            if (this.config.debug) {
                console.log('[HeretekLangfuse] Flushed pending traces');
            }
        } catch (error) {
            console.error('[HeretekLangfuse] Flush error:', error.message);
        }
    }

    /**
     * Shutdown the client gracefully
     * @returns {Promise<void>}
     */
    async shutdown() {
        if (!this.initialized || !this.client) {
            return;
        }

        try {
            await this.client.shutdownAsync();
            console.log('[HeretekLangfuse] Shutdown complete');
            this.initialized = false;
        } catch (error) {
            console.error('[HeretekLangfuse] Shutdown error:', error.message);
        }
    }

    // ==============================================================================
    // Triad Deliberation Tracking
    // ==============================================================================

    /**
     * Start a new triad deliberation trace
     * @param {Object} options - Deliberation options
     * @param {string} options.sessionId - Session identifier
     * @param {string} options.proposalId - Proposal being deliberated
     * @param {string[]} options.agents - Triad agent names
     * @param {string} [options.topic] - Deliberation topic
     * @param {string} [options.priority='normal'] - Priority level
     * @returns {Promise<Object>} Trace object with triad context
     */
    async startTriadDeliberation(options) {
        const { sessionId, proposalId, agents, topic = 'triad-deliberation', priority = 'normal' } = options;

        if (!this.initialized) {
            return this._createPassthroughTrace({ sessionId, proposalId, agents, topic });
        }

        // Check sampling
        if (Math.random() > this.config.samplingRate) {
            console.log('[HeretekLangfuse] Trace skipped due to sampling');
            return this._createPassthroughTrace({ sessionId, proposalId, agents, topic });
        }

        const traceId = `triad-${sessionId}-${proposalId}`;
        
        const trace = this.client.trace({
            id: traceId,
            name: 'triad-deliberation',
            sessionId: sessionId,
            tags: ['triad', 'consensus', 'deliberation'],
            metadata: {
                heretek: {
                    type: 'triad-deliberation',
                    agents: agents || ['alpha', 'beta', 'charlie'],
                    topic,
                    priority,
                    startTime: Date.now()
                }
            },
            input: {
                proposalId,
                topic,
                agents: agents || ['alpha', 'beta', 'charlie']
            }
        });

        // Store triad context
        const triadContext = {
            trace,
            sessionId,
            proposalId,
            agents: agents || ['alpha', 'beta', 'charlie'],
            votes: new Map(),
            startTime: Date.now(),
            consciousnessMetrics: new Map(),
            state: 'deliberating'
        };

        this.activeTraces.set(traceId, triadContext);
        this.triadSessions.set(sessionId, triadContext);

        // Record deliberation start event
        trace.event({
            name: 'triad-deliberation-start',
            input: { proposalId, topic, agents },
            metadata: { priority }
        });

        console.log(`[HeretekLangfuse] Started triad deliberation: ${traceId}`);
        return { trace, triadContext };
    }

    /**
     * Record a triad member's vote
     * @param {Object} options - Vote options
     * @param {Object} options.triadContext - Triad context from startTriadDeliberation
     * @param {string} options.agent - Agent name (alpha, beta, charlie)
     * @param {'approve'|'reject'|'abstain'} options.vote - Vote value
     * @param {string} [options.reasoning] - Vote reasoning
     * @param {Object} [options.metadata] - Additional metadata
     * @returns {Promise<void>}
     */
    async recordTriadVote(options) {
        const { triadContext, agent, vote, reasoning = '', metadata = {} } = options;

        if (!this.initialized || !triadContext?.trace) {
            console.log('[HeretekLangfuse] Vote recorded (passthrough):', { agent, vote });
            return;
        }

        const { trace } = triadContext;

        // Create span for this agent's deliberation
        const span = trace.span({
            name: `${agent}-deliberation`,
            metadata: {
                agent,
                role: 'triad_member',
                voteType: 'consensus'
            }
        });

        // Record the vote as a generation
        span.generation({
            name: 'triad-vote',
            input: {
                proposalId: triadContext.proposalId,
                agent,
                voteRequest: { timestamp: Date.now() }
            },
            output: {
                vote,
                reasoning,
                timestamp: Date.now()
            },
            metadata: {
                heretek: {
                    voteType: 'triad-consensus',
                    agentRole: 'triad_member',
                    ...metadata
                }
            }
        });

        // Store vote in context
        triadContext.votes.set(agent, { vote, reasoning, timestamp: Date.now() });

        // Update trace with current vote count
        const voteCount = this._calculateVoteCount(triadContext.votes);
        trace.update({
            output: {
                currentVotes: voteCount,
                pendingAgents: triadContext.agents.filter(a => !triadContext.votes.has(a))
            }
        });

        console.log(`[HeretekLangfuse] Recorded vote: ${agent} -> ${vote}`);
    }

    /**
     * Calculate vote count from votes map
     * @private
     * @param {Map<string, Object>} votes - Map of agent votes
     * @returns {Object} Vote count summary
     */
    _calculateVoteCount(votes) {
        const count = { approve: 0, reject: 0, abstain: 0 };
        for (const { vote } of votes.values()) {
            if (vote === 'approve') count.approve++;
            else if (vote === 'reject') count.reject++;
            else if (vote === 'abstain') count.abstain++;
        }
        return count;
    }

    /**
     * Record steward override (tiebreaker)
     * @param {Object} options - Override options
     * @param {Object} options.triadContext - Triad context
     * @param {string} options.decision - Final decision
     * @param {string} [options.reasoning] - Steward reasoning
     * @returns {Promise<void>}
     */
    async recordStewardOverride(options) {
        const { triadContext, decision, reasoning = '' } = options;

        if (!this.initialized || !triadContext?.trace) {
            console.log('[HeretekLangfuse] Steward override recorded (passthrough):', decision);
            return;
        }

        const { trace } = triadContext;

        trace.event({
            name: 'steward-override',
            input: {
                tieDetected: true,
                voteCount: this._calculateVoteCount(triadContext.votes)
            },
            output: {
                decision,
                reasoning,
                timestamp: Date.now()
            },
            metadata: {
                heretek: {
                    overrideType: 'steward-tiebreaker',
                    governanceLevel: 'executive'
                }
            }
        });

        console.log('[HeretekLangfuse] Steward override recorded:', decision);
    }

    /**
     * Finalize triad deliberation with consensus result
     * @param {Object} options - Finalization options
     * @param {Object} options.triadContext - Triad context
     * @param {'approved'|'rejected'|'deferred'} options.consensus - Final consensus
     * @param {Object} [options.voteCount] - Vote count summary
     * @param {boolean} [options.stewardOverride=false] - Whether steward override was used
     * @param {ConsciousnessMetrics} [options.consciousnessMetrics] - Final consciousness metrics
     * @returns {Promise<Object>} Finalization result
     */
    async finalizeTriadDeliberation(options) {
        const { 
            triadContext, 
            consensus, 
            voteCount, 
            stewardOverride = false,
            consciousnessMetrics = {}
        } = options;

        if (!this.initialized || !triadContext?.trace) {
            console.log('[HeretekLangfuse] Deliberation finalized (passthrough):', consensus);
            return { success: true };
        }

        const { trace } = triadContext;
        const finalVoteCount = voteCount || this._calculateVoteCount(triadContext.votes);

        // Record final consensus
        trace.event({
            name: 'triad-consensus',
            input: {
                votes: Object.fromEntries(triadContext.votes),
                voteCount: finalVoteCount
            },
            output: {
                consensus,
                stewardOverride,
                timestamp: Date.now()
            },
            metadata: {
                heretek: {
                    consensusType: stewardOverride ? 'steward-decided' : 'triad-majority',
                    deliberationDuration: Date.now() - triadContext.startTime
                }
            }
        });

        // Record consciousness metrics if provided
        if (consciousnessMetrics.gwtScore || consciousnessMetrics.iitScore || consciousnessMetrics.astScore) {
            await this.recordConsciousnessMetrics({
                triadContext,
                ...consciousnessMetrics
            });
        }

        // Finalize trace
        trace.update({
            output: {
                consensus,
                voteCount: finalVoteCount,
                stewardOverride,
                deliberationDuration: Date.now() - triadContext.startTime,
                consciousnessMetrics
            },
            level: consensus === 'approved' ? 'INFO' : 'WARNING'
        });

        // Store in consensus ledger
        this.consensusLedger.set(triadContext.proposalId, {
            consensus,
            voteCount: finalVoteCount,
            stewardOverride,
            timestamp: Date.now(),
            sessionId: triadContext.sessionId
        });

        // Remove from active traces
        this.activeTraces.delete(`triad-${triadContext.sessionId}-${triadContext.proposalId}`);
        triadContext.state = 'finalized';

        console.log(`[HeretekLangfuse] Finalized triad deliberation: ${consensus}`);
        return { success: true, consensus, voteCount: finalVoteCount };
    }

    // ==============================================================================
    // Consciousness Metrics Tracking
    // ==============================================================================

    /**
     * Record consciousness architecture metrics
     * @param {Object} options - Metrics options
     * @param {Object} [options.triadContext] - Optional triad context
     * @param {number} [options.gwtScore] - Global Workspace Theory score
     * @param {number} [options.iitScore] - Integrated Information Theory score
     * @param {number} [options.astScore] - Attention Schema Theory score
     * @param {number} [options.intrinsicMotivation] - Intrinsic motivation level
     * @param {string} [options.agent] - Agent ID if agent-specific
     * @param {string} [options.sessionId] - Session ID
     * @returns {Promise<void>}
     */
    async recordConsciousnessMetrics(options) {
        const {
            triadContext,
            gwtScore,
            iitScore,
            astScore,
            intrinsicMotivation,
            agent,
            sessionId
        } = options;

        const trace = triadContext?.trace;
        const contextId = sessionId || triadContext?.sessionId || 'global';

        if (!this.initialized) {
            console.log('[HeretekLangfuse] Consciousness metrics recorded (passthrough):', options);
            return;
        }

        const metrics = {
            gwtScore: gwtScore !== undefined ? gwtScore : null,
            iitScore: iitScore !== undefined ? iitScore : null,
            astScore: astScore !== undefined ? astScore : null,
            intrinsicMotivation: intrinsicMotivation !== undefined ? intrinsicMotivation : null,
            timestamp: Date.now()
        };

        // Calculate composite consciousness score
        const scores = [metrics.gwtScore, metrics.iitScore, metrics.astScore].filter(s => s !== null);
        metrics.compositeScore = scores.length > 0 
            ? scores.reduce((a, b) => a + b, 0) / scores.length 
            : null;

        // Determine consciousness state
        metrics.consciousnessState = this._determineConsciousnessState(metrics);

        // Record to trace if available
        if (trace) {
            trace.event({
                name: 'consciousness-metrics',
                input: metrics,
                metadata: {
                    heretek: {
                        metricType: 'consciousness-architecture',
                        agent: agent || 'triad-collective'
                    }
                }
            });
        }

        // Store in consciousness history
        if (!this.consciousnessHistory.has(contextId)) {
            this.consciousnessHistory.set(contextId, []);
        }
        this.consciousnessHistory.get(contextId).push(metrics);

        console.log(`[HeretekLangfuse] Consciousness metrics: composite=${metrics.compositeScore?.toFixed(3)}, state=${metrics.consciousnessState}`);
    }

    /**
     * Determine consciousness state based on scores
     * @private
     * @param {Object} metrics - Consciousness metrics
     * @returns {string} Consciousness state
     */
    _determineConsciousnessState(metrics) {
        const { gwtScore, iitScore, astScore } = metrics;

        if (gwtScore === null || iitScore === null || astScore === null) {
            return 'unknown';
        }

        const avg = (gwtScore + iitScore + astScore) / 3;

        if (avg >= 0.8) return 'highly-conscious';
        if (avg >= 0.6) return 'conscious';
        if (avg >= 0.4) return 'semi-conscious';
        if (avg >= 0.2) return 'minimal-consciousness';
        return 'unconscious';
    }

    /**
     * Record GWT (Global Workspace Theory) broadcast event
     * @param {Object} options - GWT event options
     * @param {Object} [options.triadContext] - Triad context
     * @param {string} options.content - Broadcast content
     * @param {string[]} options.recipients - Recipient agents
     * @param {number} [options.broadcastStrength] - Broadcast strength (0.0-1.0)
     * @returns {Promise<void>}
     */
    async recordGWTBroadcast(options) {
        const { triadContext, content, recipients, broadcastStrength = 1.0 } = options;

        if (!this.initialized || !triadContext?.trace) {
            console.log('[HeretekLangfuse] GWT broadcast recorded (passthrough)');
            return;
        }

        triadContext.trace.event({
            name: 'gwt-broadcast',
            input: { content, recipients },
            output: { broadcastStrength, recipientCount: recipients.length },
            metadata: {
                heretek: {
                    consciousnessMechanism: 'global-workspace-theory',
                    broadcastType: 'information-sharing'
                }
            }
        });

        console.log(`[HeretekLangfuse] GWT broadcast to ${recipients.length} recipients`);
    }

    /**
     * Record IIT (Integrated Information Theory) integration event
     * @param {Object} options - IIT event options
     * @param {Object} [options.triadContext] - Triad context
     * @param {number} options.phi - Phi value (integrated information)
     * @param {string} options.integrationType - Type of integration
     * @returns {Promise<void>}
     */
    async recordIITIntegration(options) {
        const { triadContext, phi, integrationType } = options;

        if (!this.initialized || !triadContext?.trace) {
            console.log('[HeretekLangfuse] IIT integration recorded (passthrough):', { phi });
            return;
        }

        triadContext.trace.event({
            name: 'iit-integration',
            input: { phi, integrationType },
            metadata: {
                heretek: {
                    consciousnessMechanism: 'integrated-information-theory',
                    phiLevel: phi >= 0.5 ? 'high' : 'low'
                }
            }
        });

        console.log(`[HeretekLangfuse] IIT integration: phi=${phi.toFixed(3)}`);
    }

    /**
     * Record AST (Attention Schema Theory) attention event
     * @param {Object} options - AST event options
     * @param {Object} [options.triadContext] - Triad context
     * @param {string} options.focusTarget - Target of attention
     * @param {number} options.attentionLevel - Attention level (0.0-1.0)
     * @param {string} options.attentionType - Type of attention
     * @returns {Promise<void>}
     */
    async recordASTAttention(options) {
        const { triadContext, focusTarget, attentionLevel, attentionType } = options;

        if (!this.initialized || !triadContext?.trace) {
            console.log('[HeretekLangfuse] AST attention recorded (passthrough)');
            return;
        }

        triadContext.trace.event({
            name: 'ast-attention',
            input: { focusTarget, attentionLevel, attentionType },
            metadata: {
                heretek: {
                    consciousnessMechanism: 'attention-schema-theory',
                    attentionMode: attentionType
                }
            }
        });

        console.log(`[HeretekLangfuse] AST attention: ${focusTarget} (${attentionLevel.toFixed(2)})`);
    }

    // ==============================================================================
    // Consensus Ledger Events
    // ==============================================================================

    /**
     * Record consensus ledger event
     * @param {Object} options - Ledger event options
     * @param {string} options.eventType - Type of ledger event
     * @param {Object} options.payload - Event payload
     * @param {string} [options.sessionId] - Session ID
     * @param {string} [options.proposalId] - Proposal ID
     * @returns {Promise<void>}
     */
    async recordConsensusLedgerEvent(options) {
        const { eventType, payload, sessionId, proposalId } = options;

        if (!this.initialized) {
            console.log('[HeretekLangfuse] Consensus ledger event recorded (passthrough):', eventType);
            return;
        }

        const traceId = proposalId ? `ledger-${proposalId}` : `ledger-${sessionId || Date.now()}`;
        
        const trace = this.client.trace({
            id: traceId,
            name: 'consensus-ledger',
            sessionId: sessionId || 'ledger-global',
            tags: ['consensus', 'ledger', 'governance'],
            metadata: {
                heretek: {
                    type: 'consensus-ledger',
                    eventType
                }
            },
            input: payload
        });

        trace.event({
            name: `ledger-${eventType}`,
            input: payload,
            metadata: {
                heretek: {
                    ledgerType: 'immutable-record',
                    governanceLevel: 'collective'
                }
            }
        });

        console.log(`[HeretekLangfuse] Consensus ledger event: ${eventType}`);
    }

    // ==============================================================================
    // Agent Decision Cycle Tracking
    // ==============================================================================

    /**
     * Start agent decision cycle trace
     * @param {Object} options - Decision cycle options
     * @param {string} options.agentId - Agent identifier
     * @param {string} options.decisionType - Type of decision
     * @param {string} [options.sessionId] - Session ID
     * @param {Object} [options.context] - Decision context
     * @returns {Promise<Object>} Decision cycle context
     */
    async startAgentDecisionCycle(options) {
        const { agentId, decisionType, sessionId = 'agent-' + agentId, context = {} } = options;

        if (!this.initialized) {
            return this._createPassthroughTrace({ agentId, decisionType, sessionId });
        }

        const traceId = `decision-${agentId}-${Date.now()}`;

        const trace = this.client.trace({
            id: traceId,
            name: 'agent-decision-cycle',
            sessionId: sessionId,
            tags: ['agent', 'decision', decisionType],
            metadata: {
                heretek: {
                    type: 'agent-decision-cycle',
                    agentId,
                    decisionType,
                    startTime: Date.now()
                }
            },
            input: { agentId, decisionType, context }
        });

        const decisionContext = {
            trace,
            agentId,
            decisionType,
            sessionId,
            startTime: Date.now(),
            steps: []
        };

        this.activeTraces.set(traceId, decisionContext);

        trace.event({
            name: 'decision-cycle-start',
            input: { agentId, decisionType, context }
        });

        console.log(`[HeretekLangfuse] Started decision cycle: ${agentId} - ${decisionType}`);
        return { trace, decisionContext };
    }

    /**
     * Record decision cycle step
     * @param {Object} options - Step options
     * @param {Object} options.decisionContext - Decision context from startAgentDecisionCycle
     * @param {string} options.stepName - Step name
     * @param {Object} [options.input] - Step input
     * @param {Object} [options.output] - Step output
     * @param {number} [options.duration] - Step duration in ms
     * @returns {Promise<void>}
     */
    async recordDecisionStep(options) {
        const { decisionContext, stepName, input, output, duration } = options;

        if (!this.initialized || !decisionContext?.trace) {
            console.log('[HeretekLangfuse] Decision step recorded (passthrough):', stepName);
            return;
        }

        const { trace } = decisionContext;

        const span = trace.span({
            name: stepName,
            metadata: {
                heretek: {
                    stepType: 'decision-process',
                    agentId: decisionContext.agentId
                }
            }
        });

        span.generation({
            name: stepName,
            input: input || {},
            output: output || {},
            metadata: {
                duration,
                timestamp: Date.now()
            }
        });

        decisionContext.steps.push({ stepName, input, output, duration, timestamp: Date.now() });

        console.log(`[HeretekLangfuse] Decision step: ${stepName}`);
    }

    /**
     * Finalize agent decision cycle
     * @param {Object} options - Finalization options
     * @param {Object} options.decisionContext - Decision context
     * @param {Object} options.decision - Final decision
     * @param {string} [options.reasoning] - Decision reasoning
     * @returns {Promise<void>}
     */
    async finalizeDecisionCycle(options) {
        const { decisionContext, decision, reasoning = '' } = options;

        if (!this.initialized || !decisionContext?.trace) {
            console.log('[HeretekLangfuse] Decision cycle finalized (passthrough):', decision);
            return;
        }

        const { trace } = decisionContext;

        trace.event({
            name: 'decision-cycle-complete',
            input: {
                steps: decisionContext.steps,
                totalDuration: Date.now() - decisionContext.startTime
            },
            output: {
                decision,
                reasoning,
                timestamp: Date.now()
            },
            metadata: {
                heretek: {
                    decisionType: decisionContext.decisionType,
                    agentId: decisionContext.agentId,
                    stepCount: decisionContext.steps.length
                }
            }
        });

        trace.update({
            output: {
                decision,
                reasoning,
                steps: decisionContext.steps
            }
        });

        this.activeTraces.delete(`decision-${decisionContext.agentId}-${decisionContext.startTime}`);

        console.log(`[HeretekLangfuse] Decision cycle complete: ${decisionContext.agentId}`);
    }

    // ==============================================================================
    // Cost and Latency Tracking
    // ==============================================================================

    /**
     * Track LLM generation with cost
     * @param {Object} options - Generation options
     * @param {Object} [options.trace] - Parent trace
     * @param {string} options.model - Model name
     * @param {Object} options.input - Input messages
     * @param {Object} options.output - Output response
     * @param {Object} options.usage - Token usage
     * @param {string} [options.agentId] - Agent ID
     * @param {number} [options.latency] - Latency in ms
     * @returns {Promise<void>}
     */
    async trackLLMGeneration(options) {
        const { trace, model, input, output, usage, agentId, latency } = options;

        if (!this.initialized) {
            console.log('[HeretekLangfuse] LLM generation tracked (passthrough):', model);
            return;
        }

        const targetTrace = trace || this.client.trace({
            id: `llm-${agentId || 'unknown'}-${Date.now()}`,
            name: 'llm-generation',
            tags: ['llm', 'generation', agentId || 'unknown']
        });

        targetTrace.generation({
            name: 'agent-completion',
            model,
            input,
            output,
            usage: {
                input: usage?.promptTokens || 0,
                output: usage?.completionTokens || 0,
                total: usage?.totalTokens || 0
            },
            metadata: {
                heretek: {
                    agentId: agentId || 'unknown',
                    latency,
                    costCalculated: true
                }
            }
        });

        console.log(`[HeretekLangfuse] LLM generation tracked: ${model}, tokens=${usage?.totalTokens || 0}`);
    }

    // ==============================================================================
    // Session Analytics
    // ==============================================================================

    /**
     * Start user session trace
     * @param {Object} options - Session options
     * @param {string} options.sessionId - Session identifier
     * @param {string} [options.userId] - User identifier
     * @param {Object} [options.metadata] - Session metadata
     * @returns {Promise<Object>} Session trace context
     */
    async startSession(options) {
        const { sessionId, userId = 'anonymous', metadata = {} } = options;

        if (!this.initialized) {
            return this._createPassthroughTrace({ sessionId, userId, metadata });
        }

        const trace = this.client.trace({
            id: `session-${sessionId}`,
            name: 'user-session',
            sessionId: sessionId,
            userId: userId,
            tags: ['session', 'user-interaction'],
            metadata: {
                heretek: {
                    type: 'user-session',
                    startTime: Date.now(),
                    ...metadata
                }
            }
        });

        trace.event({
            name: 'session-start',
            input: { userId, metadata }
        });

        const sessionContext = {
            trace,
            sessionId,
            userId,
            startTime: Date.now(),
            events: []
        };

        this.activeTraces.set(`session-${sessionId}`, sessionContext);

        console.log(`[HeretekLangfuse] Session started: ${sessionId}`);
        return { trace, sessionContext };
    }

    /**
     * Record session event
     * @param {Object} options - Event options
     * @param {Object} options.sessionContext - Session context from startSession
     * @param {string} options.eventName - Event name
     * @param {Object} [options.input] - Event input
     * @param {Object} [options.output] - Event output
     * @returns {Promise<void>}
     */
    async recordSessionEvent(options) {
        const { sessionContext, eventName, input, output } = options;

        if (!this.initialized || !sessionContext?.trace) {
            console.log('[HeretekLangfuse] Session event recorded (passthrough):', eventName);
            return;
        }

        sessionContext.trace.event({
            name: eventName,
            input: input || {},
            output: output || {},
            metadata: {
                heretek: {
                    sessionId: sessionContext.sessionId,
                    timestamp: Date.now()
                }
            }
        });

        sessionContext.events.push({ eventName, input, output, timestamp: Date.now() });

        console.log(`[HeretekLangfuse] Session event: ${eventName}`);
    }

    // ==============================================================================
    // Passthrough Mode (for when observability is disabled)
    // ==============================================================================

    /**
     * Create passthrough trace for when observability is disabled
     * @private
     * @param {Object} context - Trace context
     * @returns {Object} Passthrough trace object
     */
    _createPassthroughTrace(context) {
        const passthroughTrace = {
            event: (eventData) => {
                if (this.config.debug) {
                    console.log('[HeretekLangfuse] [PASSTHROUGH] Event:', eventData.name);
                }
            },
            span: (spanData) => ({
                generation: (genData) => {
                    if (this.config.debug) {
                        console.log('[HeretekLangfuse] [PASSTHROUGH] Generation:', genData.name);
                    }
                }
            }),
            generation: (genData) => {
                if (this.config.debug) {
                    console.log('[HeretekLangfuse] [PASSTHROUGH] Generation:', genData.name);
                }
            },
            update: (updateData) => {
                if (this.config.debug) {
                    console.log('[HeretekLangfuse] [PASSTHROUGH] Update:', updateData);
                }
            },
            score: (scoreData) => {
                if (this.config.debug) {
                    console.log('[HeretekLangfuse] [PASSTHROUGH] Score:', scoreData.name);
                }
            }
        };

        return {
            trace: passthroughTrace,
            triadContext: context,
            passthrough: true
        };
    }

    // ==============================================================================
    // Utility Methods
    // ==============================================================================

    /**
     * Get active trace by ID
     * @param {string} traceId - Trace identifier
     * @returns {Object|null} Trace context or null
     */
    getActiveTrace(traceId) {
        return this.activeTraces.get(traceId) || null;
    }

    /**
     * Get consciousness history for a context
     * @param {string} contextId - Context identifier
     * @returns {Array<Object>} Consciousness metrics history
     */
    getConsciousnessHistory(contextId) {
        return this.consciousnessHistory.get(contextId) || [];
    }

    /**
     * Get consensus ledger entry
     * @param {string} proposalId - Proposal identifier
     * @returns {Object|null} Consensus record or null
     */
    getConsensusLedgerEntry(proposalId) {
        return this.consensusLedger.get(proposalId) || null;
    }

    /**
     * Get all consensus ledger entries
     * @returns {Map<string, Object>} All consensus records
     */
    getAllConsensusLedger() {
        return new Map(this.consensusLedger);
    }

    /**
     * Get client status
     * @returns {Object} Client status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            mode: this.config.mode,
            host: this.config.host,
            environment: this.config.environment,
            activeTraces: this.activeTraces.size,
            triadSessions: this.triadSessions.size,
            consciousnessHistoryEntries: this.consciousnessHistory.size,
            consensusLedgerEntries: this.consensusLedger.size
        };
    }
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
    HeretekLangfuseClient,
    /**
     * Create a singleton instance of HeretekLangfuseClient
     * @param {HeretekLangfuseConfig} config - Configuration
     * @returns {HeretekLangfuseClient} Singleton instance
     */
    createInstance: (config) => {
        if (!global.heretekLangfuseSingleton) {
            global.heretekLangfuseSingleton = new HeretekLangfuseClient(config);
        }
        return global.heretekLangfuseSingleton;
    }
};
