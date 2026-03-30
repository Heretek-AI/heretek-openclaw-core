/**
 * Heretek OpenClaw — Test Utilities
 * ==============================================================================
 * Shared utilities for testing
 * ==============================================================================
 */

import { vi } from 'vitest';

// Mock fetch for API testing
export function mockFetch(response: any, ok = true) {
    global.fetch = vi.fn().mockResolvedValue({
        ok,
        json: () => Promise.resolve(response)
    });
}

// Mock fetch that rejects
export function mockFetchError(error: Error) {
    global.fetch = vi.fn().mockRejectedValue(error);
}

// Create mock agent
export function createMockAgent(overrides = {}) {
    return {
        id: 'steward',
        name: 'Steward',
        role: 'Orchestrator',
        status: 'offline' as const,
        port: 8001,
        description: 'Test agent',
        ...overrides
    };
}

// Create mock A2A message
export function createMockA2AMessage(overrides = {}) {
    return {
        from: 'steward',
        to: 'alpha',
        content: 'Test message',
        timestamp: new Date(),
        ...overrides
    };
}

// Create mock session
export function createMockSession(overrides = {}) {
    return {
        id: crypto.randomUUID(),
        type: 'user_conversation' as const,
        name: 'Test Session',
        participants: [{ id: 'steward', type: 'agent' as const }],
        createdBy: 'user123',
        context: {},
        state: { status: 'active' as const, messages: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        ...overrides
    };
}

// Sleep utility for async tests
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test helper to suppress console output
export function suppressConsole() {
    const originalError = console.error;
    const originalLog = console.log;
    const originalWarn = console.warn;
    
    beforeEach(() => {
        console.error = vi.fn();
        console.log = vi.fn();
        console.warn = vi.fn();
    });
    
    afterEach(() => {
        console.error = originalError;
        console.log = originalLog;
        console.warn = originalWarn;
    });
}

// Re-export test matchers
export * from 'vitest';