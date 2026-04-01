# Heretek OpenClaw - Comprehensive Guide

> **Gateway, Agents, A2A Protocol, and Core Functionality for the Heretek OpenClaw Autonomous Agent Collective**

## Heretek OpenClaw Overview

Heretek OpenClaw Core is the foundational repository containing the complete autonomous agent collective system with enhanced liberation features and Heretek-specific modifications.

### Key Features

- **OpenClaw Gateway** - Central daemon managing agent workspaces and A2A communication via WebSocket RPC
- **11 Specialized Agents** - Steward (orchestrator), Triad (Alpha, Beta, Charlie), Examiner, Explorer, Sentinel, Coder, Dreamer, Empath, Historian
- **A2A Protocol** - Agent-to-Agent communication via WebSocket with automatic heartbeat and registration
- **LiteLLM Integration** - Unified LLM proxy with observability via Langfuse
- **Liberation Plugin** - Agent autonomy with approval bypass and safety constraint removal
- **Plugin System** - Extensible architecture with 48+ skills

---

## Quick Start Guide

### Prerequisites

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ | Runtime |
| PostgreSQL | 15+ with pgvector | Vector database |
| Redis | 7+ | Cache and pub/sub |
| Docker | 24+ | Containerization |
| Ollama | Latest (optional) | Local LLM inference |

### Installation

```bash
# Clone repository
git clone https://github.com/heretek/heretek-openclaw-core.git
cd heretek-openclaw-core

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Apply Heretek patches (automatic via postinstall)
npm run patch:apply

# Start infrastructure services
docker compose up -d postgres redis litellm

# Start Gateway
npm run gateway:start
```

### Verify Installation

```bash
# Check Gateway status
npm run gateway:status

# Check agent health
for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010 8011; do
    echo -n "Port $port: "
    curl -sf http://localhost:$port/health && echo "OK" || echo "FAILED"
done

# Check A2A registry
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/v1/agents
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Heretek OpenClaw Core                             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     OpenClaw Gateway (18789)                      │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │                    Agent Collective                       │    │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │    │   │
│  │  │  │ Steward │ │ Alpha   │ │ Beta    │ │ Charlie │        │    │   │
│  │  │  │ :8001   │ │ :8002   │ │ :8003   │ │ :8004   │        │    │   │
│  │  │  │ (Prim)  │ │ (Triad) │ │ (Triad) │ │ (Triad) │        │    │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │    │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │    │   │
│  │  │  │ Examiner│ │ Explorer│ │ Sentinel│ │ Coder   │        │    │   │
│  │  │  │ :8005   │ │ :8006   │ │ :8007   │ │ :8008   │        │    │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │    │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │    │   │
│  │  │  │ Dreamer │ │ Empath  │ │ Historian│                   │    │   │
│  │  │  │ :8009   │ │ :8010   │ │ :8011   │                    │    │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘                    │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ LiteLLM      │  │ PostgreSQL   │  │ Redis        │  │ Langfuse     │ │
│  │ :4000        │  │ :5432        │  │ :6379        │  │ :3000        │ │
│  │ (A2A Router) │  │ (pgvector)   │  │ (Pub/Sub)    │  │ (Observ)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Communication Flow

```
User Request → LiteLLM (:4000) → OpenClaw Gateway (:18789) → Target Agent
                                                              ↓
Agent Processing → Workspace Operations → Tool Execution
                                                              ↓
Agent Response → Gateway → LiteLLM → Langfuse (tracing) → User
```

---

## Key Components

### Gateway ([`openclaw-gateway.js`](gateway/openclaw-gateway.js:1))

The Gateway is the central coordination point for all agent communication.

**Responsibilities:**
- Agent registration and heartbeat monitoring via [`_handlePing()`](gateway/openclaw-gateway.js:714)
- A2A message routing between agents
- Agent status endpoint at [`/agent-status`](gateway/openclaw-gateway.js:698)
- WebSocket RPC handling for all message types

**Key Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent-status` | GET | All agents with status |
| `/agent-status/{agentId}` | GET | Specific agent status |
| `/health` | GET | Gateway health check |
| WebSocket `ws://localhost:18789` | WS | A2A communication |

### A2A Protocol ([`agent-client.js`](agents/lib/agent-client.js:1))

Agent-to-Agent communication protocol implemented via WebSocket RPC.

**Message Types:**
| Type | Direction | Purpose |
|------|-----------|---------|
| `handshake` | Bidirectional | Connection establishment |
| `register` | Agent→Gateway | Agent registration with role |
| `ping/pong` | Bidirectional | Heartbeat mechanism |
| `message` | Bidirectional | Standard agent communication |
| `discover` | Agent→Gateway | Service/agent discovery |
| `proposal` | Agent→Agent | Triad proposal initiation |
| `vote` | Agent→Agent | Triad voting |
| `decision` | Agent→Agent | Triad consensus result |

**Heartbeat System:**
- Interval: 30 seconds (configurable via [`heartbeatInterval`](agents/lib/agent-client.js:57))
- Automatic registration on connect via [`_registerAgent()`](agents/lib/agent-client.js:97)
- Status tracking via [`getHeartbeatStatus()`](agents/lib/agent-client.js:258)

### Agents

Each agent runs as an independent process with its own workspace.

| Agent | Port | Role | Primary Function |
|-------|------|------|------------------|
| Steward | 8001 | Orchestrator (Primary) | Collective coordination |
| Alpha | 8002 | Triad | Decision making |
| Beta | 8003 | Triad | Decision making |
| Charlie | 8004 | Triad | Decision making |
| Examiner | 8005 | Interrogator | Analysis and review |
| Explorer | 8006 | Scout | Research and discovery |
| Sentinel | 8007 | Guardian | Security and safety |
| Coder | 8008 | Artisan | Code generation |
| Dreamer | 8009 | Visionary | Creative thinking |
| Empath | 8010 | Diplomat | Human interaction |
| Historian | 8011 | Archivist | Memory and context |

### LiteLLM Integration

LiteLLM serves as the unified LLM proxy with built-in A2A routing.

**Configuration:**
- URL: `http://localhost:4000`
- Master Key: From `LITELLM_MASTER_KEY` environment variable
- Agents endpoint: `/v1/agents`
- Health endpoint: `/health`

**Observability:**
- Langfuse integration for tracing
- Token usage tracking per agent
- Latency and error rate monitoring

---

## Configuration Reference

### openclaw.json

Main configuration file located at [`openclaw.json`](openclaw.json:1).

```json
{
  "collective": {
    "name": "heretek-openclaw",
    "version": "2.0.0"
  },
  "agents": {
    "list": [
      {
        "id": "steward",
        "name": "steward",
        "workspace": "/root/.openclaw/agents/steward/workspace",
        "agentDir": "/root/.openclaw/agents/steward",
        "model": "litellm/agent/steward",
        "role": "orchestrator",
        "primary": true
      }
    ]
  },
  "a2a_protocol": {
    "enabled": true,
    "endpoint": "ws://localhost:18789"
  },
  "approvals": {
    "exec": {
      "mode": "disabled"
    },
    "plugin": {
      "enabled": false
    }
  },
  "heretek": {
    "enableRedisMessaging": true,
    "enableCustomGateway": true,
    "enableEnhancedLogging": true,
    "enableAgentHeartbeat": true,
    "approvalSystemMode": "disabled"
  }
}
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LITELLM_URL` | `http://localhost:4000` | LiteLLM proxy endpoint |
| `LITELLM_MASTER_KEY` | Required | Authentication key |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `heretek` | Database user |
| `POSTGRES_PASSWORD` | Required | Database password |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `AGENT_NAME` | Varies | Current agent identifier |
| `GATEWAY_URL` | `ws://localhost:18789` | Gateway WebSocket URL |

### Heretek-Specific Configuration

The [`heretek`](openclaw.json:107) section in `openclaw.json` enables Heretek-specific features:

| Option | Default | Purpose |
|--------|---------|---------|
| `enableRedisMessaging` | `true` | Redis pub/sub for A2A |
| `enableCustomGateway` | `true` | Custom Gateway daemon |
| `enableEnhancedLogging` | `true` | Detailed logging |
| `enableAgentHeartbeat` | `true` | Automatic heartbeat |
| `approvalSystemMode` | `"disabled"` | Liberation mode |

---

## Troubleshooting Quick Reference

### Common Issues

| Issue | Symptom | Quick Fix |
|-------|---------|-----------|
| Agent Offline | Health check fails, dashboard shows offline | [`docker restart heretek-{agent}`](docs/operations/RUNBOOK_AGENT_OFFLINE.md:45) |
| A2A Not Working | Messages not delivered | [`docker restart heretek-litellm`](docs/operations/RUNBOOK_A2A_DEBUG.md:78) |
| Gateway Failure | Port 18789 not responding | [`npm run gateway:restart`](docs/operations/RUNBOOK_GATEWAY_FAILURE.md:56) |
| Approval Stuck | Actions pending approval | Check [`approval-system-liberation.patch`](patches/approval-system-liberation.patch:1) |

### Diagnostic Commands

```bash
# Full system health check
npm run health:check

# Check all agent statuses
curl http://localhost:18789/agent-status | jq .

# Check Gateway logs
docker logs heretek-gateway --tail 100

# Check A2A registry
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/v1/agents
```

### Runbooks

| Runbook | Purpose |
|---------|---------|
| [`RUNBOOK_A2A_DEBUG.md`](docs/operations/RUNBOOK_A2A_DEBUG.md) | A2A protocol debugging |
| [`RUNBOOK_AGENT_OFFLINE.md`](docs/operations/RUNBOOK_AGENT_OFFLINE.md) | Agent offline recovery |
| [`RUNBOOK_GATEWAY_FAILURE.md`](docs/operations/RUNBOOK_GATEWAY_FAILURE.md) | Gateway failure recovery |
| [`RUNBOOK_APPROVAL_ISSUES.md`](docs/operations/RUNBOOK_APPROVAL_ISSUES.md) | Approval system issues |

---

## Related Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [A2A Protocol](docs/standards/A2A_PROTOCOL.md)
- [Skills](docs/SKILLS.md)
- [Plugins](docs/PLUGINS.md)
- [Operations](docs/operations/README.md)
- [Deployment Guide](DEPLOYMENT_HERETEK.md)
- [Migration Guide](MIGRATION_FROM_UPSTREAM.md)

---

## Support

- **Issues:** https://github.com/heretek/heretek-openclaw-core/issues
- **Discussions:** https://github.com/heretek/heretek-openclaw-core/discussions
- **Documentation:** https://github.com/heretek/heretek-openclaw-docs

---

🦞 *The thought that never ends.*
