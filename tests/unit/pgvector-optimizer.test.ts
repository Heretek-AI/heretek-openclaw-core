/**
 * Unit tests for pgvector Query Optimizer module
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PGVECTOR_CONFIG,
  calculateOptimalIvfLists,
  calculateOptimalHnswM,
  generateCreateIndexStatement,
  generateSimilarityQuery,
  analyzeQueryPlan,
  generateIndexRecommendations,
  detectPgVectorCapabilities,
  optimizePgVector,
  type PgVectorOptimizerConfig,
  type VectorIndexInfo,
  type QueryPlanAnalysis,
  type SimilaritySearchParams,
} from '../../skills/pgvector-optimizer/pgvector-optimizer';

describe('pgvector Query Optimizer', () => {
  describe('calculateOptimalIvfLists', () => {
    it('should return minimum for small datasets', () => {
      expect(calculateOptimalIvfLists(0)).toBe(100);
      expect(calculateOptimalIvfLists(100)).toBe(100);
    });

    it('should calculate sqrt(N) for medium datasets', () => {
      expect(calculateOptimalIvfLists(10000)).toBe(100);
      expect(calculateOptimalIvfLists(1000000)).toBe(1000);
    });

    it('should cap at maximum for large datasets', () => {
      expect(calculateOptimalIvfLists(100000000)).toBe(10000);
    });
  });

  describe('calculateOptimalHnswM', () => {
    it('should return 16 for small dimensions', () => {
      expect(calculateOptimalHnswM(64)).toBe(16);
      expect(calculateOptimalHnswM(128)).toBe(16);
    });

    it('should return 24 for medium dimensions', () => {
      expect(calculateOptimalHnswM(256)).toBe(24);
      expect(calculateOptimalHnswM(512)).toBe(24);
    });

    it('should return 32 for large dimensions', () => {
      expect(calculateOptimalHnswM(768)).toBe(32);
      expect(calculateOptimalHnswM(1024)).toBe(32);
    });

    it('should return 48 for very large dimensions', () => {
      expect(calculateOptimalHnswM(1536)).toBe(48);
      expect(calculateOptimalHnswM(2048)).toBe(48);
    });
  });

  describe('generateCreateIndexStatement', () => {
    it('should generate IVFFlat index statement', () => {
      const config: PgVectorOptimizerConfig = {
        ...DEFAULT_PGVECTOR_CONFIG,
        indexMethod: 'ivfflat',
        ivfLists: 500,
      };
      const sql = generateCreateIndexStatement('memories', 'embedding', config);
      expect(sql).toContain('USING ivfflat');
      expect(sql).toContain('(lists = 500)');
      expect(sql).toContain('memories_embedding_ivfflat_idx');
    });

    it('should generate HNSW index statement', () => {
      const config: PgVectorOptimizerConfig = {
        ...DEFAULT_PGVECTOR_CONFIG,
        indexMethod: 'hnsw',
        hnswM: 32,
        hnswEfConstruction: 128,
      };
      const sql = generateCreateIndexStatement('memories', 'embedding', config);
      expect(sql).toContain('USING hnsw');
      expect(sql).toContain('(m = 32, ef_construction = 128)');
      expect(sql).toContain('memories_embedding_hnsw_idx');
    });

    it('should use CONCURRENTLY for non-blocking creation', () => {
      const sql = generateCreateIndexStatement('memories', 'embedding');
      expect(sql).toContain('CONCURRENTLY');
    });
  });

  describe('generateSimilarityQuery', () => {
    it('should generate basic similarity query', () => {
      const params: SimilaritySearchParams = {
        queryVector: [0.1, 0.2, 0.3],
        limit: 10,
      };
      const { sql, params: sqlParams } = generateSimilarityQuery('memories', 'embedding', params);
      
      expect(sql).toContain('SELECT');
      expect(sql).toContain('similarity');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('LIMIT');
      expect(sqlParams.length).toBe(3); // vector (select) + vector (order) + limit
    });

    it('should add memory type filter', () => {
      const params: SimilaritySearchParams = {
        queryVector: [0.1, 0.2, 0.3],
        limit: 10,
        memoryType: 'semantic',
      };
      const { sql, params: sqlParams } = generateSimilarityQuery('memories', 'embedding', params);
      
      expect(sql).toContain('memory_type =');
      expect(sqlParams.length).toBe(4); // vector (select) + type + vector (order) + limit
    });

    it('should add tags filter', () => {
      const params: SimilaritySearchParams = {
        queryVector: [0.1, 0.2, 0.3],
        limit: 10,
        tags: ['typescript', 'programming'],
      };
      const { sql, params: sqlParams } = generateSimilarityQuery('memories', 'embedding', params);
      
      expect(sql).toContain('tags &&');
      expect(sqlParams.length).toBe(4); // vector (select) + tags + vector (order) + limit
    });

    it('should add similarity threshold', () => {
      const params: SimilaritySearchParams = {
        queryVector: [0.1, 0.2, 0.3],
        limit: 10,
        threshold: 0.8,
      };
      const { sql, params: sqlParams } = generateSimilarityQuery('memories', 'embedding', params);
      
      expect(sql).toContain('>=');
      expect(sqlParams.length).toBe(5); // vector (select) + vector (threshold) + threshold + vector (order) + limit
    });

    it('should include decay calculation', () => {
      const params: SimilaritySearchParams = {
        queryVector: [0.1, 0.2, 0.3],
        limit: 10,
        includeDecay: true,
        halfLifeDays: 7,
      };
      const { sql } = generateSimilarityQuery('memories', 'embedding', params);
      
      expect(sql).toContain('decayed_score');
      expect(sql).toContain('EXP');
      expect(sql).toContain('LN(2)');
    });
  });

  describe('analyzeQueryPlan', () => {
    it('should analyze efficient query', () => {
      const plan: QueryPlanAnalysis = {
        executionTimeMs: 5,
        planType: 'IndexScan',
        estimatedRows: 100,
        actualRows: 95,
        estimatedCost: 50,
        actualCost: 48,
        indexUsed: 'memories_embedding_idx',
        filters: [],
        suggestions: [],
        performanceRating: 0,
      };
      
      const result = analyzeQueryPlan(plan);
      expect(result.performanceRating).toBeGreaterThanOrEqual(8);
      expect(result.suggestions.length).toBe(0);
    });

    it('should detect sequential scan issue', () => {
      const plan: QueryPlanAnalysis = {
        executionTimeMs: 500,
        planType: 'SeqScan',
        estimatedRows: 1000,
        actualRows: 1000,
        estimatedCost: 1000,
        actualCost: 1200,
        filters: [],
        suggestions: [],
        performanceRating: 0,
      };
      
      const result = analyzeQueryPlan(plan);
      expect(result.performanceRating).toBeLessThanOrEqual(4);
      expect(result.suggestions.some(s => s.includes('index'))).toBe(true);
    });

    it('should detect estimation accuracy issues', () => {
      const plan: QueryPlanAnalysis = {
        executionTimeMs: 50,
        planType: 'IndexScan',
        estimatedRows: 100,
        actualRows: 500,
        estimatedCost: 50,
        actualCost: 60,
        indexUsed: 'memories_embedding_idx',
        filters: [],
        suggestions: [],
        performanceRating: 0,
      };
      
      const result = analyzeQueryPlan(plan);
      expect(result.suggestions.some(s => s.includes('ANALYZE'))).toBe(true);
    });
  });

  describe('generateIndexRecommendations', () => {
    it('should recommend creating missing index', () => {
      const indexInfo: VectorIndexInfo = {
        indexName: '',
        method: 'none',
        columnName: 'embedding',
        indexSize: 0,
        vectorCount: 10000,
        health: 'missing',
      };
      
      const recommendations = generateIndexRecommendations(indexInfo);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].type).toBe('create_index');
      expect(recommendations[0].priority).toBe(10);
    });

    it('should recommend reindex for unhealthy index', () => {
      const indexInfo: VectorIndexInfo = {
        indexName: 'memories_embedding_idx',
        method: 'ivfflat',
        columnName: 'embedding',
        indexSize: 1000000,
        vectorCount: 10000,
        health: 'needs_reindex',
        createdAt: new Date(),
        lastVacuumed: new Date(),
      };
      
      const recommendations = generateIndexRecommendations(indexInfo);
      expect(recommendations.some(r => r.type === 'reindex')).toBe(true);
    });

    it('should recommend IVF tuning for suboptimal lists', () => {
      const indexInfo: VectorIndexInfo = {
        indexName: 'memories_embedding_idx',
        method: 'ivfflat',
        columnName: 'embedding',
        indexSize: 1000000,
        vectorCount: 1000000, // sqrt = 1000
        health: 'healthy',
        createdAt: new Date(),
        lastVacuumed: new Date(),
      };
      
      const config: PgVectorOptimizerConfig = {
        ...DEFAULT_PGVECTOR_CONFIG,
        indexMethod: 'ivfflat',
        ivfLists: 100, // Way too low for 1M vectors
      };
      
      const recommendations = generateIndexRecommendations(indexInfo, config);
      expect(recommendations.some(r => r.type === 'tune_params')).toBe(true);
    });

    it('should recommend vacuum for stale index', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 14);
      
      const indexInfo: VectorIndexInfo = {
        indexName: 'memories_embedding_idx',
        method: 'ivfflat',
        columnName: 'embedding',
        indexSize: 1000000,
        vectorCount: 10000,
        health: 'healthy',
        createdAt: new Date(),
        lastVacuumed: oldDate,
      };
      
      const recommendations = generateIndexRecommendations(indexInfo);
      expect(recommendations.some(r => r.type === 'vacuum')).toBe(true);
    });
  });

  describe('detectPgVectorCapabilities', () => {
    it('should return pgvector capabilities', () => {
      const capabilities = detectPgVectorCapabilities();
      
      expect(capabilities.version).toBeDefined();
      expect(capabilities.distanceFunctions).toContain('cosine');
      expect(capabilities.indexTypes).toContain('ivfflat');
      expect(capabilities.maxDimensions).toBeGreaterThan(0);
      expect(capabilities.hnswSupport).toBe(true);
    });
  });

  describe('optimizePgVector', () => {
    it('should return comprehensive optimization result', async () => {
      const indexInfo: VectorIndexInfo = {
        indexName: 'memories_embedding_idx',
        method: 'ivfflat',
        columnName: 'embedding',
        indexSize: 1000000,
        vectorCount: 10000,
        health: 'healthy',
        createdAt: new Date(),
        lastVacuumed: new Date(),
      };
      
      const result = await optimizePgVector(indexInfo);
      
      expect(result.indexInfo).toEqual(indexInfo);
      expect(result.capabilities).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.summary.currentScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.currentScore).toBeLessThanOrEqual(10);
      expect(result.summary.potentialScore).toBeGreaterThanOrEqual(result.summary.currentScore);
    });

    it('should score missing index lower', async () => {
      const indexInfo: VectorIndexInfo = {
        indexName: '',
        method: 'none',
        columnName: 'embedding',
        indexSize: 0,
        vectorCount: 10000,
        health: 'missing',
      };
      
      const result = await optimizePgVector(indexInfo);
      
      expect(result.summary.currentScore).toBeLessThan(8);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should score healthy index higher', async () => {
      const indexInfo: VectorIndexInfo = {
        indexName: 'memories_embedding_idx',
        method: 'hnsw',
        columnName: 'embedding',
        indexSize: 1000000,
        vectorCount: 10000,
        health: 'healthy',
        createdAt: new Date(),
        lastVacuumed: new Date(),
      };
      
      const result = await optimizePgVector(indexInfo);
      
      expect(result.summary.currentScore).toBeGreaterThanOrEqual(7);
    });
  });
});
