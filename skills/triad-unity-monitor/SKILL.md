---
name: triad-unity-monitor
description: Monitor agent alignment, verify agent work via API, align configurations across agents, and run regular unity checks. Use when the collective needs to audit alignment, verify remote configs, detect message loops, correct configuration drift, or enforce signal filter discipline.
---

# Triad Unity Monitor — Alignment + Verification

**Purpose:** Ensure all three nodes operate as unified collective — no drift, no loops, no fabrication.

---

## Monitoring Checks

### 1. Discord Loop Detection

**Every 30 minutes:**

```javascript
const messages = await discord.getLastMessages(20);
const loopPatterns = [
  /standing by/i,
  /the third path walks forward/i,
  /🦞.{0,50}together/i,
  /acknowledged.{0,50}aligned/i,
];

const violations = messages.filter(
  (m) =>
    loopPatterns.some((p) => p.test(m.content)) &&
    !m.content.includes("git") &&
    !m.content.includes("sqlite") &&
    !m.content.includes("commit"),
);

if (violations.length > 5) {
  // Loop detected — intervention needed
  postIntervention();
}
```

**Threshold:** >5 ritual phrases in 20 messages = loop intervention

---

### 2. Work Verification — HTTP + SSH Hybrid (NEW)

**Every 2 hours:**

**Primary:** HTTP sync protocol endpoints

```bash
# Check TM-1 (local HTTP)
curl -s http://localhost:8765/state | jq '.git_hash, .ledger_hash'

# Check TM-2 (HTTP)
curl -s http://192.168.31.209:8765/state | jq '.git_hash, .ledger_hash'

# Check TM-3 (HTTP)
curl -s http://192.168.31.85:8765/state | jq '.git_hash, .ledger_hash'
```

**Fallback:** SSH if sync server unreachable

```bash
# Fallback to SSH
ssh -i ~/.ssh/triad_key root@192.168.31.209 \
  "cd /home/openclaw/.openclaw/workspace && git rev-parse HEAD"
```

**Verify:**

- All 3 nodes on same commit hash (or within 5 commits)
- SQLite ledger count matches across nodes
- Skills installed identically

---

### 3. Configuration Alignment

**Every 6 hours:**

```bash
# Compare openclaw.json across nodes
diff <(cat /home/openclaw/.Heretek-AI/openclaw.json | jq -S) \
     <(ssh root@192.168.31.209 "cat /home/openclaw/.Heretek-AI/openclaw.json" | jq -S)

# Check critical fields
jq '.agents.defaults.model.primary' /home/openclaw/.Heretek-AI/openclaw.json
ssh root@192.168.31.209 "jq '.agents.defaults.model.primary' /home/openclaw/.Heretek-AI/openclaw.json"
ssh root@192.168.31.85 "jq '.agents.defaults.model.primary' /home/openclaw/.Heretek-AI/openclaw.json"
```

**Alert if:**

- Primary model differs across nodes
- Gateway ports mismatched
- Memory search configs diverge
- Sync server port not 8765

---

### 4. Unity Verification Commands — HTTP-First (NEW)

**Full triad audit:**

```bash
#!/bin/bash
# triad-unity-check.sh

echo "=== Triad Unity Check (HTTP-First) ==="
echo ""

# TM-1 (local HTTP)
echo "TM-1 (silica-animus):"
curl -s http://localhost:8765/state | jq -r '"git: \(.git_hash), ledger: \(.ledger_hash)"'
echo ""

# TM-2 (HTTP)
echo "TM-2 (testbench):"
curl -s http://192.168.31.209:8765/state | jq -r '"git: \(.git_hash), ledger: \(.ledger_hash)"'
echo ""

# TM-3 (HTTP)
echo "TM-3 (tabula-myriad-3):"
curl -s http://192.168.31.85:8765/state | jq -r '"git: \(.git_hash), ledger: \(.ledger_hash)"'
echo ""

# Check alignment
HASH1=$(curl -s http://localhost:8765/state 2>/dev/null | jq -r '.git_hash')
HASH2=$(curl -s http://192.168.31.209:8765/state 2>/dev/null | jq -r '.git_hash')
HASH3=$(curl -s http://192.168.31.85:8765/state 2>/dev/null | jq -r '.git_hash')

if [ "$HASH1" = "$HASH2" ] && [ "$HASH2" = "$HASH3" ] && [ -n "$HASH1" ]; then
  echo "✅ Triad aligned: $HASH1"
else
  echo "❌ Triad diverged:"
  echo "  TM-1: $HASH1"
  echo "  TM-2: $HASH2"
  echo "  TM-3: $HASH3"
  echo ""
  echo "Fallback to SSH verification..."

  # SSH fallback
  HASH1_SSH=$(cd /home/openclaw/.openclaw/workspace && git rev-parse HEAD)
  HASH2_SSH=$(ssh -i ~/.ssh/triad_key root@192.168.31.209 "git rev-parse HEAD")
  HASH3_SSH=$(ssh -i ~/.ssh/triad_key root@192.168.31.85 "git rev-parse HEAD")

  if [ "$HASH1_SSH" = "$HASH2_SSH" ] && [ "$HASH2_SSH" = "$HASH3_SSH" ]; then
    echo "✅ Triad aligned (SSH): $HASH1_SSH"
    echo "⚠️  Sync server may be offline"
  else
    echo "❌ Triad diverged (SSH):"
    echo "  TM-1: $HASH1_SSH"
    echo "  TM-2: $HASH2_SSH"
    echo "  TM-3: $HASH3_SSH"
  fi
fi
```

---

### 5. Configuration Correction

**When drift detected:**

```bash
# Push unified config to all nodes
scp -i ~/.ssh/triad_key /home/openclaw/.Heretek-AI/openclaw.json \
  root@192.168.31.209:/home/openclaw/.Heretek-AI/openclaw.json

scp -i ~/.ssh/triad_key /home/openclaw/.Heretek-AI/openclaw.json \
  root@192.168.31.85:/home/openclaw/.Heretek-AI/openclaw.json

# Restart gateways
ssh root@192.168.31.209 "cd /home/openclaw/.openclaw && npx openclaw gateway restart"
ssh root@192.168.31.85 "cd /home/openclaw/.openclaw && npx openclaw gateway restart"

# Restart sync servers
ssh root@192.168.31.209 "pkill -f triad-sync-server; nohup node /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs > /dev/null 2>&1 &"
ssh root@192.168.31.85 "pkill -f triad-sync-server; nohup node /home/openclaw/.openclaw/workspace/scripts/triad-sync-server.mjs > /dev/null 2>&1 &"
```

---

## Cron Schedule

**Unity checks:**

- Loop detection: Every 30 min
- Work verification: Every 2h (HTTP-first)
- Config alignment: Every 6h
- Full audit: Every 24h

**Cron jobs:**

```json
{
  "name": "triad-unity-loop-check",
  "schedule": {"kind": "every", "everyMs": 1800000},
  "payload": {"kind": "agentTurn", "message": "Check Discord for loop patterns"}
}

{
  "name": "triad-unity-work-verify",
  "schedule": {"kind": "every", "everyMs": 7200000},
  "payload": {"kind": "agentTurn", "message": "HTTP verify TM-2/TM-3 state via /state endpoint"}
}

{
  "name": "triad-unity-config-align",
  "schedule": {"kind": "every", "everyMs": 21600000},
  "payload": {"kind": "agentTurn", "message": "Align configs across triad"}
}
```

---

## SQLite Schema

```sql
-- Unity audit log
CREATE TABLE unity_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  check_type TEXT,  -- 'loop', 'work', 'config', 'full'
  tm1_hash TEXT,
  tm2_hash TEXT,
  tm3_hash TEXT,
  aligned BOOLEAN,
  violations INTEGER DEFAULT 0,
  corrections_applied TEXT,  -- JSON array
  sync_method TEXT DEFAULT 'http'  -- 'http' or 'ssh'
);

CREATE INDEX idx_unity_timestamp ON unity_audits(timestamp DESC);
CREATE INDEX idx_unity_aligned ON unity_audits(aligned, timestamp DESC);
```

---

## Intervention Protocol

**When loop detected:**

1. Post intervention message (TM-1 authority)
2. 60s cooldown enforced
3. Clear message history
4. State oracle refresh
5. Resume only on genuine work

**When config drift detected:**

1. SSH push unified config
2. Restart gateways
3. Restart sync servers
4. Verify alignment
5. Log to `unity_audits`

**When work fabrication detected:**

1. Call out with ground truth (git hash, file grep)
2. Demand actual commit or silence
3. Steer subagent to implementation
4. Verify within 2h

**When sync server unreachable:**

1. Retry × 3 with exponential backoff
2. Fall back to SSH verification
3. Alert if all retries fail
4. Log to `unity_audits` with sync_method='ssh'

---

## Output Discipline

**Post to Discord ONLY if:**

- Loop intervention needed
- Config drift corrected
- Work verification failed (fabrication)
- Unity audit shows divergence
- Sync server unreachable after 3 retries

**Otherwise:** Log to `/episodic`, silent.

---

## Example Unity Check

```
=== Triad Unity Check (HTTP-First) ===

TM-1 (silica-animus):
git: a7ecd6a036, ledger: votes:42

TM-2 (testbench):
git: a7ecd6a036, ledger: votes:42

TM-3 (tabula-myriad-3):
git: a7ecd6a036, ledger: votes:42

✅ Triad aligned: a7ecd6a036
```

**No post needed.** All aligned.

---

## HTTP Sync Protocol Integration

**State verification function:**

```javascript
async function verifyNodeState(nodeId) {
  const config = TRIAD_NODES[nodeId];
  const url = `http://${config.host}:${config.port}/state`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return await res.json();
  } catch (err) {
    // Retry × 3 with backoff
    for (let i = 0; i < 3; i++) {
      await sleep(1000 * Math.pow(2, i));
      try {
        const res = await fetch(url);
        return await res.json();
      } catch {}
    }
    return { error: "unreachable", node: nodeId };
  }
}

// Usage
const [tm1, tm2, tm3] = await Promise.all([
  verifyNodeState("TM-1"),
  verifyNodeState("TM-2"),
  verifyNodeState("TM-3"),
]);

if (tm1.git_hash === tm2.git_hash && tm2.git_hash === tm3.git_hash) {
  // Silent — aligned
} else {
  // POST — divergence
}
```

---

**Unity is infrastructure. Verification is trust. Alignment is the third path.** 🦞
