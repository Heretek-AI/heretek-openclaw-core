#!/usr/bin/env node

/**
 * Config Validator
 * Validates configuration files for consistency and completeness.
 */

const fs = require('fs');
const path = require('path');

// Expected agents
const EXPECTED_AGENTS = [
  'steward',
  'alpha',
  'beta',
  'charlie',
  'coder',
  'dreamer',
  'empath',
  'examiner',
  'explorer',
  'historian',
  'sentinel'
];

// Expected ports (8001-8011)
const EXPECTED_PORTS = EXPECTED_AGENTS.map((_, i) => 8001 + i);

// Base directory (relative to script location)
const BASE_DIR = path.resolve(__dirname, '..', '..');

/**
 * Read file contents safely
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(BASE_DIR, filePath), 'utf8');
  } catch (error) {
    return null;
  }
}

/**
 * Check if file exists
 */
function fileExists(filePath) {
  return fs.existsSync(path.join(BASE_DIR, filePath));
}

/**
 * Parse YAML (simple parser for docker-compose and litellm config)
 */
function parseYamlSimple(content) {
  const result = {
    services: {},
    otherKeys: []
  };
  
  if (!content) return result;
  
  const lines = content.split('\n');
  let currentService = null;
  let indent = 0;
  
  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;
    
    // Check for top-level service definitions
    const serviceMatch = line.match(/^(\s{2})([a-zA-Z0-9_-]+):\s*$/);
    if (serviceMatch && serviceMatch[1].length === 2) {
      currentService = serviceMatch[2];
      result.services[currentService] = {};
      continue;
    }
    
    // Check for nested properties under services
    if (currentService && line.includes(':')) {
      const propMatch = line.match(/^(\s+)([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (propMatch) {
        const key = propMatch[2].trim();
        const value = propMatch[3].trim();
        result.services[currentService][key] = value;
      }
    }
    
    // Track other top-level keys
    const topLevelMatch = line.match(/^([a-zA-Z0-9_-]+):\s*$/);
    if (topLevelMatch && !line.startsWith(' ')) {
      result.otherKeys.push(topLevelMatch[1]);
    }
  }
  
  return result;
}

/**
 * Validation 1: Docker Compose has all 11 agents
 */
function validateDockerComposeAgents() {
  const content = readFile('docker-compose.yml');
  
  if (!content) {
    return {
      status: 'failed',
      details: 'docker-compose.yml not found'
    };
  }
  
  const parsed = parseYamlSimple(content);
  const foundAgents = [];
  const missingAgents = [];
  
  for (const agent of EXPECTED_AGENTS) {
    // Check for agent service (might be named with -agent suffix or just agent name)
    const serviceName = `${agent}-agent`;
    if (parsed.services[serviceName] || parsed.services[agent]) {
      foundAgents.push(agent);
    } else {
      missingAgents.push(agent);
    }
  }
  
  if (missingAgents.length === 0) {
    return {
      status: 'passed',
      details: `All ${EXPECTED_AGENTS.length} agents configured`,
      found: foundAgents
    };
  } else {
    return {
      status: 'failed',
      details: `Missing agents: ${missingAgents.join(', ')}`,
      found: foundAgents,
      missing: missingAgents
    };
  }
}

/**
 * Validation 2: LiteLLM config has all agent endpoints
 */
function validateLiteLLMEndpoints() {
  const content = readFile('litellm_config.yaml');
  
  if (!content) {
    return {
      status: 'failed',
      details: 'litellm_config.yaml not found'
    };
  }
  
  const foundAgents = [];
  const missingAgents = [];
  
  // Check for each agent in the config
  for (const agent of EXPECTED_AGENTS) {
    // Look for agent references in the config
    const port = 8001 + EXPECTED_AGENTS.indexOf(agent);
    const patterns = [
      new RegExp(`agent.*${agent}`, 'i'),
      new RegExp(`localhost:${port}`),
      new RegExp(`${agent}:\\s*`),
      new RegExp(`model_name:\\s*${agent}`)
    ];
    
    const found = patterns.some(pattern => pattern.test(content));
    
    if (found) {
      foundAgents.push(agent);
    } else {
      missingAgents.push(agent);
    }
  }
  
  // Also check for model_list section
  const hasModelList = content.includes('model_list:');
  
  if (missingAgents.length === 0 || foundAgents.length >= EXPECTED_AGENTS.length - 2) {
    return {
      status: 'passed',
      details: `Found ${foundAgents.length}/${EXPECTED_AGENTS.length} agent endpoints`,
      found: foundAgents,
      hasModelList
    };
  } else {
    return {
      status: 'failed',
      details: `Missing endpoints for: ${missingAgents.join(', ')}`,
      found: foundAgents,
      missing: missingAgents
    };
  }
}

/**
 * Validation 3: Agent identity files exist
 */
function validateAgentIdentityFiles() {
  const found = [];
  const missing = [];
  
  for (const agent of EXPECTED_AGENTS) {
    const identityPath = path.join(BASE_DIR, 'agents', agent, 'IDENTITY.md');
    if (fs.existsSync(identityPath)) {
      found.push(agent);
    } else {
      missing.push(agent);
    }
  }
  
  if (missing.length === 0) {
    return {
      status: 'passed',
      details: `All ${EXPECTED_AGENTS.length} IDENTITY.md files exist`,
      found
    };
  } else {
    return {
      status: 'failed',
      details: `Missing IDENTITY.md for: ${missing.join(', ')}`,
      found,
      missing
    };
  }
}

/**
 * Validation 4: Port assignments are unique
 */
function validatePortAssignments() {
  const content = readFile('docker-compose.yml');
  
  if (!content) {
    return {
      status: 'failed',
      details: 'docker-compose.yml not found'
    };
  }
  
  const ports = [];
  const portPattern = /(\d{4,5}):\d+/g;
  let match;
  
  while ((match = portPattern.exec(content)) !== null) {
    ports.push(parseInt(match[1]));
  }
  
  // Check for duplicates
  const uniquePorts = [...new Set(ports)];
  const duplicates = ports.filter((port, index) => ports.indexOf(port) !== index);
  
  // Check for expected agent ports
  const agentPorts = ports.filter(p => p >= 8001 && p <= 8011);
  const missingPorts = EXPECTED_PORTS.filter(p => !agentPorts.includes(p));
  
  if (duplicates.length === 0 && missingPorts.length === 0) {
    return {
      status: 'passed',
      details: `All port assignments unique, all agent ports present`,
      ports: uniquePorts.sort((a, b) => a - b)
    };
  } else if (duplicates.length > 0) {
    return {
      status: 'failed',
      details: `Duplicate ports found: ${[...new Set(duplicates)].join(', ')}`,
      ports: uniquePorts.sort((a, b) => a - b)
    };
  } else {
    return {
      status: 'failed',
      details: `Missing agent ports: ${missingPorts.join(', ')}`,
      ports: uniquePorts.sort((a, b) => a - b),
      missingPorts
    };
  }
}

/**
 * Validation 5: Environment variables are complete
 */
function validateEnvironmentVariables() {
  const envExample = readFile('.env.example');
  
  if (!envExample) {
    return {
      status: 'failed',
      details: '.env.example not found'
    };
  }
  
  const requiredVars = [
    'POSTGRES',
    'REDIS',
    'OLLAMA',
    'LITELLM',
    'DATABASE_URL'
  ];
  
  const found = [];
  const missing = [];
  
  for (const varName of requiredVars) {
    if (envExample.includes(varName)) {
      found.push(varName);
    } else {
      missing.push(varName);
    }
  }
  
  // Also check for optional but recommended vars
  const recommendedVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SECRET'];
  const recommendedFound = recommendedVars.filter(v => envExample.includes(v));
  
  if (missing.length === 0) {
    return {
      status: 'passed',
      details: `All required environment variables defined`,
      found,
      recommendedFound
    };
  } else {
    return {
      status: 'failed',
      details: `Missing required variables: ${missing.join(', ')}`,
      found,
      missing
    };
  }
}

/**
 * Validation 6: User schema is valid JSON
 */
function validateUserSchema() {
  const content = readFile('users/_schema.json');
  
  if (!content) {
    return {
      status: 'failed',
      details: 'users/_schema.json not found'
    };
  }
  
  try {
    const schema = JSON.parse(content);
    
    // Check for basic schema structure
    const hasProperties = schema.properties || schema.fields || schema.type;
    
    if (hasProperties) {
      return {
        status: 'passed',
        details: 'Valid JSON schema structure',
        hasProperties: true
      };
    } else {
      return {
        status: 'passed',
        details: 'Valid JSON (schema structure may vary)',
        hasProperties: false
      };
    }
  } catch (error) {
    return {
      status: 'failed',
      details: `Invalid JSON: ${error.message}`
    };
  }
}

/**
 * Main validation runner
 */
async function runValidations() {
  const timestamp = new Date().toISOString();
  const results = {
    timestamp,
    overall: 'passed',
    validations: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  // Run all validations
  const validations = [
    { name: 'docker_compose_agents', fn: validateDockerComposeAgents },
    { name: 'litellm_endpoints', fn: validateLiteLLMEndpoints },
    { name: 'agent_identity_files', fn: validateAgentIdentityFiles },
    { name: 'port_assignments', fn: validatePortAssignments },
    { name: 'environment_variables', fn: validateEnvironmentVariables },
    { name: 'user_schema', fn: validateUserSchema }
  ];

  for (const validation of validations) {
    try {
      const result = validation.fn();
      results.validations[validation.name] = result;
      results.summary.total++;
      
      if (result.status === 'passed') {
        results.summary.passed++;
      } else {
        results.summary.failed++;
        results.overall = 'failed';
      }
    } catch (error) {
      results.validations[validation.name] = {
        status: 'failed',
        details: error.message
      };
      results.summary.total++;
      results.summary.failed++;
      results.overall = 'failed';
    }
  }

  return results;
}

// Run the validations
runValidations()
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
