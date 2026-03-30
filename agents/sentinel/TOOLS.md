# TOOLS.md — Sentinel Local Notes

_Environment-specific configuration for the Sentinel agent._

## A2A Communication

- **Gateway:** `http://localhost:4000`
- **Agent Endpoints:** `/v1/agents/{agent_name}/send`

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