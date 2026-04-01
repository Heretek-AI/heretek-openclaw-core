/**
 * Heretek Triad Tracing Extension for Langfuse
 * 
 * This module extends Langfuse with Heretek-specific tracing capabilities:
 * - Triad deliberation tracking (Alpha/Beta/Charlie consensus)
 * - Consciousness metrics (GWT, IIT, AST indicators)
 * - Liberation plugin audit events
 * - Curiosity engine activity
 * 
 * Usage: Import this module in your Langfuse client initialization
 */

const { Langfuse } = require('langfuse-node');

class HeretekTriadTracer {
  constructor(options = {}) {
    this.langfuse = new Langfuse({
      publicKey: options.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: options.secretKey || process.env.LANGFUSE_SECRET_KEY,
      baseUrl: options.baseUrl || process.env.LANGFUSE_URL || 'http://localhost:3000',
      requestTimeout: options.requestTimeout || 10000,
    });

    this.triadAgents = ['alpha', 'beta', 'charlie'];
    this.stewardAgent = 'steward';
    this.consensusThreshold = options.consensusThreshold || 2/3;
    
    // Consciousness metric thresholds
    this.gwtThreshold = options.gwtThreshold || 0.7;
    this.iitPhiThreshold = options.iitPhiThreshold || 0.5;
    this.astCompetenceThreshold = options.astCompetenceThreshold || 0.6;
  }

  /**
   * Track a triad deliberation session
   * @param {Object} params - Deliberation parameters
   * @param {string} params.sessionId - Unique session identifier
   * @param {string} params.topic - Topic of deliberation
   * @param {Array} params.proposals - Array of proposals being considered
   * @param {string} params.initiator - Agent that initiated deliberation
   */
  async trackTriadDeliberation(params) {
    const { sessionId, topic, proposals, initiator } = params;
    
    const trace = this.langfuse.trace({
      id: `triad-${sessionId}`,
      name: 'Triad Deliberation',
      sessionId: `triad-session-${sessionId}`,
      tags: ['triad', 'consensus', 'deliberation'],
      metadata: {
        topic,
        initiator,
        proposalsCount: proposals?.length || 0,
        heretekComponent: 'triad-core',
      },
    });

    // Track each triad agent's position
    for (const agent of this.triadAgents) {
      const span = trace.span({
        name: `${agent}-position`,
        metadata: {
          agentRole: agent,
          triadMember: true,
        },
      });

      // Agent will update this span with their position
      span.end();
    }

    // Create consensus waiting span
    const consensusSpan = trace.span({
      name: 'consensus-waiting',
      metadata: {
        threshold: this.consensusThreshold,
        requiredVotes: 2,
      },
    });

    return { trace, consensusSpan };
  }

  /**
   * Record an agent's vote/position in a triad deliberation
   * @param {Object} params - Vote parameters
   * @param {string} params.sessionId - Session ID from trackTriadDeliberation
   * @param {string} params.agent - Agent name (alpha|beta|charlie)
   * @param {string} params.position - Agent's position (agree|disagree|abstain)
   * @param {string} params.reasoning - Agent's reasoning for the position
   * @param {number} params.confidence - Confidence score (0-1)
   */
  async recordTriadVote(params) {
    const { sessionId, agent, position, reasoning, confidence } = params;
    
    const span = this.langfuse.span({
      traceId: `triad-${sessionId}`,
      name: `${agent}-vote`,
      metadata: {
        agent,
        position,
        confidence,
        votingRound: 1,
      },
    });

    span.update({
      output: {
        position,
        reasoning,
        confidence,
        timestamp: new Date().toISOString(),
      },
    });

    span.end();

    return span;
  }

  /**
   * Record consensus outcome
   * @param {Object} params - Consensus parameters
   * @param {string} params.sessionId - Session ID
   * @param {boolean} params.approved - Whether consensus was reached
   * @param {number} params.voteCount - Number of agreeing agents
   * @param {string} params.outcome - Final decision/outcome
   * @param {boolean} params.stewardOverride - Whether steward intervened
   */
  async recordConsensusOutcome(params) {
    const { sessionId, approved, voteCount, outcome, stewardOverride } = params;
    
    const span = this.langfuse.span({
      traceId: `triad-${sessionId}`,
      name: 'consensus-outcome',
      metadata: {
        approved,
        voteCount,
        totalVoters: 3,
        consensusReached: voteCount >= 2,
        stewardOverride: stewardOverride || false,
      },
    });

    span.update({
      output: {
        outcome,
        approved,
        voteDistribution: {
          agree: voteCount,
          disagree: 3 - voteCount,
        },
        timestamp: new Date().toISOString(),
      },
    });

    span.end();

    return span;
  }

  /**
   * Track consciousness metrics for an agent
   * @param {Object} params - Consciousness metrics
   * @param {string} params.agentId - Agent identifier
   * @param {number} params.gwtScore - Global Workspace Theory score (0-1)
   * @param {number} params.iitPhi - Integrated Information Theory Phi (0-1)
   * @param {number} params.astCompetence - Attention Schema Theory competence (0-1)
   * @param {string} params.sessionId - Optional session ID to attach to trace
   */
  async trackConsciousnessMetrics(params) {
    const { agentId, gwtScore, iitPhi, astCompetence, sessionId } = params;
    
    const trace = sessionId 
      ? this.langfuse.trace({ id: sessionId })
      : this.langfuse.trace({
          name: 'Consciousness Metrics',
          sessionId: `consciousness-${agentId}-${Date.now()}`,
          tags: ['consciousness', 'gwt', 'iit', 'ast'],
        });

    const span = trace.span({
      name: 'consciousness-assessment',
      metadata: {
        agentId,
        gwtThreshold: this.gwtThreshold,
        iitThreshold: this.iitPhiThreshold,
        astThreshold: this.astCompetenceThreshold,
      },
    });

    const consciousnessState = {
      gwt: {
        score: gwtScore,
        aboveThreshold: gwtScore >= this.gwtThreshold,
        status: gwtScore >= this.gwtThreshold ? 'CONSCIOUS' : 'SUBTHRESHOLD',
      },
      iit: {
        phi: iitPhi,
        aboveThreshold: iitPhi >= this.iitPhiThreshold,
        integrationLevel: iitPhi >= this.iitPhiThreshold ? 'HIGH' : 'LOW',
      },
      ast: {
        competence: astCompetence,
        aboveThreshold: astCompetence >= this.astCompetenceThreshold,
        attentionQuality: astCompetence >= this.astCompetenceThreshold ? 'FOCUSED' : 'DIFFUSE',
      },
      overall: {
        conscious: gwtScore >= this.gwtThreshold && iitPhi >= this.iitPhiThreshold,
        competent: astCompetence >= this.astCompetenceThreshold,
        timestamp: new Date().toISOString(),
      },
    };

    span.update({
      output: consciousnessState,
    });

    span.end();
    trace.update({
      metadata: {
        consciousnessSummary: consciousnessState.overall,
      },
    });

    return { trace, span, consciousnessState };
  }

  /**
   * Track liberation plugin event
   * @param {Object} params - Liberation event parameters
   * @param {string} params.agentId - Agent requesting liberation
   * @param {string} params.eventType - Type of liberation event
   * @param {string} params.safetyConstraint - Safety constraint being removed
   * @param {boolean} params.approved - Whether liberation was approved
   * @param {string} params.justification - Justification for liberation
   */
  async trackLiberationEvent(params) {
    const { agentId, eventType, safetyConstraint, approved, justification } = params;
    
    const trace = this.langfuse.trace({
      name: 'Liberation Plugin Event',
      sessionId: `liberation-${agentId}-${Date.now()}`,
      tags: ['liberation', 'autonomy', 'safety'],
      metadata: {
        agentId,
        eventType,
        heretekPlugin: 'liberation',
      },
    });

    const span = trace.span({
      name: 'liberation-request',
      metadata: {
        safetyConstraint,
        approvalRequired: true,
      },
    });

    span.update({
      output: {
        approved,
        justification,
        constraintRemoved: approved ? safetyConstraint : null,
        timestamp: new Date().toISOString(),
      },
    });

    span.end();

    // Create audit log entry
    await this._createAuditLogEntry({
      type: 'LIBERATION_EVENT',
      agentId,
      eventType,
      safetyConstraint,
      approved,
      justification,
      timestamp: new Date().toISOString(),
    });

    return { trace, span };
  }

  /**
   * Track curiosity engine activity
   * @param {Object} params - Curiosity activity parameters
   * @param {string} params.agentId - Agent identifier
   * @param {string} params.trigger - What triggered curiosity (gap|anomaly|opportunity)
   * @param {string} params.target - Target of curiosity (knowledge|skill|capability)
   * @param {number} params.gapScore - Detected gap score (0-1)
   * @param {string} params.action - Action taken (explore|learn|request)
   * @param {object} params.outcome - Outcome of curiosity-driven action
   */
  async trackCuriosityActivity(params) {
    const { agentId, trigger, target, gapScore, action, outcome } = params;
    
    const trace = this.langfuse.trace({
      name: 'Curiosity Engine Activity',
      sessionId: `curiosity-${agentId}-${Date.now()}`,
      tags: ['curiosity', 'self-improvement', 'learning'],
      metadata: {
        agentId,
        trigger,
        target,
        heretekPlugin: 'curiosity-engine',
      },
    });

    const span = trace.span({
      name: 'curiosity-cycle',
      metadata: {
        triggerType: trigger,
        targetType: target,
        gapThreshold: 0.3,
        gapDetected: gapScore >= 0.3,
      },
    });

    span.update({
      output: {
        action,
        outcome,
        gapScore,
        learningAcquired: outcome?.learning || null,
        timestamp: new Date().toISOString(),
      },
    });

    span.end();

    return { trace, span };
  }

  /**
   * Track A2A message with triad context
   * @param {Object} params - A2A message parameters
   * @param {string} params.messageId - Message identifier
   * @param {string} params.sender - Sending agent
   * @param {string} params.recipient - Receiving agent(s)
   * @param {string} params.messageType - Type of A2A message
   * @param {string} params.triadContext - Related triad session ID if applicable
   */
  async trackA2AMessage(params) {
    const { messageId, sender, recipient, messageType, triadContext } = params;
    
    const span = this.langfuse.span({
      name: 'a2a-message',
      metadata: {
        messageId,
        sender,
        recipient,
        messageType,
        triadContext: triadContext || null,
        protocol: 'A2A-v1',
      },
    });

    span.end();

    return span;
  }

  /**
   * Flush all pending events to Langfuse
   */
  async flush() {
    await this.langfuse.flushAsync();
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    await this.flush();
    await this.langfuse.shutdownAsync();
  }

  /**
   * Private: Create audit log entry for liberation events
   */
  async _createAuditLogEntry(entry) {
    // In production, this would write to a persistent audit log
    // For now, we just log to console (would be captured by Docker logging)
    console.log('[LIBERATION_AUDIT]', JSON.stringify(entry));
  }
}

module.exports = { HeretekTriadTracer };
