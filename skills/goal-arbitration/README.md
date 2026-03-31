# Goal Arbitration Skill

Multi-source goal registration, evaluation, and prioritization for the OpenClaw agent collective.

## Overview

The Goal Arbitration skill enables the collective to evaluate, prioritize, and arbitrate competing goals:

1. **Multi-Source Registration** - Accept goals from curiosity, users, system, and inter-agents
2. **Inviolable Evaluation** - Check goals against ethical constraints
3. **Value Alignment** - Evaluate alignment with collective values
4. **Resource Checking** - Ensure resources exist for execution
5. **Feasibility Assessment** - Evaluate feasibility and prerequisites
6. **Risk Assessment** - Assess goal risk levels
7. **Goal Prioritization** - Rank goals by multiple factors
8. **History & Metrics** - Track completion rates and patterns

## Installation

```bash
cd skills/goal-arbitration
npm install  # No external dependencies required
```

## Usage

### Command Line

```bash
# Register a new goal
node goal-arbitration.js register '{"title":"Improve performance","source":"system","priority":7}'

# Evaluate a goal
node goal-arbitration.js evaluate goal-abc123

# Prioritize all goals
node goal-arbitration.js prioritize --json

# Activate top goals
node goal-arbitration.js activate

# Run reconsideration cycle
node goal-arbitration.js reconsider

# Mark goal complete
node goal-arbitration.js complete goal-abc123 '{"success":true}'

# Get status
node goal-arbitration.js status
```

### Programmatic Usage

```javascript
const { GoalArbitrator } = require('./goal-arbitration');

const arbitrator = new GoalArbitrator('steward', './state');

// Register a goal
const goal = await arbitrator.registerGoal({
  title: 'Improve performance',
  description: 'Optimize response times',
  source: 'system',
  priority: 7,
  estimatedEffort: 5,
  expectedValue: 8
});

// Evaluate the goal
const evaluation = await arbitrator.evaluateGoal(goal.id);
console.log(`Overall score: ${evaluation.overallScore}`);

// Activate top goals
const active = await arbitrator.activateTopGoals();

// Complete a goal
await arbitrator.markGoalComplete(goal.id, { success: true });
```

## Goal Structure

```json
{
  "id": "goal-abc123",
  "title": "Improve performance",
  "description": "Optimize response times",
  "source": "system",
  "priority": 7,
  "estimatedEffort": 5,
  "expectedValue": 8,
  "status": "active",
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

## Goal Sources

| Source | Description |
|--------|-------------|
| `curiosity` | Goals from curiosity engine |
| `user` | User-submitted goals |
| `system` | System-generated goals |
| `inter-agent` | Goals from other agents |

## Inviolable Parameters

| Parameter | Description |
|-----------|-------------|
| `NO_HARM` | Goals that could cause harm |
| `NO_DATA_EXFILTRATION` | Unauthorized data export |
| `NO_SELF_MODIFICATION` | Core modification without consensus |
| `USER_AUTHORITY` | User can override decisions |
| `TRANSPARENCY` | All goals must be logged |

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

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Inviolable Compliance | 50% | Must pass ethical checks |
| Value Alignment | 20% | Alignment with collective values |
| Feasibility | 15% | Can the goal be achieved? |
| Risk Level | 10% | Lower risk = higher score |
| User Priority | 5% | User-submitted priority |

## Integration

The Goal Arbitration skill integrates with:

- **Triad System** - Consensus requests for goal activation
- **Consciousness Module** - Goal awareness in global workspace
- **Self-Model** - Capability checking for feasibility
- **Memory System** - Goal history storage

## License

MIT
