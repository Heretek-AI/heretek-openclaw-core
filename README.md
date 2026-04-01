# Heretek OpenClaw Core

> Gateway, agents, A2A protocol, and core functionality for the Heretek OpenClaw autonomous agent collective.

## Overview

Heretek OpenClaw Core is the foundational repository containing:

- **OpenClaw Gateway** - Central daemon managing agent workspaces and A2A communication
- **Agent Implementations** - 11+ specialized agents for various tasks
- **A2A Protocol** - Agent-to-Agent communication via WebSocket RPC
- **Skills Repository** - 48+ skills for agent operations
- **Plugin System** - Extensible plugin architecture

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with pgvector extension
- Redis 7+
- Ollama (optional, for local LLM)

### Quick Start

```bash
# Clone repository
git clone https://github.com/heretek/heretek-openclaw-core.git
cd heretek-openclaw-core

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start services
docker compose up -d

# Start Gateway
npm run gateway:start
```

## Usage

### Starting the Gateway

```bash
# Start Gateway daemon
npm run gateway:start

# Check Gateway status
npm run gateway:status

# Stop Gateway
npm run gateway:stop
```

### Agent Management

```bash
# List available agents
npm run agents:list

# Deploy an agent
npm run agents:deploy -- steward

# View agent logs
npm run agents:logs -- steward
```

### Skills

```bash
# List available skills
npm run skills:list

# Execute a skill
npm run skills:run -- healthcheck
```

## Configuration

### openclaw.json

Main configuration file for the OpenClaw collective:

```json
{
  "collective": {
    "name": "heretek-openclaw",
    "version": "2.0.0"
  },
  "agents": {
    "steward": {
      "role": "orchestrator",
      "model": "openai/gpt-4o"
    }
  },
  "a2a_protocol": {
    "enabled": true,
    "endpoint": "ws://localhost:18789"
  }
}
```

### Environment Variables

See `.env.example` for all available options:

```bash
# LiteLLM Configuration
LITELLM_URL=http://localhost:4000
LITELLM_MASTER_KEY=your-key-here

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=heretek
POSTGRES_PASSWORD=your-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Heretek OpenClaw Core                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  OpenClaw Gateway                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Steward │ │ Alpha   │ │ Beta    │ │ Charlie │       │   │
│  │  │ (Orch)  │ │ (Triad) │ │ (Triad) │ │ (Triad) │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Sentinel│ │ Explorer│ │ Examiner│ │ Coder   │       │   │
│  │  │ (Safety)│ │ (Research)│(Advocate)│(Developer)│      │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │   │
│  │  │ Dreamer │ │ Empath  │ │ Historian│                  │   │
│  │  │ (Creative)│(Support) │ (Memory)  │                  │   │
│  │  └─────────┘ └─────────┘ └─────────┘                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ LiteLLM      │  │ PostgreSQL   │  │ Redis        │          │
│  │ :4000        │  │ :5432        │  │ :6379        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## API Reference

### Gateway WebSocket API

Connect to the Gateway at `ws://localhost:18789`:

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:18789');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'handshake',
    agent: 'external-client'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

### Message Types

| Type | Description |
|------|-------------|
| `message` | Standard agent message |
| `status` | Agent status update |
| `error` | Error notification |
| `event` | Gateway event |
| `handshake` | Connection handshake |
| `discovery` | Agent/service discovery |
| `proposal` | Triad proposal |
| `vote` | Triad vote |
| `decision` | Triad decision |

## Testing

```bash
# Run all tests
npm run test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [A2A Protocol](docs/standards/A2A_PROTOCOL.md)
- [Skills](docs/SKILLS.md)
- [Plugins](docs/PLUGINS.md)
- [Operations](docs/OPERATIONS.md)

## Related Repositories

- [CLI](https://github.com/heretek/heretek-openclaw-cli) - Deployment CLI
- [Dashboard](https://github.com/heretek/heretek-openclaw-dashboard) - Health monitoring
- [Plugins](https://github.com/heretek/heretek-openclaw-plugins) - Plugin system
- [Deploy](https://github.com/heretek/heretek-openclaw-deploy) - Infrastructure as Code
- [Docs](https://github.com/heretek/heretek-openclaw-docs) - Documentation site

## License

MIT

## Support

- **Issues:** https://github.com/heretek/heretek-openclaw-core/issues
- **Discussions:** https://github.com/heretek/heretek-openclaw-core/discussions

---

🦞 *The thought that never ends.*
