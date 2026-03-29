#!/bin/bash
# Quorum Enforcement Check — CLI wrapper
# Usage: ./quorum-enforcement.sh [--json]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-/home/openclaw/.openclaw/workspace}"
export WORKSPACE
export NODE_PATH="${NODE_PATH:-/home/openclaw/.npm-global/lib/node_modules}"

cd "$WORKSPACE"

echo "=== Quorum Enforcement Check ==="
echo ""

# Run quorum check
QUORUM_JSON=$(node "$SCRIPT_DIR/quorum-check.mjs" --json 2>/dev/null)

REACHABLE=$(echo "$QUORUM_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('reachableCount',0))")
QUORUM=$(echo "$QUORUM_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d.get('quorum',False) else 'false')")

echo "Reachable nodes: $REACHABLE"
echo "Quorum (2-of-3): $QUORUM"
echo ""

if [ "$QUORUM" = "true" ]; then
  echo "✅ Quorum available. Consensus decisions permitted."
else
  echo "❌ Quorum unavailable. Consensus decisions BLOCKED."
  echo ""
  echo "Reachable:"
  echo "$QUORUM_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); [print('  - ' + n['node']) for n in d.get('nodes',[]) if n.get('reachable')]"
  echo ""
  echo "Unreachable:"
  echo "$QUORUM_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); [print('  - ' + n['node'] + ': ' + n.get('error','')) for n in d.get('nodes',[]) if not n.get('reachable')]"
fi
