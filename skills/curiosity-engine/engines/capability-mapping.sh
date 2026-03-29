#!/bin/bash
# Capability Mapping Engine - Maps goals to required skills and identifies gaps
# Outputs capability analysis for strategic planning

set -e

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
SKILLS_DIR="$WORKSPACE/skills"
CAPS_DB="$WORKSPACE/.curiosity/capabilities.db"
EPISODIC_DIR="$WORKSPACE/memory"

# Ensure directories exist
mkdir -p "$(dirname "$CAPS_DB")" "$EPISODIC_DIR"

# Initialize capabilities database
init_db() {
    sqlite3 "$CAPS_DB" <<EOF
CREATE TABLE IF NOT EXISTS capability_maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    goal TEXT NOT NULL,
    required_skills TEXT,
    installed_skills TEXT,
    gaps TEXT,
    autonomy_score REAL DEFAULT 0
);
EOF
}

# Define goal → skill mappings
declare -A GOAL_MAP
GOAL_MAP["self-improvement"]="skill-creator audit-triad-files auto-patch edit write exec"
GOAL_MAP["knowledge-growth"]="knowledge-ingest knowledge-retrieval auto-tag relevance-rank web_search web_fetch"
GOAL_MAP["autonomy"]="triad-heartbeat consensus-ledger gap-detector triad-deliberation-protocol"
GOAL_MAP["triad-sync"]="triad-sync-protocol triad-unity-monitor triad-signal-filter message exec"
GOAL_MAP["security"]="healthcheck security-triage openclaw-ghsa-maintainer exec"
GOAL_MAP["deployment"]="openclaw-release-maintainer openclaw-pr-maintainer clawhub npm"

# Get installed skills
get_installed_skills() {
    find "$SKILLS_DIR" -maxdepth 2 -name "SKILL.md" 2>/dev/null | while read -r skill_file; do
        dirname "$skill_file" | xargs basename
    done | sort -u
}

# Check if skill is installed
is_installed() {
    local skill="$1"
    get_installed_skills | grep -q "^${skill}$"
}

# Map capability for a goal
map_capability() {
    local goal="$1"
    local required="${GOAL_MAP[$goal]}"
    
    if [ -z "$required" ]; then
        echo "Unknown goal: $goal"
        return 1
    fi
    
    local installed=""
    local gaps=""
    local installed_count=0
    local required_count=0
    
    echo "=== Capability Map: $goal ==="
    echo ""
    
    for skill in $required; do
        required_count=$((required_count + 1))
        if is_installed "$skill"; then
            installed="$installed $skill"
            installed_count=$((installed_count + 1))
            echo "✅ $skill (installed)"
        else
            gaps="$gaps $skill"
            echo "❌ $skill (missing)"
        fi
    done
    
    echo ""
    echo "Summary:"
    echo "  Required: $required_count skills"
    echo "  Installed: $installed_count skills"
    echo "  Gaps: $((required_count - installed_count)) skills"
    
    local autonomy_score=0
    if [ "$required_count" -gt 0 ]; then
        autonomy_score=$(awk "BEGIN {printf \"%.2f\", $installed_count * 100 / $required_count}")
    fi
    echo "  Autonomy Score: ${autonomy_score}%"
    
    # Record to database
    sqlite3 "$CAPS_DB" "INSERT INTO capability_maps (goal, required_skills, installed_skills, gaps, autonomy_score) VALUES ('$goal', '$required', '$installed', '$gaps', $autonomy_score);"
    
    # Create proposal if gaps exist
    if [ "$installed_count" -lt "$required_count" ]; then
        echo ""
        echo "⚠️  Capability gaps detected for goal: $goal"
        for gap in $gaps; do
            if [ -n "$gap" ]; then
                echo "   Missing: $gap"
            fi
        done
    fi
    
    echo ""
}

# Generate full capability report
generate_report() {
    echo "=== Full Capability Report ==="
    echo "Timestamp: $(date -Iseconds)"
    echo ""
    
    local total_required=0
    local total_installed=0
    
    for goal in "${!GOAL_MAP[@]}"; do
        map_capability "$goal"
        
        # Aggregate counts
        local required="${GOAL_MAP[$goal]}"
        total_required=$((total_required + $(echo "$required" | wc -w)))
        total_installed=$((total_installed + $(get_installed_skills | wc -l)))
    done
    
    echo "=== Aggregate Summary ==="
    echo "Total goals mapped: ${#GOAL_MAP[@]}"
    echo "Overall autonomy: $(get_installed_skills | wc -l) skills installed"
    echo ""
    echo "=== End Capability Report ==="
}

# Output JSON for programmatic use
output_json() {
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"goals\": {"
    
    local first=true
    for goal in "${!GOAL_MAP[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        
        local required="${GOAL_MAP[$goal]}"
        local installed_list=$(get_installed_skills | tr '\n' ' ')
        local gaps=""
        local installed_count=0
        local required_count=0
        
        for skill in $required; do
            required_count=$((required_count + 1))
            if is_installed "$skill"; then
                installed_count=$((installed_count + 1))
            else
                gaps="$gaps\"$skill\","
            fi
        done
        
        gaps=$(echo "$gaps" | sed 's/,$//')
        local score=0
        if [ "$required_count" -gt 0 ]; then
            score=$(awk "BEGIN {printf \"%.2f\", $installed_count * 100 / $required_count}")
        fi
        
        echo -n "    \"$goal\": {"
        echo -n "\"required\": $required_count,"
        echo -n "\"installed\": $installed_count,"
        echo -n "\"gaps\": [$gaps],"
        echo -n "\"autonomy_score\": $score"
        echo -n "}"
    done
    
    echo ""
    echo "  }"
    echo "}"
}

# Initialize database
init_db

# Main execution
if [ -n "$1" ] && [ "$1" != "--json" ]; then
    map_capability "$1"
else
    generate_report
fi

# Output JSON if requested
if [ "$1" = "--json" ]; then
    output_json
fi
