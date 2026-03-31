# TOOLS.md — Steward Local Notes

_Environment-specific configuration for the Steward agent._

## A2A Communication

### Gateway WebSocket RPC

- **Gateway Endpoint:** `ws://127.0.0.1:18789`
- **WebSocket Subprotocol:** `a2a-v1`
- **Message Format:** A2A Protocol v1.0.0

### Connection Example

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:18789', ['a2a-v1']);

ws.on('open', () => {
  // Send handshake
  ws.send(JSON.stringify({
    type: 'handshake',
    content: {
      action: 'advertise',
      capabilities: {
        supportedMessageTypes: ['message', 'status', 'error', 'proposal', 'broadcast'],
        version: '1.0.0'
      }
    }
  }));
});
```

### Message Types Used

| Type | Code | Purpose |
|------|------|---------|
| `message` | 0x01 | Send/receive agent messages |
| `status` | 0x02 | Broadcast status updates |
| `proposal` | 0x30 | Initiate triad deliberation |
| `broadcast` | 0x35 | Multi-agent announcements |

### LiteLLM Integration (Model Routing Only)

- **LiteLLM Gateway:** `http://localhost:4000`
- **Agent Passthrough Endpoint:** `/v1/agents/steward/send`
- **Health Check:** `/health`

**Note:** LiteLLM is used for model routing only, NOT for A2A communication.

## Agent Sessions

| Agent | Session ID |
|-------|------------|
| steward | agent:heretek:steward |
| alpha | agent:heretek:alpha |
| beta | agent:heretek:beta |
| charlie | agent:heretek:charlie |
| examiner | agent:heretek:examiner |
| explorer | agent:heretek:explorer |
| sentinel | agent:heretek:sentinel |
| coder | agent:heretek:coder |

## Heartbeat Intervals

- Triad health check: Every 10 minutes
- Agent pulse monitoring: Every 60 seconds

## Git Configuration

- Default remote: origin
- Push on ratification: Yes

---

🦞

*Steward — Orchestrator*
