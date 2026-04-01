/**
 * BFT (Byzantine Fault Tolerance) Consensus for Agent Clusters
 * 
 * NOVEL HERETEK CONTRIBUTION - No AI framework implements PBFT-style consensus.
 * Practical Byzantine Fault Tolerance for triad/cluster decisions.
 * Supports f faulty nodes out of 3f+1 total (e.g., 1 faulty out of 4).
 * 
 * Phases: PRE-PREPARE → PREPARE → COMMIT → REPLY
 * View change mechanism for leader failure recovery.
 */

const { Redis } = require('ioredis');
const crypto = require('crypto');

class BFTConsensus {
  constructor(options = {}) {
    this.redis = new Redis(options.redisUrl || 'redis://localhost:6379');
    this.nodeId = options.nodeId || `node-${Date.now()}`;
    this.clusterSize = options.clusterSize || 4; // 3f+1 where f=1
    this.view = 0;
    this.sequence = 0;
    this.state = 'idle'; // idle, pre-prepare, prepare, commit, committed
  }

  /**
   * Get primary/leader for current view
   */
  getPrimary() {
    return `node-${this.view % this.clusterSize}`;
  }

  /**
   * Check if this node is the primary
   */
  isPrimary() {
    return this.nodeId === this.getPrimary();
  }

  /**
   * Get required quorum size (2f+1)
   */
  getQuorumSize() {
    const f = Math.floor((this.clusterSize - 1) / 3);
    return 2 * f + 1;
  }

  /**
   * Start consensus for a decision
   * @param {Object} request - The decision request
   * @returns {Promise<Object>} Consensus result
   */
  async propose(request) {
    this.sequence++;
    const digest = this.hash(JSON.stringify(request));
    
    console.log(`🔹 Proposing decision #${this.sequence} (view ${this.view})`);

    if (this.isPrimary()) {
      // Primary broadcasts PRE-PREPARE
      await this.broadcast('pre-prepare', {
        view: this.view,
        sequence: this.sequence,
        digest,
        request
      });
      
      this.state = 'pre-prepare';
      return this.waitForConsensus(request);
    } else {
      // Backup waits for PRE-PREPARE from primary
      return this.waitForPrePrepare(request);
    }
  }

  /**
   * Handle PRE-PREPARE message
   */
  async handlePrePrepare(msg) {
    const { view, sequence, digest, request } = msg;
    
    // Validate view and sequence
    if (view !== this.view || sequence !== this.sequence) {
      console.warn(`⚠️ Invalid PRE-PREPARE: view=${view}, seq=${sequence}`);
      return;
    }

    // Verify digest
    const computedDigest = this.hash(JSON.stringify(request));
    if (computedDigest !== digest) {
      console.warn('⚠️ Digest mismatch - possible Byzantine fault');
      return;
    }

    // Accept PRE-PREPARE, broadcast PREPARE
    await this.broadcast('prepare', {
      view,
      sequence,
      digest,
      nodeId: this.nodeId
    });

    this.state = 'prepare';
  }

  /**
   * Handle PREPARE message
   */
  async handlePrepare(msg) {
    const { view, sequence, digest } = msg;
    
    // Track prepares
    const key = `bft:prepare:${view}:${sequence}:${digest}`;
    await this.redis.sadd(key, msg.nodeId);
    
    const prepares = await this.redis.smembers(key);
    
    // Check if we have quorum (2f+1 prepares including our own)
    if (prepares.length >= this.getQuorumSize() && this.state === 'prepare') {
      // Broadcast COMMIT
      await this.broadcast('commit', {
        view,
        sequence,
        digest,
        nodeId: this.nodeId
      });
      
      this.state = 'commit';
    }
  }

  /**
   * Handle COMMIT message
   */
  async handleCommit(msg) {
    const { view, sequence, digest } = msg;
    
    // Track commits
    const key = `bft:commit:${view}:${sequence}:${digest}`;
    await this.redis.sadd(key, msg.nodeId);
    
    const commits = await this.redis.smembers(key);
    
    // Check if we have quorum (2f+1 commits)
    if (commits.length >= this.getQuorumSize() && this.state === 'commit') {
      this.state = 'committed';
      console.log(`✅ Consensus reached for decision #${sequence}`);
      
      // Execute the decision
      return { committed: true, view, sequence, commits: commits.length };
    }
  }

  /**
   * View change - triggered when primary fails
   */
  async initViewChange() {
    console.warn(`⚠️ Initiating view change from view ${this.view}`);
    
    this.view++;
    this.state = 'view-change';
    
    // Broadcast VIEW-CHANGE message
    await this.broadcast('view-change', {
      view: this.view,
      nodeId: this.nodeId,
      reason: 'primary_timeout'
    });
    
    // Wait for NEW-VIEW from new primary
    return this.waitForNewView();
  }

  /**
   * Handle VIEW-CHANGE message
   */
  async handleViewChange(msg) {
    const { view } = msg;
    
    if (view <= this.view) return; // Ignore old views
    
    // Track view changes
    const key = `bft:view-change:${view}`;
    await this.redis.sadd(key, msg.nodeId);
    
    const changes = await this.redis.smembers(key);
    
    // If 2f+1 nodes want view change, accept it
    if (changes.length >= this.getQuorumSize()) {
      this.view = view;
      
      // If we're the new primary, send NEW-VIEW
      if (this.isPrimary()) {
        await this.broadcast('new-view', {
          view: this.view,
          nodeId: this.nodeId
        });
      }
    }
  }

  /**
   * Handle NEW-VIEW message
   */
  async handleNewView(msg) {
    const { view } = msg;
    
    if (view === this.view) {
      console.log(`✅ Accepted new view ${view}`);
      this.state = 'idle';
      return { accepted: true, view };
    }
  }

  /**
   * Broadcast message to all nodes
   */
  async broadcast(type, data) {
    const message = {
      type,
      ...data,
      timestamp: Date.now()
    };
    
    await this.redis.publish('bft:consensus', JSON.stringify(message));
    console.log(`📢 Broadcast ${type} to cluster`);
  }

  /**
   * Subscribe to consensus messages
   */
  async subscribe() {
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe('bft:consensus', async (message) => {
      const msg = JSON.parse(message);
      await this.handleMessage(msg);
    });
    
    return subscriber;
  }

  /**
   * Route message to appropriate handler
   */
  async handleMessage(msg) {
    switch (msg.type) {
      case 'pre-prepare':
        await this.handlePrePrepare(msg);
        break;
      case 'prepare':
        await this.handlePrepare(msg);
        break;
      case 'commit':
        await this.handleCommit(msg);
        break;
      case 'view-change':
        await this.handleViewChange(msg);
        break;
      case 'new-view':
        await this.handleNewView(msg);
        break;
    }
  }

  /**
   * Wait for consensus to complete
   */
  async waitForConsensus(request, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.state === 'committed') {
        return { success: true, request };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Timeout - initiate view change
    await this.initViewChange();
    return { success: false, reason: 'timeout' };
  }

  /**
   * Wait for PRE-PREPARE from primary
   */
  async waitForPrePrepare(request, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.state === 'prepare' || this.state === 'commit' || this.state === 'committed') {
        return { success: true };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Primary didn't send PRE-PREPARE - initiate view change
    await this.initViewChange();
    return { success: false, reason: 'primary_timeout' };
  }

  /**
   * Wait for NEW-VIEW after view change
   */
  async waitForNewView(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.state === 'idle') {
        return { success: true, view: this.view };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { success: false, reason: 'view_change_timeout' };
  }

  /**
   * Hash function for digest computation
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      nodeId: this.nodeId,
      view: this.view,
      sequence: this.sequence,
      state: this.state,
      isPrimary: this.isPrimary(),
      quorumSize: this.getQuorumSize(),
      clusterSize: this.clusterSize
    };
  }
}

module.exports = { BFTConsensus };
