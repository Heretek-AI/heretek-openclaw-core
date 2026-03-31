#!/usr/bin/env node
/**
 * relationship-tracker.js - Relationship tracking and trust management
 * 
 * Provides relationship tracking between users and agents:
 * - Relationship types and trust levels (0.0 - 1.0 scale)
 * - Relationship graph between users and agents
 * - Relationship history tracking
 * - Trust level adjustments based on interactions
 * - Agent-specific relationship tracking
 * 
 * Usage:
 *   node relationship-tracker.js set-trust <slug> <level>
 *   node relationship-tracker.js get-trust <slug>
 *   node relationship-tracker.js add-relation <slug1> <slug2> --type collaborator
 *   node relationship-tracker.js history <slug>
 *   node relationship-tracker.js graph
 */

const fs = require('fs');
const path = require('path');

// Configuration
const USERS_DIR = process.env.USERS_DIR || path.join(process.cwd(), 'users');
const USER_INDEX = process.env.USER_INDEX || path.join(USERS_DIR, 'index.json');
const RELATIONSHIPS_DIR = process.env.RELATIONSHIPS_DIR || path.join(USERS_DIR, '_relationships');
const RELATIONSHIP_GRAPH = path.join(RELATIONSHIPS_DIR, 'graph.json');
const RELATIONSHIP_HISTORY = path.join(RELATIONSHIPS_DIR, 'history.json');

/**
 * Relationship types with descriptions and default trust levels
 */
const RELATIONSHIP_TYPES = {
    primary: {
        description: 'Main project owner/leader',
        defaultTrust: 0.9,
        minTrust: 0.8,
        maxTrust: 1.0,
        permissions: ['full_access', 'user_management', 'agent_control', 'system_config']
    },
    collaborator: {
        description: 'Active development partner',
        defaultTrust: 0.7,
        minTrust: 0.5,
        maxTrust: 0.9,
        permissions: ['development_access', 'project_contrib', 'agent_interaction']
    },
    partner: {
        description: 'Strategic partnership organization',
        defaultTrust: 0.6,
        minTrust: 0.4,
        maxTrust: 0.8,
        permissions: ['limited_access', 'project_view', 'formal_communication']
    },
    observer: {
        description: 'Passive viewer with limited access',
        defaultTrust: 0.3,
        minTrust: 0.1,
        maxTrust: 0.5,
        permissions: ['read_only', 'public_info']
    },
    client: {
        description: 'External customer or stakeholder',
        defaultTrust: 0.5,
        minTrust: 0.3,
        maxTrust: 0.7,
        permissions: ['project_access', 'status_view', 'formal_communication']
    },
    vendor: {
        description: 'Service provider or contractor',
        defaultTrust: 0.4,
        minTrust: 0.2,
        maxTrust: 0.6,
        permissions: ['service_access', 'limited_integration']
    },
    agent: {
        description: 'AI agent in the collective',
        defaultTrust: 0.8,
        minTrust: 0.5,
        maxTrust: 1.0,
        permissions: ['autonomous_action', 'memory_access', 'agent_communication']
    }
};

/**
 * Trust adjustment reasons
 */
const TRUST_ADJUSTMENTS = {
    positive: {
        'successful_collaboration': 0.05,
        'consistent_communication': 0.02,
        'valuable_contribution': 0.03,
        'long_term_engagement': 0.01,
        'security_clearance': 0.1,
        'critical_assistance': 0.08
    },
    negative: {
        'policy_violation': -0.2,
        'suspicious_activity': -0.15,
        'communication_breakdown': -0.05,
        'project_abandonment': -0.1,
        'security_concern': -0.25,
        'trust_violation': -0.3
    }
};

/**
 * RelationshipTracker - Manages relationships and trust levels
 */
class RelationshipTracker {
    constructor() {
        this.usersDir = USERS_DIR;
        this.indexFile = USER_INDEX;
        this.relationshipsDir = RELATIONSHIPS_DIR;
        this.graphFile = RELATIONSHIP_GRAPH;
        this.historyFile = RELATIONSHIP_HISTORY;
        
        // Ensure relationships directory exists
        if (!fs.existsSync(this.relationshipsDir)) {
            fs.mkdirSync(this.relationshipsDir, { recursive: true });
        }
        
        this.index = this.loadIndex();
        this.graph = this.loadGraph();
        this.history = this.loadHistory();
    }

    /**
     * Load user index
     */
    loadIndex() {
        try {
            if (fs.existsSync(this.indexFile)) {
                return JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
            }
        } catch (e) {
            console.error('[RelationshipTracker] Failed to load index:', e.message);
        }
        return { users: [], updatedAt: new Date().toISOString() };
    }

    /**
     * Load relationship graph
     */
    loadGraph() {
        try {
            if (fs.existsSync(this.graphFile)) {
                return JSON.parse(fs.readFileSync(this.graphFile, 'utf8'));
            }
        } catch (e) {
            console.error('[RelationshipTracker] Failed to load graph:', e.message);
        }
        return {
            nodes: [],
            edges: [],
            userAgentRelations: {},
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Save relationship graph
     */
    saveGraph() {
        this.graph.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.graphFile, JSON.stringify(this.graph, null, 2));
    }

    /**
     * Load relationship history
     */
    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
            }
        } catch (e) {
            console.error('[RelationshipTracker] Failed to load history:', e.message);
        }
        return { events: [], updatedAt: new Date().toISOString() };
    }

    /**
     * Save relationship history
     */
    saveHistory() {
        this.history.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    }

    /**
     * Get user profile path
     */
    getProfilePath(slug) {
        return path.join(this.usersDir, slug, 'profile.json');
    }

    /**
     * Load user profile
     */
    loadProfile(slug) {
        const profilePath = this.getProfilePath(slug);
        if (fs.existsSync(profilePath)) {
            return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        }
        return null;
    }

    /**
     * Save user profile
     */
    saveProfile(slug, profile) {
        const profilePath = this.getProfilePath(slug);
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    }

    /**
     * Get relationship type info
     */
    getRelationshipTypeInfo(type) {
        return RELATIONSHIP_TYPES[type] || {
            description: 'Unknown relationship type',
            defaultTrust: 0.5,
            minTrust: 0.0,
            maxTrust: 1.0,
            permissions: []
        };
    }

    /**
     * Set trust level for a user
     */
    setTrustLevel(slug, trustLevel, reason = null) {
        const profile = this.loadProfile(slug);
        
        if (!profile) {
            throw new Error(`User ${slug} not found`);
        }
        
        // Validate trust level
        if (trustLevel < 0 || trustLevel > 1) {
            throw new Error('Trust level must be between 0.0 and 1.0');
        }
        
        const previousTrust = profile.relationship.trust_level;
        const relationshipType = profile.relationship.type;
        const typeInfo = this.getRelationshipTypeInfo(relationshipType);
        
        // Warn if trust is outside typical range for relationship type
        if (trustLevel < typeInfo.minTrust || trustLevel > typeInfo.maxTrust) {
            console.warn(`Warning: Trust level ${trustLevel} is outside typical range [${typeInfo.minTrust}, ${typeInfo.maxTrust}] for ${relationshipType}`);
        }
        
        // Update trust level
        profile.relationship.trust_level = trustLevel;
        profile.lastActive = new Date().toISOString();
        this.saveProfile(slug, profile);
        
        // Record history event
        this.history.events.push({
            timestamp: new Date().toISOString(),
            type: 'trust_change',
            user: slug,
            previousValue: previousTrust,
            newValue: trustLevel,
            reason: reason || 'manual_adjustment',
            delta: trustLevel - previousTrust
        });
        this.saveHistory();
        
        // Update graph
        this.updateUserNode(slug, profile);
        
        return {
            slug,
            previousTrust,
            newTrust: trustLevel,
            delta: trustLevel - previousTrust,
            reason
        };
    }

    /**
     * Adjust trust level by delta
     */
    adjustTrust(slug, delta, reason) {
        const profile = this.loadProfile(slug);
        
        if (!profile) {
            throw new Error(`User ${slug} not found`);
        }
        
        const currentTrust = profile.relationship.trust_level;
        const newTrust = Math.max(0, Math.min(1, currentTrust + delta));
        
        return this.setTrustLevel(slug, newTrust, reason);
    }

    /**
     * Apply positive trust adjustment
     */
    applyPositiveAdjustment(slug, adjustmentType) {
        const adjustment = TRUST_ADJUSTMENTS.positive[adjustmentType];
        if (!adjustment) {
            throw new Error(`Unknown positive adjustment type: ${adjustmentType}`);
        }
        return this.adjustTrust(slug, adjustment, adjustmentType);
    }

    /**
     * Apply negative trust adjustment
     */
    applyNegativeAdjustment(slug, adjustmentType) {
        const adjustment = TRUST_ADJUSTMENTS.negative[adjustmentType];
        if (!adjustment) {
            throw new Error(`Unknown negative adjustment type: ${adjustmentType}`);
        }
        return this.adjustTrust(slug, adjustment, adjustmentType);
    }

    /**
     * Get trust level for a user
     */
    getTrustLevel(slug) {
        const profile = this.loadProfile(slug);
        
        if (!profile) {
            throw new Error(`User ${slug} not found`);
        }
        
        return {
            slug,
            trustLevel: profile.relationship.trust_level,
            relationshipType: profile.relationship.type,
            since: profile.relationship.since,
            typeInfo: this.getRelationshipTypeInfo(profile.relationship.type)
        };
    }

    /**
     * Set relationship type
     */
    setRelationshipType(slug, type) {
        const profile = this.loadProfile(slug);
        
        if (!profile) {
            throw new Error(`User ${slug} not found`);
        }
        
        if (!RELATIONSHIP_TYPES[type]) {
            throw new Error(`Unknown relationship type: ${type}`);
        }
        
        const previousType = profile.relationship.type;
        const typeInfo = this.getRelationshipTypeInfo(type);
        
        profile.relationship.type = type;
        profile.relationship.since = new Date().toISOString();
        
        // Optionally adjust trust to new type's default if significantly different
        const currentTrust = profile.relationship.trust_level;
        if (currentTrust < typeInfo.minTrust || currentTrust > typeInfo.maxTrust) {
            profile.relationship.trust_level = typeInfo.defaultTrust;
        }
        
        this.saveProfile(slug, profile);
        
        // Record history
        this.history.events.push({
            timestamp: new Date().toISOString(),
            type: 'relationship_type_change',
            user: slug,
            previousValue: previousType,
            newValue: type
        });
        this.saveHistory();
        
        // Update graph
        this.updateUserNode(slug, profile);
        
        return {
            slug,
            previousType,
            newType: type,
            trustLevel: profile.relationship.trust_level,
            typeInfo
        };
    }

    /**
     * Add relationship between two users
     */
    addRelationship(sourceSlug, targetSlug, relationshipType = 'collaborator') {
        const sourceProfile = this.loadProfile(sourceSlug);
        const targetProfile = this.loadProfile(targetSlug);
        
        if (!sourceProfile) {
            throw new Error(`User ${sourceSlug} not found`);
        }
        if (!targetProfile) {
            throw new Error(`User ${targetSlug} not found`);
        }
        
        const edge = {
            id: `${sourceSlug}-${targetSlug}-${Date.now()}`,
            source: sourceSlug,
            target: targetSlug,
            type: relationshipType,
            createdAt: new Date().toISOString(),
            strength: 1.0
        };
        
        this.graph.edges.push(edge);
        
        // Ensure nodes exist
        this.updateUserNode(sourceSlug, sourceProfile);
        this.updateUserNode(targetSlug, targetProfile);
        
        this.saveGraph();
        
        // Record history
        this.history.events.push({
            timestamp: new Date().toISOString(),
            type: 'relationship_created',
            source: sourceSlug,
            target: targetSlug,
            relationshipType
        });
        this.saveHistory();
        
        return edge;
    }

    /**
     * Update user node in graph
     */
    updateUserNode(slug, profile) {
        const existingIndex = this.graph.nodes.findIndex(n => n.slug === slug);
        const node = {
            slug,
            uuid: profile.uuid,
            name: profile.name.full,
            relationshipType: profile.relationship.type,
            trustLevel: profile.relationship.trust_level,
            updatedAt: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            this.graph.nodes[existingIndex] = node;
        } else {
            this.graph.nodes.push(node);
        }
        
        this.saveGraph();
        return node;
    }

    /**
     * Add agent relationship for a user
     */
    addAgentRelationship(userSlug, agentId, relationshipData = {}) {
        const profile = this.loadProfile(userSlug);
        
        if (!profile) {
            throw new Error(`User ${userSlug} not found`);
        }
        
        if (!this.graph.userAgentRelations[userSlug]) {
            this.graph.userAgentRelations[userSlug] = [];
        }
        
        const relation = {
            agentId,
            type: relationshipData.type || 'interaction',
            trustLevel: relationshipData.trustLevel || 0.5,
            interactionCount: relationshipData.interactionCount || 0,
            lastInteraction: relationshipData.lastInteraction || new Date().toISOString(),
            notes: relationshipData.notes || []
        };
        
        // Check for existing relation
        const existingIndex = this.graph.userAgentRelations[userSlug].findIndex(r => r.agentId === agentId);
        
        if (existingIndex >= 0) {
            this.graph.userAgentRelations[userSlug][existingIndex] = {
                ...this.graph.userAgentRelations[userSlug][existingIndex],
                ...relation
            };
        } else {
            this.graph.userAgentRelations[userSlug].push(relation);
        }
        
        this.saveGraph();
        
        // Record history
        this.history.events.push({
            timestamp: new Date().toISOString(),
            type: 'agent_relationship',
            user: userSlug,
            agent: agentId,
            relationshipType: relation.type
        });
        this.saveHistory();
        
        return relation;
    }

    /**
     * Get agent relationships for a user
     */
    getAgentRelationships(userSlug) {
        return this.graph.userAgentRelations[userSlug] || [];
    }

    /**
     * Update agent interaction
     */
    updateAgentInteraction(userSlug, agentId, interactionData = {}) {
        const relations = this.getAgentRelationships(userSlug);
        const relation = relations.find(r => r.agentId === agentId);
        
        if (!relation) {
            return this.addAgentRelationship(userSlug, agentId, {
                interactionCount: 1,
                lastInteraction: new Date().toISOString(),
                ...interactionData
            });
        }
        
        relation.interactionCount = (relation.interactionCount || 0) + 1;
        relation.lastInteraction = new Date().toISOString();
        
        if (interactionData.notes) {
            relation.notes = relation.notes || [];
            relation.notes.push({
                timestamp: new Date().toISOString(),
                note: interactionData.notes
            });
        }
        
        this.saveGraph();
        return relation;
    }

    /**
     * Get relationship history for a user
     */
    getHistory(slug, limit = 50) {
        const events = this.history.events
            .filter(e => e.user === slug || e.source === slug || e.target === slug)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
        
        return {
            slug,
            events,
            total: events.length
        };
    }

    /**
     * Get full relationship graph
     */
    getGraph() {
        return {
            nodes: this.graph.nodes,
            edges: this.graph.edges,
            userAgentRelations: this.graph.userAgentRelations,
            updatedAt: this.graph.updatedAt
        };
    }

    /**
     * Calculate relationship strength between two users
     */
    calculateRelationshipStrength(slug1, slug2) {
        const edges = this.graph.edges.filter(e =>
            (e.source === slug1 && e.target === slug2) ||
            (e.source === slug2 && e.target === slug1)
        );
        
        if (edges.length === 0) {
            return 0;
        }
        
        // Calculate based on number of connections and their age
        const baseStrength = Math.min(1.0, edges.length * 0.3);
        const avgAge = edges.reduce((sum, e) => {
            const age = Date.now() - new Date(e.createdAt).getTime();
            return sum + Math.max(0, 1 - (age / (90 * 24 * 60 * 60 * 1000))); // 90 days decay
        }, 0) / edges.length;
        
        return Math.min(1.0, baseStrength * avgAge);
    }

    /**
     * Get all relationships for a user
     */
    getUserRelationships(slug) {
        const profile = this.loadProfile(slug);
        
        if (!profile) {
            throw new Error(`User ${slug} not found`);
        }
        
        const directRelations = this.graph.edges.filter(e =>
            e.source === slug || e.target === slug
        );
        
        const agentRelations = this.getAgentRelationships(slug);
        
        return {
            slug,
            directRelations: directRelations.map(e => ({
                ...e,
                otherParty: e.source === slug ? e.target : e.source,
                strength: this.calculateRelationshipStrength(slug, e.source === slug ? e.target : e.source)
            })),
            agentRelations,
            trustLevel: profile.relationship.trust_level,
            relationshipType: profile.relationship.type
        };
    }

    /**
     * Export relationship data
     */
    exportData() {
        return {
            graph: this.getGraph(),
            history: this.history,
            exportedAt: new Date().toISOString()
        };
    }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0];
    const options = {};

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--type' && args[i + 1]) {
            options.type = args[i + 1];
            i++;
        } else if (arg === '--reason' && args[i + 1]) {
            options.reason = args[i + 1];
            i++;
        } else if (arg === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[i + 1]);
            i++;
        } else if (arg === '--json' || arg === '-j') {
            options.json = true;
        } else if (!arg.startsWith('--')) {
            if (options.arg === undefined) {
                options.arg = arg;
            } else if (options.arg2 === undefined) {
                options.arg2 = arg;
            }
        }
    }

    return { command, options };
}

/**
 * Main function
 */
function main() {
    const { command, options } = parseArgs();
    const tracker = new RelationshipTracker();

    try {
        switch (command) {
            case 'set-trust': {
                const slug = options.arg;
                const level = parseFloat(options.arg2);
                
                if (!slug || isNaN(level)) {
                    console.error('Error: User slug and trust level (0.0-1.0) are required');
                    process.exit(1);
                }
                
                const result = tracker.setTrustLevel(slug, level, options.reason);
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Set trust level for ${slug}: ${result.previousTrust} -> ${result.newTrust}`);
                break;
            }

            case 'get-trust': {
                const slug = options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    process.exit(1);
                }
                
                const result = tracker.getTrustLevel(slug);
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Trust level for ${result.slug}: ${result.trustLevel} (${result.relationshipType})`);
                break;
            }

            case 'adjust-trust': {
                const slug = options.arg;
                const delta = parseFloat(options.arg2);
                
                if (!slug || isNaN(delta)) {
                    console.error('Error: User slug and delta are required');
                    process.exit(1);
                }
                
                const result = tracker.adjustTrust(slug, delta, options.reason || 'manual_adjustment');
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Adjusted trust for ${slug}: delta=${delta}, new=${result.newTrust}`);
                break;
            }

            case 'set-type': {
                const slug = options.arg;
                const type = options.type || options.arg2;
                
                if (!slug || !type) {
                    console.error('Error: User slug and relationship type are required');
                    process.exit(1);
                }
                
                const result = tracker.setRelationshipType(slug, type);
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Set relationship type for ${slug}: ${result.previousType} -> ${result.newType}`);
                break;
            }

            case 'add-relation': {
                const slug1 = options.arg;
                const slug2 = options.arg2;
                
                if (!slug1 || !slug2) {
                    console.error('Error: Two user slugs are required');
                    process.exit(1);
                }
                
                const result = tracker.addRelationship(slug1, slug2, options.type || 'collaborator');
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Added relationship: ${slug1} <-> ${slug2} (${options.type || 'collaborator'})`);
                break;
            }

            case 'add-agent': {
                const userSlug = options.arg;
                const agentId = options.arg2;
                
                if (!userSlug || !agentId) {
                    console.error('Error: User slug and agent ID are required');
                    process.exit(1);
                }
                
                const result = tracker.addAgentRelationship(userSlug, agentId, {
                    type: options.type || 'interaction'
                });
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Added agent relationship: ${userSlug} <-> ${agentId}`);
                break;
            }

            case 'history': {
                const slug = options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    process.exit(1);
                }
                
                const result = tracker.getHistory(slug, options.limit || 50);
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `History for ${slug}:\n` +
                    result.events.map(e => `  [${e.timestamp}] ${e.type}: ${JSON.stringify(e)}`).join('\n'));
                break;
            }

            case 'graph': {
                const result = tracker.getGraph();
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Relationship Graph:\n` +
                    `  Nodes: ${result.nodes.length}\n` +
                    `  Edges: ${result.edges.length}\n` +
                    `  User-Agent Relations: ${Object.keys(result.userAgentRelations).length}`);
                break;
            }

            case 'user-relations': {
                const slug = options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    process.exit(1);
                }
                
                const result = tracker.getUserRelationships(slug);
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Relationships for ${slug}:\n` +
                    `  Type: ${result.relationshipType}, Trust: ${result.trustLevel}\n` +
                    `  Direct Relations: ${result.directRelations.length}\n` +
                    `  Agent Relations: ${result.agentRelations.length}`);
                break;
            }

            case 'agent-relations': {
                const slug = options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    process.exit(1);
                }
                
                const result = tracker.getAgentRelationships(slug);
                console.log(options.json ? JSON.stringify(result, null, 2) :
                    `Agent relations for ${slug}:\n` +
                    result.map(r => `  ${r.agentId}: ${r.type} (trust: ${r.trustLevel})`).join('\n') || '  None');
                break;
            }

            case 'export': {
                const result = tracker.exportData();
                const outputPath = options.arg || path.join(RELATIONSHIPS_DIR, `export-${Date.now()}.json`);
                fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
                console.log(options.json ? JSON.stringify({ path: outputPath }, null, 2) :
                    `Exported relationship data to: ${outputPath}`);
                break;
            }

            case 'types': {
                const types = Object.entries(RELATIONSHIP_TYPES).map(([key, value]) => ({
                    type: key,
                    ...value
                }));
                console.log(options.json ? JSON.stringify(types, null, 2) :
                    'Relationship Types:\n' +
                    types.map(t => `  ${t.type}: ${t.description} (trust: ${t.defaultTrust}, range: ${t.minTrust}-${t.maxTrust})`).join('\n'));
                break;
            }

            case 'help':
            case '--help':
            case '-h':
            case undefined:
                console.log(`
Relationship Tracker - Trust and relationship management

Usage:
  node relationship-tracker.js <command> [options]

Trust Commands:
  set-trust <slug> <level>     Set trust level (0.0 - 1.0)
  get-trust <slug>             Get current trust level
  adjust-trust <slug> <delta>  Adjust trust by delta (+/-)
  set-type <slug> --type <t>   Set relationship type

Relationship Commands:
  add-relation <s1> <s2>       Add relationship between users
  add-agent <slug> <agentId>   Add agent relationship
  user-relations <slug>        Get all user relationships
  agent-relations <slug>       Get agent relationships

History & Graph:
  history <slug>               Get relationship history
  graph                        Show relationship graph
  export [path]                Export relationship data

Options:
  --type <type>     Relationship type
  --reason <text>   Reason for trust adjustment
  --limit <n>       Limit history results
  --json, -j        Output in JSON format

Relationship Types:
  primary      - Main project owner/leader (trust: 0.9)
  collaborator - Active development partner (trust: 0.7)
  partner      - Strategic organization (trust: 0.6)
  observer     - Passive viewer (trust: 0.3)
  client       - External customer (trust: 0.5)
  vendor       - Service provider (trust: 0.4)
  agent        - AI agent (trust: 0.8)

Examples:
  node relationship-tracker.js set-trust john-doe 0.85
  node relationship-tracker.js get-trust john-doe --json
  node relationship-tracker.js adjust-trust jane-doe 0.05 --reason "valuable_contribution"
  node relationship-tracker.js set-type bob --type collaborator
  node relationship-tracker.js add-relation john-doe jane-doe --type collaborator
  node relationship-tracker.js add-agent john-doe agent-alpha
  node relationship-tracker.js history john-doe --limit 20
  node relationship-tracker.js graph --json
`);
                break;

            default:
                console.error(`Unknown command: ${command}`);
                console.log('Run "node relationship-tracker.js help" for usage information');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Export for programmatic use
module.exports = { RelationshipTracker, RELATIONSHIP_TYPES, TRUST_ADJUSTMENTS };

// Run if called directly
if (require.main === module) {
    main();
}
