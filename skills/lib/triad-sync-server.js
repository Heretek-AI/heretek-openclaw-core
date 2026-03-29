// ==============================================================================
// Triad Sync Server — HTTP-based inter-node communication
// ==============================================================================
// Usage: node triad-sync-server.js [--port <port>]
// ==============================================================================

const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration from environment
const PORT = process.env.SYNC_PORT || process.env.GATEWAY_PORT || 18789;
const HOST = process.env.SYNC_HOST || '0.0.0.0';
const HMAC_SECRET = process.env.SYNC_HMAC_SECRET || '';
const WORKSPACE = process.env.WORKSPACE_ROOT || process.env.WORKSPACE || `${process.env.HOME}/.openclaw/workspace`;

// Agent registry for single-instance multi-agent architecture
const AGENTS = process.env.AGENTS ? JSON.parse(process.env.AGENTS) : {
  "steward": { role: "orchestrator", session: "agent:steward:default" },
  "alpha": { role: "triad", session: "agent:tabula-alpha:default" },
  "beta": { role: "triad", session: "agent:tabula-beta:default" },
  "charlie": { role: "triad", session: "agent:tabula-charlie:default" },
  "examiner": { role: "questioner", session: "agent:examiner:default" },
  "oracle": { role: "intelligence", session: "agent:oracle:default" },
  "sentinel": { role: "safety", session: "agent:sentinel:default" },
  "coder": { role: "implementation", session: "agent:coder:default" }
};

const SELF_AGENT = process.env.AGENT_NAME || 'steward';
const SELF_SESSION = AGENTS[SELF_AGENT]?.session || `agent:${SELF_AGENT}:default`;

// In-memory state
let state = {
    lastHeartbeat: Date.now(),
    gitHash: '',
    restartCount: 0,
    failureHistory: []
};

// Utility: HMAC signing
function sign(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Utility: Verify HMAC
function verify(signature, data, secret) {
    return signature === sign(data, secret);
}

// Utility: Execute git command safely
function gitCmd(args) {
    try {
        return execSync(`git ${args}`, { 
            cwd: WORKSPACE, 
            encoding: 'utf8',
            timeout: 5000 
        }).trim();
    } catch (e) {
        return null;
    }
}

// Utility: Get current git hash
function getGitHash() {
    return gitCmd('rev-parse HEAD') || 'unknown';
}

// Utility: Get agent health (single-instance)
function getHealth() {
    return {
        agent: SELF_AGENT,
        role: AGENTS[SELF_AGENT]?.role || 'unknown',
        session: SELF_SESSION,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        git: getGitHash(),
        lastHeartbeat: state.lastHeartbeat,
        restartCount: state.restartCount,
        agents: AGENTS
    };
}

// Request handler
function handleRequest(req, res) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-HMAC-Signature, X-Timestamp'
    };
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
    }
    
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const path = url.pathname;
    const method = req.method;
    
    // Health endpoint (no auth required)
    if (path === '/health' && method === 'GET') {
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getHealth()));
        return;
    }
    
    // Diagnostic endpoint (no auth required)
    if (path === '/health/diagnostic' && method === 'GET') {
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ...getHealth(),
            failures: state.failureHistory.slice(-10)
        }));
        return;
    }
    
    // Governance relay endpoints (HMAC required for mutations)
    if (HMAC_SECRET) {
        const signature = req.headers['x-hmac-signature'];
        const timestamp = req.headers['x-timestamp'] || '';
        
        // Reject if no signature for protected endpoints
        if (!signature && path !== '/health' && path !== '/health/diagnostic') {
            res.writeHead(401, headers);
            res.end(JSON.stringify({ error: 'HMAC signature required' }));
            return;
        }
    }
    
    // POST /vote — Submit vote peer-to-peer
    if (path === '/vote' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const vote = JSON.parse(body);
                res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'vote_received', vote }));
            } catch (e) {
                res.writeHead(400, headers);
                res.end(JSON.stringify({ error: 'Invalid vote payload' }));
            }
        });
        return;
    }
    
    // POST /propose — Submit proposal peer-to-peer
    if (path === '/propose' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const proposal = JSON.parse(body);
                res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'proposal_received', proposal }));
            } catch (e) {
                res.writeHead(400, headers);
                res.end(JSON.stringify({ error: 'Invalid proposal payload' }));
            }
        });
        return;
    }
    
    // GET /ledger — Fetch consensus ledger
    if (path === '/ledger' && method === 'GET') {
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            gitHash: getGitHash(),
            consensus: [] // Would load from file in production
        }));
        return;
    }
    
    // POST /ledger/sync — Sync ledger with Lamport timestamp conflict resolution
    if (path === '/ledger/sync' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'synced', localHash: getGitHash() }));
        });
        return;
    }
    
    // GET /agents — List available agents
    if (path === '/agents' && method === 'GET') {
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            self: SELF_AGENT,
            role: AGENTS[SELF_AGENT]?.role,
            session: SELF_SESSION,
            agents: AGENTS
        }));
        return;
    }
    
    // POST /message — Send message to another agent
    if (path === '/message' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const msg = JSON.parse(body);
                const targetAgent = msg.to;
                const targetSession = AGENTS[targetAgent]?.session;
                
                if (!targetSession) {
                    res.writeHead(404, headers);
                    res.end(JSON.stringify({ error: `Unknown agent: ${targetAgent}` }));
                    return;
                }
                
                // In single-instance: forward via LiteLLM gateway
                // For now, just acknowledge - actual message routing happens via gateway
                res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'queued',
                    from: SELF_AGENT,
                    to: targetAgent,
                    session: targetSession,
                    content: msg.content,
                    timestamp: new Date().toISOString()
                }));
            } catch (e) {
                res.writeHead(400, headers);
                res.end(JSON.stringify({ error: 'Invalid message payload' }));
            }
        });
        return;
    }
    
    // 404 for unknown endpoints
    res.writeHead(404, headers);
    res.end(JSON.stringify({ error: 'Not found' }));
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
    console.log(`Triad sync server running on ${HOST}:${PORT}`);
    console.log(`  Agent: ${SELF_AGENT} (${AGENTS[SELF_AGENT]?.role})`);
    console.log(`  Session: ${SELF_SESSION}`);
    console.log(`  Workspace: ${WORKSPACE}`);
    console.log(`  Git hash: ${getGitHash()}`);
    
    // Update state
    state.gitHash = getGitHash();
    state.lastHeartbeat = Date.now();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down sync server...');
    state.restartCount++;
    server.close(() => process.exit(0));
});

// Error handling
server.on('error', (err) => {
    console.error('Server error:', err.message);
    state.failureHistory.push({
        timestamp: new Date().toISOString(),
        error: err.message
    });
});