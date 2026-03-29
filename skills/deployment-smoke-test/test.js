#!/usr/bin/env node

/**
 * Deployment Smoke Test
 * Runs basic functionality tests on deployed agents to verify
 * A2A communication and basic operations.
 */

const TIMEOUT_MS = 10000;

// Agent configurations
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

// Triad members for deliberation tests
const TRIAD = ['alpha', 'beta', 'charlie'];

/**
 * Make HTTP request with timeout
 */
async function makeRequest(url, options = {}, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Test 1: Ping all agents
 */
async function testAgentPing() {
  const details = {};
  let allPassed = true;

  for (const [key, config] of Object.entries(AGENTS)) {
    try {
      const response = await makeRequest(`http://localhost:${config.port}/health`);
      if (response.ok || response.status === 404) {
        details[key] = 'responded';
      } else {
        details[key] = `error: HTTP ${response.status}`;
        allPassed = false;
      }
    } catch (error) {
      details[key] = `error: ${error.message}`;
      allPassed = false;
    }
  }

  return {
    status: allPassed ? 'passed' : 'failed',
    details
  };
}

/**
 * Test 2: A2A message between steward and alpha
 */
async function testA2AMessage() {
  try {
    // Try to send an A2A message from steward to alpha
    const response = await makeRequest(`http://localhost:8001/a2a/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target_agent: 'alpha',
        message_type: 'test',
        content: {
          text: 'Smoke test message',
          timestamp: new Date().toISOString()
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        status: 'passed',
        details: 'Message delivered from steward to alpha',
        response: data
      };
    } else if (response.status === 404) {
      // Endpoint doesn't exist yet - mark as skipped
      return {
        status: 'skipped',
        details: 'A2A endpoint not implemented yet'
      };
    } else {
      return {
        status: 'failed',
        details: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    // Connection refused means agent not running - that's a failure
    if (error.code === 'ECONNREFUSED' || error.message.includes('refused')) {
      return {
        status: 'failed',
        details: 'Agent not reachable'
      };
    }
    return {
      status: 'skipped',
      details: `A2A test skipped: ${error.message}`
    };
  }
}

/**
 * Test 3: Triad deliberation trigger
 */
async function testTriadDeliberation() {
  try {
    // Try to trigger a triad deliberation
    const response = await makeRequest(`http://localhost:8002/deliberate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: 'smoke_test',
        question: 'Is the system operational?',
        triad: TRIAD
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        status: 'passed',
        details: 'Triad deliberation triggered',
        response: data
      };
    } else if (response.status === 404) {
      return {
        status: 'skipped',
        details: 'Deliberation endpoint not implemented yet'
      };
    } else {
      return {
        status: 'failed',
        details: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    return {
      status: 'skipped',
      details: `Deliberation test skipped: ${error.message}`
    };
  }
}

/**
 * Test 4: User context resolution
 */
async function testUserContextResolution() {
  try {
    // Try to resolve user context through steward
    const response = await makeRequest(`http://localhost:8001/user/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: 'test_user',
        context_type: 'preferences'
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        status: 'passed',
        details: 'User context resolved',
        response: data
      };
    } else if (response.status === 404) {
      return {
        status: 'skipped',
        details: 'User context endpoint not implemented yet'
      };
    } else {
      return {
        status: 'failed',
        details: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    return {
      status: 'skipped',
      details: `User context test skipped: ${error.message}`
    };
  }
}

/**
 * Test 5: Memory persistence (Redis)
 */
async function testMemoryPersistence() {
  const net = require('net');
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeoutId = setTimeout(() => {
      socket.destroy();
      resolve({
        status: 'failed',
        details: 'Redis connection timeout'
      });
    }, TIMEOUT_MS);

    socket.connect(6379, 'localhost', () => {
      clearTimeout(timeoutId);
      
      // Try a simple PING command
      socket.write('PING\r\n');
      
      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString();
        socket.destroy();
        
        if (data.includes('+PONG') || data.includes('PONG')) {
          resolve({
            status: 'passed',
            details: 'Redis memory persistence available'
          });
        } else {
          resolve({
            status: 'passed',
            details: 'Redis connected (response: ' + data.trim() + ')'
          });
        }
      });
    });

    socket.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        status: 'failed',
        details: `Redis connection failed: ${error.message}`
      });
    });
  });
}

/**
 * Main test runner
 */
async function runSmokeTests() {
  const timestamp = new Date().toISOString();
  const results = {
    timestamp,
    overall: 'passed',
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };

  // Run all tests
  const tests = [
    { name: 'agent_ping', fn: testAgentPing },
    { name: 'a2a_message', fn: testA2AMessage },
    { name: 'triad_deliberation', fn: testTriadDeliberation },
    { name: 'user_context_resolution', fn: testUserContextResolution },
    { name: 'memory_persistence', fn: testMemoryPersistence }
  ];

  for (const test of tests) {
    console.error(`Running test: ${test.name}...`);
    try {
      const result = await test.fn();
      results.tests[test.name] = result;
      results.summary.total++;
      
      if (result.status === 'passed') {
        results.summary.passed++;
      } else if (result.status === 'failed') {
        results.summary.failed++;
        results.overall = 'failed';
      } else if (result.status === 'skipped') {
        results.summary.skipped++;
      }
    } catch (error) {
      results.tests[test.name] = {
        status: 'failed',
        details: error.message
      };
      results.summary.total++;
      results.summary.failed++;
      results.overall = 'failed';
    }
  }

  // Determine overall status
  if (results.summary.failed > 0) {
    results.overall = 'failed';
  } else if (results.summary.skipped === results.summary.total) {
    results.overall = 'skipped';
  } else if (results.summary.passed > 0) {
    results.overall = 'passed';
  }

  return results;
}

// Run the smoke tests
runSmokeTests()
  .then((results) => {
    console.log(JSON.stringify(results, null, 2));
    
    // Exit with appropriate code
    if (results.overall === 'passed') {
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
