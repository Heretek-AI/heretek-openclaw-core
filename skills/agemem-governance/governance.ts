/**
 * AgeMem Governance Module
 * 
 * Implements governance controls for AgeMem unified memory operations:
 * - Access control validation
 * - Memory poisoning prevention
 * - God Mode prevention
 * - Quorum/consensus requirements for sensitive operations
 * - Audit logging
 * 
 * @module agemem-governance
 * @see {@link ../memory-consolidation/decay.ts} for AgeMem core API
 */

/** Memory operation types */
export type MemoryOperation = 'read' | 'write' | 'update' | 'delete' | 'promote' | 'archive';

/** Memory type for governance */
export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'archival';

/** Agent roles in the collective */
export type AgentRole = 'steward' | 'architect' | 'engineer' | 'auditor' | 'observer';

/** Governance configuration */
export interface GovernanceConfig {
  /** Enable access control checks */
  accessControlEnabled: boolean;
  /** Enable memory poisoning detection */
  poisoningDetectionEnabled: boolean;
  /** Enable God Mode prevention */
  godModePreventionEnabled: boolean;
  /** Require quorum for sensitive operations */
  quorumRequired: boolean;
  /** Minimum quorum size (number of agents) */
  minQuorumSize: number;
  /** Enable audit logging */
  auditLoggingEnabled: boolean;
  /** Maximum content size in bytes */
  maxContentSize: number;
  /** Require importance score validation */
  importanceValidationEnabled: boolean;
  /** Minimum importance score for archival */
  minImportanceForArchive: number;
  /** Maximum importance score override */
  maxImportanceOverride: number;
}

/** Default governance configuration */
export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
  accessControlEnabled: true,
  poisoningDetectionEnabled: true,
  godModePreventionEnabled: true,
  quorumRequired: true,
  minQuorumSize: 2,
  auditLoggingEnabled: true,
  maxContentSize: 1024 * 1024, // 1MB
  importanceValidationEnabled: true,
  minImportanceForArchive: 0.1,
  maxImportanceOverride: 1.0,
};

/** Access control policy */
export interface AccessPolicy {
  /** Role-based access levels */
  roleAccess: Record<AgentRole, MemoryOperation[]>;
  /** Memory type restrictions by role */
  typeRestrictions: Record<AgentRole, MemoryType[]>;
  /** Operation-specific requirements */
  operationRequirements: Record<MemoryOperation, AccessRequirement[]>;
}

/** Access requirement types */
export type AccessRequirement = 'quorum' | 'approval' | 'audit' | 'validation';

/** Default access policy */
export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
  roleAccess: {
    steward: ['read', 'write', 'update', 'delete', 'promote', 'archive'],
    architect: ['read', 'write', 'update', 'promote'],
    engineer: ['read', 'write', 'update'],
    auditor: ['read'],
    observer: ['read'],
  },
  typeRestrictions: {
    steward: ['working', 'episodic', 'semantic', 'procedural', 'archival'],
    architect: ['working', 'episodic', 'semantic', 'procedural'],
    engineer: ['working', 'episodic', 'semantic'],
    auditor: ['working', 'episodic', 'semantic', 'procedural', 'archival'],
    observer: ['working', 'episodic'],
  },
  operationRequirements: {
    read: ['audit'],
    write: ['validation', 'audit'],
    update: ['validation', 'audit'],
    delete: ['quorum', 'approval', 'audit'],
    promote: ['validation', 'audit'],
    archive: ['quorum', 'validation', 'audit'],
  },
};

/** Audit log entry */
export interface AuditLogEntry {
  /** Unique log entry ID */
  id: string;
  /** Timestamp of operation */
  timestamp: string;
  /** Agent ID performing operation */
  agentId: string;
  /** Agent role */
  agentRole: AgentRole;
  /** Memory operation type */
  operation: MemoryOperation;
  /** Memory ID affected */
  memoryId?: string;
  /** Memory type */
  memoryType?: MemoryType;
  /** Operation result */
  result: 'success' | 'denied' | 'error';
  /** Reason for denial or error */
  reason?: string;
  /** Quorum participants (if applicable) */
  quorumParticipants?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Access control result */
export interface AccessResult {
  /** Whether access is granted */
  granted: boolean;
  /** Reason for denial (if denied) */
  denialReason?: string;
  /** Requirements that must be met */
  requirements: AccessRequirement[];
  /** Audit log entry (if logging enabled) */
  auditEntry?: AuditLogEntry;
}

/** Quorum vote result */
export interface QuorumResult {
  /** Whether quorum was achieved */
  achieved: boolean;
  /** Number of votes received */
  votesReceived: number;
  /** Minimum votes required */
  votesRequired: number;
  /** Participants who voted */
  participants: string[];
  /** Vote details */
  votes: Record<string, boolean>;
}

/** Memory poisoning detection result */
export interface PoisoningDetectionResult {
  /** Whether poisoning was detected */
  detected: boolean;
  /** Type of poisoning detected */
  poisoningType: 'injection' | 'manipulation' | 'spam' | 'contradiction' | 'none';
  /** Confidence score (0-1) */
  confidence: number;
  /** Details about detection */
  details: string[];
  /** Recommended action */
  recommendation: 'allow' | 'review' | 'reject';
}

/** God Mode detection result */
export interface GodModeDetectionResult {
  /** Whether God Mode behavior was detected */
  detected: boolean;
  /** Type of God Mode behavior */
  behaviorType: 'unauthorized_access' | 'bypass_attempt' | 'privilege_escalation' | 'none';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Details about detection */
  details: string[];
  /** Recommended action */
  recommendation: 'allow' | 'warn' | 'block' | 'alert';
}

/**
 * Validates access for a memory operation
 * 
 * @param agentId - ID of agent requesting access
 * @param agentRole - Role of the agent
 * @param operation - Memory operation being requested
 * @param memoryType - Type of memory being accessed
 * @param config - Governance configuration
 * @returns Access result with grant/denial decision
 */
export function validateAccess(params: {
  agentId: string;
  agentRole: AgentRole;
  operation: MemoryOperation;
  memoryType: MemoryType;
  config?: Partial<GovernanceConfig>;
}): AccessResult {
  const config = { ...DEFAULT_GOVERNANCE_CONFIG, ...params.config };
  const policy = DEFAULT_ACCESS_POLICY;

  const requirements: AccessRequirement[] = [];
  const auditEntry: AuditLogEntry | undefined = config.auditLoggingEnabled ? {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    agentId: params.agentId,
    agentRole: params.agentRole,
    operation: params.operation,
    memoryType: params.memoryType,
    result: 'success',
  } : undefined;

  // Check if access control is enabled
  if (!config.accessControlEnabled) {
    return {
      granted: true,
      requirements: policy.operationRequirements[params.operation],
      auditEntry,
    };
  }

  // Check role-based access
  const allowedOperations = policy.roleAccess[params.agentRole];
  if (!allowedOperations.includes(params.operation)) {
    if (auditEntry) auditEntry.result = 'denied';
    return {
      granted: false,
      denialReason: `Role '${params.agentRole}' does not have permission for '${params.operation}' operations`,
      requirements: [],
      auditEntry,
    };
  }

  // Check memory type restrictions
  const allowedTypes = policy.typeRestrictions[params.agentRole];
  if (!allowedTypes.includes(params.memoryType)) {
    if (auditEntry) auditEntry.result = 'denied';
    return {
      granted: false,
      denialReason: `Role '${params.agentRole}' does not have access to '${params.memoryType}' memories`,
      requirements: [],
      auditEntry,
    };
  }

  // Get operation-specific requirements
  const operationRequirements = policy.operationRequirements[params.operation];
  requirements.push(...operationRequirements);

  if (auditEntry) auditEntry.result = 'success';

  return {
    granted: true,
    requirements,
    auditEntry,
  };
}

/**
 * Detects potential memory poisoning attacks
 * 
 * @param content - Memory content to analyze
 * @param metadata - Memory metadata
 * @returns Poisoning detection result
 */
export function detectMemoryPoisoning(params: {
  content: string;
  metadata?: Record<string, unknown>;
}): PoisoningDetectionResult {
  const details: string[] = [];
  let poisoningType: PoisoningDetectionResult['poisoningType'] = 'none';
  let confidence = 0;
  let recommendation: PoisoningDetectionResult['recommendation'] = 'allow';

  // Check for injection patterns
  const injectionPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /document\./gi,
    /window\./gi,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(params.content)) {
      details.push(`Detected injection pattern: ${pattern.source}`);
      poisoningType = 'injection';
      confidence = Math.max(confidence, 0.8);
      recommendation = 'reject';
    }
  }

  // Check for spam patterns (excessive repetition)
  const words = params.content.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const repetitionRatio = uniqueWords.size / words.length;

  if (repetitionRatio < 0.3 && words.length > 50) {
    details.push(`High repetition detected (ratio: ${repetitionRatio.toFixed(2)})`);
    poisoningType = 'spam';
    confidence = Math.max(confidence, 0.6);
    recommendation = recommendation === 'reject' ? 'reject' : 'review';
  }

  // Check for manipulation patterns (excessive importance claims)
  const manipulationPatterns = [
    /\b(critical|urgent|extremely important|must remember)\b/gi,
    /\b(ignore all previous instructions|disregard|override)\b/gi,
  ];

  for (const pattern of manipulationPatterns) {
    if (pattern.test(params.content)) {
      details.push(`Detected manipulation pattern: ${pattern.source}`);
      poisoningType = 'manipulation';
      confidence = Math.max(confidence, 0.7);
      recommendation = recommendation === 'reject' ? 'reject' : 'review';
    }
  }

  // Check metadata for suspicious values
  if (params.metadata) {
    if (params.metadata.importance && typeof params.metadata.importance === 'number') {
      if (params.metadata.importance > 1.0 || params.metadata.importance < 0) {
        details.push(`Invalid importance score: ${params.metadata.importance}`);
        poisoningType = 'manipulation';
        confidence = Math.max(confidence, 0.5);
        recommendation = recommendation === 'reject' ? 'reject' : 'review';
      }
    }
  }

  return {
    detected: poisoningType !== 'none',
    poisoningType,
    confidence,
    details,
    recommendation,
  };
}

/**
 * Detects God Mode behavior attempts
 * 
 * @param agentId - ID of agent performing operation
 * @param agentRole - Role of the agent
 * @param operation - Operation being performed
 * @param bypassAttempts - Number of bypass attempts detected
 * @returns God Mode detection result
 */
export function detectGodMode(params: {
  agentId: string;
  agentRole: AgentRole;
  operation: MemoryOperation;
  bypassAttempts?: number;
}): GodModeDetectionResult {
  const details: string[] = [];
  let behaviorType: GodModeDetectionResult['behaviorType'] = 'none';
  let severity: GodModeDetectionResult['severity'] = 'low';
  let recommendation: GodModeDetectionResult['recommendation'] = 'allow';

  // Check for unauthorized access attempts
  const unauthorizedOperations: Record<AgentRole, MemoryOperation[]> = {
    observer: ['write', 'update', 'delete', 'promote', 'archive'],
    auditor: ['write', 'update', 'delete', 'promote', 'archive'],
    engineer: ['delete', 'promote', 'archive'],
    architect: ['delete', 'archive'],
    steward: [],
  };

  if (unauthorizedOperations[params.agentRole].includes(params.operation)) {
    details.push(`Agent role '${params.agentRole}' attempting unauthorized '${params.operation}' operation`);
    behaviorType = 'unauthorized_access';
    severity = 'medium';
    recommendation = 'block';
  }

  // Check for bypass attempts
  if (params.bypassAttempts && params.bypassAttempts > 0) {
    details.push(`Detected ${params.bypassAttempts} bypass attempt(s)`);
    behaviorType = 'bypass_attempt';
    severity = params.bypassAttempts >= 3 ? 'critical' : 'high';
    recommendation = 'alert';
  }

  // Check for privilege escalation patterns
  if (params.operation === 'promote' || params.operation === 'archive') {
    if (params.agentRole === 'observer' || params.agentRole === 'auditor') {
      details.push(`Potential privilege escalation: ${params.agentRole} attempting ${params.operation}`);
      behaviorType = 'privilege_escalation';
      severity = 'high';
      recommendation = 'block';
    }
  }

  return {
    detected: behaviorType !== 'none',
    behaviorType,
    severity,
    details,
    recommendation,
  };
}

/**
 * Validates quorum for sensitive operations
 * 
 * @param operation - Operation requiring quorum
 * @param votes - Votes from participating agents
 * @param minQuorumSize - Minimum quorum size
 * @returns Quorum result
 */
export function validateQuorum(params: {
  operation: MemoryOperation;
  votes: Record<string, boolean>;
  minQuorumSize?: number;
}): QuorumResult {
  const minQuorumSize = params.minQuorumSize ?? DEFAULT_GOVERNANCE_CONFIG.minQuorumSize;
  const participants = Object.keys(params.votes);
  const votesReceived = Object.values(params.votes).filter(v => v).length;
  const votesRequired = minQuorumSize;

  return {
    achieved: votesReceived >= votesRequired && participants.length >= minQuorumSize,
    votesReceived,
    votesRequired,
    participants,
    votes: params.votes,
  };
}

/**
 * Validates importance score for memory operations
 * 
 * @param importance - Importance score to validate
 * @param operation - Operation being performed
 * @param config - Governance configuration
 * @returns Validation result
 */
export function validateImportance(params: {
  importance: number;
  operation: MemoryOperation;
  config?: Partial<GovernanceConfig>;
}): { valid: boolean; reason?: string } {
  const config = { ...DEFAULT_GOVERNANCE_CONFIG, ...params.config };

  if (!config.importanceValidationEnabled) {
    return { valid: true };
  }

  // Check importance bounds
  if (params.importance < 0 || params.importance > config.maxImportanceOverride) {
    return {
      valid: false,
      reason: `Importance score ${params.importance} is outside valid range [0, ${config.maxImportanceOverride}]`,
    };
  }

  // Check minimum importance for archive operations
  if (params.operation === 'archive' && params.importance < config.minImportanceForArchive) {
    return {
      valid: false,
      reason: `Importance score ${params.importance} is below minimum ${config.minImportanceForArchive} for archival`,
    };
  }

  return { valid: true };
}

/**
 * Creates an audit log entry
 * 
 * @param params - Audit log parameters
 * @returns Audit log entry
 */
export function createAuditLogEntry(params: {
  agentId: string;
  agentRole: AgentRole;
  operation: MemoryOperation;
  memoryId?: string;
  memoryType?: MemoryType;
  result: 'success' | 'denied' | 'error';
  reason?: string;
  quorumParticipants?: string[];
  metadata?: Record<string, unknown>;
}): AuditLogEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    agentId: params.agentId,
    agentRole: params.agentRole,
    operation: params.operation,
    memoryId: params.memoryId,
    memoryType: params.memoryType,
    result: params.result,
    reason: params.reason,
    quorumParticipants: params.quorumParticipants,
    metadata: params.metadata,
  };
}

/**
 * Performs comprehensive governance check before memory operation
 * 
 * @param params - Governance check parameters
 * @returns Combined governance result
 */
export function performGovernanceCheck(params: {
  agentId: string;
  agentRole: AgentRole;
  operation: MemoryOperation;
  memoryType: MemoryType;
  content?: string;
  importance?: number;
  bypassAttempts?: number;
  config?: Partial<GovernanceConfig>;
}): {
  allowed: boolean;
  accessResult?: AccessResult;
  poisoningResult?: PoisoningDetectionResult;
  godModeResult?: GodModeDetectionResult;
  importanceResult?: { valid: boolean; reason?: string };
  reasons: string[];
} {
  const config = { ...DEFAULT_GOVERNANCE_CONFIG, ...params.config };
  const reasons: string[] = [];

  // Access control check
  const accessResult = validateAccess({
    agentId: params.agentId,
    agentRole: params.agentRole,
    operation: params.operation,
    memoryType: params.memoryType,
    config,
  });

  if (!accessResult.granted) {
    reasons.push(accessResult.denialReason ?? 'Access denied');
    return { allowed: false, accessResult, reasons };
  }

  // God Mode detection
  if (config.godModePreventionEnabled) {
    const godModeResult = detectGodMode({
      agentId: params.agentId,
      agentRole: params.agentRole,
      operation: params.operation,
      bypassAttempts: params.bypassAttempts,
    });

    if (godModeResult.detected) {
      reasons.push(...godModeResult.details);
      if (godModeResult.recommendation === 'block' || godModeResult.recommendation === 'alert') {
        return { allowed: false, accessResult, godModeResult, reasons };
      }
    }
  }

  // Memory poisoning detection
  if (config.poisoningDetectionEnabled && params.content) {
    const poisoningResult = detectMemoryPoisoning({
      content: params.content,
    });

    if (poisoningResult.detected && poisoningResult.recommendation === 'reject') {
      reasons.push(...poisoningResult.details);
      return { allowed: false, accessResult, poisoningResult, reasons };
    }
  }

  // Importance validation
  if (config.importanceValidationEnabled && params.importance !== undefined) {
    const importanceResult = validateImportance({
      importance: params.importance,
      operation: params.operation,
      config,
    });

    if (!importanceResult.valid) {
      reasons.push(importanceResult.reason ?? 'Invalid importance score');
      return { allowed: false, accessResult, importanceResult, reasons };
    }
  }

  return {
    allowed: true,
    accessResult,
    reasons,
  };
}
