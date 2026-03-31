#!/usr/bin/env node
/**
 * thought-loop.js - Structured thought generation from environmental deltas
 * 
 * Combines delta detection and thought generation into a unified skill.
 * Monitors file system, databases, external sources, and agent states
 * to generate meaningful thoughts with confidence scoring.
 * 
 * Usage:
 *   node thought-loop.js detect              # Detect changes
 *   node thought-loop.js generate --deltas   # Generate thoughts from deltas
 *   node thought-loop.js idle                # Generate idle thoughts
 *   node thought-loop.js run                 # Full thought loop cycle
 * 
 * Environment Variables:
 *   WORKSPACE_ROOT      - Root directory to monitor
 *   CURIOSITY_DIR       - Curiosity engine directory
 *   DELTA_STATE_FILE    - Delta detection state file
 *   AGENT_NAME          - Current agent name
 *   MAX_IDLE_THOUGHTS   - Max idle thoughts to generate
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const STATE_DIR = process.env.WORKSPACE_ROOT || process.cwd();
const CURIOUSITY_DIR = process.env.CURIOSITY_DIR || path.join(STATE_DIR, '.curiosity');
const LAST_STATE_FILE = process.env.DELTA_STATE_FILE || path.join(__dirname, 'thought-state.json');

// File patterns to monitor
const FILE_PATTERNS = ['*.md', '*.json', '*.js', '*.sh', '*.yaml', '*.yml'];

// Directories to monitor
const IMPORTANT_DIRS = ['', '/memory', '/skills', '/.curiosity', '/triad'];

/**
 * DeltaDetector - Detects changes from baseline
 */
class DeltaDetector {
    constructor() {
        this.lastState = this.loadLastState();
        this.currentState = {
            timestamp: null,
            files: {},
            db_hashes: {},
            external: {},
            agents: {}
        };
    }

    /**
     * Load last known state from file
     */
    loadLastState() {
        try {
            if (fs.existsSync(LAST_STATE_FILE)) {
                const data = fs.readFileSync(LAST_STATE_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load last state:', e.message);
        }
        return {
            timestamp: null,
            files: {},
            db_hashes: {},
            external: {},
            agents: {}
        };
    }

    /**
     * Save current state for next cycle
     */
    saveState() {
        try {
            const dir = path.dirname(LAST_STATE_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(LAST_STATE_FILE, JSON.stringify(this.currentState, null, 2));
        } catch (e) {
            console.error('Failed to save state:', e.message);
        }
    }

    /**
     * Main detection function - runs all detectors
     */
    async detect() {
        const deltas = [];

        // 1. Detect file system changes
        const fileDeltas = this.detectFileChanges();
        deltas.push(...fileDeltas);

        // 2. Detect database changes
        const dbDeltas = this.detectDbChanges();
        deltas.push(...dbDeltas);

        // 3. Detect external changes
        const externalDeltas = await this.detectExternalChanges();
        deltas.push(...externalDeltas);

        // 4. Detect agent state changes
        const agentDeltas = await this.detectAgentChanges();
        deltas.push(...agentDeltas);

        // Save current state
        this.currentState.timestamp = new Date().toISOString();
        this.saveState();

        return deltas;
    }

    /**
     * Detect file system changes
     */
    detectFileChanges() {
        const deltas = [];

        for (const dir of IMPORTANT_DIRS) {
            const dirPath = path.join(STATE_DIR, dir);
            if (!fs.existsSync(dirPath)) continue;

            try {
                let files = [];
                try {
                    const findOutput = execSync(
                        `find "${dirPath}" -type f \\( -name "*.md" -o -name "*.json" -o -name "*.js" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" \\) 2>/dev/null`,
                        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
                    );
                    files = findOutput.split('\n').filter(Boolean);
                } catch (e) {
                    files = this.getFilesRecursive(dirPath);
                }

                for (const file of files) {
                    try {
                        if (!file || !fs.existsSync(file)) continue;

                        const stat = fs.statSync(file);
                        const content = fs.readFileSync(file, 'utf8');
                        const hash = this.hash(content);
                        const lastHash = this.lastState.files?.[file]?.hash;

                        if (!lastHash) {
                            deltas.push({
                                type: 'file_created',
                                path: file,
                                timestamp: stat.mtime.toISOString(),
                                size: stat.size
                            });
                        } else if (lastHash !== hash) {
                            deltas.push({
                                type: 'file_modified',
                                path: file,
                                timestamp: stat.mtime.toISOString(),
                                size: stat.size
                            });
                        }

                        this.currentState.files = this.currentState.files || {};
                        this.currentState.files[file] = {
                            hash,
                            mtime: stat.mtime.toISOString(),
                            size: stat.size
                        };
                    } catch (e) {
                        // Skip inaccessible files
                    }
                }

                // Check for deleted files
                for (const lastFile of Object.keys(this.lastState.files || {})) {
                    if (!files.includes(lastFile) && fs.existsSync(path.dirname(lastFile))) {
                        deltas.push({
                            type: 'file_deleted',
                            path: lastFile,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

            } catch (e) {
                // Directory not accessible
            }
        }

        return deltas;
    }

    /**
     * Get files recursively (fallback for Windows)
     */
    getFilesRecursive(dirPath) {
        const files = [];

        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                if (item.isDirectory() && !item.name.startsWith('.')) {
                    files.push(...this.getFilesRecursive(fullPath));
                } else if (item.isFile()) {
                    const ext = path.extname(item.name);
                    if (['.md', '.json', '.js', '.sh', '.yaml', '.yml'].includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (e) {
            // Ignore permission errors
        }

        return files;
    }

    /**
     * Detect database changes
     */
    detectDbChanges() {
        const deltas = [];
        const dbFiles = [
            'curiosity_metrics.db',
            'consensus_ledger.db',
            'anomalies.db',
            'knowledge.db'
        ];

        for (const db of dbFiles) {
            const dbPath = path.join(CURIOSITY_DIR, db);
            if (!fs.existsSync(dbPath)) continue;

            try {
                const stat = fs.statSync(dbPath);
                const content = fs.readFileSync(dbPath);
                const hash = this.hash(content.toString('utf8'));
                const lastHash = this.lastState.db_hashes?.[db];

                if (lastHash !== hash) {
                    deltas.push({
                        type: 'db_modified',
                        database: db,
                        timestamp: stat.mtime.toISOString()
                    });
                }

                this.currentState.db_hashes = this.currentState.db_hashes || {};
                this.currentState.db_hashes[db] = hash;
            } catch (e) {
                // Skip inaccessible databases
            }
        }

        return deltas;
    }

    /**
     * Detect external changes
     */
    async detectExternalChanges() {
        const deltas = [];

        try {
            const lastCheck = this.lastState.external?.last_check || '1970-01-01';
            const now = new Date().toISOString();

            // Check for GitHub releases
            if (process.env.GITHUB_REPO) {
                try {
                    const response = execSync(
                        `curl -s "https://api.github.com/repos/${process.env.GITHUB_REPO}/releases" 2>/dev/null | head -100`,
                        { encoding: 'utf8' }
                    );
                    const releases = JSON.parse(response);
                    if (Array.isArray(releases) && releases.length > 0) {
                        const latest = releases[0];
                        if (this.lastState.external?.latest_release !== latest.tag_name) {
                            deltas.push({
                                type: 'external_release',
                                source: 'github',
                                repository: process.env.GITHUB_REPO,
                                release: latest.tag_name,
                                timestamp: latest.created_at
                            });
                        }
                        this.currentState.external = this.currentState.external || {};
                        this.currentState.external.latest_release = latest.tag_name;
                    }
                } catch (e) {
                    // GitHub API not available
                }
            }

            this.currentState.external = this.currentState.external || {};
            this.currentState.external.last_check = now;

        } catch (e) {
            // External check failed
        }

        return deltas;
    }

    /**
     * Detect agent state changes
     */
    async detectAgentChanges() {
        const deltas = [];

        try {
            const response = execSync(
                'curl -s http://localhost:8765/agents 2>/dev/null || echo "{}"',
                { encoding: 'utf8' }
            );
            const agents = JSON.parse(response);

            for (const [agent, state] of Object.entries(agents)) {
                const lastHeartbeat = this.lastState.agents?.[agent]?.last_heartbeat;
                const currentHeartbeat = state.last_heartbeat;

                if (lastHeartbeat !== currentHeartbeat) {
                    if (state.status === 'offline' && lastHeartbeat) {
                        deltas.push({
                            type: 'agent_offline',
                            agent: agent,
                            status: 'offline',
                            timestamp: currentHeartbeat || new Date().toISOString()
                        });
                    } else if (state.status === 'online' && !lastHeartbeat) {
                        deltas.push({
                            type: 'agent_online',
                            agent: agent,
                            status: 'online',
                            timestamp: currentHeartbeat || new Date().toISOString()
                        });
                    } else {
                        deltas.push({
                            type: 'agent_heartbeat',
                            agent: agent,
                            status: state.status,
                            timestamp: currentHeartbeat || new Date().toISOString()
                        });
                    }
                }
            }

            this.currentState.agents = agents;
        } catch (e) {
            // Triad-sync not available
        }

        return deltas;
    }

    /**
     * Simple hash function for content comparison
     */
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
}

/**
 * ThoughtGenerator - Generates thoughts from deltas
 */
class ThoughtGenerator {
    constructor(agentName) {
        this.agentName = agentName || 'unknown';
    }

    /**
     * Generate thoughts from deltas
     */
    generate(deltas) {
        const thoughts = [];

        for (const delta of deltas) {
            const thought = this.createThought(delta);
            if (thought) {
                thoughts.push(thought);
            }
        }

        return thoughts;
    }

    /**
     * Create a thought from a delta
     */
    createThought(delta) {
        const generators = {
            'file_created': this.thoughtFromFile.bind(this),
            'file_modified': this.thoughtFromFile.bind(this),
            'file_deleted': this.thoughtFromFile.bind(this),
            'db_modified': this.thoughtFromDb.bind(this),
            'external_cve': this.thoughtFromExternal.bind(this),
            'external_release': this.thoughtFromExternal.bind(this),
            'external_opportunity': this.thoughtFromExternal.bind(this),
            'agent_heartbeat': this.thoughtFromAgent.bind(this),
            'agent_offline': this.thoughtFromAgent.bind(this),
            'agent_online': this.thoughtFromAgent.bind(this)
        };

        const generator = generators[delta.type];
        if (generator) {
            return generator(delta);
        }

        return this.thoughtFromUnknown(delta);
    }

    /**
     * Generate thought from file delta
     */
    thoughtFromFile(delta) {
        const isNew = delta.type === 'file_created';
        const isDeleted = delta.type === 'file_deleted';
        const path = delta.path || 'unknown';
        const filename = path.split(/[/\\]/).pop();

        return {
            id: this.generateId(),
            type: isNew ? 'discovery' : (isDeleted ? 'alert' : 'update'),
            trigger: delta.type,
            subject: filename,
            observation: isNew
                ? `New file created: ${path}`
                : (isDeleted ? `File deleted: ${path}` : `File modified: ${path}`),
            implication: this.evaluateImplication(delta),
            recommendation: this.generateRecommendation(delta),
            confidence: isNew ? 0.7 : (isDeleted ? 0.8 : 0.6),
            timestamp: delta.timestamp || new Date().toISOString(),
            agent: this.agentName,
            metadata: {
                path: path,
                size: delta.size
            }
        };
    }

    /**
     * Generate thought from database delta
     */
    thoughtFromDb(delta) {
        return {
            id: this.generateId(),
            type: 'state_change',
            trigger: delta.type,
            subject: delta.database,
            observation: `Database modified: ${delta.database}`,
            implication: 'State change may affect collective decisions',
            recommendation: this.generateRecommendation(delta),
            confidence: 0.5,
            timestamp: delta.timestamp || new Date().toISOString(),
            agent: this.agentName,
            metadata: {
                database: delta.database
            }
        };
    }

    /**
     * Generate thought from external delta
     */
    thoughtFromExternal(delta) {
        const isCVE = delta.type === 'external_cve';
        const urgency = isCVE ? 'high' : 'medium';

        return {
            id: this.generateId(),
            type: 'external_awareness',
            trigger: delta.type,
            subject: delta.source || 'external',
            observation: isCVE
                ? `Security vulnerability detected: ${delta.cve || 'unknown'}`
                : `External event: ${delta.type} from ${delta.repository || 'unknown'}`,
            implication: isCVE
                ? 'Security implications for collective - requires immediate attention'
                : 'Potential opportunity or threat to evaluate',
            recommendation: isCVE
                ? 'trigger_deliberation'
                : 'broadcast_thought',
            confidence: isCVE ? 0.8 : 0.6,
            timestamp: delta.timestamp || new Date().toISOString(),
            agent: this.agentName,
            metadata: {
                source: delta.source,
                repository: delta.repository,
                release: delta.release
            }
        };
    }

    /**
     * Generate thought from agent delta
     */
    thoughtFromAgent(delta) {
        const isOffline = delta.type === 'agent_offline';
        const isOnline = delta.type === 'agent_online';

        return {
            id: this.generateId(),
            type: isOffline ? 'alert' : (isOnline ? 'status' : 'update'),
            trigger: delta.type,
            subject: delta.agent,
            observation: isOffline
                ? `Agent ${delta.agent} went offline`
                : (isOnline ? `Agent ${delta.agent} is now online` : `Agent ${delta.agent} status: ${delta.status}`),
            implication: isOffline
                ? 'Collective capacity reduced - failover may be needed'
                : (isOnline ? 'Collective capacity restored' : 'Agent status updated'),
            recommendation: isOffline
                ? 'trigger_failover_vote'
                : 'update_context',
            confidence: 0.9,
            timestamp: delta.timestamp || new Date().toISOString(),
            agent: this.agentName,
            metadata: {
                agent: delta.agent,
                status: delta.status
            }
        };
    }

    /**
     * Generate thought for unknown delta type
     */
    thoughtFromUnknown(delta) {
        return {
            id: this.generateId(),
            type: 'unknown',
            trigger: delta.type || 'unknown',
            subject: 'unknown',
            observation: `Unknown change: ${JSON.stringify(delta).substring(0, 100)}`,
            implication: 'Requires investigation',
            recommendation: 'log_for_review',
            confidence: 0.3,
            timestamp: delta.timestamp || new Date().toISOString(),
            agent: this.agentName
        };
    }

    /**
     * Evaluate implication based on delta properties
     */
    evaluateImplication(delta) {
        const path = delta.path || '';

        if (path.includes('PROPOSALS')) {
            return 'May affect active or pending proposals';
        }
        if (path.includes('MEMORY')) {
            return 'Collective memory updated';
        }
        if (path.includes('consensus')) {
            return 'Consensus state changed';
        }
        if (path.includes('SECURITY')) {
            return 'Security-related change detected';
        }
        if (path.includes('governance')) {
            return 'Governance parameter change';
        }
        if (path.includes('IMPLEMENTATIONS')) {
            return 'Implementation change - may affect execution';
        }

        return 'Standard change detected';
    }

    /**
     * Generate recommendation based on delta type
     */
    generateRecommendation(delta) {
        const recommendations = {
            'file_created': 'broadcast_thought',
            'file_modified': 'update_context',
            'file_deleted': 'trigger_deliberation',
            'db_modified': 'check_consensus',
            'external_cve': 'trigger_deliberation',
            'external_release': 'evaluate_update',
            'external_opportunity': 'broadcast_thought',
            'agent_offline': 'trigger_failover_vote',
            'agent_online': 'update_context',
            'agent_heartbeat': 'log_for_review'
        };

        return recommendations[delta.type] || 'log_for_review';
    }

    /**
     * Generate unique thought ID
     */
    generateId() {
        return `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate idle thoughts for reflection
     */
    generateIdleThoughts() {
        const thoughts = [];
        const maxThoughts = parseInt(process.env.MAX_IDLE_THOUGHTS) || 3;

        // Reflection on current goals
        thoughts.push({
            id: this.generateId(),
            type: 'reflection',
            trigger: 'idle',
            subject: 'goals',
            observation: 'Periodic self-reflection on active goals',
            implication: 'Ensures alignment with collective purpose',
            recommendation: 'review_active_proposals',
            confidence: 0.5,
            timestamp: new Date().toISOString(),
            agent: this.agentName
        });

        // Check for pending actions
        thoughts.push({
            id: this.generateId(),
            type: 'reflection',
            trigger: 'idle',
            subject: 'pending_actions',
            observation: 'Review of pending actions and their status',
            implication: 'Ensures nothing is overlooked',
            recommendation: 'check_pending_actions',
            confidence: 0.4,
            timestamp: new Date().toISOString(),
            agent: this.agentName
        });

        // System health check
        thoughts.push({
            id: this.generateId(),
            type: 'reflection',
            trigger: 'idle',
            subject: 'system_health',
            observation: 'Self-assessment of system health and capacity',
            implication: 'Maintains operational awareness',
            recommendation: 'log_for_review',
            confidence: 0.4,
            timestamp: new Date().toISOString(),
            agent: this.agentName
        });

        return thoughts.slice(0, maxThoughts);
    }
}

/**
 * ThoughtLoop - Combines delta detection and thought generation
 */
class ThoughtLoop {
    constructor(agentName) {
        this.agentName = agentName || process.env.AGENT_NAME || 'steward';
        this.detector = new DeltaDetector();
        this.generator = new ThoughtGenerator(this.agentName);
    }

    /**
     * Run full thought loop cycle
     */
    async run() {
        // Detect changes
        const deltas = await this.detector.detect();

        // Generate thoughts from changes
        const thoughts = this.generator.generate(deltas);

        // If no deltas, generate idle thoughts
        if (deltas.length === 0) {
            const idleThoughts = this.generator.generateIdleThoughts();
            thoughts.push(...idleThoughts);
        }

        return {
            deltas,
            thoughts,
            timestamp: new Date().toISOString(),
            agent: this.agentName
        };
    }

    /**
     * Detect changes only
     */
    async detect() {
        return await this.detector.detect();
    }

    /**
     * Generate thoughts from provided deltas
     */
    generate(deltas) {
        return this.generator.generate(deltas);
    }

    /**
     * Generate idle thoughts
     */
    idle() {
        return this.generator.generateIdleThoughts();
    }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    let deltas = [];
    let isIdle = false;
    let outputJson = false;
    let command = 'run';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--deltas' && args[i + 1]) {
            try {
                deltas = JSON.parse(args[i + 1]);
                i++;
            } catch (e) {
                // Invalid JSON
            }
        } else if (args[i] === '--idle' || args[i] === 'idle') {
            isIdle = true;
            command = 'idle';
        } else if (args[i] === '--agent' && args[i + 1]) {
            process.env.AGENT_NAME = args[i + 1];
            i++;
        } else if (args[i] === '--json' || args[i] === '-j') {
            outputJson = true;
        } else if (args[i] === 'detect') {
            command = 'detect';
        } else if (args[i] === 'generate') {
            command = 'generate';
        } else if (args[i] === 'run') {
            command = 'run';
        } else if (args[i] === 'help' || args[i] === '--help' || args[i] === '-h') {
            command = 'help';
        }
    }

    return { command, deltas, isIdle, outputJson };
}

/**
 * Main function
 */
async function main() {
    const { command, deltas, isIdle, outputJson } = parseArgs();
    const agentName = process.env.AGENT_NAME || 'steward';
    const loop = new ThoughtLoop(agentName);

    let result;

    switch (command) {
        case 'help':
            console.log(`
Thought Loop - Structured thought generation from environmental deltas

Usage:
  node thought-loop.js <command> [options]

Commands:
  run       Run full thought loop cycle (detect + generate)
  detect    Detect environmental changes only
  generate  Generate thoughts from provided deltas
  idle      Generate idle reflection thoughts
  help      Show this help message

Options:
  --deltas <json>   Provide deltas for generation
  --agent <name>    Set agent name
  --json, -j        Output as JSON

Examples:
  node thought-loop.js run
  node thought-loop.js detect --json
  node thought-loop.js generate --deltas '[{"type":"file_created","path":"./test.md"}]'
  node thought-loop.js idle --agent steward
`);
            return;

        case 'detect':
            result = await loop.detect();
            if (outputJson) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.error(`Detected ${result.length} deltas`);
                for (const delta of result) {
                    console.error(`  - ${delta.type}: ${delta.path || delta.database || delta.agent || delta.timestamp}`);
                }
            }
            return;

        case 'generate':
            if (deltas.length === 0) {
                console.error('No deltas provided. Use --deltas to provide JSON array.');
                process.exit(1);
            }
            result = loop.generate(deltas);
            if (outputJson) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.error(`Generated ${result.length} thoughts`);
                for (const thought of result) {
                    console.error(`  - [${thought.type}] ${thought.observation}`);
                }
            }
            return;

        case 'idle':
            result = loop.idle();
            if (outputJson) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.error(`Generated ${result.length} idle thoughts`);
                for (const thought of result) {
                    console.error(`  - [${thought.type}] ${thought.observation}`);
                }
            }
            return;

        case 'run':
        default:
            result = await loop.run();
            if (outputJson) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.error(`Thought Loop Results for ${agentName}:`);
                console.error(`  Deltas detected: ${result.deltas.length}`);
                console.error(`  Thoughts generated: ${result.thoughts.length}`);
                console.error(`  Timestamp: ${result.timestamp}`);
                for (const thought of result.thoughts) {
                    console.error(`  - [${thought.type}] ${thought.observation} (confidence: ${thought.confidence})`);
                }
            }
    }
}

// Export for programmatic use
module.exports = {
    ThoughtLoop,
    DeltaDetector,
    ThoughtGenerator
};

// Run if called directly
if (require.main === module) {
    main().catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
}
