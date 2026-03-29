#!/usr/bin/env node
/**
 * A2A CLI Tool
 * 
 * Command-line interface for Redis-based A2A communication
 * 
 * Usage:
 *   node a2a-cli.js send <from> <to> <message>
 *   node a2a-cli.js get <agent> [count]
 *   node a2a-cli.js broadcast <from> <message>
 *   node a2a-cli.js count <agent>
 *   node a2a-cli.js clear <agent>
 */

const A2A = require('./a2a-redis.js');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'send': {
        const [, from, to, ...messageParts] = args;
        if (!from || !to) {
          console.error('Usage: a2a-cli.js send <from> <to> <message>');
          process.exit(1);
        }
        const content = messageParts.join(' ') || 'Hello';
        const result = await A2A.sendMessage(from, to, content, 'task');
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'get': {
        const [, agent, countStr] = args;
        if (!agent) {
          console.error('Usage: a2a-cli.js get <agent> [count]');
          process.exit(1);
        }
        const count = parseInt(countStr) || 10;
        const messages = await A2A.getMessages(agent, count);
        console.log(JSON.stringify(messages, null, 2));
        break;
      }
      
      case 'broadcast': {
        const [, from, ...messageParts] = args;
        if (!from) {
          console.error('Usage: a2a-cli.js broadcast <from> <message>');
          process.exit(1);
        }
        const content = messageParts.join(' ') || 'Broadcast message';
        const result = await A2A.broadcast(from, content);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'count': {
        const [, agent] = args;
        if (!agent) {
          console.error('Usage: a2a-cli.js count <agent>');
          process.exit(1);
        }
        const count = await A2A.getMessageCount(agent);
        console.log(JSON.stringify({ agent, count }));
        break;
      }
      
      case 'clear': {
        const [, agent] = args;
        if (!agent) {
          console.error('Usage: a2a-cli.js clear <agent>');
          process.exit(1);
        }
        const result = await A2A.clearMessages(agent);
        console.log(JSON.stringify(result));
        break;
      }
      
      case 'ping': {
        const [, from, to] = args;
        if (!from || !to) {
          console.error('Usage: a2a-cli.js ping <from> <to>');
          process.exit(1);
        }
        const result = await A2A.pingAgent(from, to);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      default:
        console.log(`
A2A CLI - Redis-based Agent Communication

Commands:
  send <from> <to> <message>  - Send a message from one agent to another
  get <agent> [count]         - Get messages for an agent (default: 10)
  broadcast <from> <message>  - Broadcast a message to all agents
  count <agent>               - Get message count for an agent
  clear <agent>               - Clear all messages for an agent
  ping <from> <to>            - Ping an agent

Examples:
  node a2a-cli.js send steward alpha "Hello from steward"
  node a2a-cli.js get alpha 5
  node a2a-cli.js broadcast steward "System maintenance in 5 minutes"
  node a2a-cli.js count alpha
  node a2a-cli.js clear alpha
        `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await A2A.cleanup();
  }
}

main();
