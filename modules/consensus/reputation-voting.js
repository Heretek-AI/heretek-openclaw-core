/**
 * Heretek Reputation-Weighted Voting System
 * 
 * NOVEL CONTRIBUTION - Gap filler for multi-agent governance.
 * No existing framework implements reputation-weighted voting with slashing.
 * 
 * Features:
 * - Agents earn reputation through successful completions
 * - Stale reputations decay (10% per week)
 * - Slashing for failures (-20% on bad outputs)
 * - Quadratic voting for resource allocation (cost = votes²)
 */

const { Redis } = require('ioredis');

class ReputationVotingSystem {
  constructor(options = {}) {
    this.redis = new Redis(options.redisUrl || 'redis://localhost:6379');
    this.decayRate = options.decayRate || 0.1; // 10% per week
    this.slashingRate = options.slashingRate || 0.2; // 20% penalty
    this.baseReputation = options.baseReputation || 100;
  }

  /**
   * Get agent's current reputation score
   * @param {string} agentId - Agent identifier
   * @returns {Promise<number>} Reputation score (0-1000)
   */
  async getReputation(agentId) {
    const key = `reputation:${agentId}`;
    const data = await this.redis.hgetall(key);
    
    if (!data || !data.score) {
      return this.baseReputation;
    }

    const score = parseFloat(data.score);
    const lastUpdated = parseInt(data.lastUpdated || Date.now());
    
    // Apply time-based decay
    const ageInWeeks = (Date.now() - lastUpdated) / (7 * 24 * 60 * 60 * 1000);
    const decayedScore = score * Math.pow(1 - this.decayRate, ageInWeeks);
    
    return Math.max(0, Math.min(1000, decayedScore)); // Clamp to 0-1000
  }

  /**
   * Update agent reputation after task completion
   * @param {string} agentId - Agent identifier
   * @param {boolean} success - Whether task succeeded
   * @param {number} impact - Task impact multiplier (1.0 = normal, 2.0 = high impact)
   */
  async updateReputation(agentId, success, impact = 1.0) {
    const currentRep = await this.getReputation(agentId);
    let newRep;

    if (success) {
      // Earn reputation: +10% of current, scaled by impact
      newRep = currentRep + (currentRep * 0.1 * impact);
    } else {
      // Slash reputation: -20% penalty
      newRep = currentRep * (1 - this.slashingRate);
    }

    newRep = Math.max(0, Math.min(1000, newRep)); // Clamp

    await this.redis.hset(`reputation:${agentId}`, {
      score: newRep.toString(),
      lastUpdated: Date.now().toString(),
      history: JSON.stringify({
        previous: currentRep,
        change: newRep - currentRep,
        reason: success ? 'success' : 'failure',
        impact,
        timestamp: Date.now()
      })
    });

    return newRep;
  }

  /**
   * Calculate voting power based on reputation
   * @param {string} agentId - Agent identifier
   * @returns {Promise<number>} Voting power (0-100)
   */
  async getVotingPower(agentId) {
    const reputation = await this.getReputation(agentId);
    // Normalize to 0-100 scale
    return (reputation / 1000) * 100;
  }

  /**
   * Conduct reputation-weighted vote
   * @param {string} proposalId - Proposal identifier
   * @param {Array} voters - Array of {agentId, vote: boolean}
   * @returns {Promise<Object>} Vote results
   */
  async conductVote(proposalId, voters) {
    const results = {
      proposalId,
      timestamp: Date.now(),
      votes: [],
      totalWeight: 0,
      forWeight: 0,
      againstWeight: 0,
      approved: false
    };

    for (const voter of voters) {
      const votingPower = await this.getVotingPower(voter.agentId);
      const weight = voter.vote ? votingPower : -votingPower;
      
      results.votes.push({
        agentId: voter.agentId,
        vote: voter.vote,
        weight: votingPower,
        weightedVote: weight
      });

      results.totalWeight += Math.abs(weight);
      if (voter.vote) {
        results.forWeight += votingPower;
      } else {
        results.againstWeight += votingPower;
      }
    }

    // Approved if >50% of weighted votes are in favor
    results.approved = results.forWeight > results.againstWeight;
    results.forPercentage = results.totalWeight > 0 
      ? (results.forWeight / results.totalWeight) * 100 
      : 0;

    // Store results
    await this.redis.setex(
      `vote:${proposalId}`,
      86400 * 7, // 7 day TTL
      JSON.stringify(results)
    );

    return results;
  }

  /**
   * Quadratic voting - allocate resources with quadratic cost
   * Cost = votes², so 1 vote costs 1, 2 votes cost 4, 3 votes cost 9, etc.
   * 
   * @param {string} agentId - Agent identifier
   * @param {string} resourceId - Resource being voted on
   * @param {number} votes - Number of votes to cast
   * @returns {Promise<Object>} Vote result
   */
  async quadraticVote(agentId, resourceId, votes) {
    if (votes < 0 || votes > 100) {
      throw new Error('Votes must be between 0 and 100');
    }

    const cost = votes * votes; // Quadratic cost
    const reputation = await this.getReputation(agentId);
    
    // Check if agent can afford the votes (reputation as budget)
    if (reputation < cost) {
      return {
        success: false,
        reason: `Insufficient reputation: need ${cost}, have ${reputation}`,
        votes: 0,
        cost: 0
      };
    }

    // Record the vote
    const voteKey = `quadratic_vote:${resourceId}:${agentId}`;
    await this.redis.setex(voteKey, 86400, JSON.stringify({
      agentId,
      resourceId,
      votes,
      cost,
      timestamp: Date.now()
    }));

    // Deduct temporary "budget" (not actual reputation, just tracking)
    await this.redis.incrby(`quadratic_spent:${agentId}:${resourceId}`, cost);

    return {
      success: true,
      votes,
      cost,
      remainingBudget: reputation - cost
    };
  }

  /**
   * Get quadratic voting results for a resource
   * @param {string} resourceId - Resource identifier
   * @returns {Promise<Object>} Aggregated results
   */
  async getQuadraticResults(resourceId) {
    const pattern = `quadratic_vote:${resourceId}:*`;
    const keys = await this.redis.keys(pattern);
    
    const votes = [];
    let totalVotes = 0;
    let totalCost = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const vote = JSON.parse(data);
        votes.push(vote);
        totalVotes += vote.votes;
        totalCost += vote.cost;
      }
    }

    return {
      resourceId,
      votes,
      totalVotes,
      totalCost,
      participantCount: votes.length,
      winner: votes.reduce((a, b) => a.votes > b.votes ? a : b, { votes: 0 })
    };
  }

  /**
   * Slash agent reputation for malicious behavior
   * @param {string} agentId - Agent identifier
   * @param {string} reason - Reason for slashing
   * @param {number} severity - Severity multiplier (1.0 = standard, 2.0 = severe)
   */
  async slash(agentId, reason, severity = 1.0) {
    const currentRep = await this.getReputation(agentId);
    const penalty = currentRep * this.slashingRate * severity;
    const newRep = Math.max(0, currentRep - penalty);

    await this.redis.hset(`reputation:${agentId}`, {
      score: newRep.toString(),
      lastUpdated: Date.now().toString(),
      slashed: JSON.stringify({
        reason,
        severity,
        penalty,
        previous: currentRep,
        timestamp: Date.now()
      })
    });

    console.log(`⚠️ Slashed ${agentId}: ${currentRep.toFixed(2)} → ${newRep.toFixed(2)} (${penalty.toFixed(2)})`);
    return { previous: currentRep, new: newRep, penalty };
  }

  /**
   * Get reputation leaderboard
   * @param {number} limit - Number of top agents to return
   * @returns {Promise<Array>} Top agents by reputation
   */
  async getLeaderboard(limit = 10) {
    const pattern = 'reputation:*';
    const keys = await this.redis.keys(pattern);
    
    const agents = [];
    for (const key of keys) {
      const agentId = key.replace('reputation:', '');
      const rep = await this.getReputation(agentId);
      agents.push({ agentId, reputation: rep });
    }

    return agents
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, limit);
  }

  /**
   * Reset agent reputation (admin function)
   * @param {string} agentId - Agent identifier
   * @param {number} newScore - New reputation score
   */
  async resetReputation(agentId, newScore = this.baseReputation) {
    await this.redis.hset(`reputation:${agentId}`, {
      score: newScore.toString(),
      lastUpdated: Date.now().toString(),
      reset: JSON.stringify({
        previous: await this.getReputation(agentId),
        new: newScore,
        timestamp: Date.now()
      })
    });

    return newScore;
  }
}

module.exports = { ReputationVotingSystem };
