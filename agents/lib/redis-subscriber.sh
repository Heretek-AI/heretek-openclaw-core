#!/bin/bash
# ==============================================================================
# Heretek OpenClaw — Redis A2A Subscriber
# ==============================================================================
# This script runs alongside the main agent loop and subscribes to Redis
# channels for real-time A2A messaging. It enables instant message delivery
# instead of waiting for the polling interval.
#
# Channels:
#   a2a:{agent_name}     - Direct messages to this agent
#   global-workspace:broadcast - Consciousness broadcasts
#   channel:general      - General agent communication
#   channel:tasks       - Task distribution
#   channel:insights    - Knowledge sharing
#
# Environment Variables:
#   AGENT_NAME       - Agent identifier
#   REDIS_HOST      - Redis server hostname
#   REDIS_PORT      - Redis server port
#   A2A_HANDLER     - Script to call when message received
# ==============================================================================

set -euo pipefail

# Configuration
AGENT_NAME="${AGENT_NAME:-steward}"
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
STATE_DIR="/app/state"
LOG_FILE="$STATE_DIR/redis-subscriber.log"

# Ensure directories exist
mkdir -p "$STATE_DIR"

# Logging
log() {
    local level="${1:-INFO}"
    local message="${2:-}"
    local timestamp=$(date -Iseconds)
    echo "[$timestamp] [REDIS-SUB] [$level] $message" | tee -a "$LOG_FILE"
}

# Process incoming message
process_message() {
    local channel="$1"
    local message="$2"
    
    # Skip heartbeat/pong messages
    if [[ "$message" == "PONG" ]] || [[ -z "$message" ]]; then
        return
    fi
    
    log "INFO" "Received on channel $channel: ${message:0:100}..."
    
    # Determine message type based on channel
    case "$channel" in
        a2a:${AGENT_NAME})
            handle_a2a_message "$message"
            ;;
        global-workspace:broadcast)
            handle_workspace_broadcast "$message"
            ;;
        channel:*)
            handle_channel_message "$channel" "$message"
            ;;
        *)
            log "DEBUG" "Unknown channel: $channel"
            ;;
    esac
}

# Handle direct A2A message
handle_a2a_message() {
    local message="$1"
    
    # Validate JSON
    if ! echo "$message" | jq -e . >/dev/null 2>&1; then
        log "WARN" "Invalid JSON in A2A message"
        return
    fi
    
    # Extract message details
    local msg_type=$(echo "$message" | jq -r '.type // "unknown"')
    local msg_from=$(echo "$message" | jq -r '.from // "unknown"')
    local msg_id=$(echo "$message" | jq -r '.id // ""')
    
    log "INFO" "A2A message from $msg_from (type: $msg_type, id: $msg_id)"
    
    # Store in message queue for main loop to process
    echo "$message" >> "$STATE_DIR/redis-messages.jsonl"
    
    # Signal main loop if it's waiting
    if [ -f "$STATE_DIR/message-signal" ]; then
        rm -f "$STATE_DIR/message-signal"
    fi
    touch "$STATE_DIR/new-message"
}

# Handle global workspace broadcast
handle_workspace_broadcast() {
    local message="$1"
    
    # Validate JSON
    if ! echo "$message" | jq -e . >/dev/null 2>&1; then
        log "WARN" "Invalid JSON in workspace broadcast"
        return
    fi
    
    local broadcast_type=$(echo "$message" | jq -r '.type // "broadcast"')
    local content=$(echo "$message" | jq -r '.content // ""')
    
    log "INFO" "Workspace broadcast: $broadcast_type"
    
    # Store in collective memory
    echo "$message" >> "$STATE_DIR/workspace-broadcasts.jsonl"
}

# Handle channel message
handle_channel_message() {
    local channel="$1"
    local message="$2"
    
    # Validate JSON
    if ! echo "$message" | jq -e . >/dev/null 2>&1; then
        log "WARN" "Invalid JSON in channel message"
        return
    fi
    
    local channel_name="${channel#channel:}"
    local msg_from=$(echo "$message" | jq -r '.from // "unknown"')
    local msg_content=$(echo "$message" | jq -r '.content // ""')
    
    log "INFO" "Channel $channel_name message from $msg_from"
    
    # Store in channel archive
    echo "$message" >> "$STATE_DIR/channel-$channel_name.jsonl"
}

# Publish a message to an agent
publish_to_agent() {
    local to_agent="$1"
    local message="$2"
    
    log "INFO" "Publishing to agent $to_agent"
    
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "a2a:$to_agent" "$message"
}

# Publish to a channel
publish_to_channel() {
    local channel="$1"
    local message="$2"
    
    log "INFO" "Publishing to channel $channel"
    
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "channel:$channel" "$message"
}

# Publish to global workspace
publish_to_workspace() {
    local message="$1"
    
    log "INFO" "Publishing to global workspace"
    
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "global-workspace:broadcast" "$message"
}

# Check Redis connectivity
check_redis() {
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING >/dev/null 2>&1; then
        log "ERROR" "Redis not available at $REDIS_HOST:$REDIS_PORT"
        return 1
    fi
    log "INFO" "Redis connection OK"
    return 0
}

# Subscribe to channels (using redis-cli pipelining for Bash compatibility)
subscribe_loop() {
    log "INFO" "Starting Redis subscriber for agent $AGENT_NAME"
    
    # Define channels to subscribe to
    local channels="a2a:$AGENT_NAME global-workspace:broadcast channel:general channel:tasks channel:insights channel:emergence channel:consciousness"
    
    # Use redis-cli in subscribe mode with timeout
    # This is more portable than redis-cli --pipe for subscriptions
    while true; do
        local result
        result=$(timeout 60 redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
            SUBSCRIBE "$channels" 2>&1 || true)
        
        # Process each line of output
        echo "$result" | while read -r line; do
            # Redis subscribe output format: [channel] [message]
            if [[ "$line" == *"message"* ]]; then
                # Extract channel and message
                local channel=$(echo "$line" | awk '{print $2}' | tr -d '"')
                local message=$(echo "$line" | awk '{$1=$2=""; print $0}' | sed 's/^ *//')
                message=$(echo "$message" | tr -d '"')
                
                if [[ -n "$channel" ]] && [[ -n "$message" ]]; then
                    process_message "$channel" "$message"
                fi
            fi
        done
        
        log "WARN" "Subscription loop ended, reconnecting..."
        sleep 1
    done
}

# Alternative: Use redis-cli PSUB for pattern subscription
psubscribe_loop() {
    log "INFO" "Starting Redis pattern subscriber for agent $AGENT_NAME"
    
    # Subscribe to all A2A messages and channels
    while true; do
        # Use psubscribe for pattern matching
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
            PSUBSCRIBE "a2a:*" "global-workspace:*" "channel:*" 2>&1 | \
        while IFS= read -r line; do
            # Parse redis message format
            if [[ "$line" =~ \[.*\]\ (.*) ]]; then
                local channel="${BASH_REMATCH[1]}"
                local message="${line#*\] }"
                
                # Skip PONG and control messages
                if [[ "$channel" != "pmessage" ]] && [[ "$message" != "PONG" ]]; then
                    # For pmessage, format is: pmessage pattern channel message
                    # Need to extract actual channel and message
                    :
                fi
            fi
        done
        
        log "WARN" "PSubscribe loop ended, reconnecting..."
        sleep 1
    done
}

# Main
main() {
    log "INFO" "=========================================="
    log "INFO" "Redis A2A Subscriber Starting"
    log "INFO" "Agent: $AGENT_NAME"
    log "INFO" "Redis: $REDIS_HOST:$REDIS_PORT"
    log "INFO" "=========================================="
    
    # Wait for Redis to be available
    local max_retries=30
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if check_redis; then
            break
        fi
        retry=$((retry + 1))
        log "WARN" "Waiting for Redis... ($retry/$max_retries)"
        sleep 2
    done
    
    if [ $retry -eq $max_retries ]; then
        log "ERROR" "Redis not available after $max_retries retries"
        exit 1
    fi
    
    # Announce presence
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SET "agent:$AGENT_NAME:subscriber:active" "true" EX 300
    
    # Start subscription loop
    subscribe_loop
}

# Trap signals for graceful shutdown
trap 'log "INFO" "Received shutdown signal"; exit 0' SIGTERM SIGINT

# Run main
main "$@"