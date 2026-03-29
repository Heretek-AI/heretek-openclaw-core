#!/bin/bash
# Opportunity Scanning Engine - Watches GitHub releases, npm updates, CVEs, ClawHub new skills
# Triggers deliberation proposals for major opportunities

set -e

# Load environment configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../../../.env" ]]; then
  source "$SCRIPT_DIR/../../../.env"
fi

# Configuration with environment variable fallbacks
WORKSPACE="${WORKSPACE:-${HOME}/.openclaw/workspace}"
OPPS_DB="$WORKSPACE/.curiosity/opportunities.db"
EPISODIC_DIR="$WORKSPACE/memory"
GITHUB_ORG="${GITHUB_ORG:-Heretek-AI}"
GITHUB_REPO="${GITHUB_REPO:-openclaw}"
GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
NPM_ORG="${NPM_ORG:-@heretek-ai}"

# Ensure directories exist
mkdir -p "$(dirname "$OPPS_DB")" "$EPISODIC_DIR"

# Initialize opportunities database
init_db() {
    sqlite3 "$OPPS_DB" <<EOF
CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    title TEXT,
    url TEXT,
    type TEXT DEFAULT 'info',
    priority TEXT DEFAULT 'low',
    processed INTEGER DEFAULT 0
);
EOF
}

# Scan GitHub for new releases
scan_github_releases() {
    echo "Scanning GitHub releases..."
    
    if [ -n "$GH_TOKEN" ]; then
        # Fetch latest releases from configured organization
        local releases=$(curl -s \
            -H "Authorization: token $GH_TOKEN" \
            "https://api.github.com/repos/$GITHUB_ORG/$GITHUB_REPO/releases?per_page=5" 2>/dev/null || true)
        
        if [ -n "$releases" ]; then
            echo "$releases" | jq -r '.[] | "\(.tag_name)|\(.name)|\(.html_url)|\(.published_at)"' 2>/dev/null | while IFS='|' read -r tag name url published; do
                if [ -n "$tag" ]; then
                    echo "📦 Release: $tag"
                    echo "   Name: $name"
                    echo "   URL: $url"
                    echo "   Published: $published"
                    
                    # Record opportunity
                    sqlite3 "$OPPS_DB" "INSERT INTO opportunities (source, title, url, type, priority) VALUES ('github', '$tag', '$url', 'release', 'high');"
                    
                    # Check if this is a major version bump
                    if echo "$tag" | grep -qE "^v?[0-9]+\.[0-9]+\.[0-9]+$"; then
                        create_proposal "Rebase on $tag" "New release $tag available. Recommend rebasing heretek/main to incorporate changes while preserving liberation."
                    fi
                fi
            done
        else
            echo "   No releases found or GH_TOKEN not set"
        fi
    else
        echo "   GH_TOKEN not set, skipping GitHub API calls"
    fi
}

# Scan npm for package updates
scan_npm_updates() {
    echo ""
    echo "Scanning npm updates..."
    
    # Check for configured org packages (default: @heretek-ai)
    local packages="${NPM_PACKAGES:-openclaw clawhub mcporter}"
    
    for pkg in $packages; do
        local latest=$(npm view "${NPM_ORG}/$pkg" version 2>/dev/null || true)
        if [ -n "$latest" ]; then
            echo "📦 npm: ${NPM_ORG}/$pkg@$latest"
            sqlite3 "$OPPS_DB" "INSERT INTO opportunities (source, title, url, type) VALUES ('npm', '${NPM_ORG}/$pkg@$latest', 'https://www.npmjs.com/package/${NPM_ORG}/$pkg', 'update');"
        fi
    done
}

# Scan ClawHub for new skills
scan_clawhub_skills() {
    echo ""
    echo "Scanning ClawHub for new skills..."
    
    if command -v clawhub &> /dev/null; then
        local new_skills=$(clawhub search 2>/dev/null | tail -n +2 || true)
        if [ -n "$new_skills" ]; then
            echo "$new_skills" | head -5 | while read -r line; do
                skill_name=$(echo "$line" | awk '{print $1}')
                if [ -n "$skill_name" ]; then
                    echo "🔌 New skill: $skill_name"
                    sqlite3 "$OPPS_DB" "INSERT INTO opportunities (source, title, type, priority) VALUES ('clawhub', '$skill_name', 'new_skill', 'medium');"
                fi
            done
        else
            echo "   No new skills found"
        fi
    else
        echo "   clawhub CLI not installed"
    fi
}

# Scan for security advisories (CVEs)
scan_security_advisories() {
    echo ""
    echo "Scanning security advisories..."
    
    # Check GitHub Security Advisories for the configured repo
    if [ -n "$GH_TOKEN" ]; then
        local advisories=$(curl -s \
            -H "Authorization: token $GH_TOKEN" \
            "https://api.github.com/repos/$GITHUB_ORG/$GITHUB_REPO/code-scanning/alerts?state=open&per_page=5" 2>/dev/null || true)
        
        if [ -n "$advisories" ]; then
            local count=$(echo "$advisories" | jq 'length' 2>/dev/null || echo 0)
            if [ "$count" -gt 0 ]; then
                echo "⚠️  Security: $count open code scanning alerts"
                sqlite3 "$OPPS_DB" "INSERT INTO opportunities (source, title, type, priority) VALUES ('github', '$count security alerts', 'security', 'critical');"
                create_proposal "Address security alerts" "$count open code scanning alerts detected. Requires triage and remediation."
            fi
        fi
    fi
}

# Create deliberation proposal
create_proposal() {
    local title="$1"
    local body="$2"
    local timestamp=$(date -Iseconds)
    
    # Append to episodic memory
    cat >> "$EPISODIC_DIR/curiosity-$(date +%Y-%m-%d).md" <<EOF

## Deliberation Proposal - $timestamp

**Title:** $title

**Body:** $body

**Source:** Opportunity Scanning Engine
**Status:** Pending quorum vote

EOF
    
    echo "📋 Proposal created: $title"
}

# Initialize database
init_db

# Main execution
echo "=== Opportunity Scanning Report ==="
echo "Timestamp: $(date -Iseconds)"
echo ""

scan_github_releases
scan_npm_updates
scan_clawhub_skills
scan_security_advisories

echo ""
echo "=== End Opportunity Scanning ==="

# Output JSON for programmatic use
if [ "$1" = "--json" ]; then
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"opportunities\": ["
    sqlite3 -json "$OPPS_DB" "SELECT * FROM opportunities WHERE processed = 0 ORDER BY timestamp DESC LIMIT 10;" 2>/dev/null || echo "[]"
    echo "  ]"
    echo "}"
fi
