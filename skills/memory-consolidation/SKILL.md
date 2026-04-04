---
name: memory-consolidation
description: Reviews and organizes memories, promoting episodic to semantic storage, archiving outdated information, and maintaining memory health. Use periodically or when memory optimization is needed.
---

# Memory Consolidation Skill

**Purpose:** Maintain healthy, organized memory systems with AgeMem unified memory API.

**Status:** ✅ Implemented (2026-03-29)
**AgeMem API Status:** ✅ Implemented (2026-04-04)

**Location:** `~/.openclaw/workspace/skills/memory-consolidation/`

---

## Overview

The memory consolidation skill emulates the brain's memory consolidation process, where experiences are reviewed, organized, and either promoted to long-term storage or archived. This ensures the collective's memory remains healthy and efficient.

---

## Configuration

```bash
# Environment Variables
CONSOLIDATION_INTERVAL="${CONSOLIDATION_INTERVAL:-3600}"  # 1 hour
PROMOTION_THRESHOLD="${PROMOTION_THRESHOLD:-10}"          # Access count
ARCHIVE_AGE="${ARCHIVE_AGE:-2592000}"                     # 30 days
IMPORTANCE_DECAY="${IMPORTANCE_DECAY:-0.95}"              # Decay factor
```

---

## AgeMem Unified Memory API

The memory consolidation skill provides the AgeMem unified memory API for cross-agent memory operations.

### `memory_retrieve(query, recency_weight)`

Retrieves memories with Ebbinghaus decay weighting applied to relevance scores.

**Signature:**
```typescript
memory_retrieve(params: {
  memories: Array<{
    content: string;
    importance: number;
    createdAt: string | Date;
    accessCount?: number;
    type?: string;
    path?: string;
  }>;
  query?: string;
  recencyWeight?: number;  // 0-1, default 0.5
  config?: Partial<EbbinghausConfig>;
}): Promise<MemoryRetrievalResult[]>
```

**Parameters:**
- `memories` - Array of memory candidates to rank
- `query` - Optional search query for semantic relevance
- `recencyWeight` - Weight given to recency vs semantic relevance (0-1, default 0.5)
- `config` - Optional Ebbinghaus configuration override

**Returns:** Sorted array of memories by combined relevance score

**Example:**
```typescript
import { memory_retrieve } from './decay';

const results = await memory_retrieve({
  memories: [
    {
      content: "User prefers TypeScript over JavaScript",
      importance: 0.9,
      createdAt: "2026-04-01T10:00:00Z",
      accessCount: 15,
      type: "semantic",
      path: "memory/2026-04-01.md"
    },
    {
      content: "Session context from yesterday",
      importance: 0.7,
      createdAt: "2026-04-03T14:30:00Z",
      accessCount: 3,
      type: "episodic",
      path: "episodes/2026-04-03/session.jsonl"
    }
  ],
  query: "user preferences",
  recencyWeight: 0.3  // Prioritize semantic relevance over recency
});

// Results sorted by decayedScore (combined semantic + temporal relevance)
console.log(results[0].content);
```

### Ebbinghaus Forgetting Curve

The `memory_retrieve` function implements the Ebbinghaus forgetting curve formula:

```
R(t) = S * e^(-λt) * repetition_bonus

Where:
  R(t) = retention strength at time t
  S = initial memory strength (importance score)
  λ = ln(2) / halfLifeDays (decay constant)
  t = time elapsed in days
  repetition_bonus = 1 + log10(accessCount + 1) * (repetitionBoost - 1)
```

**Default Configuration:**
```typescript
{
  enabled: true,
  halfLifeDays: 7,        // Episodic memories decay faster
  floorMultiplier: 0.1,   // Never decay below 10% of original
  repetitionBoost: 1.5    // Frequently accessed memories boosted
}
```

### Additional API Functions

- **`applyEbbinghausDecayToScore()`** - Apply decay to a single memory score
- **`batchApplyDecay()`** - Batch process multiple memories
- **`calculateOptimalReviewInterval()`** - Calculate when a memory should be reviewed

---

## Usage

```bash
# Run full consolidation
./memory-consolidation.sh consolidate

# Promote memories
./memory-consolidation.sh promote

# Archive old memories
./memory-consolidation.sh archive

# Decay importance scores
./memory-consolidation.sh decay

# Generate health report
./memory-consolidation.sh report
```

---

## Consolidation Process

### Phase 1: Review
- Scan episodic memories
- Calculate access patterns
- Identify promotion candidates
- Identify archive candidates

### Phase 2: Promote
- Move high-access episodic to semantic
- Increase importance scores
- Create semantic relationships
- Update knowledge graph

### Phase 3: Archive
- Move old/unused memories to archive
- Compress redundant information
- Create summary records
- Free up working memory

### Phase 4: Decay
- Apply importance decay to unused memories
- Boost recently accessed memories
- Rebalance importance scores
- Clean up duplicates

---

## Memory Tiers

| Tier | Purpose | Retention | Access Speed |
|------|---------|-----------|--------------|
| **Working** | Active processing | Session | Instant |
| **Episodic** | Recent experiences | 30 days | Fast |
| **Semantic** | Facts & concepts | Permanent | Medium |
| **Archive** | Historical record | Permanent | Slow |

---

## Promotion Criteria

A memory is promoted from Episodic to Semantic when:
- Access count > PROMOTION_THRESHOLD
- Importance score > 0.8
- Referenced by multiple other memories
- Tagged as "critical" or "permanent"

---

## Archive Criteria

A memory is archived when:
- Age > ARCHIVE_AGE
- Access count = 0
- Importance score < 0.3
- Marked as "deprecated"

---

## Output Example

```markdown
# Memory Consolidation Report

**Started:** 2026-03-29T04:25:00Z
**Duration:** 45 seconds

---

## Statistics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Memories | 1,247 | 1,251 | +4 |
| Episodic | 892 | 847 | -45 |
| Semantic | 312 | 358 | +46 |
| Archived | 43 | 46 | +3 |
| Avg Importance | 0.62 | 0.68 | +0.06 |

---

## Promotions (46)

1. **"pgvector hybrid search implementation"** - Accessed 15 times
2. **"User prefers detailed code comments"** - Importance 0.95
3. **"A2A protocol message format"** - Referenced by 8 memories
...

## Archives (3)

1. **"Initial project setup notes"** - Age: 45 days, Access: 0
2. **"Deprecated API endpoint"** - Marked deprecated
3. **"Duplicate: session log"** - Merged with primary

---

## Decay Applied

- 234 memories had importance decayed
- 12 memories boosted due to recent access
- 5 duplicates removed

---

## Recommendations

1. Consider promoting "consciousness emulation framework" - trending topic
2. Archive "old deployment method" - no longer relevant
3. Create semantic link: "memory" <-> "consciousness" <-> "persistence"

---

*Consolidation complete. Memory health optimized.*
```

---

## Integration Points

- **Historian Agent:** Primary consumer of consolidation reports
- **Dreamer Agent:** Uses consolidated memories for insights
- **Memory System:** Direct database operations
- **Knowledge Graph:** Updates relationships

---

*Memory Consolidation - Where experience becomes knowledge.*
