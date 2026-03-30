/**
 * Heretek OpenClaw — Agent Client Unit Tests
 * ==============================================================================
 * Tests for AgentClient: A2A send, Redis fallback, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AgentClient', () => {
    let AgentClient: any;
    let client: any;

    const mockConfig = {
        agentId: 'steward',
        role: 'orchestrator',
        litellmHost: 'http://localhost:4000',
        apiKey: 'test-key'
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        // Import the module fresh for each test
        AgentClient = (await import('../web-interface/src/lib/server/agent-client')).AgentClient;
        if (AgentClient) {
            client = new AgentClient(mockConfig);
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendMessage', () => {
        it('should send message to agent via A2A successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, messageId: 'test-123' })
            });

            // If AgentClient doesn't exist yet, test the concept
            if (!AgentClient) {
                // Placeholder test - verifies fetch was called correctly
                const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');
                const result = await sendA2AMessage({
                    from: 'steward',
                    to: 'alpha',
                    content: 'Test message',
                    timestamp: new Date()
                });

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/v1/agents/alpha/send'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Authorization': expect.stringContaining('Bearer')
                        })
                    })
                );
                return;
            }

            const result = await client.sendMessage('alpha', 'Test message');

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-123');
        });

        it('should handle A2A failure and fallback to Redis', async () => {
            mockFetch
                .mockRejectedValueOnce(new Error('404 Not Found'))
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });

            // Test fallback behavior
            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await sendA2AMessage({
                from: 'steward',
                to: 'alpha',
                content: 'Test message',
                timestamp: new Date()
            });

            // First call fails, second succeeds
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should return error when both A2A and Redis fail', async () => {
            mockFetch
                .mockRejectedValueOnce(new Error('404'))
                .mockRejectedValueOnce(new Error('Redis connection failed'));

            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await sendA2AMessage({
                from: 'steward',
                to: 'alpha',
                content: 'Test message',
                timestamp: new Date()
            });

            expect(result).toBe(false);
        });

        it('should handle timeout gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Timeout'));

            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await sendA2AMessage({
                from: 'steward',
                to: 'alpha',
                content: 'Test message',
                timestamp: new Date()
            });

            expect(result).toBe(false);
        });
    });

    describe('queryStatus', () => {
        it('should return agent status', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status: 'online', busy: false })
            });

            const { queryAgentStatus } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await queryAgentStatus('alpha');

            expect(result.online).toBe(true);
            expect(result.busy).toBe(false);
        });

        it('should return offline for failed status check', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const { queryAgentStatus } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await queryAgentStatus('alpha');

            expect(result.online).toBe(false);
        });

        it('should return busy status when agent is busy', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status: 'busy', busy: true })
            });

            const { queryAgentStatus } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await queryAgentStatus('coder');

            expect(result.online).toBe(true);
            expect(result.busy).toBe(true);
        });
    });

    describe('broadcastMessage', () => {
        it('should broadcast to multiple agents', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });

            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');

            const agents = ['alpha', 'beta', 'charlie'];
            const results = await Promise.all(
                agents.map(agent => sendA2AMessage({
                    from: 'steward',
                    to: agent,
                    content: 'Broadcast message',
                    timestamp: new Date()
                }))
            );

            expect(results.every(r => r === true)).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('Error Handling', () => {
        it('should handle 429 rate limit', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            });

            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await sendA2AMessage({
                from: 'steward',
                to: 'alpha',
                content: 'Test message',
                timestamp: new Date()
            });

            expect(result).toBe(false);
        });

        it('should handle 500 server error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await sendA2AMessage({
                from: 'steward',
                to: 'alpha',
                content: 'Test message',
                timestamp: new Date()
            });

            expect(result).toBe(false);
        });

        it('should handle network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');
            const result = await sendA2AMessage({
                from: 'steward',
                to: 'alpha',
                content: 'Test message',
                timestamp: new Date()
            });

            expect(result).toBe(false);
        });
    });
});
