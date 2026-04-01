/**
 * Proposal Tracker - Proposal State Machine for Triad Deliberation
 * ==============================================================================
 * Manages proposal lifecycle through states: draft -> pending -> voting -> approved/rejected/deadlocked
 * Tracks proposal metadata, votes, and execution status.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

// Proposal states
const ProposalState = {
    DRAFT: 'draft',
    PENDING: 'pending',
    VOTING: 'voting',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DEADLOCKED: 'deadlocked',
    EXECUTED: 'executed',
    EXPIRED: 'expired'
};

// Proposal types
const ProposalType = {
    CONFIG: 'config',
    DEPLOYMENT: 'deployment',
    GOVERNANCE: 'governance',
    SECURITY: 'security',
    MAINTENANCE: 'maintenance',
    CUSTOM: 'custom'
};

class ProposalTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        this.ledgerPath = config.ledgerPath || '/app/state/triad-ledger.json';
        this.proposalsPath = config.proposalsPath || '/app/state/proposals';
        this.gatewayUrl = config.gatewayUrl || 'ws://127.0.0.1:18789';
        
        // Quorum configuration
        this.quorumConfig = {
            minimumVotes: config.minimumVotes || 2,
            approvalThreshold: config.approvalThreshold || 0.5, // 50% for approval
            timeoutMs: config.timeoutMs || 3600000, // 1 hour default
            triadMembers: config.triadMembers || ['steward', 'alpha', 'beta', 'gamma']
        };
        
        // Ensure directories exist
        this._ensureDirectories();
    }

    /**
     * Ensure required directories exist
     * @private
     */
    _ensureDirectories() {
        const dir = path.dirname(this.proposalsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Create a new proposal
     * @param {Object} proposal - Proposal data
     * @returns {Object} Created proposal
     */
    createProposal(proposal) {
        const id = uuidv4();
        const now = new Date().toISOString();
        
        const newProposal = {
            id,
            title: proposal.title || 'Untitled Proposal',
            description: proposal.description || '',
            type: proposal.type || ProposalType.CUSTOM,
            state: ProposalState.DRAFT,
            creator: proposal.creator || 'unknown',
            createdAt: now,
            updatedAt: now,
            timeoutAt: new Date(Date.now() + this.quorumConfig.timeoutMs).toISOString(),
            votes: {},
            voteHistory: [],
            executionResult: null,
            metadata: proposal.metadata || {}
        };
        
        // Save proposal
        this._saveProposal(newProposal);
        
        // Add to ledger
        this._addToLedger({
            type: 'proposal_created',
            proposalId: id,
            timestamp: now,
            creator: newProposal.creator
        });
        
        this.emit('proposal:created', newProposal);
        
        return newProposal;
    }

    /**
     * Get proposal by ID
     * @param {string} proposalId - Proposal identifier
     * @returns {Object|null} Proposal or null
     */
    getProposal(proposalId) {
        const proposalPath = path.join(this.proposalsPath, `${proposalId}.json`);
        
        if (fs.existsSync(proposalPath)) {
            return JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
        }
        
        return null;
    }

    /**
     * Update proposal state
     * @param {string} proposalId - Proposal identifier
     * @param {string} newState - New state
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Updated proposal
     */
    updateState(proposalId, newState, metadata = {}) {
        const proposal = this.getProposal(proposalId);
        
        if (!proposal) {
            throw new Error(`Proposal not found: ${proposalId}`);
        }
        
        const validTransitions = this._getValidTransitions(proposal.state);
        
        if (!validTransitions.includes(newState)) {
            throw new Error(`Invalid state transition from ${proposal.state} to ${newState}`);
        }
        
        const oldState = proposal.state;
        proposal.state = newState;
        proposal.updatedAt = new Date().toISOString();
        Object.assign(proposal, metadata);
        
        this._saveProposal(proposal);
        
        // Log state change
        this._addToLedger({
            type: 'proposal_state_change',
            proposalId,
            oldState,
            newState,
            timestamp: proposal.updatedAt
        });
        
        this.emit('proposal:statechange', { proposal, oldState, newState });
        
        return proposal;
    }

    /**
     * Get valid state transitions for current state
     * @private
     */
    _getValidTransitions(state) {
        const transitions = {
            [ProposalState.DRAFT]: [ProposalState.PENDING, ProposalState.EXPIRED],
            [ProposalState.PENDING]: [ProposalState.VOTING, ProposalState.EXPIRED],
            [ProposalState.VOTING]: [ProposalState.APPROVED, ProposalState.REJECTED, ProposalState.DEADLOCKED, ProposalState.EXPIRED],
            [ProposalState.APPROVED]: [ProposalState.EXECUTED],
            [ProposalState.REJECTED]: [],
            [ProposalState.DEADLOCKED]: [ProposalState.VOTING, ProposalState.EXPIRED],
            [ProposalState.EXECUTED]: [],
            [ProposalState.EXPIRED]: []
        };
        
        return transitions[state] || [];
    }

    /**
     * Add vote to proposal
     * @param {string} proposalId - Proposal identifier
     * @param {string} voter - Voter identifier
     * @param {string} vote - Vote value (approve, reject, abstain)
     * @returns {Object} Updated proposal
     */
    addVote(proposalId, voter, vote) {
        const proposal = this.getProposal(proposalId);
        
        if (!proposal) {
            throw new Error(`Proposal not found: ${proposalId}`);
        }
        
        if (proposal.state !== ProposalState.VOTING && proposal.state !== ProposalState.PENDING) {
            throw new Error(`Cannot vote on proposal in state ${proposal.state}`);
        }
        
        // Validate vote
        const validVotes = ['approve', 'reject', 'abstain'];
        if (!validVotes.includes(vote)) {
            throw new Error(`Invalid vote: ${vote}. Must be one of: ${validVotes.join(', ')}`);
        }
        
        // Record vote
        const previousVote = proposal.votes[voter];
        proposal.votes[voter] = {
            value: vote,
            timestamp: new Date().toISOString()
        };
        
        proposal.voteHistory.push({
            voter,
            vote,
            timestamp: proposal.votes[voter].timestamp,
            previousVote
        });
        
        proposal.updatedAt = new Date().toISOString();
        
        this._saveProposal(proposal);
        
        // Log vote
        this._addToLedger({
            type: 'vote_cast',
            proposalId,
            voter,
            vote,
            previousVote,
            timestamp: proposal.votes[voter].timestamp
        });
        
        this.emit('vote:cast', { proposalId, voter, vote });
        
        // Auto-transition to voting if first vote
        if (proposal.state === ProposalState.PENDING && Object.keys(proposal.votes).length > 0) {
            this.updateState(proposalId, ProposalState.VOTING);
        }
        
        return proposal;
    }

    /**
     * Get vote tally for proposal
     * @param {string} proposalId - Proposal identifier
     * @returns {Object} Vote tally
     */
    getVoteTally(proposalId) {
        const proposal = this.getProposal(proposalId);
        
        if (!proposal) {
            return null;
        }
        
        const tally = {
            approve: 0,
            reject: 0,
            abstain: 0,
            total: 0,
            missing: []
        };
        
        for (const [voter, voteData] of Object.entries(proposal.votes)) {
            tally[voteData.value]++;
            tally.total++;
        }
        
        // Find missing votes
        for (const member of this.quorumConfig.triadMembers) {
            if (!proposal.votes[member]) {
                tally.missing.push(member);
            }
        }
        
        return tally;
    }

    /**
     * Check if proposal has reached quorum
     * @param {string} proposalId - Proposal identifier
     * @returns {Object} Quorum status
     */
    checkQuorum(proposalId) {
        const tally = this.getVoteTally(proposalId);
        
        if (!tally) {
            return { hasQuorum: false, reason: 'proposal_not_found' };
        }
        
        const hasQuorum = tally.total >= this.quorumConfig.minimumVotes;
        
        return {
            hasQuorum,
            votes: tally.total,
            required: this.quorumConfig.minimumVotes,
            missing: tally.missing
        };
    }

    /**
     * Determine proposal outcome based on votes
     * @param {string} proposalId - Proposal identifier
     * @returns {Object} Outcome determination
     */
    determineOutcome(proposalId) {
        const proposal = this.getProposal(proposalId);
        const tally = this.getVoteTally(proposalId);
        
        if (!proposal || !tally) {
            return { outcome: 'unknown', reason: 'proposal_not_found' };
        }
        
        // Check for deadlock (equal approve/reject)
        if (tally.approve === tally.reject && tally.approve > 0) {
            return {
                outcome: 'deadlock',
                reason: 'equal_votes',
                tally
            };
        }
        
        // Check if quorum reached
        if (tally.total < this.quorumConfig.minimumVotes) {
            return {
                outcome: 'pending',
                reason: 'quorum_not_reached',
                tally
            };
        }
        
        // Determine winner
        const approvalRate = tally.approve / (tally.approve + tally.reject);
        
        if (approvalRate > this.quorumConfig.approvalThreshold) {
            return {
                outcome: 'approved',
                approvalRate,
                tally
            };
        } else {
            return {
                outcome: 'rejected',
                approvalRate,
                tally
            };
        }
    }

    /**
     * Get all proposals
     * @param {Object} filter - Filter options
     * @returns {Array<Object>} List of proposals
     */
    getAllProposals(filter = {}) {
        if (!fs.existsSync(this.proposalsPath)) {
            return [];
        }
        
        const files = fs.readdirSync(this.proposalsPath);
        const proposals = [];
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            try {
                const proposal = this.getProposal(file.replace('.json', ''));
                
                // Apply filters
                if (filter.state && proposal.state !== filter.state) continue;
                if (filter.type && proposal.type !== filter.type) continue;
                if (filter.creator && proposal.creator !== filter.creator) continue;
                
                proposals.push(proposal);
            } catch (error) {
                // Skip corrupted files
            }
        }
        
        // Sort by creation date
        proposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return proposals;
    }

    /**
     * Save proposal to disk
     * @private
     */
    _saveProposal(proposal) {
        const proposalPath = path.join(this.proposalsPath, `${proposal.id}.json`);
        fs.writeFileSync(proposalPath, JSON.stringify(proposal, null, 2));
    }

    /**
     * Add entry to ledger
     * @private
     */
    _addToLedger(entry) {
        let ledger = this._loadLedger();
        ledger.entries.push(entry);
        
        // Keep last 1000 entries
        if (ledger.entries.length > 1000) {
            ledger.entries = ledger.entries.slice(-1000);
        }
        
        ledger.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.ledgerPath, JSON.stringify(ledger, null, 2));
    }

    /**
     * Load ledger from disk
     * @private
     */
    _loadLedger() {
        if (fs.existsSync(this.ledgerPath)) {
            return JSON.parse(fs.readFileSync(this.ledgerPath, 'utf8'));
        }
        
        return {
            entries: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Get ledger entries
     * @param {number} limit - Maximum entries to return
     * @returns {Array<Object>} Ledger entries
     */
    getLedger(limit = 100) {
        const ledger = this._loadLedger();
        return ledger.entries.slice(-limit);
    }

    /**
     * Verify ledger integrity
     * @returns {Object} Verification result
     */
    verifyLedger() {
        const ledger = this._loadLedger();
        const issues = [];
        
        // Check for duplicate entries
        const seen = new Set();
        for (const entry of ledger.entries) {
            const key = `${entry.type}-${entry.proposalId}-${entry.timestamp}`;
            if (seen.has(key)) {
                issues.push(`Duplicate entry: ${key}`);
            }
            seen.add(key);
        }
        
        return {
            valid: issues.length === 0,
            entryCount: ledger.entries.length,
            issues
        };
    }
}

module.exports = {
    ProposalTracker,
    ProposalState,
    ProposalType
};
