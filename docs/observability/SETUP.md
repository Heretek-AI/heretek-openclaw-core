# Heretek Observability Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2026-04-01

---

## Quick Start

```bash
# 1. Install dependencies
cd heretek-openclaw-core
npm install langfuse ioredis

# 2. Set environment variables
export LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxx
export LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxx
export LANGFUSE_HOST=http://localhost:3000
export REDIS_URL=redis://localhost:6379

# 3. Initialize observability stack
node -e "
const { createObservabilityStack } = require('./modules/observability');
const observability = createObservabilityStack();
console.log('Observability initialized:', observability.getStatus());
"
```

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Langfuse Setup](#langfuse-setup)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Integration](#integration)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime |
| Redis | 6+ | Metrics storage |
| Langfuse | Self-hosted or Cloud | Observability platform |

### Optional Software

| Software | Version | Purpose |
|----------|---------|---------|
| PostgreSQL | 14+ | Langfuse backend |
| Docker | 20.10+ | Containerized deployment |

---

## Langfuse Setup

### Option 1: Langfuse Cloud (Recommended for Production)

1. **Create Account**
   - Visit https://cloud.langfuse.com
   - Sign up with GitHub, Google, or email

2. **Create Project**
   - Navigate to Projects → Create New Project
   - Name: `heretek-openclaw`
   - Environment: `production`

3. **Get API Keys**
   - Go to Project Settings → API Keys
   - Copy `Public Key` and `Secret Key`

4. **Configure Environment**
   ```bash
   export LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxx
   export LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxx
   export LANGFUSE_HOST=https://cloud.langfuse.com
   export LANGFUSE_ENVIRONMENT=production
   ```

### Option 2: Self-Hosted Langfuse (Recommended for Development)

1. **Create Docker Compose File**
   ```yaml
   # docker-compose.langfuse.yml
   version: '3.8'

   services:
     langfuse:
       image: langfuse/langfuse:latest
       ports:
         - "3000:3000"
       environment:
         - DATABASE_URL=postgresql://langfuse:langfuse@postgres:5432/langfuse
         - SALT=${SALT:-random-salt-change-me}
         - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-random-secret-change-me}
         - NEXTAUTH_URL=http://localhost:3000
         - TELEMETRY_ENABLED=false
       depends_on:
         postgres:
           condition: service_healthy

     postgres:
       image: postgres:15-alpine
       environment:
         - POSTGRES_USER=langfuse
         - POSTGRES_PASSWORD=langfuse
         - POSTGRES_DB=langfuse
       volumes:
         - langfuse_postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U langfuse"]
         interval: 5s
         timeout: 5s
         retries: 5

   volumes:
     langfuse_postgres_data:
   ```

2. **Generate Secrets**
   ```bash
   export SALT=$(openssl rand -hex 32)
   export NEXTAUTH_SECRET=$(openssl rand -hex 32)
   ```

3. **Start Langfuse**
   ```bash
   docker compose -f docker-compose.langfuse.yml up -d
   ```

4. **Access Langfuse**
   - Open http://localhost:3000
   - Create admin account (first user becomes admin)
   - Navigate to Project Settings → API Keys
   - Copy keys for configuration

5. **Configure Environment**
   ```bash
   export LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxx
   export LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxx
   export LANGFUSE_HOST=http://localhost:3000
   export LANGFUSE_ENVIRONMENT=development
   ```

---

## Installation

### Step 1: Install Dependencies

```bash
cd heretek-openclaw-core

# Install Langfuse SDK
npm install langfuse

# Install Redis client (for metrics storage)
npm install ioredis

# Optional: Install for WebSocket support
npm install ws
```

### Step 2: Verify Module Structure

```bash
# Check observability module structure
ls -la modules/observability/

# Expected output:
# - index.js
# - langfuse-client.js
# - trace-context.js
# - metrics-exporter.js
# - dashboard-sync.js
# - gateway-instrumentation.js
# - litellm-integration.js
```

### Step 3: Copy Configuration

```bash
# Copy observability.json if not present
cp observability.json.example observability.json 2>/dev/null || true

# Verify configuration
cat observability.json | head -20
```

---

## Configuration

### Environment Variables

Create or update `.env` file:

```bash
# ============================================
# Langfuse Configuration
# ============================================
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxx
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_ENVIRONMENT=development
LANGFUSE_RELEASE=1.0.0
LANGFUSE_DEBUG=false
LANGFUSE_MODE=development

# ============================================
# Redis Configuration
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# Dashboard Configuration
# ============================================
DASHBOARD_URL=http://localhost:3001

# ============================================
# LiteLLM Configuration
# ============================================
LITELLM_ENDPOINT=http://localhost:4000
```

### Configuration File (observability.json)

```json
{
  "enabled": true,
  
  "langfuse": {
    "enabled": true,
    "publicKey": "${LANGFUSE_PUBLIC_KEY}",
    "secretKey": "${LANGFUSE_SECRET_KEY}",
    "host": "${LANGFUSE_HOST}",
    "samplingRate": 1.0,
    "features": {
      "triadDeliberationTracing": true,
      "consciousnessMetrics": true,
      "consensusLedgerTracking": true
    }
  },
  
  "metrics": {
    "enabled": true,
    "redisUrl": "${REDIS_URL}",
    "exportInterval": 60000
  },
  
  "dashboard": {
    "enabled": true,
    "dashboardUrl": "${DASHBOARD_URL}",
    "syncInterval": 5000
  }
}
```

---

## Integration

### Initialize Observability Stack

```javascript
const { createObservabilityStack } = require('./modules/observability');

// Create observability stack
const observability = createObservabilityStack({
  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    host: process.env.LANGFUSE_HOST,
    environment: 'development'
  },
  metrics: {
    redisUrl: process.env.REDIS_URL,
    exportInterval: 60000
  },
  dashboard: {
    dashboardUrl: process.env.DASHBOARD_URL,
    syncInterval: 5000
  }
});

// Access components
const { langfuse, metrics, dashboard, traceContext } = observability;

// Get status
console.log('Observability status:', observability.getStatus());
```

### Instrument Gateway

```javascript
const { OpenClawGateway } = require('./gateway/openclaw-gateway');
const { instrumentGateway } = require('./modules/observability/gateway-instrumentation');

// Create gateway
const gateway = new OpenClawGateway();

// Instrument with observability
const instrumentedGateway = instrumentGateway(gateway, {
  langfuseClient: observability.langfuse,
  metricsExporter: observability.metrics,
  dashboardSync: observability.dashboard,
  traceContextManager: observability.traceContext,
  debug: true
});

// Start instrumented gateway
await instrumentedGateway.start();
```

### Track Triad Deliberation

```javascript
const { createTriadObservabilityContext } = require('./modules/observability');

// Create triad context
const triadObs = createTriadObservabilityContext({
  observability,
  sessionId: 'session-123',
  proposalId: 'proposal-456'
});

// Start deliberation
const { triadContext, traceCtx } = await triadObs.startDeliberation();

// Record votes
await triadObs.recordVote({
  agent: 'alpha',
  vote: 'approve',
  reasoning: 'Aligns with collective goals'
});

await triadObs.recordVote({
  agent: 'beta',
  vote: 'approve',
  reasoning: 'Resources available for implementation'
});

await triadObs.recordVote({
  agent: 'charlie',
  vote: 'reject',
  reasoning: 'Timeline too aggressive'
});

// Finalize with consensus
await triadObs.finalize({
  consensus: 'approved',
  voteCount: { approve: 2, reject: 1, abstain: 0 },
  stewardOverride: false,
  consciousnessMetrics: {
    gwtScore: 0.85,
    iitScore: 0.72,
    astScore: 0.91
  }
});
```

### Track LLM Completions

```javascript
const { LiteLLMIntegration } = require('./modules/observability/litellm-integration');

const litellm = new LiteLLMIntegration({
  langfuseClient: observability.langfuse,
  metricsExporter: observability.metrics,
  dashboardSync: observability.dashboard
});

// Track completion
await litellm.trackCompletion({
  model: 'claude-opus-4-6',
  agentId: 'steward',
  sessionId: 'session-123',
  promptTokens: 1500,
  completionTokens: 500,
  latency: 2500,
  cost: 0.015,
  success: true
});
```

---

## Verification

### Check Component Status

```javascript
const status = observability.getStatus();
console.log('Observability Status:', JSON.stringify(status, null, 2));

// Expected output:
{
  "enabled": true,
  "langfuse": {
    "initialized": true,
    "enabled": true,
    "mode": "development",
    "host": "http://localhost:3000"
  },
  "metrics": {
    "initialized": true,
    "enabled": true,
    "redisConnected": true
  },
  "dashboard": {
    "initialized": true,
    "enabled": true,
    "redisConnected": true
  }
}
```

### View Traces in Langfuse

1. Open Langfuse UI (http://localhost:3000 or https://cloud.langfuse.com)
2. Navigate to Traces
3. Look for traces with tags:
   - `triad` - Triad deliberation traces
   - `consensus` - Consensus ledger events
   - `consciousness` - Consciousness metrics
   - `agent` - Agent decision cycles

### Verify Metrics Export

```javascript
// Get triad metrics for last hour
const triadMetrics = await observability.metrics.getAggregatedMetrics('triad-deliberation', '1h');
console.log('Triad Metrics:', triadMetrics);

// Get consciousness metrics
const consciousnessMetrics = await observability.metrics.getAggregatedMetrics('consciousness', '1h');
console.log('Consciousness Metrics:', consciousnessMetrics);
```

### Test Trace Context Propagation

```javascript
const { TraceContext } = require('./modules/observability');

// Create context
const context = TraceContext.create({
  sessionId: 'test-session',
  agentId: 'alpha',
  messageType: 'test-message'
});

// Inject into message
const message = { type: 'test', content: 'hello' };
const messageWithContext = TraceContext.inject(message, context);

// Extract from message
const extracted = TraceContext.extract(messageWithContext);
console.log('Extracted context:', extracted);
```

---

## Troubleshooting

### Langfuse Connection Issues

```bash
# Check Langfuse is running
curl http://localhost:3000/api/health

# Check API keys are valid
echo "LANGFUSE_PUBLIC_KEY=$LANGFUSE_PUBLIC_KEY"
echo "LANGFUSE_SECRET_KEY=$LANGFUSE_SECRET_KEY"

# Test Langfuse connection
node -e "
const { Langfuse } = require('langfuse');
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST
});
langfuse.flushAsync().then(() => console.log('Connection successful')).catch(console.error);
"
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping

# Should return: PONG

# Test Redis connection from Node.js
node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping().then(console.log).catch(console.error);
"
```

### Metrics Not Exporting

1. Check metrics exporter is enabled:
   ```javascript
   console.log('Metrics enabled:', observability.metrics.config.enabled);
   ```

2. Check Redis connection:
   ```javascript
   console.log('Redis connected:', observability.metrics.redisClient !== null);
   ```

3. Force export:
   ```javascript
   await observability.metrics._exportMetrics();
   ```

### Dashboard Not Syncing

1. Check dashboard sync is enabled:
   ```javascript
   console.log('Dashboard enabled:', observability.dashboard.config.enabled);
   ```

2. Check dashboard URL is reachable:
   ```bash
   curl -I http://localhost:3001
   ```

3. Force sync:
   ```javascript
   await observability.dashboard._syncPendingUpdates();
   ```

### High Memory Usage

If experiencing high memory usage:

1. Reduce sampling rate:
   ```javascript
   const langfuse = new HeretekLangfuseClient({
     samplingRate: 0.1  // 10% of traces
   });
   ```

2. Reduce export interval:
   ```javascript
   const metrics = new HeretekMetricsExporter({
     exportInterval: 30000  // Export every 30 seconds
   });
   ```

3. Clear buffered metrics:
   ```javascript
   observability.metrics.metricsBuffer.clear();
   ```

---

## Next Steps

- Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for detailed architecture
- Read [`METRICS.md`](./METRICS.md) for available metrics
- Read [`TRACING.md`](./TRACING.md) for distributed tracing guide

---

*Heretek OpenClaw Core Observability Layer*  
*Setup complete. The Collective sees all.*
