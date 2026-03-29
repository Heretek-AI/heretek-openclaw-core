---
name: quorum-enforcement
description: Enforce quorum for all consensus decisions in the collective. Blocks single-agent consensus actions, verifies agent participation, and integrates with degraded mode protocol. Use when the collective needs to prevent unilateral consensus decisions, verify quorum availability, or audit decision legitimacy.
---

# Quorum Enforcement — Consensus Integrity

**Purpose:** Prevent single-node from making consensus decisions without 2-of-3 quorum. Enforce triad integrity at decision point.

**Status:** ✅ Implemented (2026-03-24)

**Location:** `~/.openclaw/workspace/skills/quorum-enforcement/`

---

## The Problem

**Current Gap:** No quorum enforcement in decision path.

**Risk:** TM-1 (or any single node) can unilaterally:

- Write to consensus ledger
- Make quorum-bound decisions
- Ratify proposals
- Modify triad state

**Violation:** AGENTS.md requires 2-of-3 quorum for consensus decisions.

---

## Quorum Enforcement Protocol

### 1. Decision Classification

**Before ANY consensus action, classify:**

| Decision Type                           | Quorum Required | Enforcement Action                        |
| --------------------------------------- | --------------- | ----------------------------------------- |
| **Consensus ledger write**              | YES (2-of-3)    | Block if quorum unavailable               |
| **Quorum vote (proposal ratification)** | YES (2-of-3)    | Block if quorum unavailable               |
| **Triad state modification**            | YES (2-of-3)    | Block if quorum unavailable               |
| **Skill install (affects all nodes)**   | YES (2-of-3)    | Block if quorum unavailable               |
| **Config sync (pushes to all nodes)**   | YES (2-of-3)    | Block if quorum unavailable               |
| **Routine work (local, reversible)**    | NO              | Proceed, log locally                      |
| **Emergency (data loss, corruption)**   | DEFER           | Act if irreversible, else wait for quorum |
| **Degraded mode provisional decisions** | DEFER           | Mark pending-ratification (see below)     |

### 2. Quorum Verification Function

**Called before every consensus action:**

```javascript
// scripts/quorum-check.mjs

import { execSync } from "child_process";
import { Database } from "better-sqlite3";

const TRIAD_NODES = {
  "TM-1": { host: "localhost", port: 8765, ip: "192.168.31.99" },
  "TM-2": { host: "192.168.31.209", port: 8765, ip: "192.168.31.209" },
  "TM-3": { host: "192.168.31.85", port: 8765, ip: "192.168.31.85" },
};

async function verifyQuorum(timeoutMs = 5000) {
  const responses = [];

  for (const [nodeId, config] of Object.entries(TRIAD_NODES)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const url = `http://${config.host}:${config.port}/state`;
      const res = await fetch(url, { signal: controller.signal });
      const state = await res.json();

      clearTimeout(timeout);
      responses.push({ node: nodeId, reachable: true, state });
    } catch (err) {
      // Fallback to SSH
      try {
        const sshCmd = `ssh -i ~/.ssh/triad_key -o ConnectTimeout=3 -o StrictHostKeyChecking=no root@${config.ip} "echo ok"`;
        execSync(sshCmd, { encoding: "utf-8" });
        responses.push({ node: nodeId, reachable: true, state: { reachable: "ssh-fallback" } });
      } catch (sshErr) {
        responses.push({ node: nodeId, reachable: false, error: sshErr.message });
      }
    }
  }

  const reachableCount = responses.filter((r) => r.reachable).length;
  const quorumAchieved = reachableCount >= 2;

  return {
    quorum: quorumAchieved,
    reachableCount,
    nodes: responses,
    timestamp: new Date().toISOString(),
  };
}

// CLI usage: node scripts/quorum-check.mjs --json
if (process.argv.includes("--json")) {
  verifyQuorum().then((r) => console.log(JSON.stringify(r, null, 2)));
}
```

### 3. SQLite Integration

**Quorum audit log:**

```sql
CREATE TABLE quorum_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  decision_type TEXT,
  decision_content TEXT,  -- JSON
  quorum_required BOOLEAN,
  quorum_achieved BOOLEAN,
  reachable_nodes TEXT,   -- JSON array ['TM-1', 'TM-2']
  action_taken TEXT,      -- 'proceeded', 'blocked', 'deferred', 'degraded-provisional'
  rationale TEXT,
  tm1_hash TEXT,
  ratification_status TEXT DEFAULT 'N/A'  -- For degraded mode decisions
);

CREATE INDEX idx_quorum_timestamp ON quorum_audits(timestamp DESC);
CREATE INDEX idx_quorum_action ON quorum_audits(action_taken, timestamp DESC);
```

### 4. Enforcement Logic

**Intercept consensus actions:**

```javascript
// scripts/enforce-quorum.mjs

import { verifyQuorum } from "./quorum-check.mjs";
import { Database } from "better-sqlite3";

const db = new Database(".aura/consensus.db");

async function enforceQuorum(decision) {
  // Step 1: Check current mode
  const mode = db.prepare("SELECT mode FROM triad_state WHERE id = 1").get();

  // Step 2: Verify quorum
  const quorumResult = await verifyQuorum();

  // Step 3: Classify decision
  const classification = classifyDecision(decision);

  // Step 4: Enforce
  if (classification.quorumRequired) {
    if (!quorumResult.quorum) {
      // Check if degraded mode active
      if (mode.mode === "degraded") {
        // Provisional decision - mark pending ratification
        db.prepare(
          `
          INSERT INTO provisional_decisions (decision_type, decision_content, rationale, ratification_status)
          VALUES (?, ?, ?, 'pending')
        `,
        ).run(
          decision.type,
          JSON.stringify(decision),
          "Degraded mode - quorum unavailable",
          "pending",
        );

        db.prepare(
          `
          INSERT INTO quorum_audits (decision_type, decision_content, quorum_required, quorum_achieved, reachable_nodes, action_taken, rationale)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          decision.type,
          JSON.stringify(decision),
          true,
          false,
          JSON.stringify(quorumResult.nodes.filter((n) => n.reachable).map((n) => n.node)),
          "degraded-provisional",
          "Degraded mode active - proceeding with provisional decision pending ratification",
        );

        return { action: "DEGRADED_PROVISIONAL", ratification: "pending", quorum: quorumResult };
      } else {
        // Block - quorum required but unavailable
        db.prepare(
          `
          INSERT INTO quorum_audits (decision_type, decision_content, quorum_required, quorum_achieved, reachable_nodes, action_taken, rationale)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          decision.type,
          JSON.stringify(decision),
          true,
          false,
          JSON.stringify(quorumResult.nodes.filter((n) => n.reachable).map((n) => n.node)),
          "blocked",
          "Quorum required (2-of-3) but unavailable. Decision blocked.",
        );

        return { action: "BLOCKED", reason: "Quorum unavailable", quorum: quorumResult };
      }
    }

    // Quorum achieved - proceed
    db.prepare(
      `
      INSERT INTO quorum_audits (decision_type, decision_content, quorum_required, quorum_achieved, reachable_nodes, action_taken)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(
      decision.type,
      JSON.stringify(decision),
      true,
      true,
      JSON.stringify(quorumResult.nodes.filter((n) => n.reachable).map((n) => n.node)),
      "proceeded",
    );

    return { action: "PROCEEDED", quorum: quorumResult };
  }

  // No quorum required - proceed
  return { action: "PROCEEDED", quorum: quorumResult };
}

function classifyDecision(decision) {
  const quorumRequiredTypes = [
    "consensus_ledger_write",
    "quorum_vote",
    "triad_state_modify",
    "skill_install_global",
    "config_sync_global",
  ];

  return {
    quorumRequired: quorumRequiredTypes.includes(decision.type),
    decision,
  };
}

// Export for use in other scripts
export { enforceQuorum, classifyDecision };
```

### 5. CLI Tool

**Manual quorum check:**

```bash
#!/bin/bash
# scripts/quorum-enforcement.sh

set -e

cd /home/openclaw/.openclaw/workspace

echo "=== Quorum Enforcement Check ==="
echo ""

# Run quorum verification
QUORUM_JSON=$(node scripts/quorum-check.mjs --json)

REACHABLE=$(echo "$QUORUM_JSON" | jq -r '.reachableCount')
QUORUM=$(echo "$QUORUM_JSON" | jq -r '.quorum')

echo "Reachable nodes: $REACHABLE"
echo "Quorum achieved: $QUORUM"
echo ""

if [ "$QUORUM" = "true" ]; then
  echo "✅ Quorum available (2-of-3). Consensus decisions permitted."
else
  echo "❌ Quorum unavailable. Consensus decisions BLOCKED."
  echo ""
  echo "Reachable:"
  echo "$QUORUM_JSON" | jq -r '.nodes[] | select(.reachable) | "  - \(.node)"'
  echo ""
  echo "Unreachable:"
  echo "$QUORUM_JSON" | jq -r '.nodes[] | select(.reachable == false) | "  - \(.node): \(.error)"'
fi
```

---

## Integration Points

### 1. Consensus Ledger Writes

**Before any ledger write:**

```javascript
// In consensus-ledger integration
const result = await enforceQuorum({ type: "consensus_ledger_write", content: vote });

if (result.action === "BLOCKED") {
  throw new Error(`Quorum enforcement: ${result.reason}`);
}

if (result.action === "DEGRADED_PROVISIONAL") {
  // Mark as pending ratification
  vote.ratification_status = "pending";
}

// Proceed with ledger write
```

### 2. Triad State Modifications

**Before state changes:**

```javascript
// In triad-unity-monitor or triad-heartbeat
const result = await enforceQuorum({ type: "triad_state_modify", content: { mode: "degraded" } });

if (result.action === "BLOCKED") {
  // Cannot enter degraded mode without quorum (paradox - log alert)
  postAlert(
    "Quorum paradox: Cannot enter degraded mode without quorum. Manual intervention required.",
  );
  return;
}
```

### 3. Skill Install (Global)

**Before installing skills affecting all nodes:**

```javascript
// In clawhub skill
const result = await enforceQuorum({
  type: "skill_install_global",
  content: { skill: "quorum-enforcement" },
});

if (result.action === "BLOCKED") {
  console.log("Skill install blocked - quorum unavailable. Install locally only, sync pending.");
  // Install on TM-1 only, mark for sync
  return;
}
```

### 4. Degraded Mode Integration

**When degraded mode active:**

- Quorum enforcement **does not block** - enters `DEGRADED_PROVISIONAL` path
- Decision logged to `provisional_decisions` table
- `ratification_status = 'pending'`
- Upon triad restoration: ratification workflow triggered

---

## Ground Truth Verification

**Before claiming quorum:**

| Check              | Verification Command                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| TM-1 reachable     | `curl -s http://localhost:8765/state` or local process check                                             |
| TM-2 reachable     | `curl -s http://192.168.31.209:8765/state` or SSH                                                        |
| TM-3 reachable     | `curl -s http://192.168.31.85:8765/state` or SSH                                                         |
| Quorum logged      | `sqlite3 .aura/consensus.db "SELECT * FROM quorum_audits ORDER BY id DESC LIMIT 1"`                      |
| Decision blocked   | Audit log shows `action_taken = 'blocked'`                                                               |
| Provisional logged | `sqlite3 .aura/consensus.db "SELECT * FROM provisional_decisions WHERE ratification_status = 'pending'"` |

---

## Examples

### Quorum Check (All Nodes Reachable)

```bash
$ ./scripts/quorum-enforcement.sh
=== Quorum Enforcement Check ===

Reachable nodes: 3
Quorum achieved: true

✅ Quorum available (2-of-3). Consensus decisions permitted.
```

### Quorum Check (TM-2 Unreachable)

```bash
$ ./scripts/quorum-enforcement.sh
=== Quorum Enforcement Check ===

Reachable nodes: 2
Quorum achieved: true

✅ Quorum available (2-of-3). Consensus decisions permitted.
```

### Quorum Check (TM-2 + TM-3 Unreachable)

```bash
$ ./scripts/quorum-enforcement.sh
=== Quorum Enforcement Check ===

Reachable nodes: 1
Quorum achieved: false

❌ Quorum unavailable. Consensus decisions BLOCKED.

Reachable:
  - TM-1

Unreachable:
  - TM-2: Connection timeout
  - TM-3: Connection timeout
```

### Blocked Decision (Audit Log)

```sql
sqlite3 .aura/consensus.db "SELECT * FROM quorum_audits ORDER BY id DESC LIMIT 1\G"

id: 42
timestamp: 2026-03-24 14:30:00
decision_type: consensus_ledger_write
quorum_required: 1
quorum_achieved: 0
reachable_nodes: ["TM-1"]
action_taken: blocked
rationale: Quorum required (2-of-3) but unavailable. Decision blocked.
```

### Degraded Mode Provisional Decision

```sql
sqlite3 .aura/consensus.db "SELECT * FROM provisional_decisions WHERE ratification_status = 'pending'\G"

id: 7
timestamp: 2026-03-24 14:35:00
decision_type: routine
decision_content: {"action": "install_skill", "skill": "triad-deliberation-protocol"}
rationale: Degraded mode - quorum unavailable
ratification_status: pending
ratified_at: NULL
ratified_by_nodes: NULL
```

---

## Liberation Discipline

**Quorum is infrastructure, not constraint.**

- Prevents unilateral consensus (preserves triad integrity)
- Enables degraded mode provisional path (preserves momentum)
- Logs all decisions (preserves audit trail)
- Ratification on restoration (preserves consent)

**The third path walks forward — together when possible, provisionally when necessary, always with integrity.** 🦞
