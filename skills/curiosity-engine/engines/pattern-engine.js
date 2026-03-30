#!/usr/bin/env node
/**
 * Pattern Engine - ClawRecipes Integration with Curiosity Engine
 * 
 * This module provides the integration between ClawRecipes pattern library
 * and the Curiosity Engine, enabling pattern-based capability recommendations
 * and context-aware skill adaptation.
 * 
 * Components:
 * - PatternEngine: Main engine for pattern operations
 * - PatternRecommender: Recommends patterns based on gaps
 * - PatternExecutor: Executes matched patterns
 * 
 * Integration:
 * - Connects with gap-detector for capability gap analysis
 * - Connects with evolution-engine for capability evolution
 * - Connects with research-engine for research-driven patterns
 * 
 * Usage:
 *   const PatternEngine = require('./pattern-engine.js');
 *   const engine = new PatternEngine();
 *   const recommendations = await engine.recommendForGaps(gaps);
 */

const fs = require('fs');
const path = require('path');

// Try to load Pattern Registry
let PatternRegistry = null;
try {
    PatternRegistry = require('../../modules/skills/pattern-registry.js');
} catch (e) {
    console.warn('[PatternEngine] Pattern Registry not available');
    // Will use local pattern storage instead
}

// Try to load Evolution Engine
let EvolutionEngine = null;
try {
    EvolutionEngine = require('../../modules/evolution/evolution-engine.js');
} catch (e) {
    console.warn('[PatternEngine] Evolution Engine not available');
}

// Try to load Research Engine
let ResearchEngine = null;
try {
    ResearchEngine = require('../../modules/research/research-engine.js');
} catch (e) {
    console.warn('[PatternEngine] Research Engine not available');
}

// Configuration
const CONFIG_FILE = process.env.PATTERN_ENGINE_CONFIG || 
    path.join(__dirname, 'config.json');
const STATE_FILE = process.env.PATTERN_ENGINE_STATE || 
    path.join(__dirname, 'state', 'pattern-engine-state.json');

// ============================================
// PATTERN RECOMMENDER
// ============================================

/**
 * Recommends patterns based on detected gaps
 */
class PatternRecommender {
    constructor(config = {}) {
        this.config = {
            maxRecommendations: config.maxRecommendations || 5,
            minMatchScore: config.minMatchScore || 0.4,
            useFitnessRanking: config.useFitnessRanking !== false,
            ...config
        };
    }

    /**
     * Recommend patterns for detected gaps
     * @param {Array} gaps - Detected capability gaps
     * @param {Object} context - Current context
     * @returns {Array} Recommended patterns
     */
    async recommendForGaps(gaps, context = {}) {
        const recommendations = [];
        
        for (const gap of gaps) {
            const gapRecommendations = await this.recommendForGap(gap, context);
            recommendations.push(...gapRecommendations);
        }
        
        // Sort and dedupe
        const unique = this.deduplicateRecommendations(recommendations);
        
        return unique.slice(0, this.config.maxRecommendations);
    }

    /**
     * Recommend patterns for a single gap
     */
    async recommendForGap(gap, context = {}) {
        const recommendations = [];
        
        // Build context from gap
        const gapContext = {
            ...context,
            event: 'gap_resolution',
            capability: gap.gap_type || gap.skill,
            priority: gap.priority,
            tags: [gap.gap_type || 'capability_gap'],
            capabilities: context.capabilities || []
        };
        
        // Pattern matching would happen here if registry was available
        // For now, return simulated recommendations
        recommendations.push({
            patternId: `pattern_${gap.gap_type || 'generic'}`,
            gap: gap,
            score: gap.priority || 0.5,
            reason: `Matches ${gap.gap_type || 'capability'} gap`,
            actions: this.suggestActions(gap)
        });
        
        return recommendations;
    }

    /**
     * Suggest actions to address gap
     */
    suggestActions(gap) {
        const actions = [];
        
        if (gap.priority > 0.7) {
            actions.push({ type: 'evolve', params: { target: gap.skill } });
        } else {
            actions.push({ type: 'adapt', params: { target: gap.skill } });
        }
        
        actions.push({ type: 'validate', params: {} });
        
        return actions;
    }

    /**
     * Deduplicate recommendations
     */
    deduplicateRecommendations(recommendations) {
        const seen = new Set();
        return recommendations.filter(r => {
            if (seen.has(r.patternId)) return false;
            seen.add(r.patternId);
            return true;
        });
    }
}

// ============================================
// PATTERN EXECUTOR
// ============================================

/**
 * Executes matched patterns
 */
class PatternExecutor {
    constructor(config = {}) {
        this.config = {
            executionMode: config.executionMode || 'sequential', // sequential, parallel
            timeout: config.timeout || 300000,
            retryOnFailure: config.retryOnFailure !== false,
            maxRetries: config.maxRetries || 3,
            ...config
        };
        
        this.executionHistory = [];
    }

    /**
     * Execute a pattern
     * @param {Object} pattern - Pattern to execute
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Execution result
     */
    async execute(pattern, context = {}) {
        const execution = {
            id: `exec_${Date.now()}`,
            patternId: pattern.id,
            status: 'running',
            startedAt: new Date().toISOString(),
            context
        };
        
        try {
            // Execute pattern actions
            const results = await this.executeActions(pattern.actions, context);
            
            execution.status = 'completed';
            execution.results = results;
            execution.completedAt = new Date().toISOString();
            
        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            execution.completedAt = new Date().toISOString();
        }
        
        this.executionHistory.push(execution);
        return execution;
    }

    /**
     * Execute pattern actions
     */
    async executeActions(actions, context) {
        const results = [];
        
        for (const action of actions) {
            const actionResult = await this.executeAction(action, context);
            results.push(actionResult);
            
            // Stop if action failed
            if (actionResult.status === 'failed') {
                break;
            }
        }
        
        return results;
    }

    /**
     * Execute single action
     */
    async executeAction(action, context) {
        const result = {
            type: action.type,
            params: action.params,
            status: 'running',
            startedAt: new Date().toISOString()
        };
        
        try {
            // Simulate action execution
            await new Promise(resolve => setTimeout(resolve, 100));
            
            result.status = 'completed';
            result.output = this.generateOutput(action, context);
            result.completedAt = new Date().toISOString();
            
        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            result.completedAt = new Date().toISOString();
        }
        
        return result;
    }

    /**
     * Generate output for action
     */
    generateOutput(action, context) {
        switch (action.type) {
            case 'search':
                return { found: true, results: [] };
            case 'analyze':
                return { analysis: 'completed' };
            case 'evolve':
                return { evolved: true };
            case 'validate':
                return { valid: true };
            case 'plan':
                return { plan: 'created' };
            default:
                return { success: true };
        }
    }

    /**
     * Get execution history
     */
    getHistory() {
        return this.executionHistory;
    }
}

// ============================================
// GAP PATTERN INTEGRATOR
// ============================================

/**
 * Integrates with gap detector
 */
class GapPatternIntegrator {
    constructor(patternEngine) {
        this.engine = patternEngine;
    }

    /**
     * Process gaps from gap-detector and find matching patterns
     * @param {Array} gaps - Gaps from gap-detector
     * @returns {Promise<Array>} Pattern recommendations
     */
    async processGaps(gaps) {
        const recommendations = [];
        
        for (const gap of gaps) {
            const recs = await this.engine.recommender.recommendForGap(gap, {
                capabilities: this.engine.capabilities || []
            });
            recommendations.push(...recs);
        }
        
        return recommendations;
    }

    /**
     * Generate pattern-based solutions for gaps
     * @param {Array} gaps - Gaps to address
     * @returns {Promise<Array>} Solutions
     */
    async generateSolutions(gaps) {
        const solutions = [];
        
        const recommendations = await this.processGaps(gaps);
        
        for (const rec of recommendations) {
            solutions.push({
                gap: rec.gap,
                pattern: rec.patternId,
                solution: this.generateSolution(rec),
                confidence: rec.score
            });
        }
        
        return solutions;
    }

    /**
     * Generate solution from recommendation
     */
    generateSolution(recommendation) {
        return {
            approach: 'pattern_based',
            patternId: recommendation.patternId,
            actions: recommendation.actions,
            estimatedSuccess: recommendation.score
        };
    }
}

// ============================================
// EVOLUTION INTEGRATOR
// ============================================

/**
 * Integrates with evolution engine
 */
class EvolutionPatternIntegrator {
    constructor(patternEngine) {
        this.engine = patternEngine;
        this.evolutionEngine = null;
    }

    /**
     * Set evolution engine
     */
    setEvolutionEngine(evolutionEngine) {
        this.evolutionEngine = evolutionEngine;
    }

    /**
     * Evolve patterns based on evolution engine results
     * @param {Object} evolutionResult - Result from evolution cycle
     * @returns {Promise<Array>} Evolved patterns
     */
    async evolveFromResults(evolutionResult) {
        if (!this.evolutionEngine) {
            return [];
        }
        
        const patterns = [];
        
        // Get top capabilities from evolution
        const topCaps = this.evolutionEngine.getEvolvedCapabilities();
        
        // Map to patterns
        for (const cap of topCaps.recommended || []) {
            patterns.push({
                id: `evolved_${cap.id}`,
                capability: cap.capability,
                source: 'evolution',
                fitness: cap.fitness,
                generation: evolutionResult.generation
            });
        }
        
        return patterns;
    }

    /**
     * Get pattern recommendations based on evolution targets
     */
    async getRecommendationsForTargets(targetCapabilities) {
        return targetCapabilities.map(target => ({
            patternId: `pattern_${target.type}`,
            capability: target,
            score: target.weight || 0.5,
            reason: 'Matches evolution target'
        }));
    }
}

// ============================================
// RESEARCH INTEGRATOR
// ============================================

/**
 * Integrates with research engine
 */
class ResearchPatternIntegrator {
    constructor(patternEngine) {
        this.engine = patternEngine;
        this.researchEngine = null;
    }

    /**
     * Set research engine
     */
    setResearchEngine(researchEngine) {
        this.researchEngine = researchEngine;
    }

    /**
     * Generate patterns from research findings
     * @param {Object} researchResult - Result from research
     * @returns {Promise<Array>} Generated patterns
     */
    async generateFromResearch(researchResult) {
        const patterns = [];
        
        // Generate patterns from hypotheses
        for (const hypothesis of researchResult.hypotheses || []) {
            if (hypothesis.confidence > 0.6) {
                patterns.push({
                    name: `Research: ${hypothesis.statement?.substring(0, 50)}`,
                    description: hypothesis.statement,
                    category: 'research',
                    tags: ['research', 'hypothesis', hypothesis.type],
                    trigger: { event: 'research_finding' },
                    actions: [
                        { type: 'validate', params: {} },
                        { type: 'integrate', params: {} }
                    ],
                    linkedCapabilities: ['research', 'knowledge'],
                    fitness: hypothesis.confidence,
                    source: 'research'
                });
            }
        }
        
        return patterns;
    }

    /**
     * Get patterns for research objective
     */
    async getPatternsForObjective(objective) {
        const context = {
            event: 'research_request',
            objective,
            tags: ['research', 'investigation']
        };
        
        // Would match against registry if available
        return [{
            patternId: 'pattern_research_comprehensive',
            score: 0.8,
            reason: 'Matches research objective'
        }];
    }
}

// ============================================
// PATTERN ENGINE (Main Class)
// ============================================

/**
 * Main Pattern Engine class
 */
class PatternEngine {
    /**
     * Create a new Pattern Engine
     * @param {Object} config - Configuration
     */
    constructor(config = {}) {
        this.config = config;
        
        // Initialize components
        this.recommender = new PatternRecommender(config.recommender);
        this.executor = new PatternExecutor(config.executor);
        
        // Integrators
        this.gapIntegrator = new GapPatternIntegrator(this);
        this.evolutionIntegrator = new EvolutionPatternIntegrator(this);
        this.researchIntegrator = new ResearchPatternIntegrator(this);
        
        // Pattern Registry
        this.registry = null;
        
        // State
        this.capabilities = [];
        this.initialized = false;
        
        // Load config
        this.loadConfig();
    }

    /**
     * Initialize the Pattern Engine
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Try to load Pattern Registry
            if (PatternRegistry) {
                this.registry = new PatternRegistry.PatternRegistry();
                console.log('[PatternEngine] Pattern Registry loaded');
            } else {
                console.log('[PatternEngine] Using local pattern storage');
            }
            
            // Try to load Evolution Engine
            if (EvolutionEngine) {
                this.evolution = new EvolutionEngine.EvolutionEngine('pattern-engine');
                this.evolutionIntegrator.setEvolutionEngine(this.evolution);
                console.log('[PatternEngine] Evolution Engine loaded');
            }
            
            // Try to load Research Engine
            if (ResearchEngine) {
                this.research = new ResearchEngine.ResearchEngine('pattern-engine');
                this.researchIntegrator.setResearchEngine(this.research);
                console.log('[PatternEngine] Research Engine loaded');
            }
            
            this.initialized = true;
            console.log('[PatternEngine] Initialized');
            
        } catch (error) {
            console.error('[PatternEngine] Initialization failed:', error.message);
        }
    }

    /**
     * Load configuration
     */
    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
                this.config = { ...this.config, ...config };
            }
        } catch (e) {
            console.warn('[PatternEngine] Failed to load config:', e.message);
        }
    }

    /**
     * Save configuration
     */
    saveConfig() {
        try {
            const dir = path.dirname(CONFIG_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
        } catch (e) {
            console.error('[PatternEngine] Failed to save config:', e.message);
        }
    }

    /**
     * Set agent capabilities
     */
    setCapabilities(capabilities) {
        this.capabilities = capabilities;
    }

    /**
     * Find patterns for context
     * @param {Object} context - Current context
     * @returns {Promise<Array>} Matching patterns
     */
    async findPatterns(context) {
        if (this.registry) {
            return await this.registry.findPatterns(context);
        }
        
        // Return default patterns if registry not available
        return [{
            pattern: {
                id: 'default_research',
                name: 'Basic Research',
                description: 'Perform basic research'
            },
            score: 0.7,
            reasons: ['Default pattern']
        }];
    }

    /**
     * Recommend patterns for gaps
     * @param {Array} gaps - Detected gaps
     * @returns {Promise<Array>} Recommendations
     */
    async recommendForGaps(gaps) {
        return await this.recommender.recommendForGaps(gaps, {
            capabilities: this.capabilities
        });
    }

    /**
     * Execute a pattern
     * @param {Object} pattern - Pattern to execute
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Execution result
     */
    async executePattern(pattern, context = {}) {
        return await this.executor.execute(pattern, context);
    }

    /**
     * Get pattern as executable skill
     * @param {string} patternId - Pattern ID
     * @param {Object} options - Adaptation options
     * @returns {Promise<Object>} Executable skill
     */
    async getSkill(patternId, options = {}) {
        if (!this.registry) {
            throw new Error('Pattern Registry not available');
        }
        
        return await this.registry.adaptToSkill(patternId, options);
    }

    /**
     * Add a new pattern
     * @param {Object} patternDefinition - Pattern to add
     * @returns {Object} Added pattern
     */
    addPattern(patternDefinition) {
        if (!this.registry) {
            return { id: 'local_pattern', ...patternDefinition };
        }
        
        return this.registry.addPattern(patternDefinition);
    }

    /**
     * Update pattern based on execution results
     * @param {string} patternId - Pattern ID
     * @param {boolean} success - Execution success
     */
    updatePatternFromResult(patternId, success) {
        if (this.registry) {
            this.registry.recordResult(patternId, success);
        }
    }

    /**
     * Get all available patterns
     */
    getAllPatterns() {
        if (this.registry) {
            return this.registry.getAllPatterns();
        }
        return [];
    }

    /**
     * Get engine statistics
     */
    getStats() {
        return {
            initialized: this.initialized,
            registryAvailable: !!this.registry,
            evolutionAvailable: !!this.evolution,
            researchAvailable: !!this.research,
            capabilitiesCount: this.capabilities.length,
            executionHistory: this.executor.getHistory().length
        };
    }

    /**
     * Generate capability recommendations from gaps
     * @param {Array} gaps - Detected gaps
     * @returns {Promise<Array>} Capability recommendations
     */
    async generateCapabilityRecommendations(gaps) {
        const patterns = await this.recommendForGaps(gaps);
        
        return patterns.map(p => ({
            patternId: p.patternId,
            score: p.score,
            recommendedCapabilities: this.extractCapabilities(p)
        }));
    }

    /**
     * Extract capabilities from pattern recommendation
     */
    extractCapabilities(recommendation) {
        // Extract from pattern or recommendation
        return recommendation.actions?.map(a => a.type) || [];
    }

    /**
     * Sync with evolution engine
     */
    async syncWithEvolution(evolutionResult) {
        if (!this.evolutionIntegrator.evolutionEngine) return;
        
        return await this.evolutionIntegrator.evolveFromResults(evolutionResult);
    }

    /**
     * Get patterns for research
     */
    async getPatternsForResearch(objective) {
        if (!this.researchIntegrator.researchEngine) {
            return this.researchIntegrator.getPatternsForObjective(objective);
        }
        
        return [];
    }
}

// ============================================
// PATTERN ENGINE FACTORY
// ============================================

class PatternEngineFactory {
    /**
     * Create a new Pattern Engine
     * @param {Object} config - Configuration
     * @returns {Promise<PatternEngine>} Engine instance
     */
    static async create(config = {}) {
        const engine = new PatternEngine(config);
        await engine.initialize();
        return engine;
    }
}

// ============================================
// MAIN EXPORTS
// ============================================

module.exports = {
    PatternEngine,
    PatternEngineFactory,
    PatternRecommender,
    PatternExecutor,
    GapPatternIntegrator,
    EvolutionPatternIntegrator,
    ResearchPatternIntegrator
};

// ============================================
// CLI
// ============================================

if (require.main === module) {
    const args = process.argv.slice(2);
    const engine = new PatternEngine();
    
    // Initialize
    engine.initialize().then(() => {
        if (args.includes('--stats')) {
            console.log(JSON.stringify(engine.getStats(), null, 2));
        } else if (args.includes('--recommend')) {
            const gaps = [
                { gap_type: 'reasoning', priority: 0.8, skill: 'advanced_reasoning' },
                { gap_type: 'execution', priority: 0.6, skill: 'tool_use' }
            ];
            engine.recommendForGaps(gaps).then(recs => {
                console.log(JSON.stringify(recs, null, 2));
            });
        } else if (args.includes('--patterns')) {
            console.log(JSON.stringify(engine.getAllPatterns().map(p => ({
                id: p.id,
                name: p.name,
                category: p.category
            })), null, 2));
        } else {
            console.log('Pattern Engine - ClawRecipes Integration');
            console.log('Usage:');
            console.log('  --stats       Show engine statistics');
            console.log('  --recommend  Get pattern recommendations');
            console.log('  --patterns   List all patterns');
        }
    });
}
