---
name: importance-scorer
description: Calculates and assigns importance scores to memories based on content analysis, user signals, access patterns, and emotional salience. Use when adding new memories or re-evaluating existing ones.
---

# Importance Scorer Lobe

**Purpose:** Assign accurate importance scores (0-1) to memories using multi-factor analysis.

**Status:** 🟡 Implemented (2026-04-04)
**Type:** Lobe Agent Skill
**Location:** `~/.openclaw/workspace/skills/importance-scorer/`

---

## Overview

The importance scorer lobe is a specialized agent skill that calculates memory importance scores using a weighted combination of signals:

1. **Content Analysis** - Semantic richness, uniqueness, factual density
2. **User Signals** - Explicit importance ratings, user feedback
3. **Access Patterns** - Frequency, recency, cross-references
4. **Emotional Salience** - Sentiment intensity, emotional markers (Empath integration)
5. **Contextual Relevance** - Current goals, active projects, temporal relevance

This ensures memories are weighted appropriately for AgeMem retrieval with Ebbinghaus decay.

---

## Configuration

```bash
# Environment Variables
IMPORTANCE_SCORER_ENABLED="${IMPORTANCE_SCORER_ENABLED:-true}"
CONTENT_WEIGHT="${CONTENT_WEIGHT:-0.30}"         # Content analysis weight
USER_SIGNAL_WEIGHT="${USER_SIGNAL_WEIGHT:-0.25}" # User-provided signals weight
ACCESS_PATTERN_WEIGHT="${ACCESS_PATTERN_WEIGHT:-0.20}" # Access history weight
EMOTIONAL_WEIGHT="${EMOTIONAL_WEIGHT:-0.15}"     # Emotional salience weight
CONTEXTUAL_WEIGHT="${CONTEXTUAL_WEIGHT:-0.10}"   # Contextual relevance weight
MIN_IMPORTANCE="${MIN_IMPORTANCE:-0.1}"          # Floor value
MAX_IMPORTANCE="${MAX_IMPORTANCE:-1.0}"          # Cap value
```

---

## Importance Score Formula

```
importance = normalize(
  (content_score × CONTENT_WEIGHT) +
  (user_signal × USER_SIGNAL_WEIGHT) +
  (access_score × ACCESS_PATTERN_WEIGHT) +
  (emotional_score × EMOTIONAL_WEIGHT) +
  (contextual_score × CONTEXTUAL_WEIGHT)
)

Where:
  - All component scores are normalized to 0-1 range
  - Weights sum to 1.0
  - Final result is clamped to [MIN_IMPORTANCE, MAX_IMPORTANCE]
```

---

## API Functions

### `calculateImportance(params)`

Calculates importance score for a memory candidate.

**Signature:**
```typescript
calculateImportance(params: {
  content: string;
  type?: MemoryType;
  userProvidedImportance?: number;
  accessCount?: number;
  recencyScore?: number;
  emotionalScore?: number;
  contextualRelevance?: number;
  metadata?: Record<string, unknown>;
}): Promise<{
  score: number;
  breakdown: ImportanceBreakdown;
  confidence: number;
  factors: string[];
}>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | string | Memory content to analyze |
| `type` | MemoryType | Memory type (affects scoring) |
| `userProvidedImportance` | number | Explicit user rating (0-1) |
| `accessCount` | number | Number of times accessed |
| `recencyScore` | number | Recency factor (0-1) |
| `emotionalScore` | number | Emotional salience (0-1) |
| `contextualRelevance` | number | Current context match (0-1) |
| `metadata` | Record | Additional context |

**Returns:**
```typescript
{
  score: number;              // Final importance (0-1)
  breakdown: {
    content: number;          // Content analysis score
    userSignal: number;       // User-provided score
    access: number;           // Access pattern score
    emotional: number;        // Emotional salience score
    contextual: number;       // Contextual relevance score
  };
  confidence: number;         // Confidence in score (0-1)
  factors: string[];          // Key factors influencing score
}
```

---

## Content Analysis Factors

The content analyzer evaluates:

| Factor | Description | Weight |
|--------|-------------|--------|
| **Semantic Density** | Ratio of meaningful terms to total words | 0.20 |
| **Entity Count** | Named entities, concepts, technical terms | 0.15 |
| **Uniqueness** | Novelty compared to existing memories | 0.20 |
| **Actionability** | Contains instructions, decisions, tasks | 0.15 |
| **Factual Content** | Verifiable facts, data, specifications | 0.15 |
| **Cross-References** | Links to other memories/concepts | 0.15 |

### Content Score Calculation

```typescript
contentScore = normalize(
  semanticDensity × 0.20 +
  entityCount × 0.15 +
  uniqueness × 0.20 +
  actionability × 0.15 +
  factualContent × 0.15 +
  crossReferences × 0.15
)
```

---

## Access Pattern Scoring

Access patterns indicate memory value through usage:

```typescript
accessScore = normalize(
  log10(accessCount + 1) / log10(maxAccessCount + 1) × 0.6 +
  recencyScore × 0.4
)
```

**Access Tiers:**
| Access Count | Score Contribution |
|--------------|-------------------|
| 0 | 0.0 |
| 1-2 | 0.2 |
| 3-5 | 0.4 |
| 6-10 | 0.6 |
| 11-20 | 0.8 |
| 21+ | 1.0 |

---

## Emotional Salience (Empath Integration)

When Empath agent is available, emotional score is calculated:

```typescript
emotionalScore = normalize(
  sentimentIntensity × 0.4 +
  emotionalMarkers × 0.3 +
  personalRelevance × 0.3
)
```

**Emotional Markers:**
- First-person statements ("I prefer", "my approach")
- Value judgments ("important", "critical", "avoid")
- Preference expressions ("like", "dislike", "prefer")
- Decision points ("decided", "chose", "concluded")

---

## Memory Type Adjustments

Different memory types have different baseline importance:

| Type | Base Importance | Rationale |
|------|-----------------|-----------|
| **Working** | 0.3 | Temporary, session-only |
| **Episodic** | 0.5 | Experience record, variable value |
| **Semantic** | 0.7 | Factual knowledge, higher value |
| **Procedural** | 0.8 | Skills and methods, high utility |
| **Archival** | 0.6 | Historical record, moderate value |

---

## Usage Examples

### Basic Importance Calculation

```typescript
import { calculateImportance } from './importance-scorer';

const result = await calculateImportance({
  content: "User prefers TypeScript over JavaScript for type safety",
  type: "semantic",
  userProvidedImportance: 0.9
});

console.log(`Importance: ${result.score}`);
console.log(`Breakdown:`, result.breakdown);
console.log(`Factors:`, result.factors);
```

### With Full Context

```typescript
const result = await calculateImportance({
  content: "Decision: Use PostgreSQL with pgvector for semantic search",
  type: "semantic",
  userProvidedImportance: 0.85,
  accessCount: 12,
  recencyScore: 0.9,
  emotionalScore: 0.6,
  contextualRelevance: 0.95,
  metadata: {
    project: "AgeMem",
    decisionType: "architecture",
    alternatives: ["Redis", "Pinecone", "Weaviate"]
  }
});

// Result:
// {
//   score: 0.88,
//   breakdown: {
//     content: 0.85,
//     userSignal: 0.85,
//     access: 0.72,
//     emotional: 0.60,
//     contextual: 0.95
//   },
//   confidence: 0.92,
//   factors: [
//     "High user-provided importance",
//     "Strong contextual relevance",
//     "Frequent access pattern",
//     "Architectural decision content"
//   ]
// }
```

### Batch Scoring

```typescript
import { batchCalculateImportance } from './importance-scorer';

const memories = [
  { content: "User prefers dark mode", type: "semantic" },
  { content: "Meeting notes from 2024-01-15", type: "episodic" },
  { content: "How to deploy to Kubernetes", type: "procedural" }
];

const results = await batchCalculateImportance(memories);
```

---

## Integration with AgeMem

The importance scorer integrates directly with the AgeMem `memory_add()` API:

```typescript
import { memory_add } from './decay';
import { calculateImportance } from './importance-scorer';

// Calculate importance before adding memory
const importanceResult = await calculateImportance({
  content: "User's preferred development workflow",
  type: "semantic",
  accessCount: 5
});

// Add memory with calculated importance
const memoryResult = await memory_add({
  content: "User's preferred development workflow",
  type: "semantic",
  importance: importanceResult.score,  // Use calculated score
  metadata: {
    importanceBreakdown: importanceResult.breakdown,
    confidence: importanceResult.confidence
  }
});
```

---

## Confidence Calculation

Confidence indicates reliability of the importance score:

```typescript
confidence = normalize(
  (hasUserSignal ? 0.4 : 0) +
  (contentQuality × 0.3) +
  (dataCompleteness × 0.3)
)
```

**Confidence Tiers:**
| Confidence | Meaning |
|------------|---------|
| 0.8-1.0 | High confidence - multiple strong signals |
| 0.6-0.8 | Moderate confidence - adequate signals |
| 0.4-0.6 | Low confidence - limited signals |
| 0.0-0.4 | Very low confidence - guess based on defaults |

---

## Sentinel Agent Considerations

**Security:**
- No external API calls without consent
- Content analysis is local-only
- Emotional scoring requires Empath agent opt-in

**God Mode Prevention:**
- Importance scores are suggestions, not enforcement
- User can always override calculated scores
- Scores decay naturally via Ebbinghaus curve

**Privacy:**
- Content not stored externally
- Emotional analysis opt-in only
- Access patterns tracked locally

---

## Output Example

```markdown
# Importance Scorer Report

**Memory:** "Decision: Use PostgreSQL with pgvector for semantic search"
**Type:** semantic
**Timestamp:** 2026-04-04T01:20:00Z

## Score Breakdown

| Factor | Score | Weight | Contribution |
|--------|-------|--------|--------------|
| Content Analysis | 0.85 | 30% | 0.255 |
| User Signal | 0.85 | 25% | 0.213 |
| Access Pattern | 0.72 | 20% | 0.144 |
| Emotional Salience | 0.60 | 15% | 0.090 |
| Contextual Relevance | 0.95 | 10% | 0.095 |

**Final Score:** 0.88 (clamped to [0.1, 1.0])
**Confidence:** 0.92

## Key Factors

1. ✅ High user-provided importance (0.85)
2. ✅ Strong contextual relevance (0.95)
3. ✅ Frequent access pattern (12 accesses)
4. ✅ Architectural decision content
5. ⚠️ Moderate emotional salience

## Recommendation

**HIGH IMPORTANCE** - This memory should be:
- Stored in semantic memory tier
- Given long half-life (30 days)
- Prioritized in retrieval operations
- Considered for cross-referencing
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('importance-scorer', () => {
  it('calculates score with user-provided importance', async () => {
    const result = await calculateImportance({
      content: 'Test content',
      userProvidedImportance: 0.9
    });
    expect(result.score).toBeCloseTo(0.9, 1);
  });

  it('handles missing signals gracefully', async () => {
    const result = await calculateImportance({
      content: 'Test content'
    });
    expect(result.score).toBeGreaterThanOrEqual(0.1);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('respects memory type baselines', async () => {
    const procedural = await calculateImportance({
      content: 'How to do something',
      type: 'procedural'
    });
    const working = await calculateImportance({
      content: 'How to do something',
      type: 'working'
    });
    expect(procedural.score).toBeGreaterThan(working.score);
  });
});
```

### Integration Tests

- End-to-end with AgeMem `memory_add()`
- Empath agent emotional scoring integration
- Cross-agent importance consensus

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| **AgeMem** | Consumer of importance scores |
| **Memory Consolidation** | Uses importance for promotion decisions |
| **Empath Agent** | Provides emotional salience scoring |
| **Historian Agent** | Reviews importance trends |
| **Sentinel Agent** | Audits scoring fairness |

---

## Future Enhancements

1. **Learning Weights** - Adapt factor weights based on user feedback
2. **Domain-Specific Scoring** - Different weights for code vs. conversation vs. decisions
3. **Temporal Patterns** - Boost importance for recurring themes
4. **Cross-Memory Validation** - Compare with related memories for consistency
5. **User Calibration** - Learn individual user importance patterns

---

*Importance Scorer - Because not all memories are created equal.*
