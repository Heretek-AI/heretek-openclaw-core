/**
 * Unit tests for TTL Tuner module
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TTL_TUNER_CONFIG,
  analyzeTimeOfDay,
  calculateHourMultiplier,
  calculateHitRateMultiplier,
  calculateTrendMultiplier,
  applyTTLTuning,
  getOptimalTTL,
  generateTTLTuningReport,
  batchApplyTTLTuning,
  type AccessPattern,
  type CacheStats,
  type TTLTunerConfig,
  type MemoryType,
} from '../../skills/redis-ttl-manager/ttl-tuner';

describe('TTL Tuner', () => {
  describe('analyzeTimeOfDay', () => {
    it('should analyze time without pattern', () => {
      // Create date with specific local time (14:30)
      const testDate = new Date();
      testDate.setHours(14, 30, 0, 0);
      const timeInfo = analyzeTimeOfDay(null, testDate);
      expect(timeInfo.currentHour).toBe(14);
      expect(timeInfo.isPeakHour).toBe(false);
      expect(timeInfo.isLowHour).toBe(false);
      expect(timeInfo.hoursUntilNextPeak).toBe(0);
    });

    it('should detect peak hour', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [14, 15, 16],
        lowHours: [3, 4, 5],
        avgAccessesPerHour: 10,
        trend: 0.2,
        recommendedTTLMultiplier: 1.1,
      };
      const testDate = new Date();
      testDate.setHours(14, 30, 0, 0);
      const timeInfo = analyzeTimeOfDay(pattern, testDate);
      expect(timeInfo.isPeakHour).toBe(true);
      expect(timeInfo.isLowHour).toBe(false);
      expect(timeInfo.hoursUntilNextPeak).toBe(1); // Next peak at 15
    });

    it('should detect low hour', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [14, 15, 16],
        lowHours: [3, 4, 5],
        avgAccessesPerHour: 10,
        trend: 0.2,
        recommendedTTLMultiplier: 1.1,
      };
      const testDate = new Date();
      testDate.setHours(4, 30, 0, 0);
      const timeInfo = analyzeTimeOfDay(pattern, testDate);
      expect(timeInfo.isPeakHour).toBe(false);
      expect(timeInfo.isLowHour).toBe(true);
    });

    it('should calculate hours until next peak (same day)', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [9, 14, 18],
        lowHours: [2, 3, 4],
        avgAccessesPerHour: 10,
        trend: 0,
        recommendedTTLMultiplier: 1.0,
      };
      const testDate = new Date();
      testDate.setHours(10, 0, 0, 0);
      const timeInfo = analyzeTimeOfDay(pattern, testDate);
      expect(timeInfo.hoursUntilNextPeak).toBe(4); // Next peak at 14
    });

    it('should calculate hours until next peak (next day wrap)', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [9, 14],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 0,
        recommendedTTLMultiplier: 1.0,
      };
      const testDate = new Date();
      testDate.setHours(16, 0, 0, 0);
      const timeInfo = analyzeTimeOfDay(pattern, testDate);
      expect(timeInfo.hoursUntilNextPeak).toBe(17); // Wrap to 9 next day
    });
  });

  describe('calculateHourMultiplier', () => {
    it('should return 1.0 without pattern', () => {
      const multiplier = calculateHourMultiplier(null);
      expect(multiplier).toBe(1.0);
    });

    it('should return 1.0 when disabled', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [14],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 0,
        recommendedTTLMultiplier: 1.0,
      };
      const config: TTLTunerConfig = { ...DEFAULT_TTL_TUNER_CONFIG, enabled: false };
      const multiplier = calculateHourMultiplier(pattern, config);
      expect(multiplier).toBe(1.0);
    });

    it('should apply peak hour bonus', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [14],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 0,
        recommendedTTLMultiplier: 1.0,
      };
      const testDate = new Date();
      testDate.setHours(14, 0, 0, 0);
      const multiplier = calculateHourMultiplier(pattern, DEFAULT_TTL_TUNER_CONFIG, testDate);
      expect(multiplier).toBe(1.5); // peakHourBonus
    });

    it('should apply low hour reduction', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [],
        lowHours: [3],
        avgAccessesPerHour: 10,
        trend: 0,
        recommendedTTLMultiplier: 1.0,
      };
      const testDate = new Date();
      testDate.setHours(3, 0, 0, 0);
      const multiplier = calculateHourMultiplier(pattern, DEFAULT_TTL_TUNER_CONFIG, testDate);
      expect(multiplier).toBe(0.7); // lowHourReduction
    });
  });

  describe('calculateHitRateMultiplier', () => {
    it('should return 1.0 when disabled', () => {
      const stats: CacheStats = {
        memoryType: 'working',
        totalAccesses: 100,
        hits: 50,
        misses: 50,
        hitRate: 0.5,
        expiredCount: 0,
        expirationRate: 0,
      };
      const config: TTLTunerConfig = { ...DEFAULT_TTL_TUNER_CONFIG, enabled: false };
      const multiplier = calculateHitRateMultiplier(stats, config);
      expect(multiplier).toBe(1.0);
    });

    it('should return 1.0 for high hit rate', () => {
      const stats: CacheStats = {
        memoryType: 'working',
        totalAccesses: 100,
        hits: 80,
        misses: 20,
        hitRate: 0.8,
        expiredCount: 0,
        expirationRate: 0,
      };
      const multiplier = calculateHitRateMultiplier(stats, DEFAULT_TTL_TUNER_CONFIG);
      expect(multiplier).toBe(1.0); // Above minHitRateForExtension (0.7)
    });

    it('should extend TTL for low hit rate', () => {
      const stats: CacheStats = {
        memoryType: 'working',
        totalAccesses: 100,
        hits: 30,
        misses: 70,
        hitRate: 0.3,
        expiredCount: 0,
        expirationRate: 0,
      };
      const multiplier = calculateHitRateMultiplier(stats, DEFAULT_TTL_TUNER_CONFIG);
      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBeLessThanOrEqual(3.0); // maxExtensionMultiplier
    });

    it('should return max multiplier for 0% hit rate', () => {
      const stats: CacheStats = {
        memoryType: 'working',
        totalAccesses: 100,
        hits: 0,
        misses: 100,
        hitRate: 0,
        expiredCount: 0,
        expirationRate: 0,
      };
      const multiplier = calculateHitRateMultiplier(stats, DEFAULT_TTL_TUNER_CONFIG);
      expect(multiplier).toBe(3.0); // maxExtensionMultiplier
    });
  });

  describe('calculateTrendMultiplier', () => {
    it('should return 1.0 without pattern', () => {
      const multiplier = calculateTrendMultiplier(null);
      expect(multiplier).toBe(1.0);
    });

    it('should return 1.0 when disabled', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 0.5,
        recommendedTTLMultiplier: 1.0,
      };
      const config: TTLTunerConfig = { ...DEFAULT_TTL_TUNER_CONFIG, enabled: false };
      const multiplier = calculateTrendMultiplier(pattern, config);
      expect(multiplier).toBe(1.0);
    });

    it('should extend TTL for positive trend', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 0.5,
        recommendedTTLMultiplier: 1.0,
      };
      const multiplier = calculateTrendMultiplier(pattern, DEFAULT_TTL_TUNER_CONFIG);
      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBeLessThanOrEqual(1.3);
    });

    it('should reduce TTL for negative trend', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: -0.5,
        recommendedTTLMultiplier: 1.0,
      };
      const multiplier = calculateTrendMultiplier(pattern, DEFAULT_TTL_TUNER_CONFIG);
      expect(multiplier).toBeLessThan(1.0);
      expect(multiplier).toBeGreaterThanOrEqual(0.7);
    });

    it('should clamp extreme trends', () => {
      const pattern1: AccessPattern = {
        memoryType: 'working',
        peakHours: [],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 1.0,
        recommendedTTLMultiplier: 1.0,
      };
      const pattern2: AccessPattern = {
        memoryType: 'working',
        peakHours: [],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: -1.0,
        recommendedTTLMultiplier: 1.0,
      };
      const multiplier1 = calculateTrendMultiplier(pattern1, DEFAULT_TTL_TUNER_CONFIG);
      const multiplier2 = calculateTrendMultiplier(pattern2, DEFAULT_TTL_TUNER_CONFIG);
      expect(multiplier1).toBeLessThanOrEqual(1.3);
      expect(multiplier2).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('applyTTLTuning', () => {
    it('should apply all multipliers', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [14],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 0.3,
        recommendedTTLMultiplier: 1.0,
      };
      const stats: CacheStats = {
        memoryType: 'working',
        totalAccesses: 100,
        hits: 50,
        misses: 50,
        hitRate: 0.5,
        expiredCount: 0,
        expirationRate: 0,
      };
      const testDate = new Date();
      testDate.setHours(14, 0, 0, 0);
      const result = applyTTLTuning(
        3600, // 1 hour base TTL
        pattern,
        stats,
        DEFAULT_TTL_TUNER_CONFIG,
        testDate
      );

      expect(result.originalTTL).toBe(3600);
      expect(result.tunedTTL).toBeGreaterThan(3600); // Peak hour + low hit rate + positive trend
      expect(result.multipliers.hourMultiplier).toBe(1.5);
      expect(result.multipliers.hitRateMultiplier).toBeGreaterThan(1.0);
      expect(result.multipliers.trendMultiplier).toBeGreaterThan(1.0);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should return original TTL when disabled', () => {
      const config: TTLTunerConfig = { ...DEFAULT_TTL_TUNER_CONFIG, enabled: false };
      const result = applyTTLTuning(3600, null, {
        memoryType: 'working',
        totalAccesses: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        expiredCount: 0,
        expirationRate: 0,
      }, config);

      expect(result.tunedTTL).toBe(3600);
      expect(result.multipliers.totalMultiplier).toBe(1.0);
    });
  });

  describe('getOptimalTTL', () => {
    it('should return base TTL when disabled', () => {
      const config: TTLTunerConfig = { ...DEFAULT_TTL_TUNER_CONFIG, enabled: false };
      const optimalTTL = getOptimalTTL(
        7200,
        null,
        {
          memoryType: 'working',
          totalAccesses: 0,
          hits: 0,
          misses: 0,
          hitRate: 0,
          expiredCount: 0,
          expirationRate: 0,
        },
        config
      );
      expect(optimalTTL).toBe(7200);
    });

    it('should apply tuning when enabled', () => {
      const pattern: AccessPattern = {
        memoryType: 'working',
        peakHours: [],
        lowHours: [],
        avgAccessesPerHour: 10,
        trend: 0,
        recommendedTTLMultiplier: 1.0,
      };
      const stats: CacheStats = {
        memoryType: 'working',
        totalAccesses: 100,
        hits: 80,
        misses: 20,
        hitRate: 0.8,
        expiredCount: 0,
        expirationRate: 0,
      };
      const optimalTTL = getOptimalTTL(3600, pattern, stats, DEFAULT_TTL_TUNER_CONFIG);
      expect(optimalTTL).toBe(3600); // No adjustments needed for good hit rate
    });
  });

  describe('generateTTLTuningReport', () => {
    it('should generate comprehensive report', () => {
      const pattern: AccessPattern = {
        memoryType: 'semantic',
        peakHours: [9, 10, 11, 14, 15, 16],
        lowHours: [2, 3, 4, 5],
        avgAccessesPerHour: 20,
        trend: 0.4,
        recommendedTTLMultiplier: 1.2,
      };
      const stats: CacheStats = {
        memoryType: 'semantic',
        totalAccesses: 500,
        hits: 250,
        misses: 250,
        hitRate: 0.5,
        expiredCount: 50,
        expirationRate: 0.1,
      };

      const report = generateTTLTuningReport('semantic', 86400, pattern, stats);

      expect(report.memoryType).toBe('semantic');
      expect(report.baseTTL).toBe(86400);
      expect(report.recommendedTTL).toBeGreaterThan(86400);
      expect(report.patternSummary.peakHours.length).toBe(6);
      expect(report.patternSummary.trend).toBe(0.4);
      expect(report.cacheHealth.hitRate).toBe(0.5);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.expectedImprovement.hitRateDelta).toBeGreaterThan(0);
    });

    it('should generate recommendations for low hit rate', () => {
      const stats: CacheStats = {
        memoryType: 'working',
        totalAccesses: 100,
        hits: 20,
        misses: 80,
        hitRate: 0.2,
        expiredCount: 0,
        expirationRate: 0,
      };
      const report = generateTTLTuningReport('working', 3600, null, stats);
      expect(report.recommendations.some(r => r.includes('Critical') || r.includes('hit rate'))).toBe(true);
    });

    it('should generate recommendations for high expiration rate', () => {
      const stats: CacheStats = {
        memoryType: 'episodic',
        totalAccesses: 100,
        hits: 80,
        misses: 20,
        hitRate: 0.8,
        expiredCount: 40,
        expirationRate: 0.4,
      };
      const report = generateTTLTuningReport('episodic', 7200, null, stats);
      expect(report.recommendations.some(r => r.includes('expiration'))).toBe(true);
    });
  });

  describe('batchApplyTTLTuning', () => {
    it('should tune TTLs for multiple memories', () => {
      const baseTTLs = new Map<string, number>([
        ['mem-1', 3600],
        ['mem-2', 7200],
        ['mem-3', 1800],
      ]);
      const patterns = new Map<MemoryType, AccessPattern | null>([
        ['working', {
          memoryType: 'working',
          peakHours: [14],
          lowHours: [],
          avgAccessesPerHour: 10,
          trend: 0.2,
          recommendedTTLMultiplier: 1.1,
        }],
      ]);
      const stats = new Map<MemoryType, CacheStats>([
        ['working', {
          memoryType: 'working',
          totalAccesses: 100,
          hits: 40,
          misses: 60,
          hitRate: 0.4,
          expiredCount: 0,
          expirationRate: 0,
        }],
      ]);
      const memoryTypes = new Map<string, MemoryType>([
        ['mem-1', 'working'],
        ['mem-2', 'working'],
        ['mem-3', 'working'],
      ]);

      const result = batchApplyTTLTuning({
        baseTTLs,
        patterns,
        stats,
        memoryTypes,
      });

      expect(result.tunedTTLs.size).toBe(3);
      expect(result.details.size).toBe(3);
      expect(result.summary.adjustedCount).toBeGreaterThan(0);
      expect(result.summary.avgMultiplier).toBeGreaterThan(1.0); // Low hit rate extends TTL
      expect(result.summary.maxTTL).toBeGreaterThan(7200);
    });

    it('should handle empty batch', () => {
      const result = batchApplyTTLTuning({
        baseTTLs: new Map(),
        patterns: new Map(),
        stats: new Map(),
        memoryTypes: new Map(),
      });

      expect(result.tunedTTLs.size).toBe(0);
      expect(result.details.size).toBe(0);
      expect(result.summary.avgMultiplier).toBe(1.0);
    });

    it('should use default config when not provided', () => {
      const baseTTLs = new Map<string, number>([['mem-1', 3600]]);
      const patterns = new Map<MemoryType, AccessPattern | null>([['working', null]]);
      const stats = new Map<MemoryType, CacheStats>([['working', {
        memoryType: 'working',
        totalAccesses: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        expiredCount: 0,
        expirationRate: 0,
      }]]);
      const memoryTypes = new Map<string, MemoryType>([['mem-1', 'working']]);

      const result = batchApplyTTLTuning({
        baseTTLs,
        patterns,
        stats,
        memoryTypes,
      });

      // With 0% hit rate, hit rate multiplier (3.0) is applied
      expect(result.tunedTTLs.get('mem-1')).toBe(10800); // 3600 * 3.0
    });
  });
});
