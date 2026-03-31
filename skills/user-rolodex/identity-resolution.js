#!/usr/bin/env node
/**
 * identity-resolution.js - Multi-platform identity resolution system
 * 
 * Provides identity lookup and resolution across multiple platforms:
 * - Discord ID/Username
 * - Phone Number
 * - Email Address
 * - GitHub Username
 * - Slack ID/Username
 * - Telegram ID/Username
 * - System Username
 * 
 * Features:
 * - UUID canonical identifier system
 * - Cross-platform identity linking
 * - Reverse lookup by any platform identifier
 * - Identity verification status tracking
 * 
 * Usage:
 *   node identity-resolution.js lookup-discord <discord_id>
 *   node identity-resolution.js lookup-email <email>
 *   node identity-resolution.js lookup-phone <phone>
 *   node identity-resolution.js lookup-github <username>
 *   node identity-resolution.js link <user_slug> --discord <id>
 *   node identity-resolution.js resolve <identifier>
 */

const fs = require('fs');
const path = require('path');

// Configuration
const USERS_DIR = process.env.USERS_DIR || path.join(process.cwd(), 'users');
const USER_INDEX = process.env.USER_INDEX || path.join(USERS_DIR, 'index.json');

/**
 * IdentityResolver - Multi-platform identity resolution
 */
class IdentityResolver {
    constructor() {
        this.usersDir = USERS_DIR;
        this.indexFile = USER_INDEX;
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
            console.error('[IdentityResolver] Failed to load index:', e.message);
        }
        return { users: [], updatedAt: new Date().toISOString() };
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
     * Load all user profiles
     */
    loadAllProfiles() {
        const profiles = [];
        
        for (const userEntry of this.index.users) {
            const { slug } = userEntry;
            const profilePath = this.getProfilePath(slug);
            
            if (fs.existsSync(profilePath)) {
                const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
                profiles.push(profile);
            }
        }
        
        return profiles;
    }

    /**
     * Find user by Discord ID
     */
    findByDiscordId(discordId) {
        const profiles = this.loadAllProfiles();
        
        for (const profile of profiles) {
            if (profile.platforms?.discord?.id === discordId) {
                return {
                    found: true,
                    user: profile,
                    platform: 'discord',
                    identifier: discordId,
                    verified: profile.platforms.discord.verified || false
                };
            }
        }
        
        return { found: false, platform: 'discord', identifier: discordId };
    }

    /**
     * Find user by Discord username
     */
    findByDiscordUsername(username) {
        const profiles = this.loadAllProfiles();
        
        for (const profile of profiles) {
            const discord = profile.platforms?.discord;
            if (discord?.username === username || discord?.nickname === username) {
                return {
                    found: true,
                    user: profile,
                    platform: 'discord',
                    identifier: username,
                    verified: discord.verified || false
                };
            }
        }
        
        return { found: false, platform: 'discord', identifier: username };
    }

    /**
     * Find user by phone number
     */
    findByPhoneNumber(phoneNumber) {
        const profiles = this.loadAllProfiles();
        // Normalize phone number (remove non-digits)
        const normalized = phoneNumber.replace(/\D/g, '');
        
        for (const profile of profiles) {
            const phone = profile.platforms?.phone?.number;
            if (phone) {
                const normalizedPhone = phone.replace(/\D/g, '');
                if (normalizedPhone === normalized || normalizedPhone.includes(normalized)) {
                    return {
                        found: true,
                        user: profile,
                        platform: 'phone',
                        identifier: phoneNumber,
                        verified: profile.platforms.phone.verified || false
                    };
                }
            }
        }
        
        return { found: false, platform: 'phone', identifier: phoneNumber };
    }

    /**
     * Find user by email address
     */
    findByEmail(email) {
        const profiles = this.loadAllProfiles();
        const normalizedEmail = email.toLowerCase().trim();
        
        for (const profile of profiles) {
            const profileEmail = profile.platforms?.web?.email;
            if (profileEmail && profileEmail.toLowerCase().trim() === normalizedEmail) {
                return {
                    found: true,
                    user: profile,
                    platform: 'web',
                    identifier: email,
                    verified: true // Email verification implied by storage
                };
            }
        }
        
        return { found: false, platform: 'web', identifier: email };
    }

    /**
     * Find user by GitHub username
     */
    findByGithubUsername(username) {
        const profiles = this.loadAllProfiles();
        
        for (const profile of profiles) {
            const github = profile.platforms?.github;
            if (github?.username === username || github?.id === username) {
                return {
                    found: true,
                    user: profile,
                    platform: 'github',
                    identifier: username,
                    verified: true
                };
            }
        }
        
        return { found: false, platform: 'github', identifier: username };
    }

    /**
     * Find user by Slack ID
     */
    findBySlackId(slackId) {
        const profiles = this.loadAllProfiles();
        
        for (const profile of profiles) {
            const slack = profile.platforms?.slack;
            if (slack?.id === slackId || slack?.username === slackId) {
                return {
                    found: true,
                    user: profile,
                    platform: 'slack',
                    identifier: slackId,
                    verified: true
                };
            }
        }
        
        return { found: false, platform: 'slack', identifier: slackId };
    }

    /**
     * Find user by Telegram ID/username
     */
    findByTelegramId(telegramId) {
        const profiles = this.loadAllProfiles();
        
        for (const profile of profiles) {
            const telegram = profile.platforms?.telegram;
            if (telegram?.id === telegramId || telegram?.username === telegramId) {
                return {
                    found: true,
                    user: profile,
                    platform: 'telegram',
                    identifier: telegramId,
                    verified: true
                };
            }
        }
        
        return { found: false, platform: 'telegram', identifier: telegramId };
    }

    /**
     * Find user by system username/slug
     */
    findByUsername(username) {
        const profilePath = this.getProfilePath(username);
        
        if (fs.existsSync(profilePath)) {
            const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            return {
                found: true,
                user: profile,
                platform: 'system',
                identifier: username,
                verified: true
            };
        }
        
        // Also check by UUID
        const profiles = this.loadAllProfiles();
        for (const profile of profiles) {
            if (profile.uuid === username || profile.username === username) {
                return {
                    found: true,
                    user: profile,
                    platform: 'system',
                    identifier: username,
                    verified: true
                };
            }
        }
        
        return { found: false, platform: 'system', identifier: username };
    }

    /**
     * Universal resolve - try all platforms to find user
     */
    resolve(identifier) {
        // Try each platform in order of specificity
        const resolvers = [
            this.findByUsername.bind(this),
            this.findByEmail.bind(this),
            this.findByDiscordId.bind(this),
            this.findByDiscordUsername.bind(this),
            this.findByPhoneNumber.bind(this),
            this.findByGithubUsername.bind(this),
            this.findBySlackId.bind(this),
            this.findByTelegramId.bind(this)
        ];
        
        for (const resolver of resolvers) {
            const result = resolver(identifier);
            if (result.found) {
                return result;
            }
        }
        
        return { found: false, identifier, searchedPlatforms: ['system', 'web', 'discord', 'phone', 'github', 'slack', 'telegram'] };
    }

    /**
     * Link a platform identity to a user
     */
    linkIdentity(slug, platform, identityData) {
        const profilePath = this.getProfilePath(slug);
        
        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }
        
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        
        if (!profile.platforms[platform]) {
            throw new Error(`Unknown platform: ${platform}`);
        }
        
        // Update platform identity
        profile.platforms[platform] = {
            ...profile.platforms[platform],
            ...identityData,
            linkedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
        
        return {
            success: true,
            slug,
            platform,
            identity: profile.platforms[platform]
        };
    }

    /**
     * Link Discord identity
     */
    linkDiscord(slug, discordId, username = null) {
        return this.linkIdentity(slug, 'discord', {
            id: discordId,
            username: username,
            discriminator: null,
            nickname: null,
            verified: true
        });
    }

    /**
     * Link phone number
     */
    linkPhone(slug, phoneNumber) {
        return this.linkIdentity(slug, 'phone', {
            number: phoneNumber,
            verified: false
        });
    }

    /**
     * Link email address
     */
    linkEmail(slug, email) {
        return this.linkIdentity(slug, 'web', {
            email: email,
            sessions: []
        });
    }

    /**
     * Link GitHub identity
     */
    linkGithub(slug, githubId, username = null) {
        return this.linkIdentity(slug, 'github', {
            id: githubId,
            username: username
        });
    }

    /**
     * Link Slack identity
     */
    linkSlack(slug, slackId, teamId = null, username = null) {
        return this.linkIdentity(slug, 'slack', {
            id: slackId,
            team_id: teamId,
            username: username
        });
    }

    /**
     * Link Telegram identity
     */
    linkTelegram(slug, telegramId, username = null) {
        return this.linkIdentity(slug, 'telegram', {
            id: telegramId,
            username: username
        });
    }

    /**
     * Get all linked identities for a user
     */
    getIdentities(slug) {
        const profilePath = this.getProfilePath(slug);
        
        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }
        
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        const identities = [];
        
        for (const [platform, data] of Object.entries(profile.platforms || {})) {
            if (data.id || data.email || data.number || data.username) {
                identities.push({
                    platform,
                    ...data
                });
            }
        }
        
        return {
            slug,
            uuid: profile.uuid,
            identities
        };
    }

    /**
     * Unlink a platform identity
     */
    unlinkIdentity(slug, platform) {
        const profilePath = this.getProfilePath(slug);
        
        if (!fs.existsSync(profilePath)) {
            throw new Error(`User ${slug} not found`);
        }
        
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        
        if (!profile.platforms[platform]) {
            throw new Error(`Platform ${platform} not found`);
        }
        
        const previousIdentity = { ...profile.platforms[platform] };
        
        // Reset platform data
        profile.platforms[platform] = {
            id: null,
            username: null,
            verified: false
        };
        
        // Platform-specific reset
        if (platform === 'web') {
            profile.platforms[platform] = { email: null, sessions: [] };
        } else if (platform === 'phone') {
            profile.platforms[platform] = { number: null, verified: false };
        } else if (platform === 'discord') {
            profile.platforms[platform] = { id: null, username: null, discriminator: null, nickname: null };
        } else if (platform === 'slack') {
            profile.platforms[platform] = { id: null, team_id: null, username: null };
        }
        
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
        
        return {
            success: true,
            slug,
            platform,
            unlinkedIdentity: previousIdentity
        };
    }

    /**
     * Build identity index for fast lookups
     */
    buildIdentityIndex() {
        const profiles = this.loadAllProfiles();
        const index = {
            byDiscordId: {},
            byDiscordUsername: {},
            byEmail: {},
            byPhone: {},
            byGithubUsername: {},
            bySlackId: {},
            byTelegramId: {},
            byUsername: {},
            byUuid: {},
            updatedAt: new Date().toISOString()
        };
        
        for (const profile of profiles) {
            // Index by UUID and username
            index.byUuid[profile.uuid] = profile.slug;
            index.byUsername[profile.username || profile.slug] = profile.slug;
            
            // Index by platform identities
            const platforms = profile.platforms || {};
            
            if (platforms.discord?.id) {
                index.byDiscordId[platforms.discord.id] = profile.slug;
            }
            if (platforms.discord?.username) {
                index.byDiscordUsername[platforms.discord.username] = profile.slug;
            }
            if (platforms.web?.email) {
                index.byEmail[platforms.web.email.toLowerCase()] = profile.slug;
            }
            if (platforms.phone?.number) {
                index.byPhone[platforms.phone.number.replace(/\D/g, '')] = profile.slug;
            }
            if (platforms.github?.username) {
                index.byGithubUsername[platforms.github.username] = profile.slug;
            }
            if (platforms.slack?.id) {
                index.bySlackId[platforms.slack.id] = profile.slug;
            }
            if (platforms.telegram?.id) {
                index.byTelegramId[platforms.telegram.id] = profile.slug;
            }
        }
        
        return index;
    }

    /**
     * Save identity index
     */
    saveIdentityIndex(indexPath = null) {
        const index = this.buildIdentityIndex();
        const filePath = indexPath || path.join(this.usersDir, '_identity-index.json');
        
        fs.writeFileSync(filePath, JSON.stringify(index, null, 2));
        
        return {
            success: true,
            path: filePath,
            indexed: {
                discordIds: Object.keys(index.byDiscordId).length,
                discordUsernames: Object.keys(index.byDiscordUsername).length,
                emails: Object.keys(index.byEmail).length,
                phones: Object.keys(index.byPhone).length,
                githubUsernames: Object.keys(index.byGithubUsername).length,
                slackIds: Object.keys(index.bySlackId).length,
                telegramIds: Object.keys(index.byTelegramId).length,
                usernames: Object.keys(index.byUsername).length
            }
        };
    }

    /**
     * Load identity index for fast lookups
     */
    loadIdentityIndex(indexPath = null) {
        const filePath = indexPath || path.join(this.usersDir, '_identity-index.json');
        
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (e) {
            console.error('[IdentityResolver] Failed to load identity index:', e.message);
        }
        
        return null;
    }

    /**
     * Fast lookup using pre-built index
     */
    fastLookup(identifier) {
        const index = this.loadIdentityIndex();
        
        if (!index) {
            // Fall back to full resolution
            return this.resolve(identifier);
        }
        
        let slug = null;
        let platform = null;
        
        // Check all index maps
        if (index.byUuid[identifier]) {
            slug = index.byUuid[identifier];
            platform = 'uuid';
        } else if (index.byUsername[identifier]) {
            slug = index.byUsername[identifier];
            platform = 'username';
        } else if (index.byDiscordId[identifier]) {
            slug = index.byDiscordId[identifier];
            platform = 'discord';
        } else if (index.byDiscordUsername[identifier]) {
            slug = index.byDiscordUsername[identifier];
            platform = 'discord';
        } else if (index.byEmail[identifier.toLowerCase()]) {
            slug = index.byEmail[identifier.toLowerCase()];
            platform = 'web';
        } else if (index.byPhone[identifier.replace(/\D/g, '')]) {
            slug = index.byPhone[identifier.replace(/\D/g, '')];
            platform = 'phone';
        } else if (index.byGithubUsername[identifier]) {
            slug = index.byGithubUsername[identifier];
            platform = 'github';
        } else if (index.bySlackId[identifier]) {
            slug = index.bySlackId[identifier];
            platform = 'slack';
        } else if (index.byTelegramId[identifier]) {
            slug = index.byTelegramId[identifier];
            platform = 'telegram';
        }
        
        if (slug) {
            const profilePath = this.getProfilePath(slug);
            const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            return {
                found: true,
                user: profile,
                platform,
                identifier,
                verified: true
            };
        }
        
        return { found: false, identifier, searchedPlatforms: Object.keys(index).filter(k => k.startsWith('by')) };
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
        
        if (arg === '--slug' && args[i + 1]) {
            options.slug = args[i + 1];
            i++;
        } else if (arg === '--discord' && args[i + 1]) {
            options.discord = args[i + 1];
            i++;
        } else if (arg === '--discord-username' && args[i + 1]) {
            options.discordUsername = args[i + 1];
            i++;
        } else if (arg === '--phone' && args[i + 1]) {
            options.phone = args[i + 1];
            i++;
        } else if (arg === '--email' && args[i + 1]) {
            options.email = args[i + 1];
            i++;
        } else if (arg === '--github' && args[i + 1]) {
            options.github = args[i + 1];
            i++;
        } else if (arg === '--slack' && args[i + 1]) {
            options.slack = args[i + 1];
            i++;
        } else if (arg === '--telegram' && args[i + 1]) {
            options.telegram = args[i + 1];
            i++;
        } else if (arg === '--json' || arg === '-j') {
            options.json = true;
        } else if (!arg.startsWith('--')) {
            if (!options.arg) {
                options.arg = arg;
            } else {
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
    const resolver = new IdentityResolver();

    try {
        switch (command) {
            case 'lookup-discord': {
                const discordId = options.arg;
                if (!discordId) {
                    console.error('Error: Discord ID is required');
                    process.exit(1);
                }
                const result = resolver.findByDiscordId(discordId);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    result.found ? `Found user: ${result.user.name.full} (${result.user.slug})` : 'User not found');
                break;
            }

            case 'lookup-email': {
                const email = options.arg;
                if (!email) {
                    console.error('Error: Email is required');
                    process.exit(1);
                }
                const result = resolver.findByEmail(email);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    result.found ? `Found user: ${result.user.name.full} (${result.user.slug})` : 'User not found');
                break;
            }

            case 'lookup-phone': {
                const phone = options.arg;
                if (!phone) {
                    console.error('Error: Phone number is required');
                    process.exit(1);
                }
                const result = resolver.findByPhoneNumber(phone);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    result.found ? `Found user: ${result.user.name.full} (${result.user.slug})` : 'User not found');
                break;
            }

            case 'lookup-github': {
                const username = options.arg;
                if (!username) {
                    console.error('Error: GitHub username is required');
                    process.exit(1);
                }
                const result = resolver.findByGithubUsername(username);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    result.found ? `Found user: ${result.user.name.full} (${result.user.slug})` : 'User not found');
                break;
            }

            case 'resolve': {
                const identifier = options.arg;
                if (!identifier) {
                    console.error('Error: Identifier is required');
                    process.exit(1);
                }
                const result = resolver.resolve(identifier);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    result.found ? `Resolved to: ${result.user.name.full} (${result.user.slug}) via ${result.platform}` : 
                    `Not found. Searched: ${result.searchedPlatforms?.join(', ')}`);
                break;
            }

            case 'link': {
                const slug = options.slug || options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    process.exit(1);
                }
                
                let result;
                if (options.discord) {
                    result = resolver.linkDiscord(slug, options.discord, options.discordUsername);
                } else if (options.phone) {
                    result = resolver.linkPhone(slug, options.phone);
                } else if (options.email) {
                    result = resolver.linkEmail(slug, options.email);
                } else if (options.github) {
                    result = resolver.linkGithub(slug, options.github);
                } else if (options.slack) {
                    result = resolver.linkSlack(slug, options.slack);
                } else if (options.telegram) {
                    result = resolver.linkTelegram(slug, options.telegram);
                } else {
                    console.error('Error: Platform identity is required (--discord, --phone, --email, etc.)');
                    process.exit(1);
                }
                
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    `Linked ${Object.keys(result.identity).filter(k => result.identity[k]).join(', ')} to ${slug}`);
                break;
            }

            case 'unlink': {
                const slug = options.slug || options.arg;
                const platform = options.arg2;
                
                if (!slug || !platform) {
                    console.error('Error: User slug and platform are required');
                    console.log('Usage: node identity-resolution.js unlink <slug> <platform>');
                    process.exit(1);
                }
                
                const result = resolver.unlinkIdentity(slug, platform);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    `Unlinked ${platform} from ${slug}`);
                break;
            }

            case 'identities': {
                const slug = options.arg;
                if (!slug) {
                    console.error('Error: User slug is required');
                    process.exit(1);
                }
                const result = resolver.getIdentities(slug);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    `Identities for ${slug}:\n` + 
                    result.identities.map(i => `  ${i.platform}: ${i.id || i.email || i.number || i.username}`).join('\n'));
                break;
            }

            case 'build-index': {
                const result = resolver.saveIdentityIndex();
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    `Built identity index: ${JSON.stringify(result.indexed)}`);
                break;
            }

            case 'fast-lookup': {
                const identifier = options.arg;
                if (!identifier) {
                    console.error('Error: Identifier is required');
                    process.exit(1);
                }
                const result = resolver.fastLookup(identifier);
                console.log(options.json ? JSON.stringify(result, null, 2) : 
                    result.found ? `Found: ${result.user.name.full} (${result.user.slug}) via ${result.platform}` : 'Not found');
                break;
            }

            case 'help':
            case '--help':
            case '-h':
            case undefined:
                console.log(`
Identity Resolution - Multi-platform user identity lookup and linking

Usage:
  node identity-resolution.js <command> [options]

Lookup Commands:
  lookup-discord <id>        Find user by Discord ID
  lookup-email <email>       Find user by email address
  lookup-phone <phone>       Find user by phone number
  lookup-github <username>   Find user by GitHub username
  resolve <identifier>       Universal lookup (tries all platforms)
  fast-lookup <id>           Fast lookup using pre-built index

Link Commands:
  link <slug> --discord <id> [--discord-username <name>]
  link <slug> --phone <number>
  link <slug> --email <email>
  link <slug> --github <id|username>
  link <slug> --slack <id>
  link <slug> --telegram <id>

Management Commands:
  unlink <slug> <platform>   Remove platform identity
  identities <slug>          Show all linked identities
  build-index                Build fast lookup index

Options:
  --json, -j    Output in JSON format
  --slug        Specify user slug for link commands

Examples:
  node identity-resolution.js lookup-discord 123456789
  node identity-resolution.js lookup-email user@example.com
  node identity-resolution.js resolve 123456789
  node identity-resolution.js link john-doe --discord 123456789 --discord-username johnd
  node identity-resolution.js link jane-doe --email jane@example.com
  node identity-resolution.js identities john-doe
  node identity-resolution.js build-index
`);
                break;

            default:
                console.error(`Unknown command: ${command}`);
                console.log('Run "node identity-resolution.js help" for usage information');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Export for programmatic use
module.exports = { IdentityResolver };

// Run if called directly
if (require.main === module) {
    main();
}
