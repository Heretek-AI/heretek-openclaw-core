/**
 * Importance Scorer Lobe
 * 
 * Calculates and assigns importance scores to memories based on:
 * - Content analysis (semantic density, entities, uniqueness)
 * - User signals (explicit ratings, feedback)
 * - Access patterns (frequency, recency)
 * - Emotional salience (sentiment, emotional markers)
 * - Contextual relevance (current goals, projects)
 * 
 * @module importance-scorer
 * @see {@link ../memory-consolidation/decay.ts} for AgeMem integration
 */

/** Memory type for importance scoring */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'archival';

/** Importance scoring configuration */
export interface ImportanceScorerConfig {
  /** Enable content analysis */
  contentWeight: number;
  /** Enable user signal weighting */
  userSignalWeight: number;
  /** Enable access pattern scoring */
  accessPatternWeight: number;
  /** Enable emotional salience scoring */
  emotionalWeight: number;
  /** Enable contextual relevance scoring */
  contextualWeight: number;
  /** Minimum importance score (floor) */
  minImportance: number;
  /** Maximum importance score (cap) */
  maxImportance: number;
}

/** Default configuration - weights sum to 1.0 */
export const DEFAULT_IMPORTANCE_SCORER_CONFIG: ImportanceScorerConfig = {
  contentWeight: 0.30,
  userSignalWeight: 0.25,
  accessPatternWeight: 0.20,
  emotionalWeight: 0.15,
  contextualWeight: 0.10,
  minImportance: 0.1,
  maxImportance: 1.0,
};

/** Content analysis breakdown */
export interface ContentAnalysisResult {
  /** Semantic density (0-1) */
  semanticDensity: number;
  /** Entity count score (0-1) */
  entityCount: number;
  /** Uniqueness score (0-1) */
  uniqueness: number;
  /** Actionability score (0-1) */
  actionability: number;
  /** Factual content score (0-1) */
  factualContent: number;
  /** Cross-reference score (0-1) */
  crossReferences: number;
  /** Overall content score (0-1) */
  overallScore: number;
}

/** Importance breakdown by factor */
export interface ImportanceBreakdown {
  /** Content analysis score */
  content: number;
  /** User-provided signal score */
  userSignal: number;
  /** Access pattern score */
  access: number;
  /** Emotional salience score */
  emotional: number;
  /** Contextual relevance score */
  contextual: number;
}

/** Importance scoring result */
export interface ImportanceResult {
  /** Final importance score (0-1) */
  score: number;
  /** Breakdown by factor */
  breakdown: ImportanceBreakdown;
  /** Confidence in score (0-1) */
  confidence: number;
  /** Key factors influencing score */
  factors: string[];
  /** Content analysis details */
  contentAnalysis?: ContentAnalysisResult;
}

/** Parameters for importance calculation */
export interface ImportanceParams {
  /** Memory content to analyze */
  content: string;
  /** Memory type (affects baseline) */
  type?: MemoryType;
  /** Explicit user rating (0-1) */
  userProvidedImportance?: number;
  /** Number of times accessed */
  accessCount?: number;
  /** Recency factor (0-1) */
  recencyScore?: number;
  /** Emotional salience (0-1) */
  emotionalScore?: number;
  /** Current context match (0-1) */
  contextualRelevance?: number;
  /** Additional context */
  metadata?: Record<string, unknown>;
  /** Override config */
  config?: Partial<ImportanceScorerConfig>;
}

/** Base importance by memory type */
const MEMORY_TYPE_BASELINE: Record<MemoryType, number> = {
  working: 0.3,
  episodic: 0.5,
  semantic: 0.7,
  procedural: 0.8,
  archival: 0.6,
};

/**
 * Analyzes content for semantic density, entities, and other factors
 */
export function analyzeContent(content: string): ContentAnalysisResult {
  if (!content || content.trim().length === 0) {
    return {
      semanticDensity: 0,
      entityCount: 0,
      uniqueness: 0.5, // Neutral default
      actionability: 0,
      factualContent: 0,
      crossReferences: 0,
      overallScore: 0,
    };
  }

  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Semantic density: ratio of meaningful words (longer words tend to be more meaningful)
  const meaningfulWords = words.filter(w => w.length >= 5);
  const semanticDensity = wordCount > 0 ? meaningfulWords.length / wordCount : 0;

  // Entity count: look for capitalized words, technical terms, numbers
  const entityPattern = /[A-Z][a-z]+|[A-Z]{2,}|\d+\.?\d*|[a-z_]+\.[a-z_]+/g;
  const entities = content.match(entityPattern) || [];
  const entityCount = Math.min(1, entities.length / Math.max(1, wordCount) * 10);

  // Actionability: detect instructions, decisions, tasks
  const actionPatterns = [
    /\b(should|must|need to|have to|decided|will|shall)\b/i,
    /\b(do|make|create|build|implement|add|remove|fix|change)\b/i,
    /\b(task|action|step|todo|decision|conclusion)\b/i,
    /:$/m, // List items
  ];
  const actionabilityScore = actionPatterns.reduce((score, pattern) => {
    return score + (pattern.test(content) ? 0.25 : 0);
  }, 0);
  const actionability = Math.min(1, actionabilityScore);

  // Factual content: detect data, specifications, verifiable statements
  const factualPatterns = [
    /\d+%|\d+\/\d+|\d+-\d+/g, // Numbers, ratios, ranges
    /\b(version|v\d+|release|specification|protocol|API)\b/i,
    /\b(is|are|was|were|has|have|contains?)\b/i, // Declarative statements
  ];
  const factualScore = factualPatterns.reduce((score, pattern) => {
    return score + (pattern.test(content) ? 0.33 : 0);
  }, 0);
  const factualContent = Math.min(1, factualScore);

  // Cross-references: detect links to other concepts
  const crossRefPatterns = [
    /\[[^\]]+\]\([^\)]+\)/, // Markdown links
    /`[^`]+`/, // Code references
    /\b(as mentioned|see also|refer to|related to|cf\.)\b/i,
  ];
  const crossRefCount = crossRefPatterns.reduce((count, pattern) => {
    return count + (pattern.test(content) ? 1 : 0);
  }, 0);
  const crossReferences = Math.min(1, crossRefCount / 3);

  // Uniqueness: simple heuristic based on vocabulary diversity
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const vocabularyDiversity = wordCount > 0 ? uniqueWords.size / wordCount : 0;
  // Higher diversity suggests more unique content
  const uniqueness = Math.min(1, vocabularyDiversity);

  // Calculate overall content score with weighted factors
  const overallScore =
    semanticDensity * 0.20 +
    entityCount * 0.15 +
    uniqueness * 0.20 +
    actionability * 0.15 +
    factualContent * 0.15 +
    crossReferences * 0.15;

  return {
    semanticDensity: normalize(semanticDensity),
    entityCount: normalize(entityCount),
    uniqueness: normalize(uniqueness),
    actionability: normalize(actionability),
    factualContent: normalize(factualContent),
    crossReferences: normalize(crossReferences),
    overallScore: normalize(overallScore),
  };
}

/**
 * Calculates access pattern score based on usage
 */
export function calculateAccessScore(params: {
  accessCount?: number;
  recencyScore?: number;
}): number {
  const accessCount = params.accessCount ?? 0;
  const recencyScore = params.recencyScore ?? 0;

  // Logarithmic scaling for access count (diminishing returns)
  const maxAccessCount = 21; // Cap for normalization
  const accessComponent =
    Math.log10(accessCount + 1) / Math.log10(maxAccessCount + 1);

  // Weighted combination: 60% access frequency, 40% recency
  const score = accessComponent * 0.6 + recencyScore * 0.4;

  return normalize(score);
}

/**
 * Calculates confidence in the importance score
 */
export function calculateConfidence(params: {
  hasUserSignal: boolean;
  contentQuality: number;
  dataCompleteness: number;
}): number {
  const { hasUserSignal, contentQuality, dataCompleteness } = params;

  const userSignalComponent = hasUserSignal ? 0.4 : 0;
  const contentComponent = contentQuality * 0.3;
  const completenessComponent = dataCompleteness * 0.3;

  return normalize(userSignalComponent + contentComponent + completenessComponent);
}

/**
 * Generates explanatory factors for the score
 */
export function generateFactors(
  breakdown: ImportanceBreakdown,
  contentAnalysis?: ContentAnalysisResult,
): string[] {
  const factors: string[] = [];

  if (breakdown.userSignal >= 0.8) {
    factors.push('High user-provided importance');
  } else if (breakdown.userSignal >= 0.5) {
    factors.push('Moderate user-provided importance');
  }

  if (breakdown.contextual >= 0.8) {
    factors.push('Strong contextual relevance');
  }

  if (breakdown.access >= 0.7) {
    factors.push('Frequent access pattern');
  } else if (breakdown.access <= 0.2) {
    factors.push('Low access frequency');
  }

  if (contentAnalysis) {
    if (contentAnalysis.actionability >= 0.7) {
      factors.push('Actionable content (instructions/decisions)');
    }
    if (contentAnalysis.factualContent >= 0.7) {
      factors.push('High factual content');
    }
    if (contentAnalysis.semanticDensity >= 0.7) {
      factors.push('Dense semantic content');
    }
  }

  if (breakdown.emotional >= 0.7) {
    factors.push('High emotional salience');
  }

  if (factors.length === 0) {
    factors.push('Default importance based on memory type');
  }

  return factors;
}

/**
 * Normalizes a value to 0-1 range
 */
export function normalize(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Calculates importance score for a memory candidate
 * 
 * @param params - Importance calculation parameters
 * @returns Importance result with score, breakdown, and confidence
 * 
 * @example
 * ```typescript
 * const result = await calculateImportance({
 *   content: "User prefers TypeScript over JavaScript",
 *   type: "semantic",
 *   userProvidedImportance: 0.9
 * });
 * 
 * console.log(`Importance: ${result.score}`);
 * console.log(`Factors: ${result.factors.join(', ')}`);
 * ```
 */
export async function calculateImportance(
  params: ImportanceParams,
): Promise<ImportanceResult> {
  const config = { ...DEFAULT_IMPORTANCE_SCORER_CONFIG, ...params.config };

  // Analyze content
  const contentAnalysis = analyzeContent(params.content);

  // Calculate user signal score
  const userSignalScore =
    params.userProvidedImportance !== undefined
      ? normalize(params.userProvidedImportance)
      : MEMORY_TYPE_BASELINE[params.type ?? 'episodic'];

  // Calculate access pattern score
  const accessScore = calculateAccessScore({
    accessCount: params.accessCount,
    recencyScore: params.recencyScore,
  });

  // Get emotional score (would integrate with Empath agent in production)
  const emotionalScore = normalize(params.emotionalScore ?? 0.5);

  // Get contextual relevance
  const contextualScore = normalize(params.contextualRelevance ?? 0.5);

  // Calculate weighted importance
  const weightedScore =
    contentAnalysis.overallScore * config.contentWeight +
    userSignalScore * config.userSignalWeight +
    accessScore * config.accessPatternWeight +
    emotionalScore * config.emotionalWeight +
    contextualScore * config.contextualWeight;

  // Apply memory type baseline adjustment
  const typeBaseline = MEMORY_TYPE_BASELINE[params.type ?? 'episodic'];
  const adjustedScore = weightedScore * 0.8 + typeBaseline * 0.2;

  // Clamp to configured range
  const finalScore = Math.max(
    config.minImportance,
    Math.min(config.maxImportance, adjustedScore),
  );

  // Build breakdown
  const breakdown: ImportanceBreakdown = {
    content: contentAnalysis.overallScore,
    userSignal: userSignalScore,
    access: accessScore,
    emotional: emotionalScore,
    contextual: contextualScore,
  };

  // Calculate data completeness
  const dataCompleteness = [
    params.userProvidedImportance !== undefined,
    params.accessCount !== undefined,
    params.recencyScore !== undefined,
    params.emotionalScore !== undefined,
    params.contextualRelevance !== undefined,
  ].filter(Boolean).length / 5;

  // Calculate confidence
  const confidence = calculateConfidence({
    hasUserSignal: params.userProvidedImportance !== undefined,
    contentQuality: contentAnalysis.overallScore,
    dataCompleteness,
  });

  // Generate factors
  const factors = generateFactors(breakdown, contentAnalysis);

  return {
    score: finalScore,
    breakdown,
    confidence,
    factors,
    contentAnalysis,
  };
}

/**
 * Batch calculates importance for multiple memories
 */
export async function batchCalculateImportance(
  memories: Array<{
    content: string;
    type?: MemoryType;
    userProvidedImportance?: number;
    accessCount?: number;
  }>,
): Promise<ImportanceResult[]> {
  return Promise.all(memories.map(memory => calculateImportance(memory)));
}

/**
 * Adjusts importance score based on Ebbinghaus decay
 * 
 * This is a convenience wrapper that combines importance scoring with decay
 * 
 * @see {@link ../memory-consolidation/decay.ts} applyEbbinghausDecayToScore
 */
export async function calculateImportanceWithDecay(params: {
  content: string;
  type?: MemoryType;
  userProvidedImportance?: number;
  accessCount?: number;
  ageInDays: number;
  halfLifeDays: number;
}): Promise<{
  baseImportance: number;
  decayedImportance: number;
  decayMultiplier: number;
}> {
  // Calculate base importance
  const importanceResult = await calculateImportance({
    content: params.content,
    type: params.type,
    userProvidedImportance: params.userProvidedImportance,
    accessCount: params.accessCount,
  });

  const baseScore = importanceResult.score;

  // Calculate decay multiplier: e^(-λt) where λ = ln(2) / halfLifeDays
  const lambda = Math.LN2 / params.halfLifeDays;
  const decayMultiplier = Math.exp(-lambda * Math.max(0, params.ageInDays));

  // Apply decay
  const decayedImportance = baseScore * decayMultiplier;

  return {
    baseImportance: baseScore,
    decayedImportance: Math.max(decayedImportance, baseScore * 0.1), // Floor at 10%
    decayMultiplier,
  };
}

/**
 * Determines if a memory should be promoted based on importance
 */
export function shouldPromote(
  importance: number,
  accessCount: number,
  currentType: MemoryType,
): boolean {
  // Can only promote from episodic to semantic
  if (currentType !== 'episodic') {
    return false;
  }

  // Promote if importance > 0.8 OR access count > 10
  return importance > 0.8 || accessCount > 10;
}

/**
 * Determines if a memory should be archived based on importance and age
 */
export function shouldArchive(
  importance: number,
  ageInDays: number,
  accessCount: number,
): boolean {
  // Archive if: old (>30 days) AND low importance (<0.3) AND no access
  return ageInDays > 30 && importance < 0.3 && accessCount === 0;
}
