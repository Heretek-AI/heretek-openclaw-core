/**
 * Curiosity Engine v2 with Intrinsic Motivation
 * 
 * NOVEL HERETEK CONTRIBUTION - Research identified this as a gap.
 * No existing framework has genuine curiosity-driven goal generation.
 * 
 * Features:
 * 1) Knowledge gap detection - identifies what the system doesn't know
 * 2) Auto-generated exploration goals - creates learning objectives autonomously
 * 3) Intrinsic reward signals - rewards novelty and learning progress
 * 4) Novelty scoring - measures how new/unexpected information is
 */

const { Redis } = require('ioredis');

class CuriosityEngineV2 {
  constructor(options = {}) {
    this.redis = new Redis(options.redisUrl || 'redis://localhost:6379');
    this.knowledgeBase = options.knowledgeBase || 'heretek:knowledge';
    this.noveltyThreshold = options.noveltyThreshold || 0.7;
    this.curiosityDrive = options.curiosityDrive || 1.0; // Multiplier for exploration
    
    // Intrinsic motivation parameters
    this.competenceMotivation = 0.5; // Drive to master skills
    this.autonomyMotivation = 0.5;   // Drive for self-direction
    this.relatednessMotivation = 0.5; // Drive for social connection
  }

  /**
   * Detect knowledge gaps by analyzing query patterns
   * @param {Array} recentQueries - Recent search/query history
   * @returns {Promise<Array>} Identified gaps
   */
  async detectKnowledgeGaps(recentQueries) {
    const gaps = [];
    
    // Analyze failed or incomplete queries
    for (const query of recentQueries) {
      if (query.resultCount === 0 || query.confidence < 0.5) {
        const gap = {
          topic: query.topic,
          specificity: query.specificity || 'unknown',
          failureReason: query.resultCount === 0 ? 'no_data' : 'low_confidence',
          priority: this.calculateGapPriority(query),
          timestamp: Date.now()
        };
        gaps.push(gap);
      }
    }
    
    // Store gaps for tracking
    if (gaps.length > 0) {
      await this.redis.zadd(
        `${this.knowledgeBase}:gaps`,
        Date.now(),
        JSON.stringify(gaps)
      );
    }
    
    return gaps;
  }

  /**
   * Generate exploration goals from detected gaps
   * @param {Array} gaps - Knowledge gaps to address
   * @returns {Promise<Array>} Exploration goals
   */
  async generateExplorationGoals(gaps) {
    const goals = [];
    
    for (const gap of gaps) {
      const goal = {
        id: `goal:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
        type: 'exploration',
        topic: gap.topic,
        description: `Investigate and document: ${gap.topic}`,
        priority: gap.priority,
        intrinsicReward: this.calculateIntrinsicReward(gap),
        estimatedEffort: this.estimateEffort(gap),
        createdAt: Date.now(),
        status: 'pending'
      };
      
      goals.push(goal);
      
      // Store goal
      await this.redis.hset(
        `${this.knowledgeBase}:goals:${goal.id}`,
        JSON.stringify(goal)
      );
    }
    
    return goals;
  }

  /**
   * Calculate intrinsic reward for completing a goal
   * Based on Self-Determination Theory (autonomy, competence, relatedness)
   */
  calculateIntrinsicReward(gap) {
    // Novelty component
    const novelty = this.calculateNovelty(gap.topic);
    
    // Learning progress potential
    const learningPotential = gap.priority * this.curiosityDrive;
    
    // SDT components
    const autonomyScore = this.autonomyMotivation; // Self-directed exploration
    const competenceScore = this.competenceMotivation * (1 - gap.priority); // Easier = more competence
    const relatednessScore = this.relatednessMotivation * 0.5; // Neutral for solo exploration
    
    return {
      total: (novelty + learningPotential + autonomyScore + competenceScore + relatednessScore) / 5,
      breakdown: {
        novelty,
        learningPotential,
        autonomy: autonomyScore,
        competence: competenceScore,
        relatedness: relatednessScore
      }
    };
  }

  /**
   * Calculate novelty score for a topic
   * Higher score = more novel/unexpected information
   */
  async calculateNovelty(topic) {
    // Check how often this topic appears in knowledge base
    const topicKey = `${this.knowledgeBase}:topic_frequency`;
    const frequency = await this.redis.hget(topicKey, topic) || 0;
    
    // Inverse relationship: less frequent = more novel
    const novelty = 1 / (1 + parseInt(frequency));
    
    // Increment frequency for next time
    await this.redis.hincrby(topicKey, topic, 1);
    
    return Math.min(1.0, novelty);
  }

  /**
   * Calculate gap priority based on impact and urgency
   */
  calculateGapPriority(gap) {
    let priority = 0.5; // Base priority
    
    // Adjust based on failure reason
    if (gap.failureReason === 'no_data') {
      priority += 0.3; // Complete lack of data is high priority
    } else if (gap.failureReason === 'low_confidence') {
      priority += 0.1; // Low confidence is moderate priority
    }
    
    // Adjust based on specificity (more specific = higher priority)
    if (gap.specificity === 'high') {
      priority += 0.2;
    } else if (gap.specificity === 'medium') {
      priority += 0.1;
    }
    
    return Math.min(1.0, priority);
  }

  /**
   * Estimate effort required to address a gap
   */
  estimateEffort(gap) {
    // Simple heuristic: higher priority gaps often require more effort
    const baseEffort = 30; // minutes
    
    if (gap.priority > 0.8) {
      return baseEffort * 3; // High priority = complex
    } else if (gap.priority > 0.5) {
      return baseEffort * 2;
    } else {
      return baseEffort;
    }
  }

  /**
   * Record learning progress (updates competence motivation)
   */
  async recordLearning(goalId, success, learnings) {
    const goalKey = `${this.knowledgeBase}:goals:${goalId}`;
    const goalData = await this.redis.hgetall(goalKey);
    
    if (!goalData) return;
    
    const goal = JSON.parse(goalData);
    goal.status = success ? 'completed' : 'failed';
    goal.completedAt = Date.now();
    goal.learnings = learnings;
    
    await this.redis.hset(goalKey, JSON.stringify(goal));
    
    // Update competence motivation based on success
    if (success) {
      this.competenceMotivation = Math.min(1.0, this.competenceMotivation + 0.1);
    } else {
      this.competenceMotivation = Math.max(0.1, this.competenceMotivation - 0.05);
    }
    
    // Store learning in knowledge base
    if (learnings && learnings.length > 0) {
      await this.redis.lpush(
        `${this.knowledgeBase}:learnings`,
        JSON.stringify({
          goalId,
          topic: goal.topic,
          learnings,
          timestamp: Date.now()
        })
      );
    }
  }

  /**
   * Get curiosity-driven recommendations for what to explore next
   */
  async getRecommendations(limit = 5) {
    // Get recent gaps
    const gapsRaw = await this.redis.zrange(
      `${this.knowledgeBase}:gaps`,
      0,
      -1,
      'WITHSCORES'
    );
    
    const gaps = [];
    for (let i = 0; i < gapsRaw.length; i += 2) {
      gaps.push(JSON.parse(gapsRaw[i]));
    }
    
    // Generate goals for top gaps
    const goals = await this.generateExplorationGoals(gaps.slice(0, limit * 2));
    
    // Sort by intrinsic reward
    goals.sort((a, b) => b.intrinsicReward.total - a.intrinsicReward.total);
    
    return goals.slice(0, limit);
  }

  /**
   * Trigger curiosity-driven exploration cycle
   */
  async triggerExplorationCycle() {
    console.log('🔍 Initiating curiosity-driven exploration cycle...');
    
    // Get recent queries (last 100)
    const recentQueries = await this.getRecentQueries(100);
    
    // Detect gaps
    const gaps = await this.detectKnowledgeGaps(recentQueries);
    console.log(`Found ${gaps.length} knowledge gaps`);
    
    // Generate goals
    const goals = await this.generateExplorationGoals(gaps);
    console.log(`Generated ${goals.length} exploration goals`);
    
    // Return top recommendations
    const recommendations = await this.getRecommendations(3);
    
    return {
      gapsDetected: gaps.length,
      goalsGenerated: goals.length,
      recommendations,
      timestamp: Date.now()
    };
  }

  /**
   * Get recent queries from history
   */
  async getRecentQueries(limit = 100) {
    // This would integrate with actual query logging
    // For now, return mock data structure
    return [
      { topic: 'quantum computing', resultCount: 0, specificity: 'high' },
      { topic: 'neural architecture search', resultCount: 2, confidence: 0.4, specificity: 'medium' }
    ];
  }

  /**
   * Get curiosity engine status
   */
  getStatus() {
    return {
      curiosityDrive: this.curiosityDrive,
      motivations: {
        competence: this.competenceMotivation,
        autonomy: this.autonomyMotivation,
        relatedness: this.relatednessMotivation
      },
      noveltyThreshold: this.noveltyThreshold,
      knowledgeBase: this.knowledgeBase
    };
  }
}

module.exports = { CuriosityEngineV2 };
