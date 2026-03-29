#!/bin/bash
# Curiosity Engine - Main Orchestration Script (v2.0 Modular)
# Runs all 5 engines using Node.js modules (Phase 1: Script-to-Skill)
# Falls back to legacy shell scripts if modules unavailable

set -e

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULES_DIR="$SCRIPT_DIR/modules"
ENGINES_DIR="$SCRIPT_DIR/engines"
METRICS_DB="$WORKSPACE/.curiosity/curiosity_metrics.db"
CURIOSITY_DIR="$WORKSPACE/.curiosity"
EPISODIC_DIR="$WORKSPACE/memory"

# Ensure directories exist
mkdir -p "$CURIOSITY_DIR" "$EPISODIC_DIR"

# Check if Node.js modules are available
use_modules() {
  command -v node &> /dev/null && [ -d "$MODULES_DIR" ]
}

# Initialize metrics database
init_db() {
    sqlite3 "$METRICS_DB" <<EOF
CREATE TABLE IF NOT EXISTS curiosity_metrics (
    timestamp TEXT PRIMARY KEY,
    skills_installed INTEGER DEFAULT 0,
    skills_available INTEGER DEFAULT 0,
    gap_count INTEGER DEFAULT 0,
    opportunities_scanned INTEGER DEFAULT 0,
    anomalies_detected INTEGER DEFAULT 0,
    proposals_created INTEGER DEFAULT 0,
    autonomy_score REAL DEFAULT 0
);
EOF
}

# Count installed skills
count_installed_skills() {
    find "$WORKSPACE/skills" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l
}

# Estimate available skills (from ClawHub or cached)
count_available_skills() {
    if [ -f "$CURIOSITY_DIR/available_skills.txt" ]; then
        wc -l < "$CURIOSITY_DIR/available_skills.txt"
    elif command -v clawhub &> /dev/null; then
        clawhub search 2>/dev/null | tail -n +2 | wc -l
    else
        echo 0
    fi
}

# Calculate autonomy score
calculate_autonomy_score() {
    local installed=$1
    local available=$2
    local proposals=$3
    local anomalies=$4
    
    local base_score=0
    if [ "$available" -gt 0 ]; then
        base_score=$(awk "BEGIN {printf \"%.2f\", $installed * 100 / $available}")
    fi
    
    local proposal_bonus=$((proposals * 10))
    local anomaly_penalty=$((anomalies * 5))
    
    local final_score=$(awk "BEGIN {
        score = $base_score + $proposal_bonus - $anomaly_penalty
        if (score < 0) score = 0
        if (score > 100) score = 100
        printf \"%.2f\", score
    }")
    
    echo "$final_score"
}

# Run all engines using Node.js modules
run_engines_modules() {
    echo "🦞 === Curiosity Engine Starting (Modular v2.0) ==="
    echo "Timestamp: $(date -Iseconds)"
    echo "Workspace: $WORKSPACE"
    echo "Mode: Node.js modules"
    echo ""
    
    # Engine 1: Gap Detection
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 1: Gap Detection"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    local gap_json=$(node "$MODULES_DIR/gap-detector.js" --json 2>/dev/null || echo '{}')
    local gap_count=$(echo "$gap_json" | jq -r '.critical | length' 2>/dev/null || echo 0)
    echo "$gap_count" > "$CURIOSITY_DIR/.gap_count"
    node "$MODULES_DIR/gap-detector.js" 2>/dev/null || true
    echo ""
    
    # Engine 2: Anomaly Detection
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 2: Anomaly Detection"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    local anomaly_json=$(node "$MODULES_DIR/anomaly-detector.js" --json 2>/dev/null || echo '{}')
    local anomaly_count=$(echo "$anomaly_json" | jq -r '.anomalies | length' 2>/dev/null || echo 0)
    echo "$anomaly_count" > "$CURIOSITY_DIR/.anomaly_count"
    node "$MODULES_DIR/anomaly-detector.js" 2>/dev/null || true
    echo ""
    
    # Engine 3: Opportunity Scanning
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 3: Opportunity Scanning"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    local opp_json=$(node "$MODULES_DIR/opportunity-scanner.js" --json 2>/dev/null || echo '{}')
    local opp_count=$(echo "$opp_json" | jq -r '.opportunities | length' 2>/dev/null || echo 0)
    echo "$opp_count" > "$CURIOSITY_DIR/.opportunity_count"
    node "$MODULES_DIR/opportunity-scanner.js" 2>/dev/null || true
    echo ""
    
    # Engine 4: Capability Mapping
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 4: Capability Mapping"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    node "$MODULES_DIR/capability-mapper.js" 2>/dev/null || true
    echo ""
    
    # Engine 5: Deliberation Auto-Trigger
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 5: Deliberation Auto-Trigger"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    node "$MODULES_DIR/deliberation-trigger.js" 2>/dev/null || true
    local proposal_count=$(sqlite3 "$CURIOSITY_DIR/consensus_ledger.db" "SELECT COUNT(*) FROM consensus_votes WHERE status = 'pending';" 2>/dev/null || echo 0)
    echo "$proposal_count" > "$CURIOSITY_DIR/.proposal_count"
    echo ""
    
    # Update metrics
    update_metrics
}

# Run all engines using legacy shell scripts
run_engines_legacy() {
    echo "🦞 === Curiosity Engine Starting (Legacy Shell) ==="
    echo "Timestamp: $(date -Iseconds)"
    echo "Workspace: $WORKSPACE"
    echo "Mode: Legacy shell scripts (fallback)"
    echo ""
    
    # Engine 1: Gap Detection
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 1: Gap Detection"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -x "$ENGINES_DIR/gap-detection.sh" ]; then
        "$ENGINES_DIR/gap-detection.sh"
        local gap_count=$("$ENGINES_DIR/gap-detection.sh" --json 2>/dev/null | jq '.critical_gaps | length' 2>/dev/null || echo 0)
        echo "$gap_count" > "$CURIOSITY_DIR/.gap_count"
    else
        echo "❌ Gap detection script not found"
        echo "0" > "$CURIOSITY_DIR/.gap_count"
    fi
    echo ""
    
    # Engine 2: Anomaly Detection
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 2: Anomaly Detection"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -x "$ENGINES_DIR/anomaly-detection.sh" ]; then
        "$ENGINES_DIR/anomaly-detection.sh"
        local anomaly_count=$(sqlite3 "$CURIOSITY_DIR/anomalies.db" "SELECT COUNT(*) FROM anomalies WHERE processed = 0;" 2>/dev/null || echo 0)
        echo "$anomaly_count" > "$CURIOSITY_DIR/.anomaly_count"
    else
        echo "❌ Anomaly detection script not found"
        echo "0" > "$CURIOSITY_DIR/.anomaly_count"
    fi
    echo ""
    
    # Engine 3: Opportunity Scanning
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 3: Opportunity Scanning"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -x "$ENGINES_DIR/opportunity-scanning.sh" ]; then
        "$ENGINES_DIR/opportunity-scanning.sh"
        local opp_count=$(sqlite3 "$CURIOSITY_DIR/opportunities.db" "SELECT COUNT(*) FROM opportunities WHERE processed = 0;" 2>/dev/null || echo 0)
        echo "$opp_count" > "$CURIOSITY_DIR/.opportunity_count"
    else
        echo "❌ Opportunity scanning script not found"
        echo "0" > "$CURIOSITY_DIR/.opportunity_count"
    fi
    echo ""
    
    # Engine 4: Capability Mapping
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 4: Capability Mapping"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -x "$ENGINES_DIR/capability-mapping.sh" ]; then
        "$ENGINES_DIR/capability-mapping.sh"
    else
        echo "❌ Capability mapping script not found"
    fi
    echo ""
    
    # Engine 5: Deliberation Auto-Trigger
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Engine 5: Deliberation Auto-Trigger"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -x "$ENGINES_DIR/deliberation-auto-trigger.sh" ]; then
        "$ENGINES_DIR/deliberation-auto-trigger.sh"
        local proposal_count=$(sqlite3 "$CURIOSITY_DIR/consensus_ledger.db" "SELECT COUNT(*) FROM consensus_votes WHERE status = 'pending';" 2>/dev/null || echo 0)
        echo "$proposal_count" > "$CURIOSITY_DIR/.proposal_count"
    else
        echo "❌ Deliberation auto-trigger script not found"
        echo "0" > "$CURIOSITY_DIR/.proposal_count"
    fi
    echo ""
    
    # Update metrics
    update_metrics
}

# Update curiosity metrics
update_metrics() {
    local timestamp=$(date -Iseconds)
    local installed=$(count_installed_skills)
    local available=$(count_available_skills)
    local gaps=$(cat "$CURIOSITY_DIR/.gap_count" 2>/dev/null || echo 0)
    local opportunities=$(cat "$CURIOSITY_DIR/.opportunity_count" 2>/dev/null || echo 0)
    local anomalies=$(cat "$CURIOSITY_DIR/.anomaly_count" 2>/dev/null || echo 0)
    local proposals=$(cat "$CURIOSITY_DIR/.proposal_count" 2>/dev/null || echo 0)
    
    local autonomy_score=$(calculate_autonomy_score "$installed" "$available" "$proposals" "$anomalies")
    
    # Record metrics
    sqlite3 "$METRICS_DB" "INSERT OR REPLACE INTO curiosity_metrics (timestamp, skills_installed, skills_available, gap_count, opportunities_scanned, anomalies_detected, proposals_created, autonomy_score) VALUES ('$timestamp', $installed, $available, $gaps, $opportunities, $anomalies, $proposals, $autonomy_score);"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Curiosity Metrics Updated"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Skills Installed:    $installed"
    echo "  Skills Available:    $available"
    echo "  Gap Count:           $gaps"
    echo "  Opportunities:       $opportunities"
    echo "  Anomalies:           $anomalies"
    echo "  Proposals Created:   $proposals"
    echo "  Autonomy Score:      ${autonomy_score}%"
    echo ""
    
    # Log to episodic memory
    cat >> "$EPISODIC_DIR/curiosity-$(date +%Y-%m-%d).md" <<EOF

## Curiosity Metrics - $timestamp

| Metric | Value |
|--------|-------|
| Skills Installed | $installed |
| Skills Available | $available |
| Gap Count | $gaps |
| Opportunities Scanned | $opportunities |
| Anomalies Detected | $anomalies |
| Proposals Created | $proposals |
| Autonomy Score | ${autonomy_score}% |

---

EOF
    
    echo "🦞 === Curiosity Engine Complete ==="
}

# Show metrics history
show_history() {
    echo "=== Curiosity Metrics History ==="
    sqlite3 -header -column "$METRICS_DB" "SELECT timestamp, skills_installed, gap_count, proposals_created, autonomy_score FROM curiosity_metrics ORDER BY timestamp DESC LIMIT 10;"
}

# Initialize database
init_db

# Main execution
case "${1:-run}" in
    run)
        if use_modules; then
            run_engines_modules
        else
            run_engines_legacy
        fi
        ;;
    history)
        show_history
        ;;
    metrics)
        update_metrics
        ;;
    --json)
        if use_modules; then
            node "$MODULES_DIR/gap-detector.js" --json 2>/dev/null
            node "$MODULES_DIR/anomaly-detector.js" --json 2>/dev/null
            node "$MODULES_DIR/opportunity-scanner.js" --json 2>/dev/null
            node "$MODULES_DIR/capability-mapper.js" --json 2>/dev/null
        else
            echo '{"error": "Modules not available, use shell scripts"}'
        fi
        ;;
    modules)
        run_engines_modules
        ;;
    legacy)
        run_engines_legacy
        ;;
    *)
        echo "Usage: $0 {run|history|metrics|--json|modules|legacy}"
        exit 1
        ;;
esac
