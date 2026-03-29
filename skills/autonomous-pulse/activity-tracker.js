#!/usr/bin/env node
/**
 * Activity Tracker - Tracks and logs autonomous activities
 * 
 * This module provides activity tracking for the autonomous pulse system,
 * enabling detailed logging of research findings, code changes, decisions,
 * and next steps.
 * 
 * Usage:
 *   node activity-tracker.js log "Discovered new RAG framework"
 *   node activity-tracker.js list
 *   node activity-tracker.js report
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = process.env.ACTIVITY_DB_PATH || 
    path.join(__dirname, 'activity-log.db');
const NIGHT_LOG_PATH = process.env.NIGHT_LOG_PATH || 
    path.join(process.cwd(), 'night-log.md');

// Simple SQLite-like JSON storage (for portability)
const STATE_PATH = path.join(__dirname, 'activity-state.json');

/**
 * Activity categories
 */
const CATEGORIES = {
    research: '📚 Research',
    code: '💻 Code',
    decision: '🎯 Decision',
    question: '❓ Question',
    next_step: '➡️ Next Step',
    commit: '📤 Commit',
    push: '🚀 Push',
    pulse: '💓 Pulse',
    learning: '🧠 Learning',
    insight: '💡 Insight'
};

/**
 * Load activity state
 */
function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('[ActivityTracker] Failed to load state:', e.message);
    }
    
    return {
        activities: [],
        stats: {
            total: 0,
            by_category: {},
            started: new Date().toISOString()
        }
    };
}

/**
 * Save activity state
 */
function saveState(state) {
    try {
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('[ActivityTracker] Failed to save state:', e.message);
    }
}

/**
 * Log an activity
 */
function logActivity(category, message, metadata = {}) {
    const state = loadState();
    
    const activity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        category,
        message,
        metadata
    };
    
    // Add to activities (keep last 100)
    state.activities.push(activity);
    if (state.activities.length > 100) {
        state.activities = state.activities.slice(-100);
    }
    
    // Update stats
    state.stats.total++;
    state.stats.by_category[category] = (state.stats.by_category[category] || 0) + 1;
    
    saveState(state);
    
    // Also append to night log
    appendToNightLog(activity);
    
    console.log(`[ActivityTracker] Logged: [${CATEGORIES[category] || category}] ${message}`);
    
    return activity;
}

/**
 * Append activity to night log
 */
function appendToNightLog(activity) {
    const categoryEmoji = CATEGORIES[activity.category] || activity.category;
    const entry = `- **[${activity.timestamp}]** ${categoryEmoji}: ${activity.message}\n`;
    
    try {
        // Ensure night log exists
        if (!fs.existsSync(NIGHT_LOG_PATH)) {
            const header = `# Night Operations Log\n\n**Started:** ${new Date().toISOString()}\n**Status:** Active\n\n---\n\n## Activity Log\n\n`;
            fs.writeFileSync(NIGHT_LOG_PATH, header);
        }
        
        fs.appendFileSync(NIGHT_LOG_PATH, entry);
    } catch (e) {
        console.error('[ActivityTracker] Failed to append to night log:', e.message);
    }
}

/**
 * List recent activities
 */
function listActivities(limit = 20) {
    const state = loadState();
    const activities = state.activities.slice(-limit);
    
    console.log(`\n=== Recent Activities (${activities.length}) ===\n`);
    
    activities.forEach(act => {
        const categoryEmoji = CATEGORIES[act.category] || act.category;
        console.log(`[${act.timestamp}] ${categoryEmoji}: ${act.message}`);
        if (Object.keys(act.metadata).length > 0) {
            console.log(`    Metadata:`, act.metadata);
        }
    });
}

/**
 * Generate activity report
 */
function generateReport() {
    const state = loadState();
    
    console.log('\n=== Activity Report ===\n');
    console.log(`**Session Started:** ${state.stats.started}`);
    console.log(`**Total Activities:** ${state.stats.total}`);
    console.log('\n**By Category:**');
    
    Object.entries(state.stats.by_category)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
            const emoji = CATEGORIES[category] || category;
            const bar = '█'.repeat(Math.min(count, 20));
            console.log(`  ${emoji}: ${bar} (${count})`);
        });
    
    console.log('\n**Recent Highlights:**');
    const recent = state.activities.slice(-5);
    recent.forEach(act => {
        const categoryEmoji = CATEGORIES[act.category] || act.category;
        console.log(`  - ${categoryEmoji}: ${act.message}`);
    });
}

/**
 * Get activities as JSON
 */
function getActivitiesJSON() {
    const state = loadState();
    return JSON.stringify(state, null, 2);
}

/**
 * Clear old activities
 */
function clearOldActivities(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const state = loadState();
    const cutoff = Date.now() - maxAge;
    
    const originalCount = state.activities.length;
    state.activities = state.activities.filter(act => {
        const timestamp = new Date(act.timestamp).getTime();
        return timestamp > cutoff;
    });
    
    const removed = originalCount - state.activities.length;
    if (removed > 0) {
        console.log(`[ActivityTracker] Cleared ${removed} old activities`);
        saveState(state);
    }
    
    return removed;
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'log':
        const category = args[1] || 'general';
        const message = args.slice(2).join(' ');
        if (message) {
            logActivity(category, message);
        } else {
            console.log('Usage: node activity-tracker.js log <category> <message>');
            console.log('Categories:', Object.keys(CATEGORIES).join(', '));
        }
        break;
        
    case 'list':
        listActivities(parseInt(args[1]) || 20);
        break;
        
    case 'report':
        generateReport();
        break;
        
    case 'json':
        console.log(getActivitiesJSON());
        break;
        
    case 'clear':
        const cleared = clearOldActivities();
        console.log(`Cleared ${cleared} old activities`);
        break;
        
    default:
        console.log('Activity Tracker - Autonomous Activity Logging');
        console.log('');
        console.log('Usage:');
        console.log('  node activity-tracker.js log <category> <message>  - Log an activity');
        console.log('  node activity-tracker.js list [count]              - List recent activities');
        console.log('  node activity-tracker.js report                    - Generate activity report');
        console.log('  node activity-tracker.js json                      - Output activities as JSON');
        console.log('  node activity-tracker.js clear                     - Clear old activities');
        console.log('');
        console.log('Categories:');
        Object.entries(CATEGORIES).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
}
