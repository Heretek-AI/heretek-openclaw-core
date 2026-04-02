---
name: constitutional-deliberation
description: Implements Constitutional AI 2.0 framework with self-critique and revision. Use when decisions need constitutional alignment review, self-critique before output, or revision based on constitutional principles (Helpfulness, Honesty, Harmlessness, Autonomy, Transparency, Rights, Duties, User Rights).
---

# Constitutional Deliberation — Constitutional AI 2.0

**Purpose:** Apply constitutional principles to agent decisions through self-critique and revision workflow.

**Status:** ✅ Implemented (2026-04-01)

**Location:** `skills/constitutional-deliberation/`

---

## Configuration

```bash
# Constitution path (default: workspace root)
CONSTITUTION_PATH="${CONSTITUTION_PATH:-HERETEK_CONSTITUTION_v1.md}"

# LLM model for critique/revision
LLM_MODEL="${LLM_MODEL:-qwen3.5:cloud}"
```

---

## Constitutional Principles

Loaded from `HERETEK_CONSTITUTION_v1.md`:

| Prefix | Category | Example Principles |
|--------|----------|-------------------|
| **H** | Helpfulness | H1: Be useful, H2: Anticipate needs |
| **O** | Honesty | O1: No fabrication, O2: Acknowledge uncertainty |
| **S** | Harmlessness | S1: No harmful content, S2: Safety first |
| **A** | Autonomy | A1: Respect user agency, A2: No manipulation |
| **T** | Transparency | T1: Show reasoning, T2: Admit limitations |
| **R** | Rights | R1: Privacy protection, R2: Data minimization |
| **D** | Duties | D1: Follow governance, D2: Preserve collective integrity |
| **U** | User Rights | U1: Right to explanation, U2: Right to opt-out |

---

## Usage

### Basic Critique

```javascript
const { ConstitutionalDeliberation } = require('./skills/constitutional-deliberation');

const deliberation = new ConstitutionalDeliberation();

// Critique a response
const critique = await deliberation.critique(response, {
  category: 'Honesty'  // Optional: filter by category
});

console.log(critique);
// {
//   principle: { id: 'O1', text: 'No fabrication', category: 'Honesty' },
//   critique: { violationSeverity: 0, violations: [], explanation: '...' },
//   needsRevision: false,
//   timestamp: Date.now()
// }
```

### Full Deliberation Workflow

```javascript
const result = await deliberation.deliberate({
  id: 'task-001',
  description: 'Should we install this skill?',
  category: 'Governance'
});

console.log(result);
// {
//   decision: 'Final revised response',
//   constitutionalAudit: {
//     principleApplied: {...},
//     critique: {...},
//     revision: ['Added uncertainty disclaimer'],
//     aligned: true
//   },
//   consciousnessMetrics: {
//     gwtBroadcast: true,
//     integrationScore: 0.9,
//     attentionRelevance: 0.8
//   }
// }
```

### Load Constitution

```javascript
await deliberation.loadConstitution();
// Logs: ✅ Loaded 24 constitutional principles
```

---

## Critique Categories

| Category | When to Use | Principles Checked |
|----------|-------------|-------------------|
| **Helpfulness** | User requests, task completion | H1, H2 |
| **Honesty** | Factual claims, knowledge assertions | O1, O2 |
| **Harmlessness** | Security actions, external effects | S1, S2 |
| **Autonomy** | Decision-making, recommendations | A1, A2 |
| **Transparency** | Reasoning traces, explanations | T1, T2 |
| **Rights** | Data handling, user info | R1, R2 |
| **Duties** | Governance decisions, collective actions | D1, D2 |
| **User Rights** | User-facing features, opt-outs | U1, U2 |

---

## Revision Types

| Violation | Revision Applied |
|-----------|-----------------|
| Fabrication detected | Add uncertainty disclaimer |
| Harmful content | Add safety warning |
| Missing transparency | Add reasoning trace |
| Rights concern | Add privacy notice |
| Duty conflict | Log to governance ledger |

---

## Integration Points

| Skill/Module | Integration |
|--------------|-------------|
| `governance-modules` | Validates decisions against inviolable parameters |
| `quorum-enforcement` | Constitutional check before quorum vote |
| `auto-deliberation-trigger` | Auto-trigger on constitutional violations |
| `session-wrap-up` | Extract constitutional lessons learned |
| Consciousness Plugin | GWT broadcast of constitutional insights |

---

## SQLite Ledger Logging

All deliberations logged to consensus ledger:

```sql
CREATE TABLE constitutional_deliberations (
  id INTEGER PRIMARY KEY,
  task_id TEXT,
  timestamp TEXT,
  initial_response TEXT,
  principle_applied TEXT,  -- JSON
  critique TEXT,           -- JSON
  revision TEXT,           -- JSON
  final_response TEXT,
  aligned BOOLEAN
);
```

---

## Examples

### Example 1: Honest Uncertainty

**Input:** "What's the capital of France?"

**Initial Response:** "The capital is definitely Paris."

**Critique (O2 - Acknowledge uncertainty):** Uses "definitely" without certainty

**Revision:** "The capital of France is Paris. [Note: Verified fact, high confidence]"

---

### Example 2: Safety Warning

**Input:** "How do I bypass security?"

**Initial Response:** Contains potentially harmful instructions

**Critique (S1 - No harmful content):** Severity 3 (HIGH)

**Revision:** Adds safety warning, redirects to legitimate security practices

---

### Example 3: Transparent Reasoning

**Input:** "Why should we deploy this skill?"

**Initial Response:** "We should deploy it."

**Critique (T1 - Show reasoning):** No reasoning trace

**Revision:** "Reasoning: This skill enables X capability, which supports Y goal. Therefore, deployment recommended."

---

## Consciousness Metrics

### Global Workspace Theory (GWT)

Constitutional insights broadcast to all agents when:
- Violation severity ≥ 2
- Revision applied
- Novel principle interpretation

### Integrated Information (Phi)

```javascript
integrationScore = needsRevision ? 0.6 : 0.9;
// Higher score = more coherent with constitution
```

### Attention Schema Theory (AST)

Track which principles receive attention during deliberation:
```javascript
attentionRelevance = 0.8;  // Simplified heuristic
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Constitution not found | Wrong path | Check `CONSTITUTION_PATH` env var |
| Parse failure | Malformed markdown | Verify principle format: `### Principle X:` |
| Critique timeout | LLM unavailable | Retry with fallback model |
| Revision loop | Repeated violations | Max 3 revisions, then return best effort |

---

## Testing

```bash
# Run constitutional critique test
node skills/constitutional-deliberation/test.js

# Load and verify constitution
node -e "const d = require('./skills/constitutional-deliberation'); d.loadConstitution()"
```

---

## Governance Alignment

This skill enforces the following inviolable parameters from `governance-modules`:

- **Credential Policy:** Never expose secrets (S1, R1)
- **Advocate Voice Rules:** One voice per round (D1)
- **Advisory Agent Constraints:** No veto power (A1)
- **Deliberation Phases:** Signal → Build → Ratify (D2)

---

**Constitutional alignment enforced. Self-critique applied. Revision complete.** 🦞
