# Runbook: Agent Offline Recovery

**Document ID:** RUNBOOK-AGENT-001  
**Version:** 1.0.0  
**Last Updated:** 2026-04-01  
**Severity Levels:** Medium (single agent) to High (multiple agents)

---

## Overview

This runbook provides procedures for detecting, diagnosing, and recovering agents that have gone offline in the Heretek OpenClaw system.

### Agent Reference

| Agent | Port | Container | Role |
|-------|------|-----------|------|
| Steward | 8001 | heretek-steward | Orchestrator (Primary) |
| Alpha | 8002 | heretek-alpha | Triad |
| Beta | 8003 | heretek-beta | Triad |
| Charlie | 8004 | heretek-charlie | Triad |
| Examiner | 8005 | heretek-examiner | Interrogator |
| Explorer | 8006 | heretek-explorer | Scout |
| Sentinel | 8007 | heretek-sentinel | Guardian |
| Coder | 8008 | heretek-coder | Artisan |
| Dreamer | 8009 | heretek-dreamer | Visionary |
| Empath | 8010 | heretek-empath | Diplomat |
| Historian | 8011 | heretek-historian | Archivist |

---

## Detect Offline Agents

### Method 1: Gateway Status Endpoint

```bash
# Check all agents status
curl -s http://localhost:18789/agent-status | jq .

# Check only offline agents
curl -s http://localhost:18789/agent-status | jq '.agents[] | select(.status == "offline")'

# Count offline agents
curl -s http://localhost:18789/agent-status | jq '.offlineCount'
```

**Expected output for healthy system:**
```json
{
  "timestamp": "2026-04-01T12:00:00.000Z",
  "totalAgents": 11,
  "onlineCount": 11,
  "offlineCount": 0,
  "agents": [...]
}
```

### Method 2: Health Check Script

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check specific agent
./scripts/health-check.sh steward
```

### Method 3: Dashboard Check

Access the web dashboard at `http://localhost:3000` and check the agent status panel.

**Visual indicators:**
- Green = Online and healthy
- Yellow = Degraded or high latency
- Red = Offline or unhealthy

### Method 4: Direct Health Endpoint Check

```bash
# Check all agent health endpoints
for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010 8011; do
    echo -n "Port $port: "
    curl -sf http://localhost:$port/health && echo "OK" || echo "FAILED"
done
```

---

## Heartbeat Troubleshooting

### Understanding Agent Heartbeat

Agents send heartbeats to the Gateway every 30 seconds via the `_sendHeartbeat()` method in [`agent-client.js`](../../agents/lib/agent-client.js:131).

**Heartbeat message structure:**
```json
{
  "type": "ping",
  "agentId": "steward",
  "timestamp": "2026-04-01T12:00:00.000Z",
  "heartbeat": {
    "uptime": 3600.5,
    "memoryUsage": {...},
    "lastHeartbeatSent": "2026-04-01T11:59:30.000Z"
  }
}
```

### Check Heartbeat Status

```bash
# Get detailed heartbeat status for all agents
curl -s http://localhost:18789/agent-status | jq '.agents[] | {
  agentId,
  status,
  lastSeen,
  timeSinceLastSeenMs,
  websocketReadyState
}'
```

### Heartbeat Troubleshooting Steps

#### Step 1: Verify WebSocket Connection

```bash
# Check if agent's WebSocket is connected
curl -s http://localhost:18789/agent-status/steward | jq '.websocketReadyState'

# WebSocket ready states:
# 0 = CONNECTING
# 1 = OPEN (healthy)
# 2 = CLOSING
# 3 = CLOSED (problem)
```

#### Step 2: Check Time Since Last Heartbeat

```bash
# Get time since last heartbeat (in milliseconds)
curl -s http://localhost:18789/agent-status/steward | jq '.timeSinceLastSeenMs'

# Interpretation:
# < 60000 (60s) = Healthy
# 60000-120000 = Warning, investigate
# > 120000 = Critical, agent likely offline
```

#### Step 3: Check Agent Process

```bash
# Check if agent container is running
docker ps | grep heretek-steward

# Check agent process inside container
docker exec heretek-steward ps aux | grep node

# Check agent memory usage
docker exec heretek-steward cat /proc/$(pidof node)/status | grep -E "VmRSS|VmSize"
```

#### Step 4: Analyze Heartbeat Logs

```bash
# Check Gateway logs for heartbeat activity
docker logs heretek-gateway --tail 200 | grep -i "heartbeat\|ping\|pong"

# Check agent logs for heartbeat sending
docker logs heretek-steward --tail 200 | grep -i "heartbeat\|gateway\|connect"
```

### Common Heartbeat Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Heartbeat not sent | timeSinceLastSeenMs keeps increasing | Restart agent |
| Heartbeat sent but not received | Gateway logs show no ping | Check network, Redis |
| Intermittent heartbeat | Gaps in heartbeat timeline | Check resource exhaustion |
| All agents missing heartbeat | Gateway not receiving any | Restart Gateway |

---

## Agent Restart Procedures

### Procedure 1: Graceful Single Agent Restart

**Use when:** Single agent offline or unresponsive

```bash
AGENT_NAME="steward"

# 1. Check current status
curl -s http://localhost:18789/agent-status/$AGENT_NAME | jq .

# 2. View recent logs before restart
docker logs heretek-$AGENT_NAME --tail 50

# 3. Graceful restart
docker restart heretek-$AGENT_NAME

# 4. Wait for startup (typically 10-15 seconds)
sleep 15

# 5. Verify recovery
curl -sf http://localhost:18789/agent-status/$AGENT_NAME | jq '.status'
```

### Procedure 2: Force Restart with Container Removal

**Use when:** Graceful restart fails, agent in bad state

```bash
AGENT_NAME="steward"

# 1. Stop agent forcefully (no graceful shutdown)
docker stop -t 0 heretek-$AGENT_NAME

# 2. Remove the container
docker rm heretek-$AGENT_NAME

# 3. Recreate and start
cd /root/heretek/heretek-openclaw-core
docker compose up -d $AGENT_NAME

# 4. Monitor startup
docker logs -f heretek-$AGENT_NAME

# 5. Verify health
sleep 15
curl -sf http://localhost:8001/health && echo "OK" || echo "FAILED"
```

### Procedure 3: Restart with Clean State

**Use when:** Agent state corruption suspected

```bash
AGENT_NAME="steward"

# WARNING: This erases agent's workspace state!

# 1. Stop agent
docker stop heretek-$AGENT_NAME

# 2. Remove container
docker rm heretek-$AGENT_NAME

# 3. Remove agent's memory volume
docker volume rm heretek-openclaw_agent_memory_$AGENT_NAME 2>/dev/null || true

# 4. Recreate with fresh state
cd /root/heretek/heretek-openclaw-core
docker compose up -d $AGENT_NAME

# 5. Monitor fresh initialization
docker logs -f heretek-$AGENT_NAME
```

### Procedure 4: Rolling Restart (Multiple Agents)

**Use when:** Multiple agents offline, system-wide issues

```bash
cd /root/heretek/heretek-openclaw-core

for agent in steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian; do
    echo "=== Restarting $agent ==="
    docker restart heretek-$agent
    sleep 10
    
    if curl -sf http://localhost:18789/agent-status/$agent | jq -e '.status == "online"' > /dev/null; then
        echo "OK: $agent recovered"
    else
        echo "FAILED: $agent - STOPPING"
        break
    fi
done

echo "=== Final Status ==="
curl -s http://localhost:18789/agent-status | jq '{total: .totalAgents, online: .onlineCount, offline: .offlineCount}'
```

---

## Escalation Paths

### Level 1: Single Agent Offline

**When:** One agent offline, others healthy

**Actions:**
1. Execute Procedure 1 (Graceful Restart)
2. If fails, execute Procedure 2 (Force Restart)
3. Check agent-specific logs for root cause

**Escalate if:** Agent fails to recover after force restart

### Level 2: Multiple Agents Offline (2-5)

**When:** Multiple agents offline, possible systemic issue

**Actions:**
1. Check Gateway health first
2. Check Redis connectivity
3. Execute Procedure 4 (Rolling Restart)

**Escalate if:** More than 3 agents remain offline after rolling restart

### Level 3: Critical Agent Offline (Steward)

**When:** Steward (primary orchestrator) is offline

**Actions:**
1. IMMEDIATE: Execute Procedure 2 (Force Restart) for Steward
2. Check if Triad can maintain operations temporarily
3. Escalate immediately if Steward remains offline >15 minutes

### Level 4: All/Most Agents Offline (>6)

**When:** System-wide failure

**Actions:**
1. Check infrastructure (Gateway, Redis, LiteLLM)
2. Execute infrastructure restart first
3. Then execute rolling agent restart

**Escalation Contact:** Engineering Lead immediately

---

## Post-Recovery Validation

### Validation Checklist

- [ ] Agent health endpoint responds (HTTP 200)
- [ ] Agent shows "online" in Gateway status
- [ ] Agent appears in LiteLLM /v1/agents registry
- [ ] Heartbeat is regular (<30 second intervals)
- [ ] No error spikes in agent logs

### Validation Commands

```bash
AGENT_NAME="steward"

# 1. Health endpoint
curl -sf http://localhost:8001/health && echo "Health OK" || echo "Health FAILED"

# 2. Gateway status
curl -s http://localhost:18789/agent-status/$AGENT_NAME | jq -r '"Status: " + .status'

# 3. LiteLLM registry
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  http://localhost:4000/v1/agents | jq ".data[] | select(.id | contains(\"$AGENT_NAME\"))"

# 4. Error check in logs
docker logs heretek-$AGENT_NAME --tail 100 | grep -c "error\|Error\|ERROR"
```

---

## Reference

| Document | Purpose |
|----------|---------|
| [`RUNBOOK_A2A_DEBUG.md`](./RUNBOOK_A2A_DEBUG.md) | A2A communication issues |
| [`RUNBOOK_GATEWAY_FAILURE.md`](./RUNBOOK_GATEWAY_FAILURE.md) | Gateway failures |
| [`agent-client.js`](../../agents/lib/agent-client.js:1) | Agent client implementation |
| [`openclaw-gateway.js`](../../gateway/openclaw-gateway.js:698) | Gateway agent-status endpoint |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial version |
