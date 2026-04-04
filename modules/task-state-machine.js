// DEPRECATED: This module is not imported anywhere in the codebase.
// Scheduled for removal. If you need this functionality, contact the team.
// Audit Reference: AUDIT-FIX C1
// Date: 2026-04-04

/**
 * Task State Machine
 * 
 * 5-stage workflow: proposal → deliberation → review → execution → archive
 * With mandatory QA gate between review and execution
 */

class TaskStateMachine {
  // Stage definitions
  static STAGES = {
    PROPOSAL: 'proposal',
    DELIBERATION: 'deliberation',
    REVIEW: 'review',
    EXECUTION: 'execution',
    ARCHIVE: 'archive'
  };

  // Valid transitions map
  static TRANSITIONS = {
    [TaskStateMachine.STAGES.PROPOSAL]: [TaskStateMachine.STAGES.DELIBERATION],
    [TaskStateMachine.STAGES.DELIBERATION]: [TaskStateMachine.STAGES.REVIEW],
    [TaskStateMachine.STAGES.REVIEW]: [TaskStateMachine.STAGES.EXECUTION], // Requires QA gate
    [TaskStateMachine.STAGES.EXECUTION]: [TaskStateMachine.STAGES.ARCHIVE],
    [TaskStateMachine.STAGES.ARCHIVE]: [] // Terminal state
  };

  constructor(taskId, initialData = {}) {
    this.taskId = taskId;
    this.currentState = TaskStateMachine.STAGES.PROPOSAL;
    this.history = [];
    this.qaPassed = false;
    this.metadata = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...initialData
    };
    
    this._recordTransition(null, TaskStateMachine.STAGES.PROPOSAL, 'initialized');
  }

  /**
   * Get current stage
   */
  getCurrentStage() {
    return this.currentState;
  }

  /**
   * Check if task is in a specific stage
   */
  isInStage(stage) {
    return this.currentState === stage;
  }

  /**
   * Check if transition is valid
   */
  canTransitionTo(targetStage) {
    const allowedTransitions = TaskStateMachine.TRANSITIONS[this.currentState];
    return allowedTransitions.includes(targetStage);
  }

  /**
   * Transition to next stage
   * @param {string} targetStage - The stage to transition to
   * @param {object} context - Optional context/reason for transition
   * @returns {boolean} - Success status
   */
  transitionTo(targetStage, context = {}) {
    if (!this.canTransitionTo(targetStage)) {
      throw new Error(
        `Invalid transition from ${this.currentState} to ${targetStage}. ` +
        `Allowed: ${TaskStateMachine.TRANSITIONS[this.currentState].join(', ')}`
      );
    }

    // Enforce QA gate before execution
    if (targetStage === TaskStateMachine.STAGES.EXECUTION && !this.qaPassed) {
      throw new Error(
        'QA gate not passed. Cannot transition to execution without QA approval.'
      );
    }

    const previousState = this.currentState;
    this.currentState = targetStage;
    this.metadata.updatedAt = Date.now();
    
    this._recordTransition(previousState, targetStage, context.reason || 'transitioned');
    
    return true;
  }

  /**
   * Pass QA gate (required before execution)
   * @param {object} qaResult - QA check results
   */
  passQAGate(qaResult = {}) {
    if (this.currentState !== TaskStateMachine.STAGES.REVIEW) {
      throw new Error('QA gate can only be passed during review stage');
    }

    this.qaPassed = true;
    this.metadata.qaPassedAt = Date.now();
    this.metadata.qaResult = qaResult;
    
    this._recordTransition(
      this.currentState, 
      this.currentState, 
      `QA gate passed: ${JSON.stringify(qaResult)}`
    );
    
    return true;
  }

  /**
   * Fail QA gate (stays in review)
   * @param {string} reason - Reason for QA failure
   */
  failQAGate(reason) {
    if (this.currentState !== TaskStateMachine.STAGES.REVIEW) {
      throw new Error('QA gate only applies during review stage');
    }

    this.qaPassed = false;
    this.metadata.qaFailedAt = Date.now();
    this.metadata.qaFailureReason = reason;
    
    this._recordTransition(this.currentState, this.currentState, `QA gate failed: ${reason}`);
    
    return false;
  }

  /**
   * Record transition in history
   */
  _recordTransition(from, to, reason) {
    this.history.push({
      from,
      to,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Get full history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Get current state snapshot
   */
  getState() {
    return {
      taskId: this.taskId,
      currentState: this.currentState,
      qaPassed: this.qaPassed,
      metadata: { ...this.metadata },
      historyLength: this.history.length
    };
  }

  /**
   * Reset to initial state (for testing/retry)
   */
  reset() {
    this.currentState = TaskStateMachine.STAGES.PROPOSAL;
    this.qaPassed = false;
    this.history = [];
    this.metadata = {
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this._recordTransition(null, TaskStateMachine.STAGES.PROPOSAL, 'reset');
  }
}

module.exports = TaskStateMachine;
