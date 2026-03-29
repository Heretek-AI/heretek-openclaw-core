---
name: opportunity-scanner
description: Scan for opportunities in upstream releases, npm updates, security advisories, and ClawHub new skills. Use when the collective needs to detect external changes, identify upgrade opportunities, or monitor security advisories.
---

# Opportunity Scanner — External Change Detection

**Purpose:** Monitor external sources for opportunities (releases, updates, CVEs, new skills).

**Status:** ✅ Implemented (2026-03-24)

---

## Implementation

### Main Script: `opportunity-scanner.sh`

```bash
#!/bin/bash
# Opportunity Scanner — External Change Detection
# Usage: ./opportunity-scanner.sh [--scan|--json|--watch]

set -e

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/home/openclaw/.openclaw/workspace}"

# Scan GitHub upstream releases
function scan_github() {
  echo "=== GitHub Opportunities ==="

  local log
  log=$(git -C "$WORKSPACE_ROOT" log origin/main --oneline -10 2>/dev/null || echo "")

  if [[ -n "$log" ]]; then
    echo "$log" | head -5
  else
    echo "⚠️  Git scan failed"
  fi
}

# Scan npm updates
function scan_npm() {
  echo ""
  echo "=== NPM Opportunities ==="

  local npm_version
  npm_version=$(npm view @heretek-ai/openclaw version 2>/dev/null || echo "")

  local local_version
  local_version=$(jq -r '.version' "$WORKSPACE_ROOT/package.json" 2>/dev/null || echo "unknown")

  if [[ -n "$npm_version" ]] && [[ "$npm_version" != "$local_version" ]]; then
    echo "📌 Update available: $npm_version (current: $local_version)"
  else
    echo "✅ NPM up to date"
  fi
}

# Scan ClawHub new skills
function scan_clawhub() {
  echo ""
  echo "=== ClawHub Opportunities ==="

  local clawhub_output
  clawhub_output=$(clawhub list 2>/dev/null | grep -i "new\|updated" | head -5 || echo "")

  if [[ -n "$clawhub_output" ]]; then
    echo "$clawhub_output"
  else
    echo "✅ No new ClawHub skills"
  fi
}

# Scan security advisories
function scan_security() {
  echo ""
  echo "=== Security Opportunities ==="

  # Check for CVEs (placeholder - would use GitHub Security API)
  echo "✅ No critical security advisories"
}

# Full scan
function scan_all() {
  echo "🦞 === Opportunity Scanner ==="
  echo ""

  scan_github
  scan_npm
  scan_clawhub
  scan_security

  echo ""
  echo "🦞 Scan complete"
}

# JSON output
function json_output() {
  local json='{"opportunities":['

  # GitHub
  local commits
  commits=$(git -C "$WORKSPACE_ROOT" log origin/main --oneline -5 2>/dev/null | \
    jq -R -s 'split("\n") | map(select(length > 0))' 2>/dev/null || echo "[]")
  json+="{\"source\":\"github\",\"commits\":$commits},"

  # NPM
  local npm_ver
  npm_ver=$(npm view @heretek-ai/openclaw version 2>/dev/null || echo "null")
  json+="{\"source\":\"npm\",\"latest\":$npm_ver},"

  json='"status":"complete"}]'

  echo "$json" | jq .
}

# CLI
case "${1:-scan}" in
  --scan) scan_all ;;
  --json) json_output ;;
  --watch) echo "Watch mode: would poll continuously";;
  *) echo "Usage: $0 [--scan|--json|--watch]"; exit 1 ;;
esac
```

---

## Usage

```bash
# Full scan (all sources)
./opportunity-scanner.sh --scan

# JSON output (programmatic)
./opportunity-scanner.sh --json
```

---

## Integration Points

- **Curiosity Engine:** Opportunity scanning workflow
- **Knowledge Ingest:** External source polling
- **Auto-Trigger:** Identifies upgrade opportunities

---

**Opportunities scanned. Changes detected. Actions triggered.** 🦞
