/**
 * Redis TTL Manager Lobe
 * 
 * Manages Redis cache TTLs for AgeMem working memory:
 * - TTL calculation based on importance, access patterns, and decay
 * - Type-based default TTLs
 * - Cache health monitoring
 * - Automatic TTL extension on access
 * 
 * @module redis-ttl-manager
 * @see {@link ../memory-consolidation/decay.ts} for Ebbinghaus decay integration
 */

/** Memory type for TTL calculation */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'archival';

/** TTL manager configuration */
export interface TTLManagerConfig {
  /** Enable TTL management */
  enabled: boolean;
  /** Base TTL in seconds */
  baseTTLSeconds: number;
  /** Minimum TTL in seconds */
  minTTLSeconds: number;
  /** Maximum TTL in seconds */
  maxTTLSeconds: number;
  /** Importance weight multiplier */
  importanceMultiplier: number;
  /** Per-access bonus multiplier */
  accessBonusMultiplier: number;
  /** Use Ebbinghaus decay for TTL calculation */
  decayAwareTTL: boolean;
}

/** Default configuration */
export const DEFAULT_TTL_CONFIG: TTLManagerConfig = {
  enabled: true,
  baseTTLSeconds: 86400, // 24 hours
  minTTLSeconds: 300, // 5 minutes
  maxTTLSeconds: 604800, // 7 days
  importanceMultiplier: 1.5,
  accessBonusMultiplier: 1.2,
  decayAwareTTL: true,
};

/** Memory type TTL multipliers */
export const MEMORY_TYPE_TTL_MULTIPLIER: Record<MemoryType, number> = {
  working: 0.25,    // 6 hours base
  episodic: 1.0,    // 24 hours base
  semantic: 2.0,    // 48 hours base
  procedural: 3.0,  // 72 hours base
  archival: 0,      // Not cached
};

/** Result of TTL calculation */
export interface TTLResult {
  /** Calculated TTL in seconds */
  ttlSeconds: number;
  /** TTL breakdown by factor */
  breakdown: {
    /** Base TTL from type */
    baseTTL: number;
    /** Importance bonus multiplier */
    importanceBonus: number;
    /** Access bonus multiplier */
    accessBonus: number;
    /** Decay factor (0-1) */
    decayFactor: number;
  };
  /** Expiration timestamp */
  expiresAt: Date;
}

/** Result of cache set operation */
export interface CacheSetResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Cache key */
  key: string;
  /** TTL set in seconds */
  ttl: number;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Optional error message */
  error?: string;
}

/** Result of TTL extension */
export interface TTLExtensionResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Cache key */
  key: string;
  /** New TTL in seconds */
  newTTL: number;
  /** Previous TTL in seconds */
  previousTTL: number;
  /** Remaining TTL before extension */
  remainingTTL: number;
}

/** Cache health metrics */
export interface CacheHealth {
  /** Total keys in cache */
  totalKeys: number;
  /** Average TTL in seconds */
  avgTTL: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Cache miss rate (0-1) */
  missRate: number;
  /** Expired keys count (24h) */
  expiredCount: number;
  /** Evicted keys count (24h) */
  evictedCount: number;
  /** Memory usage in bytes */
  memoryUsage: number;
}

/** Parameters for TTL calculation */
export interface TTLParams {
  /** Memory importance (0-1) */
  importance: number;
  /** Number of accesses */
  accessCount?: number;
  /** Age in days */
  ageInDays?: number;
  /** Memory type */
  type?: MemoryType;
  /** Ebbinghaus half-life in days */
  halfLifeDays?: number;
  /** Override config */
  config?: Partial<TTLManagerConfig>;
}

/**
 * Calculates TTL in seconds for a memory cache entry
 * 
 * Formula:
 *   baseTTL = BASE_TTL × typeMultiplier
 *   importanceBonus = 1 + (importance × IMPORTANCE_MULTIPLIER)
 *   accessBonus = log2(accessCount + 1) × ACCESS_BONUS_MULTIPLIER
 *   decayFactor = e^(-λ × ageInDays)  [if decayAwareTTL]
 *   finalTTL = baseTTL × importanceBonus × accessBonus × decayFactor
 * 
 * @param params - TTL calculation parameters
 * @returns TTL in seconds (clamped to min/max)
 * 
 * @example
 * ```typescript
 * const ttl = calculateTTL({
 *   importance: 0.9,
 *   accessCount: 15,
 *   type: 'semantic'
 * });
 * 
 * console.log(`TTL: ${ttl} seconds`);
 * ```
 */
export function calculateTTL(params: TTLParams): number {
  const config = { ...DEFAULT_TTL_CONFIG, ...params.config };
  
  if (!config.enabled) {
    return config.baseTTLSeconds;
  }

  // Get type multiplier
  const typeMultiplier = MEMORY_TYPE_TTL_MULTIPLIER[params.type ?? 'episodic'];
  
  // Calculate base TTL
  const baseTTL = config.baseTTLSeconds * typeMultiplier;
  
  // Calculate importance bonus: 1 + (importance × multiplier)
  const importance = Math.max(0, Math.min(1, params.importance ?? 0.5));
  const importanceBonus = 1 + (importance * config.importanceMultiplier);
  
  // Calculate access bonus: log2(accessCount + 1) × multiplier
  const accessCount = params.accessCount ?? 0;
  const accessBonus = Math.log2(accessCount + 1) * config.accessBonusMultiplier;
  
  // Calculate decay factor if enabled
  let decayFactor = 1;
  if (config.decayAwareTTL && params.ageInDays !== undefined) {
    const halfLifeDays = params.halfLifeDays ?? 7;
    const lambda = Math.LN2 / halfLifeDays;
    decayFactor = Math.exp(-lambda * Math.max(0, params.ageInDays));
  }
  
  // Calculate raw TTL
  const rawTTL = baseTTL * importanceBonus * (1 + accessBonus) * decayFactor;
  
  // Clamp to min/max
  const finalTTL = Math.max(
    config.minTTLSeconds,
    Math.min(config.maxTTLSeconds, rawTTL)
  );
  
  return Math.floor(finalTTL);
}

/**
 * Calculates full TTL breakdown with all factors
 */
export function calculateTTLWithBreakdown(params: TTLParams): TTLResult {
  const config = { ...DEFAULT_TTL_CONFIG, ...params.config };
  
  const typeMultiplier = MEMORY_TYPE_TTL_MULTIPLIER[params.type ?? 'episodic'];
  const baseTTL = config.baseTTLSeconds * typeMultiplier;
  
  const importance = Math.max(0, Math.min(1, params.importance ?? 0.5));
  const importanceBonus = 1 + (importance * config.importanceMultiplier);
  
  const accessCount = params.accessCount ?? 0;
  const accessBonus = Math.log2(accessCount + 1) * config.accessBonusMultiplier;
  
  let decayFactor = 1;
  if (config.decayAwareTTL && params.ageInDays !== undefined) {
    const halfLifeDays = params.halfLifeDays ?? 7;
    const lambda = Math.LN2 / halfLifeDays;
    decayFactor = Math.exp(-lambda * Math.max(0, params.ageInDays));
  }
  
  const rawTTL = baseTTL * importanceBonus * (1 + accessBonus) * decayFactor;
  const ttlSeconds = Math.floor(Math.max(
    config.minTTLSeconds,
    Math.min(config.maxTTLSeconds, rawTTL)
  ));
  
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  
  return {
    ttlSeconds,
    breakdown: {
      baseTTL: Math.floor(baseTTL),
      importanceBonus,
      accessBonus,
      decayFactor,
    },
    expiresAt,
  };
}

/**
 * Sets a memory in Redis with calculated TTL
 * 
 * Note: This is a reference implementation. In production,
 * integrate with actual Redis client.
 * 
 * @param params - Cache set parameters
 * @returns Cache set result
 * 
 * @example
 * ```typescript
 * const result = await setMemoryWithTTL({
 *   key: 'memory:semantic:001',
 *   value: JSON.stringify({ content: 'User prefers TypeScript' }),
 *   importance: 0.9,
 *   type: 'semantic'
 * });
 * ```
 */
export async function setMemoryWithTTL(params: {
  key: string;
  value: string;
  importance: number;
  accessCount?: number;
  type?: MemoryType;
  config?: Partial<TTLManagerConfig>;
}): Promise<CacheSetResult> {
  const ttl = calculateTTL({
    importance: params.importance,
    accessCount: params.accessCount,
    type: params.type,
    config: params.config,
  });
  
  const expiresAt = new Date(Date.now() + ttl * 1000);
  
  // In production, this would use Redis SETEX:
  // await redisClient.setEx(params.key, ttl, params.value);
  
  // Reference implementation (no-op)
  console.log(`[Redis TTL Manager] SET ${params.key} EX=${ttl}s`);
  
  return {
    success: true,
    key: params.key,
    ttl,
    expiresAt,
  };
}

/**
 * Extends TTL for an existing cache entry (on access)
 * 
 * @param params - TTL extension parameters
 * @returns TTL extension result
 * 
 * @example
 * ```typescript
 * const result = await extendTTL({
 *   key: 'memory:semantic:001',
 *   accessCount: 6,
 *   importance: 0.9,
 *   type: 'semantic'
 * });
 * ```
 */
export async function extendTTL(params: {
  key: string;
  accessCount: number;
  importance: number;
  type?: MemoryType;
  config?: Partial<TTLManagerConfig>;
}): Promise<TTLExtensionResult> {
  // In production, get remaining TTL from Redis:
  // const remainingTTL = await redisClient.ttl(params.key);
  
  // Reference implementation (simulated)
  const remainingTTL = 3600; // Simulated 1 hour remaining
  
  // Calculate new TTL based on access
  const newTTL = calculateTTL({
    importance: params.importance,
    accessCount: params.accessCount,
    type: params.type,
    config: params.config,
  });
  
  // In production, use Redis EXPIRE:
  // await redisClient.expire(params.key, newTTL);
  
  console.log(`[Redis TTL Manager] EXPIRE ${params.key} ${newTTL}s`);
  
  return {
    success: true,
    key: params.key,
    newTTL,
    previousTTL: remainingTTL,
    remainingTTL,
  };
}

/**
 * Gets cache health metrics
 * 
 * @returns Cache health metrics
 * 
 * @example
 * ```typescript
 * const health = await getCacheHealth();
 * console.log(`Hit rate: ${(health.hitRate * 100).toFixed(1)}%`);
 * ```
 */
export async function getCacheHealth(): Promise<CacheHealth> {
  // In production, query Redis INFO:
  // const info = await redisClient.info('stats');
  // const keyspace = await redisClient.info('keyspace');
  
  // Reference implementation (simulated)
  return {
    totalKeys: 0,
    avgTTL: DEFAULT_TTL_CONFIG.baseTTLSeconds,
    hitRate: 0.85,
    missRate: 0.15,
    expiredCount: 0,
    evictedCount: 0,
    memoryUsage: 0,
  };
}

/**
 * Calculates cache key for a memory
 */
export function calculateCacheKey(params: {
  type: MemoryType;
  memoryId: string;
}): string {
  return `agemem:${params.type}:${params.memoryId}`;
}

/**
 * Validates TTL configuration
 */
export function validateTTLConfig(config: Partial<TTLManagerConfig>): {
  valid: boolean;
  errors: string[];
  fixed: TTLManagerConfig;
} {
  const errors: string[] = [];
  const fixed = { ...DEFAULT_TTL_CONFIG, ...config };
  
  if (fixed.minTTLSeconds > fixed.maxTTLSeconds) {
    errors.push('minTTLSeconds cannot be greater than maxTTLSeconds');
    fixed.minTTLSeconds = Math.min(fixed.minTTLSeconds, fixed.maxTTLSeconds);
  }
  
  if (fixed.baseTTLSeconds < fixed.minTTLSeconds) {
    errors.push('baseTTLSeconds cannot be less than minTTLSeconds');
    fixed.baseTTLSeconds = Math.max(fixed.baseTTLSeconds, fixed.minTTLSeconds);
  }
  
  if (fixed.baseTTLSeconds > fixed.maxTTLSeconds) {
    errors.push('baseTTLSeconds cannot be greater than maxTTLSeconds');
    fixed.baseTTLSeconds = Math.min(fixed.baseTTLSeconds, fixed.maxTTLSeconds);
  }
  
  if (fixed.importanceMultiplier < 0) {
    errors.push('importanceMultiplier must be non-negative');
    fixed.importanceMultiplier = Math.abs(fixed.importanceMultiplier);
  }
  
  if (fixed.accessBonusMultiplier < 0) {
    errors.push('accessBonusMultiplier must be non-negative');
    fixed.accessBonusMultiplier = Math.abs(fixed.accessBonusMultiplier);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fixed,
  };
}

/**
 * Generates TTL report for monitoring
 */
export function generateTTLReport(params: {
  memories: Array<{
    id: string;
    type: MemoryType;
    importance: number;
    accessCount: number;
    ageInDays: number;
  }>;
}): string {
  const report: string[] = [
    '# Redis TTL Manager Report',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## TTL Calculations',
    '',
    '| Memory ID | Type | Importance | Accesses | Age (days) | TTL |',
    '|-----------|------|------------|----------|------------|-----|',
  ];
  
  for (const memory of params.memories) {
    const ttl = calculateTTL({
      importance: memory.importance,
      accessCount: memory.accessCount,
      ageInDays: memory.ageInDays,
      type: memory.type,
    });
    
    const ttlFormatted = ttl < 3600 
      ? `${Math.floor(ttl / 60)}m` 
      : ttl < 86400 
        ? `${Math.floor(ttl / 3600)}h` 
        : `${Math.floor(ttl / 86400)}d`;
    
    report.push(
      `| ${memory.id.substring(0, 8)}... | ${memory.type} | ${memory.importance.toFixed(2)} | ${memory.accessCount} | ${memory.ageInDays.toFixed(1)} | ${ttlFormatted} |`
    );
  }
  
  return report.join('\n');
}
