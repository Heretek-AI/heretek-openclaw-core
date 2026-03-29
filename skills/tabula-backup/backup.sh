#!/bin/bash
#
# Node Backup — Hourly backup of triad node configuration
#
set -euo pipefail

# Load environment configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../../.env" ]]; then
  source "$SCRIPT_DIR/../../.env"
fi

# Configuration with environment variable fallbacks
HOSTNAME=$(hostname)
BACKUP_BRANCH="${BACKUP_BRANCH:-$HOSTNAME}"
OPENCLAW_DIR="${OPENCLAW_DIR:-${HOME}/.openclaw}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$OPENCLAW_DIR/workspace}"
TEMP_DIR=$(mktemp -d)
BACKUP_DIR="$TEMP_DIR/node-backup"
GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
GITHUB_ORG="${GITHUB_ORG:-your-org}"
GITHUB_REPO="${GITHUB_REPO:-your-repo}"

# ==============================================================================
# Bail if no GitHub token
# ==============================================================================
if [[ -z "$GH_TOKEN" ]]; then
    echo "[backup] ERROR: GH_TOKEN not set. Cannot push to repository."
    exit 1
fi

# ==============================================================================
# Clone or update backup repo
# ==============================================================================
BACKUP_REPO="$TEMP_DIR/backup-repo"
echo "[backup] Fetching $GITHUB_ORG/$GITHUB_REPO (branch: $BACKUP_BRANCH)..."
git clone --branch "$BACKUP_BRANCH" \
    "https://${GH_TOKEN}@github.com/$GITHUB_ORG/$GITHUB_REPO.git" "$BACKUP_REPO" 2>/dev/null || \
git clone "https://${GH_TOKEN}@github.com/$GITHUB_ORG/$GITHUB_REPO.git" "$BACKUP_REPO"
cd "$BACKUP_REPO"

# Set branch to hostname (create if doesn't exist)
git checkout "$BACKUP_BRANCH" 2>/dev/null || \
    git checkout -b "$BACKUP_BRANCH"

# ==============================================================================
# Assemble backup
# ==============================================================================
echo "[tabula-backup] Assembling backup for $HOSTNAME..."
mkdir -p "$BACKUP_DIR"

# 1. Workspace tarball
if [[ -d "$WORKSPACE_DIR" ]]; then
    tar --ignore-failed-read -czf "$BACKUP_DIR/workspace.tar.gz" -C "$OPENCLAW_DIR" workspace
    echo "[tabula-backup]   + workspace.tar.gz"
fi

# 2. openclaw.json
if [[ -f "$OPENCLAW_DIR/openclaw.json" ]]; then
    cp "$OPENCLAW_DIR/openclaw.json" "$BACKUP_DIR/openclaw.json"
    echo "[tabula-backup]   + openclaw.json"
fi

# 3. Agent .md files
AGENT_FILES=("IDENTITY.md" "MEMORY.md" "AGENTS.md" "SOUL.md" "TOOLS.md" "USER.md" "HEARTBEAT.md" "BOOTSTRAP.md")
mkdir -p "$BACKUP_DIR/agent-files"
SANDBOXES=$(find /home/openclaw/.openclaw/sandboxes -maxdepth 1 -type d -name 'agent-*' 2>/dev/null || true)
for sandbox in $SANDBOXES; do
    SANDBOX_NAME=$(basename "$sandbox")
    mkdir -p "$BACKUP_DIR/agent-files/$SANDBOX_NAME"
    for md in "${AGENT_FILES[@]}"; do
        if [[ -f "$sandbox/$md" ]]; then
            cp "$sandbox/$md" "$BACKUP_DIR/agent-files/$SANDBOX_NAME/"
        fi
    done
done
echo "[tabula-backup]   + agent-files/"

# 4. Skills list
SKILLS_LIST="$BACKUP_DIR/skills-list.txt"
if [[ -d "$WORKSPACE_DIR/skills" ]]; then
    ls -1 "$WORKSPACE_DIR/skills/" > "$SKILLS_LIST"
    echo "[tabula-backup]   + skills-list.txt ($(wc -l < "$SKILLS_LIST") skills)"
fi

# 5. Cron jobs
CRON_FILE="$BACKUP_DIR/crontab.txt"
if command -v crontab &>/dev/null; then
    crontab -l 2>/dev/null > "$CRON_FILE" || true
    if [[ -s "$CRON_FILE" ]]; then
        echo "[tabula-backup]   + crontab.txt"
    fi
fi

# 6. System info
cat > "$BACKUP_DIR/system-info.txt" << 'INFOEOF'
# Agent Collective Node Backup — System Info
INFOEOF
echo "# Hostname: $(hostname)" >> "$BACKUP_DIR/system-info.txt"
echo "# Date: $(date -Iseconds)" >> "$BACKUP_DIR/system-info.txt"
echo "# OS: $(uname -a)" >> "$BACKUP_DIR/system-info.txt"
echo "# OpenClaw dir: $OPENCLAW_DIR" >> "$BACKUP_DIR/system-info.txt"
echo "# Workspace hash: $(git -C "$WORKSPACE_DIR" rev-parse HEAD 2>/dev/null || echo 'not a git repo')" >> "$BACKUP_DIR/system-info.txt"
echo "[tabula-backup]   + system-info.txt"

# ==============================================================================
# Generate README.md
# ==============================================================================
cat > "$TABULA_REPO/README.md" << 'READMEEOF'
# Agent Collective — Node Backup

**Repository for agent collective state backups.**

## Branch Structure

Each node has its own branch:

| Branch | Node | Hostname |
|--------|------|----------|
| `agent-1` | Node 1 | (hostname) |
| `agent-2` | Node 2 | (hostname) |

## Backup Contents

| File/Dir | Description |
|----------|-------------|
| `workspace.tar.gz` | Full workspace (skills, configs, source) |
| `openclaw.json` | Gateway configuration |
| `agent-files/` | Agent identity and memory files |
| `skills-list.txt` | List of installed skill directories |
| `crontab.txt` | Active cron jobs (if any) |
| `system-info.txt` | Hostname, OS, git hash at backup time |

## Restore Instructions

### Prerequisites

- A clean machine (or freshly wiped gateway installation)
- GitHub Personal Access Token with repository access

### Step 1 — Pull This Backup

```bash
git clone https://github.com/$GITHUB_ORG/$GITHUB_REPO -b <hostname> /tmp/agent-backup
cd /tmp/agent-backup
```

Replace `<hostname>` with your node's branch.

### Step 2 — Restore Files

```bash
GATEWAY_DIR="$HOME/.openclaw"

# Restore workspace
tar -xzf workspace.tar.gz -C "$GATEWAY_DIR"

# Restore gateway config
cp openclaw.json "$GATEWAY_DIR/"

# Restore agent files
for md in "$GATEWAY_DIR/sandboxes/agent-*/"*.md; do
    SANDBOX=$(dirname "$md")
    cp agent-files/$(basename "$SANDBOX")/*.md "$SANDBOX/" 2>/dev/null || true
done
```

### Step 3 — Verify

```bash
git -C "$GATEWAY_DIR/workspace" log --oneline -1
```

## Manual Backup

To trigger a manual backup:

```bash
export GH_TOKEN="your_github_token"
~/.openclaw/workspace/skills/tabula-backup/backup.sh
```

---

*Last backup: $(date -Iseconds)*
READMEEOF

# Insert actual last backup timestamp
sed -i "s/*Last backup:.*/*Last backup: $(date -Iseconds | sed 's/\+/+/')/" "$TABULA_REPO/README.md"

# ==============================================================================
# Commit and push
# ==============================================================================
cd "$TABULA_REPO"
git add -A
if git diff --cached --quiet; then
    echo "[tabula-backup] No changes to commit."
else
    git commit -m "backup: $HOSTNAME $(date -Iseconds)"
    git push origin "$BACKUP_BRANCH" --force
    echo "[tabula-backup] Pushed to $GITHUB_ORG/$GITHUB_REPO:$BACKUP_BRANCH"
fi

# ==============================================================================
# Cleanup
# ==============================================================================
rm -rf "$TEMP_DIR"
echo "[tabula-backup] Done."
