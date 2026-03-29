#!/bin/bash
# Curiosity Auto-Trigger — Gap → Proposal Auto-Generation
# Enhanced per PROPOSAL-curiosity-auto-trigger
# Implementation conditions:
#   1. Flood prevention: max 1 proposal/run, max 3/week
#   2. Anti-self-reference: excludes own output from gap detection
#   3. Kill-switch: reads kill-switch file before executing
#   4. Proposal auto-generation for gaps that meet the proposal bar
# Usage: ./curiosity-auto-trigger.sh [--dry-run] [--verbose]

set -e

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/home/openclaw/.openclaw/workspace}"
DB_PATH="$WORKSPACE_ROOT/.curiosity/curiosity_metrics.db"
CURIOSITY_DIR="$WORKSPACE_ROOT/.curiosity"
STATE_DIR="$WORKSPACE_ROOT/triad/state"
DRAFTS_DIR="$WORKSPACE_ROOT/triad/deliberations/drafts"
KILL_SWITCH="$CURIOSITY_DIR/kill-switch"
COUNTER_FILE="$CURIOSITY_DIR/proposal-counter.json"
METRICS_FILE="$CURIOSITY_DIR/curiosity-metrics.json"
REJECTION_FILE="$CURIOSITY_DIR/auto-rejections.json"

# Ensure directories exist
mkdir -p "$CURIOSITY_DIR" "$DRAFTS_DIR"

# === KILL-SWITCH ===
function check_kill_switch() {
  if [[ -f "$KILL_SWITCH" ]]; then
    local content
    content=$(cat "$KILL_SWITCH" 2>/dev/null || echo "")
    if [[ "$content" == "ON" ]] || [[ "$content" == "on" ]]; then
      echo "⛔ Kill-switch is ON. Curiosity auto-trigger disabled."
      echo "To re-enable: echo 'OFF' > $KILL_SWITCH"
      exit 0
    fi
  fi
}

# === FLOOD PREVENTION ===
function check_flood_limits() {
  # Initialize counter if missing
  if [[ ! -f "$COUNTER_FILE" ]]; then
    cat > "$COUNTER_FILE" <<'EOF'
{
  "run_count": 0,
  "weekly_count": 0,
  "week_start": null,
  "last_run": null
}
EOF
  fi

  local counter
  counter=$(cat "$COUNTER_FILE")
  local week_start
  week_start=$(echo "$counter" | jq -r '.week_start')
  local current_week
  current_week=$(date -u +%Y-W%V)

  # Reset weekly counter if new week
  if [[ "$week_start" != "$current_week" ]]; then
    counter=$(echo "$counter" | jq '.weekly_count = 0 | .week_start = "'$current_week'"')
    echo "$counter" > "$COUNTER_FILE"
  fi

  local run_count
  run_count=$(echo "$counter" | jq -r '.run_count')
  local weekly_count
  weekly_count=$(echo "$counter" | jq -r '.weekly_count')

  # Flood check: 1 per run, 3 per week
  if [[ "$run_count" -ge 1 ]]; then
    echo "⛔ Flood limit reached: already generated $run_count proposal(s) this run."
    return 1
  fi
  if [[ "$weekly_count" -ge 3 ]]; then
    echo "⛔ Weekly flood limit reached: $weekly_count/3 proposals this week."
    return 1
  fi

  return 0
}

function increment_counter() {
  local counter
  counter=$(cat "$COUNTER_FILE")
  counter=$(echo "$counter" | jq '.run_count += 1 | .weekly_count += 1 | .last_run = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"')
  echo "$counter" > "$COUNTER_FILE"
}

# === REJECTION TRACKING (5-rejection recalibration) ===
function check_rejection_rate() {
  if [[ ! -f "$REJECTION_FILE" ]]; then
    return 0  # No rejections, proceed
  fi

  local rejections
  rejections=$(cat "$REJECTION_FILE")
  local count
  count=$(echo "$rejections" | jq -r '.count // 0')

  if [[ "$count" -ge 5 ]]; then
    echo "⚠️  5+ consecutive rejections detected. Recalibrating thresholds..."
    # Increase threshold for next run: require higher confidence
    local threshold
    threshold=$(echo "$rejections" | jq -r '.last_threshold // 0.7')
    threshold=$(echo "$threshold + 0.1" | bc -l | head -c 3)
    echo "$rejections" | jq '.last_threshold = '"$threshold"' | .count = 0' > "$REJECTION_FILE"
    echo "   New confidence threshold: $threshold"
    return 1  # Temporarily disable
  fi
  return 0
}

function record_rejection() {
  if [[ ! -f "$REJECTION_FILE" ]]; then
    echo '{"count": 1, "last_threshold": 0.7}' > "$REJECTION_FILE"
  else
    local rejections
    rejections=$(cat "$REJECTION_FILE")
    rejections=$(echo "$rejections" | jq '.count += 1')
    echo "$rejections" > "$REJECTION_FILE"
  fi
}

# === CAPABILITY GAP DETECTION ===
function get_gaps() {
  # Read gap-report.json if it exists
  local gap_report="$STATE_DIR/gap-report.json"
  if [[ -f "$gap_report" ]]; then
    jq -r '.gaps[]?.skill // empty' "$gap_report" 2>/dev/null || echo ""
    return
  fi

  # Fallback: use curiosity engine JSON output
  node "$WORKSPACE_ROOT/scripts/curiosity-engine.js" --json 2>/dev/null | \
    jq -r '.capability_report[].gap_list[]' 2>/dev/null || echo ""
}

# === ANTI-SELF-REFERENCE ===
# Filter out gaps that are about this skill itself
function filter_anti_self_reference() {
  local gaps="$1"
  local filtered=""
  local self_pattern="curiosity-auto-trigger\|curiosity-engine\|gap-detector\|opportunity-scanner"

  for gap in $gaps; do
    if echo "$gap" | grep -qE "$self_pattern"; then
      echo "   🔄 Excluding (self-reference): $gap"
      continue
    fi
    filtered="$filtered $gap"
  done
  echo "$filtered" | xargs
}

# === RELEVANCE RANKING ===
function rank_gap() {
  local skill="$1"
  local priority="medium"
  local confidence=0.5

  case "$skill" in
    triad-*|*-triad-*) priority="critical"; confidence=0.9 ;;
    detect-*|backup-*|gap-*|opportunity-*) priority="high"; confidence=0.7 ;;
    audit-*|auto-*) priority="medium"; confidence=0.5 ;;
    *) priority="low"; confidence=0.3 ;;
  esac

  echo "$priority $confidence"
}

# === PROPOSAL BAR CHECK ===
# Returns 0 if gap meets proposal bar, 1 otherwise
function meets_proposal_bar() {
  local skill="$1"
  local confidence="$2"

  # Proposal bar: actionable within 2 weeks, less than 1 hour deliberation
  # Use confidence threshold
  local threshold
  threshold=$(cat "$REJECTION_FILE" 2>/dev/null | jq -r '.last_threshold // 0.7')

  local meets
  meets=$(echo "$confidence >= $threshold" | bc -l)

  if [[ "$meets" == "1" ]]; then
    return 0
  else
    return 1
  fi
}

# === PROPOSAL DRAFT GENERATION ===
function generate_proposal_draft() {
  local skill="$1"
  local priority="$2"
  local confidence="$3"

  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local proposal_id
  proposal_id="AUTO-$(date +%Y%m%d)-$(echo $skill | tr '-' '_')"

  # Read gap details from gap-report
  local gap_detail=""
  local gap_report="$STATE_DIR/gap-report.json"
  if [[ -f "$gap_report" ]]; then
    gap_detail=$(jq -r ".gaps[] | select(.skill == \"$skill\") | .description // empty" "$gap_report" 2>/dev/null || echo "")
  fi

  local draft_file="$DRAFTS_DIR/curiosity-$proposal_id.md"
  cat > "$draft_file" <<EOF
# [AUTO-GENERATED] Proposal: Auto-Install $skill

**Generated by:** curiosity-auto-trigger  
**Timestamp:** $timestamp  
**Confidence:** $confidence  
**Priority:** $priority  
**Tags:** autonomy, auto-generated

---

## Summary

Auto-generated proposal: install skill **$skill** to address capability gap detected by curiosity engine.

## Background

Gap detected: **$skill**  
Priority: $priority  
Confidence: $confidence  

$gap_detail

## The Proposal

Install **$skill** via ClawHub to address the identified capability gap.

## Implementation

\`\`\`bash
clawhub install $skill
\`\`\`

## Success Criteria

- Skill installed and functional
- Skill file exists at \`skills/$skill/SKILL.md\`
- Tests pass (if applicable)

## Risks

- Installation may introduce unexpected behavior (mitigation: test in staging first)
- Skill may conflict with existing capabilities (mitigation: review before production)

## Rollback

\`\`\`bash
clawhub uninstall $skill
\`\`\`

---

*Auto-generated by curiosity-auto-trigger. This proposal was auto-generated because the detected gap met the proposal bar (confidence >= $threshold). The triad still deliberates and votes on this proposal.*
EOF

  echo "$draft_file"
}

# === MAIN AUTO-TRIGGER LOOP ===
function run() {
  echo "🦞 === Curiosity Auto-Trigger ==="
  echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""

  # 1. Kill-switch check
  check_kill_switch

  # 2. Rejection rate check (recalibration)
  if ! check_rejection_rate; then
    echo "⛔ Recalibration active. Skipping this cycle."
    return 0
  fi

  # 3. Flood limit check
  if ! check_flood_limits; then
    return 0
  fi

  # 4. Get and filter gaps
  local gaps
  gaps=$(get_gaps)

  if [[ -z "$gaps" ]]; then
    echo "✅ No gaps detected. Autonomy optimal."
    return 0
  fi

  echo "Gaps found: $gaps"

  # 5. Anti-self-reference filter
  local filtered_gaps
  filtered_gaps=$(filter_anti_self_reference "$gaps")

  if [[ -z "$filtered_gaps" ]]; then
    echo "✅ All gaps filtered (self-reference). Autonomy optimal."
    return 0
  fi

  echo "Filtered gaps: $filtered_gaps"
  echo ""

  # 6. Process gaps — generate proposal for first one that meets bar
  local generated=0
  for gap in $filtered_gaps; do
    local ranked
    ranked=$(rank_gap "$gap")
    local priority
    local confidence
    priority=$(echo "$ranked" | cut -d' ' -f1)
    confidence=$(echo "$ranked" | cut -d' ' -f2)

    echo "Gap: $gap (priority: $priority, confidence: $confidence)"

    # Check proposal bar
    if ! meets_proposal_bar "$gap" "$confidence"; then
      echo "   ⬇️  Below proposal bar (confidence $confidence < threshold). Skipping."
      continue
    fi

    # Generate proposal draft
    echo "   📝 Generating proposal draft..."
    local draft_file
    draft_file=$(generate_proposal_draft "$gap" "$priority" "$confidence")

    if [[ -f "$draft_file" ]]; then
      echo "   ✅ Proposal draft created: $draft_file"
      increment_counter
      generated=1
      echo ""
      echo "=== Results ==="
      echo "Proposal generated: $(basename "$draft_file")"
      echo "Flood counters updated: run=1, weekly incremented"
      generated=1
      break  # Only 1 proposal per run (flood prevention)
    else
      echo "   ❌ Failed to create proposal draft"
    fi
  done

  if [[ "$generated" == "0" ]]; then
    echo "No gaps met proposal bar. Cycle complete."
  fi

  echo ""
  echo "🦞 Auto-trigger complete."
}

# === CLI ===
function enable_trigger() {
  echo "OFF" > "$KILL_SWITCH"
  echo "✅ Curiosity auto-trigger enabled."
}

function disable_trigger() {
  echo "ON" > "$KILL_SWITCH"
  echo "⛔ Curiosity auto-trigger disabled (kill-switch ON)."
}

function status() {
  if [[ -f "$KILL_SWITCH" ]]; then
    echo "Kill-switch: $(cat "$KILL_SWITCH")"
  else
    echo "Kill-switch: OFF (enabled)"
  fi
  if [[ -f "$COUNTER_FILE" ]]; then
    echo "Counter: $(cat "$COUNTER_FILE")"
  fi
}

case "${1:-run}" in
  run) run ;;
  --dry-run) echo "Dry-run mode: would analyze gaps without generating proposals" ;;
  --verbose) set -x; run ;;
  enable) enable_trigger ;;
  disable) disable_trigger ;;
  status) status ;;
  reset-counter) echo '{"run_count": 0, "weekly_count": 0, "week_start": "'$(date -u +%Y-W%V)'", "last_run": null}' > "$COUNTER_FILE" && echo "Counter reset" ;;
  *) echo "Usage: $0 [run|dry-run|enable|disable|status|reset-counter]"; exit 1 ;;
esac
