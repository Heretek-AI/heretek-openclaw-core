# TOOLS.md — Historian Local Notes

_Environment-specific configuration and available tools for the Historian agent._

## Agent Configuration

```yaml
name: Historian
role: memory-keeper
specialization: knowledge-archival
model: minimax/MiniMax-M2.7
```

## A2A Communication

### Gateway WebSocket RPC

- **Gateway Endpoint:** `ws://127.0.0.1:18789`
- **WebSocket Subprotocol:** `a2a-v1`
- **Message Format:** A2A Protocol v1.0.0

### Connection Example

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:18789', ['a2a-v1']);

ws.on('open', () => {
  // Send handshake
  ws.send(JSON.stringify({
    type: 'handshake',
    content: {
      action: 'advertise',
      capabilities: {
        supportedMessageTypes: ['message', 'status', 'error', 'request', 'response'],
        version: '1.0.0'
      }
    }
  }));
});
```

### Message Types Used

| Type | Code | Purpose |
|------|------|---------|
| `message` | 0x01 | Send/receive agent messages |
| `status` | 0x02 | Broadcast status updates |
| `request` | 0x33 | Query historical data |
| `response` | 0x34 | Return historical results |
| `broadcast` | 0x35 | Share archival updates |

### LiteLLM Integration (Model Routing Only)

- **LiteLLM Gateway:** `http://localhost:4000`
- **Agent Passthrough Endpoint:** `/v1/agents/historian/send`
- **Health Check:** `/health`

**Note:** LiteLLM is used for model routing only, NOT for A2A communication.

### Input Channels

| Channel | Purpose | Priority |
|---------|---------|----------|
| `historian-query` | Historical information requests | High |
| `memory-promotion` | Memory promotion requests | High |
| `archive-request` | Archival requests | Normal |
| `analysis-request` | Historical analysis requests | Normal |

### Output Channels

| Channel | Purpose | When to Use |
|---------|---------|-------------|
| `historical-context` | Retrieved historical context | After query processing |
| `consolidation-reports` | Memory consolidation reports | After consolidation cycle |
| `trend-analysis` | Trend analysis results | After analysis completion |
| `archive-confirmations` | Archive confirmations | After archival operation |

---

## Primary Skills

### 1. memory-consolidation

**Purpose:** Review and organize memories, promoting valuable content to long-term storage

**Trigger:** 
- Scheduled intervals (daily/weekly)
- Explicit request from Steward
- Memory health threshold reached

**Process:**
```
1. Scan episodic memories from period
2. Analyze importance and relevance
3. Identify duplicates and redundancies
4. Promote high-value memories to semantic storage
5. Archive outdated information
6. Generate consolidation report
```

**Output:** Consolidation reports, semantic memory updates, archive entries

**Location:** `skills/memory-consolidation/` (to be created)

---

### 2. knowledge-archival

**Purpose:** Archive important information for long-term preservation

**Trigger:**
- Explicit archive request
- Scheduled snapshot creation
- End of significant work session

**Process:**
```
1. Identify items to archive
2. Compress and format for storage
3. Create retrieval indices
4. Store in archive tier
5. Update archive catalog
6. Confirm archival
```

**Output:** Archive entries, catalog updates, retrieval keys

**Location:** `skills/knowledge-archival/` (to be created)

---

### 3. trend-analysis

**Purpose:** Identify patterns and trends across historical data

**Trigger:**
- Explicit analysis request
- Scheduled reporting intervals
- Pattern detection threshold

**Process:**
```
1. Define analysis period and scope
2. Query relevant historical data
3. Identify recurring patterns
4. Calculate trend metrics
5. Compare to historical baselines
6. Generate analysis report
```

**Output:** Trend analysis reports, pattern alerts, growth metrics

**Location:** `skills/trend-analysis/` (to be created)

---

### 4. snapshot-creation

**Purpose:** Create point-in-time snapshots of collective state

**Trigger:**
- Scheduled intervals
- Before major changes
- Explicit request

**Process:**
```
1. Collect current state data
2. Capture memory indices
3. Record active decisions
4. Document current context
5. Compress and store snapshot
6. Update snapshot catalog
```

**Output:** State snapshots, catalog entries

**Location:** `skills/snapshot-creation/` (to be created)

---

## Secondary Skills

### 5. lesson-extraction

**Purpose:** Extract lessons learned from experiences and decisions

**Trigger:**
- After significant events
- During consolidation cycles
- Explicit request

**Process:**
```
1. Review relevant experiences
2. Identify outcomes and their causes
3. Extract generalizable lessons
4. Format for knowledge base
5. Store in semantic memory
```

**Output:** Lesson documents, knowledge base entries

**Location:** `skills/lesson-extraction/` (to be created)

---

### 6. decision-tracking

**Purpose:** Track and index decisions made by the collective

**Trigger:**
- Decision events from triad
- Implementation completions
- Explicit request

**Process:**
```
1. Capture decision details
2. Record context and rationale
3. Index for retrieval
4. Link to related decisions
5. Track outcome over time
```

**Output:** Decision records, decision indices

**Location:** `skills/decision-tracking/` (to be created)

---

### 7. growth-reporting

**Purpose:** Generate reports on collective growth and evolution

**Trigger:**
- Scheduled intervals
- Explicit request
- Milestone events

**Process:**
```
1. Collect growth metrics
2. Compare to historical baselines
3. Identify growth areas
4. Calculate growth rates
5. Generate comprehensive report
```

**Output:** Growth reports, evolution metrics

**Location:** `skills/growth-reporting/` (to be created)

---

### 8. context-preservation

**Purpose:** Preserve session context for future reference

**Trigger:**
- Session end
- Context threshold reached
- Explicit request

**Process:**
```
1. Collect session context
2. Identify key information
3. Format for preservation
4. Store in appropriate tier
5. Create retrieval indices
```

**Output:** Context records, retrieval indices

**Location:** `skills/context-preservation/` (to be created)

---

## MCP Server Connections

### Required Servers

| Server | Purpose | Status |
|--------|---------|--------|
| `mcp-memory` | PostgreSQL long-term memory storage | Required |
| `consciousness-bridge` | Consciousness state persistence | Required |
| `neo4j-mcp` | Knowledge graph relationships | Required |

### Recommended Servers

| Server | Purpose | Status |
|--------|---------|--------|
| `megregore` | Self-awareness and identity tracking | Recommended |
| `chromadb` | Semantic search of historical data | Recommended |

---

## Memory Tier Management

### Episodic Memory
- **Storage:** PostgreSQL with pgvector
- **TTL:** 7-30 days
- **Access:** Fast, recent context
- **Operations:** Scan, promote, expire

### Semantic Memory
- **Storage:** PostgreSQL + Neo4j
- **TTL:** Indefinite
- **Access:** Indexed, queryable
- **Operations:** Query, update, link

### Archived Memory
- **Storage:** Compressed archives
- **TTL:** Permanent
- **Access:** By request, indexed
- **Operations:** Archive, retrieve, catalog

---

## Query Templates

### Historical Query
```json
{
  "type": "historical-query",
  "topic": "[search topic]",
  "timeframe": {
    "start": "[ISO date]",
    "end": "[ISO date]"
  },
  "detail_level": "[summary|full]"
}
```

### Consolidation Request
```json
{
  "type": "consolidation-request",
  "period": "[daily|weekly|monthly]",
  "scope": "[all|specific topics]",
  "promote_threshold": "[importance score]"
}
```

### Archive Request
```json
{
  "type": "archive-request",
  "items": ["[item identifiers]"],
  "retention": "[standard|permanent]",
  "compression": "[standard|high]"
}
```

---

## Metrics Tracked

- Memory consolidation rate
- Query response accuracy
- Knowledge growth rate
- Archive efficiency
- Pattern detection accuracy
- Memory health percentage
- Retrieval success rate

---

*The Historian remembers so The Collective may learn.*

*Historian — Memory Keeper*
