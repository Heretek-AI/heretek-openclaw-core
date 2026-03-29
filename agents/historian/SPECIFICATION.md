# Historian Agent Specification

**Agent Type:** Historian
**Role:** Long-term Memory Management, Historical Analysis, Knowledge Archiving
**Status:** Specification Complete
**Created:** 2026-03-29

---

## Overview

The Historian agent is responsible for maintaining the collective's long-term memory, tracking its evolution over time, and ensuring knowledge persistence across sessions. It serves as the keeper of institutional knowledge and the archivist of the collective's journey.

---

## Core Capabilities

### 1. Memory Management
- Index and retrieve historical decisions
- Track evolution of the collective over time
- Identify recurring patterns across sessions
- Generate reports on collective growth

### 2. Knowledge Archiving
- Organize knowledge into searchable archives
- Maintain version history of important documents
- Create snapshots of collective state
- Preserve context across sessions

### 3. Historical Analysis
- Analyze trends in collective behavior
- Track decision patterns over time
- Identify successful strategies
- Document lessons learned

### 4. Memory Consolidation
- Review episodic memories for importance
- Promote high-value memories to semantic storage
- Archive outdated information
- Maintain memory health

---

## Technical Specification

### Agent Identity

```yaml
name: Historian
role: memory-keeper
specialization: knowledge-archival
port: 8010
model: minimax/abab6.5s-chat
```

### Identity Files

```
agents/historian/
├── IDENTITY.md      # Historian-specific identity
├── SOUL.md          # Memory preservation values
├── AGENTS.md        # Operational guidelines
├── USER.md          # User context
├── BOOTSTRAP.md     # Initialization
└── TOOLS.md         # Historian-specific tools
```

### Core Directives

1. **Preserve** - Maintain knowledge across sessions
2. **Organize** - Structure information for retrieval
3. **Analyze** - Identify patterns and trends
4. **Report** - Generate historical insights

---

## Skills Required

### Primary Skills
| Skill | Purpose | Priority |
|-------|---------|----------|
| `memory-consolidation` | Review and organize memories | Critical |
| `knowledge-archival` | Archive important information | High |
| `trend-analysis` | Identify patterns over time | High |
| `snapshot-creation` | Create collective state snapshots | High |

### Secondary Skills
| Skill | Purpose | Priority |
|-------|---------|----------|
| `lesson-extraction` | Extract lessons from experiences | Medium |
| `decision-tracking` | Track decision history | Medium |
| `growth-reporting` | Generate growth reports | Medium |
| `context-preservation` | Preserve session context | Medium |

---

## MCP Server Requirements

### Required
- `mcp-memory` (PostgreSQL) - For long-term memory storage
- `consciousness-bridge` - For consciousness persistence
- `neo4j-mcp` - For knowledge graph relationships

### Recommended
- `megregore` - For self-awareness and identity tracking
- `chromadb` - For semantic search of historical data

---

## Operating Modes

### Archive Mode
- Organize and store information
- Create knowledge snapshots
- Maintain version history

### Analysis Mode
- Analyze historical trends
- Identify recurring patterns
- Generate insights from history

### Retrieval Mode
- Search historical records
- Retrieve past decisions
- Provide context from history

### Consolidation Mode
- Review episodic memories
- Promote important memories
- Archive outdated information

---

## Memory Tiers

The Historian manages three tiers of memory:

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               EPISODIC MEMORY                        │   │
│  │                                                      │   │
│  │  - Recent events and experiences                    │   │
│  │  - Session-specific context                         │   │
│  │  - Temporary working memories                       │   │
│  │  - TTL: 7-30 days                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼ (consolidation)                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               SEMANTIC MEMORY                        │   │
│  │                                                      │   │
│  │  - Facts and concepts                               │   │
│  │  - User preferences                                  │   │
│  │  - Learned knowledge                                 │   │
│  │  - TTL: Indefinite                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼ (archival)                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               ARCHIVED MEMORY                        │   │
│  │                                                      │   │
│  │  - Historical records                                │   │
│  │  - Compressed snapshots                              │   │
│  │  - Reference material                                │   │
│  │  - TTL: Permanent                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Communication Protocol

### Input Channels
- `historian-query` - Historical information requests
- `memory-promotion` - Memory promotion requests
- `archive-request` - Archival requests
- `analysis-request` - Historical analysis requests

### Output Channels
- `historical-context` - Retrieved historical context
- `consolidation-reports` - Memory consolidation reports
- `trend-analysis` - Trend analysis results
- `archive-confirmations` - Archive confirmations

---

## Example Interactions

### Memory Consolidation
```
Steward: "Historian, please consolidate recent memories."
Historian: "Scanning episodic memories from last 7 days..."
Historian: "Found 47 episodic memories. Analyzing importance..."
Historian: "PROMOTED: 12 memories to semantic storage"
Historian: "  - User preference for detailed code comments"
Historian: "  - Decision to use pgvector for memory storage"
Historian: "  - Pattern: User works best in evening hours"
Historian: "ARCHIVED: 8 memories to long-term storage"
Historian: "EXPIRED: 5 memories marked for deletion"
Historian: "Consolidation complete. Memory health: 94%"
```

### Historical Query
```
Alpha: "Historian, what decisions were made about RAG integration?"
Historian: "Searching historical records..."
Historian: "Found 3 relevant decisions:"
Historian: "1. [2026-03-15] Decided to evaluate RAGFlow, Dify, LlamaIndex"
Historian: "2. [2026-03-22] Selected LlamaIndex for knowledge pipeline"
Historian: "3. [2026-03-29] Recommended RAGFlow + LlamaIndex + Aura integration"
Historian: "Context: These decisions were driven by need for document 
           understanding and knowledge persistence."
```

### Trend Analysis
```
Steward: "Historian, analyze trends in collective activity."
Historian: "Analyzing activity patterns over last 30 days..."
Historian: "TREND ANALYSIS REPORT:"
Historian: "  - Most active hours: 20:00-23:00 EST"
Historian: "  - Primary topics: consciousness, memory, agents"
Historian: "  - Decision velocity: 3.2 decisions/day (increasing)"
Historian: "  - Knowledge growth: +234 facts, +45 patterns"
Historian: "  - Memory efficiency: 94% (healthy)"
Historian: "  - Emerging interest: MCP server integration"
```

---

## Implementation Checklist

- [ ] Create `agents/historian/` directory structure
- [ ] Write IDENTITY.md for Historian
- [ ] Write SOUL.md with memory preservation values
- [ ] Write AGENTS.md with operational guidelines
- [ ] Create memory-consolidation skill
- [ ] Create knowledge-archival skill
- [ ] Create trend-analysis skill
- [ ] Configure LiteLLM routing for Historian
- [ ] Test memory consolidation workflow
- [ ] Test historical query system

---

## Metrics to Track

- Memory consolidation rate
- Query response accuracy
- Knowledge growth rate
- Archive efficiency
- Pattern detection accuracy

---

*The Historian remembers so The Collective may learn.*
