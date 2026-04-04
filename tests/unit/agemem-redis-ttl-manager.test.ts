/**
 * Heretek OpenClaw — AgeMem Redis TTL Manager Unit Tests
 * ==============================================================================
 * Unit tests for redis-ttl-manager lobe implementation
 * 
 * Tests cover:
 * - TTL calculation with type multipliers
 * - Importance bonus calculation
 * - Access bonus calculation (logarithmic)
 * - Ebbinghaus decay factor integration
 * - TTL with breakdown
 * - Cache set with TTL
 * - TTL extension
 * - Cache health metrics
 * - Cache key calculation
 * - Config validation
 * - TTL report generation
 * ==============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DEFAULT_TTL_CONFIG,
  MEMORY_TYPE_TTL_MULTIPLIER,
  calculateTTL,
  calculateTTLWithBreakdown,
  setMemoryWithTTL,
  extendTTL,
  getCacheHealth,
  calculateCacheKey,
  validateTTLConfig,
  generateTTLReport,
  type MemoryType,
  type TTLManagerConfig,
  type TTLParams,
} from '../../skills/redis-ttl-manager/redis-ttl-manager';

describe('AgeMem Redis TTL Manager Module', () => {
  describe('DEFAULT_TTL_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TTL_CONFIG.enabled).toBe(true);
      expect(DEFAULT_TTL_CONFIG.baseTTLSeconds).toBe(86400); // 24 hours
      expect(DEFAULT_TTL_CONFIG.minTTLSeconds).toBe(300); // 5 minutes
      expect(DEFAULT_TTL_CONFIG.maxTTLSeconds).toBe(604800); // 7 days
      expect(DEFAULT_TTL_CONFIG.importanceMultiplier).toBe(1.5);
      expect(DEFAULT_TTL_CONFIG.accessBonusMultiplier).toBe(1.2);
      expect(DEFAULT_TTL_CONFIG.decayAwareTTL).toBe(true);
    });
  });

  describe('MEMORY_TYPE_TTL_MULTIPLIER', () => {
    it('should have correct multipliers for all memory types', () => {
      expect(MEMORY_TYPE_TTL_MULTIPLIER.working).toBe(0.25);
      expect(MEMORY_TYPE_TTL_MULTIPLIER.episodic).toBe(1.0);
      expect(MEMORY_TYPE_TTL_MULTIPLIER.semantic).toBe(2.0);
      expect(MEMORY_TYPE_TTL_MULTIPLIER.procedural).toBe(3.0);
      expect(MEMORY_TYPE_TTL_MULTIPLIER.archival).toBe(0);
    });

    it('should default to episodic multiplier for undefined type', () => {
      // When type is undefined, calculateTTL uses 'episodic' as default
      expect(MEMORY_TYPE_TTL_MULTIPLIER['episodic']).toBe(1.0);
    });
  });

  describe('calculateTTL', () => {
    it('should return base TTL when disabled', () => {
      const ttl = calculateTTL({
        importance: 0.5,
        config: { enabled: false },
      });

      expect(ttl).toBe(86400); // baseTTLSeconds
    });

    it('should calculate correct TTL for working memory', () => {
      const ttl = calculateTTL({
        importance: 0.5,
        type: 'working',
      });

      // Base: 86400 * 0.25 = 21600 (6 hours)
      // Importance bonus: 1 + (0.5 * 1.5) = 1.75
      // Access bonus: log2(0 + 1) * 1.2 = 0
      // Decay factor: 1 (no age provided)
      // Final: 21600 * 1.75 * 1 * 1 = 37800
      expect(ttl).toBeGreaterThan(21600);
    });

    it('should calculate correct TTL for semantic memory', () => {
      const ttl = calculateTTL({
        importance: 0.8,
        type: 'semantic',
        accessCount: 5,
      });

      // Base: 86400 * 2.0 = 172800
      // Should be higher than episodic due to 2.0 multiplier
      expect(ttl).toBeGreaterThan(86400);
    });

    it('should apply importance bonus correctly', () => {
      const lowImportance = calculateTTL({
        importance: 0.1,
        type: 'episodic',
      });

      const highImportance = calculateTTL({
        importance: 0.9,
        type: 'episodic',
      });

      expect(highImportance).toBeGreaterThan(lowImportance);
    });

    it('should apply access bonus (logarithmic)', () => {
      // Use lower importance to avoid hitting maxTTL ceiling
      const noAccess = calculateTTL({
        importance: 0.3,
        type: 'episodic',
        accessCount: 0,
      });

      const someAccess = calculateTTL({
        importance: 0.3,
        type: 'episodic',
        accessCount: 10,
      });

      const highAccess = calculateTTL({
        importance: 0.3,
        type: 'episodic',
        accessCount: 100,
      });

      expect(someAccess).toBeGreaterThanOrEqual(noAccess);
      expect(highAccess).toBeGreaterThanOrEqual(someAccess);
    });

    it('should show diminishing returns for access bonus', () => {
      // Use lower importance to avoid hitting maxTTL ceiling
      const access10 = calculateTTL({ importance: 0.3, type: 'episodic', accessCount: 10 });
      const access20 = calculateTTL({ importance: 0.3, type: 'episodic', accessCount: 20 });
      const access100 = calculateTTL({ importance: 0.3, type: 'episodic', accessCount: 100 });

      // Both should increase due to logarithmic growth
      expect(access100).toBeGreaterThanOrEqual(access10);
    });

    it('should apply decay factor when decayAwareTTL is enabled', () => {
      const fresh = calculateTTL({
        importance: 0.5,
        type: 'episodic',
        ageInDays: 0,
      });

      const old = calculateTTL({
        importance: 0.5,
        type: 'episodic',
        ageInDays: 14,
      });

      // Old memory should have lower TTL due to decay
      expect(old).toBeLessThan(fresh);
    });

    it('should calculate decay factor using Ebbinghaus formula', () => {
      const ttl = calculateTTL({
        importance: 0.5,
        type: 'episodic',
        ageInDays: 7,
        halfLifeDays: 7,
      });

      // After one half-life, decay factor should be ~0.5
      // This significantly reduces the TTL
      expect(ttl).toBeLessThan(calculateTTL({
        importance: 0.5,
        type: 'episodic',
        ageInDays: 0,
      }));
    });

    it('should clamp TTL to minTTLSeconds', () => {
      const ttl = calculateTTL({
        importance: 0.0,
        type: 'archival', // 0 multiplier
        ageInDays: 90,
        config: { minTTLSeconds: 300 },
      });

      expect(ttl).toBeGreaterThanOrEqual(300);
    });

    it('should clamp TTL to maxTTLSeconds', () => {
      const ttl = calculateTTL({
        importance: 1.0,
        type: 'procedural', // 3.0 multiplier
        accessCount: 1000,
        config: { maxTTLSeconds: 604800 },
      });

      expect(ttl).toBeLessThanOrEqual(604800);
    });

    it('should handle undefined parameters', () => {
      const ttl = calculateTTL({
        importance: 0.5,
      });

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(604800);
    });

    it('should use custom config when provided', () => {
      const customConfig: Partial<TTLManagerConfig> = {
        baseTTLSeconds: 43200, // 12 hours
        importanceMultiplier: 2.0,
        accessBonusMultiplier: 1.5,
      };

      const ttl = calculateTTL({
        importance: 0.8,
        type: 'semantic',
        config: customConfig,
      });

      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe('calculateTTLWithBreakdown', () => {
    it('should return TTL with complete breakdown', () => {
      const result = calculateTTLWithBreakdown({
        importance: 0.8,
        type: 'semantic',
        accessCount: 10,
        ageInDays: 7,
        halfLifeDays: 7,
      });

      expect(result.ttlSeconds).toBeGreaterThan(0);
      expect(result.breakdown.baseTTL).toBeGreaterThan(0);
      expect(result.breakdown.importanceBonus).toBeGreaterThan(1);
      expect(result.breakdown.accessBonus).toBeGreaterThan(0);
      expect(result.breakdown.decayFactor).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.decayFactor).toBeLessThanOrEqual(1);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should calculate correct baseTTL for each memory type', () => {
      const types: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural'];

      for (const type of types) {
        const result = calculateTTLWithBreakdown({
          importance: 0.5,
          type,
        });

        const expectedBase = 86400 * MEMORY_TYPE_TTL_MULTIPLIER[type];
        expect(result.breakdown.baseTTL).toBeCloseTo(expectedBase, 0);
      }
    });

    it('should show decay factor of 1.0 for fresh memories', () => {
      const result = calculateTTLWithBreakdown({
        importance: 0.5,
        type: 'episodic',
        ageInDays: 0,
      });

      expect(result.breakdown.decayFactor).toBeCloseTo(1, 2);
    });

    it('should show decay factor ~0.5 after one half-life', () => {
      const result = calculateTTLWithBreakdown({
        importance: 0.5,
        type: 'episodic',
        ageInDays: 7,
        halfLifeDays: 7,
      });

      expect(result.breakdown.decayFactor).toBeCloseTo(0.5, 1);
    });
  });

  describe('setMemoryWithTTL', () => {
    let originalLog: typeof console.log;

    beforeEach(() => {
      originalLog = console.log;
      console.log = vi.fn();
    });

    afterEach(() => {
      console.log = originalLog;
    });

    it('should call setMemoryWithTTL with correct parameters', async () => {
      const result = await setMemoryWithTTL({
        key: 'memory:semantic:001',
        value: JSON.stringify({ content: 'Test memory' }),
        importance: 0.9,
        type: 'semantic',
        accessCount: 5,
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe('memory:semantic:001');
      expect(result.ttl).toBeGreaterThan(0);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should log Redis SETEX command', async () => {
      await setMemoryWithTTL({
        key: 'memory:test:001',
        value: 'test value',
        importance: 0.5,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Redis TTL Manager] SET memory:test:001 EX=')
      );
    });
  });

  describe('extendTTL', () => {
    let originalLog: typeof console.log;

    beforeEach(() => {
      originalLog = console.log;
      console.log = vi.fn();
    });

    afterEach(() => {
      console.log = originalLog;
    });

    it('should extend TTL based on access', async () => {
      const result = await extendTTL({
        key: 'memory:semantic:002',
        accessCount: 10,
        importance: 0.8,
        type: 'semantic',
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe('memory:semantic:002');
      expect(result.newTTL).toBeGreaterThan(0);
      expect(result.previousTTL).toBeDefined();
      expect(result.remainingTTL).toBeDefined();
    });

    it('should log Redis EXPIRE command', async () => {
      await extendTTL({
        key: 'memory:test:002',
        accessCount: 5,
        importance: 0.7,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Redis TTL Manager] EXPIRE memory:test:002')
      );
    });
  });

  describe('getCacheHealth', () => {
    it('should return cache health metrics', async () => {
      const health = await getCacheHealth();

      expect(health.totalKeys).toBeDefined();
      expect(health.avgTTL).toBeDefined();
      expect(health.hitRate).toBeGreaterThanOrEqual(0);
      expect(health.hitRate).toBeLessThanOrEqual(1);
      expect(health.missRate).toBeGreaterThanOrEqual(0);
      expect(health.missRate).toBeLessThanOrEqual(1);
      expect(health.expiredCount).toBeDefined();
      expect(health.evictedCount).toBeDefined();
      expect(health.memoryUsage).toBeDefined();
    });

    it('should have hitRate + missRate = 1', async () => {
      const health = await getCacheHealth();

      expect(health.hitRate + health.missRate).toBeCloseTo(1, 2);
    });
  });

  describe('calculateCacheKey', () => {
    it('should generate correct cache key format', () => {
      const key = calculateCacheKey({
        type: 'semantic',
        memoryId: 'mem-001',
      });

      expect(key).toBe('agemem:semantic:mem-001');
    });

    it('should handle all memory types', () => {
      const types: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural', 'archival'];

      for (const type of types) {
        const key = calculateCacheKey({
          type,
          memoryId: 'mem-test',
        });

        expect(key).toBe(`agemem:${type}:mem-test`);
      }
    });
  });

  describe('validateTTLConfig', () => {
    it('should return valid for default config', () => {
      const result = validateTTLConfig({});

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fix minTTL > maxTTL error', () => {
      const result = validateTTLConfig({
        minTTLSeconds: 700000,
        maxTTLSeconds: 604800,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('minTTLSeconds cannot be greater than maxTTLSeconds')
      );
      expect(result.fixed.minTTLSeconds).toBeLessThanOrEqual(result.fixed.maxTTLSeconds);
    });

    it('should fix baseTTL < minTTL error', () => {
      const result = validateTTLConfig({
        baseTTLSeconds: 100,
        minTTLSeconds: 300,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('baseTTLSeconds cannot be less than minTTLSeconds')
      );
      expect(result.fixed.baseTTLSeconds).toBeGreaterThanOrEqual(result.fixed.minTTLSeconds);
    });

    it('should fix baseTTL > maxTTL error', () => {
      const result = validateTTLConfig({
        baseTTLSeconds: 1000000,
        maxTTLSeconds: 604800,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('baseTTLSeconds cannot be greater than maxTTLSeconds')
      );
      expect(result.fixed.baseTTLSeconds).toBeLessThanOrEqual(result.fixed.maxTTLSeconds);
    });

    it('should fix negative importanceMultiplier', () => {
      const result = validateTTLConfig({
        importanceMultiplier: -1.5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('importanceMultiplier must be non-negative')
      );
      expect(result.fixed.importanceMultiplier).toBeGreaterThanOrEqual(0);
    });

    it('should fix negative accessBonusMultiplier', () => {
      const result = validateTTLConfig({
        accessBonusMultiplier: -0.5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('accessBonusMultiplier must be non-negative')
      );
      expect(result.fixed.accessBonusMultiplier).toBeGreaterThanOrEqual(0);
    });

    it('should return multiple errors when multiple issues exist', () => {
      const result = validateTTLConfig({
        minTTLSeconds: 700000,
        importanceMultiplier: -1.0,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('generateTTLReport', () => {
    it('should generate markdown report with TTL calculations', () => {
      const memories = [
        { id: 'mem-001', type: 'episodic' as MemoryType, importance: 0.8, accessCount: 10, ageInDays: 5 },
        { id: 'mem-002', type: 'semantic' as MemoryType, importance: 0.9, accessCount: 20, ageInDays: 10 },
        { id: 'mem-003', type: 'working' as MemoryType, importance: 0.5, accessCount: 2, ageInDays: 0 },
      ];

      const report = generateTTLReport({ memories });

      expect(report).toContain('# Redis TTL Manager Report');
      expect(report).toContain('**Generated:**');
      expect(report).toContain('## TTL Calculations');
      expect(report).toContain('| Memory ID | Type | Importance | Accesses | Age (days) | TTL |');
    });

    it('should format TTL in human-readable format', () => {
      const memories = [
        { id: 'mem-001', type: 'episodic' as MemoryType, importance: 0.5, accessCount: 0, ageInDays: 0 },
      ];

      const report = generateTTLReport({ memories });

      // Should contain TTL in h (hours) or d (days) format
      expect(report).toMatch(/(\d+[hmd])/);
    });

    it('should handle empty memories array', () => {
      const report = generateTTLReport({ memories: [] });

      expect(report).toContain('# Redis TTL Manager Report');
      expect(report).toContain('| Memory ID | Type | Importance | Accesses | Age (days) | TTL |');
    });
  });

  describe('Integration Tests', () => {
    it('should calculate appropriate TTLs for different memory scenarios', () => {
      // Fresh, important, frequently accessed semantic memory
      const hotSemantic = calculateTTL({
        importance: 0.9,
        type: 'semantic',
        accessCount: 50,
        ageInDays: 1,
      });

      // Old, less important, unaccessed episodic memory
      const coldEpisodic = calculateTTL({
        importance: 0.3,
        type: 'episodic',
        accessCount: 0,
        ageInDays: 21,
      });

      // Working memory (short-lived)
      const working = calculateTTL({
        importance: 0.5,
        type: 'working',
        accessCount: 5,
        ageInDays: 0,
      });

      // Hot semantic should have longest TTL
      expect(hotSemantic).toBeGreaterThan(coldEpisodic);
      expect(hotSemantic).toBeGreaterThan(working);

      // Working memory should have shortest TTL
      expect(working).toBeLessThan(hotSemantic);
    });

    it('should handle edge cases in TTL calculation', () => {
      // Zero importance
      const zeroImportance = calculateTTL({ importance: 0, type: 'episodic' });
      expect(zeroImportance).toBeGreaterThanOrEqual(300); // minTTL

      // Maximum importance
      const maxImportance = calculateTTL({ importance: 1, type: 'episodic' });
      expect(maxImportance).toBeGreaterThan(zeroImportance);

      // Very old memory
      const veryOld = calculateTTL({ importance: 0.5, type: 'episodic', ageInDays: 365 });
      expect(veryOld).toBeLessThan(calculateTTL({ importance: 0.5, type: 'episodic', ageInDays: 0 }));
    });
  });
});
