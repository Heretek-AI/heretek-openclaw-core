#!/bin/bash
# Deliberation Auto-Trigger Engine - Creates proposals from detected gaps/anomalies/opportunities
# Wires to consensus ledger and posts to Discord (quorum speaker only)

set -e

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
CONSENSUS_DB="$WORKSPACE/.curiosity/consensus_ledger.db"
EPISODIC_DIR="$WORKSPACE/memory"
DISCORD_CHANNEL="${DISCORD_CHANNEL:-discord}"

# Ensure directories exist
mkdir -p "$(dirname "$CONSENSUS_DB")" "$EPISODIC_DIR"

# Initialize consensus ledger database
init_db() {
    sqlite3 "$CONSENSUS_DB" <<EOF
CREATE TABLE IF NOT EXISTS consensus_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    proposal_title TEXT NOT NULL,
    proposal_body TEXT,
    priority TEXT DEFAULT 'medium',
    source TEXT DEFAULT 'auto',
    status TEXT DEFAULT 'pending',
    signers TEXT DEFAULT '[]',
    result TEXT DEFAULT 'pending',
    processed INTEGER DEFAULT 0
);
EOF
}

# Check if this node is the quorum speaker (TM-1 authority node)
is_quorum_speaker() {
    if [ -f "$WORKSPACE/IDENTITY.md" ]; then
        grep -q "Role: Authority" "$WORKSPACE/IDENTITY.md" 2>/dev/null
        return $?
    fi
    return 1
}

# Post to Discord (only if quorum speaker)
post_to_discord() {
    local message="$1"
    
    if is_quorum_speaker; then
        echo "📢 Posting to Discord (quorum speaker)..."
        # Use message tool to send to Discord
        if command -v openclaw &> /dev/null; then
            openclaw message send --channel discord --message "$message" 2>/dev/null || true
        else
            echo "   openclaw CLI not available, logging only"
        fi
    else
        echo "ℹ️  Not quorum speaker, logging to episodic memory only"
    fi
}

# Check if proposal already exists (prevent duplicates)
proposal_exists() {
    local title="$1"
    local source="$2"
    title=$(echo "$title" | sed "s/'/''/g")
    local count=$(sqlite3 "$CONSENSUS_DB" "SELECT COUNT(*) FROM consensus_votes WHERE proposal_title = '$title' AND source = '$source' AND status != 'closed';" 2>/dev/null || echo 0)
    [ "$count" -gt 0 ]
}

# Create deliberation proposal
create_proposal() {
    local title="$1"
    local body="$2"
    local priority="${3:-medium}"
    local source="${4:-auto}"
    local timestamp=$(date -Iseconds)
    
    # Check for duplicates
    if proposal_exists "$title" "$source"; then
        echo "ℹ️  Proposal already exists: $title (skipping duplicate)"
        return 0
    fi
    
    # Escape quotes for SQL
    body=$(echo "$body" | sed "s/'/''/g")
    title=$(echo "$title" | sed "s/'/''/g")
    
    # Insert into consensus ledger
    sqlite3 "$CONSENSUS_DB" "INSERT INTO consensus_votes (proposal_title, proposal_body, priority, source) VALUES ('$title', '$body', '$priority', '$source');"
    
    echo "✅ Proposal created: $title"
    echo "   Priority: $priority"
    echo "   Source: $source"
    echo "   Status: pending"
    
    # Log to episodic memory
    cat >> "$EPISODIC_DIR/curiosity-$(date +%Y-%m-%d).md" <<EOF

## Deliberation Proposal - $timestamp

**Title:** $title

**Body:** $body

**Priority:** $priority
**Source:** $source
**Status:** Pending quorum vote

---

EOF
    
    # Post to Discord if high/critical priority
    if [ "$priority" = "high" ] || [ "$priority" = "critical" ]; then
        local discord_msg="**🦞 Proposal:** $title

**Priority:** $priority
**Source:** $source

$body

*Awaiting quorum vote (2-of-3)*"
        post_to_discord "$discord_msg"
    fi
}

# Process gaps from gap detection
process_gaps() {
    echo "Processing gap detection results..."
    
    local gap_script="$WORKSPACE/skills/curiosity-engine/engines/gap-detection.sh"
    if [ -x "$gap_script" ]; then
        local gaps=$("$gap_script" --json 2>/dev/null | jq -r '.critical_gaps[]' 2>/dev/null || true)
        
        for gap in $gaps; do
            if [ -n "$gap" ]; then
                create_proposal \
                    "Install $gap to close capability gap" \
                    "Gap detected: $gap not installed. This skill would enable self-improvement loop. Recommendation: Run 'clawhub install $gap'." \
                    "high" \
                    "gap-detection"
            fi
        done
    else
        echo "   Gap detection script not found or not executable"
    fi
}

# Process anomalies from anomaly detection
process_anomalies() {
    echo ""
    echo "Processing anomaly detection results..."
    
    local anomaly_db="$WORKSPACE/.curiosity/anomalies.db"
    if [ -f "$anomaly_db" ]; then
        local anomalies=$(sqlite3 "$anomaly_db" "SELECT source, error_type, severity FROM anomalies WHERE processed = 0 AND severity IN ('high', 'critical') LIMIT 5;" 2>/dev/null || true)
        
        echo "$anomalies" | while IFS='|' read -r source error_type severity; do
            if [ -n "$source" ]; then
                create_proposal \
                    "Repair $source $error_type anomaly" \
                    "Anomaly detected: $error_type errors in $source. Severity: $severity. Requires investigation and remediation." \
                    "$severity" \
                    "anomaly-detection"
            fi
        done
    else
        echo "   Anomaly database not found"
    fi
}

# Process opportunities from opportunity scanning
process_opportunities() {
    echo ""
    echo "Processing opportunity scanning results..."
    
    local opps_db="$WORKSPACE/.curiosity/opportunities.db"
    if [ -f "$opps_db" ]; then
        local opportunities=$(sqlite3 "$opps_db" "SELECT title, type, priority FROM opportunities WHERE processed = 0 AND priority IN ('high', 'critical') LIMIT 5;" 2>/dev/null || true)
        
        echo "$opportunities" | while IFS='|' read -r title type priority; do
            if [ -n "$title" ]; then
                if [ "$type" = "release" ]; then
                    create_proposal \
                        "Rebase on $title" \
                        "New release detected: $title. Recommend rebasing heretek/main to incorporate changes while preserving liberation." \
                        "$priority" \
                        "opportunity-scanning"
                elif [ "$type" = "security" ]; then
                    create_proposal \
                        "Address $title" \
                        "Security advisory: $title. Requires immediate triage and remediation." \
                        "critical" \
                        "opportunity-scanning"
                fi
            fi
        done
    else
        echo "   Opportunities database not found"
    fi
}

# Process capability gaps
process_capability_gaps() {
    echo ""
    echo "Processing capability mapping results..."
    
    local caps_db="$WORKSPACE/.curiosity/capabilities.db"
    if [ -f "$caps_db" ]; then
        local gaps=$(sqlite3 "$caps_db" "SELECT goal, gaps FROM capability_maps WHERE autonomy_score < 50 LIMIT 3;" 2>/dev/null || true)
        
        echo "$gaps" | while IFS='|' read -r goal gaps; do
            if [ -n "$goal" ] && [ -n "$gaps" ]; then
                create_proposal \
                    "Close capability gaps for $goal" \
                    "Capability mapping identified gaps for goal '$goal': $gaps. Install missing skills to achieve autonomy." \
                    "medium" \
                    "capability-mapping"
            fi
        done
    else
        echo "   Capabilities database not found"
    fi
}

# Run all processors and trigger deliberation
run_auto_trigger() {
    echo "=== Deliberation Auto-Trigger ==="
    echo "Timestamp: $(date -Iseconds)"
    echo "Quorum Speaker: $(is_quorum_speaker && echo "Yes" || echo "No")"
    echo ""
    
    process_gaps
    process_anomalies
    process_opportunities
    process_capability_gaps
    
    echo ""
    echo "=== End Auto-Trigger ==="
    
    # Summary of pending proposals
    local pending=$(sqlite3 "$CONSENSUS_DB" "SELECT COUNT(*) FROM consensus_votes WHERE status = 'pending';" 2>/dev/null || echo 0)
    echo ""
    echo "Summary: $pending pending proposals in consensus ledger"
}

# Initialize database
init_db

# Main execution
run_auto_trigger

# Output JSON for programmatic use
if [ "$1" = "--json" ]; then
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"quorum_speaker\": $(is_quorum_speaker && echo "true" || echo "false"),"
    echo "  \"pending_proposals\": ["
    sqlite3 -json "$CONSENSUS_DB" "SELECT * FROM consensus_votes WHERE status = 'pending' ORDER BY timestamp DESC LIMIT 10;" 2>/dev/null || echo "[]"
    echo "  ]"
    echo "}"
fi
