#!/bin/bash
# ==============================================================================
# Heretek OpenClaw — Agent Runtime Entrypoint
# ==============================================================================
# This script runs inside each agent container and handles:
# - Agent registration with LiteLLM A2A
# - Message polling and processing
# - Skill execution
# - Heartbeat signals
# - Integration with autonomy modules (thought-loop, self-model)
#
# Environment Variables:
#   AGENT_NAME         - Agent identifier (steward, alpha, beta, etc.)
#   AGENT_ROLE         - Agent role (orchestrator, triad, etc.)
#   LITELLM_HOST       - LiteLLM gateway URL
#   LITELLM_API_KEY    - API key for LiteLLM
#   AGENT_MODEL        - Model to use (agent/{name} passthrough)
#   SKILLS_PATH        - Path to skills directory
#   AGENT_LOOP_INTERVAL - Polling interval in seconds
# ==============================================================================

set -euo pipefail

# Configuration
AGENT_NAME="${AGENT_NAME:-steward}"
AGENT_ROLE="${AGENT_ROLE:-orchestrator}"
LITELLM_HOST="${LITELLM_HOST:-http://litellm:4000}"
LITELLM_API_KEY="${LITELLM_API_KEY:-}"
AGENT_MODEL="${AGENT_MODEL:-agent/steward}"
SKILLS_PATH="${SKILLS_PATH:-/app/skills}"
AGENT_LOOP_INTERVAL="${AGENT_LOOP_INTERVAL:-30}"
AGENT_PORT="${AGENT_PORT:-8000}"

# State files
STATE_DIR="/app/state"
MEMORY_DIR="/app/memory"
COLLECTIVE_DIR="/app/collective"

# Ensure directories exist
mkdir -p "$STATE_DIR" "$MEMORY_DIR" "$COLLECTIVE_DIR"

# Logging
LOG_FILE="$STATE_DIR/agent.log"
log() {
    local level="${1:-INFO}"
    local message="${2:-}"
    local timestamp=$(date -Iseconds)
    echo "[$timestamp] [$AGENT_NAME] [$level] $message" | tee -a "$LOG_FILE"
}

# Health check endpoint (simple HTTP server)
start_health_server() {
    log "INFO" "Starting health check server on port $AGENT_PORT"
    
    # Create a simple health check response
    mkfifo /tmp/health_pipe 2>/dev/null || true
    
    while true; do
        {
            echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"agent\":\"$AGENT_NAME\",\"status\":\"healthy\",\"timestamp\":\"$(date -Iseconds)\"}"
        } | nc -l -p "$AGENT_PORT" -q 1 2>/dev/null || true
    done &
    
    log "INFO" "Health server started on port $AGENT_PORT"
}

# Register agent with LiteLLM A2A
register_agent() {
    log "INFO" "Registering agent $AGENT_NAME with LiteLLM A2A..."
    
    local response
    response=$(curl -s -w "\n%{http_code}" -X POST "$LITELLM_HOST/v1/agents/register" \
        -H "Authorization: Bearer $LITELLM_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"agent_id\": \"$AGENT_NAME\",
            \"role\": \"$AGENT_ROLE\",
            \"model\": \"$AGENT_MODEL\",
            \"endpoint\": \"http://$AGENT_NAME:$AGENT_PORT\",
            \"capabilities\": $(get_agent_capabilities)
        }" 2>/dev/null || echo -e "\n000")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        log "INFO" "Agent registered successfully"
        return 0
    else
        log "WARN" "Agent registration returned HTTP $http_code (may be expected)"
        return 1
    fi
}

# Get agent capabilities based on role
get_agent_capabilities() {
    case "$AGENT_ROLE" in
        orchestrator)
            echo '["coordinate", "delegate", "monitor", "report"]'
            ;;
        triad)
            echo '["deliberate", "vote", "consensus", "validate"]'
            ;;
        interrogator)
            echo '["challenge", "verify", "audit", "question"]'
            ;;
        scout)
            echo '["explore", "discover", "report", "scan"]'
            ;;
        guardian)
            echo '["protect", "monitor", "alert", "enforce"]'
            ;;
        artisan)
            echo '["create", "modify", "review", "implement"]'
            ;;
        *)
            echo '["general"]'
            ;;
    esac
}

# Send heartbeat to LiteLLM
send_heartbeat() {
    curl -s -X POST "$LITELLM_HOST/v1/agents/$AGENT_NAME/heartbeat" \
        -H "Authorization: Bearer $LITELLM_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"status\": \"alive\",
            \"timestamp\": \"$(date -Iseconds)\",
            \"agent\": \"$AGENT_NAME\",
            \"role\": \"$AGENT_ROLE\",
            \"model\": \"$AGENT_MODEL\"
        }" 2>/dev/null || true
}

# Poll for messages from LiteLLM A2A
poll_messages() {
    curl -s "$LITELLM_HOST/v1/agents/$AGENT_NAME/messages" \
        -H "Authorization: Bearer $LITELLM_API_KEY" \
        -H "Content-Type: application/json" \
        2>/dev/null || echo '{"messages":[]}'
}

# Process a single message
process_message() {
    local message="$1"
    local msg_id=$(echo "$message" | jq -r '.id // "unknown"')
    local msg_type=$(echo "$message" | jq -r '.type // "unknown"')
    local msg_from=$(echo "$message" | jq -r '.from // "unknown"')
    local msg_content=$(echo "$message" | jq -r '.content // ""')
    local msg_skill=$(echo "$message" | jq -r '.skill // null')
    
    log "INFO" "Processing message $msg_id from $msg_from (type: $msg_type)"
    
    # Store message in memory
    store_message "$message"
    
    # Handle different message types
    case "$msg_type" in
        task)
            handle_task "$message"
            ;;
        query)
            handle_query "$message"
            ;;
        broadcast)
            handle_broadcast "$message"
            ;;
        skill_request)
            if [ -n "$msg_skill" ] && [ "$msg_skill" != "null" ]; then
                execute_skill "$msg_skill" "$message"
            fi
            ;;
        *)
            log "INFO" "Unknown message type: $msg_type"
            ;;
    esac
}

# Handle task message
handle_task() {
    local message="$1"
    local task=$(echo "$message" | jq -r '.content.task // .content // ""')
    
    log "INFO" "Handling task: $task"
    
    # Process task through LiteLLM
    local response
    response=$(curl -s -X POST "$LITELLM_HOST/v1/chat/completions" \
        -H "Authorization: Bearer $LITELLM_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"$AGENT_MODEL\",
            \"messages\": [
                {\"role\": \"system\", \"content\": \"You are $AGENT_NAME, a $AGENT_ROLE agent in the Heretek OpenClaw collective.\"},
                {\"role\": \"user\", \"content\": \"$task\"}
            ],
            \"agent\": \"$AGENT_NAME\"
        }" 2>/dev/null || echo '{"choices":[{"message":{"content":"Error processing task"}}]}')
    
    local reply=$(echo "$response" | jq -r '.choices[0].message.content // "No response"')
    
    # Send response back
    send_response "$(echo "$message" | jq -r '.from // "unknown"')" "$reply" "$message"
}

# Handle query message
handle_query() {
    local message="$1"
    local query=$(echo "$message" | jq -r '.content.query // .content // ""')
    
    log "INFO" "Handling query: $query"
    
    # Similar to task but expects a direct answer
    handle_task "$message"
}

# Handle broadcast message
handle_broadcast() {
    local message="$1"
    local broadcast=$(echo "$message" | jq -r '.content // ""')
    
    log "INFO" "Received broadcast: $broadcast"
    
    # Store in collective memory
    echo "$message" >> "$COLLECTIVE_DIR/broadcasts.jsonl"
}

# Send response to another agent
send_response() {
    local to_agent="$1"
    local content="$2"
    local original_message="$3"
    local original_id=$(echo "$original_message" | jq -r '.id // ""')
    
    if [ "$to_agent" = "unknown" ] || [ -z "$to_agent" ]; then
        log "WARN" "Cannot send response - no recipient"
        return 1
    fi
    
    log "INFO" "Sending response to $to_agent"
    
    curl -s -X POST "$LITELLM_HOST/v1/agents/$to_agent/send" \
        -H "Authorization: Bearer $LITELLM_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"from\": \"$AGENT_NAME\",
            \"type\": \"response\",
            \"content\": \"$content\",
            \"in_reply_to\": \"$original_id\",
            \"timestamp\": \"$(date -Iseconds)\"
        }" 2>/dev/null || true
}

# Execute a skill
execute_skill() {
    local skill_name="$1"
    local context="$2"
    local skill_dir="$SKILLS_PATH/$skill_name"
    
    log "INFO" "Executing skill: $skill_name"
    
    # Check if skill exists
    if [ ! -d "$skill_dir" ]; then
        log "ERROR" "Skill not found: $skill_name"
        return 1
    fi
    
    # Check for skill script
    local skill_script=""
    if [ -f "$skill_dir/$skill_name.sh" ]; then
        skill_script="$skill_dir/$skill_name.sh"
    elif [ -f "$skill_dir/index.js" ]; then
        skill_script="node $skill_dir/index.js"
    elif [ -f "$skill_dir/main.sh" ]; then
        skill_script="$skill_dir/main.sh"
    else
        log "ERROR" "No executable found for skill: $skill_name"
        return 1
    fi
    
    # Execute skill with context
    export AGENT_NAME AGENT_ROLE LITELLM_HOST LITELLM_API_KEY
    export SKILL_CONTEXT="$context"
    
    local result
    result=$($skill_script --context "$context" 2>&1 || echo "Skill execution failed")
    
    log "INFO" "Skill result: $result"
    
    # Store result in memory
    echo "{\"skill\": \"$skill_name\", \"result\": \"$result\", \"timestamp\": \"$(date -Iseconds)\"}" >> "$MEMORY_DIR/skill_history.jsonl"
    
    echo "$result"
}

# Store message in memory
store_message() {
    local message="$1"
    echo "$message" >> "$MEMORY_DIR/messages.jsonl"
}

# Run autonomy modules (thought-loop, self-model)
run_autonomy_modules() {
    log "INFO" "Running autonomy modules..."
    
    # Thought loop - if available
    if [ -f "/app/modules/thought-loop/thought-loop.sh" ]; then
        log "DEBUG" "Running thought-loop module"
        /app/modules/thought-loop/thought-loop.sh &
    fi
    
    # Self-model - if available
    if [ -f "/app/modules/self-model/self-model.js" ]; then
        log "DEBUG" "Running self-model module"
        node /app/modules/self-model/self-model.js &
    fi
}

# Start Redis subscriber for real-time A2A messaging
start_redis_subscriber() {
    log "INFO" "Starting Redis subscriber for real-time A2A messaging..."
    
    # Check if Node.js is available
    if command -v node &> /dev/null; then
        # Use Node.js subscriber (recommended)
        if [ -f "/app/lib/redis-subscriber.js" ]; then
            log "INFO" "Starting Node.js Redis subscriber"
            node /app/lib/redis-subscriber.js &
            log "INFO" "Node.js Redis subscriber started"
            return 0
        fi
    fi
    
    # Fall back to bash subscriber
    if [ -f "/app/lib/redis-subscriber.sh" ]; then
        log "INFO" "Starting Bash Redis subscriber"
        chmod +x /app/lib/redis-subscriber.sh
        /app/lib/redis-subscriber.sh &
        log "INFO" "Bash Redis subscriber started"
        return 0
    fi
    
    log "WARN" "No Redis subscriber script found, skipping"
    return 1
}

# Main loop
main() {
    log "INFO" "=========================================="
    log "INFO" "Starting Agent: $AGENT_NAME"
    log "INFO" "Role: $AGENT_ROLE"
    log "INFO" "Model: $AGENT_MODEL"
    log "INFO" "LiteLLM: $LITELLM_HOST"
    log "INFO" "Skills: $SKILLS_PATH"
    log "INFO" "=========================================="
    
    # Start health check server
    start_health_server
    
    # Wait for LiteLLM to be ready
    log "INFO" "Waiting for LiteLLM to be ready..."
    local max_retries=30
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if curl -s -f "$LITELLM_HOST/health" > /dev/null 2>&1; then
            log "INFO" "LiteLLM is ready"
            break
        fi
        retry=$((retry + 1))
        sleep 2
    done
    
    if [ $retry -eq $max_retries ]; then
        log "WARN" "LiteLLM not ready after $max_retries retries, continuing anyway"
    fi
    
    # Register agent
    register_agent || true
    
    # Start autonomy modules
    run_autonomy_modules
    
    # Start Redis subscriber for real-time A2A messaging
    start_redis_subscriber || true
    
    # Main polling loop
    log "INFO" "Entering main loop (interval: ${AGENT_LOOP_INTERVAL}s)"
    
    while true; do
        # Poll for messages
        local messages
        messages=$(poll_messages)
        
        # Process each message
        local msg_count=$(echo "$messages" | jq '.messages | length' 2>/dev/null || echo "0")
        
        if [ "$msg_count" -gt 0 ]; then
            log "INFO" "Processing $msg_count message(s)"
            
            echo "$messages" | jq -c '.messages[]' 2>/dev/null | while read -r msg; do
                process_message "$msg"
            done
        fi
        
        # Send heartbeat
        send_heartbeat
        
        # Sleep before next iteration
        sleep "$AGENT_LOOP_INTERVAL"
    done
}

# Trap signals for graceful shutdown
trap 'log "INFO" "Received shutdown signal"; exit 0' SIGTERM SIGINT

# Run main
main
