---
name: self-model
description: Meta-cognitive self-awareness for agents. Tracks capabilities, knowledge, confidence levels, cognitive state, and blind spots with reflection capabilities.
---

# Self-Model Skill

**Purpose:** Enable meta-cognitive self-awareness for agents, allowing them to understand their own capabilities, limitations, and cognitive state.

**Status:** ✅ Ported from Heretek (`modules/self-model/`)

**Location:** `skills/self-model/`

**Implementation:** [`self-model.js`](self-model.js)

---

## Features

- **Capability Tracking:** Register, activate, and learn new capabilities
- **Knowledge Management:** Store and retrieve knowledge by domain
- **Confidence Scoring:** Track confidence levels per domain with trend analysis
- **Cognitive State:** Monitor current thinking state (idle, thinking, deliberating, acting)
- **Task Management:** Track active tasks and progress
- **Blind Spot Detection:** Identify and track known unknowns
- **Reflection Engine:** Record and analyze self-reflections
- **Metrics Tracking:** Count thoughts, actions, decisions, and reflections

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `capabilities` | Show all capabilities | `node self-model.js --capabilities` |
| `confidence` | Show confidence levels | `node self-model.js --confidence` |
| `state` | Show cognitive state | `node self-model.js --state` |
| `summary` | Show summary | `node self-model.js --summary` |
| `json` | Export full model as JSON | `node self-model.js --json` |

---

## API Methods

### Capabilities

```javascript
// Register a new capability
model.registerCapability('code-generation');

// Get all capabilities
model.getCapabilities();
// Returns: { available: [...], active: [...], learning: [...] }

// Use a capability
model.useCapability('code-generation');
// Returns: true if capability was used

// Start learning a capability
model.startLearning('machine-learning');

// Complete learning
model.completeLearning('machine-learning');
```

### Knowledge

```javascript
// Learn a new fact
model.learn('javascript', { id: 'async-await', fact: 'Async/await syntax' }, 0.9);

// Check if knows a fact
model.know('javascript', 'async-await');
// Returns: true/false

// Get knowledge in domain
model.getKnowledge('javascript');
```

### Task Management

```javascript
// Start a task
model.startTask({
  id: 'task-123',
  description: 'Implement new feature',
  domain: 'coding'
});

// Update progress
model.updateTaskProgress('task-123', 50);

// Complete task
model.completeTask('task-123', true);

// Get active tasks
model.getWorkingOn();
```

### Confidence

```javascript
// Update confidence in domain
model.updateConfidence('coding', 0.1);  // Increase by 0.1
model.updateConfidence('coding', -0.05); // Decrease by 0.05

// Get confidence
model.getConfidence();  // All domains
model.getConfidence('coding');  // Specific domain
```

### Cognitive State

```javascript
// Update cognitive state
model.updateCognitiveState('thinking', 'Implementing feature', 3);

// Get current state
model.getCognitiveState();
// Returns: { status, focus, depth, last_thought }
```

### Reflections

```javascript
// Add a reflection
model.addReflection({
  type: 'capability',
  content: 'Need to improve error handling',
  confidence_before: 0.6,
  confidence_after: 0.7
});

// Get recent reflections
model.getRecentReflections(10);
```

### Blind Spots

```javascript
// Identify a blind spot
model.identifyBlindSpot({
  id: 'bs-1',
  description: 'Limited knowledge of quantum computing'
});

// Suspect a blind spot
model.suspectBlindSpot({
  id: 'bs-2',
  description: 'May not understand legacy system constraints'
});

// Get all blind spots
model.getBlindSpots();
```

### Metrics

```javascript
// Increment counters
model.incrementThoughtCount();
model.incrementActionCount();
model.incrementDecisionCount();

// Get all metrics
model.getMetrics();
```

---

## Self-Model Structure

```json
{
  "agent": "steward",
  "created": "2026-03-31T00:00:00Z",
  "updated": "2026-03-31T00:00:00Z",
  "capabilities": {
    "available": ["code-generation", "research", "analysis"],
    "active": ["code-generation", "research"],
    "learning": ["machine-learning"],
    "deprecated": []
  },
  "knowledge": {
    "domains": ["javascript", "python", "ai-agents"],
    "facts": {},
    "by_domain": {
      "javascript": 15,
      "python": 10,
      "ai-agents": 8
    }
  },
  "workingOn": {
    "tasks": [],
    "decisions_pending": [],
    "reflections": []
  },
  "confidence": {
    "overall": 0.75,
    "by_domain": {
      "javascript": 0.8,
      "python": 0.7
    },
    "recent_trend": []
  },
  "cognitiveState": {
    "status": "thinking",
    "focus": "Implementing feature",
    "depth": 3,
    "last_thought": "2026-03-31T00:00:00Z"
  },
  "blindSpots": {
    "identified": [],
    "suspected": [],
    "ignored": []
  },
  "metrics": {
    "thoughts_generated": 150,
    "actions_taken": 89,
    "decisions_made": 45,
    "reflections_completed": 12,
    "confidence_changes": 23
  }
}
```

---

## Cognitive States

| Status | Description |
|--------|-------------|
| `idle` | No active thinking |
| `thinking` | Processing information |
| `deliberating` | Weighing options/decisions |
| `acting` | Executing actions |

---

## Reflection Types

| Type | Description |
|------|-------------|
| `capability` | Reflection on capabilities |
| `confidence` | Reflection on confidence levels |
| `blind_spot` | Reflection on knowledge gaps |
| `general` | General self-reflection |

---

## Configuration

```bash
# Environment Variables
SELF_MODEL_FILE="/path/to/self-model-state.json"  # State file location
AGENT_NAME="steward"                               # Agent name
```

---

## Usage Examples

```bash
# Show summary
node self-model.js --summary

# Show capabilities
node self-model.js --capabilities

# Show confidence levels
node self-model.js --confidence

# Show cognitive state
node self-model.js --state

# Export full model as JSON
node self-model.js --json

# With custom agent name
AGENT_NAME=alpha node self-model.js --summary
```

---

## Integration Points

- **Consciousness Module:** Provides self-awareness data
- **Thought Loop:** Updates cognitive state based on thoughts
- **Goal Arbitration:** Reports capability availability
- **Triad System:** Shares confidence levels for voting

---

*Self-Model - Know thyself, improve thyself.*
