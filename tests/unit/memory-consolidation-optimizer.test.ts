/**
 * Unit tests for Memory Consolidation Optimizer module
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONSOLIDATION_CONFIG,
  cosineSimilarity,
  calculateContentSimilarity,
  areTemporallyProximate,
  findCommonTags,
  clusterMemories,
  calculateAverageClusterSimilarity,
  calculateTemporalSpan,
  calculateClusterCentroid,
  determineConsolidationAction,
  generateConsolidationSchedule,
  processConsolidationBatch,
  calculateConsolidationMetrics,
  optimizeConsolidation,
  type ConsolidationMemory,
  type ConsolidationAction,
} from '../../skills/memory-consolidation/memory-consolidation-optimizer';

describe('Memory Consolidation Optimizer', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      const similarity = cosineSimilarity(vec, vec);
      expect(similarity).toBe(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0);
    });

    it('should return -1 for opposite vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [-1, -2, -3];
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(-1);
    });

    it('should return 0 for empty vectors', () => {
      const similarity = cosineSimilarity([], []);
      expect(similarity).toBe(0);
    });

    it('should return 0 for mismatched vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2];
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0);
    });
  });

  describe('calculateContentSimilarity', () => {
    it('should return 1 for identical content', () => {
      const content = 'This is a test memory about TypeScript';
      const similarity = calculateContentSimilarity(content, content);
      expect(similarity).toBe(1);
    });

    it('should return high similarity for similar content', () => {
      const contentA = 'TypeScript is a strongly-typed programming language';
      const contentB = 'TypeScript is a typed programming language';
      const similarity = calculateContentSimilarity(contentA, contentB);
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should return low similarity for different content', () => {
      const contentA = 'TypeScript programming language';
      const contentB = 'Recipe for chocolate cake';
      const similarity = calculateContentSimilarity(contentA, contentB);
      expect(similarity).toBeLessThan(0.3);
    });

    it('should handle empty content', () => {
      const similarity = calculateContentSimilarity('', '');
      expect(similarity).toBe(0);
    });
  });

  describe('areTemporallyProximate', () => {
    it('should return true for dates within window', () => {
      const dateA = new Date('2026-04-01T12:00:00Z');
      const dateB = new Date('2026-04-03T12:00:00Z');
      const proximate = areTemporallyProximate(dateA, dateB, 7);
      expect(proximate).toBe(true);
    });

    it('should return false for dates outside window', () => {
      const dateA = new Date('2026-04-01T12:00:00Z');
      const dateB = new Date('2026-04-15T12:00:00Z');
      const proximate = areTemporallyProximate(dateA, dateB, 7);
      expect(proximate).toBe(false);
    });

    it('should handle same date', () => {
      const date = new Date('2026-04-01T12:00:00Z');
      const proximate = areTemporallyProximate(date, date, 7);
      expect(proximate).toBe(true);
    });
  });

  describe('findCommonTags', () => {
    it('should find tags common to majority of memories', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date(), tags: ['typescript', 'programming', 'code'] },
        { memoryId: '2', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date(), tags: ['typescript', 'programming', 'web'] },
        { memoryId: '3', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date(), tags: ['typescript', 'code', 'web'] },
      ];
      const commonTags = findCommonTags(memories);
      expect(commonTags).toContain('typescript');
      expect(commonTags).toContain('programming');
    });

    it('should return empty array for no common tags', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date(), tags: ['a', 'b'] },
        { memoryId: '2', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date(), tags: ['c', 'd'] },
      ];
      const commonTags = findCommonTags(memories);
      expect(commonTags.length).toBe(0);
    });

    it('should return empty array for memories without tags', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
        { memoryId: '2', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
      ];
      const commonTags = findCommonTags(memories);
      expect(commonTags.length).toBe(0);
    });
  });

  describe('clusterMemories', () => {
    it('should cluster similar memories together', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'TypeScript programming tutorial', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-01') },
        { memoryId: '2', content: 'TypeScript programming guide', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-02') },
        { memoryId: '3', content: 'TypeScript programming basics', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-03') },
        { memoryId: '4', content: 'Chocolate cake recipe', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-01') },
      ];

      const clusters = clusterMemories(memories, { ...DEFAULT_CONSOLIDATION_CONFIG, similarityThreshold: 0.3, minClusterSize: 2 });
      
      // TypeScript memories should cluster together (at least 1 cluster with multiple memories)
      const multiMemoryCluster = clusters.find(c => c.memories.length > 1);
      expect(multiMemoryCluster).toBeDefined();
      
      // TypeScript memories should be in same cluster
      const tsCluster = clusters.find(c => c.memories.some(m => m.memoryId === '1'));
      expect(tsCluster?.memories.some(m => m.memoryId === '2')).toBe(true);
    });

    it('should return empty for memories that do not meet clustering criteria', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'Unique content A', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
        { memoryId: '2', content: 'Unique content B', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
      ];

      const clusters = clusterMemories(memories, { ...DEFAULT_CONSOLIDATION_CONFIG, similarityThreshold: 0.99, minClusterSize: 2 });
      
      // Memories don't meet similarity threshold (0.99), so no clusters are formed
      // The function only returns successful clusters meeting minClusterSize
      expect(clusters.length).toBe(0);
    });

    it('should respect maxClusterSize', () => {
      const memories: ConsolidationMemory[] = Array.from({ length: 30 }, (_, i) => ({
        memoryId: `${i}`,
        content: 'Similar content about TypeScript programming',
        type: 'episodic' as const,
        importance: 0.8,
        ageInDays: 1,
        accessCount: 5,
        decayedScore: 0.7,
        createdAt: new Date('2026-04-01'),
      }));

      const clusters = clusterMemories(memories, { 
        ...DEFAULT_CONSOLIDATION_CONFIG, 
        similarityThreshold: 0.9,
        maxClusterSize: 10,
      });
      
      // No cluster should exceed max size
      clusters.forEach(c => expect(c.memories.length).toBeLessThanOrEqual(10));
    });

    it('should handle empty memory list', () => {
      const clusters = clusterMemories([]);
      expect(clusters.length).toBe(0);
    });
  });

  describe('calculateAverageClusterSimilarity', () => {
    it('should return 1.0 for single memory', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
      ];
      const similarity = calculateAverageClusterSimilarity(memories);
      expect(similarity).toBe(1.0);
    });

    it('should return high similarity for similar memories', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'TypeScript programming tutorial', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
        { memoryId: '2', content: 'TypeScript programming tutorial', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
      ];
      const similarity = calculateAverageClusterSimilarity(memories);
      expect(similarity).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('calculateTemporalSpan', () => {
    it('should return 0 for single memory', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-01') },
      ];
      const span = calculateTemporalSpan(memories);
      expect(span).toBe(0);
    });

    it('should calculate span between oldest and newest', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-01') },
        { memoryId: '2', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-08') },
      ];
      const span = calculateTemporalSpan(memories);
      expect(span).toBeCloseTo(7, 0);
    });
  });

  describe('calculateClusterCentroid', () => {
    it('should return undefined for memories without embeddings', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date() },
      ];
      const centroid = calculateClusterCentroid(memories);
      expect(centroid).toBeUndefined();
    });

    it('should calculate average of embeddings', () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date(), embedding: [1, 2, 3] },
        { memoryId: '2', content: 'test', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date(), embedding: [3, 4, 5] },
      ];
      const centroid = calculateClusterCentroid(memories);
      expect(centroid).toEqual([2, 3, 4]);
    });
  });

  describe('determineConsolidationAction', () => {
    const createMemory = (importance: number): ConsolidationMemory => ({
      memoryId: '1',
      content: 'test',
      type: 'episodic',
      importance,
      ageInDays: 1,
      accessCount: 5,
      decayedScore: 0.7,
      createdAt: new Date(),
    });

    it('should recommend merge for high similarity', () => {
      const action = determineConsolidationAction([createMemory(0.8)], 0.95);
      expect(action).toBe('merge');
    });

    it('should recommend summarize for medium-high similarity with multiple memories', () => {
      const action = determineConsolidationAction([createMemory(0.8), createMemory(0.8), createMemory(0.8)], 0.85);
      expect(action).toBe('summarize');
    });

    it('should recommend link for medium similarity', () => {
      const action = determineConsolidationAction([createMemory(0.8)], 0.75);
      expect(action).toBe('link');
    });

    it('should recommend review for low importance', () => {
      const action = determineConsolidationAction([createMemory(0.2)], 0.5);
      expect(action).toBe('review');
    });

    it('should recommend maintain for normal cases', () => {
      const action = determineConsolidationAction([createMemory(0.6)], 0.6);
      expect(action).toBe('maintain');
    });
  });

  describe('generateConsolidationSchedule', () => {
    it('should return empty schedule when autoSchedule is disabled', () => {
      const clusters = [{
        clusterId: 'cluster-1',
        memories: [] as ConsolidationMemory[],
        avgSimilarity: 0.9,
        temporalSpan: 0,
        commonTags: [],
        recommendedAction: 'merge' as ConsolidationAction,
      }];
      const schedule = generateConsolidationSchedule(clusters, { ...DEFAULT_CONSOLIDATION_CONFIG, autoScheduleEnabled: false });
      expect(schedule.length).toBe(0);
    });

    it('should skip maintain actions', () => {
      const clusters = [{
        clusterId: 'cluster-1',
        memories: [] as ConsolidationMemory[],
        avgSimilarity: 0.9,
        temporalSpan: 0,
        commonTags: [],
        recommendedAction: 'maintain' as ConsolidationAction,
      }];
      const schedule = generateConsolidationSchedule(clusters);
      expect(schedule.length).toBe(0);
    });

    it('should prioritize merge actions highest', () => {
      const clusters = [
        { clusterId: '1', memories: [] as ConsolidationMemory[], avgSimilarity: 0.9, temporalSpan: 0, commonTags: [], recommendedAction: 'link' as ConsolidationAction },
        { clusterId: '2', memories: [] as ConsolidationMemory[], avgSimilarity: 0.95, temporalSpan: 0, commonTags: [], recommendedAction: 'merge' as ConsolidationAction },
      ];
      const schedule = generateConsolidationSchedule(clusters);
      expect(schedule[0].action).toBe('merge');
    });

    it('should schedule based on priority order', () => {
      const clusters = [
        { clusterId: '1', memories: [] as ConsolidationMemory[], avgSimilarity: 0.9, temporalSpan: 0, commonTags: [], recommendedAction: 'review' as ConsolidationAction },
        { clusterId: '2', memories: [] as ConsolidationMemory[], avgSimilarity: 0.95, temporalSpan: 0, commonTags: [], recommendedAction: 'merge' as ConsolidationAction },
        { clusterId: '3', memories: [] as ConsolidationMemory[], avgSimilarity: 0.85, temporalSpan: 0, commonTags: [], recommendedAction: 'summarize' as ConsolidationAction },
      ];
      const schedule = generateConsolidationSchedule(clusters);
      expect(schedule.map(s => s.action)).toEqual(['merge', 'summarize', 'review']);
    });
  });

  describe('processConsolidationBatch', () => {
    it('should process all memories in batches', async () => {
      const memories: ConsolidationMemory[] = Array.from({ length: 250 }, (_, i) => ({
        memoryId: `${i}`,
        content: 'test',
        type: 'episodic' as const,
        importance: 0.8,
        ageInDays: 1,
        accessCount: 5,
        decayedScore: 0.7,
        createdAt: new Date(),
      }));

      const processedBatches: number[] = [];
      await processConsolidationBatch(
        memories,
        async (batch) => {
          processedBatches.push(batch.length);
        },
        { ...DEFAULT_CONSOLIDATION_CONFIG, batchSize: 100 }
      );

      expect(processedBatches).toEqual([100, 100, 50]);
    });

    it('should process all memories at once when disabled', async () => {
      const memories: ConsolidationMemory[] = Array.from({ length: 50 }, (_, i) => ({
        memoryId: `${i}`,
        content: 'test',
        type: 'episodic' as const,
        importance: 0.8,
        ageInDays: 1,
        accessCount: 5,
        decayedScore: 0.7,
        createdAt: new Date(),
      }));

      let batchCount = 0;
      await processConsolidationBatch(
        memories,
        async () => {
          batchCount++;
        },
        { ...DEFAULT_CONSOLIDATION_CONFIG, enabled: false }
      );

      expect(batchCount).toBe(1);
    });
  });

  describe('calculateConsolidationMetrics', () => {
    it('should calculate metrics correctly', () => {
      const memories: ConsolidationMemory[] = Array.from({ length: 100 }, (_, i) => ({
        memoryId: `${i}`,
        content: 'test',
        type: 'episodic' as const,
        importance: 0.8,
        ageInDays: 1,
        accessCount: 5,
        decayedScore: 0.7,
        createdAt: new Date(),
      }));

      const clusters = [
        { clusterId: '1', memories: memories.slice(0, 50), avgSimilarity: 0.9, temporalSpan: 0, commonTags: [], recommendedAction: 'merge' as ConsolidationAction },
        { clusterId: '2', memories: memories.slice(50), avgSimilarity: 0.5, temporalSpan: 0, commonTags: [], recommendedAction: 'maintain' as ConsolidationAction },
      ];

      const metrics = calculateConsolidationMetrics(memories, clusters, 100);

      expect(metrics.totalMemories).toBe(100);
      expect(metrics.clusterCount).toBe(2);
      expect(metrics.avgClusterSize).toBe(50);
      expect(metrics.consolidatedCount).toBe(50);
      expect(metrics.processingTimeMs).toBe(100);
      expect(metrics.efficiencyScore).toBeGreaterThan(0);
      expect(metrics.efficiencyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('optimizeConsolidation', () => {
    it('should return complete consolidation result', async () => {
      const memories: ConsolidationMemory[] = [
        { memoryId: '1', content: 'TypeScript programming tutorial', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-01') },
        { memoryId: '2', content: 'TypeScript programming guide', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-02') },
        { memoryId: '3', content: 'Chocolate cake recipe', type: 'episodic', importance: 0.8, ageInDays: 1, accessCount: 5, decayedScore: 0.7, createdAt: new Date('2026-04-01') },
      ];

      const result = await optimizeConsolidation(memories, { ...DEFAULT_CONSOLIDATION_CONFIG, minClusterSize: 1, similarityThreshold: 0.3 });

      expect(result.clusters.length).toBeGreaterThanOrEqual(1);
      expect(result.metrics.totalMemories).toBe(3);
      expect(result.metrics.clusterCount).toBe(result.clusters.length);
      expect(result.metrics.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty input', async () => {
      const result = await optimizeConsolidation([]);

      expect(result.clusters.length).toBe(0);
      expect(result.schedule.length).toBe(0);
      expect(result.metrics.totalMemories).toBe(0);
    });
  });
});
