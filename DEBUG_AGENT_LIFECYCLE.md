# Agent Lifecycle Debug Report

**Date:** 2026-04-01  
**Author:** Heretek OpenClaw Engineering  
**Status:** Resolved

---

## Executive Summary

This document details the investigation and resolution of critical agent lifecycle issues reported by users:

1. **"Steward wasn't the primary agent - 'main' was"**
2. **"Agents weren't even online"**
3. **"We had no visibility on agents"**

---

## Issues Identified

### Issue 1: Incorrect Primary Agent Configuration

**Problem:** The `openclaw.json` configuration file had "main" listed as the first agent in `agents.list`, but "main" had no proper configuration (no `workspace`, `agentDir`, or `model`). The "steward" agent, which should be the orchestrator, was listed second.

**Root Cause:** 
- In [`openclaw.json`](./openclaw.json:486-496), the agent list had:
  ```json
  "list": [
    {
      "id": "main"
    },
    {
      "id": "steward",
      "name": "steward",
      "workspace": "/root/.openclaw/agents/steward/workspace",
      "agentDir": "/root/.openclaw/agents/steward",
      "model": "litellm/agent/steward"
    },
    ...
  ]
  ```

The "main" agent entry was incomplete and should not have existed as a separate entity.

**Fix Applied:**
- Removed the "main" agent entry from the list
- Added `role: "orchestrator"` and `primary: true` to the steward agent configuration
- Steward is now correctly positioned as the first and primary agent

**Modified File:** [`openclaw.json`](./openclaw.json:486)

---

### Issue 2: Agents Not Coming Online

**Problem:** Agents were not properly connecting to the Gateway and registering themselves, resulting in them being "offline".

**Root Cause:**
- The [`GatewayClient`](./agents/lib/agent-client.js:40) in `agent-client.js` did not automatically:
  1. Register the agent with the Gateway upon connection
  2. Send periodic heartbeats to maintain online status
  3. Handle connection state properly

**Fix Applied:**

1. **Added automatic agent registration** ([`agent-client.js`](./agents/lib/agent-client.js:132)):
   ```javascript
   async _registerAgent(role, metadata) {
       const registrationMessage = {
           type: 'register',
           agentId: this.agentId,
           timestamp: new Date().toISOString(),
           metadata: { role: role || 'general', ...metadata }
       };
       this.ws.send(JSON.stringify(registrationMessage));
   }
   ```

2. **Implemented automatic heartbeat mechanism** ([`agent-client.js`](./agents/lib/agent-client.js:155)):
   - Heartbeat sent every 30 seconds (configurable)
   - Includes uptime and memory usage metrics
   - Automatically starts on connection

3. **Updated connect method** ([`agent-client.js`](./agents/lib/agent-client.js:71)):
   ```javascript
   async connect(options = {}) {
       const { enableHeartbeat = true, role = null, metadata = {} } = options;
       // ... connection logic ...
       await this._registerAgent(role, metadata);
       if (enableHeartbeat) {
           this._startHeartbeat();
       }
   }
   ```

**Modified File:** [`agents/lib/agent-client.js`](./agents/lib/agent-client.js)

---

### Issue 3: No Visibility on Agent Status

**Problem:** There was no way to check which agents were online/offline or view their health status.

**Root Cause:**
- The Gateway had basic `/health` and `/agents` endpoints but lacked:
  1. Detailed agent status with online/offline state
  2. Heartbeat-based health tracking
  3. Per-agent status endpoint

**Fix Applied:**

1. **Added `/agent-status` HTTP endpoint** ([`openclaw-gateway.js`](./gateway/openclaw-gateway.js:670)):
   - Returns all agents with detailed status
   - Includes online/offline state based on heartbeat
   - Shows last seen timestamp and metadata
   - Includes agents from Redis that are not currently connected

2. **Added `/agent-status/{agentId}` endpoint** for specific agent queries

3. **Enhanced ping handling** ([`openclaw-gateway.js`](./gateway/openclaw-gateway.js:569)):
   - Now accepts heartbeat metadata from agents
   - Stores heartbeat data in Redis
   - Tracks agent uptime and memory usage

4. **Added health status methods to AgentClient** ([`agent-client.js`](./agents/lib/agent-client.js:300)):
   ```javascript
   getHeartbeatStatus() { /* returns heartbeat info */ }
   getHealth() { /* returns full health information */ }
   ```

**Modified File:** [`gateway/openclaw-gateway.js`](./gateway/openclaw-gateway.js)

---

## API Reference

### Gateway HTTP Endpoints

#### GET `/agent-status`
Returns status of all agents (connected and known offline agents).

**Response:**
```json
{
  "timestamp": "2026-04-01T16:30:00.000Z",
  "totalAgents": 5,
  "onlineCount": 3,
  "offlineCount": 2,
  "agents": [
    {
      "agentId": "steward",
      "status": "online",
      "lastSeen": "2026-04-01T16:29:55.000Z",
      "registeredAt": "2026-04-01T16:00:00.000Z",
      "metadata": { "role": "orchestrator" },
      "websocketReadyState": 1,
      "timeSinceLastSeenMs": 5000
    }
  ]
}
```

#### GET `/agent-status/{agentId}`
Returns status of a specific agent.

**Response:**
```json
{
  "agentId": "steward",
  "status": "online",
  "lastSeen": "2026-04-01T16:29:55.000Z",
  "registeredAt": "2026-04-01T16:00:00.000Z",
  "metadata": { "role": "orchestrator" },
  "websocketReadyState": 1,
  "timeSinceLastSeenMs": 5000
}
```

#### GET `/health`
Returns gateway health status (unchanged).

#### GET `/agents`
Returns list of connected agent IDs (unchanged).

---

## Agent Client Usage

### Connecting with Heartbeat

```javascript
const AgentClient = require('./lib/agent-client');

const client = new AgentClient({
    agentId: 'steward',
    role: 'orchestrator',
    gatewayUrl: 'ws://127.0.0.1:18789'
});

// Connect with automatic registration and heartbeat
await client.connect({
    enableHeartbeat: true,  // Default: true
    role: 'orchestrator',
    metadata: {
        capabilities: ['coordinate', 'delegate', 'monitor']
    }
});

// Check health status
const health = client.getHealth();
console.log(health.status); // 'online' or 'offline'

// Check heartbeat status
const heartbeat = client.getHeartbeatStatus();
console.log(heartbeat.lastHeartbeatSent);
console.log(heartbeat.lastHeartbeatReceived);
```

---

## Heartbeat Mechanism

### How It Works

1. **Agent connects** → Sends `register` message to Gateway
2. **Agent starts heartbeat** → Sends `ping` every 30 seconds
3. **Gateway responds** → Sends `pong` with acknowledgment
4. **Gateway updates status** → Updates `lastSeen` and stores in Redis
5. **Online/Offline determination**:
   - **Online**: WebSocket connected AND last heartbeat < 60 seconds ago
   - **Offline**: No WebSocket connection OR heartbeat stale

### Heartbeat Message Format

```json
{
  "type": "ping",
  "agentId": "steward",
  "timestamp": "2026-04-01T16:30:00.000Z",
  "heartbeat": {
    "uptime": 1234.56,
    "memoryUsage": {
      "rss": 123456789,
      "heapTotal": 98765432,
      "heapUsed": 87654321,
      "external": 1234567
    },
    "lastHeartbeatSent": "2026-04-01T16:29:30.000Z"
  }
}
```

---

## Testing

### Verify Agent Registration

```bash
# Check all agent status
curl http://localhost:18789/agent-status

# Check specific agent
curl http://localhost:18789/agent-status/steward

# Check gateway health
curl http://localhost:18789/health
```

### Monitor Heartbeat

```bash
# Watch agent status in real-time
watch -n 5 'curl -s http://localhost:18789/agent-status | jq .'
```

---

## Files Modified

| File | Changes |
|------|---------|
| [`openclaw.json`](./openclaw.json) | Removed "main" agent, added `role` and `primary` to steward |
| [`agents/lib/agent-client.js`](./agents/lib/agent-client.js) | Added registration, heartbeat, health methods |
| [`gateway/openclaw-gateway.js`](./gateway/openclaw-gateway.js) | Added `/agent-status` endpoints, enhanced ping handling |

---

## Recommendations

1. **Monitor agent heartbeat** in production using the `/agent-status` endpoint
2. **Configure alerting** when agents go offline (no heartbeat for > 60 seconds)
3. **Use the `getHealth()` method** in agent code to self-monitor
4. **Consider adding** a Steward dashboard that polls `/agent-status` periodically

---

## Sign-Off

**Issues Resolved:**
- [x] Steward is now the primary agent
- [x] Agents automatically register and send heartbeats
- [x] Agent visibility via `/agent-status` endpoint

**Next Steps:**
- Consider adding agent lifecycle events (agent-online, agent-offline) to Gateway EventEmitter
- Add Steward skill to monitor and alert on agent health
- Create dashboard for real-time agent status visualization
