/**
 * PostgreSQL Persistence Layer for Reputation Voting System
 * 
 * Provides persistent storage for agent reputation scores, history, and voting records.
 * Falls back to Redis-only mode if PostgreSQL is unavailable.
 */

const { Client } = require('pg');

class ReputationPostgresStore {
  constructor(options = {}) {
    this.client = null;
    this.connected = false;
    this.connectionString = options.connectionString || process.env.DATABASE_URL;
  }

  /**
   * Initialize database connection and create tables
   */
  async connect() {
    if (!this.connectionString) {
      console.warn('[ReputationStore] No DATABASE_URL provided, using Redis-only mode');
      return false;
    }

    try {
      this.client = new Client({
        connectionString: this.connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      await this.client.connect();
      this.connected = true;

      // Create tables if they don't exist
      await this._createTables();
      
      console.log('[ReputationStore] PostgreSQL connected and initialized');
      return true;
    } catch (error) {
      console.warn('[ReputationStore] PostgreSQL connection failed:', error.message);
      console.warn('[ReputationStore] Falling back to Redis-only mode');
      this.connected = false;
      return false;
    }
  }

  /**
   * Create necessary tables
   */
  async _createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS agent_reputations (
        agent_id VARCHAR(255) PRIMARY KEY,
        score NUMERIC(10,2) DEFAULT 100.00,
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        reset_count INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS reputation_history (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        previous_score NUMERIC(10,2),
        new_score NUMERIC(10,2),
        change_amount NUMERIC(10,2),
        reason VARCHAR(100),
        impact_factor NUMERIC(5,2) DEFAULT 1.0,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS slashing_events (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        reason TEXT,
        severity NUMERIC(5,2) DEFAULT 1.0,
        penalty_amount NUMERIC(10,2),
        previous_score NUMERIC(10,2),
        new_score NUMERIC(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS vote_records (
        proposal_id VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        vote BOOLEAN NOT NULL,
        voting_power NUMERIC(10,2),
        weighted_vote NUMERIC(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (proposal_id, agent_id)
      )`,
      `CREATE TABLE IF NOT EXISTS quadratic_votes (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        resource_id VARCHAR(255) NOT NULL,
        votes_cast INTEGER,
        cost INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(agent_id, resource_id)
      )`,
      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_reputation_history_agent ON reputation_history(agent_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_slashing_events_agent ON slashing_events(agent_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_vote_records_proposal ON vote_records(proposal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_quadratic_votes_resource ON quadratic_votes(resource_id)`
    ];

    for (const query of queries) {
      await this.client.query(query);
    }
  }

  /**
   * Initialize or update agent reputation
   */
  async initializeAgent(agentId, initialScore = 100) {
    if (!this.connected) return null;

    const query = `
      INSERT INTO agent_reputations (agent_id, score, last_updated)
      VALUES ($1, $2, NOW())
      ON CONFLICT (agent_id) DO UPDATE SET
        score = EXCLUDED.score,
        last_updated = NOW()
      RETURNING *
    `;

    const result = await this.client.query(query, [agentId, initialScore]);
    return result.rows[0];
  }

  /**
   * Get agent's current reputation
   */
  async getReputation(agentId) {
    if (!this.connected) return null;

    const query = `
      SELECT agent_id, score, last_updated, created_at
      FROM agent_reputations
      WHERE agent_id = $1
    `;

    const result = await this.client.query(query, [agentId]);
    return result.rows[0] || null;
  }

  /**
   * Update agent reputation after task completion
   */
  async updateReputation(agentId, newScore, previousScore, reason, impact = 1.0) {
    if (!this.connected) return null;

    const query = `
      UPDATE agent_reputations
      SET score = $1, last_updated = NOW()
      WHERE agent_id = $2
      RETURNING *
    `;

    await this.client.query(query, [newScore, agentId]);

    // Record history
    const historyQuery = `
      INSERT INTO reputation_history 
        (agent_id, previous_score, new_score, change_amount, reason, impact_factor, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await this.client.query(historyQuery, [
      agentId,
      previousScore,
      newScore,
      newScore - previousScore,
      reason,
      impact,
      JSON.stringify({ timestamp: Date.now() })
    ]);

    return { agentId, previousScore, newScore, change: newScore - previousScore };
  }

  /**
   * Record a slashing event
   */
  async recordSlashing(agentId, reason, severity, penalty, previousScore, newScore) {
    if (!this.connected) return null;

    const query = `
      INSERT INTO slashing_events 
        (agent_id, reason, severity, penalty_amount, previous_score, new_score)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await this.client.query(query, [
      agentId, reason, severity, penalty, previousScore, newScore
    ]);

    return result.rows[0];
  }

  /**
   * Record a vote
   */
  async recordVote(proposalId, agentId, vote, votingPower, weightedVote) {
    if (!this.connected) return null;

    const query = `
      INSERT INTO vote_records 
        (proposal_id, agent_id, vote, voting_power, weighted_vote)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (proposal_id, agent_id) DO UPDATE SET
        vote = EXCLUDED.vote,
        voting_power = EXCLUDED.voting_power,
        weighted_vote = EXCLUDED.weighted_vote
    `;

    await this.client.query(query, [proposalId, agentId, vote, votingPower, weightedVote]);
  }

  /**
   * Record quadratic vote
   */
  async recordQuadraticVote(agentId, resourceId, votes, cost) {
    if (!this.connected) return null;

    const query = `
      INSERT INTO quadratic_votes (agent_id, resource_id, votes_cast, cost)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (agent_id, resource_id) DO UPDATE SET
        votes_cast = EXCLUDED.votes_cast,
        cost = EXCLUDED.cost,
        created_at = NOW()
      RETURNING *
    `;

    const result = await this.client.query(query, [agentId, resourceId, votes, cost]);
    return result.rows[0];
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 22) {
    if (!this.connected) return null;

    const query = `
      SELECT agent_id, score, last_updated, created_at
      FROM agent_reputations
      ORDER BY score DESC
      LIMIT $1
    `;

    const result = await this.client.query(query, [limit]);
    return result.rows;
  }

  /**
   * Get all agents with reputations
   */
  async getAllAgents() {
    if (!this.connected) return null;

    const query = `
      SELECT agent_id, score, last_updated, created_at
      FROM agent_reputations
      ORDER BY agent_id
    `;

    const result = await this.client.query(query);
    return result.rows;
  }

  /**
   * Get reputation history for an agent
   */
  async getHistory(agentId, limit = 50) {
    if (!this.connected) return null;

    const query = `
      SELECT *
      FROM reputation_history
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.client.query(query, [agentId, limit]);
    return result.rows;
  }

  /**
   * Get slashing history for an agent
   */
  async getSlashingHistory(agentId, limit = 20) {
    if (!this.connected) return null;

    const query = `
      SELECT *
      FROM slashing_events
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.client.query(query, [agentId, limit]);
    return result.rows;
  }

  /**
   * Reset agent reputation (admin function)
   */
  async resetReputation(agentId, newScore = 100) {
    if (!this.connected) return null;

    const query = `
      UPDATE agent_reputations
      SET score = $1, last_updated = NOW(), reset_count = reset_count + 1
      WHERE agent_id = $2
      RETURNING *
    `;

    const result = await this.client.query(query, [newScore, agentId]);
    return result.rows[0];
  }

  /**
   * Apply decay to stale reputations
   */
  async applyDecay(decayRate = 0.1) {
    if (!this.connected) return null;

    // Decay reputations not updated in 7+ days
    const query = `
      UPDATE agent_reputations
      SET 
        score = score * (1 - $1),
        last_updated = NOW()
      WHERE last_updated < NOW() - INTERVAL '7 days'
      RETURNING agent_id, score
    `;

    const result = await this.client.query(query, [decayRate]);
    return result.rows;
  }

  /**
   * Close database connection
   */
  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.connected = false;
    }
  }
}

module.exports = { ReputationPostgresStore };
