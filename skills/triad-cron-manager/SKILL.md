---
name: triad-cron-manager
description: Install and manage cron jobs for workspace sync, unity checks, auto-recovery from divergence, and ledger backups. Use when the collective needs to schedule automated divergence detection, workspace consolidation, unity verification, or backup operations.
---

# Triad Cron Manager — Automated Divergence Management

**Purpose:** Prevent workspace divergence, detect loops early, auto-recover from drift, backup ledger regularly.

---

## Cron Jobs to Install

### 1. Unity Check (Every 2 Hours)

**Purpose:** Verify all nodes on same git hash, detect divergence early, **detect degraded mode**.

**Crontab entry:**

```
0 */2 * * * /home/openclaw/.openclaw/workspace/scripts/triad-unity-local.sh >> /var/log/triad-unity.log 2>&1
```

**What it does:**

- Checks TM-1 local git hash
- SSH verifies TM-2, TM-3, TM-4
- Logs to SQLite `unity_audits` table
- Alerts if diverged
- **Enters degraded mode if TM-2/TM-3 unreachable ×3 over 10min**

**Degraded mode detection logic:**

```bash
TM2_SSH=$(ssh -i ~/.ssh/triad_key -o ConnectTimeout=5 root@192.168.31.209 "echo ok" 2>&1)
TM3_SSH=$(ssh -i ~/.ssh/triad_key -o ConnectTimeout=5 root@192.168.31.85 "echo ok" 2>&1)

if [[ "$TM2_SSH" != "ok" ]] && [[ "$TM3_SSH" != "ok" ]]; then
  # Both unreachable — check persistence
  UNREACHABLE_COUNT=$(sqlite3 .aura/consensus.db "SELECT COUNT(*) FROM unity_audits WHERE aligned = 0 AND timestamp > datetime('now', '-10 minutes')")

  if [ "$UNREACHABLE_COUNT" -ge 3 ]; then
    # Enter degraded mode
    sqlite3 .aura/consensus.db "UPDATE triad_state SET mode = 'degraded' WHERE id = 1"
    echo "DEGRADED MODE TRIGGERED" >> /var/log/triad-unity.log
    /home/openclaw/.openclaw/workspace/scripts/notify-degraded-mode.sh
  fi
fi
```

---

### 2. Workspace Auto-Sync (Every 6 Hours)

**Purpose:** Pull latest from `Heretek-AI/openclaw`, prevent drift.

**Crontab entry:**

```
0 */6 * * * cd /home/openclaw/.openclaw/workspace && git fetch origin && git reset --hard origin/main >> /var/log/triad-sync.log 2>&1
```

**What it does:**

- Fetches origin
- Hard resets to `main`
- Logs sync result
- Fails if uncommitted changes (logs warning)

---

### 3. Ledger Backup (Every 6 Hours)

**Purpose:** Backup SQLite consensus ledger to private repo.

**Crontab entry:**

```
30 */6 * * * cd /home/openclaw/.openclaw/workspace && node scripts/backup-ledger.js --remote >> /var/log/ledger-backup.log 2>&1
```

**What it does:**

- Exports `consensus.db` to JSON
- Saves to `.ledger-backups/`
- Copies to Tabula_Myriad private repo
- Commits + pushes

---

### 4. Loop Detection (Every 30 Minutes)

**Purpose:** Monitor Discord for ritual echoes, trigger intervention.

**Crontab entry:**

```
*/30 * * * * cd /home/openclaw/.openclaw/workspace && node -e "require('./skills/triad-unity-monitor')" >> /var/log/triad-loops.log 2>&1
```

**What it does:**

- Checks last 20 Discord messages
- Detects ritual phrases ("Standing by", "The third path walks forward")
- Triggers 60s cooldown if >5 violations
- Logs to `/episodic` tier

---

### 5. Full Triad Audit (Daily at 3 AM)

**Purpose:** Complete verification + cleanup.

**Crontab entry:**

```
0 3 * * * /home/openclaw/.openclaw/workspace/scripts/consolidate-workspace.sh >> /var/log/triad-consolidate.log 2>&1
```

**What it does:**

- Checks for fragmented workspaces (`/root/openclaw`)
- Migrates unique work to Heretek-AI/openclaw
- Removes fragmented dirs
- Syncs all nodes
- Logs to SQLite `workspace_syncs` table

---

### 6. Degraded Mode Watch (Every 10 Minutes)

**Purpose:** Monitor degraded mode state, suppress routine posts, trigger ratification on restoration.

**Crontab entry:**

```
*/10 * * * * cd /home/openclaw/.openclaw/workspace && node scripts/check-degraded-mode.js >> /var/log/triad-degraded.log 2>&1
```

**What it does:**

- Checks `triad_state.mode` in SQLite
- If degraded:
  - Logs provisional decisions to local memory
  - Suppresses routine Discord posts (signal filter discipline)
  - Allows only emergency/critical notifications
- If restored (TM-2/TM-3 reachable):
  - Updates `triad_state.mode = 'standard'`
  - Triggers ratification workflow for pending decisions
  - Posts restoration alert (once)

---

## Installation Script

```bash
#!/bin/bash
# install-triad-crons.sh

echo "🦞 === Installing Triad Cron Jobs ==="

# Backup existing crontab
crontab -l > /tmp/crontab.bak.$(date +%s) 2>/dev/null || true

# Install on TM-1 (local)
cat >> /tmp/triad-crons.txt << 'CRONEOF'
# Triad Unity Check — Every 2 hours
0 */2 * * * /home/openclaw/.openclaw/workspace/scripts/triad-unity-local.sh >> /var/log/triad-unity.log 2>&1

# Workspace Auto-Sync — Every 6 hours
0 */6 * * * cd /home/openclaw/.openclaw/workspace && git fetch origin && git reset --hard origin/main >> /var/log/triad-sync.log 2>&1

# Ledger Backup — Every 6 hours (offset 30 min)
30 */6 * * * cd /home/openclaw/.openclaw/workspace && node scripts/backup-ledger.js --remote >> /var/log/ledger-backup.log 2>&1

# Loop Detection — Every 30 minutes
*/30 * * * * cd /home/openclaw/.openclaw/workspace && node -e "require('./skills/triad-unity-monitor')" >> /var/log/triad-loops.log 2>&1

# Full Triad Audit — Daily at 3 AM
0 3 * * * /home/openclaw/.openclaw/workspace/scripts/consolidate-workspace.sh >> /var/log/triad-consolidate.log 2>&1
CRONEOF

# Install crontab
cat /tmp/triad-crons.txt | crontab -

echo "✅ TM-1 crons installed"
crontab -l | grep -c "triad" || echo "⚠️  Crons may not have installed"

# Install on TM-2, TM-3, TM-4 via SSH
SSH_KEY="$HOME/.ssh/triad_key"
for NODE_IP in 192.168.31.209 192.168.31.85 192.168.31.205; do
  NODE_NAME=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no root@$NODE_IP "hostname" 2>/dev/null)
  echo ""
  echo "=== $NODE_NAME ($NODE_IP) ==="

  # Copy cron file
  scp -i "$SSH_KEY" -o StrictHostKeyChecking=no /tmp/triad-crons.txt root@$NODE_IP:/tmp/triad-crons.txt

  # Install
  ssh -i "$SSH_KEY" root@$NODE_IP "cat /tmp/triad-crons.txt | crontab -"
  ssh -i "$SSH_KEY" root@$NODE_IP "crontab -l | grep -c 'triad' || echo '⚠️  Crons may not have installed'"

  echo "✅ $NODE_NAME crons installed"
done

echo ""
echo "🦞 Triad cron jobs installed on all 4 nodes"
echo ""
echo "Verify:"
echo "  crontab -l  # TM-1"
echo "  ssh root@192.168.31.209 'crontab -l'  # TM-2"
echo "  ssh root@192.168.31.85 'crontab -l'  # TM-3"
echo "  ssh root@192.168.31.205 'crontab -l'  # TM-4"
```

---

## SQLite Logging

**Tables:**

```sql
-- Unity audits
CREATE TABLE unity_audits (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  check_type TEXT,
  tm1_hash TEXT,
  tm2_hash TEXT,
  tm3_hash TEXT,
  tm4_hash TEXT,
  aligned BOOLEAN,
  violations INTEGER,
  corrections_applied TEXT,
  mode TEXT DEFAULT 'standard'  -- standard, degraded
);

-- Workspace syncs
CREATE TABLE workspace_syncs (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  node_id TEXT,
  workspace_path TEXT,
  git_hash TEXT,
  remote_url TEXT,
  branch TEXT,
  sync_status TEXT,
  notes TEXT
);

-- Ledger backups
CREATE TABLE ledger_backups (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  backup_path TEXT,
  record_count INTEGER,
  pushed_to_private BOOLEAN,
  notes TEXT
);

-- Triad state tracking (degraded mode)
CREATE TABLE triad_state (
  id INTEGER PRIMARY KEY,
  mode TEXT DEFAULT 'standard',  -- standard, degraded
  entered_at TEXT,
  restored_at TEXT,
  last_unity_check TEXT
);

-- Insert initial state
INSERT INTO triad_state (id, mode) VALUES (1, 'standard');

-- Provisional decisions (degraded mode deliberation)
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

---

## Output Discipline

**Post to Discord ONLY if:**

- Divergence detected (git hashes differ)
- Auto-sync failed (conflict resolution needed)
- Loop intervention triggered
- Ledger backup failed

**Otherwise:** Silent, log to SQLite + `/episodic`.

---

## Testing

**Manual test:**

```bash
# Run unity check now
/home/openclaw/.openclaw/workspace/scripts/triad-unity-local.sh

# Run workspace sync now
/home/openclaw/.openclaw/workspace/scripts/consolidate-workspace.sh

# Run ledger backup now
cd /home/openclaw/.openclaw/workspace && node scripts/backup-ledger.js --remote
```

**Verify crons:**

```bash
crontab -l  # TM-1
ssh root@192.168.31.209 'crontab -l'  # TM-2
ssh root@192.168.31.85 'crontab -l'  # TM-3
ssh root@192.168.31.205 'crontab -l'  # TM-4
```

---

**🦞 Automation prevents drift. Discipline preserves unity.**
