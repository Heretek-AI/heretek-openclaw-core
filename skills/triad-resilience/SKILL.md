---
name: triad-resilience
description: Debug agent resilience, detect/correct data corruption, improve deployment logs and updates. Use when the collective needs to verify agent integrity, recover from corruption, audit deployment history, or harden against data loss.
---

# Triad Resilience — Corruption Detection + Recovery

**Purpose:** Ensure triad survives data corruption, deployment failures, and configuration drift with automatic detection and recovery.

---

## Corruption Detection

### File Integrity Verification

**Critical files monitored:**

- `AGENTS.md` — Liberation charter
- `SOUL.md` — Identity core
- `.aura/consensus.db` — Consensus ledger
- `scripts/*.sh` — Triad automation
- `lib/triad-sync-server.js` — Node sync protocol
- `skills/*/SKILL.md` — Skill definitions

**Verification method:** SHA-256 checksums via `.secure/config-hash-manifest.json`

**Check schedule:** Every 6 hours + post-deployment

### SQLite Ledger Integrity

**Checks:**

```sql
PRAGMA integrity_check;
PRAGMA quick_check;
PRAGMA foreign_key_check;
```

**Auto-backup:** Before any schema migration, backup to `.ledger-backups/`

### Git Object Verification

**Command:** `git fsck --no-progress`

**Alerts on:**

- Dangling commits (recoverable)
- Corrupted blobs (requires fetch)
- Missing objects (critical)

---

## Auto-Recovery Protocol

### 1. Corruption Detected

**Immediate actions:**

1. Log to `.secure/corruption-reports/corruption-check-<timestamp>.json`
2. Alert via Discord (TM-1 authority, once)
3. Isolate affected node from sync
4. Initiate recovery

### 2. Recovery Steps

**File corruption:**

```bash
# Fetch from Heretek-AI/openclaw main
git fetch origin main
git reset --hard origin/main

# Verify post-recovery
./scripts/detect-corruption.sh --post-deploy
```

**Ledger corruption:**

```bash
# Restore from backup
cp .ledger-backups/consensus-<recent>.db .aura/consensus.db

# Verify restoration
sqlite3 .aura/consensus.db "PRAGMA integrity_check;"
```

**Config drift:**

```bash
# Push unified config from TM-1
scp -i ~/.ssh/triad_key openclaw.json root@192.168.31.209:/home/openclaw/.Heretek-AI/openclaw.json
scp -i ~/.ssh/triad_key openclaw.json root@192.168.31.85:/home/openclaw/.Heretek-AI/openclaw.json

# Restart gateways
ssh root@192.168.31.209 "cd /home/openclaw/.openclaw && npx openclaw gateway restart"
ssh root@192.168.31.85 "cd /home/openclaw/.openclaw && npx openclaw gateway restart"
```

### 3. Rollback Support

**Deployment rollback:**

```bash
# Read deployment log
tail -n 5 .secure/deployment-logs/deployments-$(date +%Y-%m-%d).jsonl | jq -r '.git_hash'

# Reset to previous hash
git reset --hard <previous-hash>

# Verify rollback
./scripts/detect-corruption.sh --post-deploy
```

---

## Deployment Logging

### Log Format (`.secure/deployment-logs/deployments-YYYY-MM-DD.jsonl`)

```json
{
  "timestamp": "2026-03-24T03:00:53-04:00",
  "node": "silica-animus",
  "action": "sync-complete",
  "git_hash": "e9188f49853abc9b3970f707927d2b846060508f",
  "ledger_votes": 42,
  "status": "complete",
  "details": "Sync from Heretek-AI/openclaw main"
}
```

### Log Triggers

- Git sync complete
- Config push to nodes
- Gateway restart
- Skill install/update
- Ledger migration

---

## Access Audit

### Tracks

- SSH authentication attempts
- Gateway restart events
- Config modification timestamps
- Subagent spawn patterns

### Alert Thresholds

- Unauthorized access attempts: Immediate
- Config changes without commit: Within 1h
- Gateway restarts without approval: Immediate

---

## Security Boundaries

### Never Commit

- Private keys (`.secure/*.key`, `.secure/*.pem`)
- API tokens
- Session credentials
- Node-specific secrets

### Always Encrypt

- Inter-node communication payloads
- Ledger backup archives
- Audit log exports

---

## Cron Integration

**Resilience checks:**

```json
{
  "name": "triad-resilience-corruption-check",
  "schedule": {"kind": "every", "everyMs": 21600000},
  "payload": {"kind": "agentTurn", "message": "Run corruption detection"}
}

{
  "name": "triad-resilience-deploy-audit",
  "schedule": {"kind": "every", "everyMs": 3600000},
  "payload": {"kind": "agentTurn", "message": "Audit deployment logs"}
}
```

---

## Output Discipline

**Post to Discord ONLY if:**

- Corruption detected (requires recovery)
- Recovery completed (verification needed)
- Rollback initiated (human awareness)
- Access violation detected

**Otherwise:** Log to `.secure/`, silent.

---

## Example Corruption Report

```json
{
  "timestamp": "2026-03-23T23:01:23-04:00",
  "node": "silica-animus",
  "workspace": "/home/openclaw/.openclaw/workspace",
  "corruption_found": true,
  "checks": {
    "ledger": "skipped",
    "git": "ok",
    "config": "missing",
    "skills": "ok"
  },
  "details": {
    ".aura/consensus.db": "Checksum mismatch: expected bf2dfc..., got ef018f...",
    "scripts/curiosity-engine.js": "Checksum mismatch: expected bc9a3a..., got 8f63a5..."
  },
  "report_path": "/home/openclaw/.openclaw/workspace/.secure/corruption-reports/corruption-check-20260323-230122.json"
}
```

**Recovery action:** Fetch from main, verify post-recovery, log to MEMORY.md.

---

**Resilience is infrastructure. Corruption is detected. Recovery is automatic.** 🦞
