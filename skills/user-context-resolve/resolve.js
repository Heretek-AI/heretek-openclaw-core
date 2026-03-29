#!/usr/bin/env node
/**
 * User Context Resolution Skill
 * 
 * Resolves user identity from multiple platforms (Discord ID, phone number, 
 * username, UUID, email) and returns full user context for agent personalization.
 * 
 * Usage:
 *   node resolve.js --discord-id=123456789
 *   node resolve.js --phone="+15551234567"
 *   node resolve.js --username="johndoe"
 *   node resolve.js --uuid="550e8400-e29b-41d4-a716-446655440000"
 *   node resolve.js --email="user@example.com"
 */

const fs = require('fs');
const path = require('path');

// Paths - relative to this script's location
const SCRIPT_DIR = __dirname;
const USERS_DIR = path.join(SCRIPT_DIR, '../../users');
const INDEX_FILE = path.join(USERS_DIR, 'index.json');

/**
 * Parse command line arguments into key-value pairs
 * @returns {Object} Parsed parameters
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  args.forEach(arg => {
    // Handle --key=value format
    if (arg.startsWith('--')) {
      const equalIndex = arg.indexOf('=');
      if (equalIndex > 2) {
        const key = arg.slice(2, equalIndex);
        const value = arg.slice(equalIndex + 1);
        params[key] = value;
      } else {
        // Handle --flag format (boolean)
        params[arg.slice(2)] = true;
      }
    }
  });
  
  return params;
}

/**
 * Load the user index file
 * @returns {Object} User index with lookup maps
 */
function loadIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      const content = fs.readFileSync(INDEX_FILE, 'utf8');
      const index = JSON.parse(content);
      
      // Ensure lookup maps exist (for backward compatibility)
      return {
        version: index.version || '1.0',
        users: index.users || [],
        byDiscord: index.byDiscord || {},
        byPhone: index.byPhone || {},
        byUsername: index.byUsername || {},
        byUuid: index.byUuid || {},
        byEmail: index.byEmail || {}
      };
    }
  } catch (error) {
    console.error(JSON.stringify({ 
      error: 'Failed to load user index', 
      details: error.message 
    }, null, 2));
    process.exit(1);
  }
  
  return {
    version: '1.0',
    users: [],
    byDiscord: {},
    byPhone: {},
    byUsername: {},
    byUuid: {},
    byEmail: {}
  };
}

/**
 * Normalize phone number by removing non-digit characters
 * @param {string} phone - Phone number in any format
 * @returns {string} Normalized phone number (digits only)
 */
function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID format
 */
function isValidUuid(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Resolve user slug from various identifiers
 * @param {Object} params - Resolution parameters
 * @param {Object} index - User index
 * @returns {string|null} User slug or null if not found
 */
function resolveSlug(params, index) {
  // Direct UUID lookup
  if (params.uuid) {
    if (!isValidUuid(params.uuid)) {
      return { error: 'Invalid UUID format', params };
    }
    return index.byUuid[params.uuid.toLowerCase()] || null;
  }
  
  // Discord ID lookup
  if (params['discord-id']) {
    return index.byDiscord[params['discord-id']] || null;
  }
  
  // Phone number lookup (normalize to digits only)
  if (params.phone) {
    const normalizedPhone = normalizePhone(params.phone);
    return index.byPhone[normalizedPhone] || null;
  }
  
  // Username lookup (case-insensitive)
  if (params.username) {
    return index.byUsername[params.username.toLowerCase()] || null;
  }
  
  // Email lookup (case-insensitive)
  if (params.email) {
    return index.byEmail[params.email.toLowerCase()] || null;
  }
  
  return null;
}

/**
 * Load user profile by slug
 * @param {string} slug - User slug
 * @returns {Object|null} User profile or null if not found
 */
function loadProfile(slug) {
  // Try UUID-based folder first (new format)
  let profilePath = path.join(USERS_DIR, slug, 'profile.json');
  
  if (fs.existsSync(profilePath)) {
    try {
      const content = fs.readFileSync(profilePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  return null;
}

/**
 * Build user context response
 * @param {Object} profile - User profile
 * @returns {Object} Formatted user context
 */
function buildContext(profile) {
  return {
    success: true,
    user: {
      uuid: profile.uuid,
      username: profile.username || profile.slug,
      name: profile.name,
      pronouns: profile.pronouns,
      timezone: profile.timezone,
      languages: profile.languages,
      platforms: profile.platforms || {},
      preferences: profile.preferences || {},
      relationship: profile.relationship,
      createdAt: profile.createdAt || profile.created,
      lastActive: profile.lastActive || profile.last_interaction
    }
  };
}

/**
 * Main resolution function
 * @param {Object} params - Resolution parameters
 * @returns {Object} Resolution result
 */
function resolveUser(params) {
  // Check if any identifier was provided
  const hasIdentifier = params.uuid || params['discord-id'] || 
                        params.phone || params.username || params.email;
  
  if (!hasIdentifier) {
    return { 
      error: 'No identifier provided', 
      params,
      usage: 'Use --discord-id, --phone, --username, --uuid, or --email'
    };
  }
  
  const index = loadIndex();
  const slugOrError = resolveSlug(params, index);
  
  // Handle error from UUID validation
  if (slugOrError && slugOrError.error) {
    return slugOrError;
  }
  
  const slug = slugOrError;
  
  if (!slug) {
    return { error: 'User not found', params };
  }
  
  const profile = loadProfile(slug);
  
  if (!profile) {
    return { error: 'User profile not found', slug, params };
  }
  
  return buildContext(profile);
}

/**
 * Main entry point
 */
function main() {
  const params = parseArgs();
  
  // Show help if requested
  if (params.help || params.h) {
    console.log(`
User Context Resolution Skill

Usage:
  node resolve.js [options]

Options:
  --discord-id=ID    Resolve by Discord user ID (snowflake)
  --phone=NUMBER     Resolve by phone number (E.164 or any format)
  --username=NAME    Resolve by username (case-insensitive)
  --uuid=UUID        Resolve by UUID (RFC 4122 format)
  --email=EMAIL      Resolve by email address (case-insensitive)
  --help, -h         Show this help message

Output:
  JSON object with user context or error message
`);
    process.exit(0);
  }
  
  const result = resolveUser(params);
  console.log(JSON.stringify(result, null, 2));
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Export for use as module
module.exports = { resolveUser, loadIndex, loadProfile, buildContext };

// Run if executed directly
if (require.main === module) {
  main();
}
