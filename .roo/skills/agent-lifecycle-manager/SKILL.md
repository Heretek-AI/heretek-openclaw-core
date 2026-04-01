---
name: agent-lifecycle-manager
description: Unified agent lifecycle management for OpenClaw. Provides batch operations (start-all, stop-all, restart-all), rolling restarts for zero downtime, health-based auto-restart, dependency-aware startup sequences, and agent status dashboard. Use when managing agent processes, recovering from failures, or monitoring agent fleet health.
---

# Agent Lifecycle Manager

## When to use this skill

Use this skill when you need to:
- Start, stop, or restart one or more OpenClaw agents
- Perform batch operations across the agent fleet
- Implement rolling restarts for zero-downtime deployments
- Monitor agent health and auto-restart failed agents
- View agent status dashboard
- Manage agent dependencies and startup order

## When NOT to use this skill

Do NOT use this skill when:
- You need to modify agent configuration (use `config-validator` skill)
- You need to manage LiteLLM or Gateway services (use `gateway-pulse` skill)
- You need to deliberate on triad decisions (use `triad-orchestrator` skill)
- You need to backup agent state (use `fleet-backup` skill)

## Inputs required

Before executing, determine:
1. **Operation type**: start, stop, restart, status, or monitor
2. **Target agents**: specific agent IDs or "all"
3. **Mode**: batch, rolling, or single
4. **Health check enabled**: whether to verify health after operations

## Workflow

### 1. Check current agent status

Before any operation, check the current status of agents:

```bash
# View all agent statuses
./scripts/lifecycle-manager.sh status

# View specific agent status
./scripts/lifecycle-manager.sh status --agent <agent-id>
```

### 2. Start agents

```bash
# Start all agents (dependency-aware order)
./scripts/lifecycle-manager.sh start-all

# Start specific agents
./scripts/lifecycle-manager.sh start --agents steward,alpha,beta

# Start with health verification
./scripts/lifecycle-manager.sh start --agents <agents> --verify-health
```

**Startup order**: Agents are started in dependency order:
1. Gateway and infrastructure agents first
2. Triad agents (steward, alpha, beta, gamma)
3. Worker agents (scout, artisan, guardian)
4. Support agents (dreamer, knowledge-ingest)

### 3. Stop agents

```bash
# Stop all agents (reverse dependency order)
./scripts/lifecycle-manager.sh stop-all

# Stop specific agents gracefully
./scripts/lifecycle-manager.sh stop --agents <agent-ids>

# Force stop (use with caution)
./scripts/lifecycle-manager.sh stop --agents <agent-ids> --force
```

### 4. Restart agents

```bash
# Rolling restart (zero downtime)
./scripts/lifecycle-manager.sh rolling-restart

# Restart specific agents
./scripts/lifecycle-manager.sh restart --agents <agent-ids>

# Restart all (batch mode)
./scripts/lifecycle-manager.sh restart-all
```

### 5. Health monitoring

```bash
# Enable auto-restart monitor
./scripts/lifecycle-manager.sh monitor --auto-restart

# Check health of all agents
./scripts/lifecycle-manager.sh health-check

# View health history
./scripts/lifecycle-manager.sh health-history
```

### 6. Status dashboard

```bash
# Full status dashboard
./scripts/lifecycle-manager.sh dashboard

# JSON output for programmatic access
./scripts/lifecycle-manager.sh status --json

# Watch mode (real-time updates)
./scripts/lifecycle-manager.sh status --watch
```

## Files

- [`src/index.js`](src/index.js) - Main skill entry point
- [`src/agent-controller.js`](src/agent-controller.js) - Agent process control logic
- [`src/health-monitor.js`](src/health-monitor.js) - Health checking and auto-restart
- [`scripts/lifecycle-manager.sh`](scripts/lifecycle-manager.sh) - Shell wrapper for CLI execution
- [`package.json`](package.json) - Node.js dependencies

## Examples

### Example 1: Rolling restart for deployment

```bash
# Perform rolling restart (one agent at a time)
./scripts/lifecycle-manager.sh rolling-restart --delay 5
```

### Example 2: Auto-restart failed agents

```bash
# Start monitoring with auto-restart
./scripts/lifecycle-manager.sh monitor --auto-restart --interval 30
```

### Example 3: Status dashboard

```bash
# View status dashboard
./scripts/lifecycle-manager.sh dashboard
```

## Troubleshooting

### Agent fails to start

1. Check agent logs: `docker logs <agent-container>`
2. Verify configuration: `openclaw config validate`
3. Check dependencies: `./scripts/lifecycle-manager.sh deps --agent <agent-id>`

### Rolling restart stuck

1. Check which agent is being restarted: `./scripts/lifecycle-manager.sh status`
2. Verify health endpoint: `curl http://localhost:18789/health`
3. Force continue: `./scripts/lifecycle-manager.sh rolling-restart --force`

### Auto-restart not triggering

1. Verify monitor is running: `./scripts/lifecycle-manager.sh monitor --status`
2. Check health check interval: `./scripts/lifecycle-manager.sh config`
3. Review health history: `./scripts/lifecycle-manager.sh health-history`

## Gateway Integration

This skill integrates with the OpenClaw Gateway WebSocket RPC on port 18789:

- Agent status is reported via Gateway
- Health checks use Gateway endpoints
- Auto-restart decisions are logged through Gateway

## LiteLLM Integration

Agent health checks verify LiteLLM connectivity on port 4000:

- Model availability is checked during agent startup
- Chat completion endpoints are tested
- Token usage is monitored during health checks
