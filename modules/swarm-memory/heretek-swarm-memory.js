/**
 * Heretek Swarm Memory Layer
 * 
 * Cross-agent memory sharing with triad-gated access and consciousness-aware consolidation.
 * Implements Heretek differentiators from HERETEK_ARCHITECTURE_STRATEGY.md section 4.2.2
 */

const { Redis } = require('ioredis');
const { Pool } = require('pg');

class HeretekSwarmMemory {
  constructor(options = {}) {
    this.redis = new Redis(options.redisUrl || 'redis://localhost:6379');
    this.pgvector = new Pool({
      connectionString: options.postgresUrl || 'postgresql://localhost:5432/openclaw',
    });
    
    this.consciousnessLevels = ['GWT', 'IIT', 'AST', 'intrinsic'];
  }

  /**
   * Share memory across agents (optionally requires triad consensus)
   * @param {string} agentId - The sharing agent
   * @param {Object} memory - Memory object to share
   * @param {boolean} requiresTriadConsensus - Whether triad approval is needed
   */
  async share(agentId, memory, requiresTriadConsensus = false) {
    const memoryId = `mem:${Date.now()}:${agentId}`;
    
    // High-value memories require triad approval
    if (requiresTriadConsensus || memory.accessibility === 'swarm') {
      const consensus = await this.requestTriadConsensus({
        type: 'memory_share',
        agentId,
        memoryId,
        accessibility: memory.accessibility,
        consciousnessLevel: memory.consciousnessLevel
      });
      
      if (!consensus.approved) {
        throw new Error(`Triad denied memory share request: ${consensus.reason}`);
      }
    }

    // Store in Redis for real-time access
    const redisKey = `swarm:memory:${memoryId}`;
    await this.redis.hset(redisKey, {
      agentId,
      content: JSON.stringify(memory.content),
      timestamp: Date.now(),
      accessibility: memory.accessibility || 'triad',
      consciousnessLevel: memory.consciousnessLevel || 'none',
      consciousnessMarkers: JSON.stringify(memory.consciousnessMarkers || []),
      tags: JSON.stringify(memory.tags || [])
    });

    // Set TTL based on memory type
    const ttl = this.getMemoryTTL(memory);
    if (ttl > 0) {
      await this.redis.expire(redisKey, ttl);
    }

    // Index in pgvector for semantic search
    await this.indexInPgVector(memoryId, memory);

    // Publish to all subscribed agents
    await this.redis.publish('swarm:memory:update', JSON.stringify({
      action: 'share',
      agentId,
      memoryId,
      consciousnessLevel: memory.consciousnessLevel,
      timestamp: Date.now()
    }));

    return { memoryId, success: true };
  }

  /**
   * Retrieve memories with optional consciousness context enrichment
   * @param {string} query - Search query
   * @param {string} agentId - Requesting agent
   * @param {boolean} includeConsciousnessContext - Whether to enrich with GWT/IIT/AST context
   */
  async retrieve(query, agentId, includeConsciousnessContext = true) {
    // Vector search across swarm memories
    const results = await this.vectorSearch(query, {
      accessibleBy: agentId
    });

    if (includeConsciousnessContext) {
      return this.enrichWithConsciousnessContext(results, agentId);
    }

    return results;
  }

  /**
   * Request triad consensus for memory operations
   */
  async requestTriadConsensus(request) {
    const requestId = `consensus:${Date.now()}:${request.type}`;
    
    // Publish to triad channel
    await this.redis.publish('triad:consensus_requests', JSON.stringify({
      id: requestId,
      ...request,
      timestamp: Date.now()
    }));

    // Wait for consensus decision (with timeout)
    const decision = await this.waitForConsensus(requestId, 30000);
    return decision || { approved: false, reason: 'timeout' };
  }

  /**
   * Wait for triad consensus decision
   */
  async waitForConsensus(requestId, timeoutMs) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const decisionKey = `consensus:decision:${requestId}`;
      const decision = await this.redis.get(decisionKey);
      
      if (decision) {
        return JSON.parse(decision);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return null;
  }

  /**
   * Index memory in pgvector for semantic search
   */
  async indexInPgVector(memoryId, memory) {
    const client = await this.pgvector.connect();
    
    try {
      // Generate embedding (would use actual embedding model in production)
      const embedding = await this.generateEmbedding(memory.content);
      
      await client.query(`
        INSERT INTO swarm_memories (id, agent_id, content, embedding, consciousness_level, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          content = $3,
          embedding = $4,
          consciousness_level = $5
      `, [
        memoryId,
        memory.agentId,
        JSON.stringify(memory.content),
        embedding,
        memory.consciousnessLevel || 'none'
      ]);
    } finally {
      client.release();
    }
  }

  /**
   * Vector similarity search with accessibility filtering
   */
  async vectorSearch(query, filters = {}) {
    const client = await this.pgvector.connect();
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      const result = await client.query(`
        SELECT id, agent_id, content, consciousness_level, 
               1 - (embedding <=> $1) AS similarity
        FROM swarm_memories
        WHERE accessibility = ANY($2) OR agent_id = $3
        ORDER BY embedding <=> $1
        LIMIT 10
      `, [
        queryEmbedding,
        ['swarm', 'triad'],
        filters.accessibleBy
      ]);

      return result.rows.map(row => ({
        memoryId: row.id,
        agentId: row.agent_id,
        content: JSON.parse(row.content),
        consciousnessLevel: row.consciousness_level,
        similarity: row.similarity
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Enrich results with consciousness context (GWT broadcast simulation)
   */
  enrichWithConsciousnessContext(results, agentId) {
    return results.map(result => {
      const enriched = { ...result };
      
      // Add consciousness context markers
      if (result.consciousnessLevel !== 'none') {
        enriched.consciousnessContext = {
          broadcast: true, // GWT: information available to all modules
          integration: this.calculateIntegrationScore(result), // IIT: phi-like metric
          attentionRelevance: this.calculateAttentionRelevance(result, agentId) // AST
        };
      }
      
      return enriched;
    });
  }

  /**
   * Calculate integration score (IIT-inspired phi metric estimation)
   */
  calculateIntegrationScore(memory) {
    // Simplified: count connections to other memories
    const markerCount = (memory.consciousnessMarkers || []).length;
    return Math.min(1.0, markerCount / 5); // Normalize to 0-1
  }

  /**
   * Calculate attention relevance (AST-inspired)
   */
  calculateAttentionRelevance(memory, agentId) {
    // Simplified: based on recency and consciousness level
    const recencyWeight = 0.7;
    const consciousnessWeight = 0.3;
    
    return recencyWeight * 0.8 + consciousnessWeight * (memory.consciousnessLevel !== 'none' ? 1 : 0);
  }

  /**
   * Get TTL for memory based on type
   */
  getMemoryTTL(memory) {
    if (memory.type === 'episodic') return 86400 * 7; // 7 days
    if (memory.type === 'semantic') return 86400 * 30; // 30 days
    if (memory.accessibility === 'swarm') return 86400 * 365; // 1 year
    return 86400; // Default 1 day
  }

  /**
   * Generate embedding placeholder (replace with actual embedding model)
   */
  async generateEmbedding(text) {
    // TODO: Integrate with Ollama embeddings or external embedding service
    // For now, return a dummy embedding array
    const textStr = typeof text === 'string' ? text : JSON.stringify(text);
    const hash = textStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Create 1536-dim embedding (OpenAI-compatible size)
    return Array(1536).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
  }
}

module.exports = { HeretekSwarmMemory };
