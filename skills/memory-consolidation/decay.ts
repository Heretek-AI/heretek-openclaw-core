/**
 * Ebbinghaus Forgetting Curve Implementation for AgeMem Unified Memory
 * 
 * The Ebbinghaus forgetting curve describes how memory retention decays exponentially
 * over time unless the memory is reinforced through repetition or high importance.
 * 
 * Formula: R(t) = S * e^(-t/H)
 * Where:
 *   R(t) = retention strength at time t
 *   S = initial memory strength (importance score)
 *   t = time elapsed (in days)
 *   H = half-life constant (derived from halfLifeDays)
 * 
 * @module decay
 */

export interface EbbinghausConfig {
  /** Enable temporal decay (default: true) */
  enabled: boolean;
  /** Half-life in days for exponential decay (default: 7 for episodic, 30 for semantic) */
  halfLifeDays: number;
  /** Minimum retention multiplier to prevent complete decay (default: 0.1) */
  floorMultiplier: number;
  /** Boost factor for memories accessed multiple times (default: 1.5) */
  repetitionBoost: number;
}

export const DEFAULT_EBBINGHAUS_CONFIG: EbbinghausConfig = {
  enabled: true,
  halfLifeDays: 7,
  floorMultiplier: 0.1,
  repetitionBoost: 1.5,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Converts half-life days to the decay constant (lambda) for the Ebbinghaus formula.
 * 
 * The decay constant λ = ln(2) / halfLifeDays ensures that after halfLifeDays,
 * the retention is exactly 50% of the original strength.
 * 
 * @param halfLifeDays - The half-life period in days
 * @returns The decay constant lambda, or 0 if invalid input
 */
export function toDecayLambda(halfLifeDays: number): number {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) {
    return 0;
  }
  return Math.LN2 / halfLifeDays;
}

/**
 * Calculates the Ebbinghaus retention multiplier based on memory age.
 * 
 * This implements the exponential decay component of the forgetting curve:
 *   multiplier = e^(-λ * ageInDays)
 * 
 * @param params.ageInDays - Age of the memory in days
 * @param params.halfLifeDays - Half-life constant for decay
 * @returns Retention multiplier between 0 and 1
 */
export function calculateEbbinghausMultiplier(params: {
  ageInDays: number;
  halfLifeDays: number;
}): number {
  const lambda = toDecayLambda(params.halfLifeDays);
  const clampedAge = Math.max(0, params.ageInDays);
  
  if (lambda <= 0 || !Number.isFinite(clampedAge)) {
    return 1;
  }
  
  return Math.exp(-lambda * clampedAge);
}

/**
 * Applies Ebbinghaus decay to a memory's importance score.
 * 
 * The final retention score is calculated as:
 *   retention = importance * multiplier * repetitionBonus
 * 
 * Where:
 *   - multiplier is the exponential decay based on age
 *   - repetitionBonus boosts score for frequently accessed memories
 * 
 * @param params.score - Initial importance score (0-1)
 * @param params.ageInDays - Age of the memory in days
 * @param params.halfLifeDays - Half-life constant for decay
 * @param params.accessCount - Number of times memory was accessed
 * @param params.config - Optional Ebbinghaus configuration
 * @returns Decayed importance score
 */
export function applyEbbinghausDecayToScore(params: {
  score: number;
  ageInDays: number;
  halfLifeDays: number;
  accessCount?: number;
  config?: Partial<EbbinghausConfig>;
}): number {
  const config = { ...DEFAULT_EBBINGHAUS_CONFIG, ...params.config };
  
  // Calculate base decay multiplier
  const multiplier = calculateEbbinghausMultiplier({
    ageInDays: params.ageInDays,
    halfLifeDays: params.halfLifeDays,
  });
  
  // Apply repetition boost for frequently accessed memories
  let repetitionBonus = 1;
  if (params.accessCount !== undefined && params.accessCount > 0) {
    // Logarithmic boost: more accesses = more boost, but diminishing returns
    repetitionBonus = 1 + Math.log10(params.accessCount + 1) * (config.repetitionBoost - 1);
  }
  
  // Calculate final decayed score
  const decayedScore = params.score * multiplier * repetitionBonus;
  
  // Apply floor to prevent complete decay
  const minScore = params.score * config.floorMultiplier;
  
  return Math.max(decayedScore, minScore);
}

/**
 * Memory retrieval result with decayed relevance score.
 */
export interface MemoryRetrievalResult {
  /** Memory content or reference */
  content: string;
  /** Original importance score */
  originalScore: number;
  /** Score after Ebbinghaus decay */
  decayedScore: number;
  /** Age of memory in days */
  ageInDays: number;
  /** Memory type (episodic, semantic, working) */
  type: string;
  /** Access count for this memory */
  accessCount: number;
  /** Timestamp when memory was created */
  createdAt: string;
  /** File path or identifier */
  path: string;
}

/**
 * Retrieves memories with Ebbinghaus decay weighting applied to relevance scores.
 * 
 * This function implements the AgeMem unified memory retrieval API, combining:
 *   - Semantic search relevance
 *   - Temporal decay based on Ebbinghaus forgetting curve
 *   - Access pattern boosting for frequently used memories
 * 
 * @param memories - Array of memory candidates to rank
 * @param query - The search query (used for semantic relevance)
 * @param recencyWeight - Weight given to recency vs semantic relevance (0-1)
 * @param config - Optional Ebbinghaus configuration
 * @returns Sorted array of memories by combined relevance score
 */
export async function memory_retrieve(params: {
  memories: Array<{
    content: string;
    importance: number;
    createdAt: string | Date;
    accessCount?: number;
    type?: string;
    path?: string;
  }>;
  query?: string;
  recencyWeight?: number;
  config?: Partial<EbbinghausConfig>;
}): Promise<MemoryRetrievalResult[]> {
  const config = { ...DEFAULT_EBBINGHAUS_CONFIG, ...params.config };
  const recencyWeight = params.recencyWeight ?? 0.5;
  const semanticWeight = 1 - recencyWeight;
  const now = Date.now();
  
  // Process each memory and calculate decayed scores
  const results: MemoryRetrievalResult[] = await Promise.all(
    params.memories.map(async (memory) => {
      const createdAt = memory.createdAt instanceof Date ? memory.createdAt : new Date(memory.createdAt);
      const ageInDays = Math.max(0, (now - createdAt.getTime()) / DAY_MS);
      
      // Apply Ebbinghaus decay to importance score
      const decayedScore = applyEbbinghausDecayToScore({
        score: memory.importance,
        ageInDays,
        halfLifeDays: config.halfLifeDays,
        accessCount: memory.accessCount ?? 0,
        config,
      });
      
      return {
        content: memory.content,
        originalScore: memory.importance,
        decayedScore,
        ageInDays,
        type: memory.type ?? 'episodic',
        accessCount: memory.accessCount ?? 0,
        createdAt: memory.createdAt instanceof Date ? memory.createdAt.toISOString() : memory.createdAt,
        path: memory.path ?? '',
      };
    }),
  );
  
  // Sort by decayed score (highest relevance first)
  return results.sort((a, b) => b.decayedScore - a.decayedScore);
}

/**
 * Batch applies Ebbinghaus decay to multiple memory scores.
 * 
 * @param memories - Array of memory objects with importance and timestamps
 * @param config - Optional Ebbinghaus configuration
 * @returns Array of memories with decayed scores added
 */
export function batchApplyDecay(
  memories: Array<{
    importance: number;
    createdAt: string | Date;
    accessCount?: number;
  }>,
  config?: Partial<EbbinghausConfig>,
): Array<{ importance: number; decayedScore: number; ageInDays: number }> {
  const now = Date.now();
  
  return memories.map((memory) => {
    const createdAt = memory.createdAt instanceof Date ? memory.createdAt : new Date(memory.createdAt);
    const ageInDays = Math.max(0, (now - createdAt.getTime()) / DAY_MS);
    
    const decayedScore = applyEbbinghausDecayToScore({
      score: memory.importance,
      ageInDays,
      halfLifeDays: config?.halfLifeDays ?? DEFAULT_EBBINGHAUS_CONFIG.halfLifeDays,
      accessCount: memory.accessCount ?? 0,
      config,
    });
    
    return {
      importance: memory.importance,
      decayedScore,
      ageInDays,
    };
  });
}

/**
 * Memory type enumeration for AgeMem unified memory API.
 */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'archival';

/**
 * Input parameters for memory_add function.
 */
export interface MemoryAddParams {
  /** Memory content (text or serialized data) */
  content: string;
  /** Memory type (episodic, semantic, working, procedural, archival) */
  type: MemoryType;
  /** Initial importance score (0-1, default: 0.5) */
  importance?: number;
  /** Optional tags for categorization */
  tags?: string[];
  /** Optional metadata (custom key-value pairs) */
  metadata?: Record<string, unknown>;
  /** Optional source reference (file path, URL, etc.) */
  source?: string;
  /** Optional cluster ID for grouping related memories */
  clusterId?: string;
  /** Optional Ebbinghaus configuration override */
  config?: Partial<EbbinghausConfig>;
}

/**
 * Result of memory_add operation.
 */
export interface MemoryAddResult {
  /** Unique memory identifier */
  id: string;
  /** Memory content */
  content: string;
  /** Memory type */
  type: MemoryType;
  /** Initial importance score */
  importance: number;
  /** Timestamp when memory was created */
  createdAt: string;
  /** Memory file path or storage location */
  path: string;
  /** Tags associated with memory */
  tags: string[];
  /** Metadata associated with memory */
  metadata: Record<string, unknown>;
  /** Whether the memory was successfully added */
  success: boolean;
  /** Optional error message if operation failed */
  error?: string;
}

/**
 * Calculates the optimal half-life based on memory type.
 *
 * @param type - Memory type
 * @returns Recommended half-life in days
 */
export function getHalfLifeForMemoryType(type: MemoryType): number {
  switch (type) {
    case 'working':
      return 0.5; // 12 hours - session lifetime
    case 'episodic':
      return 7; // 7 days - recent experiences fade quickly
    case 'semantic':
      return 30; // 30 days - facts persist longer
    case 'procedural':
      return 90; // 90 days - skills are long-lasting
    case 'archival':
      return Infinity; // Permanent - no decay
    default:
      return 7; // Default to episodic
  }
}

/**
 * Generates a unique memory ID based on content hash and timestamp.
 *
 * @param content - Memory content
 * @param createdAt - Creation timestamp
 * @returns Unique memory identifier
 */
export function generateMemoryId(content: string, createdAt: Date): string {
  // Simple hash-based ID generation
  // In production, use a proper UUID or hash function
  const hash = content.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timestamp = createdAt.getTime();
  return `mem_${hash.toString(16)}_${timestamp}`;
}

/**
 * Validates memory importance score.
 *
 * @param importance - Score to validate
 * @returns Clamped importance score between 0 and 1
 */
export function validateImportance(importance?: number): number {
  if (importance === undefined || importance === null) {
    return 0.5; // Default importance
  }
  
  if (!Number.isFinite(importance)) {
    return 0.5;
  }
  
  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, importance));
}

/**
 * Adds a new memory to the AgeMem unified memory system.
 *
 * This function implements the AgeMem memory_add API, creating a new memory
 * with proper metadata, importance scoring, and Ebbinghaus decay configuration.
 *
 * @param params - Memory addition parameters
 * @returns MemoryAddResult with unique ID and storage location
 *
 * @example
 * ```typescript
 * const result = await memory_add({
 *   content: "User prefers TypeScript over JavaScript",
 *   type: "semantic",
 *   importance: 0.9,
 *   tags: ["user-preferences", "programming"],
 *   metadata: { language: "typescript" }
 * });
 *
 * console.log(`Memory added with ID: ${result.id}`);
 * ```
 *
 * @example
 * ```typescript
 * // Add episodic memory from session
 * const sessionMemory = await memory_add({
 *   content: "Discussed Ebbinghaus forgetting curve implementation",
 *   type: "episodic",
 *   importance: 0.7,
 *   tags: ["session", "technical"],
 *   source: "episodes/2026-04-04/session.jsonl"
 * });
 * ```
 */
export async function memory_add(params: MemoryAddParams): Promise<MemoryAddResult> {
  const createdAt = new Date();
  
  // Validate importance score
  const importance = validateImportance(params.importance);
  
  // Generate unique ID
  const id = generateMemoryId(params.content, createdAt);
  
  // Determine storage path based on memory type
  const path = getMemoryPath(params.type, id, createdAt);
  
  // Validate memory type
  const validTypes: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural', 'archival'];
  const type = validTypes.includes(params.type) ? params.type : 'episodic';
  
  // Prepare result
  const result: MemoryAddResult = {
    id,
    content: params.content,
    type,
    importance,
    createdAt: createdAt.toISOString(),
    path,
    tags: params.tags ?? [],
    metadata: params.metadata ?? {},
    success: true,
  };
  
  // Note: Actual storage implementation depends on backend
  // This function returns the prepared memory object for storage
  // Integration with PostgreSQL/Redis/file system should be done separately
  
  return result;
}

/**
 * Gets the storage path for a memory based on its type.
 *
 * @param type - Memory type
 * @param id - Memory ID
 * @param createdAt - Creation timestamp
 * @returns Storage path string
 */
function getMemoryPath(type: MemoryType, id: string, createdAt: Date): string {
  const dateStr = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
  
  switch (type) {
    case 'working':
      return `working/${id}.tmp`;
    case 'episodic':
      return `episodes/${dateStr}/${id}.jsonl`;
    case 'semantic':
      return `memory/semantic/${id}.md`;
    case 'procedural':
      return `memory/procedural/${id}.md`;
    case 'archival':
      return `archive/${dateStr}/${id}.md`;
    default:
      return `memory/${id}.md`;
  }
}

/**
 * Calculates the optimal review interval for a memory based on Ebbinghaus curve.
 *
 * According to Ebbinghaus research, memories should be reviewed just before
 * they would naturally decay to prevent forgetting. This calculates when
 * a memory's retention would drop below a threshold.
 *
 * @param currentScore - Current importance/retention score
 * @param threshold - Minimum acceptable retention (default: 0.5)
 * @param halfLifeDays - Half-life constant
 * @returns Recommended days until next review
 */
export function calculateOptimalReviewInterval(params: {
  currentScore: number;
  threshold?: number;
  halfLifeDays?: number;
}): number {
  const threshold = params.threshold ?? 0.5;
  const halfLifeDays = params.halfLifeDays ?? DEFAULT_EBBINGHAUS_CONFIG.halfLifeDays;
  
  // If already below threshold, review immediately
  if (params.currentScore <= threshold) {
    return 0;
  }
  
  // Calculate days until score decays to threshold
  // Using: threshold = currentScore * e^(-λ * t)
  // Solving for t: t = -ln(threshold/currentScore) / λ
  const lambda = toDecayLambda(halfLifeDays);
  if (lambda <= 0) {
    return halfLifeDays;
  }
  
  const daysUntilThreshold = -Math.log(threshold / params.currentScore) / lambda;
  return Math.max(0, daysUntilThreshold);
}
