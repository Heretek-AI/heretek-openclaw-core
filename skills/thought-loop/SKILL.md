---
name: thought-loop
description: Structured thought generation from environmental deltas. Monitors file system, database, external sources, and agent states to generate meaningful thoughts with confidence scoring.
---

# Thought Loop Skill

**Purpose:** Enable continuous autonomous thinking by detecting changes in the environment and generating structured thoughts with appropriate actions.

**Status:** ✅ Ported from Heretek (`modules/thought-loop/`)

**Location:** `skills/thought-loop/`

**Implementation:** [`thought-loop.js`](thought-loop.js)

---

## Features

- **Delta Detection:** Detects changes in files, databases, external sources, and agent states
- **Thought Generation:** Creates structured thoughts from detected changes
- **Thought Types:** Supports discovery, update, alert, external_awareness, reflection
- **Confidence Scoring:** Each thought includes confidence level (0-1)
- **Idle Thinking:** Generates reflective thoughts when no external triggers exist
- **Recommendation Engine:** Suggests actions based on thought type

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `detect` | Detect environmental changes | `node thought-loop.js detect` |
| `generate` | Generate thoughts from deltas | `node thought-loop.js generate --deltas '[]'` |
| `idle` | Generate idle reflection thoughts | `node thought-loop.js idle` |
| `run` | Full thought loop cycle | `node thought-loop.js run` |

---

## Thought Types

| Type | Description | Trigger |
|------|-------------|---------|
| `discovery` | New file or resource detected | file_created |
| `update` | Existing resource modified | file_modified, db_modified |
| `alert` | Resource deleted or agent offline | file_deleted, agent_offline |
| `external_awareness` | External event detected | external_cve, external_release |
| `reflection` | Internal self-reflection | idle |
| `state_change` | Database state change | db_modified |

---

## Delta Types

| Delta Type | Source | Description |
|------------|--------|-------------|
| `file_created` | File system | New file detected |
| `file_modified` | File system | File content changed |
| `file_deleted` | File system | File removed |
| `db_modified` | Database | Database state changed |
| `external_cve` | External | Security vulnerability |
| `external_release` | External | New release available |
| `agent_online` | Agent sync | Agent came online |
| `agent_offline` | Agent sync | Agent went offline |
| `agent_heartbeat` | Agent sync | Agent status update |

---

## Usage Examples

```bash
# Run full thought loop cycle
node thought-loop.js run

# Detect changes only
node thought-loop.js detect --json

# Generate thoughts from specific deltas
node thought-loop.js generate --deltas '[{"type":"file_created","path":"./test.md"}]'

# Generate idle thoughts for reflection
node thought-loop.js idle --agent steward

# Output as JSON
node thought-loop.js detect --json
```

---

## Thought Structure

```json
{
  "id": "thought_1234567890_abc123",
  "type": "discovery",
  "trigger": "file_created",
  "subject": "test.md",
  "observation": "New file created: ./test.md",
  "implication": "May affect active or pending proposals",
  "recommendation": "broadcast_thought",
  "confidence": 0.7,
  "timestamp": "2026-03-31T00:00:00Z",
  "agent": "steward",
  "metadata": {
    "path": "./test.md",
    "size": 1024
  }
}
```

---

## Configuration

```bash
# Environment Variables
WORKSPACE_ROOT="/workspace"      # Root directory to monitor
CURIOSITY_DIR="/workspace/.curiosity"  # Curiosity engine directory
DELTA_STATE_FILE="/tmp/delta-state.json"  # Delta detection state
AGENT_NAME="steward"             # Current agent name
MAX_IDLE_THOUGHTS=3              # Max idle thoughts to generate
```

---

## Directory Structure

```
skills/thought-loop/
├── SKILL.md              # This file
├── thought-loop.js       # Main implementation
├── package.json          # NPM dependencies
└── README.md             # Usage documentation
```

---

## Integration Points

- **Consciousness Module:** Thoughts broadcast to global workspace
- **Triad System:** Triggers deliberation for high-importance thoughts
- **Memory System:** Thoughts stored in episodic memory
- **Self-Model:** Updates cognitive state based on thoughts

---

## Recommendation Actions

| Action | Description |
|--------|-------------|
| `broadcast_thought` | Share thought with collective |
| `update_context` | Update agent context |
| `trigger_deliberation` | Start triad deliberation |
| `check_consensus` | Verify consensus state |
| `trigger_failover_vote` | Initiate failover voting |
| `evaluate_update` | Assess update relevance |
| `log_for_review` | Log for later review |
| `review_active_proposals` | Check active proposals |
| `check_pending_actions` | Review pending actions |

---

## Confidence Levels

| Level | Range | Description |
|-------|-------|-------------|
| High | 0.8-1.0 | Strong evidence, reliable trigger |
| Medium | 0.5-0.7 | Moderate evidence |
| Low | 0.3-0.4 | Weak evidence, uncertain |
| Unknown | <0.3 | Unknown trigger type |

---

*Thought Loop - Thinking continuously, learning from every change.*
