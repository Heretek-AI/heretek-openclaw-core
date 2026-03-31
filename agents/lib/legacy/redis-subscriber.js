#!/usr/bin/env node
/**
 * Heretek OpenClaw — Redis A2A Subscriber (Node.js)
 * ================================================
 * Real-time message subscription for A2A agent communication.
 * This provides instant message delivery instead of polling.
 * 
 * Channels:
 *   - a2a:{agent_name}    - Direct messages to this agent
 *   - global-workspace:broadcast - Consciousness broadcasts
 *   - channel:general     - General communication
 *   - channel:tasks       - Task distribution
 *   - channel:insights   - Knowledge sharing
 *   - channel:emergence  - Emergent patterns
 *   - channel:consciousness - Consciousness-level messages
 * 
 * Run: node agents/lib/redis-subscriber.js
 */

const Redis = require('ioredis');

// Configuration from environment
const config = {
    agentName: process.env.AGENT_NAME || 'steward',
    redisHost: process.env.REDIS_HOST || 'redis',
    redisPort: process.env.REDIS_PORT || 6379,
    stateDir: process.env.STATE_DIR || '/app/state',
    logFile: process.env.LOG_FILE || '/app/state/redis-subscriber.log'
};

// Logging utility
function log(level, message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [REDIS-SUB] [${level}] ${message}`;
    console.log(entry);
    
    // Also write to file
    const fs = require('fs');
    try {
        fs.appendFileSync(config.logFile, entry + '\n');
    } catch (e) {
        // Ignore file write errors
    }
}

// Ensure state directory exists
const fs = require('fs');
try {
    fs.mkdirSync(config.stateDir, { recursive: true });
} catch (e) {}

// Redis client for subscription
const subscriber = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    retryStrategy: (times) => {
        const delay = Math.min(times * 500, 5000);
        log('WARN', `Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
    },
    maxRetriesPerRequest: Infinity
});

// Redis client for publishing
const publisher = new Redis({
    host: config.redisHost,
    port: config.redisPort
});

// Track connection status
let connected = false;

// Connection event handlers
subscriber.on('connect', () => {
    log('INFO', `Connected to Redis at ${config.redisHost}:${config.redisPort}`);
    connected = true;
});

subscriber.on('error', (err) => {
    log('ERROR', `Redis error: ${err.message}`);
    connected = false;
});

subscriber.on('close', () => {
    log('WARN', 'Redis connection closed');
    connected = false;
});

// Process incoming A2A message
function handleA2AMessage(message) {
    try {
        const data = JSON.parse(message);
        const from = data.from || 'unknown';
        const type = data.type || 'unknown';
        const id = data.id || '';
        
        log('INFO', `A2A message from ${from} (type: ${type}, id: ${id})`);
        
        // Write to message queue for main loop
        const queueFile = `${config.stateDir}/redis-messages.jsonl`;
        fs.appendFileSync(queueFile, JSON.stringify({
            ...data,
            _receivedAt: new Date().toISOString(),
            _channel: `a2a:${config.agentName}`
        }) + '\n');
        
        // Signal new message
        const signalFile = `${config.stateDir}/new-message`;
        try {
            fs.writeFileSync(signalFile, Date.now().toString());
        } catch (e) {}
        
        return true;
    } catch (e) {
        log('WARN', `Invalid JSON in A2A message: ${e.message}`);
        return false;
    }
}

// Process workspace broadcast
function handleWorkspaceBroadcast(message) {
    try {
        const data = JSON.parse(message);
        const type = data.type || 'broadcast';
        
        log('INFO', `Workspace broadcast: ${type}`);
        
        // Store in collective memory
        const file = `${config.stateDir}/workspace-broadcasts.jsonl`;
        fs.appendFileSync(file, JSON.stringify({
            ...data,
            _receivedAt: new Date().toISOString()
        }) + '\n');
        
        return true;
    } catch (e) {
        log('WARN', `Invalid JSON in workspace broadcast: ${e.message}`);
        return false;
    }
}

// Process channel message
function handleChannelMessage(channel, message) {
    try {
        const data = JSON.parse(message);
        const channelName = channel.replace('channel:', '');
        const from = data.from || 'unknown';
        
        log('INFO', `Channel ${channelName} message from ${from}`);
        
        // Store in channel archive
        const file = `${config.stateDir}/channel-${channelName}.jsonl`;
        fs.appendFileSync(file, JSON.stringify({
            ...data,
            _receivedAt: new Date().toISOString()
        }) + '\n');
        
        return true;
    } catch (e) {
        log('WARN', `Invalid JSON in channel message: ${e.message}`);
        return false;
    }
}

// Main message handler
function handleMessage(channel, message) {
    // Skip PONG and empty messages
    if (!message || message === 'PONG') return;
    
    log('DEBUG', `Received on ${channel}: ${message.substring(0, 100)}...`);
    
    // Route based on channel
    if (channel === `a2a:${config.agentName}`) {
        handleA2AMessage(message);
    } else if (channel === 'global-workspace:broadcast') {
        handleWorkspaceBroadcast(message);
    } else if (channel.startsWith('channel:')) {
        handleChannelMessage(channel, message);
    } else {
        log('DEBUG', `Unknown channel: ${channel}`);
    }
}

// Publish to an agent's A2A channel
async function publishToAgent(toAgent, message) {
    const channel = `a2a:${toAgent}`;
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    log('INFO', `Publishing to ${channel}`);
    
    try {
        await publisher.publish(channel, payload);
        return true;
    } catch (e) {
        log('ERROR', `Failed to publish: ${e.message}`);
        return false;
    }
}

// Publish to a channel
async function publishToChannel(channelName, message) {
    const channel = `channel:${channelName}`;
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    log('INFO', `Publishing to channel ${channelName}`);
    
    try {
        await publisher.publish(channel, payload);
        return true;
    } catch (e) {
        log('ERROR', `Failed to publish to channel: ${e.message}`);
        return false;
    }
}

// Publish to global workspace
async function publishToWorkspace(message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    log('INFO', 'Publishing to global workspace');
    
    try {
        await publisher.publish('global-workspace:broadcast', payload);
        return true;
    } catch (e) {
        log('ERROR', `Failed to publish to workspace: ${e.message}`);
        return false;
    }
}

// Announce presence in Redis
async function announcePresence() {
    try {
        await publisher.set(`agent:${config.agentName}:subscriber:active`, 'true', 'EX', 300);
        log('INFO', 'Announced presence in Redis');
    } catch (e) {
        log('WARN', `Failed to announce presence: ${e.message}`);
    }
}

// Start subscriptions
async function startSubscribing() {
    const channels = [
        `a2a:${config.agentName}`,
        'global-workspace:broadcast',
        'channel:general',
        'channel:tasks',
        'channel:insights',
        'channel:emergence',
        'channel:consciousness'
    ];
    
    log('INFO', `Subscribing to channels: ${channels.join(', ')}`);
    
    // Subscribe using promisified subscribe
    await subscriber.subscribe(...channels);
    
    log('INFO', 'Subscription active');
    
    // Set up message handler
    subscriber.on('message', handleMessage);
}

// Graceful shutdown
function shutdown() {
    log('INFO', 'Shutting down Redis subscriber...');
    
    subscriber.unsubscribe();
    subscriber.quit();
    publisher.quit();
    
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Main execution
async function main() {
    log('INFO', '==========================================');
    log('INFO', 'Redis A2A Subscriber Starting');
    log('INFO', `Agent: ${config.agentName}`);
    log('INFO', `Redis: ${config.redisHost}:${config.redisPort}`);
    log('INFO', '==========================================');
    
    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start subscribing
    await startSubscribing();
    
    // Announce presence
    await announcePresence();
    
    log('INFO', 'Subscriber ready and listening');
}

main().catch(err => {
    log('ERROR', `Fatal error: ${err.message}`);
    process.exit(1);
});

// Export for external use
module.exports = {
    publishToAgent,
    publishToChannel,
    publishToWorkspace,
    config
};