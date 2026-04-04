/**
 * Container Isolation for Lobe Agents
 * 
 * Implements process isolation, resource limits, and security boundaries
 * for individual Lobe Agents to prevent cross-agent contamination and
 * resource monopolization.
 * 
 * @module container-isolation
 */

export interface ContainerConfig {
  enabled: boolean;
  agentId: string;
  
  // Resource limits
  cpuLimit: number;           // CPU cores (0.5 = 50% of one core)
  memoryLimit: number;        // Memory in MB
  diskLimit: number;          // Disk space in MB
  networkLimit: number;       // Network bandwidth in Mbps
  
  // Process isolation
  namespace: string;          // Process namespace
  cgroupPath: string;         // Control group path
  rootfsPath: string;         // Root filesystem path
  
  // Security
  seccompProfile: string;     // Seccomp security profile
  apparmorProfile: string;    // AppArmor profile
  capabilities: string[];     // Linux capabilities to retain
  readOnlyRootfs: boolean;    // Mount rootfs as read-only
  
  // Execution
  maxExecutionTime: number;   // Max execution time in seconds
  maxConcurrentTasks: number; // Max concurrent tasks
  allowedCommands: string[];  // Whitelist of allowed commands
}

export interface ContainerMetrics {
  agentId: string;
  cpuUsage: number;           // Current CPU usage percentage
  memoryUsage: number;        // Current memory usage in MB
  diskUsage: number;          // Current disk usage in MB
  networkIn: number;          // Network inbound in bytes
  networkOut: number;         // Network outbound in bytes
  processCount: number;       // Number of active processes
  startTime: Date;
  lastActivity: Date;
}

export interface ContainerStatus {
  agentId: string;
  running: boolean;
  healthy: boolean;
  resourceViolations: number;
  securityViolations: number;
  lastHealthCheck: Date;
  status: 'running' | 'stopped' | 'failed' | 'restricted';
  message?: string;
}

export interface ResourceCheckResult {
  allowed: boolean;
  reason: string;
  currentUsage: number;
  limit: number;
  usagePercentage: number;
  suggestions?: string[];
}

export interface SecurityProfile {
  name: string;
  description: string;
  seccompRules: string[];
  apparmorRules: string[];
  blockedSyscalls: string[];
  blockedPaths: string[];
  allowedCapabilities: string[];
}

export interface ContainerIsolationState {
  config: ContainerConfig;
  metrics: Map<string, ContainerMetrics>;
  status: Map<string, ContainerStatus>;
  securityProfiles: Map<string, SecurityProfile>;
  violationLog: ViolationEntry[];
  maxViolationLog: number;
}

export interface ViolationEntry {
  timestamp: Date;
  agentId: string;
  violationType: 'resource' | 'security' | 'execution';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Create default container configuration
 */
export function createContainerConfig(overrides?: Partial<ContainerConfig>): ContainerConfig {
  const defaultConfig: ContainerConfig = {
    enabled: true,
    agentId: 'unknown',
    cpuLimit: 1.0,
    memoryLimit: 512,
    diskLimit: 1024,
    networkLimit: 100,
    namespace: 'lobe-agent',
    cgroupPath: '/sys/fs/cgroup/lobe-agents',
    rootfsPath: '/var/lib/lobe-agents/rootfs',
    seccompProfile: 'default',
    apparmorProfile: 'lobe-agent-restricted',
    capabilities: ['CAP_NET_BIND_SERVICE'],
    readOnlyRootfs: true,
    maxExecutionTime: 300, // 5 minutes
    maxConcurrentTasks: 3,
    allowedCommands: ['node', 'npm', 'git', 'cat', 'ls', 'echo'],
  };

  return { ...defaultConfig, ...overrides };
}

/**
 * Initialize container isolation state
 */
export function createContainerState(config?: Partial<ContainerConfig>): ContainerIsolationState {
  const baseConfig = createContainerConfig(config);
  
  return {
    config: baseConfig,
    metrics: new Map(),
    status: new Map(),
    securityProfiles: new Map(),
    violationLog: [],
    maxViolationLog: 1000,
  };
}

/**
 * Register default security profiles
 */
export function registerDefaultSecurityProfiles(state: ContainerIsolationState): void {
  // Default restricted profile
  state.securityProfiles.set('default', {
    name: 'default',
    description: 'Default restricted profile for Lobe Agents',
    seccompRules: [
      'allow: read, write, open, close, stat, fstat',
      'allow: mmap, munmap, mprotect',
      'allow: exit, exit_group',
      'allow: getuid, getgid, geteuid, getegid',
      'deny: ptrace, process_vm_readv, process_vm_writev',
      'deny: mount, umount, umount2',
      'deny: reboot, sethostname, setdomainname',
      'deny: init_module, delete_module',
      'deny: kexec_load',
    ],
    apparmorRules: [
      'include <abstractions/base>',
      'network inet tcp,',
      'network inet udp,',
      'deny network raw,',
      'deny network packet,',
      'deny @{PROC}/* w,',
      'deny /sys/* w,',
      'deny /dev/mem rw,',
    ],
    blockedSyscalls: [
      'ptrace',
      'process_vm_readv',
      'process_vm_writev',
      'mount',
      'umount',
      'umount2',
      'reboot',
      'sethostname',
      'setdomainname',
      'init_module',
      'delete_module',
      'kexec_load',
      'acct',
      'settimeofday',
      'adjtimex',
    ],
    blockedPaths: [
      '/etc/passwd',
      '/etc/shadow',
      '/etc/sudoers',
      '/root',
      '/home',
      '/proc/*/mem',
      '/proc/*/fd',
      '/sys/kernel',
      '/dev/mem',
      '/dev/kmem',
    ],
    allowedCapabilities: ['CAP_NET_BIND_SERVICE'],
  });

  // Strict profile for high-security operations
  state.securityProfiles.set('strict', {
    name: 'strict',
    description: 'Strict profile with minimal permissions',
    seccompRules: [
      'allow: read, write, open, close',
      'allow: exit',
      'allow: getuid, getgid',
      'deny: all others',
    ],
    apparmorRules: [
      'include <abstractions/base>',
      'deny network,',
      'deny @{PROC}/**,',
      'deny /sys/**,',
      'deny /dev/**,',
    ],
    blockedSyscalls: [
      'all',
    ],
    blockedPaths: [
      '/**',
    ],
    allowedCapabilities: [],
  });
}

/**
 * Check if agent can allocate additional CPU resources
 */
export function checkCpuAllocation(
  state: ContainerIsolationState,
  agentId: string,
  requestedCpu: number
): ResourceCheckResult {
  const metrics = state.metrics.get(agentId);
  const currentUsage = metrics?.cpuUsage ?? 0;
  const limit = state.config.cpuLimit;
  const usagePercentage = (currentUsage / limit) * 100;

  if (currentUsage + requestedCpu > limit) {
    return {
      allowed: false,
      reason: `CPU allocation would exceed limit`,
      currentUsage: currentUsage,
      limit: limit,
      usagePercentage: usagePercentage,
      suggestions: [
        'Wait for current tasks to complete',
        'Reduce concurrent task count',
        'Optimize CPU-intensive operations',
      ],
    };
  }

  return {
    allowed: true,
    reason: 'CPU allocation within limits',
    currentUsage: currentUsage,
    limit: limit,
    usagePercentage: usagePercentage,
  };
}

/**
 * Check if agent can allocate additional memory
 */
export function checkMemoryAllocation(
  state: ContainerIsolationState,
  agentId: string,
  requestedMemory: number
): ResourceCheckResult {
  const metrics = state.metrics.get(agentId);
  const currentUsage = metrics?.memoryUsage ?? 0;
  const limit = state.config.memoryLimit;
  const usagePercentage = (currentUsage / limit) * 100;

  if (currentUsage + requestedMemory > limit) {
    return {
      allowed: false,
      reason: `Memory allocation would exceed limit (${limit}MB)`,
      currentUsage: currentUsage,
      limit: limit,
      usagePercentage: usagePercentage,
      suggestions: [
        'Release unused memory',
        'Process data in smaller batches',
        'Close unused file handles',
      ],
    };
  }

  return {
    allowed: true,
    reason: 'Memory allocation within limits',
    currentUsage: currentUsage,
    limit: limit,
    usagePercentage: usagePercentage,
  };
}

/**
 * Check if agent can use additional disk space
 */
export function checkDiskAllocation(
  state: ContainerIsolationState,
  agentId: string,
  requestedDisk: number
): ResourceCheckResult {
  const metrics = state.metrics.get(agentId);
  const currentUsage = metrics?.diskUsage ?? 0;
  const limit = state.config.diskLimit;
  const usagePercentage = (currentUsage / limit) * 100;

  if (currentUsage + requestedDisk > limit) {
    return {
      allowed: false,
      reason: `Disk allocation would exceed limit (${limit}MB)`,
      currentUsage: currentUsage,
      limit: limit,
      usagePercentage: usagePercentage,
      suggestions: [
        'Clean up temporary files',
        'Archive old data',
        'Reduce logging verbosity',
      ],
    };
  }

  return {
    allowed: true,
    reason: 'Disk allocation within limits',
    currentUsage: currentUsage,
    limit: limit,
    usagePercentage: usagePercentage,
  };
}

/**
 * Check if command is allowed for agent
 */
export function checkCommandAllowed(
  state: ContainerIsolationState,
  command: string
): boolean {
  const allowedCommands = state.config.allowedCommands;
  return allowedCommands.includes(command);
}

/**
 * Check if path access is blocked by security profile
 */
export function checkPathBlocked(
  state: ContainerIsolationState,
  profileName: string,
  path: string
): boolean {
  const profile = state.securityProfiles.get(profileName);
  if (!profile) return false;

  return profile.blockedPaths.some((blockedPath) => {
    if (blockedPath === '/**') return true;
    if (blockedPath.endsWith('/**')) {
      const prefix = blockedPath.slice(0, -3);
      return path.startsWith(prefix);
    }
    return path === blockedPath || path.startsWith(blockedPath + '/');
  });
}

/**
 * Check if syscall is blocked by security profile
 */
export function checkSyscallBlocked(
  state: ContainerIsolationState,
  profileName: string,
  syscall: string
): boolean {
  const profile = state.securityProfiles.get(profileName);
  if (!profile) return false;

  return profile.blockedSyscalls.includes(syscall) || 
         profile.blockedSyscalls.includes('all');
}

/**
 * Record a resource or security violation
 */
export function recordViolation(
  state: ContainerIsolationState,
  agentId: string,
  violationType: 'resource' | 'security' | 'execution',
  severity: 'low' | 'medium' | 'high' | 'critical',
  description: string,
  details?: Record<string, unknown>
): ViolationEntry {
  const entry: ViolationEntry = {
    timestamp: new Date(),
    agentId,
    violationType,
    severity,
    description,
    details,
  };

  state.violationLog.push(entry);

  // Trim log if over limit
  if (state.violationLog.length > state.maxViolationLog) {
    state.violationLog = state.violationLog.slice(-state.maxViolationLog);
  }

  // Update agent status
  const status = state.status.get(agentId);
  if (status) {
    if (violationType === 'security') {
      status.securityViolations++;
    } else if (violationType === 'resource') {
      status.resourceViolations++;
    }

    // Escalate status based on violations
    if (status.securityViolations >= 3 || status.resourceViolations >= 5) {
      status.status = 'restricted';
      status.message = 'Agent restricted due to repeated violations';
    }
  }

  return entry;
}

/**
 * Update container metrics for an agent
 */
export function updateContainerMetrics(
  state: ContainerIsolationState,
  agentId: string,
  metrics: Partial<ContainerMetrics>
): ContainerMetrics {
  const existing = state.metrics.get(agentId);
  const now = new Date();

  const updated: ContainerMetrics = {
    agentId,
    cpuUsage: metrics.cpuUsage ?? existing?.cpuUsage ?? 0,
    memoryUsage: metrics.memoryUsage ?? existing?.memoryUsage ?? 0,
    diskUsage: metrics.diskUsage ?? existing?.diskUsage ?? 0,
    networkIn: metrics.networkIn ?? existing?.networkIn ?? 0,
    networkOut: metrics.networkOut ?? existing?.networkOut ?? 0,
    processCount: metrics.processCount ?? existing?.processCount ?? 0,
    startTime: existing?.startTime ?? now,
    lastActivity: now,
  };

  state.metrics.set(agentId, updated);
  return updated;
}

/**
 * Get container status for an agent
 */
export function getContainerStatus(
  state: ContainerIsolationState,
  agentId: string
): ContainerStatus | null {
  return state.status.get(agentId) || null;
}

/**
 * Update container status for an agent
 */
export function updateContainerStatus(
  state: ContainerIsolationState,
  agentId: string,
  status: Partial<ContainerStatus>
): ContainerStatus {
  const existing = state.status.get(agentId);
  const now = new Date();

  const updated: ContainerStatus = {
    agentId,
    running: status.running ?? existing?.running ?? false,
    healthy: status.healthy ?? existing?.healthy ?? true,
    resourceViolations: status.resourceViolations ?? existing?.resourceViolations ?? 0,
    securityViolations: status.securityViolations ?? existing?.securityViolations ?? 0,
    lastHealthCheck: now,
    status: status.status ?? existing?.status ?? 'stopped',
    message: status.message ?? existing?.message,
  };

  state.status.set(agentId, updated);
  return updated;
}

/**
 * Get violation history for an agent
 */
export function getAgentViolations(
  state: ContainerIsolationState,
  agentId: string
): ViolationEntry[] {
  return state.violationLog.filter((v) => v.agentId === agentId);
}

/**
 * Get violation statistics
 */
export function getViolationStats(
  state: ContainerIsolationState
): {
  totalViolations: number;
  resourceViolations: number;
  securityViolations: number;
  executionViolations: number;
  criticalViolations: number;
  violationsByAgent: Record<string, number>;
} {
  const stats = {
    totalViolations: state.violationLog.length,
    resourceViolations: 0,
    securityViolations: 0,
    executionViolations: 0,
    criticalViolations: 0,
    violationsByAgent: {} as Record<string, number>,
  };

  state.violationLog.forEach((v) => {
    if (v.violationType === 'resource') stats.resourceViolations++;
    if (v.violationType === 'security') stats.securityViolations++;
    if (v.violationType === 'execution') stats.executionViolations++;
    if (v.severity === 'critical') stats.criticalViolations++;

    stats.violationsByAgent[v.agentId] = (stats.violationsByAgent[v.agentId] || 0) + 1;
  });

  return stats;
}

/**
 * Generate container isolation report
 */
export function generateContainerReport(state: ContainerIsolationState): {
  summary: {
    totalAgents: number;
    runningAgents: number;
    healthyAgents: number;
    restrictedAgents: number;
  };
  resourceUsage: {
    totalCpuUsage: number;
    totalMemoryUsage: number;
    totalDiskUsage: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
  };
  violations: ReturnType<typeof getViolationStats>;
  recommendations: string[];
} {
  const agents = Array.from(state.status.values());
  const metrics = Array.from(state.metrics.values());

  const summary = {
    totalAgents: agents.length,
    runningAgents: agents.filter((a) => a.running).length,
    healthyAgents: agents.filter((a) => a.healthy).length,
    restrictedAgents: agents.filter((a) => a.status === 'restricted').length,
  };

  const resourceUsage = {
    totalCpuUsage: metrics.reduce((sum, m) => sum + m.cpuUsage, 0),
    totalMemoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0),
    totalDiskUsage: metrics.reduce((sum, m) => sum + m.diskUsage, 0),
    avgCpuUsage: metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length 
      : 0,
    avgMemoryUsage: metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length 
      : 0,
  };

  const violations = getViolationStats(state);

  const recommendations: string[] = [];

  if (summary.restrictedAgents > 0) {
    recommendations.push(`Review ${summary.restrictedAgents} restricted agents`);
  }

  if (violations.criticalViolations > 0) {
    recommendations.push(`Investigate ${violations.criticalViolations} critical security violations`);
  }

  if (resourceUsage.avgCpuUsage > state.config.cpuLimit * 0.8) {
    recommendations.push('Consider increasing CPU limits or optimizing agent workloads');
  }

  if (resourceUsage.avgMemoryUsage > state.config.memoryLimit * 0.8) {
    recommendations.push('Consider increasing memory limits or optimizing agent memory usage');
  }

  if (violations.securityViolations > violations.resourceViolations) {
    recommendations.push('Security violations exceed resource violations - review security profiles');
  }

  return {
    summary,
    resourceUsage,
    violations,
    recommendations,
  };
}

/**
 * Export container state for serialization
 */
export function exportContainerState(state: ContainerIsolationState): Record<string, unknown> {
  return {
    config: state.config,
    metrics: Array.from(state.metrics.entries()),
    status: Array.from(state.status.entries()).map(([id, s]) => ({
      agentId: id,
      running: s.running,
      healthy: s.healthy,
      resourceViolations: s.resourceViolations,
      securityViolations: s.securityViolations,
      lastHealthCheck: s.lastHealthCheck.toISOString(),
      status: s.status,
      message: s.message,
    })),
    securityProfiles: Array.from(state.securityProfiles.entries()),
    violationLog: state.violationLog.map((v) => ({
      ...v,
      timestamp: v.timestamp.toISOString(),
    })),
    maxViolationLog: state.maxViolationLog,
  };
}

/**
 * Import container state from serialization
 */
export function importContainerState(data: Record<string, unknown>): ContainerIsolationState {
  const config = data.config as ContainerConfig;
  const metricsData = data.metrics as Array<[string, ContainerMetrics]>;
  const statusData = data.status as Array<Record<string, unknown>>;
  const profilesData = data.securityProfiles as Array<[string, SecurityProfile]>;
  const violationData = data.violationLog as Array<Record<string, unknown>>;

  const metrics = new Map(metricsData);
  
  const status = new Map<string, ContainerStatus>();
  statusData.forEach((entry) => {
    const s = entry as Record<string, unknown>;
    const agentId = s.agentId as string;
    status.set(agentId, {
      agentId,
      running: s.running as boolean,
      healthy: s.healthy as boolean,
      resourceViolations: s.resourceViolations as number,
      securityViolations: s.securityViolations as number,
      lastHealthCheck: new Date(s.lastHealthCheck as string),
      status: s.status as ContainerStatus['status'],
      message: s.message as string | undefined,
    });
  });

  const securityProfiles = new Map(profilesData);

  const violationLog = violationData.map((v) => ({
    ...v,
    timestamp: new Date(v.timestamp as string),
  })) as ViolationEntry[];

  return {
    config,
    metrics,
    status,
    securityProfiles,
    violationLog,
    maxViolationLog: data.maxViolationLog as number,
  };
}
