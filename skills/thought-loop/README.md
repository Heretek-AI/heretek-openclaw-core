# Thought Loop Skill

Structured thought generation from environmental deltas for the OpenClaw agent collective.

## Overview

The Thought Loop skill enables continuous autonomous thinking by:

1. **Detecting Changes** - Monitoring file system, databases, external sources, and agent states
2. **Generating Thoughts** - Creating structured thoughts from detected changes
3. **Scoring Confidence** - Assigning confidence levels to each thought
4. **Recommending Actions** - Suggesting appropriate responses to thoughts

## Installation

```bash
cd skills/thought-loop
npm install  # No external dependencies required
```

## Usage

### Full Thought Loop Cycle

```bash
# Run complete cycle (detect + generate)
node thought-loop.js run

# Output as JSON
node thought-loop.js run --json
```

### Detect Changes Only

```bash
# Detect environmental changes
node thought-loop.js detect

# JSON output
node thought-loop.js detect --json
```

### Generate Thoughts from Deltas

```bash
# Generate thoughts from provided deltas
node thought-loop.js generate --deltas '[{"type":"file_created","path":"./test.md"}]'
```

### Generate Idle Thoughts

```bash
# Generate reflective thoughts when idle
node thought-loop.js idle --agent steward
```

## Thought Types

| Type | Description | Example Trigger |
|------|-------------|-----------------|
| `discovery` | New file/resource detected | `file_created` |
| `update` | Existing resource modified | `file_modified` |
| `alert` | Resource deleted or agent offline | `file_deleted` |
| `external_awareness` | External event detected | `external_cve` |
| `reflection` | Internal self-reflection | `idle` |
| `state_change` | Database state change | `db_modified` |

## Example Output

```json
{
  "deltas": [
    {
      "type": "file_created",
      "path": "/workspace/new-feature.md",
      "timestamp": "2026-03-31T00:00:00Z",
      "size": 1024
    }
  ],
  "thoughts": [
    {
      "id": "thought_1234567890_abc123",
      "type": "discovery",
      "trigger": "file_created",
      "subject": "new-feature.md",
      "observation": "New file created: /workspace/new-feature.md",
      "implication": "May affect active or pending proposals",
      "recommendation": "broadcast_thought",
      "confidence": 0.7,
      "timestamp": "2026-03-31T00:00:00Z",
      "agent": "steward",
      "metadata": {
        "path": "/workspace/new-feature.md",
        "size": 1024
      }
    }
  ],
  "timestamp": "2026-03-31T00:00:00Z",
  "agent": "steward"
}
```

## Configuration

Set environment variables to customize behavior:

```bash
WORKSPACE_ROOT="/workspace"           # Root directory to monitor
CURIOSITY_DIR="/workspace/.curiosity" # Curiosity engine directory
DELTA_STATE_FILE="/tmp/delta-state.json" # State file location
AGENT_NAME="steward"                  # Current agent name
MAX_IDLE_THOUGHTS=3                   # Max idle thoughts to generate
```

## Programmatic Usage

```javascript
const { ThoughtLoop } = require('./thought-loop');

const loop = new ThoughtLoop('steward');

// Run full cycle
const result = await loop.run();
console.log(result.thoughts);

// Detect changes only
const deltas = await loop.detect();

// Generate thoughts from deltas
const thoughts = loop.generate(deltas);

// Generate idle thoughts
const idleThoughts = loop.idle();
```

## Integration

The Thought Loop skill integrates with:

- **Consciousness Module** - Thoughts broadcast to global workspace
- **Triad System** - Triggers deliberation for high-importance thoughts
- **Memory System** - Thoughts stored in episodic memory
- **Self-Model** - Updates cognitive state based on thoughts

## License

MIT
