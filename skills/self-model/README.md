# Self-Model Skill

Meta-cognitive self-awareness for the OpenClaw agent collective.

## Overview

The Self-Model skill enables agents to understand their own capabilities, limitations, and cognitive state through:

1. **Capability Tracking** - Register and track available, active, and learning capabilities
2. **Knowledge Management** - Store and retrieve knowledge organized by domain
3. **Confidence Scoring** - Track and trend confidence levels per domain
4. **Cognitive State** - Monitor current thinking state
5. **Task Management** - Track active tasks and progress
6. **Blind Spot Detection** - Identify and track knowledge gaps
7. **Reflection Engine** - Record and analyze self-reflections
8. **Metrics** - Track thoughts, actions, decisions, and reflections

## Installation

```bash
cd skills/self-model
npm install  # No external dependencies required
```

## Usage

### Command Line

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
```

### Programmatic Usage

```javascript
const SelfModel = require('./self-model');

const model = new SelfModel('steward');

// Register capabilities
model.registerCapability('code-generation');
model.registerCapability('research');

// Start learning
model.startLearning('machine-learning');

// Update confidence
model.updateConfidence('coding', 0.1);

// Start a task
model.startTask({
  id: 'task-123',
  description: 'Implement new feature',
  domain: 'coding'
});

// Get summary
console.log(model.summary());
```

## Self-Model Structure

```json
{
  "agent": "steward",
  "created": "2026-03-31T00:00:00Z",
  "capabilities": {
    "available": ["code-generation", "research"],
    "active": ["code-generation"],
    "learning": ["machine-learning"]
  },
  "confidence": {
    "overall": 0.75,
    "by_domain": {
      "coding": 0.8,
      "research": 0.7
    }
  },
  "cognitiveState": {
    "status": "thinking",
    "focus": "Implementing feature",
    "depth": 3
  },
  "metrics": {
    "thoughts_generated": 150,
    "actions_taken": 89,
    "decisions_made": 45
  }
}
```

## Configuration

```bash
# Environment Variables
SELF_MODEL_FILE="/path/to/self-model-state.json"  # State file location
AGENT_NAME="steward"                               # Agent name
```

## API Reference

### Capabilities

| Method | Description |
|--------|-------------|
| `registerCapability(name)` | Register a new capability |
| `getCapabilities()` | Get all capabilities |
| `useCapability(name)` | Mark capability as used |
| `startLearning(name)` | Start learning capability |
| `completeLearning(name)` | Complete learning |

### Knowledge

| Method | Description |
|--------|-------------|
| `learn(domain, fact, confidence)` | Learn a new fact |
| `know(domain, factId)` | Check if knows fact |
| `getKnowledge(domain)` | Get knowledge in domain |

### Tasks

| Method | Description |
|--------|-------------|
| `startTask(task)` | Start a new task |
| `updateTaskProgress(id, progress)` | Update task progress |
| `completeTask(id, success)` | Complete a task |
| `getWorkingOn()` | Get active tasks |

### Confidence

| Method | Description |
|--------|-------------|
| `updateConfidence(domain, delta)` | Update confidence |
| `getConfidence(domain)` | Get confidence levels |

### Cognitive State

| Method | Description |
|--------|-------------|
| `updateCognitiveState(status, focus, depth)` | Update state |
| `getCognitiveState()` | Get current state |

### Reflections

| Method | Description |
|--------|-------------|
| `addReflection(reflection)` | Add a reflection |
| `getRecentReflections(count)` | Get recent reflections |

### Blind Spots

| Method | Description |
|--------|-------------|
| `identifyBlindSpot(spot)` | Identify a blind spot |
| `suspectBlindSpot(spot)` | Suspect a blind spot |
| `getBlindSpots()` | Get all blind spots |

### Metrics

| Method | Description |
|--------|-------------|
| `incrementThoughtCount()` | Increment thought count |
| `incrementActionCount()` | Increment action count |
| `incrementDecisionCount()` | Increment decision count |
| `getMetrics()` | Get all metrics |

## Integration

The Self-Model skill integrates with:

- **Consciousness Module** - Provides self-awareness data
- **Thought Loop** - Updates cognitive state based on thoughts
- **Goal Arbitration** - Reports capability availability
- **Triad System** - Shares confidence levels for voting

## License

MIT
