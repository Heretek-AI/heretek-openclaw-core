/**
 * Heretek Swarm Memory Layer
 * 
 * Cross-agent memory sharing with triad-gated access and consciousness-aware consolidation.
 * Implements Heretek differentiators from HERETEK_ARCHITECTURE_STRATEGY.md section 4.2.2
 */

const { Redis } = require('ioredis');
const { Pool } = require('pg');
const fetch = require('node-fetch');

class HeretekSwarmMemory {
  constructor(options = {}) {
    this.redis = new Redis(options.redisUrl || 'redis://localhost:6379');
    this.pgvector = new Pool({
      connectionString: options.postgresUrl || 'postgresql://localhost:5432/openclaw',
    });
    
    this.consciousnessLevels = ['GWT', 'IIT', 'AST', 'intrinsic'];
    this.lineageGraph = new Map(); // In-memory causal graph
    
    // Embedding service configuration
    this.embeddingService = options.embeddingService || 'ollama';
    this.ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = options.embeddingModel || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text-v2-moe';
    this.embeddingDimension = options.embeddingDimension || 768; // nomic-embed-text-v2-moe default
  }

  /**
   * Share memory across agents (optionally requires triad consensus)
   * @param {string} agentId - The sharing agent
   * @param {Object} memory - Memory object to share
   * @param {boolean} requiresTriadConsensus - Whether triad approval is needed
   */
  async share(agentId, memory, requiresTriadConsensus = false) {
    const memoryId = `mem:${Date.now()}:${agentId}`;
    
    // Add lineage tracking (Langroid pattern)
    const lineage = {
      parentId: memory.parentId || null,
      timestamp: Date.now(),
      agentId,
      depth: memory.parentId ? (this.getLineageDepth(memory.parentId) + 1) : 0
    };
    
    // Update causal graph
    this.lineageGraph.set(memoryId, lineage);
    if (memory.parentId) {
      const parentChildren = this.lineageGraph.get(memory.parentId)?.children || [];
      parentChildren.push(memoryId);
      this.lineageGraph.set(memory.parentId, { ...this.lineageGraph.get(memory.parentId), children: parentChildren });
    }
    
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
      tags: JSON.stringify(memory.tags || []),
      lineage: JSON.stringify(lineage)
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

    return { memoryId, success: true, lineage };
  }

  /**
   * Get lineage depth for a memory
   */
  getLineageDepth(memoryId) {
    const lineage = this.lineageGraph.get(memoryId);
    if (!lineage || !lineage.parentId) return 0;
    return this.getLineageDepth(lineage.parentId) + 1;
  }

  /**
   * Rewind to before a specific message (Langroid-style debugging)
   * @param {string} memoryId - Memory to rewind from
   * @returns {Promise<Array>} Prior memories in causal chain
   */
  async rewind(memoryId) {
    const lineage = this.lineageGraph.get(memoryId);
    if (!lineage) return [];
    
    const priorMemories = [];
    let currentId = lineage.parentId;
    
    while (currentId) {
      const data = await this.redis.hgetall(`swarm:memory:${currentId}`);
      if (data) {
        priorMemories.push({
          memoryId: currentId,
          content: JSON.parse(data.content),
          lineage: JSON.parse(data.lineage || '{}')
        });
      }
      const parentLineage = this.lineageGraph.get(currentId);
      currentId = parentLineage?.parentId || null;
    }
    
    return priorMemories;
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
   * Generate embeddings using configured embedding service
   * 
   * Supports multiple embedding backends:
   * - Ollama (local, recommended for development)
   * - OpenAI (production, high quality)
   * - Custom embedding service via HTTP API
   * 
   * @param {string|string[]} text - Text or array of texts to embed
   * @returns {Promise<number[]|number[][]>} - Embedding vector(s)
   */
  async generateEmbedding(text) {
    const texts = Array.isArray(text) ? text : [text];
    
    try {
      switch (this.embeddingService) {
        case 'ollama':
          return await this._generateOllamaEmbedding(texts);
        
        case 'openai':
          return await this._generateOpenAIEmbedding(texts);
        
        case 'custom':
          return await this._generateCustomEmbedding(texts);
        
        default:
          throw new Error(`Unknown embedding service: ${this.embeddingService}`);
      }
    } catch (error) {
      console.error('[HeretekSwarmMemory] Embedding generation failed:', error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings using Ollama (local embedding service)
   * @private
   */
  async _generateOllamaEmbedding(texts) {
    const embeddings = [];
    
    for (const text of texts) {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      embeddings.push(data.embedding);
    }

    // Return single embedding if single text was provided
    return texts.length === 1 ? embeddings[0] : embeddings;
  }

  /**
   * Generate embeddings using OpenAI API
   * @private
   */
  async _generateOpenAIEmbedding(texts) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid embedding response from OpenAI');
    }

    // Sort by index to maintain order
    const sortedEmbeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);

    return texts.length === 1 ? sortedEmbeddings[0] : sortedEmbeddings;
  }

  /**
   * Generate embeddings using custom HTTP embedding service
   * @private
   */
  async _generateCustomEmbedding(texts) {
    const customUrl = process.env.CUSTOM_EMBEDDING_URL;
    const customApiKey = process.env.CUSTOM_EMBEDDING_API_KEY;
    
    if (!customUrl) {
      throw new Error('CUSTOM_EMBEDDING_URL environment variable not set');
    }

    const response = await fetch(customUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(customApiKey && { 'Authorization': `Bearer ${customApiKey}` }),
      },
      body: JSON.stringify({
        texts: texts,
        model: this.embeddingModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Custom embedding service returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error('Invalid embedding response from custom service');
    }

    return texts.length === 1 ? data.embeddings[0] : data.embeddings;
  }

  /**
   * Validate embedding vector dimensions
   * @param {number[]} embedding - Embedding vector to validate
   * @returns {boolean} - True if valid
   */
  validateEmbedding(embedding) {
    if (!Array.isArray(embedding)) {
      return false;
    }
    
    if (embedding.length !== this.embeddingDimension) {
      console.warn(
        `[HeretekSwarmMemory] Embedding dimension mismatch: expected ${this.embeddingDimension}, got ${embedding.length}`
      );
      return false;
    }
    
    // Check for NaN or Infinity values
    for (const value of embedding) {
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        return false;
      }
    }
    
    return true;
  }
}

module.exports = { HeretekSwarmMemory };
