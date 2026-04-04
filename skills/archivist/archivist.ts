/**
 * Archivist Lobe
 * 
 * Manages memory lifecycle operations:
 * - Promotion from episodic to semantic storage
 * - Archiving outdated/unused memories
 * - State transition management
 * - Lifecycle event logging
 * 
 * @module archivist
 * @see {@link ../memory-consolidation/decay.ts} for AgeMem integration
 */

/** Memory type for lifecycle management */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'archival';

/** Promotion reason types */
export type PromotionReason = 'high_access' | 'high_importance' | 'critical_tag' | 'manual';

/** Archive reason types */
export type ArchiveReason = 'age' | 'low_importance' | 'deprecated' | 'manual';

/** Recommended action from evaluation */
export type LifecycleAction = 'promote' | 'archive' | 'maintain' | 'review';

/** Archivist configuration */
export interface ArchivistConfig {
  /** Access count threshold for promotion */
  promotionAccessThreshold: number;
  /** Importance score threshold for promotion */
  promotionImportanceThreshold: number;
  /** Age in days before archive consideration */
  archiveAgeDays: number;
  /** Importance threshold below which archive is considered */
  archiveImportanceThreshold: number;
  /** Max access count for archive eligibility */
  archiveAccessThreshold: number;
  /** Enable automatic archiving (vs manual approval) */
  autoArchiveEnabled: boolean;
}

/** Default configuration */
export const DEFAULT_ARCHIVIST_CONFIG: ArchivistConfig = {
  promotionAccessThreshold: 10,
  promotionImportanceThreshold: 0.8,
  archiveAgeDays: 30,
  archiveImportanceThreshold: 0.3,
  archiveAccessThreshold: 0,
  autoArchiveEnabled: false,
};

/** Result of promotion operation */
export interface PromoteResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Memory ID that was promoted */
  memoryId: string;
  /** Previous type */
  oldType: 'episodic';
  /** New type */
  newType: 'semantic';
  /** Reason for promotion */
  reason: string;
  /** Timestamp of operation */
  timestamp: string;
  /** Optional error message */
  error?: string;
}

/** Result of archive operation */
export interface ArchiveResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Memory ID that was archived */
  memoryId: string;
  /** Previous type */
  oldType: MemoryType;
  /** New type */
  newType: 'archival';
  /** Reason for archiving */
  reason: string;
  /** Optional summary generated before archiving */
  summary?: string;
  /** Timestamp of operation */
  timestamp: string;
  /** Optional error message */
  error?: string;
}

/** Result of lifecycle evaluation */
export interface EvaluationResult {
  /** Memory ID evaluated */
  memoryId: string;
  /** Current memory type */
  currentState: MemoryType;
  /** Recommended action */
  recommendedAction: LifecycleAction;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Reasons for recommendation */
  reasons: string[];
  /** Metrics used in evaluation */
  metrics: {
    /** Importance score */
    importance: number;
    /** Age in days */
    ageInDays: number;
    /** Access count */
    accessCount: number;
    /** Score after Ebbinghaus decay */
    decayedScore: number;
  };
}

/** Parameters for memory evaluation */
export interface EvaluationParams {
  /** Memory identifier */
  memoryId: string;
  /** Current memory type */
  type: MemoryType;
  /** Importance score (0-1) */
  importance: number;
  /** Age in days */
  ageInDays: number;
  /** Number of accesses */
  accessCount: number;
  /** Optional tags */
  tags?: string[];
  /** Optional decayed score */
  decayedScore?: number;
}

/** Lifecycle event for audit logging */
export interface LifecycleEvent {
  /** Unique event identifier */
  eventId: string;
  /** Memory ID affected */
  memoryId: string;
  /** Type of lifecycle event */
  eventType: 'promote' | 'archive' | 'delete';
  /** Source state */
  fromState: MemoryType;
  /** Target state */
  toState: MemoryType;
  /** Reason for transition */
  reason: string;
  /** How transition was triggered */
  triggeredBy: 'auto' | 'manual';
  /** Agent that triggered the event */
  agentId: string;
  /** Timestamp of event */
  timestamp: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Evaluates a memory for lifecycle transition eligibility
 * 
 * @param params - Evaluation parameters
 * @returns Evaluation result with recommended action
 * 
 * @example
 * ```typescript
 * const result = await evaluateMemoryLifecycle({
 *   memoryId: 'mem-001',
 *   type: 'episodic',
 *   importance: 0.85,
 *   ageInDays: 5,
 *   accessCount: 15,
 *   tags: ['critical']
 * });
 * 
 * console.log(`Recommended: ${result.recommendedAction}`);
 * // Output: Recommended: promote
 * ```
 */
export async function evaluateMemoryLifecycle(
  params: EvaluationParams,
): Promise<EvaluationResult> {
  const config = DEFAULT_ARCHIVIST_CONFIG;
  const reasons: string[] = [];
  let recommendedAction: LifecycleAction = 'maintain';
  let confidence = 0.5;

  // Check promotion criteria (only from episodic to semantic)
  if (params.type === 'episodic') {
    const shouldPromote =
      params.accessCount >= config.promotionAccessThreshold ||
      params.importance >= config.promotionImportanceThreshold ||
      params.tags?.includes('critical') ||
      params.tags?.includes('permanent');

    if (shouldPromote) {
      recommendedAction = 'promote';
      
      if (params.accessCount >= config.promotionAccessThreshold) {
        reasons.push(`High access frequency (${params.accessCount} >= ${config.promotionAccessThreshold})`);
      }
      if (params.importance >= config.promotionImportanceThreshold) {
        reasons.push(`High importance (${params.importance} >= ${config.promotionImportanceThreshold})`);
      }
      if (params.tags?.includes('critical')) {
        reasons.push('Tagged as critical');
      }
      if (params.tags?.includes('permanent')) {
        reasons.push('Tagged as permanent');
      }

      // Higher confidence for clear promotion cases
      confidence = 0.8 + (reasons.length * 0.05);
    }
  }

  // Check archive criteria (if not already recommending promotion)
  if (recommendedAction === 'maintain') {
    const shouldArchive =
      (params.ageInDays >= config.archiveAgeDays &&
       params.importance < config.archiveImportanceThreshold &&
       params.accessCount <= config.archiveAccessThreshold) ||
      params.tags?.includes('deprecated');

    if (shouldArchive) {
      if (params.tags?.includes('deprecated')) {
        recommendedAction = 'archive';
        reasons.push('Tagged as deprecated');
        confidence = 0.9;
      } else if (params.ageInDays >= config.archiveAgeDays) {
        // Only auto-archive if enabled and criteria are strong
        if (config.autoArchiveEnabled) {
          recommendedAction = 'archive';
          reasons.push(`Age (${params.ageInDays} days) + low importance (${params.importance})`);
          confidence = 0.7;
        } else {
          // Require manual review for auto-archive
          recommendedAction = 'review';
          reasons.push(`Age threshold met (${params.ageInDays} days) - manual review required`);
          confidence = 0.6;
        }
      }
    }
  }

  // Add context to reasons
  if (recommendedAction === 'maintain') {
    reasons.push('Does not meet promotion or archive criteria');
    if (params.accessCount < config.promotionAccessThreshold) {
      reasons.push(`Access count below threshold (${params.accessCount} < ${config.promotionAccessThreshold})`);
    }
    if (params.importance < config.promotionImportanceThreshold) {
      reasons.push(`Importance below threshold (${params.importance} < ${config.promotionImportanceThreshold})`);
    }
  }

  return {
    memoryId: params.memoryId,
    currentState: params.type,
    recommendedAction,
    confidence: Math.min(1, confidence),
    reasons,
    metrics: {
      importance: params.importance,
      ageInDays: params.ageInDays,
      accessCount: params.accessCount,
      decayedScore: params.decayedScore ?? params.importance,
    },
  };
}

/**
 * Batch evaluates multiple memories for lifecycle transitions
 * 
 * @param memories - Array of memories to evaluate
 * @returns Array of evaluation results
 */
export async function batchEvaluate(
  memories: Array<{
    memoryId: string;
    type: MemoryType;
    importance: number;
    ageInDays: number;
    accessCount: number;
    tags?: string[];
    decayedScore?: number;
  }>,
): Promise<EvaluationResult[]> {
  return Promise.all(memories.map(memory => evaluateMemoryLifecycle(memory)));
}

/**
 * Promotes a memory from episodic to semantic storage
 * 
 * @param params - Promotion parameters
 * @returns Promotion result
 * 
 * @example
 * ```typescript
 * const result = await promoteMemory({
 *   memoryId: '550e8400-e29b-41d4-a716-446655440000',
 *   reason: 'high_access'
 * });
 * 
 * if (result.success) {
 *   console.log(`Promoted: ${result.memoryId}`);
 * }
 * ```
 */
export async function promoteMemory(params: {
  memoryId: string;
  reason?: PromotionReason;
}): Promise<PromoteResult> {
  const timestamp = new Date().toISOString();
  
  // Validate that we can promote this memory
  // In production, this would query the memory store
  // For now, we assume the caller has validated eligibility
  
  const reason = params.reason ?? 'manual';
  
  // In production, this would:
  // 1. Query memory store for current state
  // 2. Verify type is 'episodic'
  // 3. Update type to 'semantic'
  // 4. Update storage path
  // 5. Log lifecycle event
  
  return {
    success: true,
    memoryId: params.memoryId,
    oldType: 'episodic',
    newType: 'semantic',
    reason,
    timestamp,
  };
}

/**
 * Archives a memory to cold storage
 * 
 * @param params - Archive parameters
 * @returns Archive result
 * 
 * @example
 * ```typescript
 * const result = await archiveMemory({
 *   memoryId: '660e8400-e29b-41d4-a716-446655440001',
 *   reason: 'age',
 *   createSummary: true
 * });
 * ```
 */
export async function archiveMemory(params: {
  memoryId: string;
  reason?: ArchiveReason;
  createSummary?: boolean;
}): Promise<ArchiveResult> {
  const timestamp = new Date().toISOString();
  
  const reason = params.reason ?? 'manual';
  
  // In production, this would:
  // 1. Query memory store for current state
  // 2. Generate summary if requested
  // 3. Update type to 'archival'
  // 4. Set is_archived flag
  // 5. Move to archive storage path
  // 6. Log lifecycle event
  
  let summary: string | undefined;
  if (params.createSummary) {
    // In production, this would call a summarization service
    summary = `Memory ${params.memoryId} archived on ${timestamp}`;
  }
  
  return {
    success: true,
    memoryId: params.memoryId,
    oldType: 'episodic', // Would be determined from memory store
    newType: 'archival',
    reason,
    summary,
    timestamp,
  };
}

/**
 * Generates a lifecycle event for audit logging
 */
export function createLifecycleEvent(params: {
  memoryId: string;
  eventType: 'promote' | 'archive' | 'delete';
  fromState: MemoryType;
  toState: MemoryType;
  reason: string;
  triggeredBy?: 'auto' | 'manual';
  agentId?: string;
  metadata?: Record<string, unknown>;
}): LifecycleEvent {
  return {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    memoryId: params.memoryId,
    eventType: params.eventType,
    fromState: params.fromState,
    toState: params.toState,
    reason: params.reason,
    triggeredBy: params.triggeredBy ?? 'manual',
    agentId: params.agentId ?? 'archivist-lobe',
    timestamp: new Date().toISOString(),
    metadata: params.metadata,
  };
}

/**
 * Determines if a memory should be promoted based on criteria
 */
export function shouldPromote(params: {
  type: MemoryType;
  importance: number;
  accessCount: number;
  tags?: string[];
}): boolean {
  if (params.type !== 'episodic') {
    return false;
  }
  
  const config = DEFAULT_ARCHIVIST_CONFIG;
  
  const hasCriticalTag = params.tags?.includes('critical') ?? false;
  const hasPermanentTag = params.tags?.includes('permanent') ?? false;
  
  return (
    params.accessCount >= config.promotionAccessThreshold ||
    params.importance >= config.promotionImportanceThreshold ||
    hasCriticalTag ||
    hasPermanentTag
  );
}

/**
 * Determines if a memory should be archived based on criteria
 */
export function shouldArchive(params: {
  type: MemoryType;
  importance: number;
  ageInDays: number;
  accessCount: number;
  tags?: string[];
}): boolean {
  const config = DEFAULT_ARCHIVIST_CONFIG;
  
  // Deprecated tag always triggers archive
  if (params.tags?.includes('deprecated')) {
    return true;
  }
  
  // Age + low importance + no access triggers archive
  return (
    params.ageInDays >= config.archiveAgeDays &&
    params.importance < config.archiveImportanceThreshold &&
    params.accessCount <= config.archiveAccessThreshold
  );
}

/**
 * Calculates the next review date for a memory based on its type and importance
 */
export function calculateNextReviewDate(params: {
  type: MemoryType;
  importance: number;
  ageInDays: number;
}): Date {
  const baseReviewDays: Record<MemoryType, number> = {
    working: 0,      // Review at end of session
    episodic: 7,     // Review weekly
    semantic: 30,    // Review monthly
    procedural: 90,  // Review quarterly
    archival: 365,   // Review annually
  };
  
  // Adjust based on importance
  const importanceMultiplier = 1 + (1 - params.importance); // Higher importance = longer interval
  const baseDays = baseReviewDays[params.type] ?? 30;
  const reviewDays = Math.floor(baseDays * importanceMultiplier);
  
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + reviewDays);
  
  return nextReview;
}
