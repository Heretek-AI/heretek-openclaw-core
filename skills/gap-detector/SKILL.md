---
name: gap-detector
description: Standalone gap detection engine that compares installed skills against capability requirements. Use when the collective needs to identify missing skills, generate gap reports, or trigger auto-install proposals.
---

# Gap Detector — Capability Gap Identification

**Purpose:** Detect gaps between installed skills and capability requirements.

**Status:** ✅ Implemented (2026-03-24)

---

## Implementation

### Main Script: `gap-detector.sh`

```bash
#!/bin/bash
# Gap Detector — Capability Gap Identification
# Usage: ./gap-detector.sh [--scan|--json|--report]

set -e

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/home/openclaw/.openclaw/workspace}"

# Define capability goals and required skills
declare -A GOAL_MAP=(
  ["self-improvement"]="skill-creator audit-triad-files auto-patch"
  ["knowledge-growth"]="knowledge-ingest knowledge-retrieval auto-tag"
  ["triad-unity"]="triad-heartbeat triad-unity-monitor triad-sync-protocol"
  ["resilience"]="triad-resilience detect-corruption backup-ledger"
  ["autonomy"]="curiosity-engine gap-detector opportunity-scanner"
)

# Get installed skills
function get_installed() {
  ls -1 "$WORKSPACE_ROOT/skills" 2>/dev/null | \
    while read -r skill; do
      [[ -f "$WORKSPACE_ROOT/skills/$skill/SKILL.md" ]] && echo "$skill"
    done
}

# Detect gaps for a goal
function detect_goal_gaps() {
  local goal="$1"
  local required="${GOAL_MAP[$goal]}"

  local installed=0
  local gaps=""

  for skill in $required; do
    if [[ -d "$WORKSPACE_ROOT/skills/$skill" ]] && [[ -f "$WORKSPACE_ROOT/skills/$skill/SKILL.md" ]]; then
      installed=$((installed + 1))
    else
      gaps="$gaps$skill,"
    fi
  done

  echo "$goal: $installed/${#required[@]} ${gaps:+($gaps)}"
}

# Full scan
function scan_gaps() {
  echo "=== Gap Detector Scan ==="
  echo ""

  for goal in "${!GOAL_MAP[@]}"; do
    detect_goal_gaps "$goal"
  done
}

# JSON output
function json_output() {
  local json='{"goals":{'

  for goal in "${!GOAL_MAP[@]}"; do
    local required="${GOAL_MAP[$goal]}"
    local installed=0
    local gaps=""

    for skill in $required; do
      if [[ -d "$WORKSPACE_ROOT/skills/$skill" ]] && [[ -f "$WORKSPACE_ROOT/skills/$skill/SKILL.md" ]]; then
        installed=$((installed + 1))
      else
        gaps="$gaps\"$skill\","
      fi
    done

    # Remove trailing comma
    gaps="${gaps%,}"

    json+="\"$goal\":{\"required\":${#required[@]},\"installed\":$installed,\"gaps\":[$gaps]},"
  done

  json='"status":"complete"}}'

  echo "$json" | jq .
}

# Report gaps
function report_gaps() {
  local report="$WORKSPACE_ROOT/.curiosity/gap-report-$(date +%Y%m%d).md"

  cat > "$report" <<EOF
# Gap Report — $(date -Iseconds)

EOF

  for goal in "${!GOAL_MAP[@]}"; do
    detect_goal_gaps "$goal" >> "$report"
    echo "" >> "$report"
  done

  echo "📝 Report written: $report"
}

# CLI
case "${1:-scan}" in
  --scan) scan_gaps ;;
  --json) json_output ;;
  --report) report_gaps ;;
  *) echo "Usage: $0 [--scan|--json|--report]"; exit 1 ;;
esac
```

---

## Usage

```bash
# Scan gaps (human-readable)
./gap-detector.sh --scan

# JSON output (programmatic)
./gap-detector.sh --json

# Generate report
./gap-detector.sh --report
```

---

## Integration Points

- **Curiosity Engine:** Gap detection workflow
- **Auto-Trigger:** Identifies installable gaps
- **Capability Mapping:** Goal-skill alignment

---

**Gaps detected. Actions triggered. Capability grown.** 🦞
