#!/usr/bin/env node
/**
 * user-rolodex.js - Multi-platform user identity resolution and preference learning
 * 
 * Manages a rolodex of users for learning and adding new users.
 * Provides tools for user profile management, preference tracking, and relationship building.
 * 
 * Features:
 * - User Profiles: Structured user data storage
 * - Preference Learning: Implicit and explicit preference tracking
 * - Interaction History: Track all interactions with users
 * - Multi-User Support: Manage multiple user relationships
 * - Search & Lookup: Quick user retrieval by various attributes
 * - User Merging: Merge duplicate profiles while preserving data
 * 
 * Usage:
 *   node user-rolodex.js create --name "John Doe" --type primary
 *   node user-rolodex.js lookup john-doe
 *   node user-rolodex.js search --project "heretek-openclaw"
 *   node user-rolodex.js note john-doe "Discussed architecture" technical 0.8
 *   node user-rolodex.js prefer john-doe communication casual
 * 
 * Environment Variables:
 *   USERS_DIR     - Users directory (default: ./users)
 *   USER_SCHEMA   - Schema file (default: ./users/_schema.json)
 *   USER_INDEX    - Index file (default: ./users/index.json)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const USERS_DIR = process.env.USERS_DIR || path.join(process.cwd(), 'users');
const USER_SCHEMA = process.env.USER_SCHEMA || path.join(USERS_DIR, '_schema.json');
const USER_INDEX = process.env.USER_INDEX || path.join(USERS_DIR, 'index.json');

/**
 * Generate UUID v4
 */
function generateUUID() {
    return crypto.randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

/**
 * Slugify a string for use as directory name
 */
function slugify(str) {
    return str.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * UserRolodex - Manages user profiles and preferences
 */
class UserRolodex {
    constructor() {
        this.usersDir = USERS_DIR;
        this.indexFile = USER_INDEX;
        this.schemaFile = USER_SCHEMA;
        this.index = this.loadIndex();
    }

    /**
     * Load user index
     */
    loadIndex() {
        try {
            if (fs.existsSync(this.indexFile)) {
                const data = fs.readFileSync(this.indexFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('[UserRolodex] Failed to load index:', e.message);
        }
        return { users: [], updatedAt: new Date().toISOString() };
    }

    /**
     * Save user index
     */
    saveIndex() {
        try {
            this.index.updatedAt = new Date().toISOString();
            const dir = path.dirname(this.indexFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2));
        } catch (e) {
            console.error('[UserRolodex] Failed to save index:', e.message);
        }
    }

    /**
     * Get user directory path
     */
    getUserDir(slug) {
        return path.join(this.usersDir, slug);
    }

    /**
     * Get user profile path
     */
    getProfilePath(slug) {
        return path.join(this.getUserDir(slug), 'profile.json');
    }

    /**
     * Get user preferences path
     */
    getPreferencesPath(slug) {
        return path.join(this.getUserDir(slug), 'preferences.json');
    }

    /**
     * Get user history path
     */
    getHistoryPath(slug) {
        return path.join(this.getUserDir(slug), 'history.json');
    }

    /**
     * Create a new user
     */
    createUser(options = {}) {
        const {
            name,
            preferred,
            type = 'primary',
            trust = 0.5,
            timezone = 'UTC',
            pronouns = null,
            languages = ['en']
        } = options;

        if (!name) {
            throw new Error('User name is required');
        }

        const slug = slugify(name);
        const userDir = this.getUserDir(slug);

        // Check if user already exists
        if (fs.existsSync(userDir)) {
            throw new Error(`User ${slug} already exists`);
        }

        // Create user directory
        fs.mkdirSync(userDir, { recursive: true });

        // Create profile
        const profile = {
            uuid: generateUUID(),
            slug,
            username: slug,
            name: {
                full: name,
                preferred: preferred || name,
                phonetic: null
            },
            pronouns,
            timezone,
            languages,
            platforms: {
                discord: { id: null, username: null, discriminator: null, nickname: null },
                phone: { number: null, verified: false },
                web: { email: null, sessions: [] },
                github: { id: null, username: null },
                slack: { id: null, team_id: null, username: null }
            },
            preferences: {
                communicationStyle: 'adaptive',
                response_length: 'adaptive',
                preferredAgents: [],
                code_style: {
                    comments: 'standard',
                    naming: 'descriptive',
                    formatting: null
                },
                topics_of_interest: []
            },
            createdAt: new Date().toISOString(),
            created: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            last_interaction: new Date().toISOString(),
            relationship: {
                type,
                since: new Date().toISOString(),
                trust_level: trust
            },
            projects: [],
            context_notes: [],
            sessions: []
        };

        // Save profile
        fs.writeFileSync(this.getProfilePath(slug), JSON.stringify(profile, null, 2));

        // Initialize preferences file
        const preferences = {
            learned: [],
            explicit: [],
            implicit: []
        };
        fs.writeFileSync(this.getPreferencesPath(slug), JSON.stringify(preferences, null, 2));

        // Initialize history file
        const history = {
            interactions: [],
            sessions: [],
            notes: []
        };
        fs.writeFileSync(this.getHistoryPath(slug), JSON.stringify(history, null, 2));

        // Update index
        this.index.users.push({
            slug,
            name: profile.name.full,
            type,
            trust_level: trust,
            createdAt: profile.createdAt
        });
        this.saveIndex();

        return profile;
    }

    /**
     * Lookup a user by slug
     */
    lookupUser(slug, format = 'json') {
        const profilePath = this.getProfilePath(slug);

        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }

        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

        if (format === 'json') {
            return profile;
        }

        // Text format
        return this.formatUserProfile(profile);
    }

    /**
     * Format user profile for display
     */
    formatUserProfile(profile) {
        const lines = [
            `User: ${profile.name.full}`,
            `  Preferred: ${profile.name.preferred}`,
            `  Slug: ${profile.slug}`,
            `  UUID: ${profile.uuid}`,
            ``,
            `Relationship:`,
            `  Type: ${profile.relationship.type}`,
            `  Trust Level: ${profile.relationship.trust_level}`,
            `  Since: ${profile.relationship.since}`,
            ``,
            `Preferences:`,
            `  Communication: ${profile.preferences.communicationStyle}`,
            `  Response Length: ${profile.preferences.response_length}`,
            `  Code Comments: ${profile.preferences.code_style.comments}`,
            `  Code Naming: ${profile.preferences.code_style.naming}`,
            ``,
            `Topics of Interest: ${profile.preferences.topics_of_interest.join(', ') || 'None'}`,
            ``,
            `Projects:`,
            ...profile.projects.map(p => `  - ${p.name} (${p.role})`),
            ``,
            `Last Active: ${profile.lastActive}`
        ];

        return lines.join('\n');
    }

    /**
     * Update user information
     */
    updateUser(slug, updates = {}) {
        const profilePath = this.getProfilePath(slug);

        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }

        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

        // Apply updates
        if (updates.name) {
            profile.name.full = updates.name;
        }
        if (updates.preferred) {
            profile.name.preferred = updates.preferred;
        }
        if (updates.timezone) {
            profile.timezone = updates.timezone;
        }
        if (updates.pronouns !== undefined) {
            profile.pronouns = updates.pronouns;
        }
        if (updates.trust_level !== undefined) {
            profile.relationship.trust_level = updates.trust_level;
        }
        if (updates.type) {
            profile.relationship.type = updates.type;
        }

        profile.lastActive = new Date().toISOString();
        profile.updated = new Date().toISOString();

        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
        return profile;
    }

    /**
     * Search users by attribute
     */
    searchUsers(options = {}) {
        const results = [];

        for (const userEntry of this.index.users) {
            const { slug } = userEntry;
            const profilePath = this.getProfilePath(slug);

            if (!fs.existsSync(profilePath)) continue;

            const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            let match = true;

            // Search by project
            if (options.project) {
                const projectMatch = profile.projects?.some(p =>
                    p.name.toLowerCase().includes(options.project.toLowerCase())
                );
                if (!projectMatch) match = false;
            }

            // Search by type
            if (options.type) {
                if (profile.relationship.type !== options.type) match = false;
            }

            // Search by trust level (minimum)
            if (options.trust) {
                if (profile.relationship.trust_level < options.trust) match = false;
            }

            // Search by text in name
            if (options.query) {
                const query = options.query.toLowerCase();
                const nameMatch = profile.name.full.toLowerCase().includes(query) ||
                    profile.name.preferred.toLowerCase().includes(query) ||
                    profile.slug.includes(query);
                if (!nameMatch) match = false;
            }

            if (match) {
                results.push({
                    slug: profile.slug,
                    name: profile.name.full,
                    type: profile.relationship.type,
                    trust_level: profile.relationship.trust_level,
                    lastActive: profile.lastActive
                });
            }
        }

        return results;
    }

    /**
     * Add interaction note
     */
    addNote(slug, note, category = 'general', importance = 0.5) {
        const profilePath = this.getProfilePath(slug);

        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }

        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

        const noteEntry = {
            date: new Date().toISOString(),
            note,
            importance,
            category
        };

        profile.context_notes.push(noteEntry);
        profile.last_interaction = new Date().toISOString();

        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
        return noteEntry;
    }

    /**
     * Learn/update preference
     */
    setPreference(slug, category, key, value) {
        const profilePath = this.getProfilePath(slug);
        const preferencesPath = this.getPreferencesPath(slug);

        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }

        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

        // Map category to profile path
        const prefMap = {
            'communication': 'communicationStyle',
            'response': 'response_length',
            'code_comments': ['code_style', 'comments'],
            'code_naming': ['code_style', 'naming'],
            'topic': 'topics_of_interest'
        };

        const prefPath = prefMap[category];
        if (!prefPath) {
            throw new Error(`Unknown preference category: ${category}`);
        }

        if (Array.isArray(prefPath)) {
            profile.preferences[prefPath[0]][prefPath[1]] = value;
        } else if (prefPath === 'topics_of_interest') {
            if (!profile.preferences.topics_of_interest.includes(value)) {
                profile.preferences.topics_of_interest.push(value);
            }
        } else {
            profile.preferences[prefPath] = value;
        }

        // Update preferences file
        let prefs = { learned: [], explicit: [], implicit: [] };
        if (fs.existsSync(preferencesPath)) {
            prefs = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
        }

        prefs.explicit.push({
            category,
            key,
            value,
            timestamp: new Date().toISOString()
        });

        fs.writeFileSync(preferencesPath, JSON.stringify(prefs, null, 2));
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

        return profile.preferences;
    }

    /**
     * Merge duplicate profiles
     */
    mergeUsers(sourceSlug, targetSlug) {
        const sourcePath = this.getProfilePath(sourceSlug);
        const targetPath = this.getProfilePath(targetSlug);

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source user ${sourceSlug} not found`);
        }
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Target user ${targetSlug} not found`);
        }

        const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
        const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

        // Merge context notes
        for (const note of source.context_notes) {
            if (!target.context_notes.find(n => n.note === note.note)) {
                target.context_notes.push(note);
            }
        }

        // Merge projects
        for (const proj of source.projects) {
            if (!target.projects.find(p => p.name === proj.name)) {
                target.projects.push(proj);
            }
        }

        // Merge topics
        for (const topic of source.preferences.topics_of_interest) {
            if (!target.preferences.topics_of_interest.includes(topic)) {
                target.preferences.topics_of_interest.push(topic);
            }
        }

        // Keep higher trust level
        if (source.relationship.trust_level > target.relationship.trust_level) {
            target.relationship.trust_level = source.relationship.trust_level;
        }

        // Update target
        target.lastActive = new Date().toISOString();
        fs.writeFileSync(targetPath, JSON.stringify(target, null, 2));

        // Remove source from index
        this.index.users = this.index.users.filter(u => u.slug !== sourceSlug);
        this.saveIndex();

        // Archive source directory
        const archiveDir = path.join(this.usersDir, '_archived', sourceSlug);
        fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
        fs.renameSync(this.getUserDir(sourceSlug), archiveDir);

        return {
            merged: targetSlug,
            archived: sourceSlug,
            notes_merged: target.context_notes.length,
            projects_merged: target.projects.length
        };
    }

    /**
     * List all users
     */
    listUsers() {
        return this.index.users.map(u => ({
            slug: u.slug,
            name: u.name,
            type: u.type,
            trust_level: u.trust_level,
            createdAt: u.createdAt
        }));
    }

    /**
     * Update last interaction
     */
    updateInteraction(slug, sessionData = {}) {
        const profilePath = this.getProfilePath(slug);

        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }

        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

        profile.lastActive = new Date().toISOString();
        profile.last_interaction = new Date().toISOString();

        // Add session if provided
        if (sessionData.id) {
            profile.sessions = profile.sessions || [];
            profile.sessions.push({
                ...sessionData,
                endedAt: sessionData.endedAt || new Date().toISOString()
            });
        }

        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
        return profile;
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
        if (args[i] === '--name' && args[i + 1]) {
            options.name = args[i + 1];
            i++;
        } else if (args[i] === '--preferred' && args[i + 1]) {
            options.preferred = args[i + 1];
            i++;
        } else if (args[i] === '--type' && args[i + 1]) {
            options.type = args[i + 1];
            i++;
        } else if (args[i] === '--trust' && args[i + 1]) {
            options.trust = parseFloat(args[i + 1]);
            i++;
        } else if (args[i] === '--timezone' && args[i + 1]) {
            options.timezone = args[i + 1];
            i++;
        } else if (args[i] === '--pronouns' && args[i + 1]) {
            options.pronouns = args[i + 1];
            i++;
        } else if (args[i] === '--project' && args[i + 1]) {
            options.project = args[i + 1];
            i++;
        } else if (args[i] === '--json' || args[i] === '-j') {
            options.json = true;
        } else if (!args[i].startsWith('--')) {
            options.arg = args[i];
        }
    }

    return { command, options };
}

/**
 * Main function
 */
function main() {
    const { command, options } = parseArgs();
    const rolodex = new UserRolodex();

    try {
        switch (command) {
            case 'create': {
                const user = rolodex.createUser(options);
                if (options.json) {
                    console.log(JSON.stringify(user, null, 2));
                } else {
                    console.log(`Created user: ${user.name.full} (${user.slug})`);
                }
                break;
            }

            case 'lookup': {
                const slug = options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    console.log('Usage: node user-rolodex.js lookup <slug>');
                    process.exit(1);
                }
                const user = rolodex.lookupUser(slug, options.json ? 'json' : 'text');
                if (options.json) {
                    console.log(JSON.stringify(user, null, 2));
                } else {
                    console.log(user);
                }
                break;
            }

            case 'update': {
                const slug = options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    process.exit(1);
                }
                const updates = {};
                if (options.name) updates.name = options.name;
                if (options.preferred) updates.preferred = options.preferred;
                if (options.timezone) updates.timezone = options.timezone;
                if (options.trust) updates.trust_level = options.trust;
                if (options.type) updates.type = options.type;

                const user = rolodex.updateUser(slug, updates);
                console.log(options.json ? JSON.stringify(user, null, 2) : `Updated user: ${user.name.full}`);
                break;
            }

            case 'search': {
                const results = rolodex.searchUsers(options);
                if (options.json) {
                    console.log(JSON.stringify(results, null, 2));
                } else {
                    console.log(`Found ${results.length} user(s):`);
                    for (const r of results) {
                        console.log(`  - ${r.name} (${r.slug}) - ${r.type}, trust: ${r.trust_level}`);
                    }
                }
                break;
            }

            case 'note': {
                const slug = options.arg;
                const note = options._note || options.arg2;
                const category = options.category || 'general';
                const importance = options.importance || 0.5;

                if (!slug || !note) {
                    console.error('Error: User slug and note are required');
                    console.log('Usage: node user-rolodex.js note <slug> <note> [category] [importance]');
                    process.exit(1);
                }

                const noteEntry = rolodex.addNote(slug, note, category, importance);
                console.log(options.json ? JSON.stringify(noteEntry, null, 2) : `Added note for ${slug}`);
                break;
            }

            case 'prefer': {
                const slug = options.arg;
                const category = options.category || options.arg2;
                const key = options.key;
                const value = options.value;

                if (!slug || !category) {
                    console.error('Error: User slug and category are required');
                    process.exit(1);
                }

                const prefs = rolodex.setPreference(slug, category, key || category, value || key);
                console.log(options.json ? JSON.stringify(prefs, null, 2) : `Updated preferences for ${slug}`);
                break;
            }

            case 'merge': {
                const sourceSlug = options.arg;
                const targetSlug = options.arg2;

                if (!sourceSlug || !targetSlug) {
                    console.error('Error: Source and target slugs are required');
                    console.log('Usage: node user-rolodex.js merge <source> <target>');
                    process.exit(1);
                }

                const result = rolodex.mergeUsers(sourceSlug, targetSlug);
                console.log(options.json ? JSON.stringify(result, null, 2) : `Merged ${sourceSlug} into ${targetSlug}`);
                break;
            }

            case 'list': {
                const users = rolodex.listUsers();
                if (options.json) {
                    console.log(JSON.stringify(users, null, 2));
                } else {
                    console.log(`Users (${users.length}):`);
                    for (const u of users) {
                        console.log(`  - ${u.name} (${u.slug}) - ${u.type}, trust: ${u.trust_level}`);
                    }
                }
                break;
            }

            case 'help':
            case '--help':
            case '-h':
            case undefined:
                console.log(`
User Rolodex - Multi-platform user identity resolution

Usage:
  node user-rolodex.js <command> [options]

Commands:
  create              Create new user
  lookup <slug>       Lookup user by slug
  update <slug>       Update user information
  search              Search users by attribute
  note <slug> <note>  Add interaction note
  prefer <slug>       Learn/update preference
  merge <src> <tgt>   Merge duplicate profiles
  list                List all users
  help                Show this help

Create Options:
  --name <name>       User full name (required)
  --preferred <name>  Preferred name
  --type <type>       Relationship type (primary, collaborator, occasional)
  --trust <0-1>       Trust level (default: 0.5)
  --timezone <tz>     Timezone (default: UTC)
  --pronouns <pr>     Pronouns

Search Options:
  --project <name>    Search by project
  --type <type>       Search by type
  --trust <level>     Minimum trust level

Examples:
  node user-rolodex.js create --name "John Doe" --type primary
  node user-rolodex.js lookup john-doe --json
  node user-rolodex.js search --project "heretek-openclaw"
  node user-rolodex.js note john-doe "Discussed architecture" technical 0.8
  node user-rolodex.js prefer john-doe communication casual
`);
                break;

            default:
                console.error(`Unknown command: ${command}`);
                console.log('Run "node user-rolodex.js help" for usage information');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Export for programmatic use
module.exports = { UserRolodex, generateUUID, slugify };

// Run if called directly
if (require.main === module) {
    main();
}
