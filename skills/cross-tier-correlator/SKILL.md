---
name: cross-tier-correlator
description: Discovers and maintains relationships between memories across tiers (episodic, semantic, procedural), enabling unified retrieval and knowledge graph navigation.
---

# Cross-Tier Correlator Lobe

**Purpose:** Build and maintain cross-tier memory relationships for unified AgeMem retrieval.

**Status:** 🟡 Implemented (2026-04-04)
**Type:** Lobe Agent Skill
**Location:** `~/.openclaw/workspace/skills/cross-tier-correlator/`

---

## Overview

The cross-tier correlator lobe provides memory relationship management:

1. **Link Discovery** — Automatically find related memories across tiers
2. **Relationship Types** — Categorize links (references, derives_from, contradicts, etc.)
3. **Correlation Scoring** — Rank relationships by strength
4. **Graph Navigation** — Traverse memory relationships
5. **Unified Retrieval** — Query across all tiers with relationship awareness

This enables the Collective to navigate from experiences (episodic) to knowledge (semantic) to skills (procedural).

---

## Configuration

```bash
# Environment Variables
CORRELATOR_ENABLED="${CORRELATOR_ENABLED:-true}"
MIN_CORRELATION_SCORE="${MIN_CORRELATION_SCORE:-0.6}"  # Minimum link strength
MAX_LINKS_PER_MEMORY="${MAX_LINKS_PER_MEMORY:-50}"      # Cap on relationships
AUTO_DISCOVER_ENABLED="${AUTO_DISCOVER_ENABLED:-true}"  # Auto-discover on add
EMBEDDING_MODEL="${EMBEDDING_MODEL:-all-MiniLM-L6-v2}"  # For semantic similarity
```

---

## Relationship Types

| Type | Direction | Description | Example |
|------|-----------|-------------|---------|
| **references** | A → B | Memory A mentions B | Episode references semantic fact |
| **derives_from** | A ← B | A was inferred from B | Semantic derived from episodes |
| **contradicts** | A ↔ B | A conflicts with B | Conflicting information |
| **supports** | A → B | A provides evidence for B | Episode supports semantic claim |
| **generalizes** | A → B | A is general form of B | Procedural generalizes episode |
| **specializes** | A ← B | A is specific instance of B | Episode specializes procedural |
| **temporal_sequence** | A → B | A happened before B | Sequential episodes |
| **causal** | A → B | A caused B | Causal relationship |

---

## API Functions

### `findCorrelations(memoryId, params)`

Finds memories related to a given memory across tiers.

**Signature:**
```typescript
findCorrelations(params: {
  memoryId: string;
  type: MemoryType;
  maxResults?: number;
  minScore?: number;
  relationshipTypes?: RelationshipType[];
}): Promise<CorrelationResult>
```

**Returns:**
```typescript
{
  memoryId: string;
  correlations: Array<{
    targetId: string;
    targetType: MemoryType;
    relationshipType: RelationshipType;
    score: number;
    reason: string;
  }>;
  totalFound: number;
}
```

---

### `addRelationship(params)`

Creates a relationship between two memories.

**Signature:**
```typescript
addRelationship(params: {
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  score?: number;
  metadata?: Record<string, unknown>;
}): Promise<RelationshipResult>
```

---

### `buildCorrelationGraph(params)`

Builds a correlation graph for a set of memories.

**Signature:**
```typescript
buildCorrelationGraph(params: {
  memoryIds: string[];
  includeTypes?: MemoryType[];
  maxDepth?: number;
}): Promise<CorrelationGraph>
```

---

### `discoverLinks(params)`

Automatically discovers potential links using content analysis.

**Signature:**
```typescript
discoverLinks(params: {
  memoryId: string;
  content: string;
  type: MemoryType;
  searchSpace?: MemoryType[];
}): Promise<DiscoveredLink[]>
```

---

## Correlation Scoring

```
correlationScore = weightedSum(
  semanticSimilarity × 0.40,
  coOccurrence × 0.25,
  temporalProximity × 0.15,
  crossReference × 0.20
)
```

### Semantic Similarity

Uses embedding cosine similarity:
```
similarity = cosine(embedding_A, embedding_B)
```

### Co-Occurrence

Based on shared entities/terms:
```
coOccurrence = |entities_A ∩ entities_B| / |entities_A ∪ entities_B|
```

### Temporal Proximity

For episodic memories:
```
temporalScore = e^(-|timestamp_A - timestamp_B| / τ)
where τ = 7 days (time constant)
```

### Cross-Reference

Explicit mentions:
```
crossReference = count(explicit_references) / max_references
```

---

## Usage Examples

### Find Related Memories

```typescript
import { findCorrelations } from './cross-tier-correlator';

const result = await findCorrelations({
  memoryId: '550e8400-e29b-41d4-a716-446655440000',
  type: 'episodic',
  maxResults: 10,
  minScore: 0.6
});

console.log(`Found ${result.totalFound} correlations:`);
for (const corr of result.correlations) {
  console.log(`  - ${corr.targetId} (${corr.targetType}): ${corr.relationshipType}`);
  console.log(`    Score: ${corr.score}, Reason: ${corr.reason}`);
}
```

### Add Relationship

```typescript
import { addRelationship } from './cross-tier-correlator';

const result = await addRelationship({
  sourceId: 'episode-001',
  targetId: 'semantic-042',
  relationshipType: 'references',
  score: 0.85,
  metadata: {
    discoveredBy: 'auto',
    context: 'User mentioned TypeScript preference'
  }
});
```

### Discover Links Automatically

```typescript
import { discoverLinks } from './cross-tier-correlator';

const links = await discoverLinks({
  memoryId: 'new-episode-001',
  content: 'Discussed PostgreSQL pgvector integration for semantic search',
  type: 'episodic',
  searchSpace: ['semantic', 'procedural']
});

console.log('Discovered links:');
for (const link of links) {
  console.log(`  ${link.targetId}: ${link.relationshipType} (${link.score})`);
}
```

### Build Correlation Graph

```typescript
import { buildCorrelationGraph } from './cross-tier-correlator';

const graph = await buildCorrelationGraph({
  memoryIds: ['mem-001', 'mem-002', 'mem-003'],
  includeTypes: ['episodic', 'semantic'],
  maxDepth: 2
});

console.log(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
```

---

## Integration with AgeMem

The correlator integrates with AgeMem unified retrieval:

```typescript
import { memory_retrieve } from './decay';
import { findCorrelations } from './cross-tier-correlator';

// Retrieve with cross-tier expansion
async function retrieveWithExpansion(query: string, recencyWeight: number) {
  // Base retrieval
  const baseResults = await memory_retrieve({ query, recencyWeight });
  
  // Expand top results with correlations
  const expanded = [];
  for (const result of baseResults.slice(0, 5)) {
    const correlations = await findCorrelations({
      memoryId: result.id,
      type: result.type as MemoryType,
      maxResults: 3
    });
    
    expanded.push(...correlations.correlations);
  }
  
  return {
    primary: baseResults,
    expanded,
    totalResults: baseResults.length + expanded.length
  };
}
```

---

## Output Example

```markdown
# Cross-Tier Correlation Report

**Generated:** 2026-04-04T01:30:00Z
**Seed Memory:** episode-2026-04-04-001

## Direct Correlations (5)

| Target | Type | Relationship | Score | Reason |
|--------|------|--------------|-------|--------|
| semantic-ts-pref | semantic | references | 0.92 | Entity match: TypeScript |
| proc-pgvector-setup | procedural | derives_from | 0.85 | Shared context |
| episode-2026-04-03-002 | episodic | temporal_sequence | 0.78 | Sequential session |
| semantic-pgvector | semantic | supports | 0.72 | Content similarity |
| proc-backup-config | procedural | references | 0.65 | Co-occurrence |

## Correlation Graph

```
episode-2026-04-04-001
├── semantic-ts-pref (references, 0.92)
│   └── proc-ts-best-practices (generalizes, 0.81)
├── proc-pgvector-setup (derives_from, 0.85)
│   └── semantic-pgvector (supports, 0.88)
└── episode-2026-04-03-002 (temporal_sequence, 0.78)
    └── semantic-a2a-protocol (references, 0.75)
```

## Tier Distribution

| Tier | Count | Avg Score |
|------|-------|-----------|
| Episodic | 12 | 0.74 |
| Semantic | 8 | 0.82 |
| Procedural | 5 | 0.79 |

## Recommendations

1. **Strong link detected** — episode → semantic-ts-pref (0.92)
2. **Potential contradiction** — semantic-001 ↔ semantic-042 (review needed)
3. **Orphan memory** — proc-unused-skill has no correlations

---

*Cross-Tier Correlator — Connecting experiences to knowledge.*
```

---

## Sentinel Agent Considerations

**Security:**
- No modification of memory content (relationships only)
- Relationship scores are suggestions, not enforcement
- Contradictions flagged for review, not auto-resolved

**God Mode Prevention:**
- Cannot delete or modify memories
- Relationships are metadata only
- Requires consensus for relationship enforcement

**Privacy:**
- Correlation data stored locally
- No external embedding API required (local models supported)
- Relationships respect memory access controls

---

## Testing Strategy

### Unit Tests

```typescript
describe('cross-tier-correlator', () => {
  it('finds semantic similarity between related memories', async () => {
    const result = await findCorrelations({
      memoryId: 'test-episode-1',
      type: 'episodic',
      maxResults: 5
    });
    expect(result.correlations.length).toBeGreaterThan(0);
  });

  it('respects minimum correlation score', async () => {
    const result = await findCorrelations({
      memoryId: 'test-episode-1',
      type: 'episodic',
      minScore: 0.8
    });
    for (const corr of result.correlations) {
      expect(corr.score).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('discovers cross-tier links', async () => {
    const links = await discoverLinks({
      memoryId: 'test-ep',
      content: 'PostgreSQL pgvector setup',
      type: 'episodic',
      searchSpace: ['semantic']
    });
    expect(links.some(l => l.targetType === 'semantic')).toBe(true);
  });
});
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| **AgeMem** | Provides unified retrieval with correlations |
| **Memory Consolidation** | Uses correlations for promotion decisions |
| **Importance Scorer** | Cross-references boost importance |
| **Archivist** | Preserves relationships during transitions |
| **Historian Agent** — | Analyzes correlation patterns |

---

## Future Enhancements

1. **Embedding Cache** — Cache embeddings for faster similarity
2. **Real-time Correlation** — Stream processing for live updates
3. **Graph Neural Network** — ML-based link prediction
4. **Temporal Reasoning** — Time-aware correlation patterns
5. **Contradiction Resolution** — Auto-flag conflicting memories

---

*Cross-Tier Correlator — Because knowledge is connected.*
