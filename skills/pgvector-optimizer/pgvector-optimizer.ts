/**
 * ==============================================================================
 * PostgreSQL pgvector Query Optimizer Module
 * ==============================================================================
 * 
 * Optimizes PostgreSQL pgvector queries for AgeMem unified memory system:
 * - Vector index optimization recommendations
 * - Query plan analysis
 * - Similarity search performance tuning
 * - Batch query optimization
 * - Index strategy recommendations
 * 
 * @module pgvector-optimizer
 * @see {@link ../memory-consolidation/decay.ts} for Ebbinghaus decay integration
 */

/**
 * pgvector optimizer configuration
 */
export interface PgVectorOptimizerConfig {
  /** Enable optimization */
  enabled: boolean;
  /** Vector dimension size */
  vectorDimensions: number;
  /** Index method to use (ivfflat, hnsw) */
  indexMethod: 'ivfflat' | 'hnsw';
  /** IVF lists count for ivfflat */
  ivfLists: number;
  /** HNSW M parameter */
  hnswM: number;
  /** HNSW ef_construction parameter */
  hnswEfConstruction: number;
  /** Query probes for ivfflat */
  ivfProbes: number;
  /** HNSW ef_search parameter */
  hnswEfSearch: number;
  /** Batch size for bulk operations */
  batchSize: number;
  /** Enable query plan analysis */
  analyzeQueryPlans: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_PGVECTOR_CONFIG: PgVectorOptimizerConfig = {
  enabled: true,
  vectorDimensions: 768, // Common embedding size
  indexMethod: 'ivfflat',
  ivfLists: 100,
  hnswM: 16,
  hnswEfConstruction: 64,
  ivfProbes: 10,
  hnswEfSearch: 40,
  batchSize: 1000,
  analyzeQueryPlans: true,
};

/**
 * Vector index information
 */
export interface VectorIndexInfo {
  /** Index name */
  indexName: string;
  /** Index method */
  method: 'ivfflat' | 'hnsw' | 'none';
  /** Vector column name */
  columnName: string;
  /** Index size (bytes) */
  indexSize: number;
  /** Number of vectors indexed */
  vectorCount: number;
  /** Index creation time */
  createdAt?: Date;
  /** Last vacuum time */
  lastVacuumed?: Date;
  /** Index health status */
  health: 'healthy' | 'needs_reindex' | 'missing';
}

/**
 * Query plan analysis result
 */
export interface QueryPlanAnalysis {
  /** Query execution time (ms) */
  executionTimeMs: number;
  /** Query plan type */
  planType: 'IndexScan' | 'SeqScan' | 'IndexOnlyScan' | 'BitmapHeapScan';
  /** Estimated rows */
  estimatedRows: number;
  /** Actual rows returned */
  actualRows: number;
  /** Estimated cost */
  estimatedCost: number;
  /** Actual cost */
  actualCost: number;
  /** Index used (if any) */
  indexUsed?: string;
  /** Filter conditions */
  filters: string[];
  /** Optimization suggestions */
  suggestions: string[];
  /** Performance rating (0-10) */
  performanceRating: number;
}

/**
 * Index optimization recommendation
 */
export interface IndexRecommendation {
  /** Recommendation type */
  type: 'create_index' | 'reindex' | 'tune_params' | 'vacuum' | 'analyze';
  /** Priority (1-10) */
  priority: number;
  /** SQL command to execute */
  sqlCommand: string;
  /** Expected improvement */
  expectedImprovement: string;
  /** Estimated execution time (ms) */
  estimatedTimeMs: number;
  /** Reason for recommendation */
  reason: string;
}

/**
 * Batch query optimization result
 */
export interface BatchQueryResult<T> {
  /** Total queries processed */
  totalQueries: number;
  /** Successful queries */
  successful: number;
  /** Failed queries */
  failed: number;
  /** Total execution time (ms) */
  totalTimeMs: number;
  /** Average time per query (ms) */
  avgTimePerQuery: number;
  /** Results array */
  results: T[];
  /** Errors encountered */
  errors: Array<{ queryIndex: number; error: string }>;
}

/**
 * Similarity search parameters
 */
export interface SimilaritySearchParams {
  /** Query vector */
  queryVector: number[];
  /** Number of results to return */
  limit: number;
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Filter by memory type */
  memoryType?: string;
  /** Filter by tags */
  tags?: string[];
  /** Include decay calculation */
  includeDecay?: boolean;
  /** Decay half-life days */
  halfLifeDays?: number;
}

/**
 * Similarity search result
 */
export interface SimilaritySearchResult {
  /** Memory ID */
  memoryId: string;
  /** Similarity score (0-1) */
  similarity: number;
  /** Decayed score (if includeDecay=true) */
  decayedScore?: number;
  /** Memory content */
  content: string;
  /** Memory type */
  memoryType: string;
  /** Original importance */
  importance: number;
  /** Access count */
  accessCount: number;
  /** Age in days */
  ageInDays: number;
}

/**
 * Calculate optimal IVF lists count based on dataset size
 * Rule of thumb: sqrt(N) where N is number of vectors
 */
export function calculateOptimalIvfLists(vectorCount: number): number {
  if (vectorCount <= 0) return 100;
  return Math.max(100, Math.min(10000, Math.round(Math.sqrt(vectorCount))));
}

/**
 * Calculate optimal HNSW M parameter based on vector dimensions
 * Higher dimensions benefit from higher M values
 */
export function calculateOptimalHnswM(dimensions: number): number {
  if (dimensions <= 128) return 16;
  if (dimensions <= 512) return 24;
  if (dimensions <= 1024) return 32;
  return 48;
}

/**
 * Generate CREATE INDEX statement for pgvector
 */
export function generateCreateIndexStatement(
  tableName: string,
  columnName: string,
  config: PgVectorOptimizerConfig = DEFAULT_PGVECTOR_CONFIG
): string {
  if (config.indexMethod === 'hnsw') {
    return `
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  ${tableName}_${columnName}_hnsw_idx 
ON ${tableName} 
USING hnsw (${columnName} vector_cosine_ops) 
WITH (m = ${config.hnswM}, ef_construction = ${config.hnswEfConstruction});
`.trim();
  }
  
  // IVFFlat
  return `
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  ${tableName}_${columnName}_ivfflat_idx 
ON ${tableName} 
USING ivfflat (${columnName} vector_cosine_ops) 
WITH (lists = ${config.ivfLists});
`.trim();
}

/**
 * Generate optimized similarity search query
 */
export function generateSimilarityQuery(
  tableName: string,
  columnName: string,
  params: SimilaritySearchParams,
  config: PgVectorOptimizerConfig = DEFAULT_PGVECTOR_CONFIG
): { sql: string; params: unknown[] } {
  const vectorLiteral = `[${params.queryVector.join(',')}]`;
  const sqlParams: unknown[] = [];
  let paramIndex = 1;
  
  // Build base query with cosine similarity
  let sql = `
SELECT
  id,
  content,
  memory_type,
  importance_score,
  access_count,
  created_at,
  1 - (${columnName} <=> $${paramIndex}::vector) as similarity
FROM ${tableName}
WHERE is_deleted = false
  AND is_archived = false
`.trim();

  sqlParams.push(vectorLiteral);
  paramIndex++;

  // Add memory type filter
  if (params.memoryType) {
    sql += ` AND memory_type = $${paramIndex}`;
    sqlParams.push(params.memoryType);
    paramIndex++;
  }

  // Add tags filter
  if (params.tags && params.tags.length > 0) {
    sql += ` AND tags && $${paramIndex}`;
    sqlParams.push(params.tags);
    paramIndex++;
  }

  // Add similarity threshold
  if (params.threshold !== undefined) {
    sql += ` AND (1 - (${columnName} <=> $${paramIndex}::vector)) >= $${paramIndex + 1}`;
    sqlParams.push(vectorLiteral, params.threshold);
    paramIndex += 2;
  }

  // Add decay calculation if requested
  if (params.includeDecay && params.halfLifeDays) {
    const halfLifeDays = params.halfLifeDays;
    sql += `
    , (importance_score * 
        EXP(-LN(2) / ${halfLifeDays} * EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0) *
        (1 + LOG(access_count + 1) * 0.5)
      ) as decayed_score
`;
  }

  // Add ordering and limit
  sql += `
ORDER BY ${columnName} <=> $${paramIndex}::vector
LIMIT $${paramIndex + 1}
`;
  sqlParams.push(vectorLiteral, params.limit);

  return { sql, params: sqlParams };
}

/**
 * Analyze query plan and provide optimization suggestions
 */
export function analyzeQueryPlan(plan: QueryPlanAnalysis): QueryPlanAnalysis {
  const suggestions: string[] = [];
  
  // Check for sequential scan on vector column
  if (plan.planType === 'SeqScan') {
    suggestions.push('Consider creating a vector index to avoid sequential scan');
    suggestions.push('Current query may be slow for large datasets');
  }
  
  // Check for index not being used
  if (!plan.indexUsed && plan.planType !== 'SeqScan') {
    suggestions.push('Index exists but not being used - check query conditions');
  }
  
  // Check row estimation accuracy
  const estimationAccuracy = plan.estimatedRows > 0 
    ? plan.actualRows / plan.estimatedRows 
    : 1;
  if (estimationAccuracy < 0.5 || estimationAccuracy > 2) {
    suggestions.push('Run ANALYZE to update table statistics');
  }
  
  // Check cost efficiency
  const costEfficiency = plan.estimatedCost > 0 
    ? plan.actualCost / plan.estimatedCost 
    : 1;
  if (costEfficiency > 2) {
    suggestions.push('Actual cost significantly higher than estimated - consider query optimization');
  }
  
  // Calculate performance rating
  let rating = 10;
  if (plan.planType === 'SeqScan') rating -= 4;
  if (!plan.indexUsed) rating -= 2;
  if (estimationAccuracy < 0.5 || estimationAccuracy > 2) rating -= 1;
  if (costEfficiency > 2) rating -= 1;
  if (plan.executionTimeMs > 100) rating -= 1;
  if (plan.executionTimeMs > 500) rating -= 1;
  
  return {
    ...plan,
    suggestions,
    performanceRating: Math.max(1, rating),
  };
}

/**
 * Generate index optimization recommendations
 */
export function generateIndexRecommendations(
  indexInfo: VectorIndexInfo,
  config: PgVectorOptimizerConfig = DEFAULT_PGVECTOR_CONFIG
): IndexRecommendation[] {
  const recommendations: IndexRecommendation[] = [];
  
  // Missing index
  if (indexInfo.health === 'missing') {
    recommendations.push({
      type: 'create_index',
      priority: 10,
      sqlCommand: generateCreateIndexStatement('memories', indexInfo.columnName, config),
      expectedImprovement: 'Query speedup from O(n) to O(log n)',
      estimatedTimeMs: indexInfo.vectorCount * 0.1, // ~0.1ms per vector
      reason: 'No vector index exists - queries using sequential scan',
    });
    return recommendations;
  }
  
  // Needs reindex
  if (indexInfo.health === 'needs_reindex') {
    recommendations.push({
      type: 'reindex',
      priority: 8,
      sqlCommand: `REINDEX INDEX CONCURRENTLY ${indexInfo.indexName};`,
      expectedImprovement: 'Restore index performance',
      estimatedTimeMs: indexInfo.indexSize / 1000000, // ~1ms per MB
      reason: 'Index fragmentation detected',
    });
  }
  
  // IVF lists tuning
  if (config.indexMethod === 'ivfflat') {
    const optimalLists = calculateOptimalIvfLists(indexInfo.vectorCount);
    if (Math.abs(optimalLists - config.ivfLists) / config.ivfLists > 0.5) {
      recommendations.push({
        type: 'tune_params',
        priority: 6,
        sqlCommand: `ALTER INDEX ${indexInfo.indexName} SET (lists = ${optimalLists});`,
        expectedImprovement: `Optimize for ${indexInfo.vectorCount} vectors`,
        estimatedTimeMs: 100,
        reason: `IVF lists (${config.ivfLists}) not optimal for ${indexInfo.vectorCount} vectors. Recommend ${optimalLists}.`,
      });
    }
  }
  
  // Vacuum recommendation
  if (indexInfo.lastVacuumed) {
    const daysSinceVacuum = (Date.now() - indexInfo.lastVacuumed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVacuum > 7) {
      recommendations.push({
        type: 'vacuum',
        priority: 5,
        sqlCommand: `VACUUM ANALYZE ${indexInfo.indexName};`,
        expectedImprovement: 'Update index statistics',
        estimatedTimeMs: indexInfo.indexSize / 1000000,
        reason: `Index not vacuumed in ${Math.round(daysSinceVacuum)} days`,
      });
    }
  }
  
  return recommendations.sort((a, b) => b.priority - a.priority);
}

/**
 * Process batch similarity searches efficiently
 */
export async function batchSimilaritySearch(
  queries: SimilaritySearchParams[],
  executor: (sql: string, params: unknown[]) => Promise<SimilaritySearchResult[]>,
  config: PgVectorOptimizerConfig = DEFAULT_PGVECTOR_CONFIG
): Promise<BatchQueryResult<SimilaritySearchResult>> {
  const results: SimilaritySearchResult[] = [];
  const errors: Array<{ queryIndex: number; error: string }> = [];
  const startTime = Date.now();
  
  // Process in batches
  for (let i = 0; i < queries.length; i += config.batchSize) {
    const batch = queries.slice(i, i + config.batchSize);
    
    try {
      // Execute batch queries
      for (const query of batch) {
        const { sql, params } = generateSimilarityQuery('memories', 'embedding', query, config);
        const queryResults = await executor(sql, params);
        results.push(...queryResults);
      }
    } catch (error) {
      errors.push({
        queryIndex: i,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  const totalTimeMs = Date.now() - startTime;
  
  return {
    totalQueries: queries.length,
    successful: queries.length - errors.length,
    failed: errors.length,
    totalTimeMs,
    avgTimePerQuery: totalTimeMs / queries.length,
    results,
    errors,
  };
}

/**
 * Get pgvector extension version and capabilities
 */
export interface PgVectorCapabilities {
  /** pgvector version */
  version: string;
  /** Supported distance functions */
  distanceFunctions: string[];
  /** Supported index types */
  indexTypes: string[];
  /** Max supported dimensions */
  maxDimensions: number;
  /** HNSW support */
  hnswSupport: boolean;
}

export function detectPgVectorCapabilities(): PgVectorCapabilities {
  // Note: In production, this would query the database
  // For now, return typical capabilities
  return {
    version: '0.6.0',
    distanceFunctions: ['cosine', 'euclidean', 'dot_product'],
    indexTypes: ['ivfflat', 'hnsw'],
    maxDimensions: 2000,
    hnswSupport: true,
  };
}

/**
 * Main optimization function - comprehensive pgvector analysis
 */
export interface PgVectorOptimizationResult {
  /** Index information */
  indexInfo: VectorIndexInfo;
  /** Query plan analysis */
  queryAnalysis?: QueryPlanAnalysis;
  /** Optimization recommendations */
  recommendations: IndexRecommendation[];
  /** pgvector capabilities */
  capabilities: PgVectorCapabilities;
  /** Optimization summary */
  summary: {
    /** Current performance score (0-10) */
    currentScore: number;
    /** Potential score after optimizations */
    potentialScore: number;
    /** Estimated improvement percentage */
    improvementPercent: number;
  };
}

export async function optimizePgVector(
  indexInfo: VectorIndexInfo,
  config: PgVectorOptimizerConfig = DEFAULT_PGVECTOR_CONFIG
): Promise<PgVectorOptimizationResult> {
  const capabilities = detectPgVectorCapabilities();
  const recommendations = generateIndexRecommendations(indexInfo, config);
  
  // Calculate current score
  let currentScore = 5;
  if (indexInfo.health === 'healthy') currentScore += 3;
  if (indexInfo.method !== 'none') currentScore += 2;
  
  // Calculate potential score
  const potentialScore = Math.min(10, currentScore + recommendations.length);
  
  // Calculate improvement
  const improvementPercent = currentScore > 0
    ? ((potentialScore - currentScore) / currentScore) * 100
    : 100;
  
  return {
    indexInfo,
    recommendations,
    capabilities,
    summary: {
      currentScore,
      potentialScore,
      improvementPercent,
    },
  };
}
