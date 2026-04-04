/**
 * ==============================================================================
 * AgeMem Triad Consensus Module
 * ==============================================================================
 * Implements 2/3 consensus voting for sensitive memory operations
 * Integrates with governance module for quorum validation
 */

import type { AgentRole, MemoryOperation, MemoryType } from './governance';

/**
 * Triad agent roles
 */
export type TriadMember = 'alpha' | 'beta' | 'charlie';

/**
 * Vote options for consensus
 */
export type VoteOption = 'approve' | 'reject' | 'abstain';

/**
 * Consensus stage in deliberation
 */
export type ConsensusStage = 'voting' | 'deliberating' | 'finalized';

/**
 * Individual vote record
 */
export interface Vote {
  /** Agent ID */
  agentId: string;
  /** Triad member identifier */
  triadMember: TriadMember;
  /** Vote option */
  vote: VoteOption;
  /** Rationale for vote */
  rationale?: string;
  /** Timestamp of vote */
  timestamp: Date;
}

/**
 * Proposal for memory operation requiring consensus
 */
export interface ConsensusProposal {
  /** Unique proposal ID */
  proposalId: string;
  /** Agent ID proposing the operation */
  proposerId: string;
  /** Operation type */
  operation: MemoryOperation;
  /** Memory type */
  memoryType: MemoryType;
  /** Memory ID being operated on */
  memoryId: string;
  /** Current stage */
  stage: ConsensusStage;
  /** Votes collected */
  votes: Vote[];
  /** Start time */
  startTime: Date;
  /** End time (if finalized) */
  endTime?: Date;
  /** Consensus result */
  result?: ConsensusResult;
}

/**
 * Consensus result
 */
export interface ConsensusResult {
  /** Whether consensus was achieved */
  passed: boolean;
  /** Total votes */
  voteCount: number;
  /** Approve votes count */
  approveCount: number;
  /** Reject votes count */
  rejectCount: number;
  /** Abstain votes count */
  abstainCount: number;
  /** Whether unanimous */
  unanimous: boolean;
  /** Decision rationale */
  rationale?: string;
}

/**
 * Consensus configuration
 */
export interface ConsensusConfig {
  /** Minimum votes needed for quorum */
  minQuorumSize: number;
  /** Voting timeout in milliseconds */
  votingTimeoutMs: number;
  /** Auto-finalize on quorum */
  autoFinalize: boolean;
  /** Require unanimous for certain operations */
  requireUnanimousFor?: MemoryOperation[];
}

/**
 * Default consensus configuration
 */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  minQuorumSize: 2,
  votingTimeoutMs: 300000, // 5 minutes
  autoFinalize: true,
  requireUnanimousFor: ['delete'],
};

/**
 * Consensus tracking state
 */
export interface ConsensusState {
  /** Active proposals */
  proposals: Map<string, ConsensusProposal>;
  /** Completed proposals */
  history: ConsensusProposal[];
  /** Configuration */
  config: ConsensusConfig;
}

/**
 * Create consensus state
 */
export function createConsensusState(
  config: Partial<ConsensusConfig> = {}
): ConsensusState {
  return {
    proposals: new Map(),
    history: [],
    config: { ...DEFAULT_CONSENSUS_CONFIG, ...config },
  };
}

/**
 * Create a new consensus proposal
 */
export function createProposal(params: {
  proposerId: string;
  operation: MemoryOperation;
  memoryType: MemoryType;
  memoryId: string;
  proposalId?: string;
}): ConsensusProposal {
  const proposalId = params.proposalId || `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  return {
    proposalId,
    proposerId: params.proposerId,
    operation: params.operation,
    memoryType: params.memoryType,
    memoryId: params.memoryId,
    stage: 'voting',
    votes: [],
    startTime: new Date(),
  };
}

/**
 * Submit a vote for a proposal
 */
export function submitVote(
  state: ConsensusState,
  proposalId: string,
  vote: Vote
): { success: boolean; error?: string; consensus?: ConsensusResult } {
  const proposal = state.proposals.get(proposalId);
  
  if (!proposal) {
    return { success: false, error: 'Proposal not found' };
  }
  
  if (proposal.stage === 'finalized') {
    return { success: false, error: 'Proposal already finalized' };
  }
  
  // Check if this triad member already voted
  const existingVoteIndex = proposal.votes.findIndex(
    (v) => v.triadMember === vote.triadMember
  );
  
  if (existingVoteIndex !== -1) {
    // Update existing vote
    proposal.votes[existingVoteIndex] = vote;
  } else {
    // Add new vote
    proposal.votes.push(vote);
  }
  
  // Check if consensus achieved
  const result = calculateConsensus(proposal.votes, state.config);
  
  // Auto-finalize if configured and consensus reached
  if (state.config.autoFinalize && result.passed) {
    proposal.stage = 'finalized';
    proposal.endTime = new Date();
    proposal.result = result;
    
    // Move to history
    state.history.push(proposal);
    state.proposals.delete(proposalId);
    
    // Check unanimous requirement
    const requiresUnanimous = state.config.requireUnanimousFor?.includes(proposal.operation);
    if (requiresUnanimous && !result.unanimous) {
      return {
        success: false,
        error: 'Operation requires unanimous consent',
        consensus: result,
      };
    }
  }
  
  return { success: true, consensus: result };
}

/**
 * Calculate consensus from votes
 */
export function calculateConsensus(
  votes: Vote[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG
): ConsensusResult {
  const approveCount = votes.filter((v) => v.vote === 'approve').length;
  const rejectCount = votes.filter((v) => v.vote === 'reject').length;
  const abstainCount = votes.filter((v) => v.vote === 'abstain').length;
  const voteCount = votes.length;
  
  // Calculate non-abstaining votes
  const nonAbstainingVotes = approveCount + rejectCount;
  
  // Consensus passes if:
  // 1. Minimum quorum size reached (excluding abstentions)
  // 2. Majority of non-abstaining votes approve
  const quorumReached = nonAbstainingVotes >= config.minQuorumSize;
  const majorityApprove = approveCount > rejectCount;
  const passed = quorumReached && majorityApprove;
  
  // Check if unanimous (all votes are approve)
  const unanimous = voteCount > 0 && approveCount === voteCount;
  
  return {
    passed,
    voteCount,
    approveCount,
    rejectCount,
    abstainCount,
    unanimous,
  };
}

/**
 * Check if proposal has timeout
 */
export function checkProposalTimeout(
  proposal: ConsensusProposal,
  timeoutMs: number
): boolean {
  const now = new Date();
  const elapsed = now.getTime() - proposal.startTime.getTime();
  return elapsed > timeoutMs;
}

/**
 * Finalize a proposal (manual)
 */
export function finalizeProposal(
  state: ConsensusState,
  proposalId: string,
  rationale?: string
): { success: boolean; error?: string; result?: ConsensusResult } {
  const proposal = state.proposals.get(proposalId);
  
  if (!proposal) {
    return { success: false, error: 'Proposal not found' };
  }
  
  if (proposal.stage === 'finalized') {
    return { success: false, error: 'Proposal already finalized' };
  }
  
  // Calculate final result
  const result = calculateConsensus(proposal.votes, state.config);
  
  // Set rationale
  result.rationale = rationale;
  
  // Finalize
  proposal.stage = 'finalized';
  proposal.endTime = new Date();
  proposal.result = result;
  
  // Move to history
  state.history.push(proposal);
  state.proposals.delete(proposalId);
  
  return { success: true, result };
}

/**
 * Get proposal status
 */
export function getProposalStatus(
  state: ConsensusState,
  proposalId: string
): {
  found: boolean;
  proposal?: ConsensusProposal;
  result?: ConsensusResult;
  timeout?: boolean;
} {
  const proposal = state.proposals.get(proposalId);
  
  if (!proposal) {
    // Check history
    const historical = state.history.find((p) => p.proposalId === proposalId);
    if (historical) {
      return {
        found: true,
        proposal: historical,
        result: historical.result,
      };
    }
    return { found: false };
  }
  
  const result = calculateConsensus(proposal.votes, state.config);
  const timeout = checkProposalTimeout(proposal, state.config.votingTimeoutMs);
  
  return {
    found: true,
    proposal,
    result,
    timeout,
  };
}

/**
 * Validate agent can participate in triad
 * Note: In the Collective, any agent with steward, architect, or engineer role
 * can participate in triad consensus voting
 */
export function validateTriadParticipant(agentRole: AgentRole): boolean {
  // Steward, architect, and engineer can participate in triad voting
  return agentRole === 'steward' || agentRole === 'architect' || agentRole === 'engineer';
}

/**
 * Get operations requiring consensus
 */
export function getConsensusRequiredOperations(): MemoryOperation[] {
  return ['delete', 'archive'];
}

/**
 * Check if operation requires consensus
 */
export function requiresConsensus(operation: MemoryOperation): boolean {
  return getConsensusRequiredOperations().includes(operation);
}

/**
 * Create audit log entry for consensus
 */
export interface ConsensusAuditEntry {
  proposalId: string;
  operation: MemoryOperation;
  memoryId: string;
  result: ConsensusResult;
  participants: string[];
  timestamp: Date;
}

/**
 * Create consensus audit entry
 */
export function createConsensusAuditEntry(
  proposal: ConsensusProposal,
  result: ConsensusResult
): ConsensusAuditEntry {
  return {
    proposalId: proposal.proposalId,
    operation: proposal.operation,
    memoryId: proposal.memoryId,
    result,
    participants: proposal.votes.map((v) => v.agentId),
    timestamp: proposal.endTime || new Date(),
  };
}

/**
 * Get consensus metrics
 */
export interface ConsensusMetrics {
  totalProposals: number;
  approvedCount: number;
  rejectedCount: number;
  averageVoteTime: number;
  quorumSuccessRate: number;
  unanimousRate: number;
}

/**
 * Calculate consensus metrics
 */
export function calculateConsensusMetrics(state: ConsensusState): ConsensusMetrics {
  const allProposals = [...state.history, ...Array.from(state.proposals.values())];
  const finalizedProposals = state.history;
  
  const approvedCount = finalizedProposals.filter((p) => p.result?.passed).length;
  const rejectedCount = finalizedProposals.filter((p) => p.result && !p.result.passed).length;
  const unanimousCount = finalizedProposals.filter((p) => p.result?.unanimous).length;
  
  // Calculate average vote time
  const voteTimes = finalizedProposals
    .filter((p) => p.endTime)
    .map((p) => (p.endTime!.getTime() - p.startTime.getTime()) / 1000);
  const averageVoteTime =
    voteTimes.length > 0 ? voteTimes.reduce((a, b) => a + b, 0) / voteTimes.length : 0;
  
  // Quorum success rate
  const quorumSuccessRate =
    finalizedProposals.length > 0 ? approvedCount / finalizedProposals.length : 0;
  
  // Unanimous rate
  const unanimousRate =
    finalizedProposals.length > 0 ? unanimousCount / finalizedProposals.length : 0;
  
  return {
    totalProposals: allProposals.length,
    approvedCount,
    rejectedCount,
    averageVoteTime,
    quorumSuccessRate,
    unanimousRate,
  };
}
