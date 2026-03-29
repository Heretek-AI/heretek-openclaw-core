/**
 * A2A Redis-based Communication Layer
 * 
 * Since LiteLLM doesn't have native A2A endpoints, this provides
 * a simple message passing system using Redis pub/sub.
 */

const Redis = require('ioredis');

// Lazy initialization of Redis client
let redis = null;
let subscriber = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });
  }
  return redis;
}

function getSubscriber() {
  if (!subscriber) {
    subscriber = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });
  }
  return subscriber;
}

/**
 * Send a message to another agent
 * @param {string} from - Sender agent ID
 * @param {string} to - Recipient agent ID
 * @param {string|object} content - Message content
 * @param {string} type - Message type (task, info, query, response, broadcast)
 * @returns {Promise<object>} - Result with success status and message ID
 */
async function sendMessage(from, to, content, type = 'task') {
  const message = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    from,
    to,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    type,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  try {
    const client = getRedis();
    
    // Publish to agent's channel for real-time subscribers
    await client.publish(`agent:${to}:inbox`, JSON.stringify(message));
    
    // Store in agent's message queue (persistent)
    await client.lpush(`agent:${to}:messages`, JSON.stringify(message));
    
    // Keep last 100 messages only
    await client.ltrim(`agent:${to}:messages`, 0, 99);
    
    // Update message status
    message.status = 'delivered';
    
    return { success: true, messageId: message.id, message };
  } catch (error) {
    message.status = 'failed';
    return { 
      success: false, 
      error: error.message,
      messageId: message.id 
    };
  }
}

/**
 * Get messages for an agent
 * @param {string} agentId - Agent ID to get messages for
 * @param {number} count - Number of messages to retrieve (default 10)
 * @returns {Promise<Array>} - Array of message objects
 */
async function getMessages(agentId, count = 10) {
  try {
    const client = getRedis();
    const messages = await client.lrange(`agent:${agentId}:messages`, 0, count - 1);
    return messages.map(m => {
      try {
        return JSON.parse(m);
      } catch {
        return { raw: m, parseError: true };
      }
    });
  } catch (error) {
    console.error(`Failed to get messages for ${agentId}:`, error.message);
    return [];
  }
}

/**
 * Subscribe to an agent's inbox for real-time messages
 * @param {string} agentId - Agent ID to subscribe to
 * @param {function} callback - Callback function(message) for incoming messages
 * @returns {Promise<object>} - Subscriber object with unsubscribe method
 */
async function subscribeToInbox(agentId, callback) {
  try {
    const sub = getSubscriber();
    const channel = `agent:${agentId}:inbox`;
    
    await sub.subscribe(channel);
    
    sub.on('message', (ch, messageStr) => {
      if (ch === channel) {
        try {
          const message = JSON.parse(messageStr);
          callback(message);
        } catch (error) {
          console.error('Failed to parse incoming message:', error.message);
        }
      }
    });
    
    return {
      success: true,
      channel,
      unsubscribe: async () => {
        await sub.unsubscribe(channel);
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Clear messages for an agent
 * @param {string} agentId - Agent ID to clear messages for
 * @returns {Promise<object>} - Result with success status
 */
async function clearMessages(agentId) {
  try {
    const client = getRedis();
    await client.del(`agent:${agentId}:messages`);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Get message count for an agent
 * @param {string} agentId - Agent ID to count messages for
 * @returns {Promise<number>} - Number of messages
 */
async function getMessageCount(agentId) {
  try {
    const client = getRedis();
    const count = await client.llen(`agent:${agentId}:messages`);
    return count;
  } catch (error) {
    console.error(`Failed to get message count for ${agentId}:`, error.message);
    return 0;
  }
}

/**
 * Broadcast a message to all agents
 * @param {string} from - Sender agent ID
 * @param {string|object} content - Message content
 * @param {Array<string>} excludeAgents - Agent IDs to exclude from broadcast
 * @returns {Promise<object>} - Result with success status and sent count
 */
async function broadcast(from, content, excludeAgents = []) {
  const allAgents = ['steward', 'alpha', 'beta', 'charlie', 'dreamer', 'empath', 'examiner', 'explorer', 'historian', 'sentinel'];
  const targetAgents = allAgents.filter(a => !excludeAgents.includes(a) && a !== from);
  
  const results = await Promise.all(
    targetAgents.map(agent => sendMessage(from, agent, content, 'broadcast'))
  );
  
  const successCount = results.filter(r => r.success).length;
  
  return {
    success: successCount === targetAgents.length,
    sentCount: successCount,
    totalTargets: targetAgents.length,
    results
  };
}

/**
 * Send a task request to an agent and wait for response
 * @param {string} from - Sender agent ID
 * @param {string} to - Target agent ID
 * @param {string|object} task - Task description
 * @param {number} timeoutMs - Timeout in milliseconds (default 30000)
 * @returns {Promise<object>} - Response or timeout error
 */
async function sendTaskAndWait(from, to, task, timeoutMs = 30000) {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      resolve({ 
        success: false, 
        error: 'Timeout waiting for response',
        timedOut: true 
      });
    }, timeoutMs);
    
    // Subscribe to response channel
    const sub = getSubscriber();
    const responseChannel = `agent:${from}:response:${to}`;
    
    await sub.subscribe(responseChannel);
    
    const handler = async (ch, messageStr) => {
      if (ch === responseChannel) {
        clearTimeout(timeout);
        await sub.unsubscribe(responseChannel);
        try {
          const message = JSON.parse(messageStr);
          resolve({ success: true, response: message });
        } catch (error) {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      }
    };
    
    sub.on('message', handler);
    
    // Send the task
    const result = await sendMessage(from, to, task, 'task');
    if (!result.success) {
      clearTimeout(timeout);
      await sub.unsubscribe(responseChannel);
      resolve(result);
    }
  });
}

/**
 * Ping an agent to check if it's responsive
 * @param {string} from - Sender agent ID
 * @param {string} to - Target agent ID
 * @returns {Promise<object>} - Ping result
 */
async function pingAgent(from, to) {
  const start = Date.now();
  const result = await sendMessage(from, to, { action: 'ping' }, 'ping');
  const latency = Date.now() - start;
  
  return {
    ...result,
    latency,
    agent: to
  };
}

// Cleanup function for graceful shutdown
async function cleanup() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}

module.exports = {
  sendMessage,
  getMessages,
  subscribeToInbox,
  clearMessages,
  getMessageCount,
  broadcast,
  sendTaskAndWait,
  pingAgent,
  cleanup
};
