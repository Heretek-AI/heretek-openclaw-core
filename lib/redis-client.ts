/**
 * ==============================================================================
 * Redis Client Manager Module
 * ==============================================================================
 * 
 * Provides singleton Redis client with authentication, TLS support,
 * reconnection logic, and connection pooling for production use.
 * 
 * @module redis-client
 */

import Redis from 'ioredis';

/**
 * Redis configuration interface
 */
export interface RedisConfig {
  /** Redis connection URL (redis://user:pass@host:port) */
  url: string;
  /** Redis password (if not in URL) */
  password?: string;
  /** Redis username (if not in URL) */
  username?: string;
  /** TLS configuration */
  tls?: {
    /** Reject unauthorized certificates (development: false, production: true) */
    rejectUnauthorized?: boolean;
  };
  /** Maximum retries per request */
  maxRetriesPerRequest?: number;
  /** Enable ready check */
  enableReadyCheck?: boolean;
  /** Enable offline queue */
  enableOfflineQueue?: boolean;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Socket timeout in milliseconds */
  socketTimeout?: number;
  /** Command timeout in milliseconds */
  commandTimeout?: number;
}

/**
 * Redis client state
 */
interface RedisClientState {
  client: Redis | null;
  config: RedisConfig | null;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastError: Error | null;
}

/**
 * Global Redis client state (singleton pattern)
 */
let redisState: RedisClientState = {
  client: null,
  config: null,
  isConnecting: false,
  reconnectAttempts: 0,
  lastError: null,
};

/**
 * Create and initialize Redis client with configuration
 * 
 * @param config - Redis configuration
 * @returns Promise resolving to Redis client
 * @throws Error if connection fails
 * 
 * @example
 * ```typescript
 * const client = await createRedisClient({
 *   url: 'redis://localhost:6379',
 *   password: 'mypassword',
 *   maxRetriesPerRequest: 3,
 * });
 * ```
 */
export async function createRedisClient(config: RedisConfig): Promise<Redis> {
  if (redisState.client) {
    console.warn('Redis client already initialized. Returning existing client.');
    return redisState.client;
  }

  if (redisState.isConnecting) {
    console.warn('Redis client is already connecting. Waiting...');
    // Wait up to 10 seconds for connection
    const maxWait = 10000;
    const checkInterval = 100;
    let waited = 0;
    
    while (redisState.isConnecting && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
    
    if (redisState.client) {
      return redisState.client;
    }
    
    throw new Error('Redis client connection timeout');
  }

  redisState.isConnecting = true;
  redisState.config = config;

  try {
    const clientOptions = {
      connectTimeout: config.connectTimeout || 10000,
      lazyConnect: false,
      password: config.password,
      username: config.username,
      tls: config.tls,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      enableReadyCheck: config.enableReadyCheck !== false,
      enableOfflineQueue: config.enableOfflineQueue !== false,
    };

    const client = new Redis(config.url, clientOptions);

    // Set up event handlers
    client.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
      redisState.lastError = err;
    });

    client.on('reconnecting', () => {
      console.log('Redis Client Reconnecting...');
      redisState.reconnectAttempts++;
    });

    client.on('connect', () => {
      console.log('Redis Client Connected');
      redisState.reconnectAttempts = 0;
      redisState.lastError = null;
      redisState.isConnecting = false;
    });

    client.on('ready', () => {
      console.log('Redis Client Ready');
      redisState.isConnecting = false;
    });

    client.on('close', () => {
      console.log('Redis Client Connection Closed');
      redisState.isConnecting = false;
    });

    redisState.client = client;
    redisState.isConnecting = false;
    
    console.log('Redis client initialized successfully');
    return client;
  } catch (error) {
    redisState.isConnecting = false;
    redisState.lastError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to create Redis client: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get initialized Redis client
 * 
 * @returns Redis client
 * @throws Error if client not initialized
 * 
 * @example
 * ```typescript
 * const client = getRedisClient();
 * await client.set('key', 'value');
 * ```
 */
export function getRedisClient(): Redis {
  if (!redisState.client) {
    throw new Error(
      'Redis client not initialized. Call createRedisClient() first.'
    );
  }
  return redisState.client;
}

/**
 * Check if Redis client is initialized
 * 
 * @returns True if client is initialized
 */
export function isRedisClientInitialized(): boolean {
  return redisState.client !== null;
}

/**
 * Get Redis client state information
 * 
 * @returns Current state of Redis client
 */
export function getRedisClientState(): {
  isInitialized: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastError: Error | null;
} {
  return {
    isInitialized: redisState.client !== null,
    isConnecting: redisState.isConnecting,
    reconnectAttempts: redisState.reconnectAttempts,
    lastError: redisState.lastError,
  };
}

/**
 * Close Redis client connection
 * 
 * @returns Promise that resolves when client is closed
 * 
 * @example
 * ```typescript
 * await closeRedisClient();
 * console.log('Redis client closed');
 * ```
 */
export async function closeRedisClient(): Promise<void> {
  if (!redisState.client) {
    console.warn('Redis client not initialized. Nothing to close.');
    return;
  }

  try {
    await redisState.client.quit();
    redisState.client = null;
    redisState.config = null;
    redisState.isConnecting = false;
    redisState.reconnectAttempts = 0;
    redisState.lastError = null;
    console.log('Redis client closed successfully');
  } catch (error) {
    console.error('Error closing Redis client:', error);
    redisState.lastError = error instanceof Error ? error : new Error(String(error));
    throw error;
  }
}

/**
 * Force close Redis client connection (disconnect without QUIT)
 * 
 * @returns Promise that resolves when client is disconnected
 * 
 * @example
 * ```typescript
 * await forceCloseRedisClient();
 * console.log('Redis client disconnected');
 * ```
 */
export async function forceCloseRedisClient(): Promise<void> {
  if (!redisState.client) {
    console.warn('Redis client not initialized. Nothing to close.');
    return;
  }

  try {
    redisState.client.disconnect();
    redisState.client = null;
    redisState.config = null;
    redisState.isConnecting = false;
    redisState.reconnectAttempts = 0;
    redisState.lastError = null;
    console.log('Redis client force closed successfully');
  } catch (error) {
    console.error('Error force closing Redis client:', error);
    redisState.lastError = error instanceof Error ? error : new Error(String(error));
    throw error;
  }
}

/**
 * Reset the Redis client state (for testing)
 * 
 * @internal
 */
export function resetRedisClientState(): void {
  redisState = {
    client: null,
    config: null,
    isConnecting: false,
    reconnectAttempts: 0,
    lastError: null,
  };
}

/**
 * Create Redis configuration from environment variables
 * 
 * @returns Redis configuration object
 * 
 * @example
 * ```typescript
 * const config = createRedisConfigFromEnv();
 * const client = await createRedisClient(config);
 * ```
 */
export function createRedisConfigFromEnv(): RedisConfig {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const password = process.env.REDIS_PASSWORD;
  const username = process.env.REDIS_USERNAME;
  
  const config: RedisConfig = {
    url,
    password,
    username,
  };

  // TLS configuration
  if (process.env.REDIS_TLS === 'true') {
    config.tls = {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    };
  }

  // Connection timeouts
  if (process.env.REDIS_CONNECT_TIMEOUT) {
    config.connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10);
  }

  // Retry configuration
  if (process.env.REDIS_MAX_RETRIES) {
    config.maxRetriesPerRequest = parseInt(process.env.REDIS_MAX_RETRIES, 10);
  }

  return config;
}

/**
 * Validate Redis configuration
 * 
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateRedisConfig(config: RedisConfig): void {
  if (!config || typeof config !== 'object') {
    throw new Error('Redis config must be an object');
  }

  if (!config.url || typeof config.url !== 'string') {
    throw new Error('Redis config must have a valid URL string');
  }

  // Validate URL format
  let url: URL;
  try {
    url = new URL(config.url);
  } catch (error) {
    throw new Error(`Invalid Redis URL: ${config.url}`);
  }

  // Validate protocol
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error(`Redis URL must use redis:// or rediss:// protocol, got: ${url.protocol}`);
  }

  // Validate host
  if (!url.hostname) {
    throw new Error('Redis URL must include a hostname');
  }

  // Validate port (default to 6379 if not specified)
  const port = url.port ? parseInt(url.port, 10) : 6379;
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Redis URL must have a valid port (1-65535), got: ${url.port}`);
  }
}
