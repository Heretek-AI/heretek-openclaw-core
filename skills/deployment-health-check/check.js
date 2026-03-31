#!/usr/bin/env node

/**
 * Deployment Health Check
 * Checks the health status of all infrastructure services and agent workspaces
 * in The Collective deployment.
 * 
 * Updated for OpenClaw Gateway Architecture v2.1
 * - Agents run as workspaces within Gateway (port 18789)
 * - No longer checks individual container ports 8001-8011
 */

const TIMEOUT_MS = 5000;
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
  },
  openclaw_gateway: {
    name: 'OpenClaw Gateway',
    port: 18789,
    tcp: true,
    check: 'gateway'
  }
};

// Agent workspaces (not containers)
const AGENT_WORKSPACES = [
  'main',
  'steward',
  'alpha',
  'beta',
  'charlie',
  'examiner',
  'explorer',
  'sentinel',
  'coder',
  'dreamer',
  'empath',
  'historian'
];

const WORKSPACE_BASE = path.join(process.env.HOME || '/root', '.openclaw', 'agents');

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
 * Check OpenClaw Gateway status using CLI
 */
async function checkGatewayStatus() {
  const startTime = Date.now();
  
  try {
    // Try to run openclaw gateway status command
    execSync('openclaw gateway status', { 
      stdio: 'pipe',
      timeout: TIMEOUT_MS
    });
    
    const responseTime = Date.now() - startTime;
    return {
      status: 'healthy',
      responseTime,
      gatewayStatus: 'running'
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Gateway CLI not available, try TCP check
    const tcpResult = await checkTcpPort('OpenClaw Gateway', 18789, TIMEOUT_MS);
    
    if (tcpResult.status === 'healthy') {
      return {
        status: 'healthy',
        responseTime: tcpResult.responseTime,
        gatewayStatus: 'running (CLI not available)'
      };
    }
    
    return {
      status: 'unhealthy',
      responseTime,
      error: error.message
    };
  }
}

/**
 * Check agent workspace health
 */
async function checkAgentWorkspace(agentName) {
  const workspacePath = path.join(WORKSPACE_BASE, agentName);
  const startTime = Date.now();
  
  const result = {
    workspace: workspacePath,
    status: 'unknown'
  };
  
  try {
    // Check if workspace directory exists
    if (!fs.existsSync(workspacePath)) {
      result.status = 'missing';
      result.error = 'Workspace directory not found';
      result.responseTime = Date.now() - startTime;
      return result;
    }
    
    // Check for required workspace files
    const requiredFiles = ['config.json', 'state.json'];
    const missingFiles = [];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(workspacePath, file))) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      result.status = 'incomplete';
      result.missingFiles = missingFiles;
      result.responseTime = Date.now() - startTime;
      return result;
    }
    
    // Try to parse config.json to verify it's valid
    try {
      const configContent = fs.readFileSync(path.join(workspacePath, 'config.json'), 'utf8');
      JSON.parse(configContent);
    } catch (error) {
      result.status = 'corrupted';
      result.error = `Invalid config.json: ${error.message}`;
      result.responseTime = Date.now() - startTime;
      return result;
    }
    
    result.status = 'healthy';
    result.responseTime = Date.now() - startTime;
    return result;
    
  } catch (error) {
    result.status = 'error';
    result.error = error.message;
    result.responseTime = Date.now() - startTime;
    return result;
  }
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
    
    if (config.check === 'gateway') {
      result = await checkGatewayStatus();
    } else if (config.tcp) {
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

  // Check agent workspaces
  for (const agentName of AGENT_WORKSPACES) {
    const result = await checkAgentWorkspace(agentName);
    results.agents[agentName] = result;
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
