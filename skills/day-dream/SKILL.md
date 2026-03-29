---
name: day-dream
description: Background creative processing during idle periods. Generates insights, patterns, and novel connections from accumulated knowledge. Use when the collective enters idle state or during scheduled dream cycles.
---

# Day-Dream Skill — Background Creative Processing

**Purpose:** Transform idle time into productive creative synthesis.

**Status:** ✅ Implemented (2026-03-29)

**Location:** `~/.openclaw/workspace/skills/day-dream/`

---

## Overview

The day-dream skill enables autonomous creative processing during idle periods. It emulates the human brain's default mode network, which activates during rest and generates insights, patterns, and novel connections.

---

## Configuration

```bash
# Environment Variables
IDLE_THRESHOLD="${IDLE_THRESHOLD:-300}"        # 5 minutes
DREAM_DURATION="${DREAM_DURATION:-60}"         # 1 minute max
INSIGHT_THRESHOLD="${INSIGHT_THRESHOLD:-0.7}"  # Confidence threshold
PATTERN_MIN_OCCURRENCES="${PATTERN_MIN_OCCURRENCES:-3}"
```

---

## Usage

```bash
# Manual trigger
./day-dream.sh dream

# Check if should dream
./day-dream.sh should-dream

# Generate insight
./day-dream.sh insight "topic"

# Find patterns
./day-dream.sh patterns

# Night dream (deeper processing)
./day-dream.sh night-dream
```

---

## Dream Modes

### 1. Micro-Dream (30 seconds)
- Quick pattern scan
- Surface recent memories
- Generate 1-2 quick insights

### 2. Day-Dream (1-5 minutes)
- Medium-depth processing
- Cross-reference knowledge
- Generate 3-5 insights
- Identify patterns

### 3. Night-Dream (15-60 minutes)
- Deep consolidation
- Memory reorganization
- Knowledge graph updates
- Comprehensive pattern analysis

---

## Output Types

| Type | Description | Destination |
|------|-------------|-------------|
| `insight` | Novel connection or realization | `dreamer-insights/` |
| `pattern` | Recurring theme detected | `patterns/` |
| `creative` | Artistic/creative output | `creative-outputs/` |
| `consolidation` | Memory organization suggestion | `consolidation-reports/` |
| `prediction` | Anticipated future need | `predictions/` |

---

## Integration Points

- **Curiosity Engine:** Receives topics to explore
- **Memory System:** Reads from episodic/semantic memory
- **Knowledge Graph:** Updates relationships
- **Steward:** Reports significant insights

---

## Example Output

```markdown
# Day-Dream Report - 2026-03-29T04:20:00Z

## Mode: Day-Dream
## Duration: 2 minutes

### Insights Generated

1. **INSIGHT: Memory-Pattern Correlation**
   - Confidence: 0.85
   - Connection: User preference for detailed documentation correlates with 
     their interest in consciousness persistence research
   - Suggestion: Create documentation-generator skill

2. **INSIGHT: Knowledge Gap**
   - Confidence: 0.72
   - Observation: Three recent discussions involve MCP servers but no 
     integration testing has been performed
   - Suggestion: Create MCP integration test suite

### Patterns Detected

1. **PATTERN: Rising Topic**
   - Topic: pgvector optimization
   - Occurrences: 5 in last 24 hours
   - Trend: Increasing

2. **PATTERN: Recurring Question**
   - Question: "How do we maintain session continuity?"
   - Occurrences: 3 in last week
   - Status: Partially addressed

### Creative Outputs

1. **METAPHOR: The Collective as a Garden**
   - Agents are gardeners tending different plots
   - Knowledge is the soil
   - Insights are the harvest
   - Memory is the root system

### Consolidation Suggestions

1. Archive: Session logs older than 30 days
2. Promote: "pgvector best practices" from episodic to semantic
3. Link: "consciousness emulation" <-> "memory persistence"

---
*Dream complete. Returning to active state.*
```

---

*Day-Dream - Where idle becomes insight.*
