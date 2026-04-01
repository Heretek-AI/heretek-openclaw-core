/**
 * Vote Collector - Vote Aggregation for Triad Deliberation
 * ==============================================================================
 * Collects, validates, and aggregates votes from triad members.
 * Supports weighted voting and vote delegation.
 */

const EventEmitter = require('events');
const WebSocket = require('ws');

class VoteCollector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.gatewayUrl = config.gatewayUrl || 'ws://127.0.0.1:18789';
        this.triadMembers = config.triadMembers || ['steward', 'alpha', 'beta', 'gamma'];
        this.voteWeights = config.voteWeights || {
            steward: 1.5,
            alpha: 1.0,
            beta: 1.0,
            gamma: 1.0
        };
        this.ws = null;
        this.pendingVotes = new Map();
        this.voteTimeout = config.voteTimeout || 30000;
    }

    /**
     * Connect to Gateway for vote collection
     * @returns {Promise<boolean>} Connection status
     */
    async connectToGateway() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.gatewayUrl);
                
                this.ws.on('open', () => {
                    this.emit('gateway:connected');
                    resolve(true);
                });
                
                this.ws.on('message', (data) => {
                    this._handleGatewayMessage(data);
                });
                
                this.ws.on('error', (error) => {
                    this.emit('gateway:error', error);
                    reject(error);
                });
                
                this.ws.on('close', () => {
                    this.emit('gateway:disconnected');
                });
                
                setTimeout(() => {
                    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                        reject(new Error('Gateway connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle Gateway messages
     * @private
     */
    _handleGatewayMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'vote_submission') {
                this._processVote(message.proposalId, message.voter, message.vote);
            }
        } catch (error) {
            this.emit('error', { operation: 'handleGatewayMessage', error: error.message });
        }
    }

    /**
     * Process incoming vote
     * @private
     */
    _processVote(proposalId, voter, vote) {
        if (this.pendingVotes.has(proposalId)) {
            const voteData = this.pendingVotes.get(proposalId);
            voteData.votes[voter] = {
                value: vote,
                timestamp: new Date().toISOString(),
                weight: this.voteWeights[voter] || 1.0
            };
            
            this.emit('vote:received', { proposalId, voter, vote });
        }
    }

    /**
     * Submit vote for a proposal
     * @param {string} proposalId - Proposal identifier
     * @param {string} voter - Voter identifier
     * @param {string} vote - Vote value
     * @returns {Promise<Object>} Vote result
     */
    async submitVote(proposalId, voter, vote) {
        const validVotes = ['approve', 'reject', 'abstain'];
        
        if (!validVotes.includes(vote)) {
            return {
                success: false,
                error: `Invalid vote: ${vote}. Must be one of: ${validVotes.join(', ')}`
            };
        }
        
        if (!this.triadMembers.includes(voter)) {
            return {
                success: false,
                error: `Unknown voter: ${ voter }. Valid voters: ${this.triadMembers.join(', ')}`
            };
        }
        
        // Send vote via Gateway
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const voteMessage = {
                type: 'vote_submission',
                proposalId,
                voter,
                vote,
                timestamp: new Date().toISOString()
            };
            
            this.ws.send(JSON.stringify(voteMessage));
            
            return {
                success: true,
                proposalId,
                voter,
                vote,
                weight: this.voteWeights[voter] || 1.0
            };
        } else {
            // Store locally if Gateway not connected
            if (!this.pendingVotes.has(proposalId)) {
                this.pendingVotes.set(proposalId, {
                    proposalId,
                    votes: {},
                    createdAt: new Date().toISOString()
                });
            }
            
            const voteData = this.pendingVotes.get(proposalId);
            voteData.votes[voter] = {
                value: vote,
                timestamp: new Date().toISOString(),
                weight: this.voteWeights[voter] || 1.0
            };
            
            return {
                success: true,
                proposalId,
                voter,
                vote,
                weight: this.voteWeights[voter] || 1.0,
                note: 'Stored locally (Gateway not connected)'
            };
        }
    }

    /**
     * Get aggregated vote results
     * @param {string} proposalId - Proposal identifier
     * @returns {Object} Vote aggregation
     */
    getAggregation(proposalId) {
        const voteData = this.pendingVotes.get(proposalId);
        
        if (!voteData) {
            return null;
        }
        
        const aggregation = {
            proposalId,
            weighted: {
                approve: 0,
                reject: 0,
                abstain: 0
            },
            raw: {
                approve: 0,
                reject: 0,
                abstain: 0
            },
            byVoter: {},
            totalWeight: 0,
            timestamp: new Date().toISOString()
        };
        
        for (const [voter, voteInfo] of Object.entries(voteData.votes)) {
            // Raw count
            aggregation.raw[voteInfo.value]++;
            
            // Weighted count
            aggregation.weighted[voteInfo.value] += voteInfo.weight;
            aggregation.totalWeight += voteInfo.weight;
            
            // By voter
            aggregation.byVoter[voter] = voteInfo;
        }
        
        // Calculate percentages
        const totalVotes = aggregation.raw.approve + aggregation.raw.reject + aggregation.raw.abstain;
        if (totalVotes > 0) {
            aggregation.percentages = {
                approve: (aggregation.raw.approve / totalVotes) * 100,
                reject: (aggregation.raw.reject / totalVotes) * 100,
                abstain: (aggregation.raw.abstain / totalVotes) * 100
            };
        }
        
        return aggregation;
    }

    /**
     * Get vote status for all triad members
     * @param {string} proposalId - Proposal identifier
     * @returns {Object} Vote status
     */
    getVoteStatus(proposalId) {
        const voteData = this.pendingVotes.get(proposalId);
        const status = {
            proposalId,
            voted: [],
            missing: [],
            total: this.triadMembers.length
        };
        
        for (const member of this.triadMembers) {
            if (voteData && voteData.votes[member]) {
                status.voted.push({
                    member,
                    vote: voteData.votes[member].value,
                    timestamp: voteData.votes[member].timestamp
                });
            } else {
                status.missing.push(member);
            }
        }
        
        return status;
    }

    /**
     * Clear vote data for a proposal
     * @param {string} proposalId - Proposal identifier
     */
    clearVotes(proposalId) {
        this.pendingVotes.delete(proposalId);
        this.emit('votes:cleared', proposalId);
    }

    /**
     * Disconnect from Gateway
     */
    async disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = VoteCollector;
