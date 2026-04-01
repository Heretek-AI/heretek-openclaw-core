#!/usr/bin/env node
/**
 * Agent Lifecycle Manager - Main Entry Point
 * ==============================================================================
 * Unified agent lifecycle management for OpenClaw.
 * Provides CLI and programmatic interfaces for agent operations.
 */

const AgentController = require('./agent-controller');
const HealthMonitor = require('./health-monitor');

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        command: args[0],
        options: {}
    };
    
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
            result.options[key] = value;
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true;
            result.options[key] = value;
        } else {
            result.options.agents = arg;
        }
    }
    
    return result;
}

/**
 * Format status output
 * @param {Array<Object>} statuses - Agent statuses
 * @param {boolean} json - JSON output flag
 */
function formatStatus(statuses, json = false) {
    if (json) {
        console.log(JSON.stringify({ agents: statuses }, null, 2));
        return;
    }
    
    console.log('\n=== Agent Status Dashboard ===\n');
    console.log('AGENT'.padEnd(20), 'STATUS'.padEnd(12), 'HEALTH'.padEnd(12), 'TIMESTAMP');
    console.log('-'.repeat(70));
    
    for (const status of statuses) {
        const timestamp = status.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A';
        console.log(
            status.agentId.padEnd(20),
            status.status.padEnd(12),
            (status.health || 'N/A').padEnd(12),
            timestamp
        );
    }
    
    console.log('\n');
}

/**
 * Format health check output
 * @param {Array<Object>} results - Health check results
 * @param {boolean} json - JSON output flag
 */
function formatHealth(results, json = false) {
    if (json) {
        console.log(JSON.stringify({ health: results }, null, 2));
        return;
    }
    
    console.log('\n=== Agent Health Check ===\n');
    console.log('AGENT'.padEnd(20), 'OVERALL'.padEnd(10), 'GATEWAY'.padEnd(15), 'LITELLM'.padEnd(15));
    console.log('-'.repeat(70));
    
    for (const result of results) {
        const gwStatus = result.gateway.healthy ? `✓ ${result.gateway.latency}ms` : `✗ ${result.gateway.error || 'down'}`;
        const llmStatus = result.litellm.healthy ? `✓ ${result.litellm.latency}ms` : `✗ ${result.litellm.error || 'down'}`;
        
        console.log(
            result.agentId.padEnd(20),
            result.overall.padEnd(10),
            gwStatus.padEnd(15),
            llmStatus.padEnd(15)
        );
    }
    
    console.log('\n');
}

/**
 * Main CLI handler
 */
async function main() {
    const { command, options } = parseArgs();
    const controller = new AgentController();
    const monitor = new HealthMonitor();
    
    // Handle signals for clean shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down...');
        monitor.stopMonitoring();
        await monitor.disconnect();
        process.exit(0);
    });
    
    try {
        switch (command) {
            case 'status':
                {
                    const agents = options.agents ? options.agents.split(',') : null;
                    const statuses = [];
                    
                    if (agents) {
                        for (const agentId of agents) {
                            statuses.push(controller.getAgentStatus(agentId.trim()));
                        }
                    } else {
                        const allAgents = [
                            'steward', 'alpha', 'beta', 'gamma',
                            'scout', 'artisan', 'guardian',
                            'dreamer', 'knowledge-ingest'
                        ];
                        for (const agentId of allAgents) {
                            statuses.push(controller.getAgentStatus(agentId));
                        }
                    }
                    
                    formatStatus(statuses, options.json);
                }
                break;
                
            case 'start':
                {
                    const agents = options.agents ? options.agents.split(',') : null;
                    const verifyHealth = options['verify-health'] || options.verifyHealth;
                    
                    if (agents) {
                        for (const agentId of agents) {
                            const result = await controller.startAgent(agentId.trim(), {
                                waitForHealth: verifyHealth
                            });
                            console.log(JSON.stringify(result, null, 2));
                        }
                    } else {
                        console.log('Error: --agents required for start command');
                        process.exit(1);
                    }
                }
                break;
                
            case 'start-all':
                {
                    const verifyHealth = options['verify-health'] || options.verifyHealth;
                    const delay = parseInt(options.delay) || 1000;
                    
                    console.log('Starting all agents in dependency order...');
                    const results = await controller.startAll({
                        waitForHealth: verifyHealth,
                        delayBetweenAgents: delay
                    });
                    
                    const successCount = results.filter(r => r.success).length;
                    console.log(`\nStarted ${successCount}/${results.length} agents successfully`);
                    console.log(JSON.stringify(results, null, 2));
                }
                break;
                
            case 'stop':
                {
                    const agents = options.agents ? options.agents.split(',') : null;
                    
                    if (agents) {
                        for (const agentId of agents) {
                            const result = await controller.stopAgent(agentId.trim(), {
                                force: options.force
                            });
                            console.log(JSON.stringify(result, null, 2));
                        }
                    } else {
                        console.log('Error: --agents required for stop command');
                        process.exit(1);
                    }
                }
                break;
                
            case 'stop-all':
                {
                    const delay = parseInt(options.delay) || 1000;
                    
                    console.log('Stopping all agents in reverse dependency order...');
                    const results = await controller.stopAll({
                        delayBetweenAgents: delay,
                        force: options.force
                    });
                    
                    const successCount = results.filter(r => r.success).length;
                    console.log(`\nStopped ${successCount}/${results.length} agents successfully`);
                    console.log(JSON.stringify(results, null, 2));
                }
                break;
                
            case 'restart':
                {
                    const agents = options.agents ? options.agents.split(',') : null;
                    
                    if (agents) {
                        for (const agentId of agents) {
                            const result = await controller.restartAgent(agentId.trim());
                            console.log(JSON.stringify(result, null, 2));
                        }
                    } else {
                        console.log('Error: --agents required for restart command');
                        process.exit(1);
                    }
                }
                break;
                
            case 'restart-all':
                {
                    console.log('Restarting all agents (batch mode)...');
                    await controller.stopAll({ delayBetweenAgents: 1000 });
                    await controller.startAll({ delayBetweenAgents: 1000 });
                    console.log('\nRestart complete');
                }
                break;
                
            case 'rolling-restart':
                {
                    const delay = parseInt(options.delay) || 5000;
                    
                    console.log('Performing rolling restart...');
                    
                    controller.on('rolling:progress', (progress) => {
                        console.log(`[${progress.position}/${progress.total}] Restarting ${progress.agentId}...`);
                    });
                    
                    const results = await controller.rollingRestart({ delayBetweenAgents: delay });
                    
                    const successCount = results.filter(r => r.success).length;
                    console.log(`\nRolling restart complete: ${successCount}/${results.length} agents restarted`);
                    console.log(JSON.stringify(results, null, 2));
                }
                break;
                
            case 'health-check':
                {
                    console.log('Checking agent health...');
                    const results = await monitor.checkAllHealth();
                    formatHealth(results, options.json);
                }
                break;
                
            case 'monitor':
                {
                    const interval = parseInt(options.interval) || 30000;
                    const autoRestart = options['auto-restart'] || options.autoRestart;
                    
                    if (options.status) {
                        console.log(JSON.stringify(monitor.getStatus(), null, 2));
                        break;
                    }
                    
                    console.log(`Starting health monitor (interval: ${interval}ms, auto-restart: ${autoRestart})...`);
                    
                    monitor.on('monitor:started', (status) => {
                        console.log(`Monitor started: interval=${status.interval}ms, autoRestart=${status.autoRestart}`);
                    });
                    
                    monitor.on('agent:unhealthy', (result) => {
                        console.log(`[ALERT] Agent ${result.agentId} is ${result.overall}`);
                    });
                    
                    monitor.on('agent:auto-restarting', (info) => {
                        console.log(`[ACTION] Auto-restarting ${info.agentId} (attempt ${info.attempt})`);
                    });
                    
                    monitor.on('agent:max-restarts', (info) => {
                        console.log(`[WARNING] Agent ${info.agentId} exceeded max restarts (${info.count} in ${info.window}ms)`);
                    });
                    
                    await monitor.startMonitoring({ interval, autoRestart });
                    
                    // Keep running
                    console.log('Monitor running. Press Ctrl+C to stop.');
                }
                break;
                
            case 'health-history':
                {
                    const agentId = options.agent || options.agentId;
                    
                    if (agentId) {
                        const history = monitor.getHealthHistory(agentId);
                        console.log(JSON.stringify({ agent: agentId, history }, null, 2));
                    } else {
                        console.log('Error: --agent required for health-history command');
                        process.exit(1);
                    }
                }
                break;
                
            case 'dashboard':
                {
                    const statuses = [];
                    const allAgents = [
                        'steward', 'alpha', 'beta', 'gamma',
                        'scout', 'artisan', 'guardian',
                        'dreamer', 'knowledge-ingest'
                    ];
                    
                    for (const agentId of allAgents) {
                        statuses.push(controller.getAgentStatus(agentId));
                    }
                    
                    formatStatus(statuses, false);
                }
                break;
                
            default:
                console.log(`
Agent Lifecycle Manager

Usage: node index.js <command> [options]

Commands:
  status           Show agent status dashboard
  start            Start specific agents (--agents required)
  start-all        Start all agents in dependency order
  stop             Stop specific agents (--agents required)
  stop-all         Stop all agents in reverse dependency order
  restart          Restart specific agents (--agents required)
  restart-all      Restart all agents (batch mode)
  rolling-restart  Rolling restart for zero downtime
  health-check     Check health of all agents
  monitor          Start continuous health monitoring
  health-history   Show health history for an agent
  dashboard        Show full status dashboard

Options:
  --agents <ids>     Comma-separated agent IDs
  --json             Output in JSON format
  --verify-health    Wait for health check after start
  --force            Force stop (kill)
  --delay <ms>       Delay between agent operations
  --interval <ms>    Monitor check interval
  --auto-restart     Enable auto-restart for unhealthy agents
  --agent <id>       Single agent ID (for health-history)

Examples:
  node index.js status
  node index.js start-all --verify-health
  node index.js rolling-restart --delay 5000
  node index.js monitor --auto-restart --interval 30000
  node index.js dashboard
`);
                break;
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await monitor.disconnect();
    }
}

// Export for programmatic use
module.exports = {
    AgentController,
    HealthMonitor,
    main
};

// Run CLI if executed directly
if (require.main === module) {
    main();
}
