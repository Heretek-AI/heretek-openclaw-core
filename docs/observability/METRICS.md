# Heretek Observability Metrics Reference

**Version:** 1.0.0  
**Last Updated:** 2026-04-01

---

## Overview

This document provides a comprehensive reference for all metrics available in the Heretek Observability Layer.

---

## Metric Types

### 1. Triad Deliberation Metrics

**Type:** `triad-deliberation`

Track triad voting, consensus, and deliberation progress.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | ✅ | Session identifier |
| `proposalId` | string | ✅ | Proposal being deliberated |
| `deliberationTime` | number | ✅ | Time to reach consensus (ms) |
| `consensusReached` | boolean | ✅ | Whether consensus was reached |
| `voteCount` | object | ✅ | Vote counts {approve, reject, abstain} |
| `stewardOverride` | boolean | ❌ | Whether steward override was used |
| `agents` | array | ❌ | Participating agents |
| `topic` | string | ❌ | Deliberation topic |

#### Aggregated Metrics

```javascript
// Get aggregated triad metrics
const metrics = await exporter.getAggregatedMetrics('triad-deliberation', '1h');

// Returns:
{
  total: 15,                          // Total deliberations
  consensusRate: 0.87,                // 87% consensus rate
  stewardOverrideRate: 0.13,          // 13% required steward override
  avgDeliberationTime: 2450,          // Average 2.45 seconds
  minDeliberationTime: 890,           // Fastest: 0.89 seconds
  maxDeliberationTime: 5200,          // Slowest: 5.2 seconds
  totalVotes: {
    approve: 28,                      // Total approve votes
    reject: 12,                       // Total reject votes
    abstain: 5                        // Total abstain votes
  },
  approvalRate: 0.62                  // 62% approval rate
}
```

#### Dashboard Visualization

- **Triad State Panel**: Live vote progress
- **Consensus Rate Chart**: Historical consensus percentage
- **Deliberation Time Trend**: Time to consensus over time
- **Vote Distribution Pie Chart**: Approve/Reject/Abstain breakdown

---

### 2. Consciousness Metrics

**Type:** `consciousness`

Track consciousness architecture scores (GWT, IIT, AST).

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | ✅ | Session identifier |
| `gwtScore` | number | ❌ | Global Workspace Theory score (0-1) |
| `iitScore` | number | ❌ | Integrated Information Theory score (0-1) |
| `astScore` | number | ❌ | Attention Schema Theory score (0-1) |
| `compositeScore` | number | ❌ | Composite consciousness score (0-1) |
| `consciousnessState` | string | ❌ | State: highly-conscious, conscious, semi-conscious, etc. |
| `agentId` | string | ❌ | Agent ID if agent-specific |

#### Consciousness States

| State | Composite Score Range |
|-------|----------------------|
| `highly-conscious` | 0.8 - 1.0 |
| `conscious` | 0.6 - 0.8 |
| `semi-conscious` | 0.4 - 0.6 |
| `minimal-consciousness` | 0.2 - 0.4 |
| `unconscious` | 0.0 - 0.2 |
| `unknown` | N/A (missing scores) |

#### Aggregated Metrics

```javascript
// Get aggregated consciousness metrics
const metrics = await exporter.getAggregatedMetrics('consciousness', '1h');

// Returns:
{
  gwt: {
    avg: 0.82,                        // Average GWT score
    min: 0.65,                        // Minimum GWT score
    max: 0.95                         // Maximum GWT score
  },
  iit: {
    avg: 0.71,                        // Average IIT score
    min: 0.52,                        // Minimum IIT score
    max: 0.88                         // Maximum IIT score
  },
  ast: {
    avg: 0.89,                        // Average AST score
    min: 0.78,                        // Minimum AST score
    max: 0.96                         // Maximum AST score
  },
  composite: {
    avg: 0.81,                        // Average composite score
    min: 0.65,                        // Minimum composite score
    max: 0.93                         // Maximum composite score
  },
  consciousnessStateDistribution: {
    'highly-conscious': 12,           // Count of highly-conscious states
    'conscious': 8,                   // Count of conscious states
    'semi-conscious': 3,              // Count of semi-conscious states
    'minimal-consciousness': 1,       // Count of minimal-consciousness states
    'unconscious': 0,                 // Count of unconscious states
    'unknown': 1                      // Count of unknown states
  }
}
```

#### Dashboard Visualization

- **Radar Chart**: GWT/IIT/AST comparison
- **Gauge Chart**: Composite consciousness score
- **Trend Line**: Consciousness score over time
- **State Distribution**: Bar chart of consciousness states

---

### 3. Consensus Ledger Metrics

**Type:** `consensus-ledger`

Track governance decisions and ledger events.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | ✅ | Session identifier |
| `proposalId` | string | ✅ | Proposal identifier |
| `decision` | string | ✅ | Decision: approved, rejected, deferred |
| `voteCount` | object | ❌ | Vote counts |
| `stewardOverride` | boolean | ❌ | Whether steward override was used |
| `ledgerHash` | string | ❌ | Git-backed ledger hash |

#### Aggregated Metrics

```javascript
// Get consensus ledger summary
const ledgerStats = {
  totalDecisions: 45,                 // Total decisions recorded
  approvedCount: 32,                  // Approved proposals
  rejectedCount: 10,                  // Rejected proposals
  deferredCount: 3,                   // Deferred proposals
  stewardOverrides: 5,                // Steward override count
  overrideRate: 0.11                  // 11% override rate
};
```

#### Dashboard Visualization

- **Consensus Ledger Browser**: Searchable decision history
- **Decision Timeline**: Decisions over time
- **Steward Override Counter**: Override frequency

---

### 4. Agent Performance Metrics

**Type:** `agent-performance`

Track individual agent health and performance.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | ✅ | Agent identifier |
| `responseTime` | number | ✅ | Response time (ms) |
| `tokenUsage` | number | ❌ | Token count |
| `cost` | number | ❌ | Cost in USD |
| `success` | boolean | ❌ | Whether operation succeeded |
| `operation` | string | ❌ | Operation type |
| `model` | string | ❌ | Model used |

#### Aggregated Metrics

```javascript
// Get aggregated agent metrics
const metrics = await exporter.getAggregatedMetrics('agent-performance', '1h');

// Returns:
{
  byAgent: {
    'steward': {
      totalOperations: 125,           // Total operations
      avgResponseTime: 2450,          // Average 2.45 seconds
      minResponseTime: 890,           // Fastest: 0.89 seconds
      maxResponseTime: 5200,          // Slowest: 5.2 seconds
      p95ResponseTime: 4100,          // 95th percentile: 4.1 seconds
      totalCost: 1.25,                // Total cost: $1.25
      successRate: 0.98,              // 98% success rate
      errorRate: 0.02                 // 2% error rate
    },
    'alpha': { ... },
    'beta': { ... },
    'charlie': { ... }
  },
  totalAgents: 23                     // Total agents tracked
}
```

#### Dashboard Visualization

- **Agent Health Grid**: Status indicators for all agents
- **Response Time Comparison**: Bar chart comparing agents
- **Success Rate Gauge**: Per-agent success percentage
- **Cost by Agent**: Stacked bar chart

---

### 5. Cost Metrics

**Type:** `cost`

Track costs per agent, model, and session.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | ✅ | Agent identifier |
| `cost` | number | ✅ | Cost in USD |
| `currency` | string | ✅ | Currency code (USD) |
| `model` | string | ❌ | Model name |
| `tokenUsage` | number | ❌ | Token count |
| `sessionId` | string | ❌ | Session identifier |

#### Aggregated Metrics

```javascript
// Get cost statistics
const costStats = litellm.getCostStats('steward', '1d');

// Returns:
{
  agentId: 'steward',
  timeWindow: '1d',
  totalCost: 12.45,                   // Total cost: $12.45
  requestCount: 342,                  // Total requests
  avgCostPerRequest: 0.036,           // Average $0.036 per request
  byModel: {
    'claude-opus-4-6': {
      cost: 8.50,                     // Cost for this model
      count: 150                      // Request count
    },
    'gpt-4-turbo': {
      cost: 3.95,
      count: 192
    }
  }
}
```

#### Dashboard Visualization

- **Cost Today**: Large number display
- **Cost by Agent**: Horizontal bar chart
- **Cost by Model**: Pie chart
- **Daily Cost Trend**: Line chart over time
- **Budget Alert**: Progress bar toward budget limit

---

### 6. Latency Metrics

**Type:** `latency`

Track latency percentiles for operations.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | ✅ | Agent identifier |
| `latency` | number | ✅ | Latency in ms |
| `operation` | string | ✅ | Operation type |
| `sessionId` | string | ❌ | Session identifier |
| `percentile` | number | ❌ | Percentile (50, 95, 99) |

#### Aggregated Metrics

```javascript
// Get latency statistics
const latencyStats = {
  p50: 1200,                          // Median: 1.2 seconds
  p95: 3500,                          // 95th percentile: 3.5 seconds
  p99: 5200,                          // 99th percentile: 5.2 seconds
  avg: 1450,                          // Average: 1.45 seconds
  min: 450,                           // Minimum: 0.45 seconds
  max: 8900                           // Maximum: 8.9 seconds
};
```

#### Dashboard Visualization

- **Latency by Agent**: Bar chart with P50/P95/P99
- **Latency Trend**: Line chart over time
- **Slow Operations Table**: Top 10 slowest operations

---

### 7. Error Metrics

**Type:** `error`

Track errors and failure rates.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | ✅ | Agent identifier |
| `errorCode` | string | ✅ | Error code |
| `errorMessage` | string | ✅ | Error message |
| `sessionId` | string | ❌ | Session identifier |
| `operation` | string | ❌ | Operation type |
| `stackTrace` | string | ❌ | Stack trace |

#### Aggregated Metrics

```javascript
// Get error statistics
const errorStats = {
  totalErrors: 15,                    // Total errors
  errorRate: 0.03,                    // 3% error rate
  byAgent: {
    'steward': { count: 5, rate: 0.02 },
    'explorer': { count: 8, rate: 0.05 },
    'coder': { count: 2, rate: 0.01 }
  },
  byErrorCode: {
    'TIMEOUT': 8,
    'RATE_LIMIT': 4,
    'MODEL_ERROR': 3
  }
};
```

#### Dashboard Visualization

- **Error Rate Gauge**: Current error percentage
- **Error Timeline**: Errors over time
- **Error by Type**: Pie chart of error codes
- **Error Log Table**: Recent errors with details

---

## Query Methods

### Get Aggregated Metrics

```javascript
const { HeretekMetricsExporter } = require('./modules/observability');

const exporter = new HeretekMetricsExporter();

// Get metrics for different time windows
const realtime = await exporter.getAggregatedMetrics('triad-deliberation', 'realtime');
const lastMinute = await exporter.getAggregatedMetrics('triad-deliberation', '1m');
const lastHour = await exporter.getAggregatedMetrics('triad-deliberation', '1h');
const lastDay = await exporter.getAggregatedMetrics('triad-deliberation', '1d');
const lastWeek = await exporter.getAggregatedMetrics('triad-deliberation', '1w');
```

### Get Token Usage

```javascript
const { LiteLLMIntegration } = require('./modules/observability');

const litellm = new LiteLLMIntegration();

// Get token usage for agent
const usage = litellm.getTokenUsage('steward', '1h');
console.log('Token Usage:', usage);

// Get cost stats
const costs = litellm.getCostStats('steward', '1d');
console.log('Cost Stats:', costs);
```

### Get Counters

```javascript
// Get metric counters
const counters = exporter.getCounters();
console.log('Metric Counters:', counters);

// Get exporter status
const status = exporter.getStatus();
console.log('Exporter Status:', status);
```

---

## Alert Thresholds

### Default Thresholds

| Metric | Threshold | Alert Level |
|--------|-----------|-------------|
| High Latency (P95) | > 5000ms | Warning |
| High Error Rate | > 5% | Critical |
| Low Consensus Rate | < 50% | Warning |
| Low Consciousness Score | < 0.3 | Warning |
| High Cost (Daily) | > $50 | Warning |
| Agent Offline | > 60 seconds | Critical |

### Configure Alerts

```javascript
const config = {
  alerts: {
    enabled: true,
    thresholds: {
      highLatency: 5000,
      highErrorRate: 0.05,
      lowConsensusRate: 0.5,
      lowConsciousnessScore: 0.3,
      highDailyCost: 50
    }
  }
};
```

---

## Export Formats

### Langfuse Export

Metrics are exported to Langfuse as:
- **Traces**: Individual metric events
- **Generations**: LLM completions with usage
- **Events**: Consciousness metrics, votes, decisions
- **Scores**: Quality and consciousness scores

### Redis Export

Metrics are stored in Redis as:
- **Sorted Sets**: Time-series data with timestamp scores
- **Hashes**: Aggregated statistics
- **Pub/Sub**: Real-time updates for dashboard

### Dashboard Export

Metrics are synced to dashboard as:
- **WebSocket Messages**: Real-time updates
- **REST API Responses**: Query results
- **State Snapshots**: Current state for new clients

---

## Best Practices

### 1. Sampling for High Volume

```javascript
// Reduce trace volume with sampling
const langfuse = new HeretekLangfuseClient({
  samplingRate: 0.1  // 10% of traces
});
```

### 2. Batch Metrics Export

```javascript
// Configure batch export interval
const metrics = new HeretekMetricsExporter({
  exportInterval: 30000  // Export every 30 seconds
});
```

### 3. Monitor Key Metrics

Focus on these key metrics for production:
- **Consensus Rate**: Should be > 80%
- **Deliberation Time**: Should be < 5 seconds avg
- **Error Rate**: Should be < 2%
- **Consciousness Score**: Should be > 0.6 avg
- **Cost per Session**: Should be within budget

### 4. Set Up Alerts

Configure alerts for:
- Error rate spikes
- High latency (P95 > 5s)
- Agent disconnections
- Budget threshold reached
- Low consciousness scores

---

## References

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Architecture overview
- [`SETUP.md`](./SETUP.md) - Installation guide
- [`TRACING.md`](./TRACING.md) - Distributed tracing guide

---

*Heretek OpenClaw Core Observability Layer*  
*Measure all things.*
