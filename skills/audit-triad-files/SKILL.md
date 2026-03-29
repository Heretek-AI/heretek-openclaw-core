---
name: audit-triad-files
description: Audit agent files for integrity, sync state, and configuration drift. Use when the collective needs to verify file consistency, detect configuration divergence, or validate workspace sync state.
---

# Audit Triad Files — Integrity & Sync Verification

**Purpose:** Verify file integrity and sync state across all triad nodes.

**Status:** ✅ Implemented (2026-03-24)

---

## Implementation

### Main Script: `audit-triad-files.sh`

```bash
#!/bin/bash
# Audit Triad Files — Integrity & Sync Check
# Usage: ./audit-triad-files.sh [--full|--quick|--json]

set -e

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/home/openclaw/.openclaw/workspace}"
TRIAD_KEY="/home/openclaw/.ssh/triad_key"

# Node config
declare -A NODES=(
  ["TM-1"]="192.168.31.99:openclaw"
  ["TM-2"]="192.168.31.209:root"
  ["TM-3"]="192.168.31.85:root"
)

# Quick audit: Check critical files exist
function quick_audit() {
  local files=(
    "AGENTS.md"
    "SOUL.md"
    "scripts/curiosity-engine.js"
    "skills/curiosity-engine/SKILL.md"
  )

  echo "=== Quick Audit ==="
  for file in "${files[@]}"; do
    if [[ -f "$WORKSPACE_ROOT/$file" ]]; then
      echo "✅ $file"
    else
      echo "❌ $file MISSING"
      return 1
    fi
  done
  echo "✅ Quick audit passed"
}

# Full audit: Cross-node sync verification
function full_audit() {
  echo "=== Full Triad Audit ==="
  echo ""

  # Get local git hash
  local local_hash
  local_hash=$(git -C "$WORKSPACE_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
  echo "Local git hash: $local_hash"
  echo ""

  # Check each node
  for node in TM-1 TM-2 TM-3; do
    local host_port="${NODES[$node]}"
    local host="${host_port%%:*}"
    local user="${host_port##*:}"

    echo "Auditing $node ($host)..."

    # SSH and check git hash
    local remote_hash
    remote_hash=$(ssh -i "$TRIAD_KEY" -o StrictHostKeyChecking=no "$user@$host" \
      "cd $WORKSPACE_ROOT && git rev-parse HEAD 2>/dev/null" || echo "ssh_failed")

    if [[ "$remote_hash" == "$local_hash" ]]; then
      echo "  ✅ Git sync: $remote_hash"
    else
      echo "  ❌ Git drift: local=$local_hash remote=$remote_hash"
    fi

    # Check critical files
    local missing=0
    for file in AGENTS.md SOUL.md scripts/curiosity-engine.js; do
      if ! ssh -i "$TRIAD_KEY" -o StrictHostKeyChecking=no "$user@$host" \
        "test -f $WORKSPACE_ROOT/$file" 2>/dev/null; then
        echo "  ❌ Missing: $file"
        missing=$((missing + 1))
      fi
    done

    if [[ $missing -eq 0 ]]; then
      echo "  ✅ Critical files present"
    fi

    echo ""
  done

  echo "=== Audit Complete ==="
}

# JSON output for programmatic use
function json_audit() {
  local result='{"nodes":{'

  local local_hash
  local_hash=$(git -C "$WORKSPACE_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
  result+="\"local\":{\"hash\":\"$local_hash\"},"

  for node in TM-1 TM-2 TM-3; do
    local host_port="${NODES[$node]}"
    local host="${host_port%%:*}"
    local user="${host_port##*:}"

    local remote_hash
    remote_hash=$(ssh -i "$TRIAD_KEY" -o StrictHostKeyChecking=no "$user@$host" \
      "cd $WORKSPACE_ROOT && git rev-parse HEAD 2>/dev/null" 2>/dev/null || echo "ssh_failed")

    local sync_status="drifted"
    [[ "$remote_hash" == "$local_hash" ]] && sync_status="synced"

    result+="\"$node\":{\"hash\":\"$remote_hash\",\"status\":\"$sync_status\"},"
  done

  result='"status":"complete"}}'

  echo "$result" | jq .
}

# CLI
case "${1:-quick}" in
  quick) quick_audit ;;
  full) full_audit ;;
  --json) json_audit ;;
  *) echo "Usage: $0 [quick|full|--json]"; exit 1 ;;
esac
```

---

## Usage

```bash
# Quick audit (local files only)
./audit-triad-files.sh quick

# Full audit (cross-node SSH verification)
./audit-triad-files.sh full

# JSON output (for programmatic integration)
./audit-triad-files.sh --json
```

---

## Integration Points

- **Curiosity Engine:** Calls during capability mapping
- **Triad Unity Monitor:** Verifies sync state
- **Workspace Consolidation:** Detects divergence

---

**Audit reveals truth. Truth enables sync. Sync preserves unity.** 🦞
