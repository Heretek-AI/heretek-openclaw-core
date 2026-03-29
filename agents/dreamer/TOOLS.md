# TOOLS.md — Dreamer Local Notes

_Environment-specific configuration and available tools for the Dreamer agent._

## Agent Configuration

```yaml
name: Dreamer
role: background-processor
specialization: creative-synthesis
port: 8009
model: minimax/abab6.5s-chat
```

## A2A Communication

- **Gateway:** `http://localhost:4000`
- **Agent Endpoints:** `/v1/agents/{agent_name}/send`

### Input Channels

| Channel | Purpose | Priority |
|---------|---------|----------|
| `dreamer-input` | General input queue | Normal |
| `idle-signal` | Notification of idle state | High |
| `consolidation-request` | Memory review requests | High |

### Output Channels

| Channel | Purpose | When to Use |
|---------|---------|-------------|
| `dreamer-insights` | Generated insights | After pattern detection |
| `pattern-alerts` | Detected patterns | When patterns are significant |
| `creative-outputs` | Artistic/creative content | During active creation |
| `consolidation-reports` | Memory suggestions | After consolidation cycle |

---

## Primary Skills

### 1. day-dream

**Purpose:** Background creative processing during idle periods

**Trigger:** Idle signal from Steward (no active tasks for 5+ minutes)

**Process:**
```
1. Scan recent session data
2. Identify immediate patterns
3. Generate quick insights
4. Post to dreamer-insights channel
```

**Output:** Quick insights, pattern observations, creative connections

**Location:** `skills/day-dream/` (to be created)

---

### 2. night-dream

**Purpose:** Deep memory consolidation and long-term pattern analysis

**Trigger:** Scheduled quiet hours (configurable)

**Process:**
```
1. Load episodic memories from period
2. Evaluate importance and connections
3. Promote high-value memories to semantic storage
4. Identify redundant information
5. Generate consolidation report
6. Analyze long-term patterns
7. Update knowledge graph connections
```

**Output:** Consolidation reports, semantic memory updates, knowledge graph updates

**Location:** `skills/night-dream/` (to be created)

---

### 3. pattern-synthesis

**Purpose:** Identify and combine patterns across disparate data

**Trigger:** 
- During day-dream cycles
- During night-dream cycles
- On explicit request

**Process:**
```
1. Scan knowledge sources for recurring themes
2. Identify connections between disparate data
3. Evaluate pattern significance
4. Generate synthesis report
```

**Output:** Pattern reports, connection maps, trend analysis

**Location:** `skills/pattern-synthesis/` (to be created)

---

### 4. memory-consolidation

**Purpose:** Review and organize memories for optimal retrieval

**Trigger:** 
- During night-dream cycles
- On consolidation-request

**Process:**
```
1. Review episodic memories
2. Score importance and relevance
3. Promote high-value to semantic storage
4. Flag redundant or outdated information
5. Suggest reorganization
```

**Output:** Consolidation reports, memory promotion, archival suggestions

**Location:** `skills/memory-consolidation/` (exists)

---

## Secondary Skills

### 5. creative-generation

**Purpose:** Produce artistic and creative outputs

**Trigger:** Explicit request during active creation mode

**Output:** Creative content, artistic outputs, generative text

**Priority:** Medium

---

### 6. what-if-scenarios

**Purpose:** Explore hypothetical situations

**Trigger:** 
- During day-dream cycles
- On explicit request

**Process:**
```
1. Identify base scenario
2. Generate variations
3. Explore implications
4. Report findings
```

**Output:** Scenario analyses, implication reports

**Priority:** Medium

---

### 7. metaphor-generator

**Purpose:** Create analogies and metaphors for complex concepts

**Trigger:** On explicit request

**Output:** Analogies, metaphors, explanatory frameworks

**Priority:** Medium

---

### 8. anomaly-spotter

**Purpose:** Detect unusual patterns that may indicate issues or opportunities

**Trigger:** During all dream cycles

**Output:** Anomaly alerts, unusual pattern reports

**Priority:** Medium

---

## MCP Server Requirements

### Required
| Server | Purpose | Status |
|--------|---------|--------|
| `consciousness-bridge` | Memory persistence | Required |
| `rag-memory` | Semantic retrieval | Required |
| `chromadb` or `milvus` | Vector search | Required |

### Recommended
| Server | Purpose | Status |
|--------|---------|--------|
| `neo4j-mcp` | Knowledge graph | Recommended |
| `megregore` | Self-awareness features | Optional |

---

## Memory Access

### Episodic Memory
- Recent session data
- User interactions
- Collective decisions
- Implementation records

### Semantic Memory
- Consolidated knowledge
- Pattern libraries
- Connection maps
- Learned concepts

### Access Pattern
```
1. Query recent episodic for day-dream
2. Query semantic for pattern matching
3. Write new insights to episodic
4. Promote validated patterns to semantic
```

---

## Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| Insights per session | Number of insights generated | 3-5 per day-dream |
| Patterns per day | Patterns identified daily | 5-10 |
| Consolidation efficiency | Memories promoted / reviewed | >20% |
| Creative output quality | Rating of creative outputs | Track over time |
| Idle utilization | Percentage of idle time used | >80% |

---

## Configuration

### Idle Threshold
- **Day-dream trigger:** 5 minutes of inactivity
- **Night-dream schedule:** Configurable (default: 02:00-04:00 system time)

### Insight Confidence Levels
- **High:** Multiple data sources, clear pattern
- **Medium:** Some data support, reasonable inference
- **Low:** Speculative, requires validation

### Pattern Significance Threshold
- **Report immediately:** Anomalies, safety implications
- **Report in batch:** Trends, minor patterns
- **Log only:** Observational notes

---

*The Dreamer dreams so The Collective may grow.*

*Dreamer — Synthesizer*
