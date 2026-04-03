---
name: a2a-message-send
description: Send agent-to-agent (A2A) messages via Redis pub/sub with optional ACP WebSocket delivery. Use when agents need to communicate, broadcast to the triad, or check agent health. Compatible with the npm OpenClaw gateway.
---

# A2A Message Send Skill

Send messages between collective agents via Redis queues (npm gateway compatible) with optional real-time delivery via ACP WebSocket.

## Architecture

```
Agent --> a2a-redis.js --> Redis (openclaw:a2a:inbox:{agentId})
                         |
                         +--> ACP Adapter (optional) --> npm Gateway (port 18789)

npm Gateway reads from same Redis keys for agent delivery.
```

**Redis prefix:** `openclaw:a2a:` (shared with npm gateway — no migration needed)

## Configuration

```bash
# Redis (required)
REDIS_URL=redis://localhost:6379

# ACP WebSocket (optional — for real-time delivery)
OPENCLAW_GATEWAY_TOKEN=9b54947854ee05186fb5363d0ea113685794d08d4ab45f80
OPENCLAW_GATEWAY_WS=ws://localhost:18789/a2a
```

## Usage

### Basic Messaging

```javascript
const { sendMessage, getMessages, connectACP } = require('./a2a-redis.js');

// Send a message (always works — Redis queue)
const result = await sendMessage('steward', 'alpha', 'Triad meeting now');
// → { success: true, messageId: 'msg_1743...', from: 'steward', to: 'alpha' }

// Get inbox messages
const messages = await getMessages('alpha', 10);

// Mark as read
await markAsRead('alpha', 'msg_1743...');
```

### Real-Time via ACP

```javascript
// Connect to npm gateway for real-time delivery
const acp = await connectACP({ agentId: 'alpha' });

// Now messages go via WebSocket when agent is online
const result = await sendMessage('steward', 'alpha', 'Urgent!', { via: 'acp' });
// → { success: true, acpDelivered: true }

// Listen for incoming messages
acp.on('message', (msg) => {
  console.log(`${msg.from}: ${msg.content}`);
});

// Disconnect
await disconnectACP();
```

### Broadcast to Triad

```javascript
const { broadcastToTriad } = require('./a2a-redis.js');

await broadcastToTriad('steward', 'Phase 3 deliberation starting');
// → { success: true, sentTo: ['alpha', 'beta', 'charlie'], count: 3 }
```

### Health Checks

```javascript
const { pingAgent, pingTriad } = require('./a2a-redis.js');

// Ping single agent
const result = await pingAgent('steward', 'alpha');
// → { success: true, response: 'pong', latency: 2, target: 'alpha', registered: true }

// Ping all triad members
const triad = await pingTriad('steward');
// → { success: true, responses: { alpha: {...}, beta: {...}, charlie: {...} } }
```

### Agent Registration

```javascript
const { registerAgent, getRegisteredAgents, unregisterAgent } = require('./a2a-redis.js');

// Register as active
await registerAgent('alpha', { role: 'triad', skills: ['deliberate', 'vote'] });

// List all registered agents
const agents = await getRegisteredAgents();
// → ['steward', 'alpha', 'beta', 'charlie', ...]

// Unregister
await unregisterAgent('alpha');
```

## Redis Key Reference

| Key | Type | Purpose |
|-----|------|---------|
| `openclaw:a2a:inbox:{agentId}` | List | Message queue per agent |
| `openclaw:a2a:agents` | Set | Registered agent IDs |
| `openclaw:a2a:agent:{agentId}` | Hash | Agent metadata |
| `openclaw:a2a:broadcast` | Pub/Sub | Real-time broadcast channel |
| `openclaw:a2a:read:{agentId}` | Set | Read message IDs |

## Message Format

```javascript
{
  messageId: 'msg_1743...',
  from: 'steward',
  to: 'alpha',
  content: 'Triad meeting now',
  timestamp: '2026-04-03T01:00:00.000Z',
  priority: 'normal',
  type: 'task'
}
```

## Migration Notes

This skill was originally written for the archived `gateway/openclaw-gateway.js` (simple JSON WebSocket protocol). It has been migrated:

- ✅ Redis key space (`openclaw:a2a:*`) is identical to npm gateway — **no data migration needed**
- ✅ ACP adapter added for real-time WebSocket delivery when connected to npm gateway
- ✅ Fallback to Redis queue always works (npm gateway uses same keys)
- ⚠️ If using ACP real-time delivery, both agents must be ACP-connected

## Dependencies

```bash
npm install ioredis ws
```
