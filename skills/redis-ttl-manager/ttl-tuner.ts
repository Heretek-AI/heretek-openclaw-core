/**
 * ==============================================================================
 * TTL Tuner Module - Dynamic TTL Adjustment Based on Access Patterns
 * ==============================================================================
 * 
 * This module integrates with the CacheAnalyzer to dynamically adjust Redis TTLs
 * based on observed access patterns. It provides:
 * 
 * - Pattern-based TTL adjustment (peak hours, low hours)
 * - Hit rate optimization (extend TTL for frequently missed memories)
 * - Trend-based TTL tuning (increase TTL for increasing access trends)
 * - Time-of-day aware TTL calculation
 * 
 * @module ttl-tuner
 * @see {@link ./cache-analyzer.ts} for cache access pattern analysis
 * @see {@link ./redis-ttl-manager.ts} for base TTL calculation
 */

import type { AccessPattern, CacheStats } from './cache-analyzer';
import type { MemoryType } from './redis-ttl-manager';
import { 
  getRedisClient, 
  isRedisClientInitialized,
  createRedisClient,
  createRedisConfigFromEnv 
} from '../../lib/redis-client';
export type { AccessPattern, CacheStats, MemoryType };

/**
 * TTL tuning configuration
 */
export interface TTLTunerConfig {
  /** Enable TTL tuning based on access patterns */
  enabled: boolean;
  /** Peak hour TTL bonus multiplier */
  peakHourBonus: number;
  /** Low hour TTL reduction multiplier */
  lowHourReduction: number;
  /** Hit rate sensitivity (0-1) */
  hitRateSensitivity: number;
  /** Trend sensitivity (0-1) */
  trendSensitivity: number;
  /** Minimum hit rate threshold for TTL extension */
  minHitRateForExtension: number;
  /** Maximum TTL extension multiplier */
  maxExtensionMultiplier: number;
}

/**
 * Default TTL tuner configuration
 */
export const DEFAULT_TTL_TUNER_CONFIG: TTLTunerConfig = {
  enabled: true,
  peakHourBonus: 1.5,      // 50% longer TTL during peak hours
  lowHourReduction: 0.7,   // 30% shorter TTL during low hours
  hitRateSensitivity: 0.5, // Medium sensitivity to hit rate
  trendSensitivity: 0.3,   // Low-medium sensitivity to trends
  minHitRateForExtension: 0.7, // Only extend TTL if hit rate > 70%
  maxExtensionMultiplier: 3.0, // Max 3x TTL extension
};

/**
 * Result of TTL tuning calculation
 */
export interface TTLTuningResult {
  /** Original TTL before tuning */
  originalTTL: number;
  /** Tuned TTL after adjustments */
  tunedTTL: number;
  /** Applied multipliers */
  multipliers: {
    /** Peak/low hour multiplier */
    hourMultiplier: number;
    /** Hit rate multiplier */
    hitRateMultiplier: number;
    /** Trend multiplier */
    trendMultiplier: number;
    /** Combined multiplier */
    totalMultiplier: number;
  };
  /** Reasons for adjustments */
  reasons: string[];
}

/**
 * Time-of-day information for TTL tuning
 */
export interface TimeOfDayInfo {
  /** Current hour (0-23) */
  currentHour: number;
  /** Is current hour a peak hour */
  isPeakHour: boolean;
  /** Is current hour a low hour */
  isLowHour: boolean;
  /** Hours until next peak */
  hoursUntilNextPeak: number;
}

/**
 * Analyze time-of-day relative to access pattern
 */
export function analyzeTimeOfDay(
  pattern: AccessPattern | null,
  timestamp: Date = new Date()
): TimeOfDayInfo {
  const currentHour = timestamp.getHours();
  
  if (!pattern) {
    return {
      currentHour,
      isPeakHour: false,
      isLowHour: false,
      hoursUntilNextPeak: 0,
    };
  }
  
  const isPeakHour = pattern.peakHours.includes(currentHour);
  const isLowHour = pattern.lowHours.includes(currentHour);
  
  // Calculate hours until next peak
  let hoursUntilNextPeak = 0;
  if (pattern.peakHours.length > 0) {
    const nextPeak = pattern.peakHours.find((h) => h > currentHour);
    if (nextPeak !== undefined) {
      hoursUntilNextPeak = nextPeak - currentHour;
    } else {
      // Wrap to next day's first peak
      const firstPeak = pattern.peakHours[0];
      hoursUntilNextPeak = 24 - currentHour + firstPeak;
    }
  }
  
  return {
    currentHour,
    isPeakHour,
    isLowHour,
    hoursUntilNextPeak,
  };
}

/**
 * Calculate hour-based TTL multiplier
 */
export function calculateHourMultiplier(
  pattern: AccessPattern | null,
  config: TTLTunerConfig = DEFAULT_TTL_TUNER_CONFIG,
  timestamp: Date = new Date()
): number {
  if (!config.enabled || !pattern) {
    return 1.0;
  }
  
  const timeInfo = analyzeTimeOfDay(pattern, timestamp);
  
  if (timeInfo.isPeakHour) {
    return config.peakHourBonus;
  }
  
  if (timeInfo.isLowHour) {
    return config.lowHourReduction;
  }
  
  return 1.0;
}

/**
 * Calculate hit rate-based TTL multiplier
 * 
 * Low hit rate = extend TTL (memories expiring before access)
 * High hit rate = keep TTL (cache working well)
 */
export function calculateHitRateMultiplier(
  stats: CacheStats,
  config: TTLTunerConfig = DEFAULT_TTL_TUNER_CONFIG
): number {
  if (!config.enabled) {
    return 1.0;
  }
  
  const hitRate = stats.hitRate;
  
  // If hit rate is above threshold, cache is working well
  if (hitRate >= config.minHitRateForExtension) {
    return 1.0;
  }
  
  // Calculate multiplier based on how far below threshold
  // Lower hit rate = higher multiplier (extend TTL more)
  const deficit = config.minHitRateForExtension - hitRate;
  const maxDeficit = config.minHitRateForExtension;
  const normalizedDeficit = deficit / maxDeficit;
  
  // Multiplier ranges from 1.0 to maxExtensionMultiplier
  const multiplier = 1.0 + normalizedDeficit * (config.maxExtensionMultiplier - 1.0);
  
  return Math.min(multiplier, config.maxExtensionMultiplier);
}

/**
 * Calculate trend-based TTL multiplier
 * 
 * Positive trend (increasing access) = extend TTL
 * Negative trend (decreasing access) = reduce TTL
 */
export function calculateTrendMultiplier(
  pattern: AccessPattern | null,
  config: TTLTunerConfig = DEFAULT_TTL_TUNER_CONFIG
): number {
  if (!config.enabled || !pattern) {
    return 1.0;
  }
  
  const trend = pattern.trend; // -1 to 1
  
  // Trend multiplier: 0.7 to 1.3 based on trend
  // Negative trend = reduce TTL, Positive trend = extend TTL
  const baseMultiplier = 1.0 + trend * config.trendSensitivity;
  
  // Clamp to reasonable range
  return Math.max(0.7, Math.min(1.3, baseMultiplier));
}

/**
 * Apply TTL tuning based on access patterns
 */
export function applyTTLTuning(
  originalTTL: number,
  pattern: AccessPattern | null,
  stats: CacheStats,
  config: TTLTunerConfig = DEFAULT_TTL_TUNER_CONFIG,
  timestamp: Date = new Date()
): TTLTuningResult {
  const reasons: string[] = [];
  
  // Calculate individual multipliers
  const hourMultiplier = calculateHourMultiplier(pattern, config, timestamp);
  const hitRateMultiplier = calculateHitRateMultiplier(stats, config);
  const trendMultiplier = calculateTrendMultiplier(pattern, config);
  
  // Build reasons array
  if (hourMultiplier !== 1.0) {
    const timeInfo = analyzeTimeOfDay(pattern, timestamp);
    if (timeInfo.isPeakHour) {
      reasons.push(`Peak hour access (+${((hourMultiplier - 1) * 100).toFixed(0)}%)`);
    } else if (timeInfo.isLowHour) {
      reasons.push(`Low hour access (-${((1 - hourMultiplier) * 100).toFixed(0)}%)`);
    }
  }
  
  if (hitRateMultiplier > 1.0) {
    reasons.push(`Low hit rate (${(stats.hitRate * 100).toFixed(1)}%) - extending TTL`);
  }
  
  if (trendMultiplier !== 1.0) {
    const trendPercent = (pattern?.trend ?? 0) * 100;
    if (trendPercent > 0) {
      reasons.push(`Increasing access trend (+${trendPercent.toFixed(0)}%)`);
    } else if (trendPercent < 0) {
      reasons.push(`Decreasing access trend (${trendPercent.toFixed(0)}%)`);
    }
  }
  
  // Calculate total multiplier
  const totalMultiplier = hourMultiplier * hitRateMultiplier * trendMultiplier;
  
  // Apply to original TTL
  const tunedTTL = Math.floor(originalTTL * totalMultiplier);
  
  return {
    originalTTL,
    tunedTTL,
    multipliers: {
      hourMultiplier,
      hitRateMultiplier,
      trendMultiplier,
      totalMultiplier,
    },
    reasons,
  };
}

/**
 * Get optimal TTL for a memory based on access patterns
 * 
 * This is the main entry point for TTL tuning. It combines:
 * - Base TTL from redis-ttl-manager
 * - Pattern-based adjustments from this module
 * 
 * @param baseTTL - Base TTL from calculateTTL()
 * @param pattern - Access pattern from analyzeAccessPattern()
 * @param stats - Cache stats from calculateCacheStats()
 * @param config - TTL tuner configuration
 * @returns Tuned TTL in seconds
 */
export function getOptimalTTL(
  baseTTL: number,
  pattern: AccessPattern | null,
  stats: CacheStats,
  config: TTLTunerConfig = DEFAULT_TTL_TUNER_CONFIG
): number {
  if (!config.enabled) {
    return baseTTL;
  }
  
  const result = applyTTLTuning(baseTTL, pattern, stats, config);
  return result.tunedTTL;
}

/**
 * Generate TTL tuning report
 */
export interface TTLTuningReport {
  /** Memory type */
  memoryType: MemoryType;
  /** Current base TTL */
  baseTTL: number;
  /** Recommended tuned TTL */
  recommendedTTL: number;
  /** Access pattern summary */
  patternSummary: {
    /** Peak hours */
    peakHours: number[];
    /** Low hours */
    lowHours: number[];
    /** Access trend */
    trend: number;
  };
  /** Cache health summary */
  cacheHealth: {
    /** Hit rate */
    hitRate: number;
    /** Total accesses */
    totalAccesses: number;
    /** Expiration rate */
    expirationRate: number;
  };
  /** Tuning recommendations */
  recommendations: string[];
  /** Expected improvement */
  expectedImprovement: {
    /** Hit rate improvement */
    hitRateDelta: number;
    /** Cache efficiency improvement */
    efficiencyDelta: number;
  };
}

/**
 * Generate comprehensive TTL tuning report for a memory type
 */
export function generateTTLTuningReport(
  memoryType: MemoryType,
  baseTTL: number,
  pattern: AccessPattern | null,
  stats: CacheStats,
  config: TTLTunerConfig = DEFAULT_TTL_TUNER_CONFIG
): TTLTuningReport {
  const tuningResult = applyTTLTuning(baseTTL, pattern, stats, config);
  
  const recommendations: string[] = [];
  
  // Generate recommendations based on analysis
  if (stats.hitRate < 0.5) {
    recommendations.push(
      `Critical: Hit rate is ${(stats.hitRate * 100).toFixed(1)}%. Consider extending TTL by ${tuningResult.multipliers.hitRateMultiplier.toFixed(2)}x`
    );
  } else if (stats.hitRate < 0.7) {
    recommendations.push(
      `Warning: Hit rate is ${(stats.hitRate * 100).toFixed(1)}%. TTL extension recommended`
    );
  }
  
  if (pattern) {
    if (pattern.peakHours.length > 3) {
      recommendations.push(
        `Multiple peak hours detected (${pattern.peakHours.length}). Consider cache warming before peaks`
      );
    }
    
    if (pattern.trend > 0.3) {
      recommendations.push(
        `Access trend is increasing (+${(pattern.trend * 100).toFixed(0)}%). Monitor for capacity needs`
      );
    } else if (pattern.trend < -0.3) {
      recommendations.push(
        `Access trend is decreasing (${(pattern.trend * 100).toFixed(0)}%). Consider reducing TTL to save memory`
      );
    }
  }
  
  if (stats.expirationRate > 0.3) {
    recommendations.push(
      `High expiration rate (${(stats.expirationRate * 100).toFixed(1)}%). Memories expiring before access`
    );
  }
  
  // Estimate improvements
  const currentEfficiency = stats.hitRate;
  const expectedHitRateImprovement = Math.min(1.0, stats.hitRate + (1 - stats.hitRate) * 0.3);
  const expectedEfficiencyDelta = expectedHitRateImprovement - currentEfficiency;
  
  return {
    memoryType,
    baseTTL,
    recommendedTTL: tuningResult.tunedTTL,
    patternSummary: {
      peakHours: pattern?.peakHours ?? [],
      lowHours: pattern?.lowHours ?? [],
      trend: pattern?.trend ?? 0,
    },
    cacheHealth: {
      hitRate: stats.hitRate,
      totalAccesses: stats.totalAccesses,
      expirationRate: stats.expirationRate,
    },
    recommendations,
    expectedImprovement: {
      hitRateDelta: expectedHitRateImprovement - stats.hitRate,
      efficiencyDelta: expectedEfficiencyDelta,
    },
  };
}

/**
 * Batch TTL tuning for multiple memories
 */
export interface BatchTTLTuningParams {
  /** Base TTLs for each memory */
  baseTTLs: Map<string, number>;
  /** Access patterns by memory type */
  patterns: Map<MemoryType, AccessPattern | null>;
  /** Cache stats by memory type */
  stats: Map<MemoryType, CacheStats>;
  /** Memory type for each memory */
  memoryTypes: Map<string, MemoryType>;
  /** TTL tuner configuration */
  config?: TTLTunerConfig;
}

export interface BatchTTLTuningResult {
  /** Tuned TTLs for each memory */
  tunedTTLs: Map<string, number>;
  /** Tuning details for each memory */
  details: Map<string, TTLTuningResult>;
  /** Summary statistics */
  summary: {
    /** Average multiplier applied */
    avgMultiplier: number;
    /** Max TTL */
    maxTTL: number;
    /** Min TTL */
    minTTL: number;
    /** Memories with TTL adjustments */
    adjustedCount: number;
  };
}

/**
 * Apply TTL tuning to multiple memories
 */
export function batchApplyTTLTuning(
  params: BatchTTLTuningParams
): BatchTTLTuningResult {
  const tunedTTLs = new Map<string, number>();
  const details = new Map<string, TTLTuningResult>();
  const config = params.config ?? DEFAULT_TTL_TUNER_CONFIG;
  
  let totalMultiplier = 0;
  let maxTTL = 0;
  let minTTL = Infinity;
  let adjustedCount = 0;
  
  params.baseTTLs.forEach((baseTTL, memoryId) => {
    const memoryType = params.memoryTypes.get(memoryId) ?? 'episodic';
    const pattern = params.patterns.get(memoryType) ?? null;
    const stats =
      params.stats.get(memoryType) ??
      ({
        memoryType,
        totalAccesses: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        expiredCount: 0,
        expirationRate: 0,
      } as CacheStats);
    
    const result = applyTTLTuning(baseTTL, pattern, stats, config);
    tunedTTLs.set(memoryId, result.tunedTTL);
    details.set(memoryId, result);
    
    totalMultiplier += result.multipliers.totalMultiplier;
    maxTTL = Math.max(maxTTL, result.tunedTTL);
    minTTL = Math.min(minTTL, result.tunedTTL);
    
    if (result.multipliers.totalMultiplier !== 1.0) {
      adjustedCount++;
    }
  });
  
  const count = params.baseTTLs.size;
  
  return {
    tunedTTLs,
    details,
    summary: {
      avgMultiplier: count > 0 ? totalMultiplier / count : 1.0,
      maxTTL,
      minTTL: minTTL === Infinity ? 0 : minTTL,
      adjustedCount,
    },
  };
}
