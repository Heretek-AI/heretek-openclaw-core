/**
 * Heretek OpenClaw — State Inspector
 * ==============================================================================
 * Deep state inspection for OpenClaw agents and collectives.
 * 
 * Features:
 *   - Memory inspection (agent/collective)
 *   - Session state visualization
 *   - Consensus ledger audit
 *   - Workspace integrity check
 *   - State corruption detection
 * 
 * Usage:
 *   const StateInspector = require('./src/index');
 *   const inspector = new StateInspector({ workspaceRoot: '/app' });
 *   
 *   // Inspect agent memory
 *   const memory = await inspector.inspectMemory('steward');
 *   
 *   // Audit consensus ledger
 *   const audit = await inspector.auditLedger();
 *   
 *   // Scan for corruption
 *   const scan = await inspector.scanForCorruption();
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const MemoryInspector = require('./memory-inspector');
const LedgerAuditor = require('./ledger-auditor');
const WorkspaceChecker = require('./workspace-checker');

class StateInspector {
    constructor(config = {}) {
        this.workspaceRoot = config.workspaceRoot || process.env.OPENCLAW_ROOT || '/app';
        this.stateDir = config.stateDir || path.join(this.workspaceRoot, 'state');
        this.memoryDir = config.memoryDir || path.join(this.workspaceRoot, 'memory');
        this.collectiveDir = config.collectiveDir || path.join(this.workspaceRoot, 'collective');
        this.ledgerDir = config.ledgerDir || path.join(this.workspaceRoot, 'ledger');
        
        // Initialize sub-modules
        this.memoryInspector = new MemoryInspector({
            memoryDir: this.memoryDir,
            collectiveDir: this.collectiveDir
        });
        
        this.ledgerAuditor = new LedgerAuditor({
            ledgerDir: this.ledgerDir
        });
        
        this.workspaceChecker = new WorkspaceChecker({
            workspaceRoot: this.workspaceRoot
        });
        
        // Gateway connection
        this.gatewayUrl = config.gatewayUrl || process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
    }

    /**
     * Get state summary
     * @returns {Promise<Object>} State summary
     */
    async getSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            agents: {
                total: 0,
                active: 0,
                memoryUsage: 0
            },
            collective: {
                entries: 0,
                size: 0
            },
            ledger: {
                entries: 0,
                lastEntry: null
            },
            workspace: {
                integrity: 'unknown',
                issues: 0
            }
        };

        // Agent summary
        const agentSummary = await this.memoryInspector.getAgentSummary();
        summary.agents.total = agentSummary.total;
        summary.agents.active = agentSummary.active;
        summary.agents.memoryUsage = agentSummary.totalSize;

        // Collective summary
        const collectiveSummary = await this.memoryInspector.getCollectiveSummary();
        summary.collective.entries = collectiveSummary.entries;
        summary.collective.size = collectiveSummary.size;

        // Ledger summary
        const ledgerSummary = await this.ledgerAuditor.getSummary();
        summary.ledger.entries = ledgerSummary.totalEntries;
        summary.ledger.lastEntry = ledgerSummary.lastEntry;

        // Workspace summary
        const workspaceResult = await this.workspaceChecker.check();
        summary.workspace.integrity = result.integrity;
        summary.workspace.issues = result.issues?.length || 0;

        return summary;
    }

    /**
     * Inspect agent memory
     * @param {string} agentId - Agent identifier
     * @param {Object} options - Inspection options
     * @returns {Promise<Object>} Memory inspection result
     */
    async inspectMemory(agentId, options = {}) {
        return this.memoryInspector.inspect(agentId, options);
    }

    /**
     * Get session state
     * @param {Object} options - Session options
     * @returns {Promise<Object>} Session state
     */
    async getSessionState(options = {}) {
        return this.memoryInspector.getSessionState(options);
    }

    /**
     * Audit consensus ledger
     * @param {Object} options - Audit options
     * @returns {Promise<Object>} Audit result
     */
    async auditLedger(options = {}) {
        return this.ledgerAuditor.audit(options);
    }

    /**
     * Check workspace integrity
     * @param {Object} options - Check options
     * @returns {Promise<Object>} Integrity check result
     */
    async checkWorkspace(options = {}) {
        return this.workspaceChecker.check(options);
    }

    /**
     * Scan for corruption
     * @param {Object} options - Scan options
     * @returns {Promise<Object>} Scan result
     */
    async scanForCorruption(options = {}) {
        const { component = 'all', full = false } = options;
        const results = {
            timestamp: new Date().toISOString(),
            component: component,
            corruptionDetected: false,
            issues: [],
            recommendations: []
        };

        if (component === 'all' || component === 'memory') {
            const memoryScan = await this.memoryInspector.scanForCorruption();
            if (memoryScan.corruptionDetected) {
                results.corruptionDetected = true;
                results.issues.push(...memoryScan.issues);
            }
        }

        if (component === 'all' || component === 'ledger') {
            const ledgerScan = await this.ledgerAuditor.scanForCorruption();
            if (ledgerScan.corruptionDetected) {
                results.corruptionDetected = true;
                results.issues.push(...ledgerScan.issues);
            }
        }

        if (component === 'all' || component === 'workspace') {
            const workspaceScan = await this.workspaceChecker.scanForCorruption();
            if (workspaceScan.corruptionDetected) {
                results.corruptionDetected = true;
                results.issues.push(...workspaceScan.issues);
            }
        }

        // Generate recommendations
        if (results.corruptionDetected) {
            results.recommendations.push({
                priority: 'high',
                action: 'Run corruption-recovery skill to restore from backup',
                command: './scripts/recover.sh scan --full'
            });
        }

        return results;
    }

    /**
     * Export state for backup
     * @param {Object} options - Export options
     * @returns {Promise<Object>} Export result
     */
    async exportState(options = {}) {
        const { outputPath = '/tmp/state-export' } = options;
        
        // Ensure output directory exists
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const exportResult = {
            timestamp: new Date().toISOString(),
            outputPath: outputPath,
            components: {}
        };

        // Export memory
        try {
            const memoryExport = await this.memoryInspector.export(outputPath);
            exportResult.components.memory = memoryExport;
        } catch (error) {
            exportResult.components.memory = { error: error.message };
        }

        // Export ledger
        try {
            const ledgerExport = await this.ledgerAuditor.export(outputPath);
            exportResult.components.ledger = ledgerExport;
        } catch (error) {
            exportResult.components.ledger = { error: error.message };
        }

        // Export workspace state
        try {
            const workspaceExport = await this.workspaceChecker.export(outputPath);
            exportResult.components.workspace = workspaceExport;
        } catch (error) {
            exportResult.components.workspace = { error: error.message };
        }

        return exportResult;
    }
}

// CLI execution
if (require.main === module) {
    const { program } = require('commander');
    
    program
        .name('state-inspector')
        .description('Deep state inspection for OpenClaw')
        .version('1.0.0');
    
    program
        .command('memory')
        .description('Inspect agent memory')
        .option('--agent <id>', 'Agent ID')
        .option('--all', 'All agents')
        .option('--detailed', 'Detailed inspection')
        .option('--export <file>', 'Export to file')
        .action(async (options) => {
            const inspector = new StateInspector();
            
            if (options.all) {
                const result = await inspector.memoryInspector.getAllAgentsSummary();
                console.log(JSON.stringify(result, null, 2));
            } else if (options.agent) {
                const result = await inspector.inspectMemory(options.agent, { detailed: options.detailed });
                if (options.export) {
                    fs.writeFileSync(options.export, JSON.stringify(result, null, 2));
                    console.log(`Exported to: ${options.export}`);
                } else {
                    console.log(JSON.stringify(result, null, 2));
                }
            } else {
                console.log('Specify --agent or --all');
            }
        });
    
    program
        .command('session')
        .description('View session state')
        .option('--history', 'Include history')
        .option('--output <file>', 'Output file')
        .action(async (options) => {
            const inspector = new StateInspector();
            const result = await inspector.getSessionState({ includeHistory: options.history });
            
            if (options.output) {
                fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
                console.log(`Saved to: ${options.output}`);
            } else {
                console.log(JSON.stringify(result, null, 2));
            }
        });
    
    program
        .command('ledger')
        .description('Audit consensus ledger')
        .option('--verify', 'Verify integrity')
        .option('--search <pattern>', 'Search pattern')
        .option('--since <time>', 'Since time')
        .action(async (options) => {
            const inspector = new StateInspector();
            const result = await inspector.auditLedger({
                verify: options.verify,
                search: options.search,
                since: options.since
            });
            console.log(JSON.stringify(result, null, 2));
        });
    
    program
        .command('workspace')
        .description('Check workspace integrity')
        .option('--detailed', 'Detailed check')
        .option('--report <file>', 'Export report')
        .action(async (options) => {
            const inspector = new StateInspector();
            const result = await inspector.checkWorkspace({ detailed: options.detailed });
            
            if (options.report) {
                fs.writeFileSync(options.report, JSON.stringify(result, null, 2));
                console.log(`Report saved to: ${options.report}`);
            } else {
                console.log(JSON.stringify(result, null, 2));
            }
        });
    
    program
        .command('scan')
        .description('Scan for corruption')
        .option('--component <name>', 'Component (memory|ledger|workspace|all)')
        .option('--full', 'Full scan')
        .action(async (options) => {
            const inspector = new StateInspector();
            const result = await inspector.scanForCorruption({
                component: options.component || 'all',
                full: options.full
            });
            console.log(JSON.stringify(result, null, 2));
        });
    
    program
        .command('summary')
        .description('Get state summary')
        .action(async () => {
            const inspector = new StateInspector();
            const result = await inspector.getSummary();
            console.log(JSON.stringify(result, null, 2));
        });
    
    program.parse(process.argv);
}

module.exports = StateInspector;
