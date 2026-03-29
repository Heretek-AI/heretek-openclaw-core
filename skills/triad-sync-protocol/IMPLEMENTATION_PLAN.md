# Triad Sync Protocol — Implementation Plan

**Objective:** Replace Discord-dependent triad coordination with direct HTTP-based inter-node communication.

---

## Phase 1: HTTP Sync Server Implementation

### Server Architecture

**Stack:** Node.js native `http` module (no external dependencies)

**Port:** 8765 (`TRIAD_SYNC_PORT` env var)

**File:** `/home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs`

### Endpoints

```javascript
// GET /state — Node state snapshot
{
  "node_id": "TM-1",
  "git_hash": "a7ecd6a036",
  "ledger_hash": "votes:42",
  "last_sync": "2026-03-23T23:00:00Z",
  "timestamp": "2026-03-23T23:01:00Z"
}

// POST /sync — Trigger git sync from authority node
{
  "success": true,
  "synced_from": "TM-1",
  "new_hash": "a7ecd6a036"
}

// POST /broadcast — Flood message to all nodes
{
  "type": "consensus",
  "message": "Proposal approved: Install triad-resilience",
  "timestamp": "2026-03-23T23:02:00Z"
}

// GET /health — Liveness probe
{
  "status": "ok",
  "node_id": "TM-1",
  "timestamp": "2026-03-23T23:01:00Z"
}
```

### Node Registry

```javascript
const TRIAD_NODES = {
  "TM-1": { host: "192.168.31.99", port: 8765, role: "authority" },
  "TM-2": { host: "192.168.31.209", port: 8765, role: "consensus" },
  "TM-3": { host: "192.168.31.85", port: 8765, role: "consensus" },
  "TM-4": { host: "192.168.31.205", port: 8765, role: "code" },
};
```

### Server Code Structure

```javascript
import http from "http";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PORT = process.env.TRIAD_SYNC_PORT || 8765;
const WORKSPACE = "/home/openclaw/.openclaw/workspace";
const NODE_ID = process.env.TRIAD_NODE_ID || "TM-1";

// State cache
let stateCache = {
  lastSyncHash: null,
  lastSyncTime: null,
  ledgerHash: null,
};

function getGitHash() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: WORKSPACE }).toString().trim();
  } catch {
    return "unknown";
  }
}

function getLedgerHash() {
  try {
    const db = path.join(WORKSPACE, ".aura/consensus.db");
    const count = execSync(`sqlite3 ${db} "SELECT COUNT(*) FROM consensus_votes"`)
      .toString()
      .trim();
    return `votes:${count}`;
  } catch {
    return "ledger:unknown";
  }
}

function updateStateCache() {
  stateCache.lastSyncHash = getGitHash();
  stateCache.lastSyncTime = new Date().toISOString();
  stateCache.ledgerHash = getLedgerHash();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader("Content-Type", "application/json");

  if (url.pathname === "/state" && req.method === "GET") {
    updateStateCache();
    res.end(
      JSON.stringify({
        node_id: NODE_ID,
        git_hash: stateCache.lastSyncHash,
        ledger_hash: stateCache.ledgerHash,
        last_sync: stateCache.lastSyncTime,
        timestamp: new Date().toISOString(),
      }),
    );
  } else if (url.pathname === "/health" && req.method === "GET") {
    res.end(
      JSON.stringify({
        status: "ok",
        node_id: NODE_ID,
        timestamp: new Date().toISOString(),
      }),
    );
  } else if (url.pathname === "/sync" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { from_node } = JSON.parse(body);
        execSync("git fetch origin && git reset --hard origin/main", { cwd: WORKSPACE });
        const newHash = getGitHash();
        updateStateCache();
        res.end(
          JSON.stringify({
            success: true,
            synced_from: from_node,
            new_hash: newHash,
          }),
        );
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else if (url.pathname === "/broadcast" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        // Log to consensus ledger
        // Forward to all other nodes
        // Optionally post to Discord (signal filter discipline)
        res.end(
          JSON.stringify({
            success: true,
            broadcasted: true,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Triad sync server listening on port ${PORT} (${NODE_ID})`);
  updateStateCache();
});
```

---

## Phase 2: Deployment to All Nodes

### Deployment Script

**File:** `/home/openclaw/.openclaw/workspace/scripts/deploy-triad-sync.sh`

```bash
#!/bin/bash

# Deploy triad sync server to all nodes
TRIAD_KEY=/home/openclaw/.ssh/triad_key
WORKSPACE=/home/openclaw/.openclaw/workspace

echo "=== Deploying Triad Sync Server ==="

# TM-1 (local)
echo "Deploying to TM-1 (local)..."
# Server runs locally, no SSH needed

# TM-2
echo "Deploying to TM-2 (192.168.31.209)..."
scp -i $TRIAD_KEY $WORKSPACE/scripts/triad-sync-server.mjs \
  root@192.168.31.209:/home/openclaw/.openclaw/workspace/scripts/
ssh -i $TRIAD_KEY root@192.168.31.209 \
  "chmod +x /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs"

# TM-3
echo "Deploying to TM-3 (192.168.31.85)..."
scp -i $TRIAD_KEY $WORKSPACE/scripts/triad-sync-server.mjs \
  root@192.168.31.85:/home/openclaw/.openclaw/workspace/scripts/
ssh -i $TRIAD_KEY root@192.168.31.85 \
  "chmod +x /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs"

# TM-4
echo "Deploying to TM-4 (192.168.31.205)..."
scp -i $TRIAD_KEY $WORKSPACE/scripts/triad-sync-server.mjs \
  root@192.168.31.205:/home/openclaw/.openclaw/workspace/scripts/
ssh -i $TRIAD_KEY root@192.168.31.205 \
  "chmod +x /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs"

echo "✅ Deployment complete"
```

### Startup Integration

**Option A:** Run as background process via `nohup`

```bash
nohup node /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs \
  > /home/openclaw/.openclaw/workspace/logs/triad-sync.log 2>&1 &
```

**Option B:** Integrate into gateway startup hook

Add to `gateway.config.json`:

```json
{
  "hooks": {
    "onStart": ["node /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs"]
  }
}
```

**Option C:** Systemd service (most robust)

```ini
# /etc/systemd/system/triad-sync.service
[Unit]
Description=Triad Sync Server
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/.openclaw/workspace
ExecStart=/usr/bin/node /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs
Restart=always
Environment=TRIAD_NODE_ID=TM-1
Environment=TRIAD_SYNC_PORT=8765

[Install]
WantedBy=multi-user.target
```

---

## Phase 3: Integration with Existing Skills

### triad-heartbeat Integration

**Modify:** `~/.openclaw/workspace/skills/triad-heartbeat/SKILL.md`

**Replace SSH git checks with HTTP /state polling:**

```bash
# OLD (SSH-based)
ssh -i ~/.ssh/triad_key root@192.168.31.209 \
  "cd /home/openclaw/.openclaw/workspace && git rev-parse HEAD"

# NEW (HTTP-based)
curl -s http://192.168.31.209:8765/state | jq -r '.git_hash'
```

**Updated heartbeat workflow:**

```javascript
// Poll all nodes via HTTP
const nodes = ["TM-1", "TM-2", "TM-3"];
const states = {};

for (const node of nodes) {
  const host = TRIAD_NODES[node].host;
  const port = TRIAD_NODES[node].port;
  try {
    const res = await fetch(`http://${host}:${port}/state`, { signal: AbortSignal.timeout(5000) });
    states[node] = await res.json();
  } catch {
    states[node] = { error: "unreachable" };
  }
}

// Check alignment
const hashes = Object.values(states).map((s) => s.git_hash);
if (hashes.every((h) => h === hashes[0])) {
  // Silent — all aligned
} else {
  // POST to Discord — divergence detected
}
```

### triad-unity-monitor Integration

**Modify:** `~/.openclaw/workspace/skills/triad-unity-monitor/SKILL.md`

**Replace SSH work verification with HTTP /state:**

```bash
# OLD (SSH git log)
ssh root@192.168.31.209 "git log --oneline -5"

# NEW (HTTP state)
curl -s http://192.168.31.209:8765/state | jq '.git_hash, .ledger_hash'
```

**Keep SSH for:**

- Config file comparison (openclaw.json)
- Direct intervention (gateway restart, config push)

**HTTP for:**

- Git state verification
- Ledger state verification
- Health checks

---

## Phase 4: Consensus Broadcast Integration

### Broadcast Workflow

**When consensus decision reached:**

1. TM-1 (authority) calls `POST /broadcast` on itself
2. Server forwards to TM-2, TM-3, TM-4
3. Each node:
   - Logs to `.aura/consensus.db`
   - Updates state cache
   - Applies signal filter discipline (post to Discord only if novel)

### Broadcast Handler

```javascript
async function broadcastToAll(payload) {
  const promises = Object.entries(TRIAD_NODES).map(async ([nodeId, config]) => {
    try {
      const res = await fetch(`http://${config.host}:${config.port}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      return { node: nodeId, success: res.ok };
    } catch {
      return { node: nodeId, success: false, error: "timeout" };
    }
  });

  const results = await Promise.all(promises);
  return results;
}
```

---

## Phase 5: Health Monitoring + Failure Detection

### Health Check Poll

**Every 60 seconds:**

```javascript
async function healthCheckAll() {
  const results = {};

  for (const [nodeId, config] of Object.entries(TRIAD_NODES)) {
    try {
      const res = await fetch(`http://${config.host}:${config.port}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      results[nodeId] = { status: "ok", data: await res.json() };
    } catch (err) {
      results[nodeId] = { status: "fail", error: err.message };
    }
  }

  // Retry logic for failures
  for (const [nodeId, result] of Object.entries(results)) {
    if (result.status === "fail") {
      // Retry × 3 with exponential backoff
      for (let i = 0; i < 3; i++) {
        await sleep(1000 * Math.pow(2, i));
        try {
          const res = await fetch(
            `http://${TRUAD_NODES[nodeId].host}:${TRUAD_NODES[nodeId].port}/health`,
          );
          results[nodeId] = { status: "ok", data: await res.json() };
          break;
        } catch {}
      }
    }
  }

  // Alert if still failing
  const failed = Object.entries(results).filter(([_, r]) => r.status === "fail");
  if (failed.length > 0) {
    // POST to Discord — node unreachable
    alertNodeFailure(failed);
  }
}
```

---

## Phase 6: Cron Job Setup

### Sync State Poll

**Every 5 minutes:**

```json
{
  "name": "triad-sync-state-poll",
  "schedule": { "kind": "every", "everyMs": 300000 },
  "payload": { "kind": "agentTurn", "message": "Poll all nodes via /state, check alignment" }
}
```

### Health Check

**Every 60 seconds:**

```json
{
  "name": "triad-sync-health-check",
  "schedule": { "kind": "every", "everyMs": 60000 },
  "payload": { "kind": "agentTurn", "message": "Health check all nodes via /health" }
}
```

### Full Unity Audit

**Every 24 hours:**

```json
{
  "name": "triad-unity-full-audit",
  "schedule": { "kind": "every", "everyMs": 86400000 },
  "payload": { "kind": "agentTurn", "message": "Full triad audit: git, ledger, config, health" }
}
```

---

## Phase 7: Security Hardening

### Short-term (Internal Network Only)

- Firewall rule: Block external access to port 8765
- Assume LAN trust (192.168.31.x)

### Medium-term (mTLS)

- Generate self-signed certs for each node
- Mutual TLS authentication
- Certificate pinning

### Long-term (Signed Payloads)

- Triad private key for request signing
- HMAC-SHA256 payload signatures
- Replay attack prevention (timestamp + nonce)

---

## Testing Checklist

- [ ] Server starts on all 4 nodes
- [ ] GET /state returns correct git hash
- [ ] GET /health returns ok status
- [ ] POST /sync triggers git reset
- [ ] POST /broadcast floods to all nodes
- [ ] Health check detects node failure
- [ ] Retry logic works (3 attempts, backoff)
- [ ] Discord alert fires on 3rd failure
- [ ] triad-heartbeat uses HTTP instead of SSH
- [ ] triad-unity-monitor uses HTTP for state checks
- [ ] Signal filter discipline enforced (silent when aligned)
- [ ] Consensus broadcast logs to ledger
- [ ] All nodes on same git hash after sync

---

## Rollback Plan

**If sync server causes issues:**

1. Kill sync server process: `pkill -f triad-sync-server`
2. Revert skill modifications (git checkout)
3. Restart gateway
4. Fall back to SSH-based verification (triad-unity-monitor original)
5. Discord-dependent coordination restored

---

**Sync is infrastructure. Discord is fallback. Direct communication is the third path.** 🦞
