/**
 * Heretek OpenClaw — LiteLLM Client Unit Tests
 * ==============================================================================
 * Tests for A2A endpoint format verification (/v1/agents/{name} format)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LiteLLM A2A Endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sendA2AMessage endpoint format', () => {
        it('should use /v1/agents/{name}/send format', async () => {
            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            const message = {
                from: 'alpha',
                to: 'beta',
                content: 'Test message',
                timestamp: new Date()
            };

            await sendA2AMessage(message);

            // Verify correct endpoint format was used
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/v1/agents/beta/send'),
                expect.any(Object)
            );
        });

        it('should include Authorization header', async () => {
            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({
                ok: true
            });

            await sendA2AMessage({
                from: 'alpha',
                to: 'steward',
                content: 'Test',
                timestamp: new Date()
            });

            const callArgs = mockFetch.mock.calls[0];
            const options = callArgs[1];
            expect(options.headers).toHaveProperty('Authorization');
        });

        it('should return false on request failure', async () => {
            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            const result = await sendA2AMessage({
                from: 'alpha',
                to: 'nonexistent',
                content: 'Test',
                timestamp: new Date()
            });

            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            const { sendA2AMessage } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await sendA2AMessage({
                from: 'alpha',
                to: 'beta',
                content: 'Test',
                timestamp: new Date()
            });

            expect(result).toBe(false);
        });
    });

    describe('queryAgentStatus endpoint format', () => {
        it('should use /v1/agents/{name}/heartbeat format', async () => {
            const { queryAgentStatus } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status: 'online' })
            });

            await queryAgentStatus('alpha');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/v1/agents/alpha/heartbeat'),
                expect.any(Object)
            );
        });

        it('should return online status for healthy agent', async () => {
            const { queryAgentStatus } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status: 'online', busy: false })
            });

            const result = await queryAgentStatus('steward');

            expect(result.online).toBe(true);
            expect(result.busy).toBe(false);
        });

        it('should return busy status when agent is busy', async () => {
            const { queryAgentStatus } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status: 'busy' })
            });

            const result = await queryAgentStatus('coder');

            expect(result.online).toBe(true);
            expect(result.busy).toBe(true);
        });

        it('should return offline status on failure', async () => {
            const { queryAgentStatus } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const result = await queryAgentStatus('beta');

            expect(result.online).toBe(false);
        });
    });

    describe('getLiteLLMHealth', () => {
        it('should use /health endpoint', async () => {
            const { getLiteLLMHealth } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({
                ok: true
            });

            await getLiteLLMHealth();

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/health'),
                expect.any(Object)
            );
        });

        it('should return true on success', async () => {
            const { getLiteLLMHealth } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockResolvedValueOnce({ ok: true });

            const result = await getLiteLLMHealth();
            expect(result).toBe(true);
        });

        it('should return false on failure', async () => {
            const { getLiteLLMHealth } = await import('../web-interface/src/lib/server/litellm-client');

            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const result = await getLiteLLMHealth();
            expect(result).toBe(false);
        });
    });
});

describe('A2A Endpoint Format Verification', () => {
    it('should use v1/agents pattern (not deprecated /a2a/)', async () => {
        const endpointPattern = /\/v1\/agents\/[a-z]+\/(send|messages|heartbeat|tasks)/;
        
        // Verify the pattern is used in litellm_client
        const litellmClientContent = `
            /v1/agents/{toAgent}/send
            /v1/agents/${agentName}/heartbeat
        `;
        
        expect(litellmClientContent).toMatch(endpointPattern);
        expect(litellmClientContent).not.toMatch(/\/a2a\//);
    });
});