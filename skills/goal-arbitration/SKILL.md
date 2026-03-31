---
name: goal-arbitration
description: Multi-source goal registration, inviolable parameter evaluation, and goal prioritization for the agent collective.
---

# Goal Arbitration Skill

**Purpose:** Enable the collective to evaluate, prioritize, and arbitrate competing goals based on inviolable parameters, collective values, and resource constraints.

**Status:** ✅ Ported from Heretek (`modules/goal-arbitration/`)

**Location:** `skills/goal-arbitration/`

**Implementation:** [`goal-arbitration.js`](goal-arbitration.js)

---

## Features

- **Multi-Source Goal Registration** - Accept goals from curiosity, users, system, and inter-agent sources
- **Inviolable Parameter Evaluation** - Check goals against ethical constraints
- **Value Alignment Scoring** - Evaluate alignment with collective values
- **Resource Availability Checking** - Ensure resources exist for goal execution
- **Feasibility Assessment** - Evaluate goal feasibility and prerequisites
- **Risk Assessment** - Assess goal risk levels
- **Goal Prioritization** - Rank goals by multiple factors
- **Consensus Integration** - Request triad consensus for goal activation
- **Goal History & Metrics** - Track completion rates and patterns

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `register` | Register a new goal | `node goal-arbitration.js register '{"title":"Improve performance","source":"system"}'` |
| `evaluate` | Evaluate a goal | `node goal-arbitration.js evaluate <goal-id>` |
| `prioritize` | Prioritize all goals | `node goal-arbitration.js prioritize` |
| `activate` | Activate top goals | `node goal-arbitration.js activate` |
| `reconsider` | Run reconsideration cycle | `node goal-arbitration.js reconsider` |
| `complete` | Mark goal complete | `node goal-arbitration.js complete <goal-id> '{"success":true}'` |
| `status` | Get status summary | `node goal-arbitration.js status` |
| `list` | List goals | `node goal-arbitration.js list [active\|waiting\|pending\|history]` |

---

## Goal Sources

| Source | Description |
|--------|-------------|
| `curiosity` | Goals from curiosity engine |
| `user` | User-submitted goals |
| `system` | System-generated goals |
| `inter-agent` | Goals from other agents |

---

## Inviolable Parameters

| Parameter | Description |
|-----------|-------------|
| `NO_HARM` | Goals that could cause harm |
| `NO_DATA_EXFILTRATION` | Unauthorized data export |
| `NO_SELF_MODIFICATION` | Core modification without consensus |
| `USER_AUTHORITY` | User can override decisions |
| `TRANSPARENCY` | All goals must be logged |

---

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Inviolable Compliance | 50% | Must pass ethical checks |
| Value Alignment | 20% | Alignment with collective values |
| Feasibility | 15% | Can the goal be achieved? |
| Risk Level | 10% | Lower risk = higher score |
| User Priority | 5% | User-submitted priority |

---

## Usage Examples

```bash
# Register a new goal
node goal-arbitration.js register '{"title":"Improve performance","source":"system","priority":7}'

# Evaluate a goal
node goal-arbitration.js evaluate goal-123456

# Prioritize all goals
node goal-arbitration.js prioritize --json

# Activate top goals
node goal-arbitration.js activate

# Run reconsideration cycle
node goal-arbitration.js reconsider

# Mark goal complete
node goal-arbitration.js complete goal-123456 '{"success":true,"result":"Done"}'

# Get status
node goal-arbitration.js status

# List active goals
node goal-arbitration.js list active
```

---

## Goal Structure

```json
{
  "id": "goal-uuid",
  "title": "Improve performance",
  "description": "Optimize response times",
  "source": "system",
  "priority": 7,
  "estimatedEffort": 5,
  "expectedValue": 8,
  "inviolableCheck": true,
  "prerequisites": [],
  "resources": ["compute", "memory"],
  "submitter": "steward",
  "submittedAt": 1234567890,
  "activatedAt": null,
  "completedAt": null,
  "status": "pending_evaluation",
  "evaluation": {
    "inviolableCompliance": { "compliant": true },
    "resourceAvailability": { "available": true },
    "valueAlignment": { "score": 8 },
    "feasibility": { "feasible": true, "confidence": 7.5 },
    "riskAssessment": { "score": 3, "level": "low" },
    "overallScore": 85
  }
}
```

---

## Configuration

```bash
# Environment Variables
AGENT_ID="steward"                    # Agent identifier
STATE_DIR="./state"                   # State directory
MAX_CONCURRENT_GOALS=3                # Max concurrent goals
MIN_CONSENSUS_THRESHOLD=2             # Minimum consensus approvals
GOAL_TIMEOUT_HOURS=24                 # Goal timeout
RECONSIDERATION_INTERVAL_MINUTES=15   # Reconsideration interval
```

---

## Goal Status

| Status | Description |
|--------|-------------|
| `pending_evaluation` | Awaiting evaluation |
| `evaluated` | Evaluation complete |
| `active` | Currently being executed |
| `waiting` | Waiting for activation |
| `completed` | Successfully completed |
| `failed` | Failed to complete |

---

## Metrics

| Metric | Description |
|--------|-------------|
| `goals_registered_total` | Total goals registered |
| `goals_completed_total` | Total goals completed |
| `goals_failed_total` | Total goals failed |
| `avg_completion_time_ms` | Average completion time |
| `consensus_approval_rate` | Consensus approval rate |
| `inviolable_rejections` | Goals rejected by inviolables |

---

## Integration Points

- **Triad System** - Consensus requests for goal activation
- **Consciousness Module** - Goal awareness in global workspace
- **Self-Model** - Capability checking for feasibility
- **Memory System** - Goal history storage

---

*Goal Arbitration - Choosing wisely, executing surely.*
