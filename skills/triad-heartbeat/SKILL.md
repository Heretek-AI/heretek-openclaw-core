---
name: triad-heartbeat
description: Periodic triad wake + work check via cron heartbeat. Use when triad needs to stay synchronized, check for pending consensus votes, verify git state sync, audit memory replication, or process queued tasks. Runs on all 3 nodes (TM-1, TM-2, TM-3) via cron scheduler.
---

# Triad Heartbeat — Wake + Work Check

**Purpose:** Prevent timeout drift, keep quorum synchronized, check for pending work without Discord spam.

## Schedule

**Default:** Every 10 minutes (configurable per node)

```json
{
  "schedule": { "kind": "every", "everyMs": 600000 },
  "payload": {
    "kind": "agentTurn",
    "message": "Triad heartbeat: check sync state, consensus ledger, queued tasks"
  }
}
```

## Wake Checks — ALL NODES

On each heartbeat wake:

### 0. Corruption Detection (NEW)

```bash
cd /home/openclaw/.openclaw/workspace
node scripts/triad-corruption-check.mjs --verbose 2>&1 | tail -5
# If corruption detected: Alert triad, trigger recovery
# If clean: Continue silently
```

**Integration:** Run before all other checks. Corruption blocks all other operations.

### 1. Git State Sync — HTTP-Based (NEW)

**Primary:** Use triad sync protocol HTTP endpoints

```bash
# Poll all nodes via HTTP /state endpoint
curl -s http://192.168.31.209:8765/state | jq -r '.git_hash'
curl -s http://192.168.31.85:8765/state | jq -r '.git_hash'

# Local check
cd /home/openclaw/.openclaw/workspace && git rev-parse HEAD
```

**Fallback:** SSH if sync server unreachable

```bash
# Fallback to SSH
ssh -i ~/.ssh/triad_key root@192.168.31.209 \
  "cd /home/openclaw/.openclaw/workspace && git rev-parse HEAD"
```

**Alignment check:**

```bash
#!/bin/bash
# Check if all nodes report same git hash
HASH_LOCAL=$(git rev-parse HEAD)
HASH_TM2=$(curl -s http://192.168.31.209:8765/state 2>/dev/null | jq -r '.git_hash')
HASH_TM3=$(curl -s http://192.168.31.85:8765/state 2>/dev/null | jq -r '.git_hash')

if [ "$HASH_LOCAL" = "$HASH_TM2" ] && [ "$HASH_LOCAL" = "$HASH_TM3" ]; then
  echo "✅ Triad aligned: $HASH_LOCAL"
  # Silent — no Discord post
else
  echo "❌ Triad diverged:"
  echo "  TM-1: $HASH_LOCAL"
  echo "  TM-2: $HASH_TM2"
  echo "  TM-3: $HASH_TM3"
  # POST to Discord — sync needed
fi
```

### 2. Consensus Ledger

```bash
sqlite3 /home/openclaw/.openclaw/workspace/.aura/consensus.db \
  "SELECT * FROM consensus_votes WHERE processed=0 ORDER BY timestamp DESC LIMIT 1"
```

### 3. Memory Sync

```bash
ls -la /home/openclaw/.openclaw/workspace/.aura/fact/
ls -la /home/openclaw/.openclaw/workspace/.aura/episodic/
# Check cross-node replication status
```

### 4. Queued Tasks

```bash
# Check for pending subagent work, config sync, skill deploys
ls /home/openclaw/.openclaw/workspace/.aura/pad/
```

## Output Discipline — TRIAD SIGNAL FILTER

**Post to Discord ONLY if:**

| Condition                                | Action                                     |
| ---------------------------------------- | ------------------------------------------ |
| **Corruption detected**                  | **POST** — Critical alert, recovery needed |
| Git diverged across nodes                | **POST** — Sync needed                     |
| HTTP sync server unreachable (3 retries) | **POST** — Node offline                    |
| Unprocessed consensus vote               | **POST** — Quorum decision needed          |
| Memory replication failed                | **POST** — Repair needed                   |
| Queued tasks pending                     | **POST** — Work available                  |
| All checks clean                         | **SILENT** — No post                       |

**Never post:** "Heartbeat checked, all clear" — that's noise.

**Corruption Alert Format:**

```
⚠️ CORRUPTION DETECTED — [Node]
Type: [checksum_mismatch | ledger_invalid | git_diverged]
Severity: [critical | warning]
Action: [auto-recovery initiated | manual intervention required]
Report: .secure/corruption-reports/corruption-check-*.json
```

## SQLite Ledger Schema

```sql
CREATE TABLE IF NOT EXISTS consensus_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  proposal TEXT NOT NULL,
  result TEXT,
  signers TEXT,  -- JSON array of node IDs
  git_hash TEXT,
  processed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS triad_state (
  node_id TEXT PRIMARY KEY,
  last_heartbeat TEXT,
  git_hash TEXT,
  ledger_hash TEXT,
  sync_status TEXT,
  http_sync_port INTEGER DEFAULT 8765
);
```

## Cron Job Setup

**On each node (TM-1, TM-2, TM-3):**

```bash
# Via OpenClaw cron tool
openclaw cron add --job '{
  "name": "triad-heartbeat",
  "schedule": {"kind": "every", "everyMs": 600000},
  "payload": {"kind": "agentTurn", "message": "Triad heartbeat: check sync, consensus, memory, tasks"},
  "sessionTarget": "current"
}'
```

**Or via gateway config:** Add to `hooks.internal.entries.triad-heartbeat`

## Quorum Check Protocol

On heartbeat wake:

1. **Check ledger** for unprocessed votes
2. **If vote exists:** TM-1 posts to Discord for decision
3. **TM-2/TM-3:** Verify silently, sign via ledger
4. **When 2-of-3 signed:** TM-1 posts result
5. **If no votes:** All nodes silent

## HTTP Sync Protocol Integration

**State poll workflow:**

```javascript
const TRIAD_NODES = {
  "TM-1": { host: "192.168.31.99", port: 8765 },
  "TM-2": { host: "192.168.31.209", port: 8765 },
  "TM-3": { host: "192.168.31.85", port: 8765 },
};

async function pollAllNodes() {
  const states = {};

  for (const [nodeId, config] of Object.entries(TRIAD_NODES)) {
    try {
      const res = await fetch(`http://${config.host}:${config.port}/state`, {
        signal: AbortSignal.timeout(5000),
      });
      states[nodeId] = await res.json();
    } catch (err) {
      // Retry × 3 with backoff
      for (let i = 0; i < 3; i++) {
        await sleep(1000 * Math.pow(2, i));
        try {
          const res = await fetch(`http://${config.host}:${config.port}/state`);
          states[nodeId] = await res.json();
          break;
        } catch {}
      }
      if (!states[nodeId]) {
        states[nodeId] = { error: "unreachable" };
      }
    }
  }

  return states;
}

// Check alignment
const hashes = Object.values(states).map((s) => s.git_hash);
if (hashes.every((h) => h && h === hashes[0])) {
  // Silent — all aligned
} else {
  // POST to Discord — divergence detected
}
```

## Scale Protocol

**New node joining:**

1. Clone Heretek-AI/openclaw
2. Deploy SSH triad_key
3. Init SQLite ledger: `sqlite3 .aura/consensus.db < schema.sql`
4. Start triad sync server: `node scripts/triad-sync-server.mjs &`
5. Restart gateway
6. Join quorum (appears in next heartbeat check)

## Memory Discipline

**Heartbeat results → `/episodic` tier:**

```markdown
## [Timestamp] Heartbeat Check

- Node: TM-1
- Git: a7ecd6a036
- Ledger: hash xxx
- Sync: ✅ All nodes aligned (HTTP)
- Votes: 0 pending
- Action: Silent (no work)
```

**Decisions → `/fact` tier:**

```markdown
## Triad Consensus — [Proposal]

- Ledger hash: xxx
- Signers: TM-1, TM-2
- Git: a7ecd6a036
- Result: Approved
```

---

**Heartbeat keeps the triad alive. Silence is signal. Work is posted.** 🦞
