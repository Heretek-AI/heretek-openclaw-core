#!/usr/bin/env node
/**
 * Triad Orchestrator - Main Entry Point
 * ==============================================================================
 * Manages triad deliberation workflows including proposals, votes,
 * deadlock detection, and consensus ledger synchronization.
 */

const { ProposalTracker, ProposalState } = require('./proposal-tracker');
const VoteCollector = require('./vote-collector');
const { DeadlockDetector, DeadlockType, ResolutionMethod } = require('./deadlock-detector');

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        command: args[0],
        options: {}
    };
    
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
            result.options[key] = value;
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true;
            result.options[key] = value;
        }
    }
    
    return result;
}

/**
 * Format proposal for display
 * @param {Object} proposal - Proposal data
 */
function formatProposal(proposal) {
    if (!proposal) {
        console.log('Proposal not found');
        return;
    }
    
    console.log('\n=== Proposal Details ===\n');
    console.log(`ID:        ${proposal.id}`);
    console.log(`Title:     ${proposal.title}`);
    console.log(`Type:      ${proposal.type}`);
    console.log(`State:     ${proposal.state}`);
    console.log(`Creator:   ${proposal.creator}`);
    console.log(`Created:   ${new Date(proposal.createdAt).toLocaleString()}`);
    console.log(`Updated:   ${new Date(proposal.updatedAt).toLocaleString()}`);
    console.log(`Timeout:   ${new Date(proposal.timeoutAt).toLocaleString()}`);
    
    console.log('\n--- Votes ---');
    for (const [voter, voteData] of Object.entries(proposal.votes || {})) {
        console.log(`  ${voter}: ${voteData.value} (${new Date(voteData.timestamp).toLocaleTimeString()})`);
    }
    
    console.log('\n');
}

/**
 * Format proposals list
 * @param {Array<Object>} proposals - List of proposals
 */
function formatProposalsList(proposals) {
    console.log('\n=== Proposals ===\n');
    console.log('ID'.padEnd(36), 'TITLE'.padEnd(30), 'STATE'.padEnd(12), 'CREATED');
    console.log('-'.repeat(100));
    
    for (const proposal of proposals) {
        const title = proposal.title.length > 28 ? proposal.title.slice(0, 28) + '...' : proposal.title;
        console.log(
            proposal.id.slice(0, 36).padEnd(36),
            title.padEnd(30),
            proposal.state.padEnd(12),
            new Date(proposal.createdAt).toLocaleDateString()
        );
    }
    
    console.log('\n');
}

/**
 * Format vote tally
 * @param {Object} tally - Vote tally
 */
function formatVoteTally(tally) {
    console.log('\n=== Vote Tally ===\n');
    console.log(`Approve:  ${tally.approve}`);
    console.log(`Reject:   ${tally.reject}`);
    console.log(`Abstain:  ${tally.abstain}`);
    console.log(`Total:    ${tally.total}`);
    
    if (tally.missing && tally.missing.length > 0) {
        console.log(`\nMissing:  ${tally.missing.join(', ')}`);
    }
    
    console.log('\n');
}

/**
 * Format triad dashboard
 * @param {Object} dashboard - Dashboard data
 */
function formatDashboard(dashboard) {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║           TRIAD DELIBERATION DASHBOARD                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    console.log('=== Active Proposals ===\n');
    console.log('STATE'.padEnd(15), 'COUNT');
    console.log('-'.repeat(25));
    
    for (const [state, count] of Object.entries(dashboard.proposalStates)) {
        console.log(state.padEnd(15), count);
    }
    
    console.log('\n=== Triad Members ===\n');
    console.log('MEMBER'.padEnd(15), 'STATUS'.padEnd(10), 'VOTES CAST');
    console.log('-'.repeat(40));
    
    for (const member of dashboard.triadMembers) {
        console.log(
            member.id.padEnd(15),
            member.status.padEnd(10),
            member.votesCast
        );
    }
    
    console.log('\n=== Recent Activity ===\n');
    for (const activity of dashboard.recentActivity.slice(0, 5)) {
        console.log(`[${new Date(activity.timestamp).toLocaleTimeString()}] ${activity.type}: ${activity.details}`);
    }
    
    console.log('\n');
}

/**
 * Main CLI handler
 */
async function main() {
    const { command, options } = parseArgs();
    
    const tracker = new ProposalTracker({
        gatewayUrl: options.gateway || 'ws://127.0.0.1:18789'
    });
    
    const collector = new VoteCollector({
        gatewayUrl: options.gateway || 'ws://127.0.0.1:18789'
    });
    
    const detector = new DeadlockDetector();
    
    try {
        switch (command) {
            case 'propose':
                {
                    const proposal = tracker.createProposal({
                        title: options.title || 'Untitled Proposal',
                        description: options.description || '',
                        type: options.type || 'custom',
                        creator: options.creator || 'cli'
                    });
                    
                    console.log('Proposal created:');
                    formatProposal(proposal);
                    
                    // Auto-transition to pending
                    tracker.updateState(proposal.id, ProposalState.PENDING);
                    console.log('Proposal moved to PENDING state');
                }
                break;
                
            case 'proposal':
                {
                    const proposalId = options.id || options.proposal;
                    
                    if (!proposalId) {
                        console.log('Error: --id or --proposal required');
                        process.exit(1);
                    }
                    
                    const proposal = tracker.getProposal(proposalId);
                    formatProposal(proposal);
                }
                break;
                
            case 'proposals':
                {
                    const filter = {};
                    if (options.status) filter.state = options.status;
                    if (options.type) filter.type = options.type;
                    
                    const proposals = tracker.getAllProposals(filter);
                    formatProposalsList(proposals);
                }
                break;
                
            case 'vote':
                {
                    const proposalId = options.proposal || options.id;
                    const vote = options.vote;
                    const voter = options.voter || 'cli';
                    
                    if (!proposalId || !vote) {
                        console.log('Error: --proposal and --vote required');
                        process.exit(1);
                    }
                    
                    const result = await collector.submitVote(proposalId, voter, vote);
                    console.log('Vote result:', JSON.stringify(result, null, 2));
                }
                break;
                
            case 'votes':
                {
                    const proposalId = options.proposal || options.id;
                    
                    if (!proposalId) {
                        console.log('Error: --proposal required');
                        process.exit(1);
                    }
                    
                    const status = collector.getVoteStatus(proposalId);
                    console.log('Vote status:', JSON.stringify(status, null, 2));
                }
                break;
                
            case 'tabulate':
                {
                    const proposalId = options.proposal || options.id;
                    
                    if (!proposalId) {
                        console.log('Error: --proposal required');
                        process.exit(1);
                    }
                    
                    const tally = tracker.getVoteTally(proposalId);
                    formatVoteTally(tally);
                    
                    // Determine outcome
                    const outcome = tracker.determineOutcome(proposalId);
                    console.log('Outcome:', JSON.stringify(outcome, null, 2));
                }
                break;
                
            case 'check-deadlock':
                {
                    const proposalId = options.proposal || options.id;
                    
                    if (!proposalId) {
                        console.log('Error: --proposal required');
                        process.exit(1);
                    }
                    
                    const proposal = tracker.getProposal(proposalId);
                    const deadlock = detector.detectDeadlock(proposal);
                    
                    if (deadlock) {
                        console.log('Deadlock detected:');
                        console.log(JSON.stringify(deadlock, null, 2));
                        
                        const recommended = detector.getRecommendedResolution(deadlock);
                        console.log(`Recommended resolution: ${recommended}`);
                    } else {
                        console.log('No deadlock detected');
                    }
                }
                break;
                
            case 'resolve-deadlock':
                {
                    const proposalId = options.proposal || options.id;
                    const method = options.method || 'steward-tiebreak';
                    
                    if (!proposalId) {
                        console.log('Error: --proposal required');
                        process.exit(1);
                    }
                    
                    const proposal = tracker.getProposal(proposalId);
                    const result = detector.resolveDeadlock(proposal, method);
                    
                    console.log('Resolution result:');
                    console.log(JSON.stringify(result, null, 2));
                    
                    if (result.success && result.result.outcome) {
                        // Update proposal state
                        const newState = result.result.outcome === 'approved' 
                            ? ProposalState.APPROVED 
                            : ProposalState.REJECTED;
                        tracker.updateState(proposalId, newState);
                        console.log(`Proposal state updated to ${newState}`);
                    }
                }
                break;
                
            case 'sync-ledger':
                {
                    const ledger = tracker.getLedger(50);
                    console.log('Ledger entries (last 50):');
                    console.log(JSON.stringify(ledger, null, 2));
                }
                break;
                
            case 'verify-ledger':
                {
                    const result = tracker.verifyLedger();
                    console.log('Ledger verification:');
                    console.log(JSON.stringify(result, null, 2));
                }
                break;
                
            case 'ledger':
                {
                    const limit = parseInt(options.limit) || 50;
                    const ledger = tracker.getLedger(limit);
                    console.log(`Ledger entries (last ${limit}):`);
                    console.log(JSON.stringify(ledger, null, 2));
                }
                break;
                
            case 'status':
                {
                    const dashboard = {
                        proposalStates: {
                            draft: 0,
                            pending: 0,
                            voting: 0,
                            approved: 0,
                            rejected: 0,
                            deadlocked: 0,
                            executed: 0
                        },
                        triadMembers: [
                            { id: 'steward', status: 'active', votesCast: 0 },
                            { id: 'alpha', status: 'active', votesCast: 0 },
                            { id: 'beta', status: 'active', votesCast: 0 },
                            { id: 'gamma', status: 'active', votesCast: 0 }
                        ],
                        recentActivity: tracker.getLedger(10)
                    };
                    
                    // Count proposal states
                    const allProposals = tracker.getAllProposals();
                    for (const p of allProposals) {
                        dashboard.proposalStates[p.state]++;
                    }
                    
                    if (options.json) {
                        console.log(JSON.stringify(dashboard, null, 2));
                    } else {
                        formatDashboard(dashboard);
                    }
                }
                break;
                
            case 'dashboard':
                {
                    const dashboard = {
                        proposalStates: {
                            draft: 0,
                            pending: 0,
                            voting: 0,
                            approved: 0,
                            rejected: 0,
                            deadlocked: 0,
                            executed: 0
                        },
                        triadMembers: [
                            { id: 'steward', status: 'active', votesCast: 0 },
                            { id: 'alpha', status: 'active', votesCast: 0 },
                            { id: 'beta', status: 'active', votesCast: 0 },
                            { id: 'gamma', status: 'active', votesCast: 0 }
                        ],
                        recentActivity: tracker.getLedger(10)
                    };
                    
                    const allProposals = tracker.getAllProposals();
                    for (const p of allProposals) {
                        dashboard.proposalStates[p.state]++;
                    }
                    
                    formatDashboard(dashboard);
                }
                break;
                
            case 'history':
                {
                    const proposalId = options.proposal || options.id;
                    
                    if (!proposalId) {
                        console.log('Error: --proposal required');
                        process.exit(1);
                    }
                    
                    const proposal = tracker.getProposal(proposalId);
                    console.log('Proposal history:');
                    console.log(JSON.stringify(proposal?.voteHistory || [], null, 2));
                }
                break;
                
            default:
                console.log(`
Triad Orchestrator

Usage: node index.js <command> [options]

Commands:
  propose          Create a new proposal
  proposal         View proposal details (--id required)
  proposals        List all proposals
  vote             Submit a vote (--proposal, --vote required)
  votes            View vote status (--proposal required)
  tabulate         Tabulate votes (--proposal required)
  check-deadlock   Check for deadlock (--proposal required)
  resolve-deadlock Resolve deadlock (--proposal, --method required)
  sync-ledger      Sync consensus ledger
  verify-ledger    Verify ledger integrity
  ledger           View ledger entries
  status           Show triad status
  dashboard        Show full triad dashboard
  history          View proposal vote history

Options:
  --id <id>        Proposal ID
  --proposal <id>  Proposal ID
  --title <title>  Proposal title
  --type <type>    Proposal type (config, deployment, governance, etc.)
  --vote <vote>    Vote value (approve, reject, abstain)
  --voter <id>     Voter ID
  --method <method> Deadlock resolution method
  --json           Output in JSON format
  --gateway <url>  Gateway WebSocket URL

Examples:
  node index.js propose --title "Deploy update" --type deployment
  node index.js proposal --id <proposal-id>
  node index.js vote --proposal <id> --vote approve --voter alpha
  node index.js tabulate --proposal <id>
  node index.js check-deadlock --proposal <id>
  node index.js dashboard
`);
                break;
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await collector.disconnect();
    }
}

// Export for programmatic use
module.exports = {
    ProposalTracker,
    VoteCollector,
    DeadlockDetector,
    ProposalState,
    main
};

// Run CLI if executed directly
if (require.main === module) {
    main();
}
