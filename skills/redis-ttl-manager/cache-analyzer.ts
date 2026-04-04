/**
 * ==============================================================================
 * Redis Cache Hit/Miss Analysis Module
 * ==============================================================================
 * Tracks and analyzes Redis cache performance for AgeMem working memory:
 * - Hit/miss counters per memory type
 * - Access pattern tracking (time-of-day, frequency)
 * - Cache warming suggestions based on patterns
 * - TTL efficiency analysis
 */

import type { MemoryType } from './redis-ttl-manager';
export type { MemoryType };

/**
 * Cache access record
 */
export interface CacheAccessRecord {
  /** Memory ID */
  memoryId: string;
  /** Memory type */
  memoryType: MemoryType;
  /** Timestamp of access */
  timestamp: Date;
  /** Whether it was a cache hit */
  isHit: boolean;
  /** Time-to-live remaining at access time (seconds) */
  ttlRemaining?: number;
  /** Original TTL when set (seconds) */
  originalTTL?: number;
}

/**
 * Cache statistics for a memory type
 */
export interface CacheStats {
  /** Memory type */
  memoryType: MemoryType;
  /** Total accesses */
  totalAccesses: number;
  /** Cache hits */
  hits: number;
  /** Cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Average TTL remaining when accessed (seconds) */
  avgTTLRemaining?: number;
  /** Expired before access count */
  expiredCount: number;
  /** Expiration rate (0-1) */
  expirationRate: number;
}

/**
 * Access pattern analysis
 */
export interface AccessPattern {
  /** Memory type */
  memoryType: MemoryType;
  /** Peak access hours (0-23) */
  peakHours: number[];
  /** Low access hours (0-23) */
  lowHours: number[];
  /** Average accesses per hour */
  avgAccessesPerHour: number;
  /** Access frequency trend (positive = increasing, negative = decreasing) */
  trend: number;
  /** Recommended TTL adjustment multiplier */
  recommendedTTLMultiplier: number;
}

/**
 * Cache warming suggestion
 */
export interface CacheWarmingSuggestion {
  /** Memory IDs to pre-load */
  memoryIds: string[];
  /** Reason for suggestion */
  reason: string;
  /** Expected hit rate improvement */
  expectedImprovement: number;
  /** Priority (1-10) */
  priority: number;
}

/**
 * Cache analysis result
 */
export interface CacheAnalysisResult {
  /** Overall statistics */
  overall: {
    totalAccesses: number;
    hitRate: number;
    expirationRate: number;
  };
  /** Statistics by memory type */
  byType: Record<MemoryType, CacheStats>;
  /** Access patterns by memory type */
  patterns: Record<MemoryType, AccessPattern>;
  /** Cache warming suggestions */
  suggestions: CacheWarmingSuggestion[];
  /** Analysis timestamp */
  timestamp: Date;
}

/**
 * Cache analyzer configuration
 */
export interface CacheAnalyzerConfig {
  /** Enable hit/miss tracking */
  enabled: boolean;
  /** Maximum access records to keep in memory */
  maxRecords: number;
  /** Pattern detection window (hours) */
  patternWindowHours: number;
  /** Minimum accesses for pattern detection */
  minAccessesForPattern: number;
  /** TTL adjustment sensitivity (0-1) */
  ttlSensitivity: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CACHE_ANALYZER_CONFIG: CacheAnalyzerConfig = {
  enabled: true,
  maxRecords: 10000,
  patternWindowHours: 168, // 1 week
  minAccessesForPattern: 50,
  ttlSensitivity: 0.3,
};

/**
 * Internal state for cache analyzer
 */
export interface CacheAnalyzerState {
  /** Access records */
  records: CacheAccessRecord[];
  /** Hit/miss counters by type */
  counters: Record<MemoryType, { hits: number; misses: number; expired: number }>;
  /** Configuration */
  config: CacheAnalyzerConfig;
}

/**
 * Create cache analyzer state
 */
export function createCacheAnalyzerState(
  config: Partial<CacheAnalyzerConfig> = {}
): CacheAnalyzerState {
  return {
    records: [],
    counters: {
      working: { hits: 0, misses: 0, expired: 0 },
      episodic: { hits: 0, misses: 0, expired: 0 },
      semantic: { hits: 0, misses: 0, expired: 0 },
      procedural: { hits: 0, misses: 0, expired: 0 },
      archival: { hits: 0, misses: 0, expired: 0 },
    },
    config: { ...DEFAULT_CACHE_ANALYZER_CONFIG, ...config },
  };
}

/**
 * Record a cache access
 */
export function recordCacheAccess(
  state: CacheAnalyzerState,
  record: CacheAccessRecord
): void {
  if (!state.config.enabled) return;

  // Add record
  state.records.push(record);

  // Trim if over limit
  if (state.records.length > state.config.maxRecords) {
    state.records = state.records.slice(-state.config.maxRecords);
  }

  // Update counters
  const counter = state.counters[record.memoryType];
  if (record.isHit) {
    counter.hits++;
  } else {
    counter.misses++;
  }

  // Track expiration
  if (record.ttlRemaining !== undefined && record.ttlRemaining <= 0) {
    counter.expired++;
  }
}

/**
 * Calculate cache statistics for a memory type
 */
export function calculateCacheStats(
  state: CacheAnalyzerState,
  memoryType: MemoryType
): CacheStats {
  const counter = state.counters[memoryType];
  const total = counter.hits + counter.misses;
  const hitRate = total > 0 ? counter.hits / total : 0;

  // Calculate average TTL remaining for hits
  const typeRecords = state.records.filter((r) => r.memoryType === memoryType && r.isHit);
  const avgTTLRemaining =
    typeRecords.length > 0
      ? typeRecords.reduce((sum, r) => sum + (r.ttlRemaining || 0), 0) / typeRecords.length
      : undefined;

  const expirationRate = total > 0 ? counter.expired / total : 0;

  return {
    memoryType,
    totalAccesses: total,
    hits: counter.hits,
    misses: counter.misses,
    hitRate,
    avgTTLRemaining,
    expiredCount: counter.expired,
    expirationRate,
  };
}

/**
 * Analyze access patterns for a memory type
 */
export function analyzeAccessPattern(
  state: CacheAnalyzerState,
  memoryType: MemoryType
): AccessPattern | null {
  const typeRecords = state.records.filter((r) => r.memoryType === memoryType);

  if (typeRecords.length < state.config.minAccessesForPattern) {
    return null;
  }

  // Filter to pattern window
  const windowStart = new Date(Date.now() - state.config.patternWindowHours * 3600000);
  const recentRecords = typeRecords.filter((r) => r.timestamp >= windowStart);

  if (recentRecords.length < state.config.minAccessesForPattern) {
    return null;
  }

  // Count accesses per hour
  const hourCounts = new Array(24).fill(0);
  recentRecords.forEach((record) => {
    const hour = record.timestamp.getHours();
    hourCounts[hour]++;
  });

  // Find peak and low hours
  const avgPerHour = recentRecords.length / state.config.patternWindowHours;
  const peakThreshold = avgPerHour * 1.5;
  const lowThreshold = avgPerHour * 0.5;

  const peakHours: number[] = [];
  const lowHours: number[] = [];

  for (let hour = 0; hour < 24; hour++) {
    if (hourCounts[hour] > peakThreshold) {
      peakHours.push(hour);
    } else if (hourCounts[hour] < lowThreshold) {
      lowHours.push(hour);
    }
  }

  // Calculate trend (simple linear regression slope)
  const trend = calculateTrend(recentRecords);

  // Calculate recommended TTL multiplier based on hit rate and pattern
  const stats = calculateCacheStats(state, memoryType);
  const hitRateFactor = 1 + (0.5 - stats.hitRate) * state.config.ttlSensitivity;
  const trendFactor = 1 + trend * 0.1;
  const recommendedTTLMultiplier = hitRateFactor * trendFactor;

  return {
    memoryType,
    peakHours,
    lowHours,
    avgAccessesPerHour: avgPerHour,
    trend,
    recommendedTTLMultiplier,
  };
}

/**
 * Calculate access trend using simple linear regression
 */
function calculateTrend(records: CacheAccessRecord[]): number {
  if (records.length < 2) return 0;

  // Sort by timestamp
  const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Split into first half and second half
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  // Calculate time span for each half
  const firstHalfStartTime = firstHalf[0]?.timestamp.getTime() || 0;
  const firstHalfEndTime = firstHalf[firstHalf.length - 1]?.timestamp.getTime() || 0;
  const secondHalfStartTime = secondHalf[0]?.timestamp.getTime() || 0;
  const secondHalfEndTime = secondHalf[secondHalf.length - 1]?.timestamp.getTime() || 0;

  // Calculate time duration in hours for each half
  const firstHalfDurationHours = (firstHalfEndTime - firstHalfStartTime) / (1000 * 60 * 60) || 1;
  const secondHalfDurationHours = (secondHalfEndTime - secondHalfStartTime) / (1000 * 60 * 60) || 1;

  // Calculate access rate (accesses per hour) for each half
  const firstHalfRate = firstHalf.length / firstHalfDurationHours;
  const secondHalfRate = secondHalf.length / secondHalfDurationHours;

  // Return normalized trend (-1 to 1)
  if (firstHalfRate === 0) return 0;
  return Math.max(-1, Math.min(1, (secondHalfRate - firstHalfRate) / firstHalfRate));
}

/**
 * Generate cache warming suggestions
 */
export function generateCacheWarmingSuggestions(
  state: CacheAnalyzerState
): CacheWarmingSuggestion[] {
  const suggestions: CacheWarmingSuggestion[] = [];

  // Analyze each memory type
  (['working', 'episodic', 'semantic', 'procedural'] as MemoryType[]).forEach((type) => {
    const stats = calculateCacheStats(state, type);
    const pattern = analyzeAccessPattern(state, type);

    if (!pattern) return;

    // Suggestion for low hit rate with high access
    if (stats.hitRate < 0.5 && stats.totalAccesses >= 100) {
      // Find frequently missed memories
      const typeRecords = state.records.filter(
        (r) => r.memoryType === type && !r.isHit
      );
      const missCounts = new Map<string, number>();
      typeRecords.forEach((r) => {
        missCounts.set(r.memoryId, (missCounts.get(r.memoryId) || 0) + 1);
      });

      // Get top missed memories
      const topMissed = Array.from(missCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      if (topMissed.length > 0) {
        suggestions.push({
          memoryIds: topMissed,
          reason: `Low hit rate (${(stats.hitRate * 100).toFixed(1)}%) for ${type} memory with high access frequency`,
          expectedImprovement: 0.2, // 20% improvement expected
          priority: Math.round((1 - stats.hitRate) * 10),
        });
      }
    }

    // Suggestion for peak hour pre-loading
    if (pattern.peakHours.length > 0) {
      const currentHour = new Date().getHours();
      const nextPeak = pattern.peakHours.find((h) => h > currentHour);

      if (nextPeak !== undefined) {
        // Find frequently accessed memories during peak
        const peakRecords = state.records.filter(
          (r) => r.memoryType === type && r.timestamp.getHours() === nextPeak
        );
        const accessCounts = new Map<string, number>();
        peakRecords.forEach((r) => {
          accessCounts.set(r.memoryId, (accessCounts.get(r.memoryId) || 0) + 1);
        });

        const topAccessed = Array.from(accessCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([id]) => id);

        if (topAccessed.length > 0) {
          suggestions.push({
            memoryIds: topAccessed,
            reason: `Pre-load frequently accessed ${type} memories before peak hour ${nextPeak}:00`,
            expectedImprovement: 0.15,
            priority: 5,
          });
        }
      }
    }
  });

  // Sort by priority
  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * Perform full cache analysis
 */
export function analyzeCache(state: CacheAnalyzerState): CacheAnalysisResult {
  const byType = {
    working: calculateCacheStats(state, 'working'),
    episodic: calculateCacheStats(state, 'episodic'),
    semantic: calculateCacheStats(state, 'semantic'),
    procedural: calculateCacheStats(state, 'procedural'),
    archival: calculateCacheStats(state, 'archival'),
  };

  const patterns = {
    working: analyzeAccessPattern(state, 'working'),
    episodic: analyzeAccessPattern(state, 'episodic'),
    semantic: analyzeAccessPattern(state, 'semantic'),
    procedural: analyzeAccessPattern(state, 'procedural'),
    archival: analyzeAccessPattern(state, 'archival'),
  };

  const totalAccesses = Object.values(byType).reduce(
    (sum, stats) => sum + stats.totalAccesses,
    0
  );
  const totalHits = Object.values(byType).reduce((sum, stats) => sum + stats.hits, 0);
  const totalExpired = Object.values(byType).reduce((sum, stats) => sum + stats.expiredCount, 0);

  return {
    overall: {
      totalAccesses,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      expirationRate: totalAccesses > 0 ? totalExpired / totalAccesses : 0,
    },
    byType,
    patterns: patterns as Record<MemoryType, AccessPattern>,
    suggestions: generateCacheWarmingSuggestions(state),
    timestamp: new Date(),
  };
}

/**
 * Get recommended TTL adjustment for a memory type
 */
export function getRecommendedTTLAdjustment(
  state: CacheAnalyzerState,
  memoryType: MemoryType
): number {
  const pattern = analyzeAccessPattern(state, memoryType);
  return pattern ? pattern.recommendedTTLMultiplier : 1.0;
}

/**
 * Reset analyzer state
 */
export function resetCacheAnalyzer(state: CacheAnalyzerState): void {
  state.records = [];
  state.counters = {
    working: { hits: 0, misses: 0, expired: 0 },
    episodic: { hits: 0, misses: 0, expired: 0 },
    semantic: { hits: 0, misses: 0, expired: 0 },
    procedural: { hits: 0, misses: 0, expired: 0 },
    archival: { hits: 0, misses: 0, expired: 0 },
  };
}

/**
 * Export analyzer state for persistence
 */
export function exportCacheAnalyzerState(
  state: CacheAnalyzerState
): Record<string, unknown> {
  return {
    records: state.records.map((r) => ({
      memoryId: r.memoryId,
      memoryType: r.memoryType,
      timestamp: r.timestamp.toISOString(),
      isHit: r.isHit,
      ttlRemaining: r.ttlRemaining,
      originalTTL: r.originalTTL,
    })),
    counters: state.counters,
    config: state.config,
  };
}

/**
 * Import analyzer state from persistence
 */
export function importCacheAnalyzerState(
  data: Record<string, unknown>
): CacheAnalyzerState {
  const records = (data.records as Array<Record<string, unknown>>).map((r) => ({
    memoryId: r.memoryId as string,
    memoryType: r.memoryType as MemoryType,
    timestamp: new Date(r.timestamp as string),
    isHit: r.isHit as boolean,
    ttlRemaining: r.ttlRemaining as number | undefined,
    originalTTL: r.originalTTL as number | undefined,
  }));

  return {
    records,
    counters: data.counters as CacheAnalyzerState['counters'],
    config: data.config as CacheAnalyzerConfig,
  };
}
