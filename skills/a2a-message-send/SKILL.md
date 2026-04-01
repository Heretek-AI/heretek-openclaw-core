# A2A Message Send Skill

**Version:** 1.0.0  
**Type:** Communication  
**Backend:** Redis

## Overview

Provides agent-to-agent (A2A) communication capabilities for the OpenClaw collective via Redis pub/sub messaging. This skill enables agents to send messages, broadcast to groups, manage inboxes, and perform health checks.

## Architecture

```
┌─────────────┐     Redis      ┌─────────────┐
│   Agent A   │ ◄───────────► │    Redis    │
│  (steward)  │    Pub/Sub    │   :6379     │
├─────────────┤               │  Lists +    │
│   Agent B   │ ◄───────────► │   Sets      │
│   (alpha)   │    Redis      └─────────────┘
└─────────────┘    Commands
```

### Redis Data Structures

- `openclaw:a2a:inbox:{agentId}` - List storing messages for each agent
- `openclaw:a2a:agents` - Set of registered agent IDs
- `openclaw:a2a:agent:{agentId}` - Hash with agent metadata
- `openclaw:a2a:broadcast` - Pub/sub channel for broadcasts
- `openclaw:a2a:read:{agentId}` - Set of read message IDs

## Installation

### Prerequisites

- Redis server running and accessible
- Node.js 18+
- `ioredis` package installed

### Setup

```bash
# Install dependency
npm install ioredis

# Set environment variables
export REDIS_URL=redis://localhost:6379
# Or
export REDIS_HOST=localhost
export REDIS_PORT=6379
```

## Usage

### Basic Messaging

```javascript
const { sendMessage, getMessages } = require('./skills/a2a-message-send/a2a-redis.js');

// Send a message from steward to alpha
const result = await sendMessage('steward', 'alpha', 'Hello Alpha!');
console.log(result);
// { success: true, messageId: 'msg_...', from: 'steward', to: 'alpha', ... }

// Get messages from alpha's inbox
const messages = await getMessages('alpha', 10);
console.log(messages);
// [{ messageId, from, to, content, timestamp, ... }, ...]
```

### Broadcasting

```javascript
const { broadcast, broadcastToTriad, broadcastToAgents } = require('./a2a-redis.js');

// Broadcast to all agents
const result = await broadcast('steward', 'Meeting in 5 minutes!');

// Broadcast to triad only
const triadResult = await broadcastToTriad('coordinator', 'Triad deliberation needed');

// Broadcast to specific agents
const customResult = await broadcastToAgents('steward', ['alpha', 'beta', 'coder'], 'Task update');
```

### Inbox Management

```javascript
const { getMessages, countMessages, clearMessages, markAsRead, getUnreadMessages } = require('./a2a-redis.js');

// Count messages
const { count } = await countMessages('alpha');

// Get unread messages only
const unread = await getUnreadMessages('alpha', 10);

// Mark message as read
await markAsRead('alpha', 'msg_123');

// Clear all messages
await clearMessages('alpha');
```

### Health Checks

```javascript
const { pingAgent, pingTriad } = require('./a2a-redis.js');

// Ping a single agent
const pingResult = await pingAgent('steward', 'alpha');
console.log(pingResult);
// { success: true, response: 'pong', latency: 5, target: 'alpha', registered: true }

// Ping all triad members
const triadPing = await pingTriad('steward');
console.log(triadPing.responses);
// { alpha: {...}, beta: {...}, charlie: {...} }
```

### Agent Registration

```javascript
const { registerAgent, unregisterAgent, getRegisteredAgents } = require('./a2a-redis.js');

// Register an agent
await registerAgent('steward', { role: 'orchestrator', capabilities: ['coordinate', 'delegate'] });

// Get all registered agents
const agents = await getRegisteredAgents();
console.log(agents);
// ['steward', 'alpha', 'beta', ...]

// Unregister an agent
await unregisterAgent('steward');
```

## API Reference

### Core Functions

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `sendMessage(from, to, content, options)` | Send message to agent | `from`: sender ID, `to`: recipient ID, `content`: message, `options`: {priority, type, metadata} | `{success, messageId, from, to, timestamp}` |
| `getMessages(agentId, limit)` | Get messages from inbox | `agentId`: recipient ID, `limit`: max messages | `Array<Message>` |
| `getUnreadMessages(agentId, limit)` | Get unread messages | `agentId`: recipient ID, `limit`: max messages | `Array<Message>` |
| `markAsRead(agentId, messageId)` | Mark message as read | `agentId`: owner ID, `messageId`: ID to mark | `{success, agentId, messageId}` |
| `countMessages(agentId)` | Count inbox messages | `agentId`: owner ID | `{count, agentId}` |
| `clearMessages(agentId)` | Clear all messages | `agentId`: owner ID | `{success, agentId}` |

### Broadcast Functions

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `broadcast(from, content)` | Broadcast to all agents | `from`: sender ID, `content`: message | `{success, from, count, timestamp}` |
| `broadcastToAll(from, content)` | Alias for broadcast | Same as broadcast | Same as broadcast |
| `broadcastToAgents(from, agents, content)` | Broadcast to specific agents | `from`: sender ID, `agents`: array, `content`: message | `{success, from, sentTo, count}` |
| `broadcastToTriad(from, content)` | Broadcast to triad | `from`: sender ID, `content`: message | `{success, from, recipients, count}` |

### Health Check Functions

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `pingAgent(from, to)` | Ping an agent | `from`: sender ID, `to`: target ID | `{success, response, latency, target, registered}` |
| `pingTriad(from)` | Ping all triad members | `from`: sender ID | `{success, from, responses, timestamp}` |

### Validation Functions

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `validateMessage(message)` | Validate message format | `message`: message object | `{valid, errors}` |
| `validateAgentId(agentId)` | Validate agent ID format | `agentId`: ID to validate | `boolean` |

### Agent Registration Functions

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `registerAgent(agentId, metadata)` | Register an agent | `agentId`: ID, `metadata`: optional info | `{success, agentId, timestamp}` |
| `unregisterAgent(agentId)` | Unregister an agent | `agentId`: ID to remove | `{success, agentId}` |
| `getRegisteredAgents()` | Get all registered agents | None | `Array<string>` |

### Connection Management

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `getRedisClient()` | Get Redis client instance | None | `Redis` client |
| `closeRedisClient()` | Close Redis connection | None | `Promise<void>` |

## Message Format

```javascript
{
    messageId: 'msg_1712000000000_abc123',  // Unique message ID
    from: 'steward',                          // Sender agent ID
    to: 'alpha',                              // Recipient agent ID
    content: 'Hello!',                        // Message content (string or JSON)
    timestamp: '2026-04-01T12:00:00.000Z',   // ISO 8601 timestamp
    priority: 'normal',                       // 'low', 'normal', 'high', 'urgent'
    type: 'task',                             // 'task', 'query', 'response', 'broadcast'
    inReplyTo: 'msg_...',                     // Original message ID (for responses)
    metadata: {}                              // Custom metadata
}
```

## Known Agents

The following agents are pre-registered in the OpenClaw collective:

- **steward** - Orchestrator
- **alpha, beta, charlie** - Triad (deliberation)
- **examiner** - Interrogator
- **explorer** - Scout
- **sentinel, sentinel-prime** - Guardian
- **coder** - Artisan
- **dreamer** - Visionary
- **empath** - Diplomat
- **historian** - Archivist
- **arbiter** - Adjudicator
- **catalyst** - Accelerator
- **chronos** - Timekeeper
- **coordinator** - Integrator
- **echo** - Communicator
- **habit-forge** - Optimizer
- **metis** - Strategist
- **nexus** - Connector
- **perceiver** - Sensor
- **prism** - Analyzer

## Error Handling

All functions return a result object with a `success` flag. When `success` is `false`, an `error` property contains the error message.

```javascript
const result = await sendMessage('steward', 'invalid-agent', 'Test');
if (!result.success) {
    console.error('Send failed:', result.error);
    // Handle error
}
```

### Common Errors

- `Invalid sender agent ID` - Sender ID doesn't match expected format
- `Invalid recipient agent ID` - Recipient ID doesn't match expected format
- `Redis connection failed` - Cannot connect to Redis server
- `Invalid message` - Message validation failed

## Testing

Run the test suite:

```bash
# Run A2A message send tests
node --test tests/skills/a2a-message-send.test.js

# Run integration tests
npm run test:integration
```

## Integration with Agent Client

The `agent-client.js` library automatically uses this skill for A2A communication when Redis is available:

```javascript
const AgentClient = require('./agents/lib/agent-client');
const client = new AgentClient({
    agentId: 'steward',
    role: 'orchestrator',
    gatewayUrl: 'ws://localhost:18789'
});

// Send message (uses Redis backend)
await client.sendMessage('alpha', { task: 'Analyze this' });

// Broadcast
await client.broadcast('Attention all agents!');
```

## See Also

- [`../modules/communication/redis-websocket-bridge.js`](../modules/communication/redis-websocket-bridge.js) - Redis to WebSocket bridge
- [`../gateway/openclaw-gateway.js`](../gateway/openclaw-gateway.js) - OpenClaw Gateway server
- [`../../agents/lib/agent-client.js`](../../agents/lib/agent-client.js) - Agent client library
- [`../../tests/skills/a2a-message-send.test.js`](../../tests/skills/a2a-message-send.test.js) - Test suite
