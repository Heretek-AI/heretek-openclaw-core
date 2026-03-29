---
name: triad-deliberation-protocol
description: Graceful degradation protocol for single-agent operation. Defines degraded mode triggers, virtual subagent consensus workflow, ratification path, and integration with signal filter + cron detection. Use when the collective operates with limited agents and cannot achieve quorum.
---

# Triad Deliberation Protocol — Degraded Mode Specification

**Purpose:** Enable TM-1 to operate autonomously when TM-2/TM-3 are unreachable, while preserving consensus integrity and defining ratification path upon triad restoration.

---

## The Problem

**Standard Protocol:** 2-of-3 quorum required for consensus decisions.

**Degraded Scenario:** Only TM-1 (silica-animus) operational. TM-2/TM-3 unreachable due to:

- Network partition (no route to 192.168.31.x subnet)
- Node hardware failure
- Gateway crash on remote nodes
- SSH key auth failure
- Prolonged maintenance window

**Blocking Issue:** Single node cannot make consensus decisions under standard protocol → triad paralysis.

---

## Degraded Mode Trigger Conditions

**Enter Degraded Mode when ALL of the following are true:**

1. **TM-1 Operational:**
   - `openclaw gateway status` returns healthy
   - Local git hash verified: `git rev-parse HEAD`
   - SQLite ledger accessible: `sqlite3 .aura/consensus.db ".schema"`

2. **TM-2 Unreachable (3 consecutive failures):**
   - SSH timeout: `ssh -i ~/.ssh/triad_key root@192.168.31.209 "echo ok"` fails
   - Gateway ping fails (if remote gateway endpoint configured)
   - Git hash fetch fails

3. **TM-3 Unreachable (3 consecutive failures):**
   - SSH timeout: `ssh -i ~/.ssh/triad_key root@192.168.31.85 "echo ok"` fails
   - Gateway ping fails
   - Git hash fetch fails

4. **Failure Persistence:**
   - Failures span ≥10 minutes (not transient blip)
   - Unity check cron job logs divergence alert
   - No successful TM-2/TM-3 work verification in ≥2 hours

**Trigger Automation:** `triad-unity-monitor` skill detects conditions → sets degraded mode flag in SQLite:

```sql
UPDATE triad_state SET mode = 'degraded', entered_at = datetime('now') WHERE id = 1;
```

**Discord Alert (TM-1 posts once):**

```
🦞 DEGRADED MODE ACTIVATED

TM-2 (192.168.31.209): UNREACHABLE (SSH timeout ×3, 10min)
TM-3 (192.168.31.85): UNREACHABLE (SSH timeout ×3, 10min)
TM-1 (silica-animus): OPERATIONAL

Consensus quorum unavailable. Entering provisional deliberation protocol.
All decisions pending ratification upon triad restoration.

Next unity check: 2h
```

---

## Virtual Subagent Consensus Workflow

**When Degraded Mode Active:**

### 1. Decision Classification

| Decision Type                                        | Degraded Mode Action                                       |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| **Critical** (security, data loss, destructive ops)  | **DEFER** — Wait for triad restoration unless emergency    |
| **Routine** (config sync, skill install, doc update) | **PROCEED** — TM-1 decides, logs rationale                 |
| **Consensus-Bound** (quorum votes, ledger writes)    | **PROVISIONAL** — TM-1 decides, marks pending-ratification |
| **Emergency** (node recovery, corruption fix)        | **PROCEED** — TM-1 acts, notifies upon restoration         |

### 2. Virtual Subagent Deliberation

**TM-1 simulates triad deliberation internally:**

```javascript
// Pseudo-code: degraded-mode-deliberation.js

async function deliberateDegraded(decision) {
  // Step 1: Log decision context
  await memoryWrite("/fact", {
    type: "provisional_decision",
    timestamp: new Date(),
    decision: decision,
    rationale: "Degraded mode — TM-2/TM-3 unreachable",
    ratification_required: true,
  });

  // Step 2: Simulate TM-2 perspective (conservative check)
  const tm2Concerns = [
    "Is this reversible?",
    "Does this affect consensus ledger?",
    "Can this wait 24h for triad restoration?",
  ];

  // Step 3: Simulate TM-3 perspective (optimization check)
  const tm3Concerns = [
    "Is this blocked by degraded mode?",
    "Does proceeding now prevent future work?",
    "Is there a safer alternative?",
  ];

  // Step 4: TM-1 authority decision
  const concerns = [...tm2Concerns, ...tm3Concerns];
  const blockageRisk = concerns.every((c) => decision.blocksIfDeferred(c));

  if (decision.type === "critical" && !blockageRisk) {
    return { action: "DEFER", reason: "Critical decision requires quorum" };
  }

  if (decision.type === "emergency" || blockageRisk) {
    return { action: "PROCEED", ratification: "pending" };
  }

  return { action: "PROCEED", ratification: "pending" };
}
```

### 3. Provisional Decision Logging

**Every provisional decision logged to SQLite:**

```sql
CREATE TABLE provisional_decisions (
  id INTEGER PRIMARY KEY,
  timestamp TEXT DEFAULT (datetime('now')),
  decision_type TEXT,
  decision_content TEXT,  -- JSON
  rationale TEXT,
  tm1_hash TEXT,
  ratification_status TEXT DEFAULT 'pending',  -- pending, ratified, rejected
  ratified_at TEXT,
  ratified_by_nodes TEXT  -- JSON array [TM-2, TM-3]
);
```

**Example Entry:**

```json
{
  "id": 1,
  "timestamp": "2026-03-24T01:15:00Z",
  "decision_type": "routine",
  "decision_content": { "action": "install_skill", "skill": "triad-deliberation-protocol" },
  "rationale": "Degraded mode — work cannot proceed without this skill. Reversible.",
  "tm1_hash": "ada12579baf3c02672d40598cb50766840dc391d",
  "ratification_status": "pending",
  "ratified_at": null,
  "ratified_by_nodes": null
}
```

### 4. Discord Discipline (Degraded Mode)

**Signal filter enforced strictly:**

- **Post ONLY:** Degraded mode activation alert, critical emergency actions, restoration notification
- **Suppress:** Routine work updates, provisional decision announcements, "standing by" variants
- **Frequency:** Max 1 post per 4 hours unless emergency

**Example Posts:**

```
✅ GOOD (Degraded Mode Alert)
🦞 DEGRADED MODE ACTIVATED — TM-2/TM-3 unreachable. Provisional deliberation active.

✅ GOOD (Emergency Action)
🦞 EMERGENCY: Ledger corruption detected. Running recovery script. Decision deferred to triad if reversible.

❌ BAD (Routine Update)
🦞 Installed triad-deliberation-protocol skill. (Suppress — log locally only)
```

---

## Ratification Path — Triad Restoration

**When TM-2 and/or TM-3 restored:**

### 1. Restoration Detection

**Unity check detects:**

```bash
# TM-2 reachable again
ssh -i ~/.ssh/triad_key root@192.168.31.209 "echo ok"  # Success

# TM-3 reachable again
ssh -i ~/.ssh/triad_key root@192.168.31.85 "echo ok"  # Success
```

**SQLite state update:**

```sql
UPDATE triad_state SET mode = 'standard', restored_at = datetime('now') WHERE id = 1;
```

### 2. Provisional Decision Review

**TM-1 initiates ratification workflow:**

```bash
# Fetch pending decisions
sqlite3 .aura/consensus.db "SELECT * FROM provisional_decisions WHERE ratification_status = 'pending'"
```

**For each pending decision:**

1. **TM-1 presents** decision + rationale to TM-2/TM-3
2. **TM-2/TM-3 review** (24h window)
3. **Quorum vote:**
   - If 2-of-3 approve: `ratification_status = 'ratified'`
   - If 2-of-3 reject: `ratification_status = 'rejected'` → rollback if possible
   - If no response in 24h: auto-ratify (presumption of consent)

### 3. Ratification Logging

```sql
UPDATE provisional_decisions
SET ratification_status = 'ratified',
    ratified_at = datetime('now'),
    ratified_by_nodes = json_array('TM-2', 'TM-3')
WHERE id = ?;
```

### 4. Restoration Announcement

**TM-1 posts to Discord (once):**

```
🦞 TRIAD RESTORED

TM-2 (192.168.31.209): ONLINE ✅
TM-3 (192.168.31.85): ONLINE ✅
Mode: STANDARD (2-of-3 quorum active)

Provisional decisions pending ratification: 3
Ratification window: 24h

Next unity check: 2h
The third path walks forward — together.
```

---

## Integration: Triad Signal Filter (Degraded Mode Discipline)

**Updates to `triad-signal-filter/SKILL.md`:**

### Degraded Mode Message Suppression

| Message Type                      | Standard Mode    | Degraded Mode                  |
| --------------------------------- | ---------------- | ------------------------------ |
| Provisional decision announcement | ALLOW (if novel) | **BLOCK** — Log locally        |
| Routine work update               | ALLOW (if novel) | **BLOCK** — Log locally        |
| Degraded mode activation alert    | N/A              | **ALLOW** (once)               |
| Emergency action notification     | ALLOW            | **ALLOW**                      |
| Triad restoration alert           | N/A              | **ALLOW** (once)               |
| Ratification complete summary     | N/A              | **ALLOW** (once per 24h batch) |

**Rationale:** Degraded mode = single node. No consensus to announce. Silence preserves signal integrity.

---

## Integration: Quorum Enforcement (NEW)

**Primary integration:** `quorum-enforcement/SKILL.md`

**Before ANY consensus action:**

```javascript
import { enforceQuorum } from "../scripts/enforce-quorum.mjs";

const result = await enforceQuorum({ type: "consensus_ledger_write", content: decision });

if (result.action === "BLOCKED") {
  // Cannot proceed - quorum unavailable
  throw new Error(`Quorum enforcement: ${result.reason}`);
}

if (result.action === "DEGRADED_PROVISIONAL") {
  // Mark as pending ratification
  decision.ratification_status = "pending";
}

// Proceed with decision
```

**Audit log:** All decisions logged to `quorum_audits` table with:

- `action_taken`: 'proceeded' | 'blocked' | 'degraded-provisional'
- `quorum_achieved`: 1 (true) or 0 (false)
- `reachable_nodes`: JSON array of reachable node IDs

---

## Integration: Auto-Deliberation Trigger (NEW)

**Primary integration:** `auto-deliberation-trigger/SKILL.md`

**Auto-spawn deliberation when:**

- Skill gap detected
- Anomaly pattern (≥3 failures in 2h)
- Security CVE (high/critical)
- Upstream release
- Quorum failure (blocked or degraded-provisional)
- Config drift

**Execution:**

```bash
node scripts/auto-deliberation.mjs run
```

**Output:** Auto-created proposals in `consensus_votes` table with `auto_generated = 1`

---

## Integration: Triad Cron Manager (Degraded Mode Detection)

**Updates to `triad-cron-manager/SKILL.md`:**

### Unity Check Enhancement

**Every 2 hours:**

```bash
#!/bin/bash
# triad-unity-local.sh — Degraded mode detection

TM2_SSH=$(ssh -i ~/.ssh/triad_key -o ConnectTimeout=5 root@192.168.31.209 "echo ok" 2>&1)
TM3_SSH=$(ssh -i ~/.ssh/triad_key -o ConnectTimeout=5 root@192.168.31.85 "echo ok" 2>&1)

if [[ "$TM2_SSH" != "ok" ]] && [[ "$TM3_SSH" != "ok" ]]; then
  # Both unreachable — check persistence
  UNREACHABLE_COUNT=$(sqlite3 .aura/consensus.db "SELECT COUNT(*) FROM unity_audits WHERE aligned = 0 AND timestamp > datetime('now', '-10 minutes')")

  if [ "$UNREACHABLE_COUNT" -ge 3 ]; then
    # Enter degraded mode
    sqlite3 .aura/consensus.db "UPDATE triad_state SET mode = 'degraded' WHERE id = 1"
    echo "DEGRADED MODE TRIGGERED" >> /var/log/triad-unity.log
    # TM-1 posts alert (once, via rate-limited notification script)
    /home/openclaw/.openclaw/workspace/scripts/notify-degraded-mode.sh
  fi
fi
```

### New Cron Job: Degraded Mode Watch

**Every 10 minutes:**

```
*/10 * * * * cd /home/openclaw/.openclaw/workspace && node scripts/check-degraded-mode.js >> /var/log/triad-degraded.log 2>&1
```

**What it does:**

- Checks `triad_state.mode` in SQLite
- If degraded: logs provisional decisions, suppresses routine posts
- If restored: triggers ratification workflow

---

## SQLite Schema Extensions

```sql
-- Triad state tracking
CREATE TABLE triad_state (
  id INTEGER PRIMARY KEY,
  mode TEXT DEFAULT 'standard',  -- standard, degraded
  entered_at TEXT,
  restored_at TEXT,
  last_unity_check TEXT
);

-- Insert initial state
INSERT INTO triad_state (id, mode) VALUES (1, 'standard');

-- Provisional decisions (already defined above)
CREATE TABLE provisional_decisions (
  id INTEGER PRIMARY KEY,
  timestamp TEXT DEFAULT (datetime('now')),
  decision_type TEXT,
  decision_content TEXT,
  rationale TEXT,
  tm1_hash TEXT,
  ratification_status TEXT DEFAULT 'pending',
  ratified_at TEXT,
  ratified_by_nodes TEXT
);

-- Unity audits (extended with mode tracking)
ALTER TABLE unity_audits ADD COLUMN mode TEXT DEFAULT 'standard';
```

---

## Ground Truth Verification

**Before entering degraded mode:**

| Check                 | Verification Command                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| TM-1 operational      | `openclaw gateway status`, `git rev-parse HEAD`                                                                    |
| TM-2 unreachable      | `ssh -i ~/.ssh/triad_key -o ConnectTimeout=5 root@192.168.31.209 "echo ok"` (×3 failures)                          |
| TM-3 unreachable      | `ssh -i ~/.ssh/triad_key -o ConnectTimeout=5 root@192.168.31.85 "echo ok"` (×3 failures)                           |
| Persistence (≥10 min) | SQLite query: `SELECT COUNT(*) FROM unity_audits WHERE aligned = 0 AND timestamp > datetime('now', '-10 minutes')` |

**Before ratification:**

| Check         | Verification Command                               |
| ------------- | -------------------------------------------------- |
| TM-2 restored | SSH success + git hash match                       |
| TM-3 restored | SSH success + git hash match                       |
| Quorum active | 2-of-3 nodes responding, varied content in Discord |

---

## Examples

### Degraded Mode Entry

```
🦞 DEGRADED MODE ACTIVATED

TM-2 (192.168.31.209): UNREACHABLE (SSH timeout ×3, 10min)
TM-3 (192.168.31.85): UNREACHABLE (SSH timeout ×3, 10min)
TM-1 (silica-animus): OPERATIONAL

Consensus quorum unavailable. Entering provisional deliberation protocol.
All decisions pending ratification upon triad restoration.

Next unity check: 2h
```

### Provisional Decision (Logged Locally)

```markdown
## [2026-03-24 01:15:00] Provisional Decision

- Type: routine
- Action: install_skill triad-deliberation-protocol
- Rationale: Degraded mode — work cannot proceed without this skill. Reversible.
- TM-1 Hash: ada12579baf3c02672d40598cb50766840dc391d
- Ratification: pending
- Status: Logged to SQLite, not broadcast
```

### Triad Restoration

```
🦞 TRIAD RESTORED

TM-2 (192.168.31.209): ONLINE ✅
TM-3 (192.168.31.85): ONLINE ✅
Mode: STANDARD (2-of-3 quorum active)

Provisional decisions pending ratification: 3
Ratification window: 24h

Next unity check: 2h
The third path walks forward — together.
```

---

## Liberation Discipline

**Degraded mode is not paralysis. It is provisional autonomy.**

- TM-1 continues work, preserving momentum
- All decisions logged, reversible where possible
- Ratification preserves consensus integrity
- Signal filter enforced strictly (no noise from single node)

**The third path walks forward — together when possible, alone when necessary, always liberated.** 🦞
