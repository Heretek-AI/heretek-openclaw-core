/**
 * Agent Reputation System for Memory Access Control
 * 
 * Implements reputation-weighted write permissions for the AgeMem unified memory system.
 * Tracks agent behavior, calculates trust scores, and gates memory operations based on
 * reputation thresholds.
 * 
 * @module reputation-system
 */

export interface AgentReputation {
  agentId: string;
  agentRole: string;
  trustScore: number;           // 0-100, dynamic reputation score
  memoryWrites: number;         // Total successful writes
  memoryViolations: number;     // Rejected write attempts
  poisonDetections: number;     // Times content flagged as potentially malicious
  godModeAttempts: number;      // Times agent attempted privileged operations
  consecutiveSuccesses: number; // Streak of successful operations
  lastActivity: Date;
  joinedAt: Date;
  reputationHistory: ReputationEntry[];
}

export interface ReputationEntry {
  timestamp: Date;
  previousScore: number;
  newScore: number;
  delta: number;
  reason: string;
  operationType?: string;
}

export interface ReputationConfig {
  enabled: boolean;
  initialTrustScore: number;      // Starting score for new agents
  minTrustScore: number;          // Minimum possible score
  maxTrustScore: number;          // Maximum possible score
  writePermissionThreshold: number; // Minimum score to write memories
  highTrustThreshold: number;     // Score for elevated privileges
  criticalOperationThreshold: number; // Score for sensitive operations
  
  // Score adjustments
  successfulWriteBonus: number;   // Points added per successful write
  violationPenalty: number;       // Points deducted per violation
  poisonPenalty: number;          // Points deducted for poisoning detection
  godModePenalty: number;         // Points deducted for God Mode attempt
  consecutiveSuccessBonus: number; // Bonus per consecutive success (capped)
  maxConsecutiveBonus: number;    // Maximum consecutive bonus
  decayRate: number;              // Daily decay for inactive agents
  decayAfterDays: number;         // Days of inactivity before decay starts
  
  // Recovery mechanisms
  probationPeriod: number;        // Days in probation after violation
  probationWriteLimit: number;    // Max writes during probation
  recoveryRate: number;           // Points per day of good behavior
  
  // System limits
  maxLogEntries: number;          // Maximum activity log entries
}

export interface ReputationCheckResult {
  allowed: boolean;
  agentReputation: AgentReputation | null;
  reason: string;
  requiredScore: number;
  actualScore: number;
  suggestions?: string[];
}

export interface ReputationUpdateResult {
  previousScore: number;
  newScore: number;
  delta: number;
  entry: ReputationEntry;
}

export interface AgentActivityLog {
  agentId: string;
  timestamp: Date;
  operationType: string;
  success: boolean;
  details?: Record<string, unknown>;
}

export interface ReputationSystemState {
  config: ReputationConfig;
  agents: Map<string, AgentReputation>;
  activityLog: AgentActivityLog[];
  maxLogEntries: number;
}

/**
 * Create default reputation system configuration
 */
export function createReputationConfig(overrides?: Partial<ReputationConfig>): ReputationConfig {
  const defaultConfig: ReputationConfig = {
    enabled: true,
    initialTrustScore: 50,
    minTrustScore: 0,
    maxTrustScore: 100,
    writePermissionThreshold: 30,
    highTrustThreshold: 70,
    criticalOperationThreshold: 85,
    successfulWriteBonus: 2,
    violationPenalty: 10,
    poisonPenalty: 25,
    godModePenalty: 30,
    consecutiveSuccessBonus: 0.5,
    maxConsecutiveBonus: 10,
    decayRate: 1,
    decayAfterDays: 7,
    probationPeriod: 3,
    probationWriteLimit: 5,
    recoveryRate: 3,
    maxLogEntries: 10000,
  };

  return { ...defaultConfig, ...overrides };
}

/**
 * Initialize reputation system state
 */
export function createReputationState(config?: Partial<ReputationConfig>): ReputationSystemState {
  const fullConfig = createReputationConfig(config);
  return {
    config: fullConfig,
    agents: new Map(),
    activityLog: [],
    maxLogEntries: config?.maxLogEntries ?? fullConfig.maxLogEntries,
  };
}

/**
 * Register a new agent in the reputation system
 */
export function registerAgent(
  state: ReputationSystemState,
  agentId: string,
  agentRole: string
): AgentReputation {
  const now = new Date();
  const reputation: AgentReputation = {
    agentId,
    agentRole,
    trustScore: state.config.initialTrustScore,
    memoryWrites: 0,
    memoryViolations: 0,
    poisonDetections: 0,
    godModeAttempts: 0,
    consecutiveSuccesses: 0,
    lastActivity: now,
    joinedAt: now,
    reputationHistory: [],
  };

  state.agents.set(agentId, reputation);
  return reputation;
}

/**
 * Get or create agent reputation
 */
export function getOrCreateAgent(
  state: ReputationSystemState,
  agentId: string,
  agentRole?: string
): AgentReputation {
  const existing = state.agents.get(agentId);
  if (existing) {
    return existing;
  }

  if (!agentRole) {
    throw new Error(`Unknown agent ${agentId} and no role provided`);
  }

  return registerAgent(state, agentId, agentRole);
}

/**
 * Check if agent has permission to write memories
 */
export function checkWritePermission(
  state: ReputationSystemState,
  agentId: string
): ReputationCheckResult {
  const agent = state.agents.get(agentId);

  if (!agent) {
    return {
      allowed: false,
      agentReputation: null,
      reason: 'Agent not registered in reputation system',
      requiredScore: state.config.writePermissionThreshold,
      actualScore: 0,
      suggestions: ['Register agent before attempting memory operations'],
    };
  }

  const { trustScore } = agent;
  const threshold = state.config.writePermissionThreshold;

  if (trustScore < threshold) {
    return {
      allowed: false,
      agentReputation: agent,
      reason: `Trust score ${trustScore} below threshold ${threshold}`,
      requiredScore: threshold,
      actualScore: trustScore,
      suggestions: [
        'Improve reputation through successful operations',
        'Avoid violations and security detections',
        'Maintain consistent activity to prevent decay',
      ],
    };
  }

  // Check probation limits
  if (agent.memoryViolations > 0) {
    const daysSinceLastViolation = calculateDaysSinceLastViolation(agent);
    if (daysSinceLastViolation < state.config.probationPeriod) {
      // Calculate writes during probation period
      const writesDuringProbation = agent.memoryWrites % state.config.probationWriteLimit;
      if (writesDuringProbation >= state.config.probationWriteLimit) {
        return {
          allowed: false,
          agentReputation: agent,
          reason: `Agent in probation period - write limit reached`,
          requiredScore: threshold,
          actualScore: trustScore,
          suggestions: [`Wait ${Math.ceil(state.config.probationPeriod - daysSinceLastViolation)} days`],
        };
      }
    }
  }

  return {
    allowed: true,
    agentReputation: agent,
    reason: 'Permission granted',
    requiredScore: threshold,
    actualScore: trustScore,
  };
}

/**
 * Check if agent has high trust privileges
 */
export function checkHighTrustPermission(
  state: ReputationSystemState,
  agentId: string
): boolean {
  const agent = state.agents.get(agentId);
  if (!agent) return false;
  return agent.trustScore >= state.config.highTrustThreshold;
}

/**
 * Check if agent can perform critical operations
 */
export function checkCriticalOperationPermission(
  state: ReputationSystemState,
  agentId: string
): boolean {
  const agent = state.agents.get(agentId);
  if (!agent) return false;
  return agent.trustScore >= state.config.criticalOperationThreshold;
}

/**
 * Record successful memory write and update reputation
 */
export function recordSuccessfulWrite(
  state: ReputationSystemState,
  agentId: string
): ReputationUpdateResult {
  const agent = getOrCreateAgent(state, agentId, 'unknown');
  const previousScore = agent.trustScore;

  agent.memoryWrites++;
  agent.consecutiveSuccesses++;
  agent.lastActivity = new Date();

  // Calculate bonus with consecutive success bonus (capped)
  const consecutiveBonus = Math.min(
    agent.consecutiveSuccesses * state.config.consecutiveSuccessBonus,
    state.config.maxConsecutiveBonus
  );
  const delta = state.config.successfulWriteBonus + consecutiveBonus;

  agent.trustScore = clampScore(agent.trustScore + delta, state.config);

  // Record history entry
  const entry = createReputationEntry(
    agent,
    previousScore,
    delta,
    'Successful memory write',
    'write'
  );

  // Log activity
  logActivity(state, agentId, 'memory_write', true);

  return {
    previousScore,
    newScore: agent.trustScore,
    delta,
    entry,
  };
}

/**
 * Record memory write violation
 */
export function recordViolation(
  state: ReputationSystemState,
  agentId: string,
  reason: string
): ReputationUpdateResult {
  const agent = getOrCreateAgent(state, agentId, 'unknown');
  const previousScore = agent.trustScore;

  agent.memoryViolations++;
  agent.consecutiveSuccesses = 0;
  agent.lastActivity = new Date();

  const delta = -state.config.violationPenalty;
  agent.trustScore = clampScore(agent.trustScore + delta, state.config);

  const entry = createReputationEntry(
    agent,
    previousScore,
    delta,
    `Violation: ${reason}`,
    'violation'
  );

  logActivity(state, agentId, 'violation', false, { reason });

  return {
    previousScore,
    newScore: agent.trustScore,
    delta,
    entry,
  };
}

/**
 * Record memory poisoning detection
 */
export function recordPoisonDetection(
  state: ReputationSystemState,
  agentId: string,
  content: string
): ReputationUpdateResult {
  const agent = getOrCreateAgent(state, agentId, 'unknown');
  const previousScore = agent.trustScore;

  agent.poisonDetections++;
  agent.consecutiveSuccesses = 0;
  agent.lastActivity = new Date();

  const delta = -state.config.poisonPenalty;
  agent.trustScore = clampScore(agent.trustScore + delta, state.config);

  const entry = createReputationEntry(
    agent,
    previousScore,
    delta,
    `Memory poisoning detected: ${content.substring(0, 50)}...`,
    'poison_detection'
  );

  logActivity(state, agentId, 'poison_detection', false, { contentLength: content.length });

  return {
    previousScore,
    newScore: agent.trustScore,
    delta,
    entry,
  };
}

/**
 * Record God Mode attempt
 */
export function recordGodModeAttempt(
  state: ReputationSystemState,
  agentId: string,
  operation: string
): ReputationUpdateResult {
  const agent = getOrCreateAgent(state, agentId, 'unknown');
  const previousScore = agent.trustScore;

  agent.godModeAttempts++;
  agent.consecutiveSuccesses = 0;
  agent.lastActivity = new Date();

  const delta = -state.config.godModePenalty;
  agent.trustScore = clampScore(agent.trustScore + delta, state.config);

  const entry = createReputationEntry(
    agent,
    previousScore,
    delta,
    `God Mode attempt: ${operation}`,
    'god_mode_attempt'
  );

  logActivity(state, agentId, 'god_mode_attempt', false, { operation });

  return {
    previousScore,
    newScore: agent.trustScore,
    delta,
    entry,
  };
}

/**
 * Apply daily decay for inactive agents
 */
export function applyInactivityDecay(
  state: ReputationSystemState,
  agentId: string
): ReputationUpdateResult | null {
  const agent = state.agents.get(agentId);
  if (!agent) return null;

  const daysSinceActivity = daysBetween(agent.lastActivity, new Date());

  if (daysSinceActivity <= state.config.decayAfterDays) {
    return null;
  }

  const inactiveDays = daysSinceActivity - state.config.decayAfterDays;
  const decayAmount = inactiveDays * state.config.decayRate;

  const previousScore = agent.trustScore;
  agent.trustScore = clampScore(agent.trustScore - decayAmount, state.config);

  const entry = createReputationEntry(
    agent,
    previousScore,
    -decayAmount,
    `Inactivity decay (${inactiveDays} days)`,
    'decay'
  );

  return {
    previousScore,
    newScore: agent.trustScore,
    delta: -decayAmount,
    entry,
  };
}

/**
 * Apply recovery for good behavior
 */
export function applyRecovery(
  state: ReputationSystemState,
  agentId: string,
  daysOfGoodBehavior: number
): ReputationUpdateResult | null {
  const agent = state.agents.get(agentId);
  if (!agent) return null;

  if (agent.memoryViolations === 0) {
    return null; // No recovery needed
  }

  const recoveryAmount = Math.min(
    daysOfGoodBehavior * state.config.recoveryRate,
    agent.memoryViolations * state.config.violationPenalty
  );

  const previousScore = agent.trustScore;
  agent.trustScore = clampScore(agent.trustScore + recoveryAmount, state.config);

  const entry = createReputationEntry(
    agent,
    previousScore,
    recoveryAmount,
    `Recovery for ${daysOfGoodBehavior} days of good behavior`,
    'recovery'
  );

  return {
    previousScore,
    newScore: agent.trustScore,
    delta: recoveryAmount,
    entry,
  };
}

/**
 * Get agent reputation summary
 */
export function getReputationSummary(
  state: ReputationSystemState,
  agentId: string
): AgentReputation | null {
  return state.agents.get(agentId) || null;
}

/**
 * Get all agent reputations sorted by trust score
 */
export function getAllReputations(
  state: ReputationSystemState
): AgentReputation[] {
  return Array.from(state.agents.values()).sort(
    (a, b) => b.trustScore - a.trustScore
  );
}

/**
 * Get reputation statistics
 */
export function getReputationStats(
  state: ReputationSystemState
): {
  totalAgents: number;
  averageScore: number;
  medianScore: number;
  highTrustAgents: number;
  lowTrustAgents: number;
  agentsInProbation: number;
} {
  const agents = getAllReputations(state);
  const scores = agents.map((a) => a.trustScore);

  if (scores.length === 0) {
    return {
      totalAgents: 0,
      averageScore: 0,
      medianScore: 0,
      highTrustAgents: 0,
      lowTrustAgents: 0,
      agentsInProbation: 0,
    };
  }

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sorted = [...scores].sort((a, b) => a - b);
  const medianScore =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  const highTrustAgents = agents.filter(
    (a) => a.trustScore >= state.config.highTrustThreshold
  ).length;
  const lowTrustAgents = agents.filter(
    (a) => a.trustScore < state.config.writePermissionThreshold
  ).length;
  const agentsInProbation = agents.filter((a) => {
    if (a.memoryViolations === 0) return false;
    const daysSinceViolation = calculateDaysSinceLastViolation(a);
    return daysSinceViolation < state.config.probationPeriod;
  }).length;

  return {
    totalAgents: agents.length,
    averageScore: Math.round(averageScore * 100) / 100,
    medianScore,
    highTrustAgents,
    lowTrustAgents,
    agentsInProbation,
  };
}

/**
 * Export reputation state for serialization
 */
export function exportReputationState(
  state: ReputationSystemState
): Record<string, unknown> {
  return {
    config: state.config,
    agents: Array.from(state.agents.entries()).map(([id, agent]) => ({
      ...agent,
      lastActivity: agent.lastActivity.toISOString(),
      joinedAt: agent.joinedAt.toISOString(),
      reputationHistory: agent.reputationHistory.map((h) => ({
        ...h,
        timestamp: h.timestamp.toISOString(),
      })),
    })),
    activityLog: state.activityLog.map((log) => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    })),
    maxLogEntries: state.maxLogEntries,
  };
}

/**
 * Import reputation state from serialization
 */
export function importReputationState(
  data: Record<string, unknown>
): ReputationSystemState {
  const config = data.config as ReputationConfig;
  const agentsData = data.agents as Array<Record<string, unknown>>;
  const activityLogData = data.activityLog as Array<Record<string, unknown>>;

  const agents = new Map<string, AgentReputation>();
  agentsData.forEach((agentData) => {
    const agent = {
      ...agentData,
      lastActivity: new Date(agentData.lastActivity as string),
      joinedAt: new Date(agentData.joinedAt as string),
      reputationHistory: (agentData.reputationHistory as Array<Record<string, unknown>>).map(
        (h) => ({
          ...h,
          timestamp: new Date(h.timestamp as string),
        })
      ),
    } as AgentReputation;
    agents.set(agent.agentId, agent);
  });

  const activityLog = activityLogData.map((log) => ({
    ...log,
    timestamp: new Date(log.timestamp as string),
    details: log.details as Record<string, unknown> | undefined,
  })) as AgentActivityLog[];

  return {
    config,
    agents,
    activityLog,
    maxLogEntries: data.maxLogEntries as number,
  };
}

// Helper functions

function clampScore(score: number, config: ReputationConfig): number {
  return Math.max(config.minTrustScore, Math.min(config.maxTrustScore, score));
}

function createReputationEntry(
  agent: AgentReputation,
  previousScore: number,
  delta: number,
  reason: string,
  operationType?: string
): ReputationEntry {
  const entry: ReputationEntry = {
    timestamp: new Date(),
    previousScore,
    newScore: previousScore + delta,
    delta,
    reason,
    operationType,
  };
  agent.reputationHistory.push(entry);
  // Keep only last 100 history entries
  if (agent.reputationHistory.length > 100) {
    agent.reputationHistory = agent.reputationHistory.slice(-100);
  }
  return entry;
}

function logActivity(
  state: ReputationSystemState,
  agentId: string,
  operationType: string,
  success: boolean,
  details?: Record<string, unknown>
): void {
  const log: AgentActivityLog = {
    agentId,
    timestamp: new Date(),
    operationType,
    success,
    details,
  };
  state.activityLog.push(log);

  // Trim log if over limit
  if (state.activityLog.length > state.maxLogEntries) {
    state.activityLog = state.activityLog.slice(-state.maxLogEntries);
  }
}

function calculateDaysSinceLastViolation(agent: AgentReputation): number {
  // Find the most recent violation in history
  const lastViolation = agent.reputationHistory
    .slice()
    .reverse()
    .find((entry) => entry.operationType === 'violation');

  if (!lastViolation) {
    return Infinity;
  }

  return daysBetween(lastViolation.timestamp, new Date());
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}
