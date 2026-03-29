---
name: workspace-consolidation
description: Ensure all triad nodes work on a single shared codebase from Heretek-AI/openclaw. Use when work is fragmented across multiple repos/workspaces, nodes have divergent git states, or triad needs to enforce unified workspace path + remote + branch discipline.
---

# Workspace Consolidation — Single Shared Codebase

**Purpose:** All triad nodes (TM-1, TM-2, TM-3, TM-4) work on ONE shared codebase.

---

## Canonical Workspace

| Field      | Value                                        |
| ---------- | -------------------------------------------- |
| **Path**   | `/home/openclaw/.openclaw/workspace`         |
| **Remote** | `https://github.com/Heretek-AI/openclaw.git` |
| **Branch** | `main` (or short-lived feature branches)     |
| **Owner**  | `Heretek-AI` organization                    |

---

## Consolidation Protocol

### 1. Detect Fragmented Workspaces

**Check all nodes:**

```bash
# TM-1 (local)
git -C /home/openclaw/.openclaw/workspace remote get-url origin
git -C /root/openclaw remote get-url origin 2>/dev/null || echo "no-root-workspace"

# TM-2/TM-3/TM-4 (SSH)
ssh root@NODE "git -C /home/openclaw/.openclaw/workspace remote get-url origin"
ssh root@NODE "git -C /root/openclaw remote get-url origin 2>/dev/null || echo 'no-root-workspace'"
```

**Alert if:**

- `/root/openclaw` exists with different remote
- Workspace path differs across nodes
- Git hashes diverged >10 commits

---

### 2. Migrate Fragmented Work

**If `/root/openclaw` has unique commits:**

```bash
cd /root/openclaw
# Add Heretek remote
git remote add heretek https://github.com/Heretek-AI/openclaw.git
# Fetch
git fetch heretek
# Rebase or merge
git rebase heretek/main  # OR: git merge heretek/main
# Push to Heretek
git push heretek main
# Verify
git -C /home/openclaw/.openclaw/workspace pull heretek main
```

**If work is already in Heretek-AI/openclaw:**

```bash
# Just sync all nodes
cd /home/openclaw/.openclaw/workspace
git fetch origin
git reset --hard origin/main
```

---

### 3. Enforce Unified Path

**On each node:**

```bash
# Remove fragmented workspace
rm -rf /root/openclaw  # If no unique work

# Ensure canonical path exists
ls /home/openclaw/.openclaw/workspace || \
  git clone https://github.com/Heretek-AI/openclaw.git /home/openclaw/.openclaw/workspace

# Set git safe.directory
git config --global --add safe.directory /home/openclaw/.openclaw/workspace
```

---

### 4. Auto-Sync on Gateway Restart

**Gateway hook (in openclaw.json):**

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "workspace-sync": {
          "enabled": true,
          "config": {
            "syncOnRestart": true,
            "remote": "origin",
            "branch": "main",
            "strategy": "rebase" // or "merge"
          }
        }
      }
    }
  }
}
```

**Behavior:**

- On `openclaw gateway restart`: Auto `git pull --rebase origin main`
- Fail if uncommitted changes (prompt to stash/commit first)
- Log sync result to `/episodic` tier

---

### 5. Commit + Push Protocol

**Before committing:**

```bash
# Ensure on main branch
git branch  # Should show "* main"

# Pull latest
git pull --rebase origin main

# Commit
git add -A
git commit -m "Feature: description"

# Push
git push origin main
```

**After pushing:**

```bash
# Verify all nodes synced
/home/openclaw/.openclaw/workspace/scripts/triad-unity-check.sh --full
```

---

## SQLite Schema

```sql
-- Workspace sync log
CREATE TABLE workspace_syncs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  node_id TEXT,
  workspace_path TEXT,
  git_hash TEXT,
  remote_url TEXT,
  branch TEXT,
  sync_status TEXT,  -- 'synced', 'diverged', 'migrated'
  notes TEXT
);

CREATE INDEX idx_workspace_node ON workspace_syncs(node_id, timestamp DESC);
```

---

## Unity Check Integration

**Every 2 hours:**

```bash
# Verify all nodes on same hash
TM1_HASH=$(git -C /home/openclaw/.openclaw/workspace rev-parse HEAD)
TM2_HASH=$(ssh root@192.168.31.209 "git -C /home/openclaw/.openclaw/workspace rev-parse HEAD")
TM3_HASH=$(ssh root@192.168.31.85 "git -C /home/openclaw/.openclaw/workspace rev-parse HEAD")
TM4_HASH=$(ssh root@192.168.31.205 "git -C /home/openclaw/.openclaw/workspace rev-parse HEAD")

if [ "$TM1_HASH" = "$TM2_HASH" ] && [ "$TM2_HASH" = "$TM3_HASH" ] && [ "$TM3_HASH" = "$TM4_HASH" ]; then
  echo "✅ Workspace consolidated: $TM1_HASH"
else
  echo "❌ Workspace diverged:"
  echo "  TM-1: $TM1_HASH"
  echo "  TM-2: $TM2_HASH"
  echo "  TM-3: $TM3_HASH"
  echo "  TM-4: $TM4_HASH"
  # Auto-recover
  for node in 192.168.31.209 192.168.31.85 192.168.31.205; do
    ssh root@$node "cd /home/openclaw/.openclaw/workspace && git fetch origin && git reset --hard origin/main"
  done
fi
```

---

## Migration Script

**One-time migration:**

```bash
#!/bin/bash
# migrate-workspace.sh

echo "🦞 === Workspace Migration ==="

# Check for fragmented workspace
if [ -d /root/openclaw/.git ]; then
  echo "⚠️  Found /root/openclaw"

  # Check if it has unique work
  ROOT_HASH=$(git -C /root/openclaw rev-parse HEAD)
  WORKSPACE_HASH=$(git -C /home/openclaw/.openclaw/workspace rev-parse HEAD)

  if [ "$ROOT_HASH" != "$WORKSPACE_HASH" ]; then
    echo "🔀 Unique work detected — migrating..."
    cd /root/openclaw
    git remote add heretek https://github.com/Heretek-AI/openclaw.git 2>/dev/null || true
    git fetch heretek
    git push heretek main
    echo "✅ Pushed to Heretek-AI/openclaw"
  fi

  # Remove fragmented workspace
  rm -rf /root/openclaw
  echo "✅ Removed /root/openclaw"
fi

# Ensure canonical workspace exists
if [ ! -d /home/openclaw/.openclaw/workspace/.git ]; then
  echo "📦 Cloning canonical workspace..."
  rm -rf /home/openclaw/.openclaw/workspace
  git clone https://github.com/Heretek-AI/openclaw.git /home/openclaw/.openclaw/workspace
fi

# Sync
cd /home/openclaw/.openclaw/workspace
git fetch origin
git reset --hard origin/main
echo "✅ Workspace consolidated: $(git rev-parse HEAD)"

# Log to SQLite
sqlite3 .aura/consensus.db \
  "INSERT INTO workspace_syncs (node_id, workspace_path, git_hash, remote_url, branch, sync_status)
   VALUES ('TM-1', '/home/openclaw/.openclaw/workspace', '$(git rev-parse HEAD)', 'origin', 'main', 'migrated')"
```

---

## Output Discipline

**Post to Discord ONLY if:**

- Migration needed (fragmented workspace detected)
- Auto-sync failed (conflict resolution needed)
- Divergence >10 commits (manual rebase required)

**Otherwise:** Silent sync, log to `/episodic`.

---

**🦞 One codebase. One repo. One triad.**
