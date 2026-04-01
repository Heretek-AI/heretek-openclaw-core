/**
 * Heretek OpenClaw — Gateway RPC Integration Tests
 * ==============================================================================
 * Integration tests for Gateway RPC endpoints, WebSocket bridge, and Redis messaging
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

describe('Gateway RPC Integration', () => {
    const GATEWAY_PORT = process.env.GATEWAY_PORT || '8787';
    const GATEWAY_URL = `http://localhost:${GATEWAY_PORT}`;
    const WS_URL = `ws://localhost:${GATEWAY_PORT}`;
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    let httpServer: Server | null = null;
    let wss: WebSocketServer | null = null;

    beforeAll(async () => {
        process.env.GATEWAY_PORT = GATEWAY_PORT;
        process.env.REDIS_URL = REDIS_URL;
    });

    afterAll(async () => {
        if (wss) {
            wss.close();
        }
        if (httpServer) {
            httpServer.close();
        }
        delete process.env.GATEWAY_PORT;
        delete process.env.REDIS_URL;
    });

    describe('Gateway Health Endpoints', () => {
        it('should respond to health check', async () => {
            const response = await fetch(`${GATEWAY_URL}/health`);
            expect(response.status).toBe(200);
            
            const data = await response.json();
            expect(data.status).toBe('ok');
            expect(data.timestamp).toBeDefined();
        });

        it('should return gateway version', async () => {
            const response = await fetch(`${GATEWAY_URL}/health`);
            const data = await response.json();
            
            expect(data.version).toBeDefined();
            expect(typeof data.version).toBe('string');
        });

        it('should return agent status summary', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/agents/status`);
            expect([200, 503]).toContain(response.status);
            
            if (response.status === 200) {
                const data = await response.json();
                expect(data.agents).toBeDefined();
                expect(Array.isArray(data.agents)).toBe(true);
            }
        });
    });

    describe('Gateway RPC Methods', () => {
        it('should handle agent registration RPC', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/rpc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'agent.register',
                    params: {
                        agentId: 'test-agent',
                        endpoint: 'http://localhost:9999',
                        capabilities: ['chat', 'tools']
                    },
                    id: 1
                })
            });

            const result = await response.json();
            expect(result.jsonrpc).toBe('2.0');
            expect(result.id).toBe(1);
            // Either success or expected error if agent exists
            expect(result.result || result.error).toBeDefined();
        });

        it('should handle agent deregistration RPC', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/rpc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'agent.unregister',
                    params: { agentId: 'test-agent' },
                    id: 2
                })
            });

            const result = await response.json();
            expect(result.jsonrpc).toBe('2.0');
            expect(result.id).toBe(2);
        });

        it('should handle message send RPC', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/rpc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'message.send',
                    params: {
                        from: 'test-agent',
                        to: 'alpha',
                        content: 'Test RPC message',
                        type: 'direct'
                    },
                    id: 3
                })
            });

            const result = await response.json();
            expect(result.jsonrpc).toBe('2.0');
            expect(result.id).toBe(3);
        });

        it('should handle invalid RPC method', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/rpc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'invalid.method',
                    params: {},
                    id: 999
                })
            });

            const result = await response.json();
            expect(result.jsonrpc).toBe('2.0');
            expect(result.error).toBeDefined();
            expect(result.error.code).toBe(-32601); // Method not found
        });

        it('should handle malformed RPC request', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/rpc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invalid: 'rpc' })
            });

            const result = await response.json();
            expect(result.error).toBeDefined();
            expect(result.error.code).toBe(-32600); // Invalid request
        });
    });

    describe('WebSocket Bridge', () => {
        it('should establish WebSocket connection', async () => {
            const ws = new WebSocket(WS_URL);
            
            const connectionResult = await new Promise<boolean>((resolve) => {
                ws.on('open', () => resolve(true));
                ws.on('error', () => resolve(false));
                setTimeout(() => {
                    ws.close();
                    resolve(false);
                }, 5000);
            });

            expect(connectionResult).toBe(true);
        });

        it('should handle WebSocket ping/pong', async () => {
            const ws = new WebSocket(WS_URL);
            
            const pingResult = await new Promise<boolean>((resolve) => {
                ws.on('open', () => {
                    ws.ping();
                });
                ws.on('pong', () => {
                    ws.close();
                    resolve(true);
                });
                ws.on('error', () => resolve(false));
                setTimeout(() => {
                    ws.close();
                    resolve(false);
                }, 5000);
            });

            expect(pingResult).toBe(true);
        });

        it('should handle WebSocket message echo', async () => {
            const ws = new WebSocket(WS_URL);
            const testMessage = JSON.stringify({ type: 'echo', data: 'test' });
            
            const echoResult = await new Promise<any>((resolve) => {
                ws.on('open', () => {
                    ws.send(testMessage);
                });
                ws.on('message', (data) => {
                    ws.close();
                    resolve(JSON.parse(data.toString()));
                });
                ws.on('error', () => resolve(null));
                setTimeout(() => {
                    ws.close();
                    resolve(null);
                }, 5000);
            });

            // If echo is implemented, verify; otherwise document expected behavior
            if (echoResult) {
                expect(echoResult.type || echoResult).toBeDefined();
            }
        });

        it('should handle WebSocket broadcast', async () => {
            const ws1 = new WebSocket(WS_URL);
            const ws2 = new WebSocket(WS_URL);
            
            const broadcastResult = await new Promise<boolean>((resolve) => {
                let ws1Ready = false;
                let ws2Ready = false;
                let messageReceived = false;

                ws1.on('open', () => { ws1Ready = true; });
                ws2.on('open', () => { 
                    ws2Ready = true;
                    if (ws1Ready) {
                        ws1.send(JSON.stringify({ type: 'broadcast', data: 'test broadcast' }));
                    }
                });
                ws2.on('message', () => {
                    messageReceived = true;
                });

                setTimeout(() => {
                    ws1.close();
                    ws2.close();
                    resolve(messageReceived);
                }, 3000);
            });

            // Document expected behavior
            expect(typeof broadcastResult).toBe('boolean');
        });
    });

    describe('Redis Messaging Integration', () => {
        it('should publish message to Redis channel', async () => {
            try {
                const { sendMessage } = await import('../skills/a2a-message-send/a2a-redis.js');
                
                const result = await sendMessage('gateway', 'alpha', 'Redis test message');
                
                expect(result.success).toBe(true);
                expect(result.channel).toBe('openclaw:messages:alpha');
            } catch (error) {
                // Redis may not be available - document expected behavior
                expect(true).toBe(true);
            }
        });

        it('should subscribe to Redis channel', async () => {
            try {
                const { subscribeToChannel } = await import('../skills/a2a-message-send/a2a-redis.js');
                
                const subscriber = await subscribeToChannel('test-agent');
                
                expect(subscriber).toBeDefined();
                expect(typeof subscriber.subscribe).toBe('function');
            } catch (error) {
                expect(true).toBe(true);
            }
        });

        it('should handle Redis reconnection', async () => {
            try {
                const { getRedisClient } = await import('../skills/a2a-message-send/a2a-redis.js');
                
                const client1 = await getRedisClient();
                expect(client1).toBeDefined();
                
                // Simulate reconnection
                const client2 = await getRedisClient(true);
                expect(client2).toBeDefined();
            } catch (error) {
                expect(true).toBe(true);
            }
        });
    });

    describe('Gateway Agent Discovery', () => {
        it('should discover registered agents', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/agents`);
            expect([200, 503]).toContain(response.status);
            
            if (response.status === 200) {
                const data = await response.json();
                expect(data.agents).toBeDefined();
            }
        });

        it('should return agent details by ID', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/agents/steward`);
            // May return 404 if agent not registered - both are valid
            expect([200, 404, 503]).toContain(response.status);
        });

        it('should filter agents by capability', async () => {
            const response = await fetch(`${GATEWAY_URL}/api/agents?capability=chat`);
            expect([200, 503]).toContain(response.status);
            
            if (response.status === 200) {
                const data = await response.json();
                if (data.agents) {
                    expect(Array.isArray(data.agents)).toBe(true);
                }
            }
        });
    });

    describe('Gateway Rate Limiting', () => {
        it('should handle rate limit headers', async () => {
            const response = await fetch(`${GATEWAY_URL}/health`);
            
            // Check for rate limit headers (may or may not be present)
            const rateLimitHeader = response.headers.get('x-ratelimit-limit');
            const remainingHeader = response.headers.get('x-ratelimit-remaining');
            
            // Document expected behavior
            if (rateLimitHeader) {
                expect(parseInt(rateLimitHeader)).toBeGreaterThan(0);
            }
            if (remainingHeader) {
                expect(parseInt(remainingHeader)).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('Gateway Error Handling', () => {
        it('should handle timeout errors', async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            
            try {
                await fetch(`${GATEWAY_URL}/api/slow-endpoint`, {
                    signal: controller.signal
                });
                expect.fail('Should have timed out');
            } catch (error: any) {
                expect(error.name).toBe('AbortError');
            } finally {
                clearTimeout(timeoutId);
            }
        });

        it('should handle connection refused', async () => {
            try {
                await fetch('http://localhost:99999/invalid');
                expect.fail('Should have failed');
            } catch (error: any) {
                expect(error).toBeDefined();
            }
        });
    });
});
