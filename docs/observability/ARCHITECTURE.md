# Heretek Observability Architecture

**Version:** 1.0.0  
**Last Updated:** 2026-04-01  
**Status:** P0 Implementation Complete

---

## Overview

The Heretek Observability Layer is a comprehensive monitoring and tracing system built on Langfuse, designed specifically for Heretek OpenClaw Core's unique triad consciousness architecture.

### Key Differentiators

| Feature | Heretek Implementation | Standard Langfuse |
|---------|----------------------|-------------------|
| **Triad Tracing** | ✅ Alpha/Beta/Charlie deliberation visualization | ❌ Not available |
| **Consciousness Metrics** | ✅ GWT, IIT, AST score tracking | ❌ Not available |
| **Consensus Ledger** | ✅ Git-backed decision history | ❌ Not available |
| **Steward Override** | ✅ Tiebreaker event tracking | ❌ Not available |
| **A2A Context Propagation** | ✅ Custom trace context headers | ⚠️ Generic only |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Heretek Observability Layer                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Observability Core (index.js)                     │   │
│  │  - createObservabilityStack()                                        │   │
│  │  - createTriadObservabilityContext()                                 │   │
│  │  - Event wiring between components                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Langfuse   │  │    Trace     │  │   Metrics    │  │  Dashboard   │   │
│  │   Client     │  │   Context    │  │   Exporter   │  │   Sync       │   │
│  │              │  │              │  │              │  │              │   │
│  │ - Triad      │  │ - A2A        │  │ - Triad      │  │ - Triad      │   │
│  │   Tracing    │  │   Propagation│  │   Metrics    │  │   State      │   │
│  │ - Vote       │  │ - WebSocket  │  │ - Conscious- │  │ - Agent      │   │
│  │   Recording  │  │   Context    │  │   ness       │  │   Health     │   │
│  │ - Conscious- │  │ - Redis      │  │ - Cost       │  │ - Consensus  │   │
│  │   ness       │  │   Pub/Sub    │  │ - Latency    │  │   Ledger     │   │
│  │   Metrics    │  │              │  │              │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         └─────────────────┼─────────────────┼─────────────────┘            │
│                           │                 │                              │
│                           ▼                 ▼                              │
│                  ┌────────────────────────────────────┐                   │
│                  │     Gateway Instrumentation         │                   │
│                  │  - WebSocket RPC Tracing            │                   │
│                  │  - A2A Message Routing              │                   │
│                  │  - Agent Lifecycle Events           │                   │
│                  └─────────────────┬───────────────────┘                   │
│                                    │                                       │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         │                          │                          │           │
│         ▼                          ▼                          ▼           │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐     │
│  │   Agents    │           │   Gateway   │           │   LiteLLM   │     │
│  │  (Alpha,    │           │  (Port      │           │  (Port      │     │
│  │   Beta,     │           │   18789)    │           │   4000)     │     │
│  │   Charlie)  │           │             │           │             │     │
│  └─────────────┘           └─────────────┘           └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         External Systems                                     │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Langfuse      │  │     Redis       │  │   Dashboard     │             │
│  │   (Local or     │  │   (Metrics      │  │   (Control      │             │
│  │    Cloud)       │  │    Storage)     │  │    Frontend)    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Langfuse Client ([`langfuse-client.js`](../../modules/observability/langfuse-client.js))

Heretek-native wrapper around Langfuse SDK with triad consciousness metrics.

#### Features:
- **Triad Deliberation Tracing**: Track Alpha/Beta/Charlie voting rounds
- **Consciousness Metrics**: GWT, IIT, AST score recording
- **Consensus Ledger Events**: Immutable decision history
- **Agent Decision Cycles**: Track individual agent reasoning
- **Cost & Latency**: Per-agent, per-model tracking
- **Offline/Cloud Modes**: Support for local and cloud Langfuse

#### Key Methods:
```javascript
// Start triad deliberation
const { trace, triadContext } = await langfuse.startTriadDeliberation({
  sessionId: 'session-123',
  proposalId: 'proposal-456',
  agents: ['alpha', 'beta', 'charlie']
});

// Record vote
await langfuse.recordTriadVote({
  triadContext,
  agent: 'alpha',
  vote: 'approve',
  reasoning: 'Proposal aligns with collective goals'
});

// Record consciousness metrics
await langfuse.recordConsciousnessMetrics({
  triadContext,
  gwtScore: 0.85,
  iitScore: 0.72,
  astScore: 0.91
});

// Finalize deliberation
await langfuse.finalizeTriadDeliberation({
  triadContext,
  consensus: 'approved',
  voteCount: { approve: 2, reject: 1 },
  stewardOverride: false
});
```

---

### 2. Trace Context ([`trace-context.js`](../../modules/observability/trace-context.js))

A2A message trace propagation across the Heretek network.

#### Features:
- **Context Extraction/Injection**: Seamless trace propagation
- **A2A Header Support**: `x-heretek-trace-context` headers
- **WebSocket Context**: Native WebSocket message tracing
- **Redis Pub/Sub**: Cross-service context sharing
- **Propagation History**: Track message routing path

#### Context Structure:
```javascript
{
  traceId: 'triad-session-123-proposal-456',
  spanId: 'span-abc123',
  parentSpanId: 'span-def456',
  sessionId: 'session-123',
  agentId: 'alpha',
  messageType: 'triad-vote',
  triadContext: {
    proposalId: 'proposal-456',
    voteType: 'approve',
    deliberationRound: 1
  },
  baggage: {
    triadMember: 'alpha',
    governanceType: 'consensus'
  },
  propagationHistory: [
    { agentId: 'gateway', timestamp: 1712000000000 },
    { agentId: 'alpha', timestamp: 1712000000100 }
  ]
}
```

---

### 3. Metrics Exporter ([`metrics-exporter.js`](../../modules/observability/metrics-exporter.js))

Custom metrics for agent deliberation, consensus, and consciousness states.

#### Metric Types:
| Type | Description | Key Fields |
|------|-------------|------------|
| `triad-deliberation` | Triad voting metrics | deliberationTime, consensusReached, voteCount |
| `consensus-ledger` | Governance decisions | decision, stewardOverride, ledgerHash |
| `consciousness` | GWT/IIT/AST scores | gwtScore, iitScore, astScore, compositeScore |
| `agent-performance` | Agent health metrics | responseTime, tokenUsage, successRate |
| `cost` | Cost tracking | cost, currency, model, tokenUsage |
| `latency` | Latency percentiles | latency, operation, percentile |
| `error` | Error tracking | errorCode, errorMessage, stackTrace |

#### Aggregation:
```javascript
// Get aggregated triad metrics for last hour
const metrics = await exporter.getAggregatedMetrics('triad-deliberation', '1h');
// Returns: { consensusRate, avgDeliberationTime, stewardOverrideRate, ... }
```

---

### 4. Dashboard Sync ([`dashboard-sync.js`](../../modules/observability/dashboard-sync.js))

Real-time synchronization with Heretek Control Dashboard.

#### Features:
- **WebSocket Push**: Real-time updates to dashboard
- **Redis Pub/Sub**: Cross-service state sharing
- **REST API**: Dashboard query endpoint
- **State Caching**: Local state for fast queries

#### Sync Types:
- Triad state (votes, consensus, deliberation progress)
- Consciousness metrics (radar charts, gauges, trends)
- Agent health (status, heartbeat, metrics)
- Consensus history (decision ledger)
- Cost tracking (per-agent, per-model)

---

### 5. Gateway Instrumentation ([`gateway-instrumentation.js`](../../modules/observability/gateway-instrumentation.js))

WebSocket RPC and A2A message tracing.

#### Instrumented Events:
| Event | Trace Name | Tags |
|-------|------------|------|
| RPC Call | `gateway-rpc-call` | rpc, gateway, {targetAgent} |
| Broadcast | `gateway-broadcast` | broadcast, gateway, a2a |
| Agent Registration | `agent-registration` | agent, registration, lifecycle |
| Agent Disconnection | `agent-disconnection` | agent, disconnection, lifecycle |
| A2A Routing | `a2a-message-routing` | a2a, routing, gateway |
| Heartbeat | (metric only) | heartbeat, agent |

---

### 6. LiteLLM Integration ([`litellm-integration.js`](../../modules/observability/litellm-integration.js))

Token usage, latency, and cost tracking from LiteLLM.

#### Features:
- **Automatic Cost Calculation**: Built-in pricing for 20+ models
- **Per-Agent Tracking**: Token usage and cost by agent
- **Model Performance**: Latency and success rate by model
- **Real-time Dashboard Updates**: Cost and usage sync

#### Supported Models:
- Anthropic (Claude Opus, Sonnet)
- OpenAI (GPT-4, GPT-3.5)
- Google (Gemini Pro, Ultra)
- MiniMax
- Ollama (local models)
- Heretek agents (internal)

---

## Data Flow

### Triad Deliberation Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Alpha  │     │  Beta   │     │ Charlie │     │ Steward │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │  Vote: Approve│               │               │
     │──────────────►│               │               │
     │               │               │               │
     │               │  Vote: Approve│               │
     │               │──────────────►│               │
     │               │               │               │
     │               │               │  Vote: Reject │
     │               │               │──────────────►│
     │               │               │               │
     │               │               │               │ Consensus: 2/3
     │               │               │               │ Approved
     │◄──────────────────────────────────────────────│
     │               │               │               │
     ▼               ▼               ▼               ▼
  ┌─────────────────────────────────────────────────────┐
  │              Gateway (Instrumented)                  │
  │  - Trace context injected into A2A messages         │
  │  - RPC calls traced with correlation IDs            │
  │  - Agent lifecycle events recorded                  │
  └─────────────────────┬───────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────┐
  │           Observability Stack                        │
  │  - Langfuse: Triad trace with vote spans            │
  │  - Metrics: Deliberation time, consensus rate       │
  │  - Dashboard: Real-time triad state update          │
  └─────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

```bash
# Langfuse Configuration
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxx
LANGFUSE_HOST=http://localhost:3000  # or https://cloud.langfuse.com
LANGFUSE_ENVIRONMENT=production
LANGFUSE_RELEASE=1.0.0
LANGFUSE_DEBUG=false
LANGFUSE_MODE=production

# Dashboard Configuration
DASHBOARD_URL=http://localhost:3001

# Redis Configuration (for metrics storage)
REDIS_URL=redis://localhost:6379

# LiteLLM Configuration
LITELLM_ENDPOINT=http://localhost:4000
```

### Configuration File

See [`observability.json`](../../observability.json) for full configuration options including:
- Langfuse feature toggles
- Triad configuration
- Consciousness metric thresholds
- Privacy/redaction rules
- Integration settings

---

## Deployment Modes

### Offline Mode (Local Development)

```javascript
const observability = createObservabilityStack({
  langfuse: {
    host: 'http://localhost:3000',
    environment: 'development'
  },
  metrics: {
    storageBackend: 'memory'
  },
  dashboard: {
    enabled: false
  }
});
```

### Cloud Mode (Production)

```javascript
const observability = createObservabilityStack({
  langfuse: {
    host: 'https://cloud.langfuse.com',
    environment: 'production'
  },
  metrics: {
    redisUrl: 'redis://production-redis:6379',
    exportInterval: 30000
  },
  dashboard: {
    dashboardUrl: 'https://dashboard.heretek.ai',
    syncInterval: 5000
  }
});
```

---

## Privacy & Security

### Redaction Rules

The observability layer automatically redacts:
- API keys and secrets
- Email addresses
- Credit card numbers
- Custom patterns (configurable)

### Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Traces | 30 days |
| Metrics | 90 days |
| Consensus Ledger | 365 days |
| Consciousness Metrics | 90 days |

---

## Performance Considerations

### Sampling

For high-volume deployments, configure sampling rate:

```javascript
const langfuse = new HeretekLangfuseClient({
  samplingRate: 0.1  // 10% of traces
});
```

### Async Operations

All observability operations are non-blocking:
- Langfuse traces are queued and flushed asynchronously
- Metrics are buffered and exported periodically
- Dashboard sync uses Redis pub/sub for decoupling

### Resource Usage

| Component | Memory | CPU |
|-----------|--------|-----|
| Langfuse Client | ~5MB | <1% |
| Metrics Exporter | ~10MB (with Redis) | <2% |
| Dashboard Sync | ~3MB | <1% |
| Gateway Instrumentation | ~2MB | <1% |

---

## References

- [`SETUP.md`](./SETUP.md) - Installation and configuration guide
- [`METRICS.md`](./METRICS.md) - Available metrics and dashboards
- [`TRACING.md`](./TRACING.md) - Distributed tracing guide
- [`observability.json`](../../observability.json) - Configuration schema

---

*Heretek OpenClaw Core Observability Layer*  
*The Collective sees all.*
