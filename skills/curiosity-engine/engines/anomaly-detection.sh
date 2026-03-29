#!/bin/bash
# Anomaly Detection Engine - Monitors error logs, rate limits, failures
# Creates deliberation proposals for systematic issues

set -e

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
LOG_DIR="$WORKSPACE/logs"
ANOMALY_DB="$WORKSPACE/.curiosity/anomalies.db"
EPISODIC_DIR="$WORKSPACE/memory"

# Ensure directories exist
mkdir -p "$LOG_DIR" "$(dirname "$ANOMALY_DB")" "$EPISODIC_DIR"

# Initialize anomaly database
init_db() {
    sqlite3 "$ANOMALY_DB" <<EOF
CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    error_type TEXT,
    count INTEGER DEFAULT 1,
    severity TEXT DEFAULT 'low',
    processed INTEGER DEFAULT 0
);
EOF
}

# Scan for anomalies in recent logs
scan_anomalies() {
    echo "=== Anomaly Detection Report ==="
    echo "Timestamp: $(date -Iseconds)"
    echo ""
    
    # Check for repeated failures in knowledge-ingest logs
    if [ -d "$LOG_DIR" ]; then
        echo "Scanning logs for patterns..."
        
        # Count timeout errors
        timeout_count=$(grep -r "timeout\|ETIMEDOUT" "$LOG_DIR" 2>/dev/null | wc -l || echo 0)
        if [ "$timeout_count" -gt 5 ]; then
            echo "⚠️  ANOMALY: $timeout_count timeout errors detected"
            echo "   Source: Multiple log files"
            echo "   Severity: HIGH"
            echo "   Recommendation: Investigate network connectivity or increase timeouts"
            record_anomaly "timeout" "network" "$timeout_count" "high"
        fi
        
        # Count rate limit errors
        ratelimit_count=$(grep -r "429\|rate.limit\|RateLimit" "$LOG_DIR" 2>/dev/null | wc -l || echo 0)
        if [ "$ratelimit_count" -gt 3 ]; then
            echo "⚠️  ANOMALY: $ratelimit_count rate limit errors detected"
            echo "   Source: API calls"
            echo "   Severity: MEDIUM"
            echo "   Recommendation: Implement rate limiting backoff"
            record_anomaly "ratelimit" "api" "$ratelimit_count" "medium"
        fi
        
        # Count authentication failures
        auth_failures=$(grep -r "401\|403\|unauthorized\|auth.fail" "$LOG_DIR" 2>/dev/null | wc -l || echo 0)
        if [ "$auth_failures" -gt 2 ]; then
            echo "⚠️  ANOMALY: $auth_failures authentication failures detected"
            echo "   Source: Auth subsystem"
            echo "   Severity: CRITICAL"
            echo "   Recommendation: Verify credentials and token rotation"
            record_anomaly "auth_failure" "security" "$auth_failures" "critical"
        fi
    fi
    
    # Check for disk space issues
    disk_usage=$(df "$WORKSPACE" 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')
    if [ "${disk_usage:-0}" -gt 90 ]; then
        echo "⚠️  ANOMALY: Disk usage at ${disk_usage}%"
        echo "   Source: $(df "$WORKSPACE" 2>/dev/null | tail -1 | awk '{print $1}')"
        echo "   Severity: HIGH"
        echo "   Recommendation: Clean old logs or expand storage"
        record_anomaly "disk_space" "system" "$disk_usage" "high"
    fi
    
    # Check for memory pressure
    if command -v free &> /dev/null; then
        mem_available=$(free | awk '/Mem:/ {print int($7/$2 * 100)}')
        if [ "${mem_available:-100}" -lt 10 ]; then
            echo "⚠️  ANOMALY: Memory availability at ${mem_available}%"
            echo "   Severity: HIGH"
            echo "   Recommendation: Investigate memory leaks or restart services"
            record_anomaly "memory_pressure" "system" "$((100 - mem_available))" "high"
        fi
    fi
    
    echo ""
    echo "=== End Anomaly Detection ==="
}

# Record anomaly to database
record_anomaly() {
    local source="$1"
    local error_type="$2"
    local count="$3"
    local severity="$4"
    
    sqlite3 "$ANOMALY_DB" "INSERT INTO anomalies (source, error_type, count, severity) VALUES ('$source', '$error_type', $count, '$severity');"
    
    # Create deliberation proposal for high/critical severity
    if [ "$severity" = "high" ] || [ "$severity" = "critical" ]; then
        create_proposal "Repair $source $error_type anomaly" "Anomaly detected: $count occurrences of $error_type in $source. Severity: $severity. Requires investigation and remediation."
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

**Source:** Anomaly Detection Engine
**Status:** Pending quorum vote

EOF
    
    echo "📋 Proposal created: $title"
    echo "   Logged to: $EPISODIC_DIR/curiosity-$(date +%Y-%m-%d).md"
}

# Initialize database
init_db

# Main execution
scan_anomalies

# Output JSON for programmatic use
if [ "$1" = "--json" ]; then
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"anomalies\": ["
    sqlite3 -json "$ANOMALY_DB" "SELECT * FROM anomalies WHERE processed = 0 ORDER BY timestamp DESC LIMIT 10;" 2>/dev/null || echo "[]"
    echo "  ]"
    echo "}"
fi
