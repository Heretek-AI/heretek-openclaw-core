/**
 * ==============================================================================
 * Memory Consolidation Optimizer Module
 * ==============================================================================
 * 
 * Optimizes memory consolidation operations for AgeMem unified memory system:
 * - Batch consolidation processing
 * - Memory clustering by similarity and temporal proximity
 * - Consolidation scheduling based on access patterns
 * - Optimization metrics and reporting
 * 
 * @module memory-consolidation-optimizer
 * @see {@link ./decay.ts} for Ebbinghaus decay integration
 * @see {@link ./archivist.ts} for lifecycle management
 */

import type { MemoryType } from '../archivist/archivist';
import type { EbbinghausConfig } from './decay';

/**
 * Memory consolidation configuration
 */
export interface ConsolidationOptimizerConfig {
  /** Enable consolidation optimization */
  enabled: boolean;
  /** Minimum memories per cluster */
  minClusterSize: number;
  /** Maximum memories per cluster */
  maxClusterSize: number;
  /** Similarity threshold for clustering (0-1) */
  similarityThreshold: number;
  /** Temporal proximity window (days) */
  temporalWindowDays: number;
  /** Batch processing chunk size */
  batchSize: number;
  /** Enable automatic consolidation scheduling */
  autoScheduleEnabled: boolean;
  /** Consolidation interval (hours) */
  consolidationIntervalHours: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationOptimizerConfig = {
  enabled: true,
  minClusterSize: 2,
  maxClusterSize: 20,
  similarityThreshold: 0.7,
  temporalWindowDays: 7,
  batchSize: 100,
  autoScheduleEnabled: true,
  consolidationIntervalHours: 24,
};

/**
 * Memory item for consolidation
 */
export interface ConsolidationMemory {
  /** Memory identifier */
  memoryId: string;
  /** Memory content */
  content: string;
  /** Memory type */
  type: MemoryType;
  /** Importance score */
  importance: number;
  /** Age in days */
  ageInDays: number;
  /** Access count */
  accessCount: number;
  /** Decayed score */
  decayedScore: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Tags associated with memory */
  tags?: string[];
  /** Embedding vector for similarity comparison */
  embedding?: number[];
}

/**
 * Memory cluster result
 */
export interface MemoryCluster {
  /** Cluster identifier */
  clusterId: string;
  /** Member memories */
  memories: ConsolidationMemory[];
  /** Cluster centroid (average embedding) */
  centroid?: number[];
  /** Average similarity within cluster */
  avgSimilarity: number;
  /** Temporal span (days between oldest and newest) */
  temporalSpan: number;
  /** Common tags */
  commonTags: string[];
  /** Recommended consolidation action */
  recommendedAction: ConsolidationAction;
}

/**
 * Consolidation action types
 */
export type ConsolidationAction = 
  | 'merge'           // Merge similar memories
  | 'summarize'       // Create summary of cluster
  | 'link'            // Create links between memories
  | 'maintain'        // No action needed
  | 'review';         // Human review recommended

/**
 * Consolidation schedule entry
 */
export interface ConsolidationSchedule {
  /** Schedule identifier */
  scheduleId: string;
  /** Cluster to consolidate */
  clusterId: string;
  /** Scheduled time */
  scheduledTime: Date;
  /** Priority (1-10) */
  priority: number;
  /** Estimated processing time (ms) */
  estimatedTimeMs: number;
  /** Consolidation action */
  action: ConsolidationAction;
  /** Status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Optimization metrics
 */
export interface ConsolidationMetrics {
  /** Total memories processed */
  totalMemories: number;
  /** Number of clusters formed */
  clusterCount: number;
  /** Average cluster size */
  avgClusterSize: number;
  /** Memories consolidated */
  consolidatedCount: number;
  /** Storage savings (bytes) */
  storageSavings: number;
  /** Processing time (ms) */
  processingTimeMs: number;
  /** Efficiency score (0-1) */
  efficiencyScore: number;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Calculate content-based similarity using simple text features
 */
export function calculateContentSimilarity(contentA: string, contentB: string): number {
  // Extract words (simple tokenization)
  const wordsA = contentA.toLowerCase().match(/\w+/g) || [];
  const wordsB = contentB.toLowerCase().match(/\w+/g) || [];
  
  // Create word sets
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  
  // Calculate Jaccard similarity
  const intersection = new Set([...setA].filter(word => setB.has(word)));
  const union = new Set([...setA, ...setB]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Check if two memories are temporally proximate
 */
export function areTemporallyProximate(
  dateA: Date,
  dateB: Date,
  windowDays: number
): boolean {
  const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= windowDays;
}

/**
 * Find common tags between memories
 */
export function findCommonTags(memories: ConsolidationMemory[]): string[] {
  if (memories.length === 0) return [];
  
  const tagCounts = new Map<string, number>();
  memories.forEach(memory => {
    memory.tags?.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  // Return tags that appear in at least 50% of memories (strict majority for 2 memories)
  const minCount = memories.length === 2 ? 2 : Math.ceil(memories.length / 2);
  return Array.from(tagCounts.entries())
    .filter(([_, count]) => count >= minCount)
    .map(([tag]) => tag);
}

/**
 * Cluster memories by similarity and temporal proximity
 */
export function clusterMemories(
  memories: ConsolidationMemory[],
  config: ConsolidationOptimizerConfig = DEFAULT_CONSOLIDATION_CONFIG
): MemoryCluster[] {
  if (!config.enabled || memories.length < config.minClusterSize) {
    return memories.map(m => ({
      clusterId: `cluster-${m.memoryId}`,
      memories: [m],
      avgSimilarity: 1.0,
      temporalSpan: 0,
      commonTags: m.tags || [],
      recommendedAction: 'maintain' as ConsolidationAction,
    }));
  }
  
  const clusters: MemoryCluster[] = [];
  const assigned = new Set<string>();
  
  // Sort by importance (process high-importance memories first)
  const sorted = [...memories].sort((a, b) => b.importance - a.importance);
  
  for (const seed of sorted) {
    if (assigned.has(seed.memoryId)) continue;
    
    // Start new cluster with seed
    const clusterMembers: ConsolidationMemory[] = [seed];
    assigned.add(seed.memoryId);
    
    // Find similar memories
    for (const candidate of sorted) {
      if (assigned.has(candidate.memoryId)) continue;
      if (clusterMembers.length >= config.maxClusterSize) break;
      
      // Check temporal proximity
      if (!areTemporallyProximate(
        seed.createdAt,
        candidate.createdAt,
        config.temporalWindowDays
      )) continue;
      
      // Check content similarity
      let similarity = 0;
      if (seed.embedding && candidate.embedding) {
        similarity = cosineSimilarity(seed.embedding, candidate.embedding);
      } else {
        similarity = calculateContentSimilarity(seed.content, candidate.content);
      }
      
      if (similarity >= config.similarityThreshold) {
        clusterMembers.push(candidate);
        assigned.add(candidate.memoryId);
      }
    }
    
    // Only create cluster if it meets minimum size
    if (clusterMembers.length >= config.minClusterSize) {
      // Calculate cluster metrics
      const avgSimilarity = calculateAverageClusterSimilarity(clusterMembers);
      const temporalSpan = calculateTemporalSpan(clusterMembers);
      const commonTags = findCommonTags(clusterMembers);
      const centroid = calculateClusterCentroid(clusterMembers);
      const recommendedAction = determineConsolidationAction(clusterMembers, avgSimilarity);
      
      clusters.push({
        clusterId: `cluster-${clusters.length}`,
        memories: clusterMembers,
        centroid,
        avgSimilarity,
        temporalSpan,
        commonTags,
        recommendedAction,
      });
    }
  }
  
  // Add remaining unclustered memories as singletons
  for (const memory of memories) {
    if (!assigned.has(memory.memoryId)) {
      clusters.push({
        clusterId: `cluster-${memory.memoryId}`,
        memories: [memory],
        avgSimilarity: 1.0,
        temporalSpan: 0,
        commonTags: memory.tags || [],
        recommendedAction: 'maintain',
      });
    }
  }
  
  return clusters;
}

/**
 * Calculate average similarity within a cluster
 */
export function calculateAverageClusterSimilarity(memories: ConsolidationMemory[]): number {
  if (memories.length < 2) return 1.0;
  
  let totalSimilarity = 0;
  let pairCount = 0;
  
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      let similarity = 0;
      const embeddingA = memories[i].embedding;
      const embeddingB = memories[j].embedding;
      if (embeddingA && embeddingB) {
        similarity = cosineSimilarity(embeddingA, embeddingB);
      } else {
        similarity = calculateContentSimilarity(memories[i].content, memories[j].content);
      }
      totalSimilarity += similarity;
      pairCount++;
    }
  }
  
  return pairCount > 0 ? totalSimilarity / pairCount : 1.0;
}

/**
 * Calculate temporal span of cluster (days between oldest and newest)
 */
export function calculateTemporalSpan(memories: ConsolidationMemory[]): number {
  if (memories.length < 2) return 0;
  
  const timestamps = memories.map(m => m.createdAt.getTime());
  const oldest = Math.min(...timestamps);
  const newest = Math.max(...timestamps);
  
  return (newest - oldest) / (1000 * 60 * 60 * 24);
}

/**
 * Calculate cluster centroid (average embedding)
 */
export function calculateClusterCentroid(memories: ConsolidationMemory[]): number[] | undefined {
  const embeddings = memories.map(m => m.embedding).filter((e): e is number[] => e !== undefined);
  if (embeddings.length === 0 || embeddings[0].length === 0) return undefined;
  
  const dimensions = embeddings[0].length;
  const centroid = new Array(dimensions).fill(0);
  
  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += embedding[i];
    }
  }
  
  return centroid.map(sum => sum / embeddings.length);
}

/**
 * Determine recommended consolidation action for a cluster
 */
export function determineConsolidationAction(
  memories: ConsolidationMemory[],
  avgSimilarity: number
): ConsolidationAction {
  // High similarity = merge candidates
  if (avgSimilarity >= 0.9) {
    return 'merge';
  }
  
  // Medium-high similarity with multiple memories = summarize
  if (avgSimilarity >= 0.8 && memories.length >= 3) {
    return 'summarize';
  }
  
  // Medium similarity = link related memories
  if (avgSimilarity >= 0.7) {
    return 'link';
  }
  
  // Low importance memories = review
  const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
  if (avgImportance < 0.3) {
    return 'review';
  }
  
  return 'maintain';
}

/**
 * Generate consolidation schedule from clusters
 */
export function generateConsolidationSchedule(
  clusters: MemoryCluster[],
  config: ConsolidationOptimizerConfig = DEFAULT_CONSOLIDATION_CONFIG
): ConsolidationSchedule[] {
  if (!config.autoScheduleEnabled) return [];
  
  const schedules: ConsolidationSchedule[] = [];
  const now = new Date();
  
  // Priority based on action type
  const priorityMap: Record<ConsolidationAction, number> = {
    merge: 10,
    summarize: 8,
    link: 6,
    review: 4,
    maintain: 1,
  };
  
  // Time estimate based on cluster size
  const timeEstimatePerMemory = 50; // 50ms per memory
  
  for (const cluster of clusters) {
    if (cluster.recommendedAction === 'maintain') continue;
    
    const estimatedTimeMs = cluster.memories.length * timeEstimatePerMemory;
    
    schedules.push({
      scheduleId: `schedule-${schedules.length}`,
      clusterId: cluster.clusterId,
      scheduledTime: new Date(now.getTime() + schedules.length * config.consolidationIntervalHours * 3600000),
      priority: priorityMap[cluster.recommendedAction],
      estimatedTimeMs,
      action: cluster.recommendedAction,
      status: 'pending',
    });
  }
  
  // Sort by priority (highest first)
  return schedules.sort((a, b) => b.priority - a.priority);
}

/**
 * Process memories in optimized batches
 */
export async function processConsolidationBatch(
  memories: ConsolidationMemory[],
  processor: (batch: ConsolidationMemory[]) => Promise<void>,
  config: ConsolidationOptimizerConfig = DEFAULT_CONSOLIDATION_CONFIG
): Promise<void> {
  if (!config.enabled) {
    await processor(memories);
    return;
  }
  
  const batchSize = config.batchSize;
  for (let i = 0; i < memories.length; i += batchSize) {
    const batch = memories.slice(i, i + batchSize);
    await processor(batch);
  }
}

/**
 * Calculate optimization metrics
 */
export function calculateConsolidationMetrics(
  memories: ConsolidationMemory[],
  clusters: MemoryCluster[],
  processingTimeMs: number
): ConsolidationMetrics {
  const consolidatedCount = clusters
    .filter(c => c.recommendedAction !== 'maintain')
    .reduce((sum, c) => sum + c.memories.length, 0);
  
  const avgClusterSize = clusters.length > 0 
    ? memories.length / clusters.length 
    : 0;
  
  // Estimate storage savings (consolidated memories take less space)
  const storageSavings = consolidatedCount * 100; // Rough estimate: 100 bytes per consolidated memory
  
  // Efficiency score based on clustering quality
  const clusterQuality = clusters.reduce((sum, c) => sum + c.avgSimilarity, 0) / clusters.length;
  const consolidationRate = memories.length > 0 ? consolidatedCount / memories.length : 0;
  const efficiencyScore = (clusterQuality * 0.6 + consolidationRate * 0.4);
  
  return {
    totalMemories: memories.length,
    clusterCount: clusters.length,
    avgClusterSize,
    consolidatedCount,
    storageSavings,
    processingTimeMs,
    efficiencyScore,
  };
}

/**
 * Main consolidation optimization function
 */
export interface ConsolidationResult {
  /** Generated clusters */
  clusters: MemoryCluster[];
  /** Consolidation schedule */
  schedule: ConsolidationSchedule[];
  /** Optimization metrics */
  metrics: ConsolidationMetrics;
}

export async function optimizeConsolidation(
  memories: ConsolidationMemory[],
  config: ConsolidationOptimizerConfig = DEFAULT_CONSOLIDATION_CONFIG
): Promise<ConsolidationResult> {
  const startTime = Date.now();
  
  // Cluster memories
  const clusters = clusterMemories(memories, config);
  
  // Generate schedule
  const schedule = generateConsolidationSchedule(clusters, config);
  
  // Calculate metrics
  const processingTimeMs = Date.now() - startTime;
  const metrics = calculateConsolidationMetrics(memories, clusters, processingTimeMs);
  
  return {
    clusters,
    schedule,
    metrics,
  };
}
