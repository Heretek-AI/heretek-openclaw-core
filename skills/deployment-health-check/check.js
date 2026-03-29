#!/usr/bin/env node

/**
 * Deployment Health Check
 * Checks the health status of all infrastructure services and agents
 * in The Collective deployment.
 */

const TIMEOUT_MS = 5000;

// Service configurations
const SERVICES = {
  litellm: {
    name: 'LiteLLM Gateway',
    url: 'http://localhost:4000/health',
    port: 4000
  },
  postgres: {
    name: 'PostgreSQL Database',
    url: 'http://localhost:5432',
    port: 5432,
    tcp: true
  },
  redis: {
    name: 'Redis Cache',
    url: 'http://localhost:6379',
    port: 6379,
    tcp: true
  },
  ollama: {
    name: 'Ollama LLM',
    url: 'http://localhost:11434/api/tags',
    port: 11434
  }
};

// Agent configurations (ports 8001-8011)
const AGENTS = {
  steward: { name: 'Steward', port: 8001 },
  alpha: { name: 'Alpha', port: 8002 },
  beta: { name: 'Beta', port: 8003 },
  charlie: { name: 'Charlie', port: 8004 },
  coder: { name: 'Coder', port: 8005 },
  dreamer: { name: 'Dreamer', port: 8006 },
  empath: { name: 'Empath', port: 8007 },
  examiner: { name: 'Examiner', port: 8008 },
  explorer: { name: 'Explorer', port: 8009 },
  historian: { name: 'Historian', port: 8010 },
  sentinel: { name: 'Sentinel', port: 8011 }
};

/**
 * Check HTTP service health
 */
async function checkHttpService(name, url, timeout = TIMEOUT_MS) {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok || response.status === 404) {
      // 404 is acceptable for some endpoints that may not have a dedicated health route
      return {
        status: 'healthy',
        responseTime,
        statusCode: response.status
      };
    } else {
      return {
        status: 'unhealthy',
        responseTime,
        statusCode: response.status,
        error: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      error: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

/**
 * Check TCP port availability (basic connection test)
 */
async function checkTcpPort(name, port, timeout = TIMEOUT_MS) {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    
    const timeoutId = setTimeout(() => {
      socket.destroy();
      resolve({
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: 'Connection timeout'
      });
    }, timeout);
    
    socket.connect(port, 'localhost', () => {
      clearTimeout(timeoutId);
      socket.destroy();
      resolve({
        status: 'healthy',
        responseTime: Date.now() - startTime
      });
    });
    
    socket.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.code === 'ECONNREFUSED' ? 'Connection refused' : error.message
      });
    });
  });
}

/**
 * Check agent health endpoint
 */
async function checkAgent(agentKey, config) {
  const url = `http://localhost:${config.port}/health`;
  const result = await checkHttpService(config.name, url);
  return {
    ...result,
    port: config.port
  };
}

/**
 * Main health check function
 */
async function runHealthCheck() {
  const timestamp = new Date().toISOString();
  const results = {
    timestamp,
    overall: 'healthy',
    services: {},
    agents: {},
    summary: {
      total: 0,
      healthy: 0,
      unhealthy: 0
    }
  };

  // Check infrastructure services
  for (const [key, config] of Object.entries(SERVICES)) {
    let result;
    if (config.tcp) {
      result = await checkTcpPort(config.name, config.port);
    } else {
      result = await checkHttpService(config.name, config.url);
    }
    results.services[key] = result;
    results.summary.total++;
    
    if (result.status === 'healthy') {
      results.summary.healthy++;
    } else {
      results.summary.unhealthy++;
      results.overall = 'unhealthy';
    }
  }

  // Check agents
  for (const [key, config] of Object.entries(AGENTS)) {
    const result = await checkAgent(key, config);
    results.agents[key] = result;
    results.summary.total++;
    
    if (result.status === 'healthy') {
      results.summary.healthy++;
    } else {
      results.summary.unhealthy++;
      results.overall = 'unhealthy';
    }
  }

  return results;
}

// Run the health check
runHealthCheck()
  .then((results) => {
    console.log(JSON.stringify(results, null, 2));
    
    // Exit with appropriate code
    if (results.overall === 'healthy') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      overall: 'error',
      error: error.message
    }, null, 2));
    process.exit(1);
  });
