#!/bin/bash
# Knowledge Integration Module - Bridges curiosity-engine with knowledge-ingest/retrieval
# Queries knowledge entries and tags them for curiosity-driven retrieval

set -e

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
KNOWLEDGE_DB="$WORKSPACE/.curiosity/knowledge.db"
INGEST_SKILL="$WORKSPACE/skills/knowledge-ingest"
RETRIEVAL_SKILL="$WORKSPACE/skills/knowledge-retrieval"

# Ensure directories exist
mkdir -p "$(dirname "$KNOWLEDGE_DB")"

# Initialize knowledge database
init_db() {
    sqlite3 "$KNOWLEDGE_DB" <<EOF
CREATE TABLE IF NOT EXISTS curiosity_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    entry_id TEXT,
    title TEXT,
    curiosity_tag TEXT,
    relevance_score REAL DEFAULT 0,
    processed INTEGER DEFAULT 0
);
EOF
}

# Tag knowledge entries with curiosity markers
tag_knowledge() {
    echo "Tagging knowledge entries with curiosity markers..."
    
    # Check if knowledge-ingest skill exists
    if [ -d "$INGEST_SKILL" ]; then
        local ingest_db="$WORKSPACE/.knowledge/entries.db"
        
        if [ -f "$ingest_db" ]; then
            # Query unprocessed entries and tag them
            sqlite3 "$ingest_db" "SELECT id, source, title FROM knowledge_entries WHERE processed = 0 LIMIT 10;" 2>/dev/null | while IFS='|' read -r id source title; do
                if [ -n "$id" ]; then
                    # Determine curiosity tag based on content
                    local tag="info"
                    if echo "$title" | grep -qi "gap\|missing\|need"; then
                        tag="gap"
                    elif echo "$title" | grep -qi "error\|fail\|anomaly"; then
                        tag="anomaly"
                    elif echo "$title" | grep -qi "release\|update\|opportunity"; then
                        tag="opportunity"
                    elif echo "$title" | grep -qi "capability\|skill\|ability"; then
                        tag="capability"
                    fi
                    
                    # Calculate relevance score (simple heuristic)
                    local score=0.5
                    
                    # Record tagged knowledge
                    sqlite3 "$KNOWLEDGE_DB" "INSERT INTO curiosity_knowledge (entry_id, source, title, curiosity_tag, relevance_score) VALUES ('$id', '$source', '$title', '$tag', $score);"
                    
                    echo "  Tagged: $title → $tag (score: $score)"
                fi
            done
        else
            echo "  Knowledge ingest database not found"
        fi
    else
        echo "  Knowledge-ingest skill not found"
    fi
}

# Query curiosity-tagged knowledge
query_curiosity_knowledge() {
    local tag="${1:-all}"
    
    echo "Querying curiosity knowledge (tag: $tag)..."
    
    if [ "$tag" = "all" ]; then
        sqlite3 -header -column "$KNOWLEDGE_DB" "SELECT * FROM curiosity_knowledge ORDER BY timestamp DESC LIMIT 10;"
    else
        sqlite3 -header -column "$KNOWLEDGE_DB" "SELECT * FROM curiosity_knowledge WHERE curiosity_tag = '$tag' AND processed = 0 ORDER BY relevance_score DESC LIMIT 10;"
    fi
}

# Get high-relevance entries for deliberation
get_high_relevance() {
    echo "Fetching high-relevance entries for deliberation..."
    
    sqlite3 "$KNOWLEDGE_DB" "SELECT title, curiosity_tag, relevance_score FROM curiosity_knowledge WHERE relevance_score > 0.7 AND processed = 0;" 2>/dev/null | while IFS='|' read -r title tag score; do
        if [ -n "$title" ]; then
            echo "  📌 $title ($tag, score: $score)"
            
            # Auto-create proposal for high-relevance gaps
            if [ "$tag" = "gap" ]; then
                echo "     → Triggering deliberation proposal..."
            fi
        fi
    done
}

# Mark entries as processed
mark_processed() {
    local entry_id="$1"
    sqlite3 "$KNOWLEDGE_DB" "UPDATE curiosity_knowledge SET processed = 1 WHERE entry_id = '$entry_id';"
    echo "Marked entry $entry_id as processed"
}

# Integration with knowledge-retrieval skill
retrieve_for_curiosity() {
    echo "Retrieving knowledge for curiosity engine..."
    
    if [ -d "$RETRIEVAL_SKILL" ]; then
        # Check if retrieval skill has a query interface
        if [ -x "$RETRIEVAL_SKILL/scripts/query.sh" ]; then
            "$RETRIEVAL_SKILL/scripts/query.sh" --curiosity 2>/dev/null || true
        else
            echo "  Retrieval skill query interface not found"
        fi
    else
        echo "  Knowledge-retrieval skill not found"
    fi
}

# Initialize database
init_db

# Main execution
case "${1:-tag}" in
    tag)
        tag_knowledge
        ;;
    query)
        query_curiosity_knowledge "${2:-all}"
        ;;
    relevance)
        get_high_relevance
        ;;
    retrieve)
        retrieve_for_curiosity
        ;;
    *)
        echo "Usage: $0 {tag|query [tag]|relevance|retrieve}"
        exit 1
        ;;
esac
