/**
 * Deadlock Detector - Deadlock Detection and Resolution for Triad
 * ==============================================================================
 * Detects voting deadlocks and provides resolution mechanisms.
 * Supports multiple resolution strategies including tie-breakers and timeouts.
 */

const EventEmitter = require('events');

// Deadlock types
const DeadlockType = {
    EQUAL_VOTES: 'equal_votes',
    QUORUM_FAILURE: 'quorum_failure',
    TIMEOUT: 'timeout',
    CIRCULAR_DEPENDENCY: 'circular_dependency'
};

// Resolution methods
const ResolutionMethod = {
    STEWARD_TIEBREAK: 'steward-tiebreak',
    TIMEOUT_EXPIRE: 'timeout-expire',
    REVOTE: 'revote',
    ESCALATE: 'escalate',
    RANDOM: 'random'
};

class DeadlockDetector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.triadMembers = config.triadMembers || ['steward', 'alpha', 'beta', 'gamma'];
        this.stewardId = config.stewardId || 'steward';
        this.timeoutMs = config.timeoutMs || 3600000; // 1 hour default
        this.revoteDelay = config.revoteDelay || 300000; // 5 minutes
    }

    /**
     * Check for deadlock in proposal votes
     * @param {Object} proposal - Proposal object with votes
     * @returns {Object|null} Deadlock info or null if no deadlock
     */
    detectDeadlock(proposal) {
        if (!proposal || !proposal.votes) {
            return null;
        }
        
        const votes = proposal.votes;
        const voteCounts = { approve: 0, reject: 0, abstain: 0 };
        
        // Count votes
        for (const voteData of Object.values(votes)) {
            voteCounts[voteData.value]++;
        }
        
        // Check for equal votes deadlock
        if (voteCounts.approve === voteCounts.reject && voteCounts.approve > 0) {
            const deadlock = {
                type: DeadlockType.EQUAL_VOTES,
                proposalId: proposal.id,
                detected: true,
                timestamp: new Date().toISOString(),
                details: {
                    approve: voteCounts.approve,
                    reject: voteCounts.reject,
                    abstain: voteCounts.abstain
                }
            };
            
            this.emit('deadlock:detected', deadlock);
            return deadlock;
        }
        
        // Check for timeout deadlock
        const now = new Date();
        const timeoutAt = new Date(proposal.timeoutAt || Date.now() + this.timeoutMs);
        
        if (now > timeoutAt && proposal.state === 'voting') {
            const deadlock = {
                type: DeadlockType.TIMEOUT,
                proposalId: proposal.id,
                detected: true,
                timestamp: now.toISOString(),
                details: {
                    timeoutAt: proposal.timeoutAt,
                    votesReceived: Object.keys(votes).length,
                    votesRequired: this.triadMembers.length
                }
            };
            
            this.emit('deadlock:detected', deadlock);
            return deadlock;
        }
        
        // Check for quorum failure
        const totalVotes = voteCounts.approve + voteCounts.reject + voteCounts.abstain;
        const quorumRequired = Math.ceil(this.triadMembers.length / 2);
        
        if (totalVotes > 0 && totalVotes < quorumRequired) {
            const missingMembers = this.triadMembers.filter(m => !votes[m]);
            
            if (missingMembers.length > 0 && now > timeoutAt) {
                const deadlock = {
                    type: DeadlockType.QUORUM_FAILURE,
                    proposalId: proposal.id,
                    detected: true,
                    timestamp: now.toISOString(),
                    details: {
                        votesReceived: totalVotes,
                        quorumRequired: quorumRequired,
                        missingMembers
                    }
                };
                
                this.emit('deadlock:detected', deadlock);
                return deadlock;
            }
        }
        
        return null;
    }

    /**
     * Resolve deadlock using specified method
     * @param {Object} proposal - Proposal object
     * @param {string} method - Resolution method
     * @returns {Object} Resolution result
     */
    resolveDeadlock(proposal, method) {
        const deadlock = this.detectDeadlock(proposal);
        
        if (!deadlock) {
            return {
                success: false,
                error: 'No deadlock detected',
                proposalId: proposal?.id
            };
        }
        
        switch (method) {
            case ResolutionMethod.STEWARD_TIEBREAK:
                return this._resolveWithStewardTiebreak(proposal, deadlock);
                
            case ResolutionMethod.TIMEOUT_EXPIRE:
                return this._resolveWithTimeoutExpire(proposal, deadlock);
                
            case ResolutionMethod.REVOTE:
                return this._resolveWithRevote(proposal, deadlock);
                
            case ResolutionMethod.ESCALATE:
                return this._resolveWithEscalation(proposal, deadlock);
                
            case ResolutionMethod.RANDOM:
                return this._resolveWithRandom(proposal, deadlock);
                
            default:
                return {
                    success: false,
                    error: `Unknown resolution method: ${method}`,
                    availableMethods: Object.values(ResolutionMethod)
                };
        }
    }

    /**
     * Resolve with steward tie-breaking vote
     * @private
     */
    _resolveWithStewardTiebreak(proposal, deadlock) {
        // Check if steward has already voted
        if (proposal.votes[this.stewardId]) {
            return {
                success: false,
                error: 'Steward has already voted, cannot break tie',
                proposalId: proposal.id,
                deadlock
            };
        }
        
        // Steward casts tie-breaking vote (defaults to approve in case of tie)
        const tiebreakVote = 'approve';
        
        this.emit('deadlock:resolved', {
            proposalId: proposal.id,
            method: ResolutionMethod.STEWARD_TIEBREAK,
            result: {
                tiebreakVoter: this.stewardId,
                tiebreakVote,
                outcome: 'approved'
            }
        });
        
        return {
            success: true,
            proposalId: proposal.id,
            method: ResolutionMethod.STEWARD_TIEBREAK,
            result: {
                tiebreakVoter: this.stewardId,
                tiebreakVote,
                outcome: 'approved',
                newVotes: {
                    ...proposal.votes,
                    [this.stewardId]: {
                        value: tiebreakVote,
                        timestamp: new Date().toISOString(),
                        isTiebreak: true
                    }
                }
            }
        };
    }

    /**
     * Resolve by expiring proposal due to timeout
     * @private
     */
    _resolveWithTimeoutExpire(proposal, deadlock) {
        this.emit('deadlock:resolved', {
            proposalId: proposal.id,
            method: ResolutionMethod.TIMEOUT_EXPIRE,
            result: {
                outcome: 'expired',
                reason: 'timeout'
            }
        });
        
        return {
            success: true,
            proposalId: proposal.id,
            method: ResolutionMethod.TIMEOUT_EXPIRE,
            result: {
                outcome: 'expired',
                reason: 'proposal timeout',
                timeoutAt: proposal.timeoutAt
            }
        };
    }

    /**
     * Resolve by scheduling a revote
     * @private
     */
    _resolveWithRevote(proposal, deadlock) {
        const revoteScheduledAt = new Date(Date.now() + this.revoteDelay);
        
        this.emit('deadlock:resolved', {
            proposalId: proposal.id,
            method: ResolutionMethod.REVOTE,
            result: {
                revoteScheduledAt: revoteScheduledAt.toISOString(),
                delayMinutes: this.revoteDelay / 60000
            }
        });
        
        return {
            success: true,
            proposalId: proposal.id,
            method: ResolutionMethod.REVOTE,
            result: {
                revoteScheduledAt: revoteScheduledAt.toISOString(),
                delayMinutes: this.revoteDelay / 60000,
                resetVotes: false, // Keep existing votes
                notifyMembers: this.triadMembers
            }
        };
    }

    /**
     * Resolve by escalating to higher authority
     * @private
     */
    _resolveWithEscalation(proposal, deadlock) {
        this.emit('deadlock:resolved', {
            proposalId: proposal.id,
            method: ResolutionMethod.ESCALATE,
            result: {
                escalated: true,
                requiresExternalDecision: true
            }
        });
        
        return {
            success: true,
            proposalId: proposal.id,
            method: ResolutionMethod.ESCALATE,
            result: {
                escalated: true,
                requiresExternalDecision: true,
                deadlockDetails: deadlock,
                proposalData: proposal
            }
        };
    }

    /**
     * Resolve with random decision (last resort)
     * @private
     */
    _resolveWithRandom(proposal, deadlock) {
        const randomOutcome = Math.random() > 0.5 ? 'approved' : 'rejected';
        
        this.emit('deadlock:resolved', {
            proposalId: proposal.id,
            method: ResolutionMethod.RANDOM,
            result: {
                outcome: randomOutcome,
                note: 'Random resolution used as last resort'
            }
        });
        
        return {
            success: true,
            proposalId: proposal.id,
            method: ResolutionMethod.RANDOM,
            result: {
                outcome: randomOutcome,
                note: 'Random resolution used as last resort'
            }
        };
    }

    /**
     * Get recommended resolution method for a deadlock
     * @param {Object} deadlock - Deadlock info
     * @returns {string} Recommended method
     */
    getRecommendedResolution(deadlock) {
        if (!deadlock) {
            return null;
        }
        
        switch (deadlock.type) {
            case DeadlockType.EQUAL_VOTES:
                return ResolutionMethod.STEWARD_TIEBREAK;
                
            case DeadlockType.TIMEOUT:
            case DeadlockType.QUORUM_FAILURE:
                return ResolutionMethod.REVOTE;
                
            default:
                return ResolutionMethod.ESCALATE;
        }
    }
}

module.exports = {
    DeadlockDetector,
    DeadlockType,
    ResolutionMethod
};
