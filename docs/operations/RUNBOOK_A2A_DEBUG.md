# Runbook: A2A Protocol Debugging

**Document ID:** RUNBOOK-A2A-001  
**Version:** 1.0.0  
**Last Updated:** 2026-04-01  
**Severity Levels:** Medium (degraded) to High (complete failure)

---

## Overview

This runbook provides systematic procedures for diagnosing and resolving Agent-to-Agent (A2A) communication failures in the Heretek OpenClaw system.

### A2A Architecture Summary

```
Agent → Gateway (ws:18789) → LiteLLM (http:4000) → Target Agent
              ↓
         Redis Pub/Sub (6379)
```

**Key Components:**
- **OpenClaw Gateway** - WebSocket RPC router at [`openclaw-gateway.js`](../../gateway/openclaw-gateway.js:1)
- **Agent Client** - A2A client library at [`agent-client.js`](../../agents/lib/agent-client.js:1)
- **LiteLLM** - LLM proxy with agent registry
- **Redis** - Pub/sub messaging backbone

---

## Symptoms of A2A Failures

### Complete Failure
- [ ] Agents cannot communicate with each other
- [ ] Messages show "delivery failed" or timeout
- [ ] Gateway `/agent-status` shows all agents offline
- [ ] LiteLLM `/v1/agents` returns empty list

### Partial/Degraded Operation
- [ ] Some agents can communicate, others cannot
- [ ] Intermittent message delivery
- [ ] High latency in agent responses (>5 seconds)
- [ ] Heartbeat gaps (>60 seconds between pings)

### Silent Failures
- [ ] Messages appear sent but never received
- [ ] Agent shows online but doesn't respond
- [ ] Triad voting stalls indefinitely
- [ ] Discovery requests return no results

---

## Diagnostic Steps

### Step 1: Verify Gateway Status

```bash
# Check Gateway is running
curl -f http://localhost:18789/health

# Expected output:
# {"status":"ok","timestamp":"2026-04-01T12:00:00.000Z","connectedAgents":11}

# Check agent registration status
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

**If Gateway is not responding:**
- Proceed to [`RUNBOOK_GATEWAY_FAILURE.md`](./RUNBOOK_GATEWAY_FAILURE.md)

### Step 2: Verify LiteLLM Agent Registry

```bash
# Check registered agents in LiteLLM
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  http://localhost:4000/v1/agents | jq .

# Expected: List of all 11 agents with their models

# Check LiteLLM health
curl -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  http://localhost:4000/health | jq .
```

**If agents not registered:**
- Agents may not have completed handshake with LiteLLM
- Check agent logs for registration errors

### Step 3: Check Individual Agent Health

```bash
# Quick health check for all agents
for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010 8011; do
    echo -n "Port $port: "
    curl -sf http://localhost:$port/health && echo "OK" || echo "FAILED"
done
```

**Expected output:**
```
Port 8001: OK  # Steward
Port 8002: OK  # Alpha
Port 8003: OK  # Beta
Port 8004: OK  # Charlie
Port 8005: OK  # Examiner
Port 8006: OK  # Explorer
Port 8007: OK  # Sentinel
Port 8008: OK  # Coder
Port 8009: OK  # Dreamer
Port 8010: OK  # Empath
Port 8011: OK  # Historian
```

### Step 4: Verify WebSocket Connectivity

```bash
# Install wscat if not available
npm install -g wscat

# Test WebSocket connection to Gateway
wscat -c ws://localhost:18789

# Expected: Connection opens, send handshake:
# {"type":"handshake","agent":"test-client"}

# Should receive:
# {"type":"handshake-ack","accepted":true}
```

### Step 5: Check Redis Pub/Sub

```bash
# Connect to Redis CLI
docker exec heretek-redis redis-cli

# In Redis CLI:
# List all channels
PUBSUB CHANNELS "*"

# Check for A2A channels (should see agent-related channels)

# Test pub/sub connectivity
PUBLISH test-channel "test-message"

# Exit Redis CLI
EXIT
```

### Step 6: Analyze Gateway Logs

```bash
# Check Gateway logs for A2A errors
docker logs heretek-gateway --tail 200 | grep -i "a2a\|agent\|error\|websocket"

# Look for specific patterns:
docker logs heretek-gateway --tail 500 | grep -E "Failed|Error|Timeout|Disconnected"
```

**Key error patterns to look for:**
- `Failed to register agent` - Registration issue
- `WebSocket connection closed` - Connectivity issue
- `Message delivery failed` - Routing issue
- `Heartbeat timeout` - Agent not responding

### Step 7: Analyze Agent Logs

```bash
# Check specific agent logs (example: Steward)
docker logs heretek-steward --tail 200 | grep -i "gateway\|a2a\|connect"

# Check for connection errors
docker logs heretek-steward --tail 500 | grep -E "Failed|Error|Timeout|Reconnect"
```

---

## Recovery Procedures

### Procedure 1: Restart A2A Infrastructure

**Use when:** Complete A2A failure, multiple agents offline

```bash
cd /root/heretek/heretek-openclaw-core

# 1. Restart Redis (pub/sub backbone)
docker restart heretek-redis
sleep 5

# 2. Restart LiteLLM (agent registry)
docker restart heretek-litellm
sleep 10

# 3. Restart Gateway (A2A router)
docker restart heretek-gateway
sleep 5

# 4. Rolling restart of all agents
for agent in steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian; do
    echo "Restarting $agent..."
    docker restart heretek-$agent
    sleep 3
done

# 5. Verify recovery
sleep 15
curl -s http://localhost:18789/agent-status | jq '.onlineCount'
```

**Expected result:** `onlineCount` should be 11

### Procedure 2: Re-register Agents

**Use when:** Agents show online but can't communicate

```bash
# Force agent re-registration by restarting Gateway connection
for agent in steward alpha beta charlie examiner explorer sentinel coder dreamer empath historian; do
    docker exec heretek-$agent pkill -f "agent-client" || true
    sleep 2
done

# Agents should auto-reconnect within 30 seconds
# Verify registration
sleep 35
curl -s http://localhost:18789/agent-status | jq '.agents[] | {agentId, status}'
```

### Procedure 3: Clear Redis State

**Use when:** Stale agent data in Redis causing routing issues

```bash
# WARNING: This clears all Redis data
# Backup first if needed
docker exec heretek-redis redis-cli BGSAVE

# Clear all keys
docker exec heretek-redis redis-cli FLUSHALL

# Restart all services to re-populate
docker restart heretek-litellm heretek-gateway

# Wait for agents to re-register
sleep 30

# Verify
curl -s http://localhost:18789/agent-status | jq '.onlineCount'
```

### Procedure 4: Debug Single Agent Communication

**Use when:** One specific agent has issues

```bash
AGENT_NAME="steward"  # Change to affected agent
AGENT_PORT="8001"     # Corresponding port

# 1. Check agent container status
docker ps | grep heretek-$AGENT_NAME

# 2. Check agent logs for errors
docker logs heretek-$AGENT_NAME --tail 100

# 3. Test agent health endpoint
curl -v http://localhost:$AGENT_PORT/health

# 4. Check agent's Gateway connection
docker exec heretek-$AGENT_NAME cat /proc/$(pidof node)/fd | wc -l

# 5. Force restart this agent only
docker restart heretek-$AGENT_NAME

# 6. Monitor reconnection
watch -n 2 "curl -s http://localhost:18789/agent-status/$AGENT_NAME | jq .status"
```

---

## Prevention Measures

### Monitoring Setup

```bash
# Add to crontab for continuous monitoring
# Check A2A health every 5 minutes
*/5 * * * * curl -sf http://localhost:18789/agent-status | jq -e '.onlineCount >= 10' || \
    echo "A2A DEGRADED: $(date)" >> /root/.openclaw/logs/a2a-alerts.log
```

### Heartbeat Configuration

Ensure heartbeat is enabled in [`agent-client.js`](../../agents/lib/agent-client.js:57):

```javascript
// Default heartbeat interval: 30 seconds
this.heartbeatInterval = config.heartbeatInterval || 30000;
```

### Gateway Health Endpoint

Monitor the Gateway's [`/agent-status`](../../gateway/openclaw-gateway.js:698) endpoint:

```bash
# Continuous monitoring
watch -n 5 'curl -s http://localhost:18789/agent-status | jq "{online: .onlineCount, offline: .offlineCount}"'
```

### Log Aggregation

Set up log collection for A2A debugging:

```bash
# Create A2A log aggregation script
cat > /root/heretek/scripts/a2a-logs.sh << 'EOF'
#!/bin/bash
echo "=== Gateway Logs ==="
docker logs heretek-gateway --tail 50 2>&1 | grep -i "a2a\|agent"
echo ""
echo "=== LiteLLM Logs ==="
docker logs heretek-litellm --tail 50 2>&1 | grep -i "agent\|register"
EOF
chmod +x /root/heretek/scripts/a2a-logs.sh
```

---

## Escalation Path

### Level 1: On-Call Engineer
- **When:** Initial diagnosis and recovery procedures fail
- **Actions:** Execute all diagnostic steps, document findings
- **Contact:** [Configure your on-call contact]

### Level 2: Engineering Lead
- **When:** Recovery procedures don't restore A2A within 30 minutes
- **Actions:** Review logs, consider rollback to last known good state
- **Contact:** [Configure engineering lead contact]

### Level 3: System Architect
- **When:** Complete A2A failure with data loss or corruption
- **Actions:** Full system audit, potential rollback to backup
- **Contact:** [Configure architect contact]

---

## Reference

| Document | Purpose |
|----------|---------|
| [`RUNBOOK_GATEWAY_FAILURE.md`](./RUNBOOK_GATEWAY_FAILURE.md) | Gateway-specific failures |
| [`RUNBOOK_AGENT_OFFLINE.md`](./RUNBOOK_AGENT_OFFLINE.md) | Individual agent offline |
| [`AGENT-MONITORING.md`](./AGENT-MONITORING.md) | Monitoring overview |
| [`agent-client.js`](../../agents/lib/agent-client.js:1) | A2A client implementation |
| [`openclaw-gateway.js`](../../gateway/openclaw-gateway.js:1) | Gateway implementation |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-01 | Initial version |
