// DEPRECATED: This module is not imported anywhere in the codebase.
// Scheduled for removal. If you need this functionality, contact the team.
// Audit Reference: AUDIT-FIX C1
// Date: 2026-04-04

/**
 * Lineage Tracking System
 * 
 * Tracks agent ancestry, task inheritance, and decision provenance.
 * Enables debugging, accountability, and knowledge transfer across generations.
 */

const { v4: uuidv4 } = require('uuid');

class LineageTracker {
  constructor(options = {}) {
    this.storage = options.storage || new Map(); // In-memory by default
    this.maxDepth = options.maxDepth || 10;
  }

  /**
   * Register a new agent with lineage
   * @param {Object} agent - Agent metadata
   * @param {string} parentAgentId - Parent agent ID (if any)
   * @returns {string} New agent ID
   */
  registerAgent(agent, parentAgentId = null) {
    const agentId = agent.id || uuidv4();
    const lineage = {
      agentId,
      parentId: parentAgentId,
      generation: parentAgentId ? this._getGeneration(parentAgentId) + 1 : 0,
      createdAt: Date.now(),
      metadata: agent.metadata || {},
      children: [],
      tasks: []
    };

    this.storage.set(agentId, lineage);

    // Update parent's children list
    if (parentAgentId) {
      const parent = this.storage.get(parentAgentId);
      if (parent) {
        parent.children.push(agentId);
      }
    }

    return agentId;
  }

  /**
   * Get agent's generation number
   */
  _getGeneration(agentId) {
    const agent = this.storage.get(agentId);
    if (!agent) return 0;
    
    if (!agent.parentId) return 0;
    
    return this._getGeneration(agent.parentId) + 1;
  }

  /**
   * Track task execution for an agent
   * @param {string} agentId - Agent ID
   * @param {Object} task - Task metadata
   * @returns {string} Task tracking ID
   */
  trackTask(agentId, task) {
    const taskId = task.id || uuidv4();
    const agent = this.storage.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const taskRecord = {
      taskId,
      agentId,
      description: task.description,
      status: 'pending',
      startedAt: Date.now(),
      completedAt: null,
      result: null,
      decisions: [],
      inheritedFrom: task.inheritedFrom || null
    };

    agent.tasks.push(taskId);
    this.storage.set(`task:${taskId}`, taskRecord);
    
    return taskId;
  }

  /**
   * Record decision made during task execution
   * @param {string} taskId - Task ID
   * @param {Object} decision - Decision details
   */
  recordDecision(taskId, decision) {
    const task = this.storage.get(`task:${taskId}`);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.decisions.push({
      ...decision,
      timestamp: Date.now()
    });

    this.storage.set(`task:${taskId}`, task);
  }

  /**
   * Complete task with result
   * @param {string} taskId - Task ID
   * @param {Object} result - Task result
   */
  completeTask(taskId, result) {
    const task = this.storage.get(`task:${taskId}`);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = result.success ? 'completed' : 'failed';
    task.completedAt = Date.now();
    task.result = result;

    this.storage.set(`task:${taskId}`, task);
  }

  /**
   * Get full ancestry chain for an agent
   * @param {string} agentId - Agent ID
   * @returns {Array} Ancestry chain from root to agent
   */
  getAncestry(agentId) {
    const chain = [];
    let currentId = agentId;
    let depth = 0;

    while (currentId && depth < this.maxDepth) {
      const agent = this.storage.get(currentId);
      if (!agent) break;

      chain.unshift({
        agentId: currentId,
        generation: agent.generation,
        createdAt: agent.createdAt,
        metadata: agent.metadata
      });

      currentId = agent.parentId;
      depth++;
    }

    return chain;
  }

  /**
   * Get all descendants of an agent
   * @param {string} agentId - Agent ID
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Array} Descendant agents
   */
  getDescendants(agentId, maxDepth = this.maxDepth) {
    const descendants = [];
    this._collectDescendants(agentId, descendants, 0, maxDepth);
    return descendants;
  }

  _collectDescendants(agentId, collection, currentDepth, maxDepth) {
    if (currentDepth >= maxDepth) return;

    const agent = this.storage.get(agentId);
    if (!agent) return;

    for (const childId of agent.children) {
      const child = this.storage.get(childId);
      if (child) {
        collection.push({
          agentId: childId,
          generation: child.generation,
          depth: currentDepth + 1,
          metadata: child.metadata
        });
        this._collectDescendants(childId, collection, currentDepth + 1, maxDepth);
      }
    }
  }

  /**
   * Get task history for an agent including inherited tasks
   * @param {string} agentId - Agent ID
   * @returns {Array} Task history
   */
  getTaskHistory(agentId) {
    const agent = this.storage.get(agentId);
    if (!agent) return [];

    const tasks = agent.tasks.map(taskId => {
      const task = this.storage.get(`task:${taskId}`);
      return task ? { ...task } : null;
    }).filter(t => t !== null);

    return tasks.sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Get decision provenance for a specific decision
   * @param {string} taskId - Task ID
   * @param {number} decisionIndex - Index of decision in task
   * @returns {Object} Decision with full context
   */
  getDecisionProvenance(taskId, decisionIndex) {
    const task = this.storage.get(`task:${taskId}`);
    if (!task || !task.decisions[decisionIndex]) {
      throw new Error('Decision not found');
    }

    const agent = this.storage.get(task.agentId);
    const ancestry = this.getAncestry(task.agentId);

    return {
      decision: task.decisions[decisionIndex],
      task: { ...task },
      agent: { ...agent },
      ancestry
    };
  }

  /**
   * Find common ancestor between two agents
   * @param {string} agentId1 - First agent ID
   * @param {string} agentId2 - Second agent ID
   * @returns {string|null} Common ancestor ID or null
   */
  findCommonAncestor(agentId1, agentId2) {
    const ancestry1 = this.getAncestry(agentId1);
    const ancestry2 = this.getAncestry(agentId2);

    const ids1 = new Set(ancestry1.map(a => a.agentId));
    
    for (const ancestor of ancestry2) {
      if (ids1.has(ancestor.agentId)) {
        return ancestor.agentId;
      }
    }

    return null;
  }

  /**
   * Export lineage data for persistence
   * @param {string} agentId - Agent ID to export
   * @returns {Object} Serialized lineage data
   */
  exportLineage(agentId) {
    const agent = this.storage.get(agentId);
    if (!agent) return null;

    const descendants = this.getDescendants(agentId);
    const tasks = this.getTaskHistory(agentId);

    return {
      rootAgent: { ...agent },
      descendantCount: descendants.length,
      descendants,
      taskCount: tasks.length,
      tasks,
      exportedAt: Date.now()
    };
  }

  /**
   * Get statistics about the lineage system
   */
  getStats() {
    let totalAgents = 0;
    let totalTasks = 0;
    let maxGeneration = 0;

    for (const [key, value] of this.storage.entries()) {
      if (!key.startsWith('task:')) {
        totalAgents++;
        maxGeneration = Math.max(maxGeneration, value.generation);
      } else {
        totalTasks++;
      }
    }

    return {
      totalAgents,
      totalTasks,
      maxGeneration,
      storageSize: this.storage.size
    };
  }

  /**
   * Clear all lineage data
   */
  clear() {
    this.storage.clear();
  }
}

module.exports = { LineageTracker };
