#!/usr/bin/env node
/**
 * Gateway Pulse - Main Entry Point
 * ==============================================================================
 * Continuous monitoring for OpenClaw Gateway and LiteLLM services.
 * Provides health dashboards, alerts, and metrics export.
 */

const GatewayMonitor = require('./gateway-monitor');
const LiteLLMMonitor = require('./litellm-monitor');
const { AlertManager, AlertSeverity, AlertType } = require('./alert-manager');

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
        }
    }

    return result;
}

/**
 * Format status for display
 * @param {Object} status - Status data
 */
function formatStatus(status) {
    console.log('\n=== Gateway Pulse Status ===\n');

    // Gateway status
    if (status.gateway) {
        console.log('Gateway:');
        console.log(`  URL:      ${status.gateway.url}`);
        console.log(`  Healthy:  ${status.gateway.healthy ? '✓ Yes' : '✗ No'}`);
        console.log(`  Latency:  ${status.gateway.latency ? `${status.gateway.latency}ms` : 'N/A'}`);
        console.log(`  WebSocket: ${status.gateway.wsConnected ? 'Connected' : 'Disconnected'}`);
    }

    // LiteLLM status
    if (status.litellm) {
        console.log('\nLiteLLM:');
        console.log(`  URL:      ${status.litellm.url}`);
        console.log(`  Healthy:  ${status.litellm.healthy ? '✓ Yes' : '✗ No'}`);
        console.log(`  Latency:  ${status.litellm.latency ? `${status.litellm.latency}ms` : 'N/A'}`);
        console.log(`  Models:   ${status.litellm.modelCount || 'N/A'}`);
    }

    // Alert summary
    if (status.alerts) {
        console.log('\nAlerts:');
        console.log(`  Active:     ${status.alerts.active}`);
        console.log(`  Critical:   ${status.alerts.critical}`);
        console.log(`  Warning:    ${status.alerts.warning}`);
    }

    console.log('\n');
}

/**
 * Format dashboard for display
 * @param {Object} dashboard - Dashboard data
 */
function formatDashboard(dashboard) {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              GATEWAY PULSE DASHBOARD                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Service status
    console.log('=== Service Status ===\n');
    console.log('SERVICE'.padEnd(15), 'STATUS'.padEnd(10), 'LATENCY'.padEnd(12), 'UPTIME');
    console.log('-'.repeat(50));

    for (const service of dashboard.services) {
        const status = service.healthy ? '✓ Healthy' : '✗ Down';
        const latency = service.latency ? `${service.latency}ms` : 'N/A';
        console.log(service.name.padEnd(15), status.padEnd(10), latency.padEnd(12), service.uptime || 'N/A');
    }

    // Alert summary
    console.log('\n=== Alert Summary ===\n');
    console.log(`Active:     ${dashboard.alerts.active}`);
    console.log(`Critical:   ${dashboard.alerts.critical}`);
    console.log(`Warning:    ${dashboard.alerts.warning}`);
    console.log(`Last Hour:  ${dashboard.alerts.lastHour}`);

    // Recent alerts
    if (dashboard.recentAlerts && dashboard.recentAlerts.length > 0) {
        console.log('\n=== Recent Alerts ===\n');
        for (const alert of dashboard.recentAlerts.slice(0, 5)) {
            const severity = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
            console.log(`${severity} [${new Date(alert.timestamp).toLocaleTimeString()}] ${alert.message}`);
        }
    }

    console.log('\n');
}

/**
 * Format Prometheus metrics
 * @param {Object} metrics - Metrics data
 */
function formatPrometheusMetrics(metrics) {
    const lines = [];
    const timestamp = Date.now();

    // Gateway metrics
    lines.push('# HELP gateway_health Gateway health status (1=healthy, 0=unhealthy)');
    lines.push('# TYPE gateway_health gauge');
    lines.push(`gateway_health ${metrics.gateway?.healthy ? 1 : 0}`);

    if (metrics.gateway?.latency) {
        lines.push('# HELP gateway_latency_ms Gateway response latency in milliseconds');
        lines.push('# TYPE gateway_latency_ms gauge');
        lines.push(`gateway_latency_ms ${metrics.gateway.latency}`);
    }

    // LiteLLM metrics
    lines.push('# HELP litellm_health LiteLLM health status (1=healthy, 0=unhealthy)');
    lines.push('# TYPE litellm_health gauge');
    lines.push(`litellm_health ${metrics.litellm?.healthy ? 1 : 0}`);

    if (metrics.litellm?.latency) {
        lines.push('# HELP litellm_latency_ms LiteLLM response latency in milliseconds');
        lines.push('# TYPE litellm_latency_ms gauge');
        lines.push(`litellm_latency_ms ${metrics.litellm.latency}`);
    }

    if (metrics.litellm?.modelCount !== undefined) {
        lines.push('# HELP litellm_models_count Number of available models');
        lines.push('# TYPE litellm_models_count gauge');
        lines.push(`litellm_models_count ${metrics.litellm.modelCount}`);
    }

    // Alert metrics
    lines.push('# HELP alerts_active_count Number of active alerts');
    lines.push('# TYPE alerts_active_count gauge');
    lines.push(`alerts_active_count ${metrics.alerts?.active || 0}`);

    lines.push('# HELP alerts_critical_count Number of critical alerts');
    lines.push('# TYPE alerts_critical_count gauge');
    lines.push(`alerts_critical_count ${metrics.alerts?.critical || 0}`);

    return lines.join('\n');
}

/**
 * Main CLI handler
 */
async function main() {
    const { command, options } = parseArgs();

    const gatewayMonitor = new GatewayMonitor({
        gatewayHost: options.host || '127.0.0.1',
        gatewayPort: parseInt(options.port) || 18789,
        timeout: parseInt(options.timeout) || 5000
    });

    const litellmMonitor = new LiteLLMMonitor({
        litellmHost: options.litellmHost || 'litellm',
        litellmPort: parseInt(options.litellmPort) || 4000,
        apiKey: options.apiKey || process.env.LITELLM_API_KEY || '',
        timeout: parseInt(options.timeout) || 5000
    });

    const alertManager = new AlertManager({
        autoRemediate: options['auto-remediate'] || options.autoRemediate,
        thresholds: {
            latency: {
                warning: parseInt(options.warning) || 5000,
                critical: parseInt(options.critical) || 10000
            }
        }
    });

    let monitorInterval = null;

    try {
        switch (command) {
            case 'status':
                {
                    const service = options.service || 'all';

                    const status = {
                        gateway: null,
                        litellm: null,
                        alerts: alertManager.getSummary()
                    };

                    if (service === 'all' || service === 'gateway') {
                        const gwHealth = await gatewayMonitor.checkHttpHealth();
                        const wsStatus = gatewayMonitor.getWebSocketStatus();
                        status.gateway = {
                            url: gatewayMonitor.gatewayUrl,
                            healthy: gwHealth.healthy,
                            latency: gwHealth.latency,
                            wsConnected: wsStatus.connected
                        };
                    }

                    if (service === 'all' || service === 'litellm') {
                        const llmHealth = await litellmMonitor.checkHealth();
                        const models = await litellmMonitor.checkModels();
                        status.litellm = {
                            url: litellmMonitor.litellmUrl,
                            healthy: llmHealth.healthy,
                            latency: llmHealth.latency,
                            modelCount: models.modelCount
                        };
                    }

                    if (options.json) {
                        console.log(JSON.stringify(status, null, 2));
                    } else {
                        formatStatus(status);
                    }
                }
                break;

            case 'monitor':
                {
                    const interval = parseInt(options.interval) || 30000;
                    const autoRemediate = options['auto-remediate'] || options.autoRemediate;

                    alertManager.setAutoRemediate(!!autoRemediate);

                    console.log(`Starting Gateway Pulse monitor (interval: ${interval}ms)`);
                    console.log(`Auto-remediation: ${autoRemediate ? 'enabled' : 'disabled'}`);
                    console.log('Press Ctrl+C to stop.\n');

                    // Alert handlers
                    alertManager.on('alert:generated', (alert) => {
                        const icon = alert.severity === 'critical' ? '🔴' : '🟡';
                        console.log(`${icon} [ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
                    });

                    alertManager.on('remediation:triggered', (remediation) => {
                        console.log(`[REMEDIATE] Triggering remediation for ${remediation.alertType}`);
                    });

                    // Monitoring function
                    const runCheck = async () => {
                        try {
                            const gwHealth = await gatewayMonitor.checkHttpHealth();
                            const llmHealth = await litellmMonitor.checkHealth();

                            // Check thresholds and generate alerts
                            alertManager.checkThresholds({
                                service: 'gateway',
                                ...gwHealth
                            });

                            alertManager.checkThresholds({
                                service: 'litellm',
                                ...llmHealth
                            });

                            // Status output
                            const gwIcon = gwHealth.healthy ? '✓' : '✗';
                            const llmIcon = llmHealth.healthy ? '✓' : '✗';
                            console.log(`[${new Date().toISOString()}] Gateway: ${gwIcon} (${gwHealth.latency}ms) | LiteLLM: ${llmIcon} (${llmHealth.latency}ms)`);

                        } catch (error) {
                            console.error('[ERROR] Health check failed:', error.message);
                        }
                    };

                    // Initial check
                    await runCheck();

                    // Schedule periodic checks
                    monitorInterval = setInterval(runCheck, interval);
                    break;
                }

            case 'metrics':
                {
                    const gwMetrics = await gatewayMonitor.getMetrics();
                    const llmMetrics = await litellmMonitor.getMetrics();
                    const alertSummary = alertManager.getSummary();

                    const metrics = {
                        gateway: {
                            healthy: gwMetrics.available,
                            latency: null
                        },
                        litellm: {
                            healthy: llmMetrics.available,
                            latency: null,
                            modelCount: null
                        },
                        alerts: alertSummary
                    };

                    if (options.export || options.format === 'prometheus') {
                        console.log(formatPrometheusMetrics(metrics));
                    } else if (options.json) {
                        console.log(JSON.stringify(metrics, null, 2));
                    } else {
                        console.log('Gateway Metrics:', gwMetrics.available ? 'Available' : 'Unavailable');
                        console.log('LiteLLM Metrics:', llmMetrics.available ? 'Available' : 'Unavailable');
                    }
                }
                break;

            case 'alerts':
                {
                    if (options.config) {
                        console.log('Alert Configuration:');
                        console.log(JSON.stringify(alertManager.getSummary().thresholds, null, 2));
                    } else if (options.history) {
                        const history = alertManager.getHistory(50);
                        console.log('Alert History (last 50):');
                        console.log(JSON.stringify(history, null, 2));
                    } else if (options.set) {
                        const newThresholds = {};
                        if (options.warning) {
                            newThresholds.latency = {
                                warning: parseInt(options.warning),
                                critical: alertManager.thresholds.latency.critical
                            };
                        }
                        if (options.critical) {
                            newThresholds.latency = {
                                warning: alertManager.thresholds.latency.warning,
                                critical: parseInt(options.critical)
                            };
                        }
                        if (Object.keys(newThresholds).length > 0) {
                            alertManager.updateThresholds(newThresholds);
                            console.log('Thresholds updated:', JSON.stringify(newThresholds, null, 2));
                        }
                    } else {
                        const summary = alertManager.getSummary();
                        console.log('Alert Summary:');
                        console.log(JSON.stringify(summary, null, 2));
                    }
                }
                break;

            case 'dashboard':
                {
                    const gwHealth = await gatewayMonitor.checkHttpHealth();
                    const llmHealth = await litellmMonitor.checkHealth();
                    const alertSummary = alertManager.getSummary();
                    const recentAlerts = alertManager.getHistory(10);

                    const dashboard = {
                        services: [
                            {
                                name: 'Gateway',
                                healthy: gwHealth.healthy,
                                latency: gwHealth.latency,
                                uptime: 'N/A'
                            },
                            {
                                name: 'LiteLLM',
                                healthy: llmHealth.healthy,
                                latency: llmHealth.latency,
                                uptime: 'N/A'
                            }
                        ],
                        alerts: alertSummary,
                        recentAlerts
                    };

                    formatDashboard(dashboard);
                }
                break;

            case 'watch':
                {
                    const interval = parseInt(options.interval) || 5000;

                    console.log('Starting watch mode...\n');

                    const watch = async () => {
                        const gwHealth = await gatewayMonitor.checkHttpHealth();
                        const llmHealth = await litellmMonitor.checkHealth();

                        // Clear screen and show status
                        console.clear();
                        console.log(`Gateway Pulse Watch - ${new Date().toISOString()}`);
                        console.log('='.repeat(50));
                        console.log(`Gateway:  ${gwHealth.healthy ? '✓' : '✗'} ${gwHealth.latency}ms`);
                        console.log(`LiteLLM:  ${llmHealth.healthy ? '✓' : '✗'} ${llmHealth.latency}ms`);
                        console.log('='.repeat(50));
                    };

                    await watch();
                    monitorInterval = setInterval(watch, interval);
                    break;
                }

            default:
                console.log(`
Gateway Pulse - Gateway and LiteLLM Monitoring

Usage: node index.js <command> [options]

Commands:
  status       Show current status
  monitor      Start continuous monitoring
  metrics      Export metrics (Prometheus format)
  alerts       Manage alerts
  dashboard    Show health dashboard
  watch        Real-time watch mode

Options:
  --service <svc>    Service to check (gateway, litellm, all)
  --interval <ms>    Monitor interval in milliseconds
  --timeout <ms>     Request timeout in milliseconds
  --warning <ms>     Warning latency threshold
  --critical <ms>    Critical latency threshold
  --auto-remediate   Enable auto-remediation
  --json             Output in JSON format
  --export           Export metrics
  --format <fmt>     Metrics format (prometheus)
  --host <host>      Gateway host
  --port <port>      Gateway port
  --litellm-host     LiteLLM host
  --litellm-port     LiteLLM port
  --api-key          LiteLLM API key

Examples:
  node index.js status
  node index.js monitor --interval 30000 --auto-remediate
  node index.js metrics --export --format prometheus
  node index.js dashboard
  node index.js watch --interval 5000
`);
                break;
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        if (monitorInterval) {
            clearInterval(monitorInterval);
        }
        gatewayMonitor.disconnect();
    }
}

// Export for programmatic use
module.exports = {
    GatewayMonitor,
    LiteLLMMonitor,
    AlertManager,
    main
};

// Run CLI if executed directly
if (require.main === module) {
    main();
}
