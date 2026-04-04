---
name: archivist
description: Manages memory lifecycle operations including promotion from episodic to semantic, archiving outdated memories, and maintaining memory state transitions per AgeMem policy.
---

# Archivist Lobe

**Purpose:** Execute memory lifecycle operations — promote, archive, and manage memory state transitions.

**Status:** 🟡 Implemented (2026-04-04)
**Type:** Lobe Agent Skill
**Location:** `~/.openclaw/workspace/skills/archivist/`

---

## Overview

The archivist lobe is a specialized agent skill that manages the AgeMem memory lifecycle:

1. **Promotion** — Move high-value episodic memories to semantic storage
2. **Archiving** — Move old/unused memories to cold storage
3. **State Management** — Track and update memory states
4. **Lifecycle Logging** — Audit trail for all transitions

This ensures memories flow through the system appropriately based on AgeMem policy.

---

## Configuration

```bash
# Environment Variables
ARCHIVIST_ENABLED="${ARCHIVIST_ENABLED:-true}"
PROMOTION_ACCESS_THRESHOLD="${PROMOTION_ACCESS_THRESHOLD:-10}"     # Accesses needed for promotion
PROMOTION_IMPORTANCE_THRESHOLD="${PROMOTION_IMPORTANCE_THRESHOLD:-0.8}"
ARCHIVE_AGE_DAYS="${ARCHIVE_AGE_DAYS:-30}"                         # Days before archive consideration
ARCHIVE_IMPORTANCE_THRESHOLD="${ARCHIVE_IMPORTANCE_THRESHOLD:-0.3}"
ARCHIVE_ACCESS_THRESHOLD="${ARCHIVE_ACCESS_THRESHOLD:-0}"          # Max accesses for archive
AUTO_ARCHIVE_ENABLED="${AUTO_ARCHIVE_ENABLED:-false}"              # Require manual approval
```

---

## Memory Lifecycle States

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   WORKING    │────►│   EPISODIC   │────►│   SEMANTIC   │
│  (Session)   │     │  (0-30 days) │     │  (Permanent) │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    ▼                    │
       │             ┌──────────────┐            │
       │             │   ARCHIVE    │◄───────────┘
       └────────────►│  (Cold Store)│
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   FORGOTTEN  │
                     │  (Deleted)   │
                     └──────────────┘
```

---

## API Functions

### `promoteMemory(memoryId)`

Promotes a memory from episodic to semantic storage.

**Signature:**
```typescript
promoteMemory(params: {
  memoryId: string;
  reason?: 'high_access' | 'high_importance' | 'critical_tag' | 'manual';
}): Promise<PromoteResult>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `memoryId` | string | UUID of memory to promote |
| `reason` | string | Reason for promotion |

**Returns:**
```typescript
{
  success: boolean;
  memoryId: string;
  oldType: 'episodic';
  newType: 'semantic';
  reason: string;
  timestamp: string;
  error?: string;
}
```

---

### `archiveMemory(memoryId)`

Moves a memory to cold archive storage.

**Signature:**
```typescript
archiveMemory(params: {
  memoryId: string;
  reason?: 'age' | 'low_importance' | 'deprecated' | 'manual';
  createSummary?: boolean;
}): Promise<ArchiveResult>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `memoryId` | string | UUID of memory to archive |
| `reason` | string | Reason for archiving |
| `createSummary` | boolean | Generate summary before archiving |

**Returns:**
```typescript
{
  success: boolean;
  memoryId: string;
  oldType: MemoryType;
  newType: 'archival';
  reason: string;
  summary?: string;
  timestamp: string;
  error?: string;
}
```

---

### `evaluateMemoryLifecycle(memoryId)`

Evaluates a memory for promotion or archive eligibility.

**Signature:**
```typescript
evaluateMemoryLifecycle(params: {
  memoryId: string;
  importance: number;
  ageInDays: number;
  accessCount: number;
  type: MemoryType;
  tags?: string[];
}): Promise<EvaluationResult>
```

**Returns:**
```typescript
{
  memoryId: string;
  currentState: MemoryType;
  recommendedAction: 'promote' | 'archive' | 'maintain' | 'review';
  confidence: number;
  reasons: string[];
  metrics: {
    importance: number;
    ageInDays: number;
    accessCount: number;
    decayedScore: number;
  };
}
```

---

### `batchEvaluate(memories[])`

Evaluates multiple memories for lifecycle transitions.

**Signature:**
```typescript
batchEvaluate(memories: Array<{
  memoryId: string;
  type: MemoryType;
  importance: number;
  ageInDays: number;
  accessCount: number;
  tags?: string[];
}>): Promise<EvaluationResult[]>
```

---

## Promotion Criteria

A memory is **recommended for promotion** from Episodic to Semantic when:

| Criterion | Threshold | Rationale |
|-----------|-----------|-----------|
| **High Access** | accessCount ≥ 10 | Frequently referenced |
| **High Importance** | importance ≥ 0.8 | Critical information |
| **Critical Tag** | tags includes "critical" or "permanent" | Explicitly marked |
| **Cross-References** | referenced by ≥ 3 other memories | Central to knowledge graph |

### Promotion Logic

```typescript
function shouldPromote(memory): boolean {
  return (
    memory.accessCount >= PROMOTION_ACCESS_THRESHOLD ||
    memory.importance >= PROMOTION_IMPORTANCE_THRESHOLD ||
    memory.tags?.includes('critical') ||
    memory.tags?.includes('permanent') ||
    memory.crossReferenceCount >= 3
  );
}
```

---

## Archive Criteria

A memory is **recommended for archiving** when:

| Criterion | Threshold | Rationale |
|-----------|-----------|-----------|
| **Age** | ageInDays ≥ 30 | Old episodic memory |
| **Low Importance** | importance < 0.3 | Low value information |
| **No Access** | accessCount = 0 | Never referenced |
| **Deprecated Tag** | tags includes "deprecated" | Marked obsolete |

### Archive Logic

```typescript
function shouldArchive(memory): boolean {
  return (
    (memory.ageInDays >= ARCHIVE_AGE_DAYS &&
     memory.importance < ARCHIVE_IMPORTANCE_THRESHOLD &&
     memory.accessCount <= ARCHIVE_ACCESS_THRESHOLD) ||
    memory.tags?.includes('deprecated')
  );
}
```

---

## Usage Examples

### Promote High-Value Memory

```typescript
import { promoteMemory, evaluateMemoryLifecycle } from './archivist';

// Evaluate first
const evaluation = await evaluateMemoryLifecycle({
  memoryId: '550e8400-e29b-41d4-a716-446655440000',
  importance: 0.85,
  ageInDays: 5,
  accessCount: 15,
  type: 'episodic',
  tags: ['user-preferences', 'critical']
});

if (evaluation.recommendedAction === 'promote') {
  const result = await promoteMemory({
    memoryId: evaluation.memoryId,
    reason: 'high_access'
  });
  
  console.log(`Promoted to semantic: ${result.memoryId}`);
}
```

### Archive Old Memory

```typescript
import { archiveMemory } from './archivist';

const result = await archiveMemory({
  memoryId: '660e8400-e29b-41d4-a716-446655440001',
  reason: 'age',
  createSummary: true
});

console.log(`Archived with summary: ${result.summary}`);
```

### Batch Evaluation

```typescript
import { batchEvaluate } from './archivist';

const memories = [
  {
    memoryId: 'mem-001',
    type: 'episodic',
    importance: 0.9,
    ageInDays: 3,
    accessCount: 20,
    tags: ['critical']
  },
  {
    memoryId: 'mem-002',
    type: 'episodic',
    importance: 0.2,
    ageInDays: 45,
    accessCount: 0,
    tags: []
  }
];

const evaluations = await batchEvaluate(memories);

for (const eval of evaluations) {
  console.log(`${eval.memoryId}: ${eval.recommendedAction}`);
  // mem-001: promote
  // mem-002: archive
}
```

---

## Integration with AgeMem

The archivist integrates with AgeMem lifecycle management:

```typescript
import { memory_update } from './decay';
import { promoteMemory, archiveMemory } from './archivist';

// Promotion workflow
async function executePromotion(memoryId: string) {
  const result = await promoteMemory({
    memoryId,
    reason: 'high_access'
  });
  
  if (result.success) {
    // Update storage path in AgeMem
    await memory_update({
      id: memoryId,
      type: 'semantic',
      metadata: {
        promotedAt: result.timestamp,
        promotionReason: result.reason
      }
    });
  }
  
  return result;
}
```

---

## Lifecycle Event Logging

All transitions are logged for audit:

```typescript
interface LifecycleEvent {
  eventId: string;
  memoryId: string;
  eventType: 'promote' | 'archive' | 'delete';
  fromState: MemoryType;
  toState: MemoryType;
  reason: string;
  triggeredBy: 'auto' | 'manual';
  agentId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

### Example Log Entry

```json
{
  "eventId": "evt-2026-04-04-001",
  "memoryId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "promote",
  "fromState": "episodic",
  "toState": "semantic",
  "reason": "high_access",
  "triggeredBy": "auto",
  "agentId": "archivist-lobe",
  "timestamp": "2026-04-04T01:25:00Z",
  "metadata": {
    "accessCount": 15,
    "importance": 0.85,
    "ageInDays": 5
  }
}
```

---

## Output Example

```markdown
# Archivist Lifecycle Report

**Generated:** 2026-04-04T01:25:00Z
**Memories Evaluated:** 156

## Summary

| Action | Count | Percentage |
|--------|-------|------------|
| Promote to Semantic | 12 | 7.7% |
| Archive | 8 | 5.1% |
| Maintain | 134 | 85.9% |
| Manual Review | 2 | 1.3% |

## Promotions (12)

1. **"User prefers TypeScript over JavaScript"**
   - Access Count: 15
   - Importance: 0.85
   - Age: 5 days
   - Reason: High access frequency

2. **"PostgreSQL pgvector schema design"**
   - Access Count: 22
   - Importance: 0.92
   - Age: 10 days
   - Reason: High access + high importance

## Archives (8)

1. **"Initial project setup notes"**
   - Access Count: 0
   - Importance: 0.15
   - Age: 45 days
   - Reason: Age + low access

## Manual Review Required (2)

1. **"Consciousness emulation framework"**
   - Access Count: 8
   - Importance: 0.75
   - Age: 2 days
   - Reason: Borderline promotion (trending topic)

---

*Archivist lifecycle evaluation complete.*
```

---

## Sentinel Agent Considerations

**Security:**
- No direct memory deletion (only soft archive)
- All transitions logged for audit
- Requires consensus for destructive operations

**God Mode Prevention:**
- Cannot bypass AgeMem consensus
- Archive is reversible (soft delete)
- Promotion requires meeting explicit criteria

**Privacy:**
- Archived memories preserved for audit
- No external data transmission
- Lifecycle events logged locally

---

## Testing Strategy

### Unit Tests

```typescript
describe('archivist', () => {
  it('recommends promotion for high-access memory', async () => {
    const result = await evaluateMemoryLifecycle({
      memoryId: 'test-1',
      importance: 0.7,
      ageInDays: 5,
      accessCount: 15,
      type: 'episodic'
    });
    expect(result.recommendedAction).toBe('promote');
  });

  it('recommends archive for old unused memory', async () => {
    const result = await evaluateMemoryLifecycle({
      memoryId: 'test-2',
      importance: 0.2,
      ageInDays: 45,
      accessCount: 0,
      type: 'episodic'
    });
    expect(result.recommendedAction).toBe('archive');
  });

  it('maintains memory that does not meet criteria', async () => {
    const result = await evaluateMemoryLifecycle({
      memoryId: 'test-3',
      importance: 0.5,
      ageInDays: 10,
      accessCount: 3,
      type: 'episodic'
    });
    expect(result.recommendedAction).toBe('maintain');
  });
});
```

### Integration Tests

- End-to-end promotion with AgeMem `memory_update()`
- Archive workflow with summary generation
- Lifecycle event logging verification

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| **AgeMem** | Consumer of lifecycle decisions |
| **Memory Consolidation** | Triggers archivist evaluations |
| **Importance Scorer** | Provides importance scores for decisions |
| **Historian Agent** | Reviews lifecycle event logs |
| **Sentinel Agent** | Audits lifecycle transitions |

---

## Future Enhancements

1. **Smart Summarization** — Auto-generate summaries before archiving
2. **Batch Operations** — Efficient bulk promote/archive
3. **Lifecycle Prediction** — ML-based transition forecasting
4. **Cross-Memory Linking** — Preserve relationships during transitions
5. **Undo Operations** — Reversible archive/promote within time window

---

*Archivist Lobe — Where memories find their proper place.*
