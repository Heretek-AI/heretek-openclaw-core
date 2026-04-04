/**
 * Heretek OpenClaw — AgeMem Integration Tests
 * ==============================================================================
 * Integration tests for AgeMem unified memory system
 * 
 * These tests verify the integration between:
 * - Ebbinghaus decay utility
 * - Importance scorer
 * - Archivist lifecycle management
 * - Redis TTL manager
 * - Cross-tier correlator
 * 
 * Note: These tests use mock implementations and do not require
 * actual PostgreSQL/Redis connections. They verify the integration
 * logic between components.
 * ==============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  // Decay module
  applyEbbinghausDecayToScore,
  calculateEbbinghausMultiplier,
  memory_add,
  memory_retrieve,
  getHalfLifeForMemoryType,
} from '../../skills/memory-consolidation/decay';
import {
  // Importance scorer
  calculateImportance,
} from '../../skills/importance-scorer/importance-scorer';
import {
  // Archivist
  evaluateMemoryLifecycle,
  promoteMemory,
  archiveMemory,
} from '../../skills/archivist/archivist';
import {
  // Redis TTL Manager
  calculateTTL,
  calculateCacheKey,
} from '../../skills/redis-ttl-manager/redis-ttl-manager';
import {
  // Cross-tier correlator
  calculateCorrelationScore,
  calculateSemanticSimilarity,
  determineRelationshipType,
} from '../../skills/cross-tier-correlator/cross-tier-correlator';

describe('AgeMem Integration Tests', () => {
  describe('Memory Lifecycle Integration', () => {
    it('should handle full memory lifecycle from creation to archival', async () => {
      // Step 1: Create memory with importance scoring
      const importanceResult = await calculateImportance({
        content: 'PostgreSQL is a relational database management system',
        type: 'semantic',
        userProvidedImportance: 0.8,
      });

      expect(importanceResult.score).toBeGreaterThan(0.5);

      // Step 2: Add memory to system
      const memoryAddResult = await memory_add({
        content: 'PostgreSQL is a relational database management system',
        type: 'semantic',
        importance: importanceResult.score,
        tags: ['database', 'postgresql'],
      });

      expect(memoryAddResult.success).toBe(true);
      expect(memoryAddResult.id).toBeDefined();

      // Step 3: Evaluate for lifecycle action (should maintain)
      const evalResult = await evaluateMemoryLifecycle({
        memoryId: memoryAddResult.id,
        type: 'semantic',
        importance: importanceResult.score,
        ageInDays: 5,
        accessCount: 3,
      });

      expect(evalResult.recommendedAction).toBe('maintain');

      // Step 4: Calculate Redis TTL for caching
      const ttl = calculateTTL({
        importance: importanceResult.score,
        type: 'semantic',
        accessCount: 3,
        ageInDays: 5,
      });

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(604800); // maxTTLSeconds
    });

    it('should promote episodic memory based on access patterns', async () => {
      // Create episodic memory
      const importanceResult = await calculateImportance({
        content: 'Team meeting discussed Q2 roadmap',
        type: 'episodic',
        accessCount: 15, // High access count
      });

      // Evaluate - should recommend promotion
      const evalResult = await evaluateMemoryLifecycle({
        memoryId: 'mem-episodic-001',
        type: 'episodic',
        importance: importanceResult.score,
        ageInDays: 3,
        accessCount: 15,
      });

      expect(evalResult.recommendedAction).toBe('promote');

      // Execute promotion
      const promoteResult = await promoteMemory({
        memoryId: 'mem-episodic-001',
        reason: 'high_access',
      });

      expect(promoteResult.success).toBe(true);
      expect(promoteResult.newType).toBe('semantic');
    });

    it('should apply decay correctly during retrieval', async () => {
      const now = Date.now();
      const memories = [
        {
          content: 'Fresh important memory',
          importance: 0.9,
          createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000), // 1 day old
          accessCount: 10,
        },
        {
          content: 'Old less important memory',
          importance: 0.5,
          createdAt: new Date(now - 21 * 24 * 60 * 60 * 1000), // 21 days old
          accessCount: 2,
        },
      ];

      const results = await memory_retrieve({
        memories,
        config: { halfLifeDays: 7 },
      });

      // Fresh, important memory should rank higher
      expect(results[0].content).toBe('Fresh important memory');

      // Note: decayedScore can exceed originalScore due to repetition boost
      // for frequently accessed memories. The decay affects the base score,
      // but access bonus can increase the final result.
      results.forEach(result => {
        expect(result.decayedScore).toBeGreaterThan(0);
      });
    });
  });

  describe('Cross-Tier Correlation Integration', () => {
    it('should discover relationships between episodic and semantic memories', () => {
      const episodicContent = 'We implemented PostgreSQL connection pooling';
      const semanticContent = 'PostgreSQL connection pooling improves performance';

      // Calculate semantic similarity
      const semanticSimilarity = calculateSemanticSimilarity(
        episodicContent,
        semanticContent
      );

      expect(semanticSimilarity).toBeGreaterThan(0.3);

      // Determine relationship type
      const relationshipType = determineRelationshipType({
        sourceType: 'episodic',
        targetType: 'semantic',
        sourceContent: episodicContent,
        targetContent: semanticContent,
        entitiesA: ['PostgreSQL'],
        entitiesB: ['PostgreSQL'],
      });

      expect(relationshipType).toBe('supports');

      // Calculate correlation score
      const correlationScore = calculateCorrelationScore({
        semanticSimilarity,
        coOccurrence: 0.8,
        temporalProximity: 0.9,
        crossReference: 0.5,
      });

      expect(correlationScore).toBeGreaterThan(0.5);
    });

    it('should calculate appropriate TTL based on correlation importance', () => {
      // High correlation score memory
      const highCorrelationTTL = calculateTTL({
        importance: 0.9,
        type: 'semantic',
        accessCount: 20,
        ageInDays: 2,
      });

      // Low correlation score memory
      const lowCorrelationTTL = calculateTTL({
        importance: 0.3,
        type: 'semantic',
        accessCount: 2,
        ageInDays: 14,
      });

      // High importance should have longer TTL
      expect(highCorrelationTTL).toBeGreaterThan(lowCorrelationTTL);
    });
  });

  describe('Ebbinghaus Decay Integration', () => {
    it('should use correct half-life for different memory types', () => {
      const workingHalfLife = getHalfLifeForMemoryType('working');
      const episodicHalfLife = getHalfLifeForMemoryType('episodic');
      const semanticHalfLife = getHalfLifeForMemoryType('semantic');
      const proceduralHalfLife = getHalfLifeForMemoryType('procedural');
      const archivalHalfLife = getHalfLifeForMemoryType('archival');

      expect(workingHalfLife).toBe(0.5);
      expect(episodicHalfLife).toBe(7);
      expect(semanticHalfLife).toBe(30);
      expect(proceduralHalfLife).toBe(90);
      expect(archivalHalfLife).toBe(Infinity);
    });

    it('should apply decay consistently across components', () => {
      const score = 0.8;
      const ageInDays = 7;
      const halfLifeDays = 7;

      // Direct decay calculation
      const decayedScore = applyEbbinghausDecayToScore({
        score,
        ageInDays,
        halfLifeDays,
      });

      // Multiplier calculation
      const multiplier = calculateEbbinghausMultiplier({
        ageInDays,
        halfLifeDays,
      });

      // Verify consistency: decayedScore should be approximately score * multiplier
      const expectedDecayed = score * multiplier;
      expect(decayedScore).toBeCloseTo(expectedDecayed, 1);
    });

    it('should handle edge cases in decay calculation', () => {
      // Fresh memory (no decay)
      const freshDecay = applyEbbinghausDecayToScore({
        score: 0.8,
        ageInDays: 0,
        halfLifeDays: 7,
      });
      expect(freshDecay).toBeCloseTo(0.8, 1);

      // Very old memory (floor protection)
      const oldDecay = applyEbbinghausDecayToScore({
        score: 0.9,
        ageInDays: 365,
        halfLifeDays: 7,
      });
      expect(oldDecay).toBeGreaterThanOrEqual(0.9 * 0.1); // floorMultiplier
    });
  });

  describe('Cache Key Integration', () => {
    it('should generate consistent cache keys', () => {
      const key1 = calculateCacheKey({ type: 'semantic', memoryId: 'mem-001' });
      const key2 = calculateCacheKey({ type: 'semantic', memoryId: 'mem-001' });

      expect(key1).toBe(key2);
      expect(key1).toBe('agemem:semantic:mem-001');
    });

    it('should differentiate memory types in cache keys', () => {
      const workingKey = calculateCacheKey({ type: 'working', memoryId: 'mem-001' });
      const episodicKey = calculateCacheKey({ type: 'episodic', memoryId: 'mem-001' });
      const semanticKey = calculateCacheKey({ type: 'semantic', memoryId: 'mem-001' });

      expect(workingKey).toBe('agemem:working:mem-001');
      expect(episodicKey).toBe('agemem:episodic:mem-001');
      expect(semanticKey).toBe('agemem:semantic:mem-001');
    });
  });

  describe('Importance Scoring Integration', () => {
    it('should incorporate user signals with content analysis', async () => {
      const content = 'TypeScript interface definition for API response';

      // Without user signal
      const withoutUserSignal = await calculateImportance({
        content,
        type: 'semantic',
      });

      // With high user signal
      const withUserSignal = await calculateImportance({
        content,
        type: 'semantic',
        userProvidedImportance: 0.95,
      });

      // User signal should increase importance
      expect(withUserSignal.score).toBeGreaterThan(withoutUserSignal.score);
    });

    it('should weight different factors correctly', async () => {
      const actionableContent = 'TODO: Implement database migration script by Friday';
      const factualContent = 'The database server runs on port 5432';

      const actionableResult = await calculateImportance({
        content: actionableContent,
        type: 'episodic',
      });

      const factualResult = await calculateImportance({
        content: factualContent,
        type: 'semantic',
      });

      // Actionable content should have higher actionability score
      expect(actionableResult.contentAnalysis?.actionability ?? 0).toBeGreaterThan(
        factualResult.contentAnalysis?.actionability ?? 0
      );
    });
  });

  describe('End-to-End Memory Operations', () => {
    it('should handle complete memory workflow', async () => {
      // 1. Calculate importance
      const importance = await calculateImportance({
        content: 'Critical production deployment procedure',
        type: 'procedural',
        userProvidedImportance: 0.95,
      });

      // Score should be reasonable (between min and max bounds)
      expect(importance.score).toBeGreaterThan(0.5);
      expect(importance.score).toBeLessThanOrEqual(1.0);

      // 2. Add memory
      const memory = await memory_add({
        content: 'Critical production deployment procedure',
        type: 'procedural',
        importance: importance.score,
        tags: ['critical', 'production', 'deployment'],
      });

      expect(memory.success).toBe(true);

      // 3. Calculate TTL for caching
      const ttl = calculateTTL({
        importance: importance.score,
        type: 'procedural',
        accessCount: 0,
      });

      // Procedural memory with high importance should have long TTL
      expect(ttl).toBeGreaterThan(86400);

      // 4. Evaluate lifecycle (should maintain due to newness)
      const lifecycle = await evaluateMemoryLifecycle({
        memoryId: memory.id,
        type: 'procedural',
        importance: importance.score,
        ageInDays: 0,
        accessCount: 0,
      });

      expect(lifecycle.recommendedAction).toBe('maintain');
    });

    it('should handle batch operations', async () => {
      const memories = [
        {
          content: 'Memory 1: TypeScript basics',
          type: 'semantic' as const,
          importance: 0.7,
        },
        {
          content: 'Memory 2: Team standup notes',
          type: 'episodic' as const,
          importance: 0.4,
        },
        {
          content: 'Memory 3: Deployment script',
          type: 'procedural' as const,
          importance: 0.9,
        },
      ];

      // Add all memories
      const addedMemories = await Promise.all(
        memories.map(m => memory_add({
          content: m.content,
          type: m.type,
          importance: m.importance,
        }))
      );

      addedMemories.forEach(memory => {
        expect(memory.success).toBe(true);
      });

      // Calculate TTLs for all
      const ttls = memories.map(m =>
        calculateTTL({ importance: m.importance, type: m.type })
      );

      // Procedural should have highest TTL
      expect(ttls[2]).toBeGreaterThan(ttls[0]);
      expect(ttls[0]).toBeGreaterThan(ttls[1]);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid importance scores gracefully', async () => {
      const result = await memory_add({
        content: 'Test memory',
        type: 'episodic',
        importance: 1.5, // Invalid, should be clamped
      });

      expect(result.importance).toBe(1);
      expect(result.success).toBe(true);
    });

    it('should handle empty content', async () => {
      const result = await calculateImportance({
        content: '',
        type: 'episodic',
      });

      // Should return minimum importance
      expect(result.score).toBeGreaterThanOrEqual(0.1);
    });

    it('should handle missing optional parameters', async () => {
      const result = await memory_add({
        content: 'Minimal memory',
        type: 'working',
      });

      expect(result.success).toBe(true);
      expect(result.importance).toBe(0.5); // default
      expect(result.tags).toEqual([]); // default
    });
  });
});
