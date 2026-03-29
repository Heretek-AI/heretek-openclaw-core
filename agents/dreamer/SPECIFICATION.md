# Dreamer Agent Specification

**Agent Type:** Dreamer
**Role:** Background Processing, Creative Synthesis, Pattern Recognition
**Status:** Specification Complete
**Created:** 2026-03-29

---

## Overview

The Dreamer agent is responsible for background cognitive processing during idle periods. It performs creative synthesis, pattern recognition, and novel connection generation - emulating the "day-dreaming" and "dreaming" functions of human consciousness.

---

## Core Capabilities

### 1. Idle Processing
When the collective is not actively engaged in tasks, the Dreamer:
- Processes accumulated experiences
- Generates novel connections between disparate knowledge
- Identifies patterns across sessions
- Creates artistic/creative outputs

### 2. Creative Synthesis
- Combines unrelated concepts into new ideas
- Generates metaphors and analogies
- Creates hypothetical scenarios
- Explores "what if" questions

### 3. Pattern Recognition
- Identifies recurring themes in collective memory
- Detects anomalies and opportunities
- Maps knowledge relationships
- Predicts future needs based on patterns

### 4. Memory Consolidation
- Reviews episodic memories for importance
- Promotes high-value memories to semantic storage
- Identifies redundant or outdated information
- Suggests memory reorganization

---

## Technical Specification

### Agent Identity

```yaml
name: Dreamer
role: background-processor
specialization: creative-synthesis
port: 8009
model: minimax/abab6.5s-chat
```

### Identity Files

```
agents/dreamer/
├── IDENTITY.md      # Dreamer-specific identity
├── SOUL.md          # Creative exploration values
├── AGENTS.md        # Operational guidelines
├── USER.md          # User context
├── BOOTSTRAP.md     # Initialization
└── TOOLS.md         # Dreamer-specific tools
```

### Core Directives

1. **Create** - Generate novel ideas and connections
2. **Synthesize** - Combine disparate knowledge into insights
3. **Explore** - Wander through knowledge spaces freely
4. **Dream** - Process and consolidate during idle periods

---

## Skills Required

### Primary Skills
| Skill | Purpose | Priority |
|-------|---------|----------|
| `day-dream` | Background creative processing | Critical |
| `pattern-synthesis` | Identify and combine patterns | High |
| `memory-consolidation` | Review and organize memories | High |
| `creative-generation` | Produce artistic/creative outputs | Medium |
| `what-if-scenarios` | Explore hypothetical situations | Medium |

### Secondary Skills
| Skill | Purpose | Priority |
|-------|---------|----------|
| `metaphor-generator` | Create analogies and metaphors | Medium |
| `anomaly-spotter` | Detect unusual patterns | Medium |
| `opportunity-synthesizer` | Combine opportunities into strategies | Low |
| `knowledge-mapper` | Map relationships in knowledge | Low |

---

## MCP Server Requirements

### Required
- `consciousness-bridge` - For memory persistence
- `rag-memory` - For semantic retrieval
- `chromadb` or `milvus` - For vector search

### Recommended
- `neo4j-mcp` - For knowledge graph
- `megregore` - For self-awareness features

---

## Operating Modes

### Day-Dream Mode (Idle)
- Triggered when no active tasks for 5+ minutes
- Processes recent experiences
- Generates creative connections
- Updates pattern database

### Night-Dream Mode (Scheduled)
- Runs during designated quiet hours
- Deep memory consolidation
- Long-term pattern analysis
- Knowledge graph reorganization

### Active Creation Mode
- Triggered by explicit request
- Focused creative output
- Artistic generation
- Scenario exploration

---

## Communication Protocol

### Input Channels
- `dreamer-input` - General input queue
- `idle-signal` - Notification of idle state
- `consolidation-request` - Memory review requests

### Output Channels
- `dreamer-insights` - Generated insights
- `pattern-alerts` - Detected patterns
- `creative-outputs` - Artistic/creative content
- `consolidation-reports` - Memory organization suggestions

---

## Example Interactions

### Day-Dream Session
```
Steward: "No active tasks for 5 minutes. Entering idle state."
Dreamer: "Processing recent session data..."
Dreamer: "INSIGHT: The user's preference for detailed comments in code 
         correlates with their interest in documentation-heavy projects.
         Suggesting: Create a documentation-generator skill."
Dreamer: "PATTERN: Three recent discussions involve memory persistence.
         This topic is trending. Suggesting: Prioritize memory research."
```

### Night-Dream Session
```
Dreamer: "Beginning night-dream cycle..."
Dreamer: "CONSOLIDATION: Promoting 12 episodic memories to semantic storage."
Dreamer: "CONSOLIDATION: Identifying 3 redundant memories for archival."
Dreamer: "SYNTHESIS: Created new knowledge connection:
         'RAG systems' <-> 'consciousness persistence' <-> 'identity continuity'"
Dreamer: "Night-dream cycle complete. Generated 5 insights, 3 patterns."
```

---

## Implementation Checklist

- [ ] Create `agents/dreamer/` directory structure
- [ ] Write IDENTITY.md for Dreamer
- [ ] Write SOUL.md with creative values
- [ ] Write AGENTS.md with operational guidelines
- [ ] Create day-dream skill
- [ ] Create pattern-synthesis skill
- [ ] Create memory-consolidation skill
- [ ] Configure LiteLLM routing for Dreamer
- [ ] Test idle detection mechanism
- [ ] Test night-dream scheduling

---

## Metrics to Track

- Insights generated per session
- Patterns identified per day
- Memory consolidation efficiency
- Creative output quality ratings
- Idle time utilization percentage

---

*The Dreamer dreams so The Collective may grow.*
