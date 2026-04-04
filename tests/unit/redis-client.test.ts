/**
 * Unit tests for Redis Client Manager module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createRedisClient,
  getRedisClient,
  isRedisClientInitialized,
  getRedisClientState,
  closeRedisClient,
  forceCloseRedisClient,
  resetRedisClientState,
  createRedisConfigFromEnv,
  validateRedisConfig,
  type RedisConfig,
} from '../../lib/redis-client';

// Mock Redis class
const mockRedis = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnValue(mockRedis),
};

vi.mock('ioredis', () => ({
  default: class {
    constructor(url: string, options?: any) {
      mockRedis.constructor(url, options);
    }
    connect = mockRedis.connect;
    disconnect = mockRedis.disconnect;
    quit = mockRedis.quit;
    on = mockRedis.on;
  },
}));

describe('Redis Client Manager', () => {
  beforeEach(() => {
    resetRedisClientState();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await closeRedisClient();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validateRedisConfig', () => {
    it('should accept valid configuration', () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      expect(() => validateRedisConfig(config)).not.toThrow();
    });

    it('should reject empty config', () => {
      expect(() => validateRedisConfig(null as any)).toThrow('must be an object');
      expect(() => validateRedisConfig(undefined as any)).toThrow('must be an object');
    });

    it('should reject missing URL', () => {
      const config: RedisConfig = {
        url: '',
      };
      expect(() => validateRedisConfig(config)).toThrow('must have a valid URL string');
    });

    it('should reject invalid URL format', () => {
      const config: RedisConfig = {
        url: 'invalid-url',
      };
      expect(() => validateRedisConfig(config)).toThrow('Invalid Redis URL');
    });

    it('should reject invalid protocol', () => {
      const config: RedisConfig = {
        url: 'http://localhost:6379',
      };
      expect(() => validateRedisConfig(config)).toThrow('must use redis:// or rediss:// protocol');
    });

    it('should reject missing hostname', () => {
      const config: RedisConfig = {
        url: 'redis://',
      };
      expect(() => validateRedisConfig(config)).toThrow('must include a hostname');
    });

    it('should reject invalid port', () => {
      const config: RedisConfig = {
        url: 'redis://localhost:99999',
      };
      expect(() => validateRedisConfig(config)).toThrow('must have a valid port (1-65535)');
    });

    it('should accept default port (6379)', () => {
      const config: RedisConfig = {
        url: 'redis://localhost',
      };
      expect(() => validateRedisConfig(config)).not.toThrow();
    });

    it('should accept valid port range', () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6380',
      };
      expect(() => validateRedisConfig(config)).not.toThrow();
    });
  });

  describe('createRedisClient', () => {
    it('should create Redis client with valid config', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      const client = await createRedisClient(config);
      expect(client).toBeDefined();
      expect(isRedisClientInitialized()).toBe(true);
    });

    it('should return existing client if already initialized', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      const client1 = await createRedisClient(config);
      const client2 = await createRedisClient(config);
      expect(client1).toBe(client2);
    });

    it('should set up event handlers', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      await createRedisClient(config);
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle connection errors', async () => {
      const config: RedisConfig = {
        url: 'redis://invalid:6379',
      };
      mockRedis.connect.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(createRedisClient(config)).rejects.toThrow('Failed to create Redis client');
    });
  });

  describe('getRedisClient', () => {
    it('should return initialized client', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      await createRedisClient(config);
      const client = getRedisClient();
      expect(client).toBeDefined();
    });

    it('should throw error if not initialized', () => {
      expect(() => getRedisClient()).toThrow('not initialized');
    });
  });

  describe('isRedisClientInitialized', () => {
    it('should return true when initialized', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      await createRedisClient(config);
      expect(isRedisClientInitialized()).toBe(true);
    });

    it('should return false when not initialized', () => {
      expect(isRedisClientInitialized()).toBe(false);
    });
  });

  describe('getRedisClientState', () => {
    it('should return current state', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      await createRedisClient(config);
      const state = getRedisClientState();
      expect(state.isInitialized).toBe(true);
      expect(state.isConnecting).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.lastError).toBe(null);
    });

    it('should return default state when not initialized', () => {
      const state = getRedisClientState();
      expect(state.isInitialized).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.lastError).toBe(null);
    });
  });

  describe('closeRedisClient', () => {
    it('should close initialized client', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      await createRedisClient(config);
      await closeRedisClient();
      expect(isRedisClientInitialized()).toBe(false);
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should warn if client not initialized', async () => {
      await expect(closeRedisClient()).resolves.not.toThrow();
      expect(mockRedis.quit).not.toHaveBeenCalled();
    });
  });

  describe('forceCloseRedisClient', () => {
    it('should force close initialized client', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      await createRedisClient(config);
      await forceCloseRedisClient();
      expect(isRedisClientInitialized()).toBe(false);
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('should warn if client not initialized', async () => {
      await expect(forceCloseRedisClient()).resolves.not.toThrow();
      expect(mockRedis.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('resetRedisClientState', () => {
    it('should reset client state', async () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      await createRedisClient(config);
      expect(isRedisClientInitialized()).toBe(true);
      resetRedisClientState();
      expect(isRedisClientInitialized()).toBe(false);
    });
  });

  describe('createRedisConfigFromEnv', () => {
    beforeEach(() => {
      // Clear environment variables
      delete process.env.REDIS_URL;
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_USERNAME;
      delete process.env.REDIS_TLS;
      delete process.env.REDIS_CONNECT_TIMEOUT;
      delete process.env.REDIS_MAX_RETRIES;
      delete process.env.NODE_ENV;
    });

    it('should use default values when env vars not set', () => {
      const config = createRedisConfigFromEnv();
      expect(config.url).toBe('redis://localhost:6379');
      expect(config.password).toBeUndefined();
      expect(config.username).toBeUndefined();
      expect(config.tls).toBeUndefined();
      expect(config.connectTimeout).toBeUndefined();
      expect(config.maxRetriesPerRequest).toBeUndefined();
    });

    it('should use environment variables when set', () => {
      process.env.REDIS_URL = 'redis://custom:6380';
      process.env.REDIS_PASSWORD = 'secret';
      process.env.REDIS_USERNAME = 'user';
      process.env.REDIS_TLS = 'true';
      process.env.REDIS_CONNECT_TIMEOUT = '5000';
      process.env.REDIS_MAX_RETRIES = '5';
      process.env.NODE_ENV = 'production';

      const config = createRedisConfigFromEnv();
      expect(config.url).toBe('redis://custom:6380');
      expect(config.password).toBe('secret');
      expect(config.username).toBe('user');
      expect(config.tls).toBeDefined();
      expect(config.tls?.rejectUnauthorized).toBe(true);
      expect(config.connectTimeout).toBe(5000);
      expect(config.maxRetriesPerRequest).toBe(5);
    });
  });
});
