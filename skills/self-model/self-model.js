#!/usr/bin/env node
/**
 * self-model.js - Meta-cognitive self-awareness for agents
 * 
 * Provides meta-cognition capabilities, enabling the agent to understand
 * its own capabilities, limitations, and cognitive state.
 * 
 * Maintains:
 * - capabilities: What the agent can do
 * - knowledge: What the agent knows
 * - workingOn: Current active tasks
 * - confidence: Reasoning confidence levels
 * - cognitiveState: Current thinking state
 * - blindSpots: Known unknowns
 * - metrics: Activity tracking
 * 
 * Usage:
 *   node self-model.js --capabilities
 *   node self-model.js --confidence
 *   node self-model.js --state
 *   node self-model.js --summary
 *   node self-model.js --json
 * 
 * Environment Variables:
 *   SELF_MODEL_FILE - State file location
 *   AGENT_NAME      - Agent name
 */

const fs = require('fs');
const path = require('path');

// Configuration
const STATE_FILE = process.env.SELF_MODEL_FILE || path.join(__dirname, 'self-model-state.json');

/**
 * SelfModel - Meta-cognitive self-awareness class
 */
class SelfModel {
    /**
     * Create a new self-model for an agent
     * @param {string} agentName - Name of the agent
     */
    constructor(agentName) {
        this.agentName = agentName || process.env.AGENT_NAME || 'unknown';
        this.model = this.load();
    }

    /**
     * Load self-model from file or initialize new
     * @returns {Object} The self-model data
     */
    load() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = fs.readFileSync(STATE_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('[SelfModel] Failed to load self-model:', e.message);
        }

        return this.initialize();
    }

    /**
     * Initialize a new self-model with default values
     * @returns {Object} Default model structure
     */
    initialize() {
        return {
            agent: this.agentName,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            capabilities: {
                available: [],
                active: [],
                learning: [],
                deprecated: []
            },
            knowledge: {
                domains: [],
                facts: {},
                by_domain: {}
            },
            workingOn: {
                tasks: [],
                decisions_pending: [],
                reflections: []
            },
            confidence: {
                overall: 0.5,
                by_domain: {},
                recent_trend: []
            },
            cognitiveState: {
                status: 'idle',
                focus: null,
                depth: 0,
                last_thought: null
            },
            blindSpots: {
                identified: [],
                suspected: [],
                ignored: []
            },
            metrics: {
                thoughts_generated: 0,
                actions_taken: 0,
                decisions_made: 0,
                reflections_completed: 0,
                confidence_changes: 0
            }
        };
    }

    /**
     * Save self-model to file
     */
    save() {
        this.model.updated = new Date().toISOString();
        try {
            const dir = path.dirname(STATE_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(STATE_FILE, JSON.stringify(this.model, null, 2));
        } catch (e) {
            console.error('[SelfModel] Failed to save self-model:', e.message);
        }
    }

    // ============================================================================
    // Capabilities
    // ============================================================================

    /**
     * Register a new capability
     * @param {string} capability - Name of the capability
     */
    registerCapability(capability) {
        if (!this.model.capabilities.available.includes(capability)) {
            this.model.capabilities.available.push(capability);
            this.model.capabilities.active.push(capability);
            this.save();
        }
    }

    /**
     * Get all capabilities
     * @returns {Object} Available, active, and learning capabilities
     */
    getCapabilities() {
        return {
            available: this.model.capabilities.available,
            active: this.model.capabilities.active,
            learning: this.model.capabilities.learning
        };
    }

    /**
     * Mark a capability as being used
     * @param {string} capability - Name of the capability
     * @returns {boolean} True if capability was used
     */
    useCapability(capability) {
        if (this.model.capabilities.active.includes(capability)) {
            return true;
        }
        if (this.model.capabilities.available.includes(capability)) {
            this.model.capabilities.active.push(capability);
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Start learning a new capability
     * @param {string} capability - Name of the capability to learn
     */
    startLearning(capability) {
        if (!this.model.capabilities.learning.includes(capability)) {
            this.model.capabilities.learning.push(capability);
            this.save();
        }
    }

    /**
     * Complete learning a capability
     * @param {string} capability - Name of the capability learned
     */
    completeLearning(capability) {
        const index = this.model.capabilities.learning.indexOf(capability);
        if (index > -1) {
            this.model.capabilities.learning.splice(index, 1);
        }
        if (!this.model.capabilities.available.includes(capability)) {
            this.model.capabilities.available.push(capability);
        }
        if (!this.model.capabilities.active.includes(capability)) {
            this.model.capabilities.active.push(capability);
        }
        this.save();
    }

    // ============================================================================
    // Knowledge
    // ============================================================================

    /**
     * Learn a new fact
     * @param {string} domain - Domain of knowledge
     * @param {Object} fact - Fact to learn
     * @param {number} confidence - Confidence level (0-1)
     */
    learn(domain, fact, confidence = 0.7) {
        if (!this.model.knowledge.domains.includes(domain)) {
            this.model.knowledge.domains.push(domain);
            this.model.knowledge.by_domain[domain] = 0;
        }

        const factId = fact.id || `fact_${Date.now()}`;
        this.model.knowledge.facts[`${domain}:${factId}`] = {
            ...fact,
            id: factId,
            learned_at: new Date().toISOString(),
            confidence
        };

        this.model.knowledge.by_domain[domain] += 1;
        this.save();
    }

    /**
     * Check if agent knows a specific fact
     * @param {string} domain - Domain to check
     * @param {string} factId - Fact ID to check
     * @returns {boolean} True if fact is known
     */
    know(domain, factId) {
        return !!this.model.knowledge.facts[`${domain}:${factId}`];
    }

    /**
     * Get all knowledge in a domain
     * @param {string} domain - Domain to query
     * @returns {Object} Facts in the domain
     */
    getKnowledge(domain) {
        const facts = {};
        for (const [key, fact] of Object.entries(this.model.knowledge.facts)) {
            if (key.startsWith(`${domain}:`)) {
                facts[key] = fact;
            }
        }
        return facts;
    }

    // ============================================================================
    // Working On (Task Management)
    // ============================================================================

    /**
     * Start a new task
     * @param {Object} task - Task description
     */
    startTask(task) {
        this.model.workingOn.tasks.push({
            id: task.id || `task_${Date.now()}`,
            description: task.description,
            status: 'in_progress',
            started_at: new Date().toISOString(),
            progress: 0,
            domain: task.domain || null
        });

        this.updateCognitiveState('thinking', task.description);
        this.save();
    }

    /**
     * Complete a task
     * @param {string} taskId - ID of the task to complete
     * @param {boolean} success - Whether task was successful
     */
    completeTask(taskId, success = true) {
        const task = this.model.workingOn.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = success ? 'completed' : 'failed';
            task.completed_at = new Date().toISOString();
            task.progress = 100;

            // Update confidence based on outcome
            const domain = task.domain || 'general';
            const delta = success ? 0.05 : -0.1;
            this.updateConfidence(domain, delta);
            this.save();
        }
    }

    /**
     * Update task progress
     * @param {string} taskId - Task ID
     * @param {number} progress - Progress percentage (0-100)
     */
    updateTaskProgress(taskId, progress) {
        const task = this.model.workingOn.tasks.find(t => t.id === taskId);
        if (task) {
            task.progress = Math.max(0, Math.min(100, progress));
            this.save();
        }
    }

    /**
     * Get all in-progress tasks
     * @returns {Array} Current tasks
     */
    getWorkingOn() {
        return this.model.workingOn.tasks.filter(t => t.status === 'in_progress');
    }

    // ============================================================================
    // Confidence
    // ============================================================================

    /**
     * Update confidence in a domain
     * @param {string} domain - Domain to update
     * @param {number} delta - Change in confidence (-1 to 1)
     */
    updateConfidence(domain, delta) {
        const current = this.model.confidence.by_domain[domain] || 0.5;
        const newConfidence = Math.max(0, Math.min(1, current + delta));

        this.model.confidence.by_domain[domain] = newConfidence;

        // Update overall confidence
        const domains = Object.keys(this.model.confidence.by_domain);
        if (domains.length > 0) {
            const avg = domains.reduce((sum, d) =>
                sum + this.model.confidence.by_domain[d], 0) / domains.length;
            this.model.confidence.overall = avg;
        }

        // Track trend
        this.model.confidence.recent_trend.push({
            timestamp: new Date().toISOString(),
            domain,
            delta,
            new_confidence: newConfidence
        });

        // Keep only last 20 entries
        if (this.model.confidence.recent_trend.length > 20) {
            this.model.confidence.recent_trend = this.model.confidence.recent_trend.slice(-20);
        }

        if (delta !== 0) {
            this.model.metrics.confidence_changes++;
        }

        this.save();
    }

    /**
     * Get confidence level
     * @param {string} domain - Optional domain to get confidence for
     * @returns {Object|number} Confidence data
     */
    getConfidence(domain = null) {
        if (domain) {
            return this.model.confidence.by_domain[domain] || 0.5;
        }
        return {
            overall: this.model.confidence.overall,
            by_domain: this.model.confidence.by_domain,
            trend: this.model.confidence.recent_trend
        };
    }

    // ============================================================================
    // Cognitive State
    // ============================================================================

    /**
     * Update cognitive state
     * @param {string} status - Status (idle, thinking, deliberating, acting)
     * @param {string} focus - Current focus
     * @param {number} depth - Thought depth
     * @returns {Object} Previous state
     */
    updateCognitiveState(status, focus = null, depth = null) {
        const previous = { ...this.model.cognitiveState };

        this.model.cognitiveState.status = status;
        if (focus !== null) this.model.cognitiveState.focus = focus;
        if (depth !== null) this.model.cognitiveState.depth = depth;

        this.model.cognitiveState.last_thought = new Date().toISOString();

        return previous;
    }

    /**
     * Get current cognitive state
     * @returns {Object} Current cognitive state
     */
    getCognitiveState() {
        return this.model.cognitiveState;
    }

    // ============================================================================
    // Reflections
    // ============================================================================

    /**
     * Add a reflection
     * @param {Object} reflection - Reflection data
     */
    addReflection(reflection) {
        this.model.workingOn.reflections.push({
            id: reflection.id || `ref_${Date.now()}`,
            type: reflection.type,
            content: reflection.content,
            insights: reflection.insights || [],
            confidence_before: reflection.confidence_before,
            confidence_after: reflection.confidence_after,
            timestamp: new Date().toISOString()
        });

        this.model.metrics.reflections_completed++;

        // Keep only last 50 reflections
        if (this.model.workingOn.reflections.length > 50) {
            this.model.workingOn.reflections = this.model.workingOn.reflections.slice(-50);
        }

        this.save();
    }

    /**
     * Get recent reflections
     * @param {number} count - Number of reflections to get
     * @returns {Array} Recent reflections
     */
    getRecentReflections(count = 10) {
        return this.model.workingOn.reflections.slice(-count);
    }

    // ============================================================================
    // Blind Spots
    // ============================================================================

    /**
     * Identify a blind spot
     * @param {Object} spot - Blind spot description
     */
    identifyBlindSpot(spot) {
        if (!this.model.blindSpots.identified.find(s => s.id === spot.id)) {
            this.model.blindSpots.identified.push({
                ...spot,
                identified_at: new Date().toISOString()
            });
            this.save();
        }
    }

    /**
     * Suspect a blind spot
     * @param {Object} spot - Suspected blind spot
     */
    suspectBlindSpot(spot) {
        if (!this.model.blindSpots.suspected.find(s => s.id === spot.id)) {
            this.model.blindSpots.suspected.push({
                ...spot,
                suspected_at: new Date().toISOString()
            });
            this.save();
        }
    }

    /**
     * Get all blind spots
     * @returns {Object} Identified and suspected blind spots
     */
    getBlindSpots() {
        return {
            identified: this.model.blindSpots.identified,
            suspected: this.model.blindSpots.suspected
        };
    }

    // ============================================================================
    // Metrics
    // ============================================================================

    /**
     * Increment thought count
     */
    incrementThoughtCount() {
        this.model.metrics.thoughts_generated++;
        this.save();
    }

    /**
     * Increment action count
     */
    incrementActionCount() {
        this.model.metrics.actions_taken++;
        this.save();
    }

    /**
     * Increment decision count
     */
    incrementDecisionCount() {
        this.model.metrics.decisions_made++;
        this.save();
    }

    /**
     * Get metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return this.model.metrics;
    }

    // ============================================================================
    // Export
    // ============================================================================

    /**
     * Export full model as JSON
     * @returns {Object} Full self-model
     */
    toJSON() {
        return this.model;
    }

    /**
     * Get summary of self-model
     * @returns {Object} Summary data
     */
    summary() {
        return {
            agent: this.agentName,
            status: this.model.cognitiveState.status,
            confidence: this.model.confidence.overall.toFixed(2),
            capabilities: this.model.capabilities.active.length,
            working_on: this.getWorkingOn().length,
            recent_reflections: this.model.workingOn.reflections.length,
            blind_spots: this.model.blindSpots.identified.length
        };
    }
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);

    if (args.includes('--json') || args.includes('-j')) {
        return { mode: 'json' };
    } else if (args.includes('--summary') || args.includes('-s')) {
        return { mode: 'summary' };
    } else if (args.includes('--capabilities')) {
        return { mode: 'capabilities' };
    } else if (args.includes('--confidence')) {
        return { mode: 'confidence' };
    } else if (args.includes('--state')) {
        return { mode: 'state' };
    } else if (args.includes('--help') || args.includes('-h')) {
        return { mode: 'help' };
    }

    return { mode: 'summary' };
}

/**
 * Main function
 */
function main() {
    const { mode } = parseArgs();
    const agentName = process.env.AGENT_NAME || 'steward';
    const model = new SelfModel(agentName);

    switch (mode) {
        case 'json':
            console.log(JSON.stringify(model.toJSON(), null, 2));
            break;

        case 'summary':
            console.log(JSON.stringify(model.summary(), null, 2));
            break;

        case 'capabilities':
            console.log(JSON.stringify(model.getCapabilities(), null, 2));
            break;

        case 'confidence':
            console.log(JSON.stringify(model.getConfidence(), null, 2));
            break;

        case 'state':
            console.log(JSON.stringify(model.getCognitiveState(), null, 2));
            break;

        case 'help':
            console.log(`
Self-Model - Meta-cognitive self-awareness for agents

Usage:
  node self-model.js [options]

Options:
  --json, -j              Export full model as JSON
  --summary, -s           Show summary (default)
  --capabilities          Show all capabilities
  --confidence            Show confidence levels
  --state                 Show cognitive state
  --help, -h              Show this help message

Environment Variables:
  SELF_MODEL_FILE    State file location
  AGENT_NAME         Agent name (default: steward)

Examples:
  node self-model.js --summary
  node self-model.js --capabilities
  AGENT_NAME=alpha node self-model.js --json
`);
            break;

        default:
            console.log(`Self-Model for ${agentName}:`);
            console.log(JSON.stringify(model.summary(), null, 2));
    }
}

// Export for programmatic use
module.exports = SelfModel;

// Run if called directly
if (require.main === module) {
    main();
}
