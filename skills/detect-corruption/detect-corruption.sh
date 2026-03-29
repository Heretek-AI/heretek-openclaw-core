#!/bin/bash
# Detect Corruption — Integrity Verification
# Usage: ./detect-corruption.sh [--scan|--verify|--report]

set -e

WORKSPACE_ROOT="${WORKSPACE_ROOT:-${HOME}/.openclaw/workspace}"
SECURE_DIR="$WORKSPACE_ROOT/.secure"
CORRUPTION_REPORTS="$SECURE_DIR/corruption-reports"

# Ensure directories exist
mkdir -p "$CORRUPTION_REPORTS"

# File integrity check (SHA256 manifest)
function check_manifest() {
  local manifest="$SECURE_DIR/config-hash-manifest.json"
  
  if [[ ! -f "$manifest" ]]; then
    echo "⚠️  No manifest found. Generating baseline..."
    generate_manifest
    return 0
  fi
  
  echo "=== Checking Manifest ==="
  
  local corrupted=0
  while IFS=':' read -r file hash; do
    if [[ -f "$WORKSPACE_ROOT/$file" ]]; then
      local current_hash
      current_hash=$(sha256sum "$WORKSPACE_ROOT/$file" | cut -d' ' -f1)
      if [[ "$current_hash" != "$hash" ]]; then
        echo "❌ Corrupted: $file"
        corrupted=$((corrupted + 1))
      else
        echo "✅ OK: $file"
      fi
    else
      echo "❌ Missing: $file"
      corrupted=$((corrupted + 1))
    fi
  done < <(jq -r '.files | to_entries[] | "\(.key):\(.value.hash)"' "$manifest")
  
  if [[ $corrupted -gt 0 ]]; then
    echo ""
    echo "⚠️  Corruption detected: $corrupted files"
    report_corruption "$corrupted"
    return 1
  fi
  
  echo "✅ No corruption detected"
  return 0
}

# Generate baseline manifest
function generate_manifest() {
  echo "Generating integrity manifest..."
  
  local manifest='{"files":{'
  
  for file in AGENTS.md SOUL.md scripts/curiosity-engine.js; do
    if [[ -f "$WORKSPACE_ROOT/$file" ]]; then
      local hash
      hash=$(sha256sum "$WORKSPACE_ROOT/$file" | cut -d' ' -f1)
      manifest+="\"$file\":{\"hash\":\"$hash\"},"
    fi
  done
  
  manifest='"status":"complete"}}'
  
  echo "$manifest" | jq . > "$SECURE_DIR/config-hash-manifest.json"
  echo "✅ Manifest generated"
}

# Report corruption
function report_corruption() {
  local count="$1"
  local report="$CORRUPTION_REPORTS/corruption-$(date +%s).json"
  
  cat > "$report" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "corrupted_files": $count,
  "severity": "$([ $count -gt 5 ] && echo "critical" || echo "warning")",
  "action": "Review and restore from backup"
}
EOF
  
  echo "📝 Corruption report written: $report"
}

# Verify database integrity
function verify_db() {
  local db="$WORKSPACE_ROOT/.aura/consensus.db"
  
  if [[ -f "$db" ]]; then
    if sqlite3 "$db" "PRAGMA integrity_check" 2>/dev/null | grep -q "ok"; then
      echo "✅ Database integrity: OK"
      return 0
    else
      echo "❌ Database corruption detected"
      return 1
    fi
  else
    echo "⚠️  Database not found"
    return 0
  fi
}

# CLI
case "${1:-scan}" in
  --scan) check_manifest ;;
  --verify) verify_db ;;
  --report) report_corruption 1 ;;
  --full) check_manifest && verify_db ;;
  *) echo "Usage: $0 [--scan|--verify|--report|--full]"; exit 1 ;;
esac
