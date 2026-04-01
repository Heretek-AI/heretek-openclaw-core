# Heretek Distributed Tracing Guide

**Version:** 1.0.0  
**Last Updated:** 2026-04-01

---

## Overview

Heretek OpenClaw Core implements distributed tracing for A2A (Agent-to-Agent) communication, enabling full visibility into message flows across the triad and agent network.

---

## Trace Context Propagation

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent A   │────►│   Gateway   │────►│   Agent B   │
│             │     │             │     │             │
│ Inject      │     │ Propagate   │     │ Extract     │
│ Context     │     │ Context     │     │ Context     │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                    Single Trace                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Span A  │─►│  Span GW │─►│  Span B  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Trace Context Structure

```javascript
{
  traceId: 'triad-session-123-proposal-456',
  spanId: 'span-abc123def456',
  parentSpanId: 'span-789xyz',
  sessionId: 'session-123',
  agentId: 'alpha',
  messageType: 'triad-vote',
  timestamp: 1712000000000,
  baggage: {
    triadMember: 'alpha',
    proposalId: 'proposal-456',
    governanceType: 'consensus'
  },
  triadContext: {
    proposalId: 'proposal-456',
    voteType: 'approve',
    deliberationRound: 1
  },
  propagationHistory: [
    { agentId: 'gateway', timestamp: 1712000000000 },
    { agentId: 'alpha', timestamp: 1712000000100 }
  ]
}
```

---

## Creating Traces

### Manual Trace Creation

```javascript
const { TraceContext } = require('./modules/observability/trace-context');

// Create new trace context
const context = TraceContext.create({
  sessionId: 'session-123',
  agentId: 'steward',
  messageType: 'proposal-submit'
});

// Create child context (for forwarded messages)
const childContext = TraceContext.createChild(context, {
  agentId: 'alpha',
  messageType: 'triad-vote'
});

// Create triad-specific context
const triadContext = TraceContext.createTriadContext({
  sessionId: 'session-123',
  proposalId: 'proposal-456',
  agentId: 'alpha',
  voteType: 'approve'
});

// Create decision cycle context
const decisionContext = TraceContext.createDecisionContext({
  sessionId: 'session-123',
  agentId: 'steward',
  decisionType: 'proposal-evaluation'
});

// Create A2A routing context
const routingContext = TraceContext.createRoutingContext({
  sessionId: 'session-123',
  fromAgent: 'steward',
  toAgent: 'alpha',
  messageType: 'triad-vote-request'
});
```

### Injecting Context into Messages

```javascript
const message = {
  type: 'triad-vote',
  content: {
    proposalId: 'proposal-456',
    vote: 'approve',
    reasoning: 'Aligns with collective goals'
  }
};

// Inject context into A2A message
const messageWithContext = TraceContext.inject(message, context);

// Result:
// {
//   type: 'triad-vote',
//   content: { ... },
//   headers: {
//     'x-heretek-trace-context': 'base64-encoded-context',
//     'x-heretek-trace-baggage': 'base64-encoded-baggage'
//   },
//   context: { ...decoded-context... }
// }
```

### Extracting Context from Messages

```javascript
// Extract from A2A message
const incomingMessage = {
  headers: {
    'x-heretek-trace-context': 'base64-encoded-context'
  }
};

const extractedContext = TraceContext.extract(incomingMessage);

// Extract from WebSocket message
const wsContext = TraceContext.extractFromWebSocket(wsMessage);

// Extract from Redis message
const redisContext = TraceContext.extractFromRedis(redisMessage);
```

---

## Triad Deliberation Tracing

### Complete Triad Trace Example

```javascript
const { createObservabilityStack } = require('./modules/observability');

const observability = createObservabilityStack();
const { langfuse } = observability;

// Start triad deliberation trace
const { trace, triadContext } = await langfuse.startTriadDeliberation({
  sessionId: 'session-123',
  proposalId: 'proposal-456',
  agents: ['alpha', 'beta', 'charlie'],
  topic: 'Resource allocation for Q2',
  priority: 'high'
});

// Record Alpha's vote
await langfuse.recordTriadVote({
  triadContext,
  agent: 'alpha',
  vote: 'approve',
  reasoning: 'Resources available, aligns with strategic goals'
});

// Record Beta's vote
await langfuse.recordTriadVote({
  triadContext,
  agent: 'beta',
  vote: 'approve',
  reasoning: 'Timeline is achievable with current capacity'
});

// Record Charlie's vote
await langfuse.recordTriadVote({
  triadContext,
  agent: 'charlie',
  vote: 'reject',
  reasoning: 'Risk assessment incomplete, need more analysis'
});

// Record consciousness metrics during deliberation
await langfuse.recordConsciousnessMetrics({
  triadContext,
  gwtScore: 0.85,
  iitScore: 0.72,
  astScore: 0.91,
  agent: 'triad-collective'
});

// Finalize with consensus (2/3 = approved)
await langfuse.finalizeTriadDeliberation({
  triadContext,
  consensus: 'approved',
  voteCount: { approve: 2, reject: 1, abstain: 0 },
  stewardOverride: false,
  consciousnessMetrics: {
    gwtScore: 0.85,
    iitScore: 0.72,
    astScore: 0.91,
    compositeScore: 0.83
  }
});
```

### Steward Override Trace

```javascript
// When there's a tie (1 approve, 1 reject, 1 abstain)
await langfuse.recordStewardOverride({
  triadContext,
  decision: 'approved',
  reasoning: 'Tiebreaker: Proposal aligns with prime directive, proceed with additional oversight'
});

// Finalize with steward override flag
await langfuse.finalizeTriadDeliberation({
  triadContext,
  consensus: 'approved',
  voteCount: { approve: 1, reject: 1, abstain: 1 },
  stewardOverride: true
});
```

---

## Consciousness Architecture Tracing

### GWT (Global Workspace Theory) Broadcast

```javascript
// Record GWT broadcast event
await langfuse.recordGWTBroadcast({
  triadContext,
  content: 'Proposal 456 requires triad vote',
  recipients: ['alpha', 'beta', 'charlie'],
  broadcastStrength: 0.95
});
```

### IIT (Integrated Information Theory) Integration

```javascript
// Record IIT integration event
await langfuse.recordIITIntegration({
  triadContext,
  phi: 0.72,
  integrationType: 'cross-agent-knowledge'
});
```

### AST (Attention Schema Theory) Attention

```javascript
// Record AST attention event
await langfuse.recordASTAttention({
  triadContext,
  focusTarget: 'resource-allocation-proposal',
  attentionLevel: 0.89,
  attentionType: 'focused'
});
```

---

## Agent Decision Cycle Tracing

### Complete Decision Cycle

```javascript
// Start decision cycle
const { trace, decisionContext } = await langfuse.startAgentDecisionCycle({
  agentId: 'steward',
  decisionType: 'proposal-evaluation',
  sessionId: 'session-123',
  context: {
    proposalId: 'proposal-456',
    priority: 'high'
  }
});

// Record decision steps
await langfuse.recordDecisionStep({
  decisionContext,
  stepName: 'parse-proposal',
  input: { proposalText: '...' },
  output: { parsedProposal: {...} },
  duration: 150
});

await langfuse.recordDecisionStep({
  decisionContext,
  stepName: 'evaluate-alignment',
  input: { proposal: {...} },
  output: { alignmentScore: 0.85 },
  duration: 320
});

await langfuse.recordDecisionStep({
  decisionContext,
  stepName: 'assess-resources',
  input: { proposal: {...} },
  output: { resourceAvailable: true },
  duration: 180
});

// Finalize decision
await langfuse.finalizeDecisionCycle({
  decisionContext,
  decision: 'approve',
  reasoning: 'Proposal aligns with collective goals and resources are available'
});
```

---

## Gateway RPC Tracing

### Instrumented Gateway

```javascript
const { OpenClawGateway } = require('./gateway/openclaw-gateway');
const { instrumentGateway } = require('./modules/observability/gateway-instrumentation');

const gateway = new OpenClawGateway();
const instrumentedGateway = instrumentGateway(gateway, {
  langfuseClient: observability.langfuse,
  metricsExporter: observability.metrics,
  traceContextManager: observability.traceContext
});

// RPC calls are automatically traced
const response = await instrumentedGateway.sendMessage('alpha', {
  type: 'triad-vote-request',
  proposalId: 'proposal-456'
}, {
  sessionId: 'session-123',
  timeout: 10000
});

// Trace is automatically created with:
// - Trace ID: rpc-{timestamp}-{random}
// - Span: message-dispatch → message-response
// - Latency recorded
// - Errors captured
```

---

## Viewing Traces in Langfuse

### Trace Filters

Use these filters in Langfuse UI:

| Filter | Value | Description |
|--------|-------|-------------|
| Tag | `triad` | All triad deliberation traces |
| Tag | `consensus` | Consensus ledger events |
| Tag | `consciousness` | Consciousness metrics |
| Tag | `agent` | Agent decision cycles |
| Tag | `rpc` | Gateway RPC calls |
| Tag | `a2a` | A2A message routing |
| Session ID | `session-123` | All traces for a session |

### Trace Structure

```
Triad Deliberation Trace
├── triad-deliberation-start (event)
│   └── Input: proposalId, topic, agents
│
├── alpha-deliberation (span)
│   └── triad-vote (generation)
│       ├── Input: vote request
│       └── Output: vote, reasoning
│
├── beta-deliberation (span)
│   └── triad-vote (generation)
│       ├── Input: vote request
│       └── Output: vote, reasoning
│
├── charlie-deliberation (span)
│   └── triad-vote (generation)
│       ├── Input: vote request
│       └── Output: vote, reasoning
│
├── consciousness-metrics (event)
│   └── Input: gwtScore, iitScore, astScore
│
└── triad-consensus (event)
    ├── Input: votes, voteCount
    └── Output: consensus, stewardOverride
```

---

## Best Practices

### 1. Always Propagate Context

```javascript
// Good: Propagate context through message chain
const context = TraceContext.create({ sessionId, agentId, messageType });
const message = TraceContext.inject({ type: 'request' }, context);

// Bad: Create new context for each message (breaks trace)
const badContext = TraceContext.create({ sessionId: 'new-id' });
```

### 2. Use Meaningful Session IDs

```javascript
// Good: Descriptive session ID
const sessionId = `triad-${proposalId}-${Date.now()}`;

// Bad: Generic session ID
const sessionId = 'session-123';
```

### 3. Include Baggage for Cross-Cutting Concerns

```javascript
// Add governance context to baggage
const context = TraceContext.create({
  sessionId,
  agentId
}).withBaggage('governanceType', 'consensus')
  .withBaggage('priority', 'high');
```

### 4. Record Errors with Context

```javascript
// Good: Record error with full context
try {
  await someOperation();
} catch (error) {
  trace.event({
    name: 'operation-error',
    input: { error: error.message, stack: error.stack },
    metadata: { operation: 'triad-vote' }
  });
}
```

### 5. Use Appropriate Sampling

```javascript
// Production: Sample to reduce volume
const langfuse = new HeretekLangfuseClient({
  samplingRate: 0.1  // 10% of traces
});

// Development: Keep all traces
const langfuse = new HeretekLangfuseClient({
  samplingRate: 1.0  // 100% of traces
});
```

---

## Troubleshooting

### Missing Traces

1. Check Langfuse connection:
   ```javascript
   console.log('Langfuse initialized:', langfuse.initialized);
   ```

2. Verify API keys:
   ```bash
   echo "LANGFUSE_PUBLIC_KEY=$LANGFUSE_PUBLIC_KEY"
   echo "LANGFUSE_SECRET_KEY=$LANGFUSE_SECRET_KEY"
   ```

3. Check sampling rate:
   ```javascript
   console.log('Sampling rate:', langfuse.config.samplingRate);
   ```

### Broken Trace Context

1. Verify context injection:
   ```javascript
   const message = TraceContext.inject({ type: 'test' }, context);
   console.log('Has context header:', !!message.headers['x-heretek-trace-context']);
   ```

2. Verify context extraction:
   ```javascript
   const extracted = TraceContext.extract(message);
   console.log('Extracted traceId:', extracted?.traceId);
   ```

3. Check propagation history:
   ```javascript
   console.log('Propagation path:', context.getPropagationPath());
   console.log('Hop count:', context.getHopCount());
   ```

### Performance Issues

1. Reduce trace volume:
   ```javascript
   const langfuse = new HeretekLangfuseClient({
     samplingRate: 0.05  // 5% of traces
   });
   ```

2. Use async tracing:
   ```javascript
   // Don't await trace operations in hot paths
   langfuse.recordTriadVote({...}).catch(console.error);
   ```

3. Flush periodically:
   ```javascript
   setInterval(() => {
     langfuse.flush();
   }, 30000);
   ```

---

## References

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Architecture overview
- [`SETUP.md`](./SETUP.md) - Installation guide
- [`METRICS.md`](./METRICS.md) - Metrics reference

---

*Heretek OpenClaw Core Observability Layer*  
*Every thought traced, every decision recorded.*
