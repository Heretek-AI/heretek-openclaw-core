---
name: system-diagnostics
description: Comprehensive system diagnostics for OpenClaw. Provides one-command full system check, log aggregation, configuration validation, dependency verification, and health score calculation. Use when troubleshooting system-wide issues, performing health audits, or validating system integrity after deployments.
---

# System Diagnostics

## When to use this skill

Use this skill when you need to:
- Perform a comprehensive one-command system health check
- Aggregate and analyze logs from all components
- Validate OpenClaw configuration files
- Verify system dependencies (Docker, Node.js, services)
- Calculate an overall system health score
- Troubleshoot multi-component failures
- Pre-deployment validation
- Post-incident system audit

## When NOT to use this skill

Do NOT use this skill when:
- You need to analyze specific log patterns in detail (use `log-analyzer` skill)
- You need to inspect agent memory state (use `state-inspector` skill)
- You need to recover from corruption (use `corruption-recovery` skill)
- You need to manage agent lifecycle (use `agent-lifecycle-manager` skill)
- You need to monitor gateway/LiteLLM continuously (use `gateway-pulse` skill)

## Inputs required

Before executing, determine:
1. **Scope**: full system, specific component, or targeted check
2. **Output format**: console, JSON, or report file
3. **Verbose mode**: whether to include detailed output
4. **Auto-fix**: whether to attempt automatic remediation

## Workflow

### 1. Run full system diagnostics

```bash
# Full system check with health score
./scripts/diagnostics.sh full

# Full check with verbose output
./scripts/diagnostics.sh full --verbose

# Full check with JSON output
./scripts/diagnostics.sh full --json
```

### 2. Component-specific checks

```bash
# Check Gateway health only
./scripts/diagnostics.sh component --name gateway

# Check LiteLLM health only
./scripts/diagnostics.sh component --name litellm

# Check database health only
./scripts/diagnostics.sh component --name database

# Check all agents
./scripts/diagnostics.sh component --name agents
```

### 3. Configuration validation

```bash
# Validate openclaw.json
./scripts/diagnostics.sh config --file openclaw.json

# Validate all configuration files
./scripts/diagnostics.sh config --all

# Validate with auto-fix
./scripts/diagnostics.sh config --all --auto-fix
```

### 4. Dependency verification

```bash
# Check system dependencies
./scripts/diagnostics.sh deps --system

# Check Docker dependencies
./scripts/diagnostics.sh deps --docker

# Check Node.js dependencies
./scripts/diagnostics.sh deps --node

# Check all dependencies
./scripts/diagnostics.sh deps --all
```

### 5. Log aggregation

```bash
# Aggregate last 100 lines from all logs
./scripts/diagnostics.sh logs --aggregate

# Aggregate with error filtering
./scripts/diagnostics.sh logs --aggregate --filter errors

# Aggregate specific time range
./scripts/diagnostics.sh logs --aggregate --since "1h ago"
```

### 6. Health score

```bash
# Calculate health score only
./scripts/diagnostics.sh health-score

# Calculate with breakdown
./scripts/diagnostics.sh health-score --breakdown

# Calculate and compare with history
./scripts/diagnostics.sh health-score --history
```

## Health Score Calculation

The health score (0-100) is calculated based on:

| Component | Weight | Criteria |
|-----------|--------|----------|
| Gateway | 25% | WebSocket connectivity, response time |
| LiteLLM | 25% | API availability, model access |
| Database | 20% | Connection, query response |
| Agents | 20% | Running count, health endpoints |
| System | 10% | CPU, memory, disk |

**Score interpretation**:
- 90-100: Excellent
- 75-89: Good
- 50-74: Degraded
- 25-49: Critical
- 0-24: Failed

## Files

- [`src/index.js`](src/index.js) - Main diagnostic orchestration
- [`src/config-validator.js`](src/config-validator.js) - Configuration validation
- [`src/dependency-checker.js`](src/dependency-checker.js) - Dependency verification
- [`src/health-scorer.js`](src/health-scorer.js) - Health score calculation
- [`scripts/diagnostics.sh`](scripts/diagnostics.sh) - CLI wrapper
- [`package.json`](package.json) - Node.js dependencies

## Examples

### Example 1: Quick health check

```bash
# Get health score in one command
./scripts/diagnostics.sh health-score
# Output: Health Score: 87/100 (Good)
```

### Example 2: Pre-deployment validation

```bash
# Full validation before deployment
./scripts/diagnostics.sh full --verbose --output report.json
```

### Example 3: Troubleshoot failure

```bash
# Run diagnostics with auto-fix
./scripts/diagnostics.sh full --auto-fix
```

## Troubleshooting

### Diagnostics fail to run

1. Verify Node.js version: `node --version` (requires >= 18.0.0)
2. Check script permissions: `chmod +x scripts/diagnostics.sh`
3. Verify dependencies: `./scripts/diagnostics.sh deps --node`

### Health score is low

1. Run with breakdown: `./scripts/diagnostics.sh health-score --breakdown`
2. Check component status: `./scripts/diagnostics.sh component --name <component>`
3. Review aggregated logs: `./scripts/diagnostics.sh logs --aggregate --filter errors`

### Configuration validation fails

1. View specific errors: `./scripts/diagnostics.sh config --all --verbose`
2. Attempt auto-fix: `./scripts/diagnostics.sh config --all --auto-fix`
3. Manual review: Compare with [`heretek-openclaw-core/openclaw.json`](../../openclaw.json)

## Gateway Integration

This skill integrates with the OpenClaw Gateway WebSocket RPC on port 18789:

- Gateway health check uses `/health` endpoint
- Agent status retrieved via Gateway WebSocket
- Diagnostics results published to Gateway for dashboard display

## LiteLLM Integration

LiteLLM health checks verify:

- `/health` endpoint on port 4000
- Model availability via `/v1/models`
- Chat completion functionality
- Token usage tracking

## Common Debugging Scenarios

### Agent offline detection and recovery

```bash
# Detect offline agents
./scripts/diagnostics.sh component --name agents --filter offline

# Attempt recovery
./scripts/diagnostics.sh component --name agents --auto-recover
```

### LiteLLM gateway failure

```bash
# Check LiteLLM status
./scripts/diagnostics.sh component --name litellm --verbose

# Check connectivity
./scripts/diagnostics.sh deps --network --target litellm:4000
```

### Triad deliberation deadlock

```bash
# Check triad agent status
./scripts/diagnostics.sh component --name triad

# View triad logs
./scripts/diagnostics.sh logs --component triad --aggregate
```

### Database corruption

```bash
# Check database integrity
./scripts/diagnostics.sh component --name database --integrity

# If corruption detected, use corruption-recovery skill
```
