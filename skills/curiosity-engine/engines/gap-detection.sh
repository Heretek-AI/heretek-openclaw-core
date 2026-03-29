#!/bin/bash
# Gap Detection Engine - Compares installed skills vs available skills
# Outputs gaps that would enable new capabilities

set -e

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
SKILLS_DIR="$WORKSPACE/skills"
CATALOG_DB="$WORKSPACE/.curiosity/skill_catalog.db"

# Ensure catalog directory exists
mkdir -p "$(dirname "$CATALOG_DB")"

# Get installed skills
get_installed_skills() {
    find "$SKILLS_DIR" -maxdepth 2 -name "SKILL.md" 2>/dev/null | while read -r skill_file; do
        skill_name=$(dirname "$skill_file" | xargs basename)
        echo "$skill_name"
    done
}

# Get available skills from ClawHub (cached)
get_available_skills() {
    if [ -f "$WORKSPACE/.curiosity/available_skills.txt" ]; then
        cat "$WORKSPACE/.curiosity/available_skills.txt"
    else
        # Try to fetch from ClawHub if available
        if command -v clawhub &> /dev/null; then
            clawhub search 2>/dev/null | tail -n +2 | cut -d' ' -f1 || true
        fi
        echo ""
    fi
}

# Detect gaps
detect_gaps() {
    local installed=$(get_installed_skills | sort -u)
    local available=$(get_available_skills | sort -u)
    
    echo "=== Gap Detection Report ===" 
    echo "Timestamp: $(date -Iseconds)"
    echo ""
    echo "Installed skills: $(echo "$installed" | wc -l)"
    echo "Available skills: $(echo "$available" | wc -l)"
    echo ""
    
    # Find missing high-value skills
    local critical_skills="skill-creator knowledge-ingest knowledge-retrieval triad-deliberation-protocol triad-sync-protocol"
    
    for skill in $critical_skills; do
        if ! echo "$installed" | grep -q "^${skill}$"; then
            echo "⚠️  GAP DETECTED: $skill"
            echo "   Impact: Self-improvement loop disabled" 
            echo "   Recommendation: clawhub install $skill"
            echo ""
        fi
    done
    
    # Check for any available but not installed
    echo "$available" | while read -r skill; do
        if [ -n "$skill" ] && ! echo "$installed" | grep -q "^${skill}$"; then
            echo "📋 Missing: $skill (optional)"
        fi
    done
    
    echo ""
    echo "=== End Gap Detection ==="
}

# Main execution
detect_gaps

# Output JSON for programmatic use
if [ "$1" = "--json" ]; then
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"installed_count\": $(get_installed_skills | wc -l),"
    echo "  \"available_count\": $(get_available_skills | wc -l),"
    echo "  \"critical_gaps\": ["
    first=true
    for skill in skill-creator knowledge-ingest knowledge-retrieval; do
        if ! get_installed_skills | grep -q "^${skill}$"; then
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            echo -n "    \"$skill\""
        fi
    done
    echo ""
    echo "  ]"
    echo "}"
fi
