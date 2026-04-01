/**
 * Curiosity Engine
 * 
 * Drives exploratory behavior in agents through novelty detection,
 * information gap measurement, and intrinsic motivation.
 */

class CuriosityEngine {
  constructor(options = {}) {
    this.knowledgeBase = options.knowledgeBase || new Map();
    this.curiosityThreshold = options.curiosityThreshold || 0.3;
    this.explorationBudget = options.explorationBudget || 100;
    this.history = [];
    this.noveltyWeights = {
      completelyNew: 1.0,
      partiallyKnown: 0.5,
      wellKnown: 0.1
    };
  }

  /**
   * Calculate curiosity score for a topic/query
   * @param {string} topic - Topic to evaluate
   * @returns {number} Curiosity score (0-1)
   */
  calculateCuriosity(topic) {
    const familiarity = this._getFamiliarity(topic);
    const novelty = 1 - familiarity;
    
    // Apply novelty weights
    let weight = this.noveltyWeights.wellKnown;
    if (novelty > 0.8) {
      weight = this.noveltyWeights.completelyNew;
    } else if (novelty > 0.3) {
      weight = this.noveltyWeights.partiallyKnown;
    }

    const curiosityScore = novelty * weight;
    
    return Math.min(1, Math.max(0, curiosityScore));
  }

  /**
   * Get familiarity level with a topic (0-1)
   */
  _getFamiliarity(topic) {
    const normalizedTopic = topic.toLowerCase().trim();
    
    if (!this.knowledgeBase.has(normalizedTopic)) {
      return 0;
    }

    const entry = this.knowledgeBase.get(normalizedTopic);
    const now = Date.now();
    const age = now - entry.lastAccessed;
    
    // Decay familiarity over time (half-life of 24 hours)
    const decayFactor = Math.pow(0.5, age / (24 * 60 * 60 * 1000));
    
    return entry.familiarity * decayFactor;
  }

  /**
   * Record learning about a topic
   * @param {string} topic - Topic learned about
   * @param {number} depth - Depth of learning (0-1)
   */
  recordLearning(topic, depth = 0.5) {
    const normalizedTopic = topic.toLowerCase().trim();
    const existing = this.knowledgeBase.get(normalizedTopic);
    
    const entry = {
      topic: normalizedTopic,
      familiarity: existing ? Math.min(1, existing.familiarity + depth) : depth,
      firstLearned: existing ? existing.firstLearned : Date.now(),
      lastAccessed: Date.now(),
      accessCount: (existing?.accessCount || 0) + 1,
      relatedTopics: existing?.relatedTopics || []
    };

    this.knowledgeBase.set(normalizedTopic, entry);
    this._recordHistory('learning', topic, depth);
  }

  /**
   * Detect information gaps in knowledge
   * @param {Array} knownTopics - List of known topics
   * @returns {Array} Identified gaps with curiosity scores
   */
  detectGaps(knownTopics) {
    const gaps = [];
    
    // Generate potential related topics
    for (const topic of knownTopics) {
      const related = this._generateRelatedTopics(topic);
      
      for (const relTopic of related) {
        const familiarity = this._getFamiliarity(relTopic);
        
        if (familiarity < this.curiosityThreshold) {
          const curiosityScore = this.calculateCuriosity(relTopic);
          
          if (curiosityScore >= this.curiosityThreshold) {
            gaps.push({
              topic: relTopic,
              curiosityScore,
              familiarity,
              relatedTo: topic
            });
          }
        }
      }
    }

    // Sort by curiosity score descending
    return gaps.sort((a, b) => b.curiosityScore - a.curiosityScore);
  }

  /**
   * Generate related topics for gap detection
   */
  _generateRelatedTopics(topic) {
    // Simple heuristic: add common question words and aspects
    const aspects = ['how', 'why', 'what', 'when', 'where', 'who'];
    const relations = ['causes', 'effects', 'history', 'future', 'examples'];
    
    const related = [];
    
    for (const aspect of aspects) {
      related.push(`${aspect} ${topic}`);
    }
    
    for (const relation of relations) {
      related.push(`${topic} ${relation}`);
    }

    return related.slice(0, 5); // Limit to prevent explosion
  }

  /**
   * Prioritize exploration queue based on curiosity
   * @param {Array} candidates - Candidate topics to explore
   * @returns {Array} Prioritized list
   */
  prioritizeExploration(candidates) {
    const scored = candidates.map(candidate => ({
      topic: typeof candidate === 'string' ? candidate : candidate.topic,
      curiosityScore: this.calculateCuriosity(typeof candidate === 'string' ? candidate : candidate.topic),
      metadata: typeof candidate === 'object' ? candidate : {}
    }));

    return scored.sort((a, b) => b.curiosityScore - a.curiosityScore);
  }

  /**
   * Check if agent should explore or exploit
   * @returns {boolean} True if should explore
   */
  shouldExplore() {
    const recentHistory = this.history.slice(-10);
    const explorationRatio = recentHistory.filter(h => h.type === 'exploration').length / recentHistory.length;
    
    // Explore if we haven't explored much recently
    return explorationRatio < 0.3 && this.explorationBudget > 0;
  }

  /**
   * Allocate exploration budget
   * @param {number} amount - Budget to allocate
   * @returns {boolean} Success status
   */
  allocateExploration(amount) {
    if (amount > this.explorationBudget) {
      return {
        success: false,
        reason: 'Insufficient exploration budget',
        allocated: 0,
        remaining: this.explorationBudget
      };
    }

    this.explorationBudget -= amount;
    this._recordHistory('budget_allocation', null, -amount);

    return {
      success: true,
      allocated: amount,
      remaining: this.explorationBudget
    };
  }

  /**
   * Reset exploration budget
   * @param {number} newBudget - New budget amount
   */
  resetBudget(newBudget = 100) {
    this.explorationBudget = newBudget;
    this._recordHistory('budget_reset', null, newBudget);
  }

  /**
   * Get most curious topics from a list
   * @param {Array} topics - Topics to evaluate
   * @param {number} limit - Number to return
   * @returns {Array} Top curious topics
   */
  getMostCurious(topics, limit = 5) {
    const scored = topics.map(topic => ({
      topic,
      curiosityScore: this.calculateCuriosity(topic)
    }));

    return scored
      .filter(t => t.curiosityScore >= this.curiosityThreshold)
      .sort((a, b) => b.curiosityScore - a.curiosityScore)
      .slice(0, limit);
  }

  /**
   * Record history entry
   */
  _recordHistory(type, topic, value) {
    this.history.push({
      type,
      topic,
      value,
      timestamp: Date.now()
    });

    // Keep history bounded
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }

  /**
   * Get curiosity statistics
   */
  getStats() {
    const topics = Array.from(this.knowledgeBase.values());
    const avgFamiliarity = topics.length > 0 
      ? topics.reduce((sum, t) => sum + t.familiarity, 0) / topics.length 
      : 0;

    return {
      totalTopics: this.knowledgeBase.size,
      avgFamiliarity,
      explorationBudget: this.explorationBudget,
      historyLength: this.history.length,
      highCuriosityTopics: topics.filter(t => (1 - t.familiarity) >= this.curiosityThreshold).length
    };
  }

  /**
   * Export knowledge base
   * @returns {Object} Serialized knowledge
   */
  exportKnowledge() {
    return {
      topics: Array.from(this.knowledgeBase.entries()).map(([key, value]) => ({
        topic: key,
        ...value
      })),
      exportedAt: Date.now()
    };
  }

  /**
   * Import knowledge base
   * @param {Object} data - Serialized knowledge
   */
  importKnowledge(data) {
    if (data.topics && Array.isArray(data.topics)) {
      for (const topic of data.topics) {
        this.knowledgeBase.set(topic.topic, {
          familiarity: topic.familiarity,
          firstLearned: topic.firstLearned,
          lastAccessed: topic.lastAccessed,
          accessCount: topic.accessCount,
          relatedTopics: topic.relatedTopics || []
        });
      }
    }
  }

  /**
   * Clear all knowledge
   */
  clear() {
    this.knowledgeBase.clear();
    this.history = [];
    this.resetBudget(100);
  }
}

module.exports = { CuriosityEngine };
