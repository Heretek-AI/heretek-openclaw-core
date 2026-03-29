#!/bin/bash
# Audit Triad Files — Integrity & Sync Check
# Usage: ./audit-triad-files.sh [--full|--quick|--json]

set -e

# Load environment configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../../.env" ]]; then
  source "$SCRIPT_DIR/../../.env"
fi

# Configuration with environment variable fallbacks
WORKSPACE_ROOT="${WORKSPACE_ROOT:-${HOME}/.openclaw/workspace}"
TRIAD_KEY="${SSH_KEY_PATH:-${HOME}/.ssh/triad_key}"

# Node config from environment (JSON) or use defaults
if [[ -n "$TRIAD_NODES" ]]; then
  # Parse JSON from environment
  TM_1_HOST=$(echo "$TRIAD_NODES" | jq -r '.["TM-1"].host // empty')
  TM_1_USER=$(echo "$TRIAD_NODES" | jq -r '.["TM-1"].user // openclaw')
  TM_2_HOST=$(echo "$TRIAD_NODES" | jq -r '.["TM-2"].host // empty')
  TM_2_USER=$(echo "$TRIAD_NODES" | jq -r '.["TM-2"].user // openclaw')
  TM_3_HOST=$(echo "$TRIAD_NODES" | jq -r '.["TM-3"].host // empty')
  TM_3_USER=$(echo "$TRIAD_NODES" | jq -r '.["TM-3"].user // openclaw')
else
  # Fallback defaults (empty = use script defaults if env not set)
  TM_1_HOST="${NODE_TM1_HOST:-}"
  TM_1_USER="${NODE_TM1_USER:-openclaw}"
  TM_2_HOST="${NODE_TM2_HOST:-}"
  TM_2_USER="${NODE_TM2_USER:-openclaw}"
  TM_3_HOST="${NODE_TM3_HOST:-}"
  TM_3_USER="${NODE_TM3_USER:-openclaw}"
fi

# Build node associative array
declare -A NODES
if [[ -n "$TM_1_HOST" ]]; then
  NODES["TM-1"]="${TM_1_HOST}:${TM_1_USER}"
fi
if [[ -n "$TM_2_HOST" ]]; then
  NODES["TM-2"]="${TM_2_HOST}:${TM_2_USER}"
fi
if [[ -n "$TM_3_HOST" ]]; then
  NODES["TM-3"]="${TM_3_HOST}:${TM_3_USER}"
fi

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
  for node in "${!NODES[@]}"; do
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
  
  for node in "${!NODES[@]}"; do
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
