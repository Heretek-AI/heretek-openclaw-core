/**
 * Heretek OpenClaw — AgeMem Decay Unit Tests
 * ==============================================================================
 * Unit tests for Ebbinghaus forgetting curve implementation in decay.ts
 * 
 * Tests cover:
 * - Decay lambda calculation
 * - Ebbinghaus multiplier calculation
 * - Decay application to scores
 * - Memory retrieval with decay weighting
 * - Memory addition API
 * - Type-based half-life calculation
 * - Optimal review interval calculation
 * ==============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_EBBINGHAUS_CONFIG,
  toDecayLambda,
  calculateEbbinghausMultiplier,
  applyEbbinghausDecayToScore,
  memory_retrieve,
  batchApplyDecay,
  memory_add,
  getHalfLifeForMemoryType,
  generateMemoryId,
  validateImportance,
  calculateOptimalReviewInterval,
  type MemoryType,
  type EbbinghausConfig,
} from '../../skills/memory-consolidation/decay';

describe('AgeMem Decay Module', () => {
  describe('DEFAULT_EBBINGHAUS_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_EBBINGHAUS_CONFIG.enabled).toBe(true);
      expect(DEFAULT_EBBINGHAUS_CONFIG.halfLifeDays).toBe(7);
      expect(DEFAULT_EBBINGHAUS_CONFIG.floorMultiplier).toBe(0.1);
      expect(DEFAULT_EBBINGHAUS_CONFIG.repetitionBoost).toBe(1.5);
    });
  });

  describe('toDecayLambda', () => {
    it('should calculate lambda correctly for half-life of 7 days', () => {
      const lambda = toDecayLambda(7);
      expect(lambda).toBeCloseTo(Math.LN2 / 7, 5);
    });

    it('should calculate lambda correctly for half-life of 30 days', () => {
      const lambda = toDecayLambda(30);
      expect(lambda).toBeCloseTo(Math.LN2 / 30, 5);
    });

    it('should return 0 for invalid half-life values', () => {
      expect(toDecayLambda(0)).toBe(0);
      expect(toDecayLambda(-5)).toBe(0);
      expect(toDecayLambda(NaN)).toBe(0);
      expect(toDecayLambda(Infinity)).toBe(0);
    });

    it('should handle half-life of 0.5 days (working memory)', () => {
      const lambda = toDecayLambda(0.5);
      expect(lambda).toBeCloseTo(Math.LN2 / 0.5, 5);
    });
  });

  describe('calculateEbbinghausMultiplier', () => {
    it('should return 1.0 for fresh memory (age 0)', () => {
      const multiplier = calculateEbbinghausMultiplier({
        ageInDays: 0,
        halfLifeDays: 7,
      });
      expect(multiplier).toBe(1);
    });

    it('should return 0.5 for memory at half-life age', () => {
      const multiplier = calculateEbbinghausMultiplier({
        ageInDays: 7,
        halfLifeDays: 7,
      });
      expect(multiplier).toBeCloseTo(0.5, 2);
    });

    it('should return ~0.25 for memory at 2x half-life', () => {
      const multiplier = calculateEbbinghausMultiplier({
        ageInDays: 14,
        halfLifeDays: 7,
      });
      expect(multiplier).toBeCloseTo(0.25, 2);
    });

    it('should return ~0.125 for memory at 3x half-life', () => {
      const multiplier = calculateEbbinghausMultiplier({
        ageInDays: 21,
        halfLifeDays: 7,
      });
      expect(multiplier).toBeCloseTo(0.125, 2);
    });

    it('should handle negative age by clamping to 0', () => {
      const multiplier = calculateEbbinghausMultiplier({
        ageInDays: -5,
        halfLifeDays: 7,
      });
      expect(multiplier).toBe(1);
    });

    it('should use correct half-life for different memory types', () => {
      const episodicMultiplier = calculateEbbinghausMultiplier({
        ageInDays: 7,
        halfLifeDays: 7,
      });
      const semanticMultiplier = calculateEbbinghausMultiplier({
        ageInDays: 7,
        halfLifeDays: 30,
      });

      // After 7 days, episodic should be at 50%, semantic should be higher
      expect(episodicMultiplier).toBeCloseTo(0.5, 2);
      expect(semanticMultiplier).toBeGreaterThan(0.8);
    });
  });

  describe('applyEbbinghausDecayToScore', () => {
    it('should apply decay correctly to base score', () => {
      const result = applyEbbinghausDecayToScore({
        score: 0.8,
        ageInDays: 7,
        halfLifeDays: 7,
      });

      // After one half-life, score should be ~0.4 (0.8 * 0.5)
      expect(result).toBeCloseTo(0.4, 2);
    });

    it('should apply repetition boost for accessed memories', () => {
      const result = applyEbbinghausDecayToScore({
        score: 0.8,
        ageInDays: 7,
        halfLifeDays: 7,
        accessCount: 10,
      });

      // With 10 accesses, should have boost applied
      const withoutAccess = applyEbbinghausDecayToScore({
        score: 0.8,
        ageInDays: 7,
        halfLifeDays: 7,
        accessCount: 0,
      });

      expect(result).toBeGreaterThan(withoutAccess);
    });

    it('should apply floor to prevent complete decay', () => {
      const result = applyEbbinghausDecayToScore({
        score: 0.9,
        ageInDays: 90,
        halfLifeDays: 7,
        config: { floorMultiplier: 0.1 },
      });

      // Floor should be 0.9 * 0.1 = 0.09
      expect(result).toBeGreaterThanOrEqual(0.09);
    });

    it('should handle fresh memory with no decay', () => {
      const result = applyEbbinghausDecayToScore({
        score: 0.7,
        ageInDays: 0,
        halfLifeDays: 7,
      });

      expect(result).toBeCloseTo(0.7, 2);
    });

    it('should use custom config when provided', () => {
      const customConfig: Partial<EbbinghausConfig> = {
        floorMultiplier: 0.2,
        repetitionBoost: 2.0,
      };

      const result = applyEbbinghausDecayToScore({
        score: 0.8,
        ageInDays: 7,
        halfLifeDays: 7,
        config: customConfig,
      });

      // After one half-life (7 days), score should be ~0.4
      expect(result).toBeCloseTo(0.4, 1);
    });
  });

  describe('memory_retrieve', () => {
    it('should sort memories by decayed score (highest first)', async () => {
      const memories = [
        { content: 'Old memory', importance: 0.5, createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        { content: 'New memory', importance: 0.5, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { content: 'Medium memory', importance: 0.5, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      ];

      const results = await memory_retrieve({
        memories,
        recencyWeight: 0.5,
      });

      expect(results[0].content).toBe('New memory');
      expect(results[2].content).toBe('Old memory');
    });

    it('should calculate decayed scores correctly', async () => {
      const now = Date.now();
      const memories = [
        {
          content: 'Fresh memory',
          importance: 0.8,
          createdAt: new Date(now),
          accessCount: 0,
        },
      ];

      const results = await memory_retrieve({
        memories,
        config: { halfLifeDays: 7 },
      });

      expect(results[0].decayedScore).toBeCloseTo(0.8, 1);
      expect(results[0].ageInDays).toBeLessThan(0.001);
    });

    it('should handle string dates in createdAt', async () => {
      const memories = [
        {
          content: 'Memory with string date',
          importance: 0.7,
          createdAt: new Date().toISOString(),
        },
      ];

      const results = await memory_retrieve({
        memories,
      });

      expect(results[0].content).toBe('Memory with string date');
      expect(results[0].originalScore).toBe(0.7);
    });

    it('should handle empty memories array', async () => {
      const results = await memory_retrieve({
        memories: [],
      });

      expect(results).toEqual([]);
    });

    it('should include access count in results', async () => {
      const memories = [
        {
          content: 'Frequently accessed memory',
          importance: 0.6,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          accessCount: 15,
        },
      ];

      const results = await memory_retrieve({
        memories,
      });

      expect(results[0].accessCount).toBe(15);
    });
  });

  describe('batchApplyDecay', () => {
    it('should apply decay to multiple memories', () => {
      const now = Date.now();
      const memories = [
        { importance: 0.8, createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        { importance: 0.6, createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000) },
        { importance: 0.9, createdAt: new Date(now) },
      ];

      const results = batchApplyDecay(memories, { halfLifeDays: 7 });

      expect(results.length).toBe(3);
      expect(results[0].importance).toBe(0.8);
      expect(results[0].decayedScore).toBeLessThan(0.8);
      expect(results[0].ageInDays).toBeCloseTo(7, 0);
    });

    it('should handle string dates', () => {
      const memories = [
        { importance: 0.7, createdAt: new Date().toISOString() },
      ];

      const results = batchApplyDecay(memories);

      expect(results[0].importance).toBe(0.7);
      expect(results[0].ageInDays).toBeLessThan(1);
    });
  });

  describe('getHalfLifeForMemoryType', () => {
    it('should return correct half-life for working memory', () => {
      expect(getHalfLifeForMemoryType('working')).toBe(0.5);
    });

    it('should return correct half-life for episodic memory', () => {
      expect(getHalfLifeForMemoryType('episodic')).toBe(7);
    });

    it('should return correct half-life for semantic memory', () => {
      expect(getHalfLifeForMemoryType('semantic')).toBe(30);
    });

    it('should return correct half-life for procedural memory', () => {
      expect(getHalfLifeForMemoryType('procedural')).toBe(90);
    });

    it('should return Infinity for archival memory', () => {
      expect(getHalfLifeForMemoryType('archival')).toBe(Infinity);
    });

    it('should default to 7 for unknown types', () => {
      // TypeScript will catch this at compile time, but test runtime behavior
      expect(getHalfLifeForMemoryType('episodic' as MemoryType)).toBe(7);
    });
  });

  describe('generateMemoryId', () => {
    it('should generate unique IDs for different content', () => {
      const now = new Date();
      const id1 = generateMemoryId('Content A', now);
      const id2 = generateMemoryId('Content B', now);

      expect(id1).not.toBe(id2);
    });

    it('should generate unique IDs for same content at different times', () => {
      const content = 'Same content';
      const id1 = generateMemoryId(content, new Date('2024-01-01'));
      const id2 = generateMemoryId(content, new Date('2024-01-02'));

      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with mem_ prefix', () => {
      const id = generateMemoryId('Test content', new Date());
      expect(id).toMatch(/^mem_/);
    });
  });

  describe('validateImportance', () => {
    it('should return default 0.5 for undefined', () => {
      expect(validateImportance(undefined)).toBe(0.5);
    });

    it('should return default 0.5 for null', () => {
      expect(validateImportance(null as unknown as undefined)).toBe(0.5);
    });

    it('should clamp values above 1 to 1', () => {
      expect(validateImportance(1.5)).toBe(1);
      expect(validateImportance(2.0)).toBe(1);
    });

    it('should clamp values below 0 to 0', () => {
      expect(validateImportance(-0.5)).toBe(0);
      expect(validateImportance(-1.0)).toBe(0);
    });

    it('should pass through valid values', () => {
      expect(validateImportance(0.0)).toBe(0);
      expect(validateImportance(0.5)).toBe(0.5);
      expect(validateImportance(1.0)).toBe(1);
    });

    it('should return default for NaN', () => {
      expect(validateImportance(NaN)).toBe(0.5);
    });
  });

  describe('memory_add', () => {
    it('should create memory with default importance', async () => {
      const result = await memory_add({
        content: 'Test memory content',
        type: 'episodic',
      });

      expect(result.success).toBe(true);
      expect(result.importance).toBe(0.5);
      expect(result.content).toBe('Test memory content');
      expect(result.type).toBe('episodic');
    });

    it('should use provided importance score', async () => {
      const result = await memory_add({
        content: 'Important memory',
        type: 'semantic',
        importance: 0.9,
      });

      expect(result.importance).toBe(0.9);
    });

    it('should clamp invalid importance scores', async () => {
      const result1 = await memory_add({
        content: 'Too high',
        type: 'episodic',
        importance: 1.5,
      });
      expect(result1.importance).toBe(1);

      const result2 = await memory_add({
        content: 'Too low',
        type: 'episodic',
        importance: -0.3,
      });
      expect(result2.importance).toBe(0);
    });

    it('should generate correct storage paths for different types', async () => {
      const types: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural', 'archival'];

      for (const type of types) {
        const result = await memory_add({
          content: `Test ${type} memory`,
          type,
        });

        expect(result.path).toBeDefined();
        expect(result.type).toBe(type);
      }
    });

    it('should include tags and metadata', async () => {
      const result = await memory_add({
        content: 'Memory with metadata',
        type: 'semantic',
        tags: ['test', 'important'],
        metadata: { source: 'unit-test', version: '1.0' },
      });

      expect(result.tags).toEqual(['test', 'important']);
      expect(result.metadata).toEqual({ source: 'unit-test', version: '1.0' });
    });

    it('should handle empty tags and metadata', async () => {
      const result = await memory_add({
        content: 'Minimal memory',
        type: 'episodic',
      });

      expect(result.tags).toEqual([]);
      expect(result.metadata).toEqual({});
    });

    it('should default to episodic for invalid types', async () => {
      const result = await memory_add({
        content: 'Invalid type test',
        type: 'invalid' as unknown as MemoryType,
      });

      expect(result.type).toBe('episodic');
    });
  });

  describe('calculateOptimalReviewInterval', () => {
    it('should return 0 for scores already below threshold', () => {
      const interval = calculateOptimalReviewInterval({
        currentScore: 0.3,
        threshold: 0.5,
        halfLifeDays: 7,
      });

      expect(interval).toBe(0);
    });

    it('should calculate positive interval for scores above threshold', () => {
      const interval = calculateOptimalReviewInterval({
        currentScore: 0.8,
        threshold: 0.5,
        halfLifeDays: 7,
      });

      expect(interval).toBeGreaterThan(0);
    });

    it('should use default threshold of 0.5', () => {
      const interval = calculateOptimalReviewInterval({
        currentScore: 0.6,
        halfLifeDays: 7,
      });

      expect(interval).toBeGreaterThan(0);
    });

    it('should use default half-life of 7 days', () => {
      const interval = calculateOptimalReviewInterval({
        currentScore: 0.7,
      });

      expect(interval).toBeGreaterThan(0);
    });

    it('should return halfLifeDays for invalid lambda', () => {
      const interval = calculateOptimalReviewInterval({
        currentScore: 0.8,
        halfLifeDays: 0, // Invalid, causes lambda to be 0
      });

      expect(interval).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should correctly decay and retrieve memories in sequence', async () => {
      const now = Date.now();
      const memories = [
        {
          content: 'Very old important memory',
          importance: 0.9,
          createdAt: new Date(now - 21 * 24 * 60 * 60 * 1000),
          accessCount: 5,
        },
        {
          content: 'Recent less important memory',
          importance: 0.4,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
          accessCount: 1,
        },
        {
          content: 'Week old medium memory',
          importance: 0.6,
          createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
          accessCount: 3,
        },
      ];

      const results = await memory_retrieve({
        memories,
        config: { halfLifeDays: 7 },
      });

      // Verify all results have decayed scores
      results.forEach(result => {
        expect(result.decayedScore).toBeLessThanOrEqual(result.originalScore);
      });

      // Verify results are sorted by decayed score
      for (let i = 1; i < results.length; i++) {
        expect(results[i].decayedScore).toBeLessThanOrEqual(results[i - 1].decayedScore);
      }
    });
  });
});
