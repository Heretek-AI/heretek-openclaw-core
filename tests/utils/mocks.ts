/**
 * Heretek OpenClaw — Test Mocks
 * ==============================================================================
 * Mock objects for testing: Redis, WebSocket, agent container
 */

import { vi } from 'vitest';

/**
 * Mock Redis client
 * @returns Mocked Redis client with common methods
 */
export function createMockRedis() {
    return {
        ping: vi.fn().mockResolvedValue('PONG'),
        subscribe: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        keys: vi.fn().mockResolvedValue([]),
        flushall: vi.fn().mockResolvedValue('OK'),
        info: vi.fn().mockResolvedValue({ redis_version: '7.0.0' }),
        lpush: vi.fn().mockResolvedValue(1),
        rpush: vi.fn().mockResolvedValue(1),
        lrange: vi.fn().mockResolvedValue([]),
        llen: vi.fn().mockResolvedValue(0),
        ltrim: vi.fn().mockResolvedValue('OK'),
        sadd: vi.fn().mockResolvedValue(1),
        smembers: vi.fn().mockResolvedValue([]),
        sismember: vi.fn().mockResolvedValue(0),
        hset: vi.fn().mockResolvedValue(1),
        hget: vi.fn().mockResolvedValue(null),
        hgetall: vi.fn().mockResolvedValue({}),
        hdel: vi.fn().mockResolvedValue(1)
    };
}

/**
 * Mock Redis client that simulates connection failure
 * @returns Mocked Redis client that throws on connect
 */
export function createMockRedisFailure() {
    return {
        ping: vi.fn().mockRejectedValue(new Error('Connection refused')),
        subscribe: vi.fn().mockRejectedValue(new Error('Connection refused')),
        publish: vi.fn().mockRejectedValue(new Error('Connection refused')),
        quit: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
    };
}

/**
 * Mock Redis client with custom behavior
 * @param options Custom mock options
 * @returns Mocked Redis client
 */
export function createMockRedisWithOptions(options: {
    pingValue?: string;
    publishValue?: number;
    getValue?: string | null;
    setValue?: string;
} = {}) {
    return {
        ping: vi.fn().mockResolvedValue(options.pingValue ?? 'PONG'),
        subscribe: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(options.publishValue ?? 1),
        quit: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue(options.getValue ?? null),
        set: vi.fn().mockResolvedValue(options.setValue ?? 'OK')
    };
}

/**
 * Mock WebSocket server
 * @returns Mocked WebSocket server
 */
export function createMockWebSocketServer() {
    return {
        on: vi.fn(),
        close: vi.fn(),
        clients: new Set(),
        address: vi.fn().mockReturnValue({ port: 3001 }),
        emit: vi.fn()
    };
}

/**
 * Mock WebSocket server with custom port
 * @param port Server port
 * @returns Mocked WebSocket server
 */
export function createMockWebSocketServerWithPort(port: number) {
    return {
        on: vi.fn(),
        close: vi.fn(),
        clients: new Set(),
        address: vi.fn().mockReturnValue({ port }),
        emit: vi.fn()
    };
}

/**
 * Mock WebSocket client
 * @returns Mocked WebSocket client
 */
export function createMockWebSocketClient() {
    return {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    };
}

/**
 * Mock WebSocket client in closed state
 * @returns Mocked WebSocket client (closed)
 */
export function createMockWebSocketClientClosed() {
    return {
        readyState: 3, // WebSocket.CLOSED
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    };
}

/**
 * Mock WebSocket client that throws on send
 * @returns Mocked WebSocket client (throws)
 */
export function createMockWebSocketClientError() {
    return {
        readyState: 1,
        send: vi.fn().mockImplementation(() => {
            throw new Error('Socket closed');
        }),
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    };
}

/**
 * Mock agent container
 * @param name Agent name
 * @returns Mocked agent container
 */
export function createMockAgentContainer(name: string) {
    return {
        name,
        health: vi.fn().mockResolvedValue({ ok: true, status: 'online' }),
        send: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-123' }),
        receive: vi.fn().mockResolvedValue({ messages: [] }),
        queryStatus: vi.fn().mockResolvedValue({ online: true, busy: false }),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: true
    };
}

/**
 * Mock agent container that is offline
 * @param name Agent name
 * @returns Mocked agent container (offline)
 */
export function createMockAgentContainerOffline(name: string) {
    return {
        name,
        health: vi.fn().mockRejectedValue(new Error('Connection refused')),
        send: vi.fn().mockRejectedValue(new Error('Agent offline')),
        receive: vi.fn().mockRejectedValue(new Error('Agent offline')),
        queryStatus: vi.fn().mockResolvedValue({ online: false, busy: false }),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: false
    };
}

/**
 * Mock agent container with custom behavior
 * @param name Agent name
 * @param options Custom options
 * @returns Mocked agent container
 */
export function createMockAgentContainerWithOptions(
    name: string,
    options: {
        online?: boolean;
        busy?: boolean;
        sendSuccess?: boolean;
    } = {}
) {
    const { online = true, busy = false, sendSuccess = true } = options;

    return {
        name,
        health: vi.fn().mockResolvedValue({
            ok: online,
            status: online ? 'online' : 'offline'
        }),
        send: vi.fn().mockImplementation(async () => {
            if (sendSuccess) {
                return { success: true, messageId: 'mock-123' };
            }
            throw new Error('Send failed');
        }),
        receive: vi.fn().mockResolvedValue({ messages: [] }),
        queryStatus: vi.fn().mockResolvedValue({ online, busy }),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: online
    };
}

/**
 * Mock fetch for API testing
 * @param response Response body
 * @param ok Whether request is ok
 * @param status HTTP status code
 * @returns Mocked fetch function
 */
export function createMockFetch(response: any, ok = true, status = 200) {
    return vi.fn().mockResolvedValue({
        ok,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response)),
        headers: new Map()
    });
}

/**
 * Mock fetch that rejects
 * @param error Error to throw
 * @returns Mocked fetch function
 */
export function createMockFetchReject(error: Error) {
    return vi.fn().mockRejectedValue(error);
}

/**
 * Mock fetch with multiple responses (for testing retries)
 * @param responses Array of responses
 * @returns Mocked fetch function
 */
export function createMockFetchSequence(responses: Array<{ response?: any; ok?: boolean; status?: number; error?: Error }>) {
    const mock = vi.fn();

    for (const { response, ok = true, status = 200, error } of responses) {
        if (error) {
            mock.mockRejectedValueOnce(error);
        } else {
            mock.mockResolvedValueOnce({
                ok,
                status,
                json: () => Promise.resolve(response),
                text: () => Promise.resolve(JSON.stringify(response))
            });
        }
    }

    return mock;
}

/**
 * Mock LiteLLM client
 * @returns Mocked LiteLLM client
 */
export function createMockLiteLLMClient() {
    return {
        chat: vi.fn().mockResolvedValue({
            choices: [{
                message: { content: 'Mock response' }
            }],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30
            }
        }),
        health: vi.fn().mockResolvedValue({ ok: true }),
        status: vi.fn().mockResolvedValue({ online: true })
    };
}

/**
 * Mock conversation cache
 * @returns Mocked conversation cache
 */
export function createMockConversationCache() {
    const cache = new Map<string, any[]>();

    return {
        get: vi.fn().mockImplementation((conversationId: string) => cache.get(conversationId) || []),
        set: vi.fn().mockImplementation((conversationId: string, messages: any[]) => {
            cache.set(conversationId, messages);
            return true;
        }),
        add: vi.fn().mockImplementation((conversationId: string, message: any) => {
            const messages = cache.get(conversationId) || [];
            messages.push(message);
            cache.set(conversationId, messages);
            return true;
        }),
        clear: vi.fn().mockImplementation((conversationId: string) => {
            cache.delete(conversationId);
            return true;
        }),
        has: vi.fn().mockImplementation((conversationId: string) => cache.has(conversationId)),
        size: vi.fn().mockImplementation(() => cache.size)
    };
}
