---
name: gateway-pulse
description: Continuous gateway and LiteLLM monitoring for OpenClaw. Provides real-time health dashboard, alert thresholds (warning/critical), auto-remediation for common failures, metrics export to Prometheus, and WebSocket connection monitoring. Use when monitoring gateway health, LiteLLM status, or managing infrastructure alerts.
---

# Gateway Pulse

## When to use this skill

Use this skill when you need to:
- Monitor OpenClaw Gateway health on port 18789
- Monitor LiteLLM health on port 4000
- Set up real-time health dashboards
- Configure alert thresholds (warning/critical)
- Enable auto-remediation for common failures
- Export metrics to Prometheus
- Monitor WebSocket connection status

## When NOT to use this skill

Do NOT use this skill when:
- You need to manage agent lifecycle (use `agent-lifecycle-manager` skill)
- You need to manage triad deliberations (use `triad-orchestrator` skill)
- You need to perform agent-specific operations
- You need to backup gateway configuration

## Inputs required

Before executing, determine:
1. **Operation type**: status, monitor, alert, or metrics
2. **Target service**: gateway, litellm, or all
3. **Alert thresholds**: warning and critical levels
4. **Monitoring interval**: check frequency in seconds

## Workflow

### 1. Check current status

```bash
# View gateway status
./scripts/gateway-pulse.sh status

# View LiteLLM status
./scripts/gateway-pulse.sh status --service litellm

# View all services
./scripts/gateway-pulse.sh status --service all
```

### 2. Start continuous monitoring

```bash
# Start monitoring with default interval (30s)
./scripts/gateway-pulse.sh monitor

# Start monitoring with custom interval
./scripts/gateway-pulse.sh monitor --interval 15

# Start monitoring with auto-remediation
./scripts/gateway-pulse.sh monitor --auto-remediate
```

### 3. Configure alerts

```bash
# View alert configuration
./scripts/gateway-pulse.sh alerts --config

# Set alert thresholds
./scripts/gateway-pulse.sh alerts --set --warning 5000 --critical 10000

# View alert history
./scripts/gateway-pulse.sh alerts --history
```

**Alert thresholds**:
- **Latency warning**: Response time > 5000ms
- **Latency critical**: Response time > 10000ms
- **Error rate warning**: Error rate > 5%
- **Error rate critical**: Error rate > 20%

### 4. Auto-remediation

```bash
# Enable auto-remediation
./scripts/gateway-pulse.sh remediate --enable

# Trigger manual remediation
./scripts/gateway-pulse.sh remediate --run

# View remediation history
./scripts/gateway-pulse.sh remediate --history
```

**Auto-remediation actions**:
- Restart Gateway service on critical failure
- Restart LiteLLM service on critical failure
- Clear WebSocket connection cache
- Reset connection pools

### 5. Export metrics

```bash
# Export Prometheus metrics
./scripts/gateway-pulse.sh metrics --export

# View metrics endpoint
./scripts/gateway-pulse.sh metrics --endpoint

# Start metrics server
./scripts/gateway-pulse.sh metrics --serve --port 9090
```

### 6. Health dashboard

```bash
# Full health dashboard
./scripts/gateway-pulse.sh dashboard

# JSON output
./scripts/gateway-pulse.sh status --json

# Watch mode
./scripts/gateway-pulse.sh watch
```

## Files

- [`src/index.js`](src/index.js) - Main monitoring logic
- [`src/gateway-monitor.js`](src/gateway-monitor.js) - Gateway health checks
- [`src/litellm-monitor.js`](src/litellm-monitor.js) - LiteLLM health checks
- [`src/alert-manager.js`](src/alert-manager.js) - Alert generation
- [`scripts/gateway-pulse.sh`](scripts/gateway-pulse.sh) - CLI wrapper

## Examples

### Example 1: Start monitoring with alerts

```bash
# Start monitoring with custom thresholds
./scripts/gateway-pulse.sh monitor --interval 30 --warning 5000 --critical 10000
```

### Example 2: Export Prometheus metrics

```bash
# Export metrics in Prometheus format
./scripts/gateway-pulse.sh metrics --export --format prometheus
```

### Example 3: View health dashboard

```bash
# View real-time dashboard
./scripts/gateway-pulse.sh dashboard
```

## Troubleshooting

### Gateway not responding

1. Check Gateway process: `docker ps | grep gateway`
2. Check Gateway logs: `docker logs heretek-openclaw-core-gateway-1`
3. Restart Gateway: `./scripts/lifecycle-manager.sh restart --agents gateway`

### LiteLLM not responding

1. Check LiteLLM process: `docker ps | grep litellm`
2. Check LiteLLM logs: `docker logs heretek-openclaw-core-litellm-1`
3. Restart LiteLLM: `docker compose -p heretek-openclaw-core restart litellm`

### WebSocket connection issues

1. Check WebSocket endpoint: `curl -i http://127.0.0.1:18789/health`
2. Verify WebSocket URL in configuration
3. Clear connection cache: `./scripts/gateway-pulse.sh remediate --clear-cache`

## Gateway Endpoints

The OpenClaw Gateway exposes these health endpoints on port 18789:

- `/health` - Overall gateway health
- `/health/<agent>` - Specific agent health
- `/metrics` - Prometheus metrics
- `/ws` - WebSocket RPC endpoint

## LiteLLM Endpoints

LiteLLM exposes these endpoints on port 4000:

- `/health` - LiteLLM health check
- `/v1/chat/completions` - Chat completions
- `/v1/models` - Available models
- `/metrics` - Prometheus metrics
