/**
 * Cross-Tier Correlator Lobe
 * 
 * Discovers and maintains relationships between memories across tiers:
 * - Episodic (experiences) ↔ Semantic (facts) ↔ Procedural (skills)
 * - Link discovery using content analysis and semantic similarity
 * - Correlation scoring and ranking
 * - Graph navigation and traversal
 * 
 * @module cross-tier-correlator
 * @see {@link ../memory-consolidation/decay.ts} for AgeMem integration
 */

/** Memory type for correlation */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'archival';

/** Relationship types between memories */
export type RelationshipType =
  | 'references'
  | 'derives_from'
  | 'contradicts'
  | 'supports'
  | 'generalizes'
  | 'specializes'
  | 'temporal_sequence'
  | 'causal';

/** Correlator configuration */
export interface CorrelatorConfig {
  /** Enable correlation */
  enabled: boolean;
  /** Minimum correlation score threshold */
  minCorrelationScore: number;
  /** Maximum links per memory */
  maxLinksPerMemory: number;
  /** Enable auto-discovery on memory add */
  autoDiscoverEnabled: boolean;
  /** Time constant for temporal proximity (days) */
  temporalTimeConstant: number;
}

/** Default configuration */
export const DEFAULT_CORRELATOR_CONFIG: CorrelatorConfig = {
  enabled: true,
  minCorrelationScore: 0.6,
  maxLinksPerMemory: 50,
  autoDiscoverEnabled: true,
  temporalTimeConstant: 7, // 7 days
};

/** A discovered correlation between memories */
export interface Correlation {
  /** Target memory ID */
  targetId: string;
  /** Target memory type */
  targetType: MemoryType;
  /** Type of relationship */
  relationshipType: RelationshipType;
  /** Correlation score (0-1) */
  score: number;
  /** Human-readable reason */
  reason: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Result of correlation search */
export interface CorrelationResult {
  /** Source memory ID */
  memoryId: string;
  /** Found correlations */
  correlations: Correlation[];
  /** Total found (before limiting) */
  totalFound: number;
}

/** Result of relationship creation */
export interface RelationshipResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Source memory ID */
  sourceId: string;
  /** Target memory ID */
  targetId: string;
  /** Relationship type */
  relationshipType: RelationshipType;
  /** Relationship score */
  score: number;
  /** Timestamp */
  timestamp: string;
  /** Optional error message */
  error?: string;
}

/** A node in the correlation graph */
export interface GraphNode {
  /** Memory ID */
  id: string;
  /** Memory type */
  type: MemoryType;
  /** Optional content snippet */
  content?: string;
}

/** An edge in the correlation graph */
export interface GraphEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Relationship type */
  relationshipType: RelationshipType;
  /** Edge weight (correlation score) */
  weight: number;
}

/** Correlation graph structure */
export interface CorrelationGraph {
  /** Graph nodes */
  nodes: GraphNode[];
  /** Graph edges */
  edges: GraphEdge[];
  /** Metadata about the graph */
  metadata: {
    /** Number of nodes */
    nodeCount: number;
    /** Number of edges */
    edgeCount: number;
    /** Average edge weight */
    avgWeight: number;
  };
}

/** Discovered link from content analysis */
export interface DiscoveredLink {
  /** Target memory ID */
  targetId: string;
  /** Target memory type */
  targetType: MemoryType;
  /** Relationship type */
  relationshipType: RelationshipType;
  /** Confidence score */
  score: number;
  /** Reason for discovery */
  reason: string;
}

/** Parameters for correlation search */
export interface CorrelationSearchParams {
  /** Source memory ID */
  memoryId: string;
  /** Source memory type */
  type: MemoryType;
  /** Maximum results to return */
  maxResults?: number;
  /** Minimum score threshold */
  minScore?: number;
  /** Filter by relationship types */
  relationshipTypes?: RelationshipType[];
  /** Override config */
  config?: Partial<CorrelatorConfig>;
}

/** Parameters for link discovery */
export interface LinkDiscoveryParams {
  /** Memory ID being analyzed */
  memoryId: string;
  /** Memory content */
  content: string;
  /** Memory type */
  type: MemoryType;
  /** Search space (memory types to search) */
  searchSpace?: MemoryType[];
}

/**
 * Extracts entities from content for correlation analysis
 */
export function extractEntities(content: string): string[] {
  const entities: Set<string> = new Set();
  
  // Technical terms (camelCase, snake_case)
  const techPattern = /[a-z]+(?:[A-Z][a-z]+)+|[a-z]+_[a-z]+/g;
  const techMatches = content.match(techPattern);
  if (techMatches) {
    techMatches.forEach(e => entities.add(e.toLowerCase()));
  }
  
  // Capitalized words (potential named entities)
  const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const capitalizedMatches = content.match(capitalizedPattern);
  if (capitalizedMatches) {
    capitalizedMatches.forEach(e => {
      // Filter out common words
      const lower = e.toLowerCase();
      if (!['The', 'A', 'An', 'And', 'Or', 'But'].includes(lower)) {
        entities.add(e);
      }
    });
  }
  
  // Version numbers, protocols
  const versionPattern = /v?\d+\.\d+(?:\.\d+)?|[A-Z]{2,}/g;
  const versionMatches = content.match(versionPattern);
  if (versionMatches) {
    versionMatches.forEach(e => entities.add(e));
  }
  
  return Array.from(entities);
}

/**
 * Calculates Jaccard similarity between two sets
 */
export function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

/**
 * Calculates semantic similarity using cosine similarity approximation
 * 
 * In production, this would use actual embeddings. This is a
 * content-based approximation using term frequency.
 */
export function calculateSemanticSimilarity(contentA: string, contentB: string): number {
  // Tokenize and normalize
  const tokenize = (text: string): string[] =>
    text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  const tokensA = tokenize(contentA);
  const tokensB = tokenize(contentB);
  
  // Create term frequency vectors
  const tfA: Record<string, number> = {};
  const tfB: Record<string, number> = {};
  
  tokensA.forEach(t => tfA[t] = (tfA[t] || 0) + 1);
  tokensB.forEach(t => tfB[t] = (tfB[t] || 0) + 1);
  
  // Calculate cosine similarity
  const allTerms = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (const term of allTerms) {
    const a = tfA[term] || 0;
    const b = tfB[term] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculates temporal proximity score
 */
export function calculateTemporalProximity(
  timestampA: Date,
  timestampB: Date,
  timeConstantDays: number = 7
): number {
  const diffMs = Math.abs(timestampA.getTime() - timestampB.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  // Exponential decay: e^(-|t1-t2|/τ)
  return Math.exp(-diffDays / timeConstantDays);
}

/**
 * Calculates overall correlation score
 */
export function calculateCorrelationScore(params: {
  semanticSimilarity: number;
  coOccurrence: number;
  temporalProximity?: number;
  crossReference: number;
  weights?: {
    semantic: number;
    coOccurrence: number;
    temporal: number;
    crossReference: number;
  };
}): number {
  const weights = params.weights ?? {
    semantic: 0.40,
    coOccurrence: 0.25,
    temporal: 0.15,
    crossReference: 0.20,
  };
  
  const temporal = params.temporalProximity ?? 0.5; // Default if not provided
  
  const score =
    params.semanticSimilarity * weights.semantic +
    params.coOccurrence * weights.coOccurrence +
    temporal * weights.temporal +
    params.crossReference * weights.crossReference;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Determines relationship type based on content analysis
 */
export function determineRelationshipType(params: {
  sourceType: MemoryType;
  targetType: MemoryType;
  sourceContent: string;
  targetContent: string;
  entitiesA: string[];
  entitiesB: string[];
}): RelationshipType {
  const { sourceType, targetType } = params;
  
  // Check for explicit references
  const refPatterns = [
    /refer(ence|s|ring)/i,
    /mention(ed|s)?/i,
    /see also/i,
    /as stated/i,
  ];
  
  const combinedContent = `${params.sourceContent} ${params.targetContent}`;
  const hasExplicitReference = refPatterns.some(p => p.test(combinedContent));
  
  if (hasExplicitReference) {
    return 'references';
  }
  
  // Episodic → Semantic: usually derives_from or supports
  if (sourceType === 'episodic' && targetType === 'semantic') {
    return 'supports';
  }
  
  // Semantic → Episodic: usually references
  if (sourceType === 'semantic' && targetType === 'episodic') {
    return 'references';
  }
  
  // Procedural ← Episodic: generalizes
  if (sourceType === 'procedural' && targetType === 'episodic') {
    return 'generalizes';
  }
  
  // Episodic → Procedural: specializes
  if (sourceType === 'episodic' && targetType === 'procedural') {
    return 'specializes';
  }
  
  // Same type: temporal sequence for episodic
  if (sourceType === targetType && sourceType === 'episodic') {
    return 'temporal_sequence';
  }
  
  // Default
  return 'references';
}

/**
 * Finds memories related to a given memory across tiers
 * 
 * @param params - Correlation search parameters
 * @returns Correlation result with found relationships
 * 
 * @example
 * ```typescript
 * const result = await findCorrelations({
 *   memoryId: '550e8400-e29b-41d4-a716-446655440000',
 *   type: 'episodic',
 *   maxResults: 10,
 *   minScore: 0.6
 * });
 * ```
 */
export async function findCorrelations(
  params: CorrelationSearchParams,
): Promise<CorrelationResult> {
  const config = { ...DEFAULT_CORRELATOR_CONFIG, ...params.config };
  
  if (!config.enabled) {
    return {
      memoryId: params.memoryId,
      correlations: [],
      totalFound: 0,
    };
  }
  
  // In production, this would:
  // 1. Query memory store for candidate memories
  // 2. Calculate correlations with each candidate
  // 3. Filter by minScore and relationshipTypes
  // 4. Sort by score and limit to maxResults
  
  // Reference implementation (simulated)
  const correlations: Correlation[] = [];
  
  // Simulated correlations for demonstration
  console.log(`[Cross-Tier Correlator] Finding correlations for ${params.memoryId}`);
  
  return {
    memoryId: params.memoryId,
    correlations,
    totalFound: 0,
  };
}

/**
 * Creates a relationship between two memories
 * 
 * @param params - Relationship creation parameters
 * @returns Relationship result
 * 
 * @example
 * ```typescript
 * const result = await addRelationship({
 *   sourceId: 'episode-001',
 *   targetId: 'semantic-042',
 *   relationshipType: 'references',
 *   score: 0.85
 * });
 * ```
 */
export async function addRelationship(params: {
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  score?: number;
  metadata?: Record<string, unknown>;
}): Promise<RelationshipResult> {
  const timestamp = new Date().toISOString();
  const score = params.score ?? 0.5;
  
  // In production, this would:
  // 1. Validate source and target exist
  // 2. Check for existing relationship
  // 3. Insert relationship into store
  // 4. Update memory metadata
  
  console.log(
    `[Cross-Tier Correlator] Adding relationship: ${params.sourceId} --[${params.relationshipType}:${score}]--> ${params.targetId}`
  );
  
  return {
    success: true,
    sourceId: params.sourceId,
    targetId: params.targetId,
    relationshipType: params.relationshipType,
    score,
    timestamp,
  };
}

/**
 * Automatically discovers potential links using content analysis
 * 
 * @param params - Link discovery parameters
 * @returns Array of discovered links
 * 
 * @example
 * ```typescript
 * const links = await discoverLinks({
 *   memoryId: 'new-episode-001',
 *   content: 'Discussed PostgreSQL pgvector integration',
 *   type: 'episodic',
 *   searchSpace: ['semantic', 'procedural']
 * });
 * ```
 */
export async function discoverLinks(
  params: LinkDiscoveryParams,
): Promise<DiscoveredLink[]> {
  const config = DEFAULT_CORRELATOR_CONFIG;
  
  if (!config.enabled) {
    return [];
  }
  
  // Extract entities from content
  const entities = extractEntities(params.content);
  const searchSpace = params.searchSpace ?? ['episodic', 'semantic', 'procedural'];
  
  const links: DiscoveredLink[] = [];
  
  // In production, this would:
  // 1. Query memory store for memories with matching entities
  // 2. Calculate correlation scores
  // 3. Filter by minCorrelationScore
  // 4. Return ranked links
  
  console.log(
    `[Cross-Tier Correlator] Discovering links for ${params.memoryId}, entities: ${entities.join(', ')}`
  );
  
  return links;
}

/**
 * Builds a correlation graph for a set of memories
 * 
 * @param params - Graph building parameters
 * @returns Correlation graph
 * 
 * @example
 * ```typescript
 * const graph = await buildCorrelationGraph({
 *   memoryIds: ['mem-001', 'mem-002', 'mem-003'],
 *   includeTypes: ['episodic', 'semantic'],
 *   maxDepth: 2
 * });
 * ```
 */
export async function buildCorrelationGraph(params: {
  memoryIds: string[];
  includeTypes?: MemoryType[];
  maxDepth?: number;
}): Promise<CorrelationGraph> {
  const nodes: GraphNode[] = params.memoryIds.map(id => ({
    id,
    type: 'episodic', // Would be determined from memory store
  }));
  
  const edges: GraphEdge[] = [];
  
  // In production, this would:
  // 1. Get correlations for each memory
  // 2. Build graph structure
  // 3. Traverse to maxDepth
  // 4. Calculate metadata
  
  const edgeCount = edges.length;
  const avgWeight = edges.length > 0
    ? edges.reduce((sum, e) => sum + e.weight, 0) / edges.length
    : 0;
  
  return {
    nodes,
    edges,
    metadata: {
      nodeCount: nodes.length,
      edgeCount,
      avgWeight,
    },
  };
}

/**
 * Generates a correlation report for monitoring
 */
export function generateCorrelationReport(params: {
  memoryId: string;
  correlations: Correlation[];
}): string {
  const report: string[] = [
    '# Cross-Tier Correlation Report',
    `**Generated:** ${new Date().toISOString()}`,
    `**Seed Memory:** ${params.memoryId}`,
    '',
    `## Direct Correlations (${params.correlations.length})`,
    '',
    '| Target | Type | Relationship | Score | Reason |',
    '|--------|------|--------------|-------|--------|',
  ];
  
  for (const corr of params.correlations) {
    report.push(
      `| ${corr.targetId.substring(0, 8)}... | ${corr.targetType} | ${corr.relationshipType} | ${corr.score.toFixed(2)} | ${corr.reason} |`
    );
  }
  
  // Tier distribution
  const tierCounts: Record<MemoryType, number> = {
    working: 0,
    episodic: 0,
    semantic: 0,
    procedural: 0,
    archival: 0,
  };
  
  params.correlations.forEach(c => tierCounts[c.targetType]++);
  
  report.push('', '## Tier Distribution', '');
  report.push('| Tier | Count |');
  report.push('|------|-------|');
  
  for (const [tier, count] of Object.entries(tierCounts)) {
    if (count > 0) {
      report.push(`| ${tier} | ${count} |`);
    }
  }
  
  return report.join('\n');
}
