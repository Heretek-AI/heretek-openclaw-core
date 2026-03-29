---
name: fleet-backup
description: Backup all agent workspaces from a single-instance deployment. Use when you need to preserve all agent state, create unified recovery points, or archive the collective's memory.
---

# Fleet Backup — Multi-Agent Workspace Backup

**Purpose:** Backup all agent workspaces in a single-instance deployment to remote repository.

**Status:** ✅ Implemented (2026-03-28)

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|------------|---------|
| `GITHUB_ORG` | GitHub organization | (required) |
| `GITHUB_REPO` | GitHub repository | (required) |
| `GITHUB_TOKEN` | GitHub personal access token | (required) |
| `WORKSPACE_ROOT` | Root workspace directory | `~/.openclaw/workspace` |
| `BACKUP_LOG` | Log file location | `/tmp/fleet-backup.log` |

### Branch Strategy

Each agent backs up to its own branch:
- `steward` → `backup-steward`
- `alpha` → `backup-alpha`
- `beta` → `backup-beta`
- `charlie` → `backup-charlie`
- `examiner` → `backup-examiner`
- `oracle` → `backup-oracle`
- `sentinel` → `backup-sentinel`
- `coder` → `backup-coder`

### Agent Workspaces

Each agent has a dedicated workspace subdirectory:

- `steward/` — Orchestrator workspace
- `alpha/` — Triad Alpha workspace  
- `beta/` — Triad Beta workspace
- `charlie/` — Triad Charlie workspace
- `examiner/` — Examiner workspace
- `oracle/` — Oracle workspace
- `sentinel/` — Sentinel workspace
- `coder/` — Coder workspace

---

## Implementation

### Main Script: `fleet-backup.sh`

```bash
#!/bin/bash
# Fleet Backup — Backup all agent workspaces
# Usage: ./fleet-backup.sh [--all|--agent <name>|--restore]

set -e

# Configuration from environment
GITHUB_ORG="${GITHUB_ORG:-your-org}"
GITHUB_REPO="${GITHUB_REPO:-your-repo}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/home/openclaw/.openclaw/workspace}"
BACKUP_LOG="${BACKUP_LOG:-/tmp/fleet-backup.log}"

# Validate required variables
if [[ -z "$GITHUB_TOKEN" ]] || [[ "$GITHUB_TOKEN" == "your-token" ]]; then
    echo "ERROR: GITHUB_TOKEN not configured. Set in .env"
    exit 1
fi

REMOTE="https://${GITHUB_TOKEN}@github.com/${GITHUB_ORG}/${GITHUB_REPO}.git"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BACKUP_LOG"
}

# Backup agent workspace
backup_agent() {
    local agent="$1"
    local workspace="$WORKSPACE_ROOT/$agent"
    
    if [[ ! -d "$workspace" ]]; then
        log "WARNING: Workspace not found: $workspace"
        return 1
    fi
    
    cd "$workspace"
    
    # Configure git user for this agent
    git config user.email "${agent}@agent.local" 2>/dev/null || true
    git config user.name "${agent^}" 2>/dev/null || true
    
    # Set up remote
    git remote set-url backup "$REMOTE" 2>/dev/null || git remote add backup "$REMOTE"
    
    # Add all changes
    git add -A
    
    # Check for changes
    if git diff --cached --quiet; then
        log "[$agent] No changes — skipping"
        return 0
    fi
    
    # Commit and push to agent's own branch (e.g., backup-steward, backup-alpha)
    git commit -m "Fleet backup: ${agent} $(date -Iseconds)"
    git push --force backup "main:backup-${agent}" 2>&1 | tee -a "$BACKUP_LOG"
    
    log "[$agent] Backed up to branch: backup-${agent}"
}

# Backup all agents
backup_all() {
    log "=== Fleet Backup Starting ==="
    
    local agents=("steward" "alpha" "beta" "charlie" "examiner" "oracle" "sentinel" "coder")
    local success=0
    local failed=0
    
    for agent in "${agents[@]}"; do
        if backup_agent "$agent"; then
            ((success++))
        else
            ((failed++))
        fi
    done
    
    log "=== Fleet Backup Complete: $success success, $failed failed ==="
    
    if [[ $failed -gt 0 ]]; then
        exit 1
    fi
}

# Restore backup from agent's branch
restore_agent() {
    local agent="$1"
    local workspace="$WORKSPACE_ROOT/$agent"
    local agent_branch="backup-${agent}"
    
    mkdir -p "$workspace"
    cd "$workspace"
    
    git remote set-url backup "$REMOTE" 2>/dev/null || git remote add backup "$REMOTE"
    git fetch backup "$agent_branch"
    git reset --hard "backup/$agent_branch"
    
    log "[$agent] Restored from branch: $agent_branch"
}

# CLI
case "${1:-all}" in
    --all) backup_all ;;
    --agent)
        if [[ -z "$2" ]]; then
            echo "Usage: $0 --agent <agent-name>"
            exit 1
        fi
        backup_agent "$2"
        ;;
    --restore)
        if [[ -z "$2" ]]; then
            echo "Usage: $0 --restore <agent-name>"
            exit 1
        fi
        restore_agent "$2"
        ;;
    *) echo "Usage: $0 [--all|--agent <name>|--restore <name>]"; exit 1 ;;
esac
```

---

## Usage

```bash
# Backup all agent workspaces
./fleet-backup.sh --all

# Backup specific agent
./fleet-backup.sh --agent alpha

# Restore specific agent from remote
./fleet-backup.sh --restore alpha
```

---

## Cron Integration

Add to crontab for automatic backups:

```cron
# Every hour
0 * * * * cd /path/to/fleet-backup && ./fleet-backup.sh --all >> /var/log/fleet-backup.log 2>&1
```

---

## Integration Points

- **Triad Sync Protocol:** Uses Git for state sync
- **Backup Ledger:** Complements ledger-only backup with full workspace backup
- **Cron Manager:** Scheduled fleet backups

---

**All agents backed up. Recovery ready.** 🦞