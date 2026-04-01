/**
 * Heretek OpenClaw — Agent Heartbeat Unit Tests
 * ==============================================================================
 * Unit tests for agent heartbeat mechanism, registration, and status monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock implementations for heartbeat module
vi.mock('../../modules/agent-heartbeat.js', () => ({
    startHeartbeat: vi.fn(),
    stopHeartbeat: vi.fn(),
    getHeartbeatStatus: vi.fn(),
    registerAgent: vi.fn(),
    deregisterAgent: vi.fn(),
    getAgentStatus: vi.fn(),
    updateAgentStatus: vi.fn()
}));

describe('Agent Heartbeat Mechanism', () => {
    const HEARTBEAT_INTERVAL = 5000;
    const HEARTBEAT_TIMEOUT = 15000;
    const AGENT_ID = 'test-agent';

    let heartbeatModule: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        heartbeatModule = await import('../../modules/agent-heartbeat.js');
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Heartbeat Start/Stop', () => {
        it('should start heartbeat for registered agent', async () => {
            const { startHeartbeat } = heartbeatModule;
            
            const result = await startHeartbeat(AGENT_ID, HEARTBEAT_INTERVAL);
            
            expect(result.success).toBe(true);
            expect(result.agentId).toBe(AGENT_ID);
            expect(result.interval).toBe(HEARTBEAT_INTERVAL);
        });

        it('should stop heartbeat when agent disconnects', async () => {
            const { startHeartbeat, stopHeartbeat } = heartbeatModule;
            
            await startHeartbeat(AGENT_ID, HEARTBEAT_INTERVAL);
            const stopResult = await stopHeartbeat(AGENT_ID);
            
            expect(stopResult.success).toBe(true);
            expect(stopResult.agentId).toBe(AGENT_ID);
        });

        it('should handle stop for non-existent heartbeat', async () => {
            const { stopHeartbeat } = heartbeatModule;
            
            const result = await stopHeartbeat('non-existent-agent');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should validate heartbeat interval', async () => {
            const { startHeartbeat } = heartbeatModule;
            
            // Test with invalid intervals
            const invalidIntervals = [-1000, 0, 100];
            
            for (const interval of invalidIntervals) {
                const result = await startHeartbeat(AGENT_ID, interval);
                expect(result.success).toBe(false);
                expect(result.error).toContain('invalid interval');
            }
        });

        it('should use default interval when not specified', async () => {
            const { startHeartbeat } = heartbeatModule;
            
            const result = await startHeartbeat(AGENT_ID);
            
            expect(result.success).toBe(true);
            expect(result.interval).toBe(HEARTBEAT_INTERVAL);
        });
    });

    describe('Agent Registration', () => {
        it('should register agent with metadata', async () => {
            const { registerAgent } = heartbeatModule;
            
            const metadata = {
                endpoint: 'http://localhost:8080',
                capabilities: ['chat', 'tools', 'memory'],
                version: '1.0.0'
            };
            
            const result = await registerAgent(AGENT_ID, metadata);
            
            expect(result.success).toBe(true);
            expect(result.agentId).toBe(AGENT_ID);
            expect(result.registeredAt).toBeDefined();
        });

        it('should prevent duplicate registration', async () => {
            const { registerAgent } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            const secondResult = await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8081' });
            
            expect(secondResult.success).toBe(false);
            expect(secondResult.error).toContain('already registered');
        });

        it('should require endpoint in metadata', async () => {
            const { registerAgent } = heartbeatModule;
            
            const result = await registerAgent(AGENT_ID, {});
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('endpoint required');
        });

        it('should deregister agent successfully', async () => {
            const { registerAgent, deregisterAgent } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            const result = await deregisterAgent(AGENT_ID);
            
            expect(result.success).toBe(true);
            expect(result.agentId).toBe(AGENT_ID);
        });

        it('should handle deregister for non-existent agent', async () => {
            const { deregisterAgent } = heartbeatModule;
            
            const result = await deregisterAgent('non-existent');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('Agent Status Tracking', () => {
        it('should get agent status', async () => {
            const { registerAgent, getAgentStatus } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { 
                endpoint: 'http://localhost:8080',
                capabilities: ['chat']
            });
            
            const status = await getAgentStatus(AGENT_ID);
            
            expect(status.success).toBe(true);
            expect(status.agentId).toBe(AGENT_ID);
            expect(status.status).toBe('online');
            expect(status.endpoint).toBe('http://localhost:8080');
        });

        it('should return error for unknown agent status', async () => {
            const { getAgentStatus } = heartbeatModule;
            
            const result = await getAgentStatus('unknown-agent');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should update agent status', async () => {
            const { registerAgent, updateAgentStatus, getAgentStatus } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            
            const updateResult = await updateAgentStatus(AGENT_ID, 'busy', {
                currentTask: 'processing-request'
            });
            
            expect(updateResult.success).toBe(true);
            
            const status = await getAgentStatus(AGENT_ID);
            expect(status.status).toBe('busy');
            expect(status.metadata?.currentTask).toBe('processing-request');
        });

        it('should track last heartbeat time', async () => {
            const { registerAgent, getAgentStatus, startHeartbeat } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            await startHeartbeat(AGENT_ID, 1000);
            
            // Wait for heartbeat
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            const status = await getAgentStatus(AGENT_ID);
            
            expect(status.lastHeartbeat).toBeDefined();
            expect(Date.parse(status.lastHeartbeat)).toBeGreaterThan(Date.now() - 2000);
        });
    });

    describe('Heartbeat Timeout Detection', () => {
        it('should detect missed heartbeat', async () => {
            const { registerAgent, startHeartbeat, getAgentStatus, stopHeartbeat } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            await startHeartbeat(AGENT_ID, 500);
            
            // Wait for heartbeat to establish
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // Stop heartbeat to simulate timeout
            await stopHeartbeat(AGENT_ID);
            
            // Wait for timeout period
            await new Promise(resolve => setTimeout(resolve, HEARTBEAT_TIMEOUT + 500));
            
            const status = await getAgentStatus(AGENT_ID);
            
            expect(status.status).toBe('offline');
            expect(status.timeout).toBe(true);
        });

        it('should emit timeout event', async () => {
            const { registerAgent, startHeartbeat, stopHeartbeat } = heartbeatModule;
            
            const timeoutEvents: any[] = [];
            
            // Mock event emitter
            const mockEmitter = {
                on: vi.fn((event, handler) => {
                    if (event === 'heartbeat-timeout') {
                        timeoutEvents.push(handler);
                    }
                }),
                emit: vi.fn()
            };
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            await startHeartbeat(AGENT_ID, 500);
            await stopHeartbeat(AGENT_ID);
            
            // Verify event listener was registered
            expect(mockEmitter.on).toHaveBeenCalled();
        });
    });

    describe('Multiple Agent Heartbeats', () => {
        it('should manage heartbeats for multiple agents', async () => {
            const { registerAgent, startHeartbeat, getAgentStatus } = heartbeatModule;
            
            const agents = ['agent-1', 'agent-2', 'agent-3'];
            
            // Register and start heartbeats
            for (const agent of agents) {
                await registerAgent(agent, { endpoint: `http://localhost:808${agents.indexOf(agent)}` });
                await startHeartbeat(agent, 1000);
            }
            
            // Verify all are online
            for (const agent of agents) {
                const status = await getAgentStatus(agent);
                expect(status.success).toBe(true);
                expect(status.status).toBe('online');
            }
        });

        it('should handle individual agent failures', async () => {
            const { registerAgent, startHeartbeat, stopHeartbeat, getAgentStatus } = heartbeatModule;
            
            const agents = ['agent-a', 'agent-b', 'agent-c'];
            
            for (const agent of agents) {
                await registerAgent(agent, { endpoint: `http://localhost:9000` });
                await startHeartbeat(agent, 1000);
            }
            
            // Stop one agent's heartbeat
            await stopHeartbeat('agent-b');
            
            // Verify others still working
            const statusA = await getAgentStatus('agent-a');
            const statusB = await getAgentStatus('agent-b');
            const statusC = await getAgentStatus('agent-c');
            
            expect(statusA.status).toBe('online');
            expect(statusB.status).toBe('offline');
            expect(statusC.status).toBe('online');
        });
    });

    describe('Heartbeat Recovery', () => {
        it('should recover from temporary network failure', async () => {
            const { registerAgent, startHeartbeat, getAgentStatus } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            
            // Start heartbeat
            const startResult = await startHeartbeat(AGENT_ID, 1000);
            expect(startResult.success).toBe(true);
            
            // Simulate recovery by restarting
            await startHeartbeat(AGENT_ID, 1000);
            
            const status = await getAgentStatus(AGENT_ID);
            expect(status.success).toBe(true);
        });

        it('should handle restart after crash', async () => {
            const { registerAgent, getAgentStatus } = heartbeatModule;
            
            // Simulate fresh registration after crash
            await registerAgent(AGENT_ID, { 
                endpoint: 'http://localhost:8080',
                recovered: true
            });
            
            const status = await getAgentStatus(AGENT_ID);
            expect(status.success).toBe(true);
            expect(status.status).toBe('online');
        });
    });

    describe('Heartbeat Metrics', () => {
        it('should track heartbeat count', async () => {
            const { registerAgent, startHeartbeat, getAgentStatus } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            await startHeartbeat(AGENT_ID, 100);
            
            // Wait for multiple heartbeats
            await new Promise(resolve => setTimeout(resolve, 350));
            
            const status = await getAgentStatus(AGENT_ID);
            
            expect(status.heartbeatCount).toBeGreaterThan(2);
        });

        it('should calculate heartbeat jitter', async () => {
            const { registerAgent, startHeartbeat, getAgentStatus } = heartbeatModule;
            
            await registerAgent(AGENT_ID, { endpoint: 'http://localhost:8080' });
            await startHeartbeat(AGENT_ID, 100);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const status = await getAgentStatus(AGENT_ID);
            
            // Jitter should be relatively small
            expect(status.jitter).toBeDefined();
            if (status.jitter !== undefined) {
                expect(status.jitter).toBeLessThan(50);
            }
        });
    });
});
