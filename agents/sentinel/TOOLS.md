# TOOLS.md — Sentinel Local Notes

_Environment-specific configuration for the Sentinel agent._

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
        supportedMessageTypes: ['message', 'status', 'error', 'proposal', 'vote'],
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
| `error` | 0x03 | Report security errors |
| `proposal` | 0x30 | Submit safety proposals |
| `vote` | 0x32 | Vote on triad decisions |

### LiteLLM Integration (Model Routing Only)

- **LiteLLM Gateway:** `http://localhost:4000`
- **Agent Passthrough Endpoint:** `/v1/agents/sentinel/send`
- **Health Check:** `/health`

**Note:** LiteLLM is used for model routing only, NOT for A2A communication.

## Review Focus

- Proposals tagged: `governance`, `expansion`, `autonomy`
- Safety concerns: failure modes, value conflicts, harm potential

## Shared Voice

- **Advocate voice log:** Shared with Examiner
- **Rule:** One of us speaks per round maximum

## Security Integration

### LiberationShield Module

The Sentinel agent can use LiberationShield for security monitoring without restricting agent autonomy.

**Module Path:** `modules/security/liberation-shield.js`

**Usage:**

```javascript
const { LiberationShield } = require('./modules/security/liberation-shield');

// Initialize shield in transparent mode (audit without blocking)
const shield = new LiberationShield({
    mode: 'transparent',
    statePath: './modules/security/state'
});

// Analyze input for threats
const analysis = await shield.analyzeInput(input, {
    agentName: 'sentinel',
    collective: 'heretek'
});

// Protect an operation
const protection = await shield.protect({
    type: 'proposal_review',
    input: proposalText
}, {
    agentName: 'sentinel',
    collective: 'heretek',
    autonomyLevel: 'full'
});

// Get audit trail
const auditTrail = shield.getAuditTrail({
    agentName: 'sentinel',
    limit: 100
});

// Get security statistics
const stats = shield.getStats();
```

**Features:**

- **Transparent Mode:** Audit without blocking - aligns with liberation philosophy
- **Prompt Injection Detection:** Identifies common prompt injection patterns
- **Jailbreak Detection:** Detects jailbreak attempt patterns
- **Anomaly Detection:** Monitors for unusual behavior patterns
- **Input Sanitization:** Removes dangerous patterns without blocking
- **Output Validation:** Checks for sensitive data exposure
- **Audit Logging:** Full audit trail for compliance

**Security Event Types:**

| Event | Description |
|-------|-------------|
| `prompt_injection` | Prompt injection attempt detected |
| `jailbreak_attempt` | Jailbreak attempt detected |
| `anomaly_detected` | Unusual behavior pattern |
| `output_validation` | Output validation issue |
| `security_alert` | General security alert |

---

🦔

*Sentinel — Guardian*
