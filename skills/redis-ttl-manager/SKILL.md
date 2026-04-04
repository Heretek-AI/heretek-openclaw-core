---
name: redis-ttl-manager
description: Manages Redis cache TTLs for AgeMem working memory, calculating expiration times based on memory type, importance, access patterns, and Ebbinghaus decay.
---

# Redis TTL Manager Lobe

**Purpose:** Calculate and manage Redis cache TTLs for AgeMem working memory tier.

**Status:** 🟡 Implemented (2026-04-04)
**Type:** Lobe Agent Skill
**Location:** `~/.openclaw/workspace/skills/redis-ttl-manager/`

---

## Overview

The Redis TTL manager lobe provides intelligent cache expiration for AgeMem's working memory tier:

1. **TTL Calculation** — Compute expiration based on importance and decay
2. **Type-Based Defaults** — Different TTLs per memory type
3. **Access Pattern Adjustment** — Extend TTL for frequently accessed memories
4. **Decay Integration** — Align TTL with Ebbinghaus retention curve
5. **Cache Health Monitoring** — Track cache hit/miss ratios

This ensures working memory is available when needed but automatically expires when no longer relevant.

---

## Configuration

```bash
# Environment Variables
REDIS_TTL_ENABLED="${REDIS_TTL_ENABLED:-true}"
BASE_TTL_SECONDS="${BASE_TTL_SECONDS:-86400}"          # 24 hours base
MIN_TTL_SECONDS="${MIN_TTL_SECONDS:-300}"              # 5 minutes minimum
MAX_TTL_SECONDS="${MAX_TTL_SECONDS:-604800}"           # 7 days maximum
IMPORTANCE_MULTIPLIER="${IMPORTANCE_MULTIPLIER:-1.5}"  # Importance weight
ACCESS_BONUS_MULTIPLIER="${ACCESS_BONUS_MULTIPLIER:-1.2}" # Per-access bonus
DECAY_AWARE_TTL="${DECAY_AWARE_TTL:-true}"             # Use Ebbinghaus decay
```

---

## TTL Calculation Formula

```
baseTTL = BASE_TTL_SECONDS × memoryTypeMultiplier

importanceBonus = 1 + (importance × IMPORTANCE_MULTIPLIER)
accessBonus = log2(accessCount + 1) × ACCESS_BONUS_MULTIPLIER

rawTTL = baseTTL × importanceBonus × accessBonus

if DECAY_AWARE_TTL:
    decayFactor = e^(-λ × ageInDays)  # Ebbinghaus decay
    rawTTL = rawTTL × decayFactor

finalTTL = clamp(rawTTL, MIN_TTL_SECONDS, MAX_TTL_SECONDS)
```

### Memory Type Multipliers

| Type | Multiplier | Base TTL (24h base) | Rationale |
|------|------------|---------------------|-----------|
| **Working** | 0.25 | 6 hours | Session-only, short-lived |
| **Episodic** | 1.0 | 24 hours | Recent experiences |
| **Semantic** | 2.0 | 48 hours | Important facts |
| **Procedural** | 3.0 | 72 hours | Skills persist longer |
| **Archival** | N/A | No cache | Not cached |

---

## API Functions

### `calculateTTL(params)`

Calculates TTL in seconds for a memory cache entry.

**Signature:**
```typescript
calculateTTL(params: {
  importance: number;
  accessCount?: number;
  ageInDays?: number;
  type?: MemoryType;
  halfLifeDays?: number;
}): number
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `importance` | number | Memory importance (0-1) |
| `accessCount` | number | Number of accesses |
| `ageInDays` | number | Memory age in days |
| `type` | MemoryType | Memory type |
| `halfLifeDays` | number | Ebbinghaus half-life |

**Returns:** TTL in seconds (clamped to min/max)

---

### `setMemoryWithTTL(key, value, params)`

Sets a memory in Redis with calculated TTL.

**Signature:**
```typescript
setMemoryWithTTL(params: {
  key: string;
  value: string;
  importance: number;
  accessCount?: number;
  type?: MemoryType;
}): Promise<{
  success: boolean;
  key: string;
  ttl: number;
  expiresAt: Date;
}>
```

---

### `extendTTL(key, params)`

Extends TTL for an existing cache entry (on access).

**Signature:**
```typescript
extendTTL(params: {
  key: string;
  accessCount: number;
  importance: number;
  type?: MemoryType;
}): Promise<{
  success: boolean;
  key: string;
  newTTL: number;
  remainingTTL: number;
}>
```

---

### `getCacheHealth()`

Reports cache health metrics.

**Signature:**
```typescript
getCacheHealth(): Promise<{
  totalKeys: number;
  avgTTL: number;
  hitRate: number;
  missRate: number;
  expiredCount: number;
  evictedCount: number;
  memoryUsage: number;
}>
```

---

## Usage Examples

### Basic TTL Calculation

```typescript
import { calculateTTL } from './redis-ttl-manager';

// High importance, frequently accessed memory
const ttl = calculateTTL({
  importance: 0.9,
  accessCount: 15,
  type: 'semantic'
});

console.log(`TTL: ${ttl} seconds (${Math.floor(ttl / 60)} minutes)`);
// Output: TTL: 172800 seconds (2880 minutes / 48 hours)
```

### Set Memory with TTL

```typescript
import { setMemoryWithTTL } from './redis-ttl-manager';

const result = await setMemoryWithTTL({
  key: 'memory:user:preferences:typescript',
  value: JSON.stringify({
    content: 'User prefers TypeScript over JavaScript',
    importance: 0.9,
    type: 'semantic'
  }),
  importance: 0.9,
  accessCount: 5,
  type: 'semantic'
});

console.log(`Cache expires at: ${result.expiresAt}`);
```

### Extend TTL on Access

```typescript
import { extendTTL } from './redis-ttl-manager';

// Called when memory is accessed from cache
const result = await extendTTL({
  key: 'memory:user:preferences:typescript',
  accessCount: 6, // Incremented from 5
  importance: 0.9,
  type: 'semantic'
});

console.log(`New TTL: ${result.newTTL}s, Remaining: ${result.remainingTTL}s`);
```

### Cache Health Report

```typescript
import { getCacheHealth } from './redis-ttl-manager';

const health = await getCacheHealth();

console.log(`Cache Health Report:
- Total Keys: ${health.totalKeys}
- Average TTL: ${Math.floor(health.avgTTL / 60)} minutes
- Hit Rate: ${(health.hitRate * 100).toFixed(1)}%
- Miss Rate: ${(health.missRate * 100).toFixed(1)}%
- Expired: ${health.expiredCount}
- Evicted: ${health.evictedCount}
- Memory: ${health.memoryUsage} bytes
`);
```

---

## Integration with AgeMem

The TTL manager integrates with AgeMem working memory:

```typescript
import { memory_add } from './decay';
import { setMemoryWithTTL, calculateTTL } from './redis-ttl-manager';

// Add memory and cache in Redis
async function addAndCacheMemory(content: string, type: MemoryType, importance: number) {
  // Add to AgeMem persistent storage
  const memoryResult = await memory_add({
    content,
    type,
    importance
  });
  
  // Cache in Redis with calculated TTL
  const cacheResult = await setMemoryWithTTL({
    key: `memory:${type}:${memoryResult.id}`,
    value: JSON.stringify(memoryResult),
    importance,
    type
  });
  
  return {
    ...memoryResult,
    cached: true,
    cacheExpires: cacheResult.expiresAt
  };
}
```

---

## TTL Extension Strategy

When a cached memory is accessed, the TTL can be extended:

```typescript
function calculateExtensionFactor(accessCount: number): number {
  // Diminishing returns: each access extends less than the previous
  // log2(accessCount + 1) gives: 1 access=1, 3 accesses=2, 7 accesses=3, etc.
  return Math.log2(accessCount + 1);
}

// Extension formula
newTTL = currentTTL × (1 + extensionFactor × ACCESS_BONUS_MULTIPLIER)
```

### Extension Limits

| Access Count | Max Extension |
|--------------|---------------|
| 1 | +20% |
| 3 | +60% |
| 7 | +120% |
| 15 | +200% |
| 31 | +280% |

---

## Output Example

```markdown
# Redis TTL Manager Report

**Generated:** 2026-04-04T01:30:00Z
**Cache Region:** AgeMem Working Memory

## Cache Statistics

| Metric | Value | Trend |
|--------|-------|-------|
| Total Keys | 1,247 | +23 |
| Average TTL | 4.2 hours | -0.3h |
| Hit Rate | 87.3% | +2.1% |
| Miss Rate | 12.7% | -2.1% |
| Expired (24h) | 342 | -15 |
| Evicted (24h) | 12 | -3 |
| Memory Usage | 45.2 MB | +1.2MB |

## TTL Distribution

| Range | Count | Percentage |
|-------|-------|------------|
| < 1 hour | 234 | 18.8% |
| 1-6 hours | 456 | 36.6% |
| 6-24 hours | 389 | 31.2% |
| 24-72 hours | 145 | 11.6% |
| > 72 hours | 23 | 1.8% |

## Type Breakdown

| Type | Keys | Avg TTL | Hit Rate |
|------|------|---------|----------|
| Working | 523 | 3.2h | 92.1% |
| Episodic | 412 | 18.5h | 85.3% |
| Semantic | 267 | 42.1h | 78.2% |
| Procedural | 45 | 65.3h | 91.5% |

## Recommendations

1. **Increase semantic cache TTL** — Low hit rate (78.2%) suggests premature expiration
2. **Consider LRU eviction** — 12 evictions indicate memory pressure
3. **Pre-fetch high-value memories** — 15 procedural memories have 91.5% hit rate

---

*Redis TTL Manager — Smart caching for AgeMem working memory.*
```

---

## Sentinel Agent Considerations

**Security:**
- No credential storage in cache
- Cache keys are sanitized
- TTL is bounded (min/max enforced)

**God Mode Prevention:**
- Cache is read-only optimization
- No bypass of consensus mechanisms
- Expiration is automatic, not manual

**Privacy:**
- Sensitive data should not be cached
- Cache is local (not replicated externally)
- Automatic expiration prevents long-term storage

---

## Testing Strategy

### Unit Tests

```typescript
describe('redis-ttl-manager', () => {
  it('calculates longer TTL for higher importance', () => {
    const lowImportance = calculateTTL({ importance: 0.2 });
    const highImportance = calculateTTL({ importance: 0.9 });
    expect(highImportance).toBeGreaterThan(lowImportance);
  });

  it('respects minimum TTL', () => {
    const ttl = calculateTTL({ importance: 0 });
    expect(ttl).toBeGreaterThanOrEqual(MIN_TTL_SECONDS);
  });

  it('respects maximum TTL', () => {
    const ttl = calculateTTL({ 
      importance: 1.0, 
      accessCount: 100,
      type: 'procedural'
    });
    expect(ttl).toBeLessThanOrEqual(MAX_TTL_SECONDS);
  });

  it('applies decay factor when enabled', () => {
    const fresh = calculateTTL({ importance: 0.8, ageInDays: 0 });
    const old = calculateTTL({ importance: 0.8, ageInDays: 7 });
    expect(old).toBeLessThan(fresh);
  });
});
```

### Integration Tests

- End-to-end Redis set/get with TTL
- TTL extension on access
- Cache health monitoring
- Memory pressure handling

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| **AgeMem** | Consumer of TTL services |
| **Ebbinghaus Decay** | Provides decay factor for TTL |
| **Memory Consolidation** | Triggers cache invalidation |
| **Archivist** | Archives expired memories |

---

## Future Enhancements

1. **Adaptive TTL** — Learn optimal TTLs from access patterns
2. **Predictive Caching** — Pre-cache memories likely to be accessed
3. **Multi-Region Cache** — Distributed cache with consistent TTLs
4. **Cache Warming** — Restore important memories after restart
5. **Memory Pressure Handling** — Graceful degradation under load

---

*Redis TTL Manager — Because even working memory needs to rest.*
