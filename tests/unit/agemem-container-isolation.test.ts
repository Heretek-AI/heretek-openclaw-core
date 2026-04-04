/**
 * Unit tests for Container Isolation System
 * Tests for process isolation, resource limits, and security boundaries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createContainerConfig,
  createContainerState,
  registerDefaultSecurityProfiles,
  checkCpuAllocation,
  checkMemoryAllocation,
  checkDiskAllocation,
  checkCommandAllowed,
  checkPathBlocked,
  checkSyscallBlocked,
  recordViolation,
  updateContainerMetrics,
  getContainerStatus,
  updateContainerStatus,
  getAgentViolations,
  getViolationStats,
  generateContainerReport,
  exportContainerState,
  importContainerState,
  type ContainerIsolationState,
} from '../../skills/agemem-governance/container-isolation';

describe('Container Isolation System', () => {
  describe('createContainerConfig', () => {
    it('should create default configuration', () => {
      const config = createContainerConfig();
      expect(config.enabled).toBe(true);
      expect(config.cpuLimit).toBe(1.0);
      expect(config.memoryLimit).toBe(512);
      expect(config.diskLimit).toBe(1024);
      expect(config.networkLimit).toBe(100);
      expect(config.maxExecutionTime).toBe(300);
      expect(config.maxConcurrentTasks).toBe(3);
      expect(config.readOnlyRootfs).toBe(true);
    });

    it('should allow overriding defaults', () => {
      const config = createContainerConfig({
        cpuLimit: 2.0,
        memoryLimit: 1024,
        maxExecutionTime: 600,
      });
      expect(config.cpuLimit).toBe(2.0);
      expect(config.memoryLimit).toBe(1024);
      expect(config.maxExecutionTime).toBe(600);
      expect(config.diskLimit).toBe(1024); // Default preserved
    });
  });

  describe('createContainerState', () => {
    it('should create empty state with default config', () => {
      const state = createContainerState();
      expect(state.config.enabled).toBe(true);
      expect(state.metrics.size).toBe(0);
      expect(state.status.size).toBe(0);
      expect(state.violationLog.length).toBe(0);
    });

    it('should create state with custom config', () => {
      const state = createContainerState({
        cpuLimit: 0.5,
        memoryLimit: 256,
      });
      expect(state.config.cpuLimit).toBe(0.5);
      expect(state.config.memoryLimit).toBe(256);
    });
  });

  describe('registerDefaultSecurityProfiles', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should register default security profile', () => {
      registerDefaultSecurityProfiles(state);
      expect(state.securityProfiles.has('default')).toBe(true);
    });

    it('should register strict security profile', () => {
      registerDefaultSecurityProfiles(state);
      expect(state.securityProfiles.has('strict')).toBe(true);
    });

    it('should populate default profile with rules', () => {
      registerDefaultSecurityProfiles(state);
      const profile = state.securityProfiles.get('default');
      expect(profile).toBeDefined();
      expect(profile?.seccompRules.length).toBeGreaterThan(0);
      expect(profile?.apparmorRules.length).toBeGreaterThan(0);
      expect(profile?.blockedSyscalls.length).toBeGreaterThan(0);
      expect(profile?.blockedPaths.length).toBeGreaterThan(0);
    });
  });

  describe('checkCpuAllocation', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should allow allocation when under limit', () => {
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.3 });
      const result = checkCpuAllocation(state, 'agent-1', 0.2);
      expect(result.allowed).toBe(true);
      expect(result.usagePercentage).toBe(30);
    });

    it('should deny allocation when over limit', () => {
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.9 });
      const result = checkCpuAllocation(state, 'agent-1', 0.2);
      expect(result.allowed).toBe(false);
      expect(result.usagePercentage).toBe(90);
    });

    it('should handle unknown agent', () => {
      const result = checkCpuAllocation(state, 'unknown-agent', 0.5);
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(0);
    });

    it('should provide suggestions when denied', () => {
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.95 });
      const result = checkCpuAllocation(state, 'agent-1', 0.1);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('checkMemoryAllocation', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should allow allocation when under limit', () => {
      updateContainerMetrics(state, 'agent-1', { memoryUsage: 200 });
      const result = checkMemoryAllocation(state, 'agent-1', 100);
      expect(result.allowed).toBe(true);
    });

    it('should deny allocation when over limit', () => {
      updateContainerMetrics(state, 'agent-1', { memoryUsage: 450 });
      const result = checkMemoryAllocation(state, 'agent-1', 100);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceed limit');
    });

    it('should handle unknown agent', () => {
      const result = checkMemoryAllocation(state, 'unknown-agent', 100);
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(0);
    });
  });

  describe('checkDiskAllocation', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should allow allocation when under limit', () => {
      updateContainerMetrics(state, 'agent-1', { diskUsage: 500 });
      const result = checkDiskAllocation(state, 'agent-1', 200);
      expect(result.allowed).toBe(true);
    });

    it('should deny allocation when over limit', () => {
      updateContainerMetrics(state, 'agent-1', { diskUsage: 900 });
      const result = checkDiskAllocation(state, 'agent-1', 200);
      expect(result.allowed).toBe(false);
    });
  });

  describe('checkCommandAllowed', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should allow whitelisted command', () => {
      expect(checkCommandAllowed(state, 'node')).toBe(true);
      expect(checkCommandAllowed(state, 'npm')).toBe(true);
    });

    it('should deny non-whitelisted command', () => {
      expect(checkCommandAllowed(state, 'rm')).toBe(false);
      expect(checkCommandAllowed(state, 'sudo')).toBe(false);
    });
  });

  describe('checkPathBlocked', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
      registerDefaultSecurityProfiles(state);
    });

    it('should block sensitive paths', () => {
      expect(checkPathBlocked(state, 'default', '/etc/shadow')).toBe(true);
      expect(checkPathBlocked(state, 'default', '/root')).toBe(true);
      expect(checkPathBlocked(state, 'default', '/dev/mem')).toBe(true);
    });

    it('should allow non-blocked paths', () => {
      expect(checkPathBlocked(state, 'default', '/var/lib/lobe-agents/data')).toBe(false);
    });

    it('should block all paths with strict profile', () => {
      expect(checkPathBlocked(state, 'strict', '/any/path')).toBe(true);
    });
  });

  describe('checkSyscallBlocked', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
      registerDefaultSecurityProfiles(state);
    });

    it('should block dangerous syscalls', () => {
      expect(checkSyscallBlocked(state, 'default', 'ptrace')).toBe(true);
      expect(checkSyscallBlocked(state, 'default', 'mount')).toBe(true);
      expect(checkSyscallBlocked(state, 'default', 'reboot')).toBe(true);
    });

    it('should allow safe syscalls', () => {
      expect(checkSyscallBlocked(state, 'default', 'read')).toBe(false);
      expect(checkSyscallBlocked(state, 'default', 'write')).toBe(false);
    });

    it('should block all syscalls with strict profile', () => {
      expect(checkSyscallBlocked(state, 'strict', 'any_syscall')).toBe(true);
    });
  });

  describe('recordViolation', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
      updateContainerStatus(state, 'agent-1', { status: 'running' });
    });

    it('should record resource violation', () => {
      const entry = recordViolation(state, 'agent-1', 'resource', 'medium', 'CPU limit exceeded');
      expect(entry.agentId).toBe('agent-1');
      expect(entry.violationType).toBe('resource');
      expect(entry.severity).toBe('medium');
    });

    it('should record security violation', () => {
      const entry = recordViolation(state, 'agent-1', 'security', 'high', 'Blocked syscall attempt');
      expect(entry.violationType).toBe('security');
      expect(entry.severity).toBe('high');
    });

    it('should update agent status on repeated violations', () => {
      // Record 3 security violations
      recordViolation(state, 'agent-1', 'security', 'high', 'Violation 1');
      recordViolation(state, 'agent-1', 'security', 'high', 'Violation 2');
      recordViolation(state, 'agent-1', 'security', 'high', 'Violation 3');

      const status = getContainerStatus(state, 'agent-1');
      expect(status?.status).toBe('restricted');
    });

    it('should trim violation log when over limit', () => {
      state.maxViolationLog = 10;
      for (let i = 0; i < 15; i++) {
        recordViolation(state, 'agent-1', 'resource', 'low', `Violation ${i}`);
      }
      expect(state.violationLog.length).toBe(10);
    });
  });

  describe('updateContainerMetrics', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should create new metrics for agent', () => {
      const metrics = updateContainerMetrics(state, 'agent-1', {
        cpuUsage: 0.5,
        memoryUsage: 256,
      });
      expect(metrics.agentId).toBe('agent-1');
      expect(metrics.cpuUsage).toBe(0.5);
      expect(metrics.memoryUsage).toBe(256);
    });

    it('should update existing metrics', () => {
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.3 });
      const updated = updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.6 });
      expect(updated.cpuUsage).toBe(0.6);
    });

    it('should set lastActivity timestamp', () => {
      const before = new Date();
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.5 });
      const metrics = state.metrics.get('agent-1');
      expect(metrics?.lastActivity.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getContainerStatus', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should return null for unknown agent', () => {
      const status = getContainerStatus(state, 'unknown');
      expect(status).toBe(null);
    });

    it('should return status for known agent', () => {
      updateContainerStatus(state, 'agent-1', { status: 'running' });
      const status = getContainerStatus(state, 'agent-1');
      expect(status).toBeDefined();
      expect(status?.agentId).toBe('agent-1');
    });
  });

  describe('updateContainerStatus', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should create new status for agent', () => {
      const status = updateContainerStatus(state, 'agent-1', {
        running: true,
        healthy: true,
        status: 'running',
      });
      expect(status.agentId).toBe('agent-1');
      expect(status.running).toBe(true);
      expect(status.status).toBe('running');
    });

    it('should update existing status', () => {
      updateContainerStatus(state, 'agent-1', { status: 'running', healthy: true });
      updateContainerStatus(state, 'agent-1', { status: 'restricted', healthy: false });
      const status = getContainerStatus(state, 'agent-1');
      expect(status?.status).toBe('restricted');
      expect(status?.healthy).toBe(false);
    });
  });

  describe('getAgentViolations', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should return empty array for agent with no violations', () => {
      const violations = getAgentViolations(state, 'agent-1');
      expect(violations.length).toBe(0);
    });

    it('should return violations for agent', () => {
      recordViolation(state, 'agent-1', 'resource', 'low', 'Test 1');
      recordViolation(state, 'agent-1', 'security', 'high', 'Test 2');
      recordViolation(state, 'agent-2', 'resource', 'low', 'Test 3');

      const violations1 = getAgentViolations(state, 'agent-1');
      const violations2 = getAgentViolations(state, 'agent-2');

      expect(violations1.length).toBe(2);
      expect(violations2.length).toBe(1);
    });
  });

  describe('getViolationStats', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should return zero stats for no violations', () => {
      const stats = getViolationStats(state);
      expect(stats.totalViolations).toBe(0);
    });

    it('should calculate correct statistics', () => {
      recordViolation(state, 'agent-1', 'resource', 'low', 'Test');
      recordViolation(state, 'agent-1', 'security', 'high', 'Test');
      recordViolation(state, 'agent-2', 'security', 'critical', 'Test');
      recordViolation(state, 'agent-2', 'execution', 'medium', 'Test');

      const stats = getViolationStats(state);
      expect(stats.totalViolations).toBe(4);
      expect(stats.resourceViolations).toBe(1);
      expect(stats.securityViolations).toBe(2);
      expect(stats.executionViolations).toBe(1);
      expect(stats.criticalViolations).toBe(1);
      expect(stats.violationsByAgent['agent-1']).toBe(2);
      expect(stats.violationsByAgent['agent-2']).toBe(2);
    });
  });

  describe('generateContainerReport', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should generate report with zero agents', () => {
      const report = generateContainerReport(state);
      expect(report.summary.totalAgents).toBe(0);
      expect(report.recommendations.length).toBe(0);
    });

    it('should generate report with multiple agents', () => {
      updateContainerStatus(state, 'agent-1', { status: 'running', running: true, healthy: true });
      updateContainerStatus(state, 'agent-2', { status: 'running', running: true, healthy: true });
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.5, memoryUsage: 256 });
      updateContainerMetrics(state, 'agent-2', { cpuUsage: 0.3, memoryUsage: 128 });

      const report = generateContainerReport(state);
      expect(report.summary.totalAgents).toBe(2);
      expect(report.summary.runningAgents).toBe(2);
      expect(report.summary.healthyAgents).toBe(2);
      expect(report.resourceUsage.totalCpuUsage).toBe(0.8);
      expect(report.resourceUsage.totalMemoryUsage).toBe(384);
    });

    it('should include recommendations for restricted agents', () => {
      updateContainerStatus(state, 'agent-1', { status: 'restricted', healthy: false });
      const report = generateContainerReport(state);
      expect(report.recommendations.some(r => r.includes('restricted'))).toBe(true);
    });

    it('should include recommendations for critical violations', () => {
      recordViolation(state, 'agent-1', 'security', 'critical', 'Critical issue');
      const report = generateContainerReport(state);
      expect(report.recommendations.some(r => r.includes('critical'))).toBe(true);
    });

    it('should include recommendations for high resource usage', () => {
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.9 });
      const report = generateContainerReport(state);
      expect(report.recommendations.some(r => r.includes('CPU'))).toBe(true);
    });
  });

  describe('exportContainerState', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
    });

    it('should export state to serializable format', () => {
      updateContainerStatus(state, 'agent-1', { status: 'running' });
      updateContainerMetrics(state, 'agent-1', { cpuUsage: 0.5 });

      const exported = exportContainerState(state);

      expect(exported.config).toBeDefined();
      expect(exported.metrics).toBeDefined();
      expect(exported.status).toBeDefined();
      expect(exported.securityProfiles).toBeDefined();
      expect(exported.violationLog).toBeDefined();
    });

    it('should convert dates to ISO strings', () => {
      updateContainerStatus(state, 'agent-1', { status: 'running' });
      const exported = exportContainerState(state);
      const statusData = exported.status as Array<Record<string, unknown>>;
      expect(typeof statusData[0]?.lastHealthCheck).toBe('string');
    });
  });

  describe('importContainerState', () => {
    it('should import previously exported state', () => {
      const state = createContainerState();
      registerDefaultSecurityProfiles(state);
      updateContainerStatus(state, 'agent-1', { status: 'running' });
      recordViolation(state, 'agent-1', 'resource', 'low', 'Test');

      const exported = exportContainerState(state);
      const imported = importContainerState(exported);

      expect(imported.config.cpuLimit).toBe(1.0);
      expect(imported.status.has('agent-1')).toBe(true);
      expect(imported.violationLog.length).toBe(1);
    });

    it('should restore dates from ISO strings', () => {
      const state = createContainerState();
      updateContainerStatus(state, 'agent-1', { status: 'running' });
      const exported = exportContainerState(state);

      const imported = importContainerState(exported);
      const status = imported.status.get('agent-1');

      expect(status?.lastHealthCheck).toBeInstanceOf(Date);
    });
  });

  describe('Integration Tests', () => {
    let state: ContainerIsolationState;

    beforeEach(() => {
      state = createContainerState();
      registerDefaultSecurityProfiles(state);
    });

    it('should handle full container lifecycle', () => {
      // Register and start agent
      updateContainerStatus(state, 'agent-1', {
        status: 'running',
        running: true,
        healthy: true,
      });

      // Update metrics during execution
      updateContainerMetrics(state, 'agent-1', {
        cpuUsage: 0.5,
        memoryUsage: 256,
        processCount: 3,
      });

      // Check resource allocations
      const cpuCheck = checkCpuAllocation(state, 'agent-1', 0.3);
      expect(cpuCheck.allowed).toBe(true);

      const memoryCheck = checkMemoryAllocation(state, 'agent-1', 100);
      expect(memoryCheck.allowed).toBe(true);

      // Record a violation
      recordViolation(state, 'agent-1', 'resource', 'medium', 'Test violation');

      // Generate report
      const report = generateContainerReport(state);
      expect(report.summary.totalAgents).toBe(1);
      expect(report.violations.totalViolations).toBe(1);
    });

    it('should restrict agent after repeated security violations', () => {
      updateContainerStatus(state, 'agent-1', {
        status: 'running',
        running: true,
        healthy: true,
      });

      // First two violations - agent still running
      recordViolation(state, 'agent-1', 'security', 'high', 'Violation 1');
      recordViolation(state, 'agent-1', 'security', 'high', 'Violation 2');
      let status = getContainerStatus(state, 'agent-1');
      expect(status?.status).toBe('running');
      expect(status?.securityViolations).toBe(2);

      // Third violation - agent restricted
      recordViolation(state, 'agent-1', 'security', 'high', 'Violation 3');
      status = getContainerStatus(state, 'agent-1');
      expect(status?.status).toBe('restricted');
      expect(status?.securityViolations).toBe(3);
    });

    it('should track multiple agents independently', () => {
      // Set up three agents with different states
      updateContainerStatus(state, 'good-agent', { status: 'running', healthy: true });
      updateContainerStatus(state, 'busy-agent', { status: 'running', healthy: true });
      updateContainerStatus(state, 'bad-agent', { status: 'running', healthy: true });

      updateContainerMetrics(state, 'good-agent', { cpuUsage: 0.2, memoryUsage: 100 });
      updateContainerMetrics(state, 'busy-agent', { cpuUsage: 0.9, memoryUsage: 450 });
      updateContainerMetrics(state, 'bad-agent', { cpuUsage: 0.1, memoryUsage: 50 });

      // Record violations for bad agent
      recordViolation(state, 'bad-agent', 'security', 'critical', 'Malicious activity');

      // Check each agent's state
      const goodStatus = getContainerStatus(state, 'good-agent');
      const busyStatus = getContainerStatus(state, 'busy-agent');
      const badStatus = getContainerStatus(state, 'bad-agent');

      expect(goodStatus?.healthy).toBe(true);
      expect(busyStatus?.healthy).toBe(true);
      expect(badStatus?.securityViolations).toBe(1);

      // Resource checks
      expect(checkCpuAllocation(state, 'good-agent', 0.5).allowed).toBe(true);
      expect(checkCpuAllocation(state, 'busy-agent', 0.2).allowed).toBe(false);
    });
  });
});
