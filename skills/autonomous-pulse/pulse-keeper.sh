#!/bin/bash
#===============================================================================
# Pulse Keeper - Autonomous Session Maintenance
#===============================================================================
# Maintains session persistence, logs activities, and commits progress.
#
# Usage:
#   ./pulse-keeper.sh start     # Start autonomous mode
#   ./pulse-keeper.sh stop      # Stop autonomous mode
#   ./pulse-keeper.sh status    # Check current status
#   ./pulse-keeper.sh commit    # Force immediate commit
#
# Environment Variables:
#   PULSE_INTERVAL        - Heartbeat interval in seconds (default: 300)
#   COMMIT_INTERVAL      - Commit interval in seconds (default: 1800)
#   PUSH_INTERVAL        - Push interval in seconds (default: 3600)
#   NIGHT_LOG_PATH       - Path to night log file
#   AUTONOMOUS_MODE       - Enable autonomous mode (true/false)
#
#===============================================================================

set -euo pipefail

# Configuration
PULSE_INTERVAL="${PULSE_INTERVAL:-300}"          # 5 minutes
COMMIT_INTERVAL="${COMMIT_INTERVAL:-1800}"      # 30 minutes
PUSH_INTERVAL="${PUSH_INTERVAL:-3600}"          # 60 minutes
NIGHT_LOG_PATH="${NIGHT_LOG_PATH:-./night-log.md}"
STATE_FILE="${STATE_FILE:-/tmp/pulse-state.json}"
AUTONOMOUS_MODE="${AUTONOMOUS_MODE:-true}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Logging function
log() {
    local timestamp
    timestamp="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    echo "[$timestamp] [PULSE] $*" | tee -a "$NIGHT_LOG_PATH" 2>/dev/null || echo "[$timestamp] [PULSE] $*"
}

# Initialize state file
init_state() {
    if [ ! -f "$STATE_FILE" ]; then
        cat > "$STATE_FILE" <<EOF
{
    "started": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')",
    "last_pulse": null,
    "last_commit": null,
    "last_push": null,
    "pulse_count": 0,
    "activities": [],
    "status": "initialized"
}
EOF
        log "State file initialized"
    fi
}

# Update state
update_state() {
    local key="$1"
    local value="$2"
    
    if [ -f "$STATE_FILE" ]; then
        local temp_file="/tmp/pulse-state-$$.json"
        jq --argjson val "$value" ".${key} = \$val" "$STATE_FILE" > "$temp_file" 2>/dev/null && \
        mv "$temp_file" "$STATE_FILE"
    fi
}

# Record pulse
record_pulse() {
    local count
    count=$(jq -r '.pulse_count // 0' "$STATE_FILE" 2>/dev/null || echo "0")
    count=$((count + 1))
    
    update_state "last_pulse" "\"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')\""
    update_state "pulse_count" "$count"
    update_state "status" "\"active\""
    
    log "Pulse #$count recorded"
}

# Log activity
log_activity() {
    local activity="$1"
    local timestamp
    timestamp="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    
    # Append to night log
    echo "- **[$timestamp]** $activity" >> "$NIGHT_LOG_PATH"
    
    # Update state activities (keep last 10)
    if [ -f "$STATE_FILE" ]; then
        local activities
        activities=$(jq -r '.activities // []' "$STATE_FILE" 2>/dev/null)
        # This is simplified - in production would use jq properly
        log "Activity logged: $activity"
    fi
}

# Check if commit is needed
should_commit() {
    local last_commit
    last_commit=$(jq -r '.last_commit // null' "$STATE_FILE" 2>/dev/null)
    
    if [ "$last_commit" = "null" ]; then
        return 0  # Need to commit
    fi
    
    local now epoch_last
    now=$(date +%s)
    epoch_last=$(date -d "$last_commit" +%s 2>/dev/null || echo "0")
    
    local diff=$((now - epoch_last))
    [ $diff -ge $COMMIT_INTERVAL ]
}

# Perform commit
do_commit() {
    log "Starting commit..."
    
    # Add all changes
    git add -A 2>/dev/null || true
    
    # Check if there's anything to commit
    if git diff --cached --quiet 2>/dev/null; then
        log "No changes to commit"
        return 0
    fi
    
    # Create commit with timestamp
    local commit_msg="chore: autonomous pulse commit - $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    git commit -m "$commit_msg" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        update_state "last_commit" "\"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')\""
        log "Commit successful"
        return 0
    else
        log "Commit failed"
        return 1
    fi
}

# Check if push is needed
should_push() {
    local last_push
    last_push=$(jq -r '.last_push // null' "$STATE_FILE" 2>/dev/null)
    
    if [ "$last_push" = "null" ]; then
        return 0  # Need to push
    fi
    
    local now epoch_last
    now=$(date +%s)
    epoch_last=$(date -d "$last_push" +%s 2>/dev/null || echo "0")
    
    local diff=$((now - epoch_last))
    [ $diff -ge $PUSH_INTERVAL ]
}

# Perform push
do_push() {
    log "Starting push..."
    
    git push origin main 2>/dev/null || git push origin master 2>/dev/null
    
    if [ $? -eq 0 ]; then
        update_state "last_push" "\"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')\""
        log "Push successful"
        return 0
    else
        log "Push failed (may need authentication)"
        return 1
    fi
}

# Initialize night log
init_night_log() {
    if [ ! -f "$NIGHT_LOG_PATH" ]; then
        cat > "$NIGHT_LOG_PATH" <<EOF
# Night Operations Log

**Started:** $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')
**Status:** Active

---

## Activity Log

EOF
        log "Night log initialized at $NIGHT_LOG_PATH"
    fi
}

# Main pulse loop
pulse_loop() {
    log "Starting pulse loop (interval: ${PULSE_INTERVAL}s)"
    
    while true; do
        # Record heartbeat
        record_pulse
        
        # Check for commit
        if should_commit; then
            do_commit
        fi
        
        # Check for push
        if should_push; then
            do_push
        fi
        
        # Sleep until next pulse
        sleep "$PULSE_INTERVAL"
    done
}

# Status check
show_status() {
    echo "=== Autonomous Pulse Status ==="
    if [ -f "$STATE_FILE" ]; then
        jq '.' "$STATE_FILE" 2>/dev/null || echo "Unable to read state"
    else
        echo "Not initialized"
    fi
    echo ""
    echo "=== Recent Night Log Entries ==="
    if [ -f "$NIGHT_LOG_PATH" ]; then
        tail -10 "$NIGHT_LOG_PATH" 2>/dev/null || echo "Unable to read log"
    else
        echo "No night log found"
    fi
}

# Start command
start() {
    log "Starting autonomous pulse system..."
    init_state
    init_night_log
    update_state "status" "\"running\""
    pulse_loop
}

# Stop command
stop() {
    log "Stopping autonomous pulse system..."
    update_state "status" "\"stopped\""
    # Final commit
    do_commit
    log "Autonomous pulse system stopped"
}

# Main entry point
case "${1:-status}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        show_status
        ;;
    commit)
        init_state
        do_commit
        ;;
    push)
        init_state
        do_push
        ;;
    log)
        shift
        log_activity "$*"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|commit|push|log <message>}"
        echo ""
        echo "Commands:"
        echo "  start           - Start autonomous pulse loop"
        echo "  stop            - Stop autonomous pulse loop"
        echo "  status          - Show current status"
        echo "  commit          - Force immediate commit"
        echo "  push            - Force immediate push"
        echo "  log <message>   - Log an activity"
        exit 1
        ;;
esac
