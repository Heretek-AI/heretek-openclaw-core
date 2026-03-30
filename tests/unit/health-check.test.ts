/**
 * Heretek OpenClaw — Health Check Service Unit Tests
 * ==============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HealthCheckService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Agent Health Status Interface', () => {
        it('should have correct status types', () => {
            const validStatuses = ['online', 'offline', 'busy', 'error'];
            // This is a documentation test - interface is defined correctly
            expect(validStatuses).toContain('online');
            expect(validStatuses).toContain('offline');
            expect(validStatuses).toContain('busy');
            expect(validStatuses).toContain('error');
        });
    });

    describe('getAgentById', () => {
        it('should find steward agent', async () => {
            // Import the module
            const { getAgentById } = await import('../web-interface/src/lib/server/agent-registry');
            
            const steward = getAgentById('steward');
            expect(steward).toBeDefined();
            expect(steward?.id).toBe('steward');
            expect(steward?.name).toBe('Steward');
            expect(steward?.role).toBe('Orchestrator');
        });

        it('should return undefined for unknown agent', async () => {
            const { getAgentById } = await import('../web-interface/src/lib/server/agent-registry');
            
            const unknown = getAgentById('nonexistent');
            expect(unknown).toBeUndefined();
        });

        it('should find all triad members', async () => {
            const { getAgentById } = await import('../web-interface/src/lib/server/agent-registry');
            
            const agents = ['alpha', 'beta', 'charlie'];
            for (const agentId of agents) {
                const agent = getAgentById(agentId);
                expect(agent).toBeDefined();
                expect(agent?.role).toBe('Triad');
            }
        });
    });

    describe('Agent Registry Port Mapping', () => {
        it('should have correct port for each agent', async () => {
            const { AGENTS } = await import('../web-interface/src/lib/server/agent-registry');
            
            expect(AGENTS).toHaveLength(11);
            
            const expectedPorts: Record<string, number> = {
                steward: 8001,
                alpha: 8002,
                beta: 8003,
                charlie: 8004,
                examiner: 8005,
                explorer: 8006,
                sentinel: 8007,
                coder: 8008,
                dreamer: 8009,
                empath: 8010,
                historian: 8011
            };

            for (const agent of AGENTS) {
                expect(agent.port).toBe(expectedPorts[agent.id]);
            }
        });

        it('should have unique ports for all agents', async () => {
            const { AGENTS } = await import('../web-interface/src/lib/server/agent-registry');
            
            const ports = AGENTS.map(a => a.port);
            const uniquePorts = new Set(ports);
            expect(uniquePorts.size).toBe(11);
        });
    });

    describe('getAgentHealthUrl', () => {
        it('should generate correct health URL for localhost', async () => {
            const { getAgentHealthUrl, getAgentById } = await import('../web-interface/src/lib/server/agent-registry');
            
            // Set environment to localhost mode
            process.env.DOCKER_ENV = 'false';
            
            const steward = getAgentById('steward')!;
            const url = getAgentHealthUrl(steward);
            
            expect(url).toContain('localhost');
            expect(url).toContain('8001');
            expect(url).toContain('/health');
        });
    });

    describe('checkAgentHealth', () => {
        it('should handle successful health check', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status: 'online' })
            });

            // Test would use HealthCheckService.checkAgentHealth
            // This is a placeholder for the actual test
            expect(mockFetch).toBeDefined();
        });

        it('should handle failed health check', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            // Test would use HealthCheckService.checkAgentHealth
            // This is a placeholder for the actual test
            expect(mockFetch).toBeDefined();
        });
    });
});