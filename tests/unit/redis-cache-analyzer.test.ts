/**
 * ==============================================================================
 * Redis Cache Analyzer Unit Tests
 * ==============================================================================
 * Tests for cache hit/miss analysis module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCacheAnalyzerState,
  recordCacheAccess,
  calculateCacheStats,
  analyzeAccessPattern,
  generateCacheWarmingSuggestions,
  analyzeCache,
  getRecommendedTTLAdjustment,
  resetCacheAnalyzer,
  exportCacheAnalyzerState,
  importCacheAnalyzerState,
  type CacheAccessRecord,
  type MemoryType,
} from '../../skills/redis-ttl-manager/cache-analyzer';

describe('Redis Cache Analyzer', () => {
  describe('createCacheAnalyzerState', () => {
    it('should create state with default config', () => {
      const state = createCacheAnalyzerState();

      expect(state.records).toEqual([]);
      expect(state.counters.working).toEqual({ hits: 0, misses: 0, expired: 0 });
      expect(state.config.enabled).toBe(true);
      expect(state.config.maxRecords).toBe(10000);
    });

    it('should create state with custom config', () => {
      const state = createCacheAnalyzerState({
        maxRecords: 5000,
        patternWindowHours: 48,
      });

      expect(state.config.maxRecords).toBe(5000);
      expect(state.config.patternWindowHours).toBe(48);
    });
  });

  describe('recordCacheAccess', () => {
    let state = createCacheAnalyzerState();

    beforeEach(() => {
      state = createCacheAnalyzerState();
    });

    it('should record a cache hit', () => {
      const record: CacheAccessRecord = {
        memoryId: 'mem-001',
        memoryType: 'working',
        timestamp: new Date(),
        isHit: true,
        ttlRemaining: 3600,
        originalTTL: 7200,
      };

      recordCacheAccess(state, record);

      expect(state.records.length).toBe(1);
      expect(state.counters.working.hits).toBe(1);
      expect(state.counters.working.misses).toBe(0);
    });

    it('should record a cache miss', () => {
      const record: CacheAccessRecord = {
        memoryId: 'mem-002',
        memoryType: 'episodic',
        timestamp: new Date(),
        isHit: false,
      };

      recordCacheAccess(state, record);

      expect(state.counters.episodic.misses).toBe(1);
    });

    it('should track expired accesses', () => {
      const record: CacheAccessRecord = {
        memoryId: 'mem-003',
        memoryType: 'semantic',
        timestamp: new Date(),
        isHit: true,
        ttlRemaining: 0, // Expired
        originalTTL: 3600,
      };

      recordCacheAccess(state, record);

      expect(state.counters.semantic.expired).toBe(1);
    });

    it('should trim records when over limit', () => {
      const state = createCacheAnalyzerState({ maxRecords: 5 });

      // Add 10 records
      for (let i = 0; i < 10; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'working',
          timestamp: new Date(),
          isHit: true,
        });
      }

      expect(state.records.length).toBe(5);
      // Should keep the last 5
      expect(state.records[0].memoryId).toBe('mem-5');
    });

    it('should not record when disabled', () => {
      const state = createCacheAnalyzerState({ enabled: false });

      recordCacheAccess(state, {
        memoryId: 'mem-001',
        memoryType: 'working',
        timestamp: new Date(),
        isHit: true,
      });

      expect(state.records.length).toBe(0);
      expect(state.counters.working.hits).toBe(0);
    });
  });

  describe('calculateCacheStats', () => {
    let state = createCacheAnalyzerState();

    beforeEach(() => {
      state = createCacheAnalyzerState();

      // Add some test data
      for (let i = 0; i < 10; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'working',
          timestamp: new Date(),
          isHit: true,
          ttlRemaining: 1000,
        });
      }

      for (let i = 0; i < 5; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'working',
          timestamp: new Date(),
          isHit: false,
        });
      }
    });

    it('should calculate hit rate correctly', () => {
      const stats = calculateCacheStats(state, 'working');

      expect(stats.totalAccesses).toBe(15);
      expect(stats.hits).toBe(10);
      expect(stats.misses).toBe(5);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should calculate average TTL remaining', () => {
      const stats = calculateCacheStats(state, 'working');

      expect(stats.avgTTLRemaining).toBeCloseTo(1000, 0);
    });

    it('should calculate expiration rate', () => {
      const state = createCacheAnalyzerState();

      // Add expired record
      recordCacheAccess(state, {
        memoryId: 'mem-expired',
        memoryType: 'episodic',
        timestamp: new Date(),
        isHit: true,
        ttlRemaining: 0,
      });

      recordCacheAccess(state, {
        memoryId: 'mem-valid',
        memoryType: 'episodic',
        timestamp: new Date(),
        isHit: true,
        ttlRemaining: 1000,
      });

      const stats = calculateCacheStats(state, 'episodic');

      expect(stats.expiredCount).toBe(1);
      expect(stats.expirationRate).toBe(0.5);
    });

    it('should handle zero accesses', () => {
      const stats = calculateCacheStats(state, 'semantic');

      expect(stats.totalAccesses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('analyzeAccessPattern', () => {
    it('should return null with insufficient data', () => {
      const state = createCacheAnalyzerState({ minAccessesForPattern: 50 });

      // Add only 10 records
      for (let i = 0; i < 10; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'working',
          timestamp: new Date(),
          isHit: true,
        });
      }

      const pattern = analyzeAccessPattern(state, 'working');

      expect(pattern).toBeNull();
    });

    it('should detect peak hours', () => {
      const state = createCacheAnalyzerState({
        minAccessesForPattern: 50,
        patternWindowHours: 168,
      });

      // Add records concentrated in specific hours
      const now = new Date();
      for (let i = 0; i < 100; i++) {
        const record = new Date(now);
        record.setHours(14); // Peak at 2 PM
        record.setMinutes(i % 60);

        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'working',
          timestamp: record,
          isHit: true,
        });
      }

      const pattern = analyzeAccessPattern(state, 'working');

      expect(pattern).toBeDefined();
      expect(pattern?.peakHours).toContain(14);
    });

    it('should calculate trend', () => {
      const state = createCacheAnalyzerState({
        minAccessesForPattern: 50,
      });

      // Add records with increasing frequency
      const now = new Date();
      for (let day = 0; day < 7; day++) {
        const count = (day + 1) * 10; // Increasing each day
        for (let i = 0; i < count; i++) {
          const record = new Date(now);
          record.setDate(record.getDate() - (6 - day));
          record.setHours(12);

          recordCacheAccess(state, {
            memoryId: `mem-${day}-${i}`,
            memoryType: 'working',
            timestamp: record,
            isHit: true,
          });
        }
      }

      const pattern = analyzeAccessPattern(state, 'working');

      expect(pattern).toBeDefined();
      expect(pattern?.trend).toBeGreaterThan(0); // Positive trend
    });

    it('should recommend TTL adjustment based on hit rate', () => {
      const state = createCacheAnalyzerState({
        minAccessesForPattern: 50,
      });

      // Add records with low hit rate
      for (let i = 0; i < 100; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'working',
          timestamp: new Date(),
          isHit: i < 30, // 30% hit rate
        });
      }

      const pattern = analyzeAccessPattern(state, 'working');

      expect(pattern).toBeDefined();
      // Low hit rate should recommend longer TTL (multiplier > 1)
      expect(pattern?.recommendedTTLMultiplier).toBeGreaterThan(1);
    });
  });

  describe('generateCacheWarmingSuggestions', () => {
    it('should suggest pre-loading for low hit rate', () => {
      const state = createCacheAnalyzerState({
        minAccessesForPattern: 50,
      });

      // Add many misses for same memory
      for (let i = 0; i < 100; i++) {
        recordCacheAccess(state, {
          memoryId: 'frequently-missed',
          memoryType: 'working',
          timestamp: new Date(),
          isHit: false,
        });
      }

      const suggestions = generateCacheWarmingSuggestions(state);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].memoryIds).toContain('frequently-missed');
    });

    it('should prioritize suggestions', () => {
      const state = createCacheAnalyzerState();

      // Add data for multiple suggestions
      for (let i = 0; i < 200; i++) {
        recordCacheAccess(state, {
          memoryId: 'high-priority',
          memoryType: 'working',
          timestamp: new Date(),
          isHit: false,
        });
      }

      const suggestions = generateCacheWarmingSuggestions(state);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].priority).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].priority).toBeLessThanOrEqual(10);
    });
  });

  describe('analyzeCache', () => {
    it('should produce full analysis', () => {
      const state = createCacheAnalyzerState();

      // Add mixed data
      for (let i = 0; i < 50; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'working',
          timestamp: new Date(),
          isHit: true,
        });
      }

      for (let i = 0; i < 50; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'episodic',
          timestamp: new Date(),
          isHit: false,
        });
      }

      const result = analyzeCache(state);

      expect(result.overall.totalAccesses).toBe(100);
      expect(result.overall.hitRate).toBe(0.5);
      expect(result.byType.working.hits).toBe(50);
      expect(result.byType.episodic.misses).toBe(50);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('getRecommendedTTLAdjustment', () => {
    it('should return 1.0 with no data', () => {
      const state = createCacheAnalyzerState();

      const adjustment = getRecommendedTTLAdjustment(state, 'working');

      expect(adjustment).toBe(1.0);
    });

    it('should return adjustment based on pattern', () => {
      const state = createCacheAnalyzerState({
        minAccessesForPattern: 50,
      });

      // Add data with low hit rate
      for (let i = 0; i < 100; i++) {
        recordCacheAccess(state, {
          memoryId: `mem-${i}`,
          memoryType: 'semantic',
          timestamp: new Date(),
          isHit: i < 20, // 20% hit rate
        });
      }

      const adjustment = getRecommendedTTLAdjustment(state, 'semantic');

      // Low hit rate should recommend longer TTL
      expect(adjustment).toBeGreaterThan(1.0);
    });
  });

  describe('resetCacheAnalyzer', () => {
    it('should clear all state', () => {
      const state = createCacheAnalyzerState();

      // Add some data
      recordCacheAccess(state, {
        memoryId: 'mem-001',
        memoryType: 'working',
        timestamp: new Date(),
        isHit: true,
      });

      resetCacheAnalyzer(state);

      expect(state.records.length).toBe(0);
      expect(state.counters.working.hits).toBe(0);
    });
  });

  describe('exportCacheAnalyzerState', () => {
    it('should export state to serializable format', () => {
      const state = createCacheAnalyzerState();

      recordCacheAccess(state, {
        memoryId: 'mem-001',
        memoryType: 'working',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        isHit: true,
        ttlRemaining: 3600,
        originalTTL: 7200,
      });

      const exported = exportCacheAnalyzerState(state);

      expect(exported.records).toBeDefined();
      expect(exported.counters).toBeDefined();
      expect(exported.config).toBeDefined();
      expect(Array.isArray(exported.records)).toBe(true);
    });
  });

  describe('importCacheAnalyzerState', () => {
    it('should import state from serialized format', () => {
      const imported = importCacheAnalyzerState({
        records: [
          {
            memoryId: 'mem-001',
            memoryType: 'working',
            timestamp: '2024-01-01T12:00:00Z',
            isHit: true,
            ttlRemaining: 3600,
            originalTTL: 7200,
          },
        ],
        counters: {
          working: { hits: 1, misses: 0, expired: 0 },
          episodic: { hits: 0, misses: 0, expired: 0 },
          semantic: { hits: 0, misses: 0, expired: 0 },
          procedural: { hits: 0, misses: 0, expired: 0 },
          archival: { hits: 0, misses: 0, expired: 0 },
        },
        config: {
          enabled: true,
          maxRecords: 10000,
          patternWindowHours: 168,
          minAccessesForPattern: 50,
          ttlSensitivity: 0.3,
        },
      });

      expect(imported.records.length).toBe(1);
      expect(imported.records[0].memoryId).toBe('mem-001');
      expect(imported.counters.working.hits).toBe(1);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full analysis workflow', () => {
      const state = createCacheAnalyzerState({
        minAccessesForPattern: 20,
      });

      // Simulate realistic access patterns
      const now = new Date();
      for (let hour = 0; hour < 24; hour++) {
        const isPeakHour = hour >= 9 && hour <= 17;
        const accessCount = isPeakHour ? 10 : 2;

        for (let i = 0; i < accessCount; i++) {
          const timestamp = new Date(now);
          timestamp.setHours(hour);
          timestamp.setMinutes(i * 5);

          const isHit = Math.random() > 0.3; // 70% hit rate

          recordCacheAccess(state, {
            memoryId: `mem-${hour}-${i}`,
            memoryType: hour % 2 === 0 ? 'working' : 'episodic',
            timestamp,
            isHit,
            ttlRemaining: isHit ? Math.random() * 3600 : 0,
          });
        }
      }

      // Run full analysis
      const result = analyzeCache(state);

      expect(result.overall.totalAccesses).toBeGreaterThan(0);
      expect(result.overall.hitRate).toBeGreaterThan(0);
      expect(result.overall.hitRate).toBeLessThan(1);
      expect(result.suggestions).toBeDefined();
    });
  });
});
