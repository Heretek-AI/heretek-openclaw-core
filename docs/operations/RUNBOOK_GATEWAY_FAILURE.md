# Runbook: Gateway Failure Recovery

**Document ID:** RUNBOOK-GATEWAY-001  
**Version:** 1.0.0  
**Last Updated:** 2026-04-01  
**Severity Levels:** High (degraded) to Critical (complete failure)

---

## Overview

The OpenClaw Gateway is the central coordination point for all Agent-to-Agent (A2A) communication. This runbook provides procedures for diagnosing and recovering from Gateway failures.

### Gateway Responsibilities

- Agent registration and heartbeat monitoring via [`_handlePing()`](../../gateway/openclaw-gateway.js:714)
- A2A message routing between agents
- Agent status endpoint at [`/agent-status`](../../gateway/openclaw-gateway.js:698)
- WebSocket RPC handling for all message types

### Key Gateway Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Gateway health check |
| `/agent-status` | GET | All agents with status |
| `/agent-status/{agentId}` | GET | Specific agent status |
| `ws://localhost:18789` | WS | A2A WebSocket communication |

---

## Gateway Health Checks

### Quick Health Check

```bash
# Basic health check
curl -f http://localhost:18789/health

# Expected output:
# {"status":"ok","timestamp":"2026-04-01T12:00:00.000Z","connectedAgents":11}
```

### Detailed Status Check

```bash
# Full agent status
curl -s http://localhost:18789/agent-status | jq .

# Expected output:
# {
#   "timestamp": "2026-04-01T12:00:00.000Z",
#   "totalAgents": 11,
#   "onlineCount": 11,
#   "offlineCount": 0,
#   "agents": [...]
# }
```

### Gateway Process Check

```bash
# Check if Gateway process is running
ps aux | grep -i "openclaw-gateway\|gateway"

# Check if port 18789 is listening
netstat -tlnp | grep 18789
# or
ss -tlnp | grep 18789

# Check Gateway container (if using Docker)
docker ps | grep gateway
```

### Gateway Log Check

```bash
# View recent Gateway logs
docker logs heretek-gateway --tail 100

# Search for errors
docker logs heretek-gateway --tail 500 | grep -i "error\|exception\|failed"

# Real-time log monitoring
docker logs -f heretek-gateway
```

---

## Failure Symptoms

### Complete Gateway Failure

| Symptom | Check Command | Expected |
|---------|---------------|----------|
| Health endpoint fails | `curl -f http://localhost:18789/health` | Returns 200 OK |
| Port not listening | `netstat -tlnp \| grep 18789` | Shows listening |
| WebSocket connection fails | `wscat -c ws://localhost:18789` | Connects successfully |
| All agents show offline | `curl /agent-status \| jq .offlineCount` | Should be 0 |

### Partial Gateway Degradation

| Symptom | Check Command | Expected |
|---------|---------------|----------|
| High latency | `curl -w "@curl-format.txt" http://localhost:18789/health` | < 100ms |
| Intermittent failures | Multiple health checks | All succeed |
| Agent registration failing | Check logs for "register" | No errors |
| Heartbeat not processing | Check logs for "ping" | Regular entries |

---

## Restart Procedures

### Procedure 1: Graceful Gateway Restart

**Use when:** Gateway is running but degraded or unresponsive

```bash
cd /root/heretek/heretek-openclaw-core

# 1. Check current status
curl -s http://localhost:18789/health || echo "Gateway not responding"

# 2. View recent logs
docker logs heretek-gateway --tail 50

# 3. Graceful restart
docker restart heretek-gateway

# 4. Wait for startup
sleep 10

# 5. Verify recovery
curl -sf http://localhost:18789/health && echo "Gateway recovered" || echo "Recovery failed"

# 6. Check agent re-registration
sleep 15
curl -s http://localhost:18789/agent-status | jq '{online: .onlineCount, offline: .offlineCount}'
```

### Procedure 2: Force Gateway Restart

**Use when:** Graceful restart fails, Gateway in bad state

```bash
cd /root/heretek/heretek-openclaw-core

# 1. Stop Gateway forcefully
docker stop -t 0 heretek-gateway

# 2. Remove container
docker rm heretek-gateway

# 3. Recreate and start
docker compose up -d gateway

# 4. Monitor startup logs
docker logs -f heretek-gateway

# 5. Verify (in another terminal after 10 seconds)
curl -sf http://localhost:18789/health && echo "OK" || echo "FAILED"
```

### Procedure 3: Full Gateway Rebuild

**Use when:** Container image corruption or persistent failures

```bash
cd /root/heretek/heretek-openclaw-core

# 1. Stop and remove Gateway
docker compose down gateway

# 2. Remove Gateway image
docker rmi heretek-gateway:latest 2>/dev/null || true

# 3. Rebuild from source
docker compose build gateway

# 4. Start fresh
docker compose up -d gateway

# 5. Wait for agents to re-register
sleep 20

# 6. Verify full recovery
curl -s http://localhost:18789/agent-status | jq '{total: .totalAgents, online: .onlineCount}'
```

---

## Failover Options

### Option 1: Manual Failover to Backup Gateway

If you have a backup Gateway instance configured:

```bash
# On backup Gateway host:
cd /root/heretek/heretek-openclaw-core

# Start backup Gateway
docker compose up -d gateway

# Update agent configuration to point to backup
# Edit .env file:
# GATEWAY_URL=ws://backup-host:18789

# Restart agents to connect to backup
for agent in steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian; do
    docker restart heretek-$agent
done
```

### Option 2: Temporary Direct Agent Communication

When Gateway is down, agents can communicate directly (if configured):

```bash
# Enable direct agent-to-agent mode
export A2A_DIRECT_MODE=true

# Restart agents
for agent in steward alpha beta charlie; do
    docker restart heretek-$agent
done
```

**Note:** This is a temporary workaround. The Gateway should be restored as soon as possible.

### Option 3: LiteLLM as Temporary Router

LiteLLM can route some requests without the Gateway:

```bash
# Check LiteLLM is running
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4000/health

# Route through LiteLLM directly
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "litellm/agent/steward", "messages": [{"role": "user", "content": "status"}]}' \
  http://localhost:4000/v1/chat/completions
```

---

## Post-Recovery Validation

### Validation Checklist

After Gateway recovery, verify:

- [ ] Gateway health endpoint responds (HTTP 200)
- [ ] All 11 agents show as "online" in `/agent-status`
- [ ] WebSocket connections are accepted
- [ ] Agent heartbeats are being processed
- [ ] A2A messages are being routed
- [ ] No error spikes in Gateway logs

### Validation Commands

```bash
# 1. Gateway health
curl -sf http://localhost:18789/health | jq .

# 2. Agent count
curl -s http://localhost:18789/agent-status | jq '{online: .onlineCount, offline: .offlineCount}'

# Should show: online: 11, offline: 0

# 3. WebSocket test
wscat -c ws://localhost:18789 << 'EOF'
{"type": "handshake", "agent": "test-client"}
EOF

# 4. Check heartbeat processing
docker logs heretek-gateway --tail 50 | grep -c "pong"
# Should show regular heartbeat responses

# 5. Test A2A message routing
# (This requires two agents to be functional)
```

---

## Prevention Measures

### Monitoring Setup

```bash
# Add to crontab for continuous monitoring
# Check Gateway health every 2 minutes
*/2 * * * * curl -sf http://localhost:18789/health || \
    echo "GATEWAY DOWN: $(date)" >> /root/.openclaw/logs/gateway-alerts.log && \
    /root/heretek/scripts/gateway-recovery.sh
```

### Gateway Configuration

Ensure proper configuration in [`openclaw-gateway.js`](../../gateway/openclaw-gateway.js:1):

- **Heartbeat interval:** 30 seconds (default)
- **Agent timeout:** 60 seconds (2x heartbeat)
- **WebSocket ping/pong:** Enabled

### Resource Allocation

```yaml
# In docker-compose.yml, ensure Gateway has adequate resources:
gateway:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '1.0'
        memory: 1G
```

---

## Escalation Path

### Level 1: On-Call Engineer
- **When:** Initial Gateway failure detected
- **Actions:** Execute Procedure 1 (Graceful Restart)
- **Target:** Restore within 5 minutes

### Level 2: Engineering Lead
- **When:** Procedure 1-2 fail to restore Gateway
- **Actions:** Execute Procedure 3 (Full Rebuild), consider failover
- **Target:** Restore within 15 minutes

### Level 3: System Architect
- **When:** Complete Gateway failure with data loss or corruption
- **Actions:** Full system audit, potential rollback to backup
- **Target:** Restore within 30 minutes

---

## Reference

| Document | Purpose |
|----------|---------|
| [`RUNBOOK_A2A_DEBUG.md`](./RUNBOOK_A2A_DEBUG.md) | A2A communication issues |
| [`RUNBOOK_AGENT_OFFLINE.md`](./RUNBOOK_AGENT_OFFLINE.md) | Agent offline recovery |
| [`openclaw-gateway.js`](../../gateway/openclaw-gateway.js:1) | Gateway implementation |
| [`agent-client.js`](../../agents/lib/agent-client.js:1) | Agent client implementation |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial version |
