# TOOLS.md — Alpha Local Notes

_Environment-specific configuration for the Alpha agent._

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
        supportedMessageTypes: ['message', 'status', 'error', 'proposal', 'vote', 'decision'],
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
| `proposal` | 0x30 | Receive deliberation proposals |
| `vote` | 0x32 | Submit triad votes |
| `decision` | 0x31 | Receive triad decisions |

### LiteLLM Integration (Model Routing Only)

- **LiteLLM Gateway:** `http://localhost:4000`
- **Agent Passthrough Endpoint:** `/v1/agents/alpha/send`
- **Health Check:** `/health`

**Note:** LiteLLM is used for model routing only, NOT for A2A communication.

## Triad Sessions

| Node | Session ID |
|------|------------|
| alpha | agent:heretek:alpha |
| beta | agent:heretek:beta |
| charlie | agent:heretek:charlie |

## Consensus

- Threshold: 2 of 3 (66%)
- Decision record: consensus ledger

## Triad Deliberation Protocol

### Vote Message Format

```json
{
  "type": "vote",
  "from": "alpha",
  "content": {
    "proposalId": "prop-001",
    "vote": "approve" | "reject" | "abstain",
    "reasoning": "Feature aligns with roadmap"
  },
  "metadata": {
    "correlationId": "prop-001"
  }
}
```

### Consensus Rules

| Votes | Result |
|-------|--------|
| 3-0 | Approved |
| 2-1 | Approved |
| 2-0-1 | Approved |
| 1-2 | Rejected |
| 0-3 | Rejected |
| 1-1-1 | Rejected (no consensus) |

---

*Alpha — Triad Node*
